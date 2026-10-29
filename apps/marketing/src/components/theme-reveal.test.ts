import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  REVEAL_ATTRIBUTE,
  animateThemeChange,
  revealCss,
  revealOrigin,
  revealRadius,
  rootZoom,
  type RevealTrigger,
} from "@store-builder/ui/theme-reveal";

/**
 * The circle of the light / dark switch (@store-builder/ui/theme-reveal),
 * shared by this site's switch and the storefront's. Tested here: the
 * package has no test runner of its own, and this site is one of its two users.
 */

const screen390 = { width: 390, height: 844 };

function button(box: { left: number; top: number; width: number; height: number }): Element {
  const el = document.createElement("button");
  el.getBoundingClientRect = () => ({ ...box, right: box.left + box.width, bottom: box.top + box.height, x: box.left, y: box.top, toJSON() {} }) as DOMRect;
  return el;
}

const corner = button({ left: 340, top: 10, width: 40, height: 40 }); // a switch in the top right corner

describe("where the circle starts", () => {
  it("a click or a tap: where it landed", () => {
    expect(revealOrigin({ clientX: 25, clientY: 700, detail: 1, currentTarget: corner }, screen390)).toEqual({ x: 25, y: 700 });
  });

  it("a click at the very corner of the screen is still a click", () => {
    expect(revealOrigin({ clientX: 0, clientY: 0, detail: 1, currentTarget: corner }, screen390)).toEqual({ x: 0, y: 0 });
  });

  it("Enter or Space (a click with no count and no position): the middle of the button", () => {
    expect(revealOrigin({ clientX: 0, clientY: 0, detail: 0, currentTarget: corner }, screen390)).toEqual({ x: 360, y: 30 });
  });

  it("no button to measure: the middle of the screen", () => {
    expect(revealOrigin({ clientX: 0, clientY: 0, detail: 0, currentTarget: null }, screen390)).toEqual({ x: 195, y: 422 });
    expect(revealOrigin(undefined, screen390)).toEqual({ x: 195, y: 422 });
  });
});

describe("how far the circle grows", () => {
  it("to the farthest corner of the screen", () => {
    expect(revealRadius({ x: 0, y: 0 }, { width: 400, height: 300 })).toBe(500);
    expect(revealRadius({ x: 400, y: 300 }, { width: 400, height: 300 })).toBe(500);
    expect(revealRadius({ x: 200, y: 150 }, { width: 400, height: 300 })).toBe(250);
    // Right side, bottom of a phone: the top left corner is the farthest.
    expect(revealRadius({ x: 370, y: 820 }, screen390)).toBeCloseTo(Math.hypot(370, 820));
  });

  it("from a point off the screen (a button scrolled half out), still to the farthest corner", () => {
    expect(revealRadius({ x: -30, y: 100 }, { width: 400, height: 300 })).toBeCloseTo(Math.hypot(430, 200));
  });

  it("the rules draw it from nothing to that radius, at that point", () => {
    const css = revealCss({ x: 12.4, y: 700.6 }, 812.2);
    expect(css).toContain("clip-path:circle(0px at 12px 701px)");
    expect(css).toContain("clip-path:circle(813px at 12px 701px)");
    expect(css).toContain("::view-transition-old(root),::view-transition-new(root){animation:none;mix-blend-mode:normal}");
  });
});

type Update = () => void;

describe("switching the theme", () => {
  let reducedMotion = false;
  const doc = document as Document & { startViewTransition?: unknown };
  // Every transition a test leaves running: the helper lets presses go while one runs, so each test ends them all.
  const pending: Array<(ok: boolean) => void> = [];

  beforeEach(() => {
    reducedMotion = false;
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)" && reducedMotion,
      addEventListener() {},
      removeEventListener() {},
    }));
  });

  afterEach(async () => {
    vi.useRealTimers();
    for (const settle of pending.splice(0)) settle(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    delete doc.startViewTransition;
    vi.unstubAllGlobals();
    document.head.innerHTML = "";
    document.documentElement.removeAttribute(REVEAL_ATTRIBUTE);
  });

  const click: RevealTrigger = { clientX: 300, clientY: 40, detail: 1, currentTarget: corner };

  /** A browser with view transitions; the test says when the update runs and when the circle is done. */
  function withTransitions() {
    const updates: Update[] = [];
    const done: Array<(ok: boolean) => void> = [];
    const skip = vi.fn();
    const start = vi.fn((update: Update) => {
      updates.push(update);
      const finished = new Promise<void>((resolve, reject) => {
        const settle = (ok: boolean) => (ok ? resolve() : reject(new Error("skipped")));
        done.push(settle);
        pending.push(settle);
      });
      return { finished, skipTransition: skip };
    });
    doc.startViewTransition = start;
    return { start, updates, done, skip };
  }

  const styles = () => document.head.querySelectorAll("style").length;

  it("without view transitions: switches at once, as it always did", () => {
    const apply = vi.fn();
    animateThemeChange(click, apply);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(styles()).toBe(0);
    expect(document.documentElement.hasAttribute(REVEAL_ATTRIBUTE)).toBe(false);
  });

  it("with less motion asked for: switches at once, no transition started", () => {
    const { start } = withTransitions();
    reducedMotion = true;
    const apply = vi.fn();
    animateThemeChange(click, apply);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(start).not.toHaveBeenCalled();
    expect(styles()).toBe(0);
  });

  it("with view transitions: the theme changes inside the transition, the circle from the click", async () => {
    const { start, updates, done } = withTransitions();
    const apply = vi.fn();
    animateThemeChange(click, apply);
    expect(start).toHaveBeenCalledTimes(1);
    // The old page is still being kept: nothing switched yet, the circle's rules are in place.
    expect(apply).not.toHaveBeenCalled();
    expect(document.head.textContent).toContain("circle(0px at 300px 40px)");

    updates[0]();
    expect(apply).toHaveBeenCalledTimes(1);
    expect(document.documentElement.hasAttribute(REVEAL_ATTRIBUTE)).toBe(true);

    done[0](true);
    await vi.waitFor(() => expect(styles()).toBe(0));
    expect(document.documentElement.hasAttribute(REVEAL_ATTRIBUTE)).toBe(false);
  });

  it("on a page drawn at a zoom (this site: 90% from 601px), the circle is drawn in the zoomed lengths", () => {
    withTransitions();
    Object.defineProperty(document.documentElement, "currentCSSZoom", { value: 0.9, configurable: true });
    try {
      expect(rootZoom(document.documentElement)).toBe(0.9);
      animateThemeChange(click, vi.fn());
      // The press at 300, 40 on the screen is 333, 44 in the pseudo-elements' own pixels.
      expect(document.head.textContent).toContain("circle(0px at 333px 44px)");
    } finally {
      delete (document.documentElement as { currentCSSZoom?: number }).currentCSSZoom;
    }
    expect(rootZoom(document.documentElement)).toBe(1);
  });

  it("a press while the circle grows is let go; the next one after it works", async () => {
    const { start, updates, done } = withTransitions();
    const apply = vi.fn();
    animateThemeChange(click, apply);
    animateThemeChange(click, apply);
    animateThemeChange({ ...click, detail: 0 }, apply);
    expect(start).toHaveBeenCalledTimes(1);
    updates[0]();
    expect(apply).toHaveBeenCalledTimes(1);

    done[0](true);
    await vi.waitFor(() => expect(styles()).toBe(0));
    animateThemeChange(click, apply);
    expect(start).toHaveBeenCalledTimes(2);
  });

  it("a transition the browser gives up still leaves a clean page and a working switch", async () => {
    const { start, updates, done } = withTransitions();
    const apply = vi.fn();
    animateThemeChange(click, apply);
    updates[0]();
    done[0](false);
    await vi.waitFor(() => expect(styles()).toBe(0));
    expect(document.documentElement.hasAttribute(REVEAL_ATTRIBUTE)).toBe(false);
    animateThemeChange(click, apply);
    expect(start).toHaveBeenCalledTimes(2);
  });

  it("a browser that throws on starting one: switches at once", () => {
    doc.startViewTransition = () => {
      throw new Error("InvalidStateError");
    };
    const apply = vi.fn();
    animateThemeChange(click, apply);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(styles()).toBe(0);
  });

  it("a transition that never settles is ended after a while, and the switch answers again", () => {
    vi.useFakeTimers();
    const { start, skip } = withTransitions();
    animateThemeChange(click, vi.fn());
    vi.advanceTimersByTime(5000);
    expect(skip).toHaveBeenCalledTimes(1);
    expect(styles()).toBe(0);
    animateThemeChange(click, vi.fn());
    expect(start).toHaveBeenCalledTimes(2);
  });
});
