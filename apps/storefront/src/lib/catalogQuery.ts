/**
 * The product listing's state lives in its URL, so a filtered page can be
 * shared, bookmarked and reloaded, and the back button undoes a filter:
 *
 *   /products?q=shirt&collection=men&tag=summer&tag=linen
 *            &min=100&max=450&option[Size]=M&option[Size]=L&sort=price_asc&page=2
 *
 * Prices in the URL are whole pounds (what a shopper reads); the API takes
 * minor units. Pure — no React, no Next — so it is tested on its own
 * (catalogQuery.test.mjs) and shared by the server page and the client
 * filters alike.
 */
import type { StorefrontListingParams, StorefrontSort } from "@store-builder/api-client";

export const SORTS: readonly StorefrontSort[] = ["relevance", "newest", "price_asc", "price_desc", "name", "position"];

export interface CatalogState {
  q: string;
  /** A collection slug (or id). */
  collection: string | null;
  tags: string[];
  /** Whole currency units, as typed. */
  min: number | null;
  max: number | null;
  options: Record<string, string[]>;
  /** Null: the store's default (or best match while searching). */
  sort: StorefrontSort | null;
  page: number;
}

export type SearchParams = Record<string, string | string[] | undefined>;

const OPTION_KEY = /^option\[(.{1,100})\]$/;

function all(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value]).map((v) => v.trim()).filter(Boolean);
}

function first(value: string | string[] | undefined): string {
  return all(value)[0] ?? "";
}

function amount(value: string | string[] | undefined): number | null {
  const raw = first(value);
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function readCatalogState(params: SearchParams): CatalogState {
  const options: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(params)) {
    const match = OPTION_KEY.exec(key);
    if (!match) continue;
    const values = [...new Set(all(value))];
    if (values.length > 0) options[match[1]] = values;
  }
  const sort = first(params.sort);
  const page = Number(first(params.page));
  return {
    q: first(params.q).replace(/\s+/g, " ").slice(0, 100),
    collection: first(params.collection) || null,
    tags: [...new Set(all(params.tag))].slice(0, 20),
    min: amount(params.min),
    max: amount(params.max),
    options,
    sort: (SORTS as readonly string[]).includes(sort) ? (sort as StorefrontSort) : null,
    page: Number.isInteger(page) && page >= 1 && page <= 1000 ? page : 1,
  };
}

/** The URL for `state` with `change` applied. Any change but a page turn goes back to page 1. */
export function catalogHref(state: CatalogState, change: Partial<CatalogState> = {}, path = "/products"): string {
  const next: CatalogState = { ...state, ...change };
  if (change.page === undefined) next.page = 1;
  const qs = new URLSearchParams();
  if (next.q) qs.set("q", next.q);
  if (next.collection) qs.set("collection", next.collection);
  for (const tag of next.tags) qs.append("tag", tag);
  if (next.min !== null) qs.set("min", String(next.min));
  if (next.max !== null) qs.set("max", String(next.max));
  for (const [name, values] of Object.entries(next.options)) {
    for (const value of values) qs.append(`option[${name}]`, value);
  }
  if (next.sort) qs.set("sort", next.sort);
  if (next.page > 1) qs.set("page", String(next.page));
  const query = qs.toString();
  return query ? `${path}?${query}` : path;
}

/** Adds or removes one value of a multi-value filter. */
export function toggle(values: readonly string[], value: string): string[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

/** Adds or removes one option value, dropping the option once it has none. */
export function toggleOption(options: Record<string, string[]>, name: string, value: string): Record<string, string[]> {
  const next = { ...options, [name]: toggle(options[name] ?? [], value) };
  if (next[name].length === 0) delete next[name];
  return next;
}

/** How many filters the shopper has set (for the "Filter (n)" button). The search itself is not one. */
export function activeFilterCount(state: CatalogState): number {
  return (
    (state.collection ? 1 : 0) +
    state.tags.length +
    (state.min !== null || state.max !== null ? 1 : 0) +
    Object.values(state.options).reduce((n, values) => n + values.length, 0)
  );
}

/** Every filter off. The search and the sort are not filters: they stay. */
export const NO_FILTERS = { collection: null, tags: [], min: null, max: null, options: {} } satisfies Partial<CatalogState>;

/**
 * The sorts a shopper is offered: "best match" only while searching and the
 * merchant's own order only inside a collection, where there is one to follow.
 */
export function sortChoices(state: Pick<CatalogState, "q" | "collection">): StorefrontSort[] {
  return [
    ...(state.q ? (["relevance"] as const) : []),
    "newest",
    "price_asc",
    "price_desc",
    "name",
    ...(state.collection ? (["position"] as const) : []),
  ];
}

/** One filter the shopper has set, as the chip that takes it off again. */
export interface FilterChip {
  /** Unique within one state. */
  key: string;
  kind: "collection" | "tag" | "price" | "option";
  /** The collection's slug (or id), the tag, or the option's value; empty for the price range. */
  value: string;
  /** The option's name, for an option value. */
  name?: string;
  /** The listing without this one filter, back on page 1. */
  href: string;
}

/**
 * The filters in use, one chip each, in the order the URL writes them. As many
 * as activeFilterCount counts: the price range is one chip, an option with
 * two values is two.
 */
export function activeFilterChips(state: CatalogState, path = "/products"): FilterChip[] {
  const chips: FilterChip[] = [];
  if (state.collection) {
    chips.push({ key: "collection", kind: "collection", value: state.collection, href: catalogHref(state, { collection: null }, path) });
  }
  for (const tag of state.tags) {
    chips.push({ key: `tag:${tag}`, kind: "tag", value: tag, href: catalogHref(state, { tags: toggle(state.tags, tag) }, path) });
  }
  if (state.min !== null || state.max !== null) {
    chips.push({ key: "price", kind: "price", value: "", href: catalogHref(state, { min: null, max: null }, path) });
  }
  for (const [name, values] of Object.entries(state.options)) {
    for (const value of values) {
      chips.push({
        key: `option:${name}:${value}`,
        kind: "option",
        name,
        value,
        href: catalogHref(state, { options: toggleOption(state.options, name, value) }, path),
      });
    }
  }
  return chips;
}

/**
 * Whether two states ask for the same list: the same search, filters and
 * sort. The page number is left out, as any change of the others starts
 * again from page 1.
 */
export function sameListing(a: CatalogState, b: CatalogState): boolean {
  return catalogHref(a) === catalogHref(b);
}

/** The API query for this state. */
export function toListingParams(state: CatalogState, defaultSort: StorefrontSort): StorefrontListingParams {
  const toMinor = (major: number | null) => (major === null ? undefined : Math.round(major * 100));
  return {
    ...(state.q ? { search: state.q } : {}),
    ...(state.collection ? { collection: state.collection } : {}),
    ...(state.tags.length > 0 ? { tags: state.tags } : {}),
    minPrice: toMinor(state.min),
    maxPrice: toMinor(state.max),
    ...(Object.keys(state.options).length > 0 ? { options: state.options } : {}),
    sort: state.sort ?? (state.q ? "relevance" : defaultSort),
    page: state.page,
  };
}
