import type { Order, OrderPipeline } from "@store-builder/api-client";

/**
 * What the orders list last showed, kept for the session so the list a
 * merchant comes back to is on screen at once and refreshes behind
 *. Two small maps:
 *
 *   pages     the first page of a list, by store + the list's whole query
 *             (stage, sort, search, dates, filters, risk, page size);
 *   counts    the stage and risk counts, by store + the same query without
 *             stage and sort (they do not change the counts).
 *
 * Nothing here is read as the truth: every visit still asks the server, and
 * the answer replaces what was kept.
 */
export interface CachedOrdersPage {
  orders: Order[];
  nextCursor: string | null;
}

const MAX_ENTRIES = 40;
const pages = new Map<string, CachedOrdersPage>();
const counts = new Map<string, OrderPipeline>();

function remember<T>(map: Map<string, T>, key: string, value: T): void {
  // Re-inserted, so the map stays in order of last use and the oldest entry is the first.
  map.delete(key);
  map.set(key, value);
  if (map.size > MAX_ENTRIES) {
    const oldest = map.keys().next();
    if (!oldest.done) map.delete(oldest.value);
  }
}

/** `query` is a URL query string without the leading "?". */
export function ordersCacheKey(workspaceId: string, query: string): string {
  return `${workspaceId}?${query}`;
}

export function cachedOrdersPage(key: string): CachedOrdersPage | undefined {
  return pages.get(key);
}

export function rememberOrdersPage(key: string, page: CachedOrdersPage): void {
  remember(pages, key, page);
}

export function cachedOrderCounts(key: string): OrderPipeline | undefined {
  return counts.get(key);
}

export function rememberOrderCounts(key: string, pipeline: OrderPipeline): void {
  remember(counts, key, pipeline);
}

/**
 * After something changed the store's orders (a bulk action, an archive, a
 * courier file): every other kept list of that store is out of date. The ones
 * named in `keep` stay — they are on screen and are being re-read right now.
 */
export function forgetOrdersOf(workspaceId: string, keep: readonly string[] = []): void {
  const prefix = `${workspaceId}?`;
  for (const map of [pages, counts] as const) {
    for (const key of Array.from(map.keys())) {
      if (key.startsWith(prefix) && !keep.includes(key)) map.delete(key);
    }
  }
}
