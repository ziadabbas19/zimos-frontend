import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { keepPlace, keepTop, notePlaceBeforeMenu, restorePlace } from "./keep-place";

/**
 * The place kept across a language switch (lib/keep-place.ts), on a page
 * drawn by hand: jsdom lays nothing out, so every element gets a top and a
 * height in the page, and the window scrolls over them. `units` stands for a
 * page drawn at a zoom, where the window's scroll steps and the drawn
 * positions disagree (landing.css: html zoom 0.9).
 */

type Box = { y: number; h: number };

let boxes: Map<Element, Box>;
let scroll: number;
let units: number;
const viewport = { width: 1200, height: 500 };

const BAR = 70; // `.lz-top__in`, stuck at the top of the window

function page(html: string, layout: Record<string, Box>) {
  document.body.innerHTML = html;
  boxes = new Map();
  for (const [selector, box] of Object.entries(layout)) boxes.set(document.querySelector(selector)!, box);
}

const SHEET = 420; // the phone sheet, open under the bar

/** An open sheet grows the sticky header, which pushes the whole page down. */
const pushed = () => (document.querySelector(".lz-sheet")?.hasAttribute("hidden") === false ? SHEET : 0);

function rectOf(el: Element): DOMRect {
  if (el.classList.contains("lz-top__in")) return new DOMRect(0, 16, viewport.width, BAR);
  if (el.classList.contains("lz-sheet")) return new DOMRect(0, 16 + BAR, viewport.width, pushed());
  const box = boxes.get(el);
  if (!box) return new DOMRect(0, 0, 0, 0);
  return new DOMRect(0, box.y + pushed() - scroll, viewport.width, box.h);
}

function depth(el: Element): number {
  let n = 0;
  for (let p = el.parentElement; p; p = p.parentElement) n++;
  return n;
}

beforeEach(() => {
  scroll = 0;
  units = 1;
  sessionStorage.clear();
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    return rectOf(this);
  });
  Object.defineProperty(window, "scrollY", { configurable: true, get: () => scroll });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: viewport.height });
  Object.defineProperty(window, "innerWidth", { configurable: true, value: viewport.width });
  document.elementsFromPoint = (_x: number, y: number) =>
    [...boxes.keys(), document.querySelector(".lz-top__in")!]
      .filter((el) => {
        const r = rectOf(el);
        return y >= r.top && y < r.bottom;
      })
      .sort((a, b) => depth(b) - depth(a));
  vi.spyOn(window, "scrollBy").mockImplementation(((options: ScrollToOptions) => {
    scroll += (options.top ?? 0) * units;
  }) as typeof window.scrollBy);
  vi.spyOn(window, "scrollTo").mockImplementation(((options: ScrollToOptions) => {
    scroll = options.top ?? 0;
  }) as typeof window.scrollTo);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

const HTML = `
  <header class="lz-top"><div class="lz-top__in"></div><div class="lz-sheet" hidden></div></header>
  <main id="main">
    <section id="intro"><p>intro</p></section>
    <section id="how"><h2>how</h2><ol><li>one</li><li>two</li><li>three</li></ol></section>
  </main>
  <footer><p>foot</p></footer>`;

/** Arabic or English: the same tree, other heights. */
function arabic() {
  page(HTML, {
    "#main": { y: 100, h: 2500 },
    "#intro": { y: 100, h: 1000 },
    "#intro p": { y: 100, h: 1000 },
    "#how": { y: 1100, h: 1500 },
    "#how h2": { y: 1100, h: 100 },
    "#how ol": { y: 1200, h: 1400 },
    "#how li:nth-child(1)": { y: 1200, h: 400 },
    "#how li:nth-child(2)": { y: 1600, h: 500 },
    "#how li:nth-child(3)": { y: 2100, h: 500 },
    footer: { y: 2600, h: 300 },
    "footer p": { y: 2600, h: 300 },
  });
}

function english() {
  page(HTML, {
    "#main": { y: 100, h: 2100 },
    "#intro": { y: 100, h: 700 },
    "#intro p": { y: 100, h: 700 },
    "#how": { y: 800, h: 1400 },
    "#how h2": { y: 800, h: 80 },
    "#how ol": { y: 880, h: 1320 },
    "#how li:nth-child(1)": { y: 880, h: 300 },
    "#how li:nth-child(2)": { y: 1180, h: 600 },
    "#how li:nth-child(3)": { y: 1780, h: 420 },
    footer: { y: 2200, h: 300 },
    "footer p": { y: 2200, h: 300 },
  });
}

/** The line the place is measured on: just below the header's bar. */
const LINE = 16 + BAR + 8;

describe("keepPlace / restorePlace", () => {
  it("brings the same element back under the line, the same way into it, on the other language's page", () => {
    arabic();
    scroll = 1600 + 250 - LINE; // the line halfway into the second step
    keepPlace("/en");

    english();
    scroll = 1600 + 250 - LINE; // the new page opens where the old one was
    restorePlace("/en");

    const second = rectOf(document.querySelector("#how li:nth-child(2)")!);
    expect(second.top + 0.5 * second.height).toBeCloseTo(LINE, 0);
  });

  it("lands on the line when the window scrolls in other steps than the page is drawn in (zoom)", () => {
    arabic();
    scroll = 2100 + 100 - LINE;
    keepPlace("/en");

    english();
    units = 0.9;
    scroll = 2100 + 100 - LINE;
    restorePlace("/en");

    const third = rectOf(document.querySelector("#how li:nth-child(3)")!);
    expect(Math.abs(third.top + 0.2 * third.height - LINE)).toBeLessThan(1);
  });

  for (const anchored of [false, true]) {
    it(`on a phone, a language picked in the menu keeps the place from before the menu opened (${anchored ? "the browser makes up for the sheet" : "the sheet pushes the page down"})`, () => {
      Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 }); // a phone held upright
      arabic();
      scroll = 1600 + 250 - LINE; // reading the second step, halfway in
      notePlaceBeforeMenu(); // the menu button, before the sheet opens
      document.querySelector(".lz-sheet")!.removeAttribute("hidden");
      if (anchored) scroll += SHEET; // scroll anchoring keeps the page still under the sheet
      keepPlace("/en");

      english(); // the new page opens with the sheet closed
      scroll = 1600 + 250 - LINE;
      restorePlace("/en");

      const second = rectOf(document.querySelector("#how li:nth-child(2)")!);
      expect(second.top + 0.5 * second.height).toBeCloseTo(LINE, 0);
    });
  }

  it("the place noted for the menu is not used once the sheet is closed again", () => {
    arabic();
    scroll = 0;
    notePlaceBeforeMenu(); // opened at the top, then closed
    scroll = 1600 + 250 - LINE;
    keepPlace("/en");
    expect(JSON.parse(sessionStorage.getItem("lz-place") ?? "null")).toMatchObject({ root: "#how", trail: [1, 1] });
  });

  it("keeps the top of the page as the top", () => {
    arabic();
    scroll = 0;
    keepPlace("/en");
    english();
    scroll = 500;
    restorePlace("/en");
    expect(scroll).toBe(0);
  });

  it("keeps the end of the page as the end", () => {
    arabic();
    scroll = 2900 - viewport.height;
    keepPlace("/en");
    english();
    restorePlace("/en");
    expect(window.scrollTo).toHaveBeenCalledWith({ top: document.documentElement.scrollHeight, behavior: "instant" });
  });

  it("an element the new page lacks hands over to its parent", () => {
    arabic();
    scroll = 2100 + 100 - LINE;
    keepPlace("/en");

    english();
    document.querySelector("#how li:nth-child(3)")!.remove();
    scroll = 0;
    restorePlace("/en");

    const list = rectOf(document.querySelector("#how ol")!);
    expect(Math.abs(list.top + 0.2 * list.height - LINE)).toBeLessThan(1);
  });

  it("is put back once, only on the page it was kept for, and not when it is old", () => {
    arabic();
    scroll = 1500;
    keepPlace("/en");
    restorePlace("/ar"); // another page: dropped
    scroll = 0;
    restorePlace("/en");
    expect(scroll).toBe(0);

    keepTop("/en");
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 60_000);
    scroll = 700;
    restorePlace("/en");
    expect(scroll).toBe(700);
  });
});
