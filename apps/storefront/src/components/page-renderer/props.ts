import type { PageElement } from "@store-builder/api-client";

/**
 * Element props are a free-form JSON blob: the backend's pageTree validator
 * only checks that `props` is an object, never what is inside it (see
 * modules/pages/pageTree.js). Anything here can therefore be missing, null, or
 * the wrong type — from an old template, a hand-edited tree, or a future
 * editor field. Every reader below coerces rather than trusting.
 *
 * The shapes these readers expect come from the editor's ELEMENT_SPECS
 * (apps/merchant-dashboard/src/pages/website/editor/blocks.ts), which is the
 * only place the props contract is actually written down, and which the seeded
 * templates were verified to match.
 */

export type Props = Record<string, unknown>;

export function propsOf(element: PageElement): Props {
  return (element.props ?? {}) as Props;
}

export function str(props: Props, key: string, fallback = ""): string {
  const v = props[key];
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return fallback;
}

export function bool(props: Props, key: string, fallback = false): boolean {
  const v = props[key];
  return typeof v === "boolean" ? v : fallback;
}

/** A finite number clamped into [min, max]; `fallback` when absent or unusable. */
export function num(
  props: Props,
  key: string,
  fallback: number,
  min: number,
  max: number
): number {
  const raw = props[key];
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && raw.trim() !== ""
        ? Number(raw)
        : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Non-empty strings only — an empty row in a list editor should not render. */
export function strList(props: Props, key: string): string[] {
  const v = props[key];
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => (typeof item === "string" ? item : ""))
    .filter((item) => item.trim() !== "");
}

export interface QaItem {
  q: string;
  a: string;
}

/** `accordion` / `faq` items — `[{ q, a }]`, matching the editor's qaList. */
export function qaList(props: Props, key: string): QaItem[] {
  const v = props[key];
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => {
      const o = (item ?? {}) as Props;
      return { q: str(o, "q"), a: str(o, "a") };
    })
    .filter((item) => item.q.trim() !== "" || item.a.trim() !== "");
}

export interface LinkItem {
  platform: string;
  url: string;
}

/** `social_icons` links — `[{ platform, url }]`, matching the editor's linkList. */
export function linkList(props: Props, key: string): LinkItem[] {
  const v = props[key];
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => {
      const o = (item ?? {}) as Props;
      return { platform: str(o, "platform"), url: str(o, "url") };
    })
    .filter((item) => item.url.trim() !== "");
}

/**
 * Merchant-authored links are written as if the store were at the site root
 * ("/products" is the editor's own default), but this app serves each store
 * under `/store/:workspaceId`. Rewrite site-relative paths onto that prefix;
 * leave absolute URLs, anchors and mailto:/tel: alone.
 *
 * Returns null for anything that isn't a usable link, so callers can render
 * plain text instead of a dead anchor.
 */
export function resolveHref(raw: string, workspaceId: string): string | null {
  const href = raw.trim();
  if (href === "") return null;
  if (/^(https?:|mailto:|tel:)/i.test(href)) return href;
  if (href.startsWith("#")) return href;
  if (href.startsWith("/")) {
    const base = `/store/${workspaceId}`;
    // Already prefixed (a merchant may have pasted a full storefront path).
    if (href === base || href.startsWith(`${base}/`)) return href;
    return href === "/" ? base : `${base}${href}`;
  }
  // A bare word like "products" — treat it as site-relative too.
  return `/store/${workspaceId}/${href}`;
}

/** Only http(s) URLs are safe to drop into an <img>/<iframe> src. */
export function safeUrl(raw: string): string | null {
  const url = raw.trim();
  if (url === "") return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return url;
  return null;
}

/** Tailwind can't build class names from a runtime number, so map them. */
export const COLUMN_CLASS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-2 md:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-4",
  5: "grid-cols-2 md:grid-cols-5",
  6: "grid-cols-2 md:grid-cols-6",
};

/** Column span (1-12) of one page-tree column, as a Tailwind class. */
export const SPAN_CLASS: Record<number, string> = {
  1: "md:col-span-1",
  2: "md:col-span-2",
  3: "md:col-span-3",
  4: "md:col-span-4",
  5: "md:col-span-5",
  6: "md:col-span-6",
  7: "md:col-span-7",
  8: "md:col-span-8",
  9: "md:col-span-9",
  10: "md:col-span-10",
  11: "md:col-span-11",
  12: "md:col-span-12",
};
