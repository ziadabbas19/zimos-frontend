import { describe, expect, it } from "vitest";
import { nearestGapIndex, originOf, readFrameMessage } from "./previewBridge";

/**
 * The editor's window accepts messages from anything that can reach it, so the
 * bridge must drop everything that isn't one of its own preview frames, at the
 * storefront's exact origin, saying one of three known things.
 */

const STOREFRONT = "http://localhost:3000";
const frameA = { name: "frame-a" };
const frameB = { name: "frame-b" };
const frames = [frameA, frameB];

const select = { type: "zimos:select-section", sectionId: "hero-1a2b" };

describe("originOf", () => {
  it("reduces a URL to its origin", () => {
    expect(originOf("http://localhost:3000")).toBe("http://localhost:3000");
    expect(originOf("https://store.zimos.co/some/path?x=1")).toBe("https://store.zimos.co");
  });

  it("returns null for anything that isn't a URL with an origin", () => {
    expect(originOf("not a url")).toBeNull();
    expect(originOf("")).toBeNull();
    expect(originOf("data:text/html,hi")).toBeNull();
  });
});

describe("readFrameMessage — origin check", () => {
  it("accepts a message from the storefront origin and one of our frames", () => {
    expect(readFrameMessage({ origin: STOREFRONT, data: select, source: frameB }, STOREFRONT, frames)).toEqual(
      select
    );
  });

  it("rejects any other origin, however close", () => {
    for (const origin of [
      "http://localhost:3001",
      "https://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:3000.evil.test",
      "null",
      "",
    ]) {
      expect(readFrameMessage({ origin, data: select, source: frameA }, STOREFRONT, frames)).toBeNull();
    }
  });

  it("rejects everything when the storefront origin is unknown", () => {
    expect(readFrameMessage({ origin: STOREFRONT, data: select, source: frameA }, null, frames)).toBeNull();
  });

  it("rejects the right origin from a window that isn't one of our frames", () => {
    const stranger = { name: "another-tab" };
    expect(readFrameMessage({ origin: STOREFRONT, data: select, source: stranger }, STOREFRONT, frames)).toBeNull();
    expect(readFrameMessage({ origin: STOREFRONT, data: select, source: null }, STOREFRONT, frames)).toBeNull();
  });

  it("does not treat a missing frame (null contentWindow) as a match for a null source", () => {
    expect(readFrameMessage({ origin: STOREFRONT, data: select, source: null }, STOREFRONT, [null, null])).toBeNull();
  });
});

describe("readFrameMessage — payloads", () => {
  const read = (data: unknown) => readFrameMessage({ origin: STOREFRONT, data, source: frameA }, STOREFRONT, frames);

  it("reads the frame messages", () => {
    expect(read({ type: "zimos:insert-section", index: 2 })).toEqual({ type: "zimos:insert-section", index: 2 });
    expect(read({ type: "zimos:preview-ready", sectionIds: ["a", "b"] })).toEqual({
      type: "zimos:preview-ready",
      sectionIds: ["a", "b"],
    });
    expect(read({ type: "zimos:move-section", sectionId: "hero-1a2b", direction: "up" })).toEqual({
      type: "zimos:move-section",
      sectionId: "hero-1a2b",
      direction: "up",
    });
    expect(
      read({
        type: "zimos:section-rects",
        sections: [{ sectionId: "hero-1a2b", index: 0, top: 12, height: 340 }],
      })
    ).toEqual({
      type: "zimos:section-rects",
      sections: [{ sectionId: "hero-1a2b", index: 0, top: 12, height: 340 }],
    });
  });

  it("reads which part of a template header was clicked, and only a plain id", () => {
    expect(read({ type: "zimos:select-shell", part: "header", xsPart: "strip-2" })).toEqual({ type: "zimos:select-shell", part: "header", xsPart: "strip-2" });
    expect(read({ type: "zimos:select-shell", part: "header", xsPart: "<img onerror>" })).toEqual({ type: "zimos:select-shell", part: "header" });
    expect(read({ type: "zimos:select-shell", part: "footer" })).toEqual({ type: "zimos:select-shell", part: "footer" });
  });

  it("drops junk entries from a section-rects message rather than the whole message", () => {
    expect(
      read({
        type: "zimos:section-rects",
        sections: [
          { sectionId: "a", index: 0, top: 0, height: 100 },
          { sectionId: "b", index: -1, top: 0, height: 100 },
          { sectionId: "", index: 1, top: 0, height: 100 },
          { sectionId: "c", index: 2, top: "nope", height: 100 },
          null,
        ],
      })
    ).toEqual({
      type: "zimos:section-rects",
      sections: [{ sectionId: "a", index: 0, top: 0, height: 100 }],
    });
  });

  it("reads the mode the frame opened in, and every later switch", () => {
    expect(read({ type: "zimos:preview-ready", sectionIds: [], colorMode: "dark" })).toEqual({
      type: "zimos:preview-ready",
      sectionIds: [],
      colorMode: "dark",
    });
    // An unknown mode is left out rather than guessed.
    expect(read({ type: "zimos:preview-ready", sectionIds: [], colorMode: "sepia" })).toEqual({
      type: "zimos:preview-ready",
      sectionIds: [],
    });
    expect(read({ type: "zimos:color-mode", mode: "light" })).toEqual({ type: "zimos:color-mode", mode: "light" });
    expect(read({ type: "zimos:color-mode", mode: "Dark" })).toBeNull();
    expect(read({ type: "zimos:color-mode" })).toBeNull();
  });

  it("drops junk ids from a ready message rather than the whole message", () => {
    expect(read({ type: "zimos:preview-ready", sectionIds: ["a", 7, "", null, "b"] })).toEqual({
      type: "zimos:preview-ready",
      sectionIds: ["a", "b"],
    });
    expect(read({ type: "zimos:preview-ready" })).toEqual({ type: "zimos:preview-ready", sectionIds: [] });
  });

  it("rejects malformed or unknown messages", () => {
    expect(read(null)).toBeNull();
    expect(read("zimos:select-section")).toBeNull();
    expect(read({ type: "zimos:select-section" })).toBeNull();
    expect(read({ type: "zimos:select-section", sectionId: 42 })).toBeNull();
    expect(read({ type: "zimos:select-section", sectionId: "" })).toBeNull();
    expect(read({ type: "zimos:insert-section", index: -1 })).toBeNull();
    expect(read({ type: "zimos:insert-section", index: 1.5 })).toBeNull();
    expect(read({ type: "zimos:insert-section", index: "1" })).toBeNull();
    expect(read({ type: "zimos:move-section", sectionId: "a" })).toBeNull();
    expect(read({ type: "zimos:move-section", sectionId: "a", direction: "sideways" })).toBeNull();
    expect(read({ type: "zimos:move-section", sectionId: "", direction: "up" })).toBeNull();
    expect(read({ type: "zimos:section-rects" })).toBeNull();
    expect(read({ type: "zimos:section-rects", sections: "nope" })).toBeNull();
    // The editor's own outgoing messages are not something a frame may send.
    expect(read({ type: "zimos:editor-state", selectedId: "a" })).toBeNull();
    expect(read({ type: "zimos:drag-state", active: true, hoverIndex: 1 })).toBeNull();
    expect(read({ type: "something-else" })).toBeNull();
  });
});

describe("nearestGapIndex", () => {
  // Three 100px-tall sections stacked with no gap: [0,100), [100,200), [200,300).
  const rects = [
    { sectionId: "a", index: 0, top: 0, height: 100 },
    { sectionId: "b", index: 1, top: 100, height: 100 },
    { sectionId: "c", index: 2, top: 200, height: 100 },
  ];

  it("picks the gap before the section whose midpoint the pointer hasn't passed yet", () => {
    expect(nearestGapIndex(rects, -50)).toBe(0);
    expect(nearestGapIndex(rects, 0)).toBe(0);
    expect(nearestGapIndex(rects, 49)).toBe(0);
    expect(nearestGapIndex(rects, 51)).toBe(1);
    expect(nearestGapIndex(rects, 149)).toBe(1);
    expect(nearestGapIndex(rects, 151)).toBe(2);
    expect(nearestGapIndex(rects, 249)).toBe(2);
  });

  it("returns one past the last section once the pointer is below every midpoint", () => {
    expect(nearestGapIndex(rects, 251)).toBe(3);
    expect(nearestGapIndex(rects, 10_000)).toBe(3);
  });

  it("doesn't require the rects to arrive in index order", () => {
    const shuffled = [rects[2], rects[0], rects[1]];
    expect(nearestGapIndex(shuffled, 51)).toBe(1);
  });

  it("returns 0 for an empty page", () => {
    expect(nearestGapIndex([], 500)).toBe(0);
  });
});

describe("readFrameMessage — the canvas's font button", () => {
  const read = (data: unknown) => readFrameMessage({ origin: STOREFRONT, data, source: frameA }, STOREFRONT, frames);

  it("passes an element's 'Aa', and the section's bar (no element)", () => {
    expect(read({ type: "zimos:pick-font", sectionId: "hero-1", elementId: "h1-2" })).toEqual({ type: "zimos:pick-font", sectionId: "hero-1", elementId: "h1-2" });
    expect(read({ type: "zimos:pick-font", sectionId: "hero-1" })).toEqual({ type: "zimos:pick-font", sectionId: "hero-1" });
    expect(read({ type: "zimos:section-action", sectionId: "hero-1", action: "font" })).toEqual({ type: "zimos:section-action", sectionId: "hero-1", action: "font" });
  });

  it("drops one that names no section, or names its element with anything but an id", () => {
    expect(read({ type: "zimos:pick-font" })).toBeNull();
    expect(read({ type: "zimos:pick-font", sectionId: "hero-1", elementId: 7 })).toBeNull();
    expect(read({ type: "zimos:pick-font", sectionId: "hero-1", elementId: "x".repeat(500) })).toBeNull();
  });
});
