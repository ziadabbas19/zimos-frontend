/**
 * Prefetching a page's code before it is asked for: the side menu, the dock
 * and the search call `prefetchRoute(to)` on hover /
 * touch-start, so a code-split page's chunk is already here when the tap lands
 * and the page's frame shows in under 100ms.
 *
 * routes/prefetch.ts registers one loader per lazy page, with the same
 * `import()` App.tsx uses, so Vite serves the same chunk. A loader runs once.
 */
type Loader = () => Promise<unknown>;

const loaders: Array<{ prefix: string; load: Loader }> = [];
const done = new Set<string>();

export function registerPrefetch(prefix: string, load: Loader): void {
  loaders.push({ prefix, load });
}

function matches(prefix: string, to: string): boolean {
  return to === prefix || to.startsWith(`${prefix}/`);
}

/**
 * Load the code for the page at `to`, if it is code-split and not loaded yet.
 * `exact`: only a page registered for that very address (the first page of a
 * load, where a longer address such as an order's own page is a page of its
 * own and must not fetch the list's code instead).
 */
export function prefetchRoute(to: string, { exact = false }: { exact?: boolean } = {}): void {
  const path = to.split(/[?#]/)[0] || "/";
  let best: { prefix: string; load: Loader } | undefined;
  for (const entry of loaders) {
    if (exact ? entry.prefix !== path : !matches(entry.prefix, path)) continue;
    if (!best || entry.prefix.length > best.prefix.length) best = entry;
  }
  if (!best || done.has(best.prefix)) return;
  done.add(best.prefix);
  // A failed prefetch is not an error: the route's own lazy() will try again.
  best.load().catch(() => done.delete(best!.prefix));
}

/** How long after the page's load event the idle warm-up starts. */
export const WARM_UP_DELAY_MS = 3000;
/** Pages fetched at the same time while warming up. */
const WARM_UP_AT_ONCE = 3;
/** Connections the warm-up leaves alone (the Network Information API's effectiveType). */
const SLOW_CONNECTIONS = new Set(["slow-2g", "2g", "3g"]);

/**
 * Fetches `pages` while the browser is idle, a few at a time, starting
 * WARM_UP_DELAY_MS after the page has loaded: the pages that came with the
 * main bundle before it was split (routes/prefetch.ts), so moving to one later
 * shows no loader, as it did when they came with it. Not on a connection that
 * asks to save data, nor on one the browser rates 2g or 3g (there a page is
 * fetched when it is opened or hovered, as the other split pages are); a
 * failure is skipped (the route's lazy() asks again). A browser that does not
 * say (no navigator.connection) warms up.
 */
export function warmUpWhenIdle(pages: Loader[]): void {
  if (typeof window === "undefined") return;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (connection?.saveData) return;
  if (connection?.effectiveType && SLOW_CONNECTIONS.has(connection.effectiveType)) return;
  const idle = (fn: () => void) =>
    typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(fn, { timeout: 2000 }) : window.setTimeout(fn, 200);
  const queue = [...pages];
  const next = () => {
    const load = queue.shift();
    if (!load) return;
    load()
      .catch(() => undefined)
      .finally(() => idle(next));
  };
  const start = () =>
    window.setTimeout(() => {
      for (let i = 0; i < WARM_UP_AT_ONCE; i += 1) idle(next);
    }, WARM_UP_DELAY_MS);
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
}

/**
 * Props for a link that prefetches its page: hover on a desktop, touch-start on
 * a phone (the ~100ms before the tap resolves is enough for a chunk from the
 * local cache).
 */
export function prefetchProps(to: string) {
  const go = () => prefetchRoute(to);
  return { onPointerEnter: go, onTouchStart: go, onFocus: go } as const;
}
