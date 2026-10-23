/**
 * Where the reader is on the page, carried across a language switch and the
 * logo's way home (components/site-header.tsx).
 *
 * The other language lays the page out differently — longer or shorter
 * words, so the same place is not the same number of pixels. The place is
 * kept as an element instead: the one under the line just below the header,
 * found again on the new page by its position in the tree (both languages
 * render the same tree), and how far into it that line was.
 *
 * The links navigate with `scroll={false}` and the new page puts the place
 * back before it is painted (SiteHeader's layout effect). It is kept in
 * sessionStorage, so a full page load gets it back too.
 */

const KEY = "lz-place";

/** A place older than this is a switch that never landed. */
const MAX_AGE_MS = 30_000;

/** Where an anchor's position in the tree is counted from. */
const ROOTS = "section[id], main, footer";

/** The header and the corner buttons float over the page; never anchors. */
const FLOATING = ".lz-top, .lz-corner";

type Spot = { top: true } | { end: true } | { root: string; trail: number[]; fraction: number };

type Place = Spot & { to: string; at: number };

/**
 * The place as it was when the phone menu opened. The header is sticky but
 * still in the flow, so the open sheet pushes the page down by its height —
 * or not, when the browser's scroll anchoring makes up for it — and the
 * place under the line is no longer the reader's. Each opening replaces it;
 * it is only used while the sheet is open.
 */
let beforeMenu: Spot | null = null;

/** A plain left click that the link itself will follow, in this tab. */
export function isPlainClick(event: {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
}): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !event.defaultPrevented
  );
}

/** The line just below the header's bar. */
function lineY(): number {
  const bar = document.querySelector(".lz-top__in");
  const y = bar ? bar.getBoundingClientRect().bottom + 8 : 0;
  return Math.min(Math.max(y, 0), window.innerHeight - 1);
}

/** The element under the line, past the header and the corner buttons. */
function anchorAt(y: number): Element | null {
  for (const el of document.elementsFromPoint(window.innerWidth / 2, y)) {
    if (!el.closest(FLOATING) && el.closest(ROOTS)) return el;
  }
  return null;
}

function trailTo(el: Element, root: Element): number[] {
  const trail: number[] = [];
  for (let node = el; node !== root; ) {
    const parent = node.parentElement;
    if (!parent) return [];
    trail.unshift(Array.prototype.indexOf.call(parent.children, node));
    node = parent;
  }
  return trail;
}

/** The trail as far as the new page has it; an element that isn't drawn hands over to its parent. */
function follow(root: Element, trail: number[]): Element {
  let el = root;
  for (const i of trail) {
    const next = el.children[i];
    if (!next) break;
    el = next;
  }
  while (el !== root && el.parentElement && el.getBoundingClientRect().height === 0) el = el.parentElement;
  return el;
}

/** The bottom of the footer is on screen: the page can't go further. */
function atEnd(): boolean {
  const foot = document.querySelector("footer");
  return foot !== null && foot.getBoundingClientRect().bottom <= window.innerHeight + 1;
}

function sheetOpen(): boolean {
  const sheet = document.querySelector(".lz-sheet");
  return sheet !== null && !sheet.hasAttribute("hidden");
}

/** Where the reader is now. */
function spotNow(): Spot {
  if (window.scrollY <= 1) return { top: true };
  if (atEnd()) return { end: true };

  const y = lineY();
  const el = anchorAt(y);
  const root = el?.closest(ROOTS);
  if (!el || !root) return { top: true };
  const rect = el.getBoundingClientRect();
  const fraction = rect.height > 0 ? Math.min(Math.max((y - rect.top) / rect.height, 0), 1) : 0;
  return { root: root.id ? `#${root.id}` : root.localName, trail: trailTo(el, root), fraction };
}

function write(place: Place): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(place));
  } catch {
    /* private mode — the new page simply opens at its top */
  }
}

/** The kept place, once: reading it forgets it. */
function take(): Place | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw === null) return null;
    sessionStorage.removeItem(KEY);
    return JSON.parse(raw) as Place;
  } catch {
    return null;
  }
}

/** The phone menu is about to open: note the place before the sheet moves the page. */
export function notePlaceBeforeMenu(): void {
  beforeMenu = spotNow();
}

/** Remember where the reader is, for the page at `to`. */
export function keepPlace(to: string): void {
  const spot = sheetOpen() && beforeMenu ? beforeMenu : spotNow();
  write({ ...spot, to, at: Date.now() });
}

/** A language link's onClick: a plain click keeps the place for the page it opens. */
export function keepPlaceOnClick(event: Parameters<typeof isPlainClick>[0], to: string): void {
  if (isPlainClick(event)) keepPlace(to);
}

/** Open the page at `to` at its top (the logo, from another page). */
export function keepTop(to: string): void {
  write({ top: true, to, at: Date.now() });
}

/**
 * Put back the place kept for this page, if there is one. It scrolls in the
 * window's own steps and checks where the anchor landed, so a page drawn at
 * a zoom (landing.css: 90% from 601px) still lands on the line.
 */
export function restorePlace(path: string): void {
  const place = take();
  if (!place || place.to !== path || Date.now() - place.at > MAX_AGE_MS) return;

  if ("top" in place) {
    window.scrollTo({ top: 0, behavior: "instant" });
    return;
  }
  if ("end" in place) {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
    return;
  }

  const root = document.querySelector(place.root);
  if (!root) return;
  const el = follow(root, place.trail);
  const y = lineY();

  let ratio = 1;
  for (let i = 0; i < 3; i++) {
    const rect = el.getBoundingClientRect();
    const off = rect.top + place.fraction * rect.height - y;
    if (Math.abs(off) < 1) return;
    const asked = off * ratio;
    window.scrollBy({ top: asked, behavior: "instant" });
    const moved = rect.top - el.getBoundingClientRect().top;
    if (Math.abs(moved) < 0.5) return; // the page ends here
    ratio = asked / moved;
  }
}
