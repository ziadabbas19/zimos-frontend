/**
 * What Spotlight shows before anything is typed: the last searches that
 * opened something, and the last places opened in the dashboard. Kept in
 * this browser only, per store, a few of each; only words typed and entry
 * ids (lib/search/siteIndex.ts) are kept — never an order, a customer or a
 * product. Storage that is blocked or full reads as empty.
 */

const KEY = "zimos.search.recent";
const QUERIES = 5;
const PLACES = 6;
/** Stores kept, the most recent first. */
const STORES = 10;

interface StoreRecent {
  queries: string[];
  places: string[];
}

type AllRecent = Record<string, StoreRecent>;

function readAll(): AllRecent {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as AllRecent) : {};
  } catch {
    return {};
  }
}

function writeAll(all: AllRecent) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Private window or full storage: the list is a convenience.
  }
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function readRecent(workspaceId: string): StoreRecent {
  const mine = readAll()[workspaceId];
  return { queries: strings(mine?.queries), places: strings(mine?.places) };
}

function update(workspaceId: string, change: (mine: StoreRecent) => StoreRecent) {
  const all = readAll();
  const next = change(readRecent(workspaceId));
  // This store first, then the others, so the oldest store is the one dropped.
  const kept: AllRecent = { [workspaceId]: next };
  for (const id of Object.keys(all)) {
    if (id !== workspaceId && Object.keys(kept).length < STORES) kept[id] = all[id];
  }
  writeAll(kept);
}

function bump(list: string[], value: string, max: number): string[] {
  return [value, ...list.filter((item) => item !== value)].slice(0, max);
}

export function rememberQuery(workspaceId: string, query: string) {
  const value = query.trim();
  if (value.length < 2) return;
  update(workspaceId, (mine) => ({ ...mine, queries: bump(mine.queries, value, QUERIES) }));
}

export function rememberPlace(workspaceId: string, entryId: string) {
  update(workspaceId, (mine) => ({ ...mine, places: bump(mine.places, entryId, PLACES) }));
}
