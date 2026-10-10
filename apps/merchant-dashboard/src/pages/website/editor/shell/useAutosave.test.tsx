import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTOSAVE_DELAY_MS, useAutosave } from "./useAutosave";

/**
 * The draft saves by itself a moment after the last change. These pin the
 * rules a merchant relies on without knowing them: one save per pause, the
 * newest content every time, one save at a time, a failure that is said and
 * not hammered, and nothing lost on the way out.
 */

interface Doc {
  /** What is on screen. */
  value: string;
  /** What the server holds. */
  stored: string;
  /** Every content a save sent, in order. */
  sent: string[];
  /** How the next save answers; a function to hold it open until told. */
  answer: boolean | (() => Promise<boolean>);
}

function setup(first = "a") {
  const doc: Doc = { value: first, stored: first, sent: [], answer: true };
  const save = vi.fn(async () => {
    const sending = doc.value;
    doc.sent.push(sending);
    const stored = typeof doc.answer === "function" ? await doc.answer() : doc.answer;
    if (stored) doc.stored = sending;
    return stored;
  });
  const hook = renderHook(
    ({ scope }: { scope: string }) =>
      useAutosave({
        signature: doc.value,
        dirty: doc.value !== doc.stored,
        isDirty: () => doc.value !== doc.stored,
        save,
        scope,
      }),
    { initialProps: { scope: "page-1" } }
  );
  const type = (value: string) => {
    doc.value = value;
    hook.rerender({ scope: "page-1" });
  };
  const pause = async (ms = AUTOSAVE_DELAY_MS) => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
    hook.rerender({ scope: "page-1" });
  };
  return { doc, save, hook, type, pause };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("saving by itself", () => {
  it("says nothing changed until something does", () => {
    const { hook, save } = setup();
    expect(hook.result.current.state).toBe("idle");
    expect(save).not.toHaveBeenCalled();
  });

  it("saves once, a pause after the last change, with the newest content", async () => {
    const { doc, save, hook, type, pause } = setup();
    type("ab");
    expect(hook.result.current.state).toBe("saving");
    await pause(AUTOSAVE_DELAY_MS - 100);
    type("abc");
    await pause(AUTOSAVE_DELAY_MS - 100);
    // The second change restarted the pause: nothing has gone out yet.
    expect(save).not.toHaveBeenCalled();
    await pause(100);
    expect(save).toHaveBeenCalledTimes(1);
    expect(doc.sent).toEqual(["abc"]);
    expect(hook.result.current.state).toBe("saved");
  });

  it("gives a change made during a save its own save afterwards", async () => {
    const { doc, save, type, pause, hook } = setup();
    let release: (stored: boolean) => void = () => undefined;
    doc.answer = () => new Promise<boolean>((resolve) => (release = resolve));
    type("ab");
    await pause();
    expect(doc.sent).toEqual(["ab"]);
    doc.answer = true;
    type("abc");
    await pause();
    // One save at a time: the second waits for the first to answer.
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => {
      release(true);
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    });
    hook.rerender({ scope: "page-1" });
    expect(doc.sent).toEqual(["ab", "abc"]);
    expect(hook.result.current.state).toBe("saved");
  });
});

describe("a save that fails", () => {
  it("is said, and is not repeated on a timer", async () => {
    const { doc, save, hook, type, pause } = setup();
    doc.answer = false;
    type("ab");
    await pause();
    expect(hook.result.current.state).toBe("failed");
    await pause(AUTOSAVE_DELAY_MS * 5);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("goes out again with the next change", async () => {
    const { doc, hook, type, pause } = setup();
    doc.answer = false;
    type("ab");
    await pause();
    doc.answer = true;
    type("abc");
    await pause();
    expect(doc.sent).toEqual(["ab", "abc"]);
    expect(hook.result.current.state).toBe("saved");
  });

  it("goes out at once when asked, and answers whether it was stored", async () => {
    const { doc, hook, type, pause } = setup();
    doc.answer = false;
    type("ab");
    await pause();
    doc.answer = true;
    let stored: boolean | undefined;
    await act(async () => {
      stored = await hook.result.current.flush();
    });
    expect(stored).toBe(true);
    expect(doc.stored).toBe("ab");
  });

  it("treats a save that throws as not stored", async () => {
    const { doc, hook, type, pause } = setup();
    doc.answer = () => Promise.reject(new Error("offline"));
    type("ab");
    await pause();
    expect(hook.result.current.state).toBe("failed");
  });
});

describe("asking for a save now", () => {
  it("skips the pause", async () => {
    const { doc, hook, type } = setup();
    type("ab");
    await act(async () => {
      await hook.result.current.flush();
    });
    expect(doc.sent).toEqual(["ab"]);
    // The pause that was running is over: no second save follows.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2);
    });
    expect(doc.sent).toEqual(["ab"]);
  });

  it("sends nothing and answers true when everything is stored", async () => {
    const { save, hook } = setup();
    let stored: boolean | undefined;
    await act(async () => {
      stored = await hook.result.current.flush();
    });
    expect(stored).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });
});

describe("on the way out", () => {
  it("sends what is left when the editor closes", () => {
    const { doc, hook, type } = setup();
    type("ab");
    hook.unmount();
    expect(doc.sent).toEqual(["ab"]);
  });

  it("sends what is left when the tab goes to the background", async () => {
    const { doc, type } = setup();
    type("ab");
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(0);
    });
    visibility.mockRestore();
    expect(doc.sent).toEqual(["ab"]);
  });

  it("starts another page with a clean slate of words", async () => {
    const { hook, type, pause } = setup();
    type("ab");
    await pause();
    expect(hook.result.current.state).toBe("saved");
    hook.rerender({ scope: "page-2" });
    expect(hook.result.current.state).toBe("idle");
  });
});
