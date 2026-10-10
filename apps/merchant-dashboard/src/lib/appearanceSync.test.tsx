import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, type UiAppearance, type UiAppearanceInput, type UiPreferences } from "@store-builder/api-client";
import { api } from "@/test/mocks";
import { setGlass, setGlow, setLook, setTone } from "@/lib/appearance";
import { ACCOUNT_KEY, SAVE_DELAY_MS, UPDATED_AT_KEY, startAppearanceSync, stopAppearanceSync } from "./appearanceSync";

// The look kept on the account as well as on this device (lib/appearanceSync):
// what happens at sign-in, on each choice, when a save fails, and with an API
// that has no such endpoint. The account is a stand-in for the two calls.

const PATH = "/auth/me/ui-preferences";
const NOW = "2026-10-10T10:00:00.000Z";
const EARLIER = "2026-10-10T07:00:00.000Z";
const LATER = "2026-10-10T08:00:00.000Z";
// The account's clock is not this device's: a save comes back with its time, not ours.
const ACCOUNT_CLOCK_AHEAD_MS = 5000;

const html = document.documentElement;

interface Account {
  held: UiPreferences | null;
  readFails: unknown;
  saveFails: unknown;
  /** While set, a save does not answer until it resolves. */
  gate: Promise<void> | null;
  reads: number;
  /** Every save that was sent, answered or not. */
  saves: UiAppearanceInput[];
}

/** The account's two calls: reads answer what it holds, saves replace it and stamp the time. */
function account(held: UiAppearance | null = null): Account {
  const state: Account = { held: held ? { appearance: held } : null, readFails: null, saveFails: null, gate: null, reads: 0, saves: [] };
  api.request.mockImplementation((async (path: string, opts?: { method?: string; body?: { appearance: UiAppearanceInput } }) => {
    if (path !== PATH) return new Promise<never>(() => undefined);
    if (!opts?.method) {
      state.reads += 1;
      if (state.readFails) throw state.readFails;
      return { uiPreferences: state.held };
    }
    const sent = opts.body!.appearance;
    state.saves.push(sent);
    if (state.gate) await state.gate;
    if (state.saveFails) throw state.saveFails;
    state.held = { appearance: { ...sent, updatedAt: new Date(Date.now() + ACCOUNT_CLOCK_AHEAD_MS).toISOString() } };
    return { uiPreferences: state.held };
  }) as never);
  return state;
}

const theirs = (over: Partial<UiAppearance> = {}): UiAppearance => ({
  look: "black",
  darkTone: 30,
  glass: false,
  glowLeft: "#2f7bff",
  glowRight: "#14b8a6",
  glowIntensity: 40,
  updatedAt: EARLIER,
  ...over,
});

/** This device as it would be after choices made on it earlier. */
function device(storage: Record<string, string>) {
  for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, value);
}

/** Everything kept on this device. */
function kept() {
  return Object.fromEntries(
    Object.keys(localStorage)
      .sort()
      .map((key) => [key, localStorage.getItem(key)])
  );
}

/** Lets the calls in flight answer, without moving the clock. */
async function settle() {
  for (let i = 0; i < 50; i += 1) await Promise.resolve();
}

/** Lets a choice rest for as long as it takes to be saved. */
async function rest(ms = SAVE_DELAY_MS) {
  await vi.advanceTimersByTimeAsync(ms);
  await settle();
}

async function signIn(userId = "user_1") {
  await startAppearanceSync(userId);
  await settle();
}

const notFound = () => new ApiError("Cannot GET /api/v1/auth/me/ui-preferences", 404, "ROUTE_NOT_FOUND");

beforeEach(() => {
  vi.useFakeTimers({ now: new Date(NOW) });
});

afterEach(() => {
  stopAppearanceSync();
  vi.useRealTimers();
  html.classList.remove("dark");
  for (const name of ["data-look", "data-tone", "data-glass"]) html.removeAttribute(name);
  html.removeAttribute("style");
});

describe("at sign-in", () => {
  it("saves the look of this device to an account that has none, once", async () => {
    device({ "zimos.look": "dark", "zimos.darkLook": "dark", theme: "dark", "zimos.darkTone": "20", "zimos.glowLeft": "#2f7bff" });
    const before = kept();
    const server = account(null);

    await signIn();
    expect(server.saves).toEqual([{ look: "dark", darkTone: 20, glass: true, glowLeft: "#2f7bff", glowRight: null, glowIntensity: 100 }]);
    // The look here is as it was; only when and with whom it was agreed is added, by the account's clock.
    expect(kept()).toEqual({ ...before, [UPDATED_AT_KEY]: server.held!.appearance.updatedAt, [ACCOUNT_KEY]: "user_1" });
    expect(Date.parse(server.held!.appearance.updatedAt!)).toBe(Date.parse(NOW) + ACCOUNT_CLOCK_AHEAD_MS);

    // Taken up again on the same page, then on the next visit: nothing more to send.
    await signIn();
    expect(server.reads).toBe(1);
    stopAppearanceSync();
    await signIn();
    expect(server.reads).toBe(2);
    expect(server.saves).toHaveLength(1);
  });

  it("sends nothing for a device that never kept a look, and keeps nothing new on it", async () => {
    const server = account(null);
    await signIn();
    await rest(5000);
    expect(server.reads).toBe(1);
    expect(server.saves).toEqual([]);
    expect(kept()).toEqual({});
  });

  it("takes the account's look on a device that never kept one, and draws it", async () => {
    const server = account(theirs());
    await signIn();
    expect(kept()).toEqual({
      "zimos.look": "black",
      "zimos.darkLook": "black",
      theme: "dark",
      "zimos.darkTone": "30",
      "zimos.glass": "off",
      "zimos.glowLeft": "#2f7bff",
      "zimos.glowRight": "#14b8a6",
      "zimos.glowIntensity": "40",
      [UPDATED_AT_KEY]: EARLIER,
      [ACCOUNT_KEY]: "user_1",
    });
    expect(html).toHaveClass("dark");
    expect(html).toHaveAttribute("data-look", "black");
    expect(html.style.getPropertyValue("--zimos-glow-left")).toBe("#2f7bff");
    expect(server.saves).toEqual([]);
  });

  it("keeps what is the default as nothing at all when it comes from the account", async () => {
    account(theirs({ look: "light", darkTone: 50, glass: true, glowLeft: null, glowRight: null, glowIntensity: 100 }));
    await signIn();
    expect(kept()).toEqual({ "zimos.look": "light", theme: "light", [UPDATED_AT_KEY]: EARLIER, [ACCOUNT_KEY]: "user_1" });
    expect(html).not.toHaveAttribute("data-tone");
    expect(html).not.toHaveAttribute("data-glass");
  });

  it("takes the account's look when it was saved after the one here", async () => {
    device({ "zimos.look": "light", theme: "light", "zimos.glowLeft": "#00ff88", [UPDATED_AT_KEY]: EARLIER, [ACCOUNT_KEY]: "user_1" });
    const server = account(theirs({ look: "dark", darkTone: 80, glass: true, glowLeft: null, glowRight: null, glowIntensity: 100, updatedAt: LATER }));
    await signIn();
    expect(kept()).toEqual({
      "zimos.look": "dark",
      "zimos.darkLook": "dark",
      theme: "dark",
      "zimos.darkTone": "80",
      [UPDATED_AT_KEY]: LATER,
      [ACCOUNT_KEY]: "user_1",
    });
    expect(html).toHaveAttribute("data-tone", "80");
    expect(server.saves).toEqual([]);
  });

  it("saves the look here when it was changed after the account's", async () => {
    device({ "zimos.look": "dark", "zimos.darkLook": "dark", theme: "dark", "zimos.darkTone": "80", [UPDATED_AT_KEY]: LATER, [ACCOUNT_KEY]: "user_1" });
    const server = account(theirs({ look: "light", updatedAt: EARLIER }));
    await signIn();
    expect(server.saves).toEqual([{ look: "dark", darkTone: 80, glass: true, glowLeft: null, glowRight: null, glowIntensity: 100 }]);
    // Nothing of the account's older look reached this device.
    expect(localStorage.getItem("zimos.look")).toBe("dark");
    expect(localStorage.getItem("zimos.darkTone")).toBe("80");
    expect(localStorage.getItem("zimos.glass")).toBeNull();
    expect(localStorage.getItem(UPDATED_AT_KEY)).toBe(server.held!.appearance.updatedAt);
  });

  it("does nothing when both hold the same look from the same save", async () => {
    device({ "zimos.look": "black", "zimos.darkLook": "black", theme: "dark", "zimos.darkTone": "30", "zimos.glass": "off", "zimos.glowLeft": "#2f7bff", "zimos.glowRight": "#14b8a6", "zimos.glowIntensity": "40", [UPDATED_AT_KEY]: EARLIER, [ACCOUNT_KEY]: "user_1" });
    const before = kept();
    const server = account(theirs());
    await signIn();
    await rest(5000);
    expect(server.saves).toEqual([]);
    expect(kept()).toEqual(before);
  });

  it("saves a look that was changed here while signed out", async () => {
    // The time is the one of the last save, but the look is no longer the account's.
    device({ "zimos.look": "light", theme: "light", "zimos.darkLook": "black", "zimos.darkTone": "30", "zimos.glass": "off", "zimos.glowLeft": "#2f7bff", "zimos.glowRight": "#14b8a6", "zimos.glowIntensity": "40", [UPDATED_AT_KEY]: EARLIER, [ACCOUNT_KEY]: "user_1" });
    const server = account(theirs());
    await signIn();
    expect(server.saves).toEqual([{ look: "light", darkTone: 30, glass: false, glowLeft: "#2f7bff", glowRight: "#14b8a6", glowIntensity: 40 }]);
    expect(localStorage.getItem("zimos.look")).toBe("light");
  });

  it("takes the account's look over one this device kept before it followed any account", async () => {
    device({ "zimos.look": "light", theme: "light", "zimos.glowLeft": "#00ff88" });
    const server = account(theirs());
    await signIn();
    expect(localStorage.getItem("zimos.look")).toBe("black");
    expect(localStorage.getItem("zimos.glowLeft")).toBe("#2f7bff");
    expect(server.saves).toEqual([]);
  });

  it("starts another account from its own look, never from the look the last account left here", async () => {
    // The look here was agreed with user_1, later than anything user_2 ever saved.
    device({ "zimos.look": "light", theme: "light", "zimos.glowLeft": "#00ff88", [UPDATED_AT_KEY]: LATER, [ACCOUNT_KEY]: "user_1" });
    const server = account(theirs({ updatedAt: EARLIER }));
    await signIn("user_2");
    expect(server.saves).toEqual([]);
    expect(server.held!.appearance).toEqual(theirs({ updatedAt: EARLIER }));
    expect(localStorage.getItem("zimos.look")).toBe("black");
    expect(localStorage.getItem(ACCOUNT_KEY)).toBe("user_2");
    expect(localStorage.getItem(UPDATED_AT_KEY)).toBe(EARLIER);
  });

  it("leaves the look here as it is when the other device never chose one", async () => {
    device({ "zimos.look": "dark", "zimos.darkLook": "dark", theme: "dark" });
    account(theirs({ look: null }));
    await signIn();
    expect(localStorage.getItem("zimos.look")).toBe("dark");
    expect(localStorage.getItem("zimos.darkLook")).toBe("dark");
    // The rest of the account's look is taken.
    expect(localStorage.getItem("zimos.glass")).toBe("off");
    expect(localStorage.getItem("zimos.darkTone")).toBe("30");
  });

  it("keeps a choice made while the account was being read, and saves it", async () => {
    device({ "zimos.look": "light", theme: "light" });
    const server = account(theirs());
    const reading = startAppearanceSync("user_1");
    setLook("dark");
    await reading;
    await settle();
    expect(localStorage.getItem("zimos.look")).toBe("dark");
    expect(server.saves).toEqual([{ look: "dark", darkTone: 50, glass: true, glowLeft: null, glowRight: null, glowIntensity: 100 }]);
  });
});

describe("an API without the endpoint, or one that cannot be read", () => {
  const today = { "zimos.look": "black", "zimos.darkLook": "black", theme: "dark", "zimos.darkTone": "20", "zimos.glass": "off", "zimos.glowLeft": "#00ff88" };

  /** Choices made as on any day, on a device that already had a look. */
  async function chooseAsAlways() {
    setLook("black");
    setTone(20);
    setGlass(false);
    setGlow({ left: "#00ff88" });
    await rest(5000);
  }

  it("goes on exactly as before on a 404: one question at sign-in, nothing sent, nothing more kept", async () => {
    device({ "zimos.look": "dark", "zimos.darkLook": "dark", theme: "dark" });
    const server = account(theirs());
    server.readFails = notFound();

    await signIn();
    // The account's look, which this API cannot hand over, changed nothing here.
    expect(kept()).toEqual({ "zimos.look": "dark", "zimos.darkLook": "dark", theme: "dark" });

    await chooseAsAlways();
    expect(kept()).toEqual(today);
    expect(html).toHaveAttribute("data-look", "black");
    expect(server.saves).toEqual([]);
    expect(api.request).toHaveBeenCalledTimes(1);
  });

  it("goes on exactly as before when the read fails any other way", async () => {
    for (const failure of [new ApiError("Unexpected", 500, "INTERNAL_SERVER_ERROR"), new ApiError("Too many requests", 429, "RATE_LIMITED"), new TypeError("Failed to fetch")]) {
      localStorage.clear();
      stopAppearanceSync();
      device({ "zimos.look": "dark", "zimos.darkLook": "dark", theme: "dark" });
      const server = account(theirs());
      server.readFails = failure;
      await signIn();
      await chooseAsAlways();
      expect(kept()).toEqual(today);
      expect(server.saves).toEqual([]);
    }
  });

  it("asks again at the next sign-in", async () => {
    const server = account(theirs());
    server.readFails = notFound();
    await signIn();
    expect(kept()).toEqual({});

    stopAppearanceSync();
    server.readFails = null;
    await signIn();
    expect(server.reads).toBe(2);
    expect(localStorage.getItem("zimos.look")).toBe("black");
  });

  it("stops sending for this sign-in when a save answers 404", async () => {
    const server = account(null);
    await signIn();
    server.saveFails = notFound();

    setLook("dark");
    await rest();
    expect(server.saves).toHaveLength(1);

    setLook("black");
    setTone(70);
    await rest(5000);
    expect(server.saves).toHaveLength(1);
    // Kept on this device all the same.
    expect(localStorage.getItem("zimos.look")).toBe("black");
    expect(localStorage.getItem("zimos.darkTone")).toBe("70");
  });
});

describe("a choice made on this page", () => {
  it("is kept here at once and saved to the account once it has rested", async () => {
    const server = account(null);
    await signIn();

    setLook("dark");
    expect(localStorage.getItem("zimos.look")).toBe("dark");
    expect(html).toHaveAttribute("data-look", "dark");
    await rest(SAVE_DELAY_MS - 1);
    expect(server.saves).toEqual([]);

    await rest(1);
    expect(server.saves).toEqual([{ look: "dark", darkTone: 50, glass: true, glowLeft: null, glowRight: null, glowIntensity: 100 }]);
    expect(localStorage.getItem(UPDATED_AT_KEY)).toBe(server.held!.appearance.updatedAt);
    expect(localStorage.getItem(ACCOUNT_KEY)).toBe("user_1");
  });

  it("sends one request for a slider that is dragged", async () => {
    device({ "zimos.look": "dark", "zimos.darkLook": "dark", theme: "dark" });
    const server = account(null);
    await signIn();
    expect(server.saves).toHaveLength(1);

    for (const tone of [48, 45, 41, 36, 30, 24, 19, 15, 12, 10]) {
      setTone(tone);
      await rest(60);
    }
    expect(server.saves).toHaveLength(1);
    await rest(SAVE_DELAY_MS - 61);
    expect(server.saves).toHaveLength(1);

    await rest(1);
    expect(server.saves).toHaveLength(2);
    expect(server.saves[1]).toEqual({ look: "dark", darkTone: 10, glass: true, glowLeft: null, glowRight: null, glowIntensity: 100 });
    await rest(5000);
    expect(server.saves).toHaveLength(2);
  });

  it("carries every part of the look, each time", async () => {
    const server = account(null);
    await signIn();
    setLook("dark");
    setTone(0);
    setGlass(false);
    setGlow({ left: "#2F7BFF", right: "#14b8a6", intensity: 0 });
    await rest();
    expect(server.saves).toEqual([{ look: "dark", darkTone: 0, glass: false, glowLeft: "#2f7bff", glowRight: "#14b8a6", glowIntensity: 0 }]);
  });

  it("sends nothing for a choice that changes nothing", async () => {
    device({ "zimos.look": "dark", "zimos.darkLook": "dark", theme: "dark", [UPDATED_AT_KEY]: EARLIER, [ACCOUNT_KEY]: "user_1" });
    const server = account(theirs({ look: "dark", darkTone: 50, glass: true, glowLeft: null, glowRight: null, glowIntensity: 100 }));
    await signIn();

    setLook("dark");
    setTone(50);
    setGlow({ left: "not a colour" });
    await rest(5000);
    expect(server.saves).toEqual([]);
    expect(localStorage.getItem(UPDATED_AT_KEY)).toBe(EARLIER);
  });

  it("says nothing and changes nothing here when the save fails, then sends the whole look with the next choice", async () => {
    device({ "zimos.look": "light", theme: "light", [UPDATED_AT_KEY]: EARLIER, [ACCOUNT_KEY]: "user_1" });
    const server = account(theirs({ look: "light", darkTone: 50, glass: true, glowLeft: null, glowRight: null, glowIntensity: 100 }));
    await signIn();

    for (const failure of [new ApiError("Unexpected", 500, "INTERNAL_SERVER_ERROR"), new TypeError("Failed to fetch")]) {
      server.saves.length = 0;
      server.saveFails = failure;
      setLook("dark");
      setTone(20);
      await rest();
      expect(server.saves).toHaveLength(1);
      // Here, the choice stands; on the account, the look from before.
      expect(localStorage.getItem("zimos.look")).toBe("dark");
      expect(localStorage.getItem("zimos.darkTone")).toBe("20");
      expect(html).toHaveAttribute("data-tone", "20");
      expect(server.held!.appearance.look).toBe("light");
      // Not tried again by itself.
      await rest(60_000);
      expect(server.saves).toHaveLength(1);

      server.saveFails = null;
      setGlass(false);
      await rest();
      expect(server.saves).toHaveLength(2);
      expect(server.saves[1]).toEqual({ look: "dark", darkTone: 20, glass: false, glowLeft: null, glowRight: null, glowIntensity: 100 });
      expect(localStorage.getItem(UPDATED_AT_KEY)).toBe(server.held!.appearance.updatedAt);

      // Back to where this round began.
      setLook("light");
      setTone(50);
      setGlass(true);
      await rest();
    }
  });

  it("sends a choice whose save failed with the next sign-in", async () => {
    device({ "zimos.look": "light", theme: "light", [UPDATED_AT_KEY]: EARLIER, [ACCOUNT_KEY]: "user_1" });
    const server = account(theirs({ look: "light", darkTone: 50, glass: true, glowLeft: null, glowRight: null, glowIntensity: 100 }));
    await signIn();
    server.saveFails = new TypeError("Failed to fetch");
    setLook("black");
    await rest();
    expect(server.held!.appearance.look).toBe("light");

    stopAppearanceSync();
    server.saveFails = null;
    await signIn();
    expect(server.held!.appearance.look).toBe("black");
    expect(localStorage.getItem("zimos.look")).toBe("black");
  });

  it("counts a choice as later than the last save even on a device whose clock is behind", async () => {
    // The account's time of the last save is ahead of this device's clock.
    const ahead = "2026-10-10T11:00:00.000Z";
    device({ "zimos.look": "light", theme: "light", [UPDATED_AT_KEY]: ahead, [ACCOUNT_KEY]: "user_1" });
    const server = account(theirs({ look: "light", darkTone: 50, glass: true, glowLeft: null, glowRight: null, glowIntensity: 100, updatedAt: ahead }));
    await signIn();
    server.saveFails = new TypeError("Failed to fetch");
    setLook("dark");
    await rest();
    expect(Date.parse(localStorage.getItem(UPDATED_AT_KEY)!)).toBeGreaterThan(Date.parse(ahead));

    stopAppearanceSync();
    server.saveFails = null;
    await signIn();
    expect(localStorage.getItem("zimos.look")).toBe("dark");
    expect(server.held!.appearance.look).toBe("dark");
  });

  it("sends a choice made while a save was on its way after it, with the look as it then is", async () => {
    const server = account(null);
    await signIn();
    let open: () => void = () => undefined;
    server.gate = new Promise<void>((resolve) => {
      open = resolve;
    });

    setLook("dark");
    await rest();
    expect(server.saves).toHaveLength(1);

    setTone(20);
    await rest();
    // The first save has not answered: the second waits for it.
    expect(server.saves).toHaveLength(1);

    server.gate = null;
    open();
    await settle();
    expect(server.saves).toHaveLength(2);
    expect(server.saves[1]).toEqual({ look: "dark", darkTone: 20, glass: true, glowLeft: null, glowRight: null, glowIntensity: 100 });
    expect(server.held!.appearance.darkTone).toBe(20);
    expect(localStorage.getItem(UPDATED_AT_KEY)).toBe(server.held!.appearance.updatedAt);
  });
});

describe("signing out", () => {
  it("keeps everything on the device, sends nothing after it, and sends the choice with the next sign-in", async () => {
    const server = account(null);
    await signIn();
    setLook("dark");
    setTone(20);
    setGlow({ left: "#2f7bff" });
    await rest(SAVE_DELAY_MS - 100);

    stopAppearanceSync();
    await rest(5000);
    expect(server.saves).toEqual([]);
    expect(localStorage.getItem("zimos.look")).toBe("dark");
    expect(localStorage.getItem("zimos.darkTone")).toBe("20");
    expect(localStorage.getItem("zimos.glowLeft")).toBe("#2f7bff");
    expect(html).toHaveAttribute("data-look", "dark");

    // Signed out, a choice is kept here as always and goes nowhere.
    setGlass(false);
    await rest(5000);
    expect(server.saves).toEqual([]);
    expect(localStorage.getItem("zimos.glass")).toBe("off");

    await signIn();
    expect(server.saves).toEqual([{ look: "dark", darkTone: 20, glass: false, glowLeft: "#2f7bff", glowRight: null, glowIntensity: 100 }]);
  });

  it("sends a choice once when its owner signs out and in again before it was saved", async () => {
    device({ "zimos.look": "dark", "zimos.darkLook": "dark", theme: "dark", [UPDATED_AT_KEY]: EARLIER, [ACCOUNT_KEY]: "user_1" });
    const server = account(theirs({ look: "dark", darkTone: 50, glass: true, glowLeft: null, glowRight: null, glowIntensity: 100 }));
    await signIn();
    setTone(20);
    await rest(100);

    stopAppearanceSync();
    await signIn();
    expect(server.saves).toEqual([{ look: "dark", darkTone: 20, glass: true, glowLeft: null, glowRight: null, glowIntensity: 100 }]);
    // The save that was waiting before the sign-out is not sent on top of it.
    await rest(5000);
    expect(server.saves).toHaveLength(1);
  });

  it("drops the answer to a read that comes back after it", async () => {
    let answer: (value: unknown) => void = () => undefined;
    api.request.mockImplementation((() => new Promise((resolve) => (answer = resolve))) as never);
    const reading = startAppearanceSync("user_1");
    stopAppearanceSync();
    answer({ uiPreferences: { appearance: theirs() } });
    await reading;
    await settle();
    expect(kept()).toEqual({});
  });
});
