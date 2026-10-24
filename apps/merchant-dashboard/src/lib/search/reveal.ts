/**
 * Brings a setting the search opened into view and marks it for a moment.
 *
 * The block carries `data-search-anchor="<anchor>"` (lib/search/siteIndex.ts
 * names it). The page may still be on its way — a lazy page, a section that
 * loads its data — so the block is waited for (up to `timeout`), then
 * scrolled to the middle of the screen and given `data-search-hit`, which
 * index.css draws as a short ring. A newer call drops the one before.
 */

const HIT = "data-search-hit";
/** How long the mark stays: the ring's animation in index.css, and a little more. */
const MARK_MS = 2600;

let cancelPending: (() => void) | null = null;

export function revealSearchTarget(anchor: string, timeout = 6000): void {
  cancelPending?.();
  const selector = `[data-search-anchor="${anchor}"]`;
  let observer: MutationObserver | null = null;
  let timer = 0;
  let frame = 0;

  const stop = () => {
    observer?.disconnect();
    window.clearTimeout(timer);
    window.cancelAnimationFrame(frame);
    if (cancelPending === stop) cancelPending = null;
  };

  const find = (): boolean => {
    const target = document.querySelector<HTMLElement>(selector);
    if (!target) return false;
    observer?.disconnect();
    window.clearTimeout(timer);
    // A frame later: after a settings list has put the page back at the top for the new section.
    frame = window.requestAnimationFrame(() => {
      if (cancelPending === stop) cancelPending = null;
      mark(target);
    });
    return true;
  };

  cancelPending = stop;
  if (find()) return;
  observer = new MutationObserver(() => {
    find();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  timer = window.setTimeout(stop, timeout);
}

function mark(target: HTMLElement) {
  const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  target.scrollIntoView?.({ block: "center", behavior: still ? "auto" : "smooth" });
  // Again from the start when the same block is asked for twice in a row.
  target.removeAttribute(HIT);
  void target.offsetWidth;
  target.setAttribute(HIT, "");
  window.setTimeout(() => target.removeAttribute(HIT), MARK_MS);
}
