import type { NextRequest, NextResponse } from "next/server";
import { STORE_SLUG_HEADER } from "./domains";
import { STORE_REF_HEADER } from "./documentLocale";
import { EDGE_HOST_HEADER, EDGE_SECRET_HEADER } from "./edgeHost";
import { EDITOR_VIEW_HEADER, EDITOR_VIEW_PARAM } from "./editorView";
import { PAYMENTS_PREVIEW_PARAM, STORE_PREVIEW_HEADER, STORE_PREVIEW_PARAM } from "./storePreview";

/**
 * Lets the CDN in front of the storefront (Cloudflare) keep a public store
 * page for a short while and serve it while it fetches a fresh one, instead of
 * every visit rendering it here. Off unless the server's
 * STOREFRONT_EDGE_CACHE_ENABLED is exactly "true"; off, nothing here touches a
 * response and every page keeps Next's own `private, no-cache, no-store`.
 *
 * Two checks, both needed:
 *
 *   1. On the way in (the proxy, `withEdgeCache`): a GET or HEAD that the
 *      proxy rewrote to a store's public page, from a visitor who carries
 *      nothing that changes the page, is marked `public, s-maxage=…`.
 *   2. On the way out (lib/edgeCacheGuard, installed by src/instrumentation.ts):
 *      the mark is taken back unless the response really is a plain 200 HTML
 *      page with no Set-Cookie. The proxy cannot see these: a page that
 *      redirects (the home page can), a 404 or 500, and the app's own
 *      navigations (RSC payloads — Next hides their headers from the proxy).
 *
 * What a cached copy must never carry is anything one visitor has and another
 * doesn't. On the server only three things change a store page's HTML, and a
 * request with any of them is never marked:
 *
 *   - our own cookies (`zimos_…`): the shopper's language, their light or dark
 *     pick, a staff preview — and any we add later — except the ones listed in
 *     PAGE_NEUTRAL_COOKIES, which only scripts in the browser read. The cart,
 *     the shopper's sign-in and the visitor id live in localStorage, which the
 *     server never sees (edgeCache.guard.test.tsx fails when a server file
 *     starts reading a cookie);
 *   - a staff preview or the website editor's view, in the link;
 *   - the headers the proxy itself passes to the pages (store slug and ref,
 *     preview token, editor view): a request that arrives already carrying one
 *     was not sent by a browser of ours.
 *
 * Every page is keyed at the CDN by its full URL, host included, so one store
 * never gets another's. Merchant domains are the exception: they reach this
 * server through the Worker (worker/custom-domains-worker.js), whose request
 * names our own Railway host, so a copy kept for it would be shared by every
 * merchant domain. A request that came through the Worker is never marked.
 *
 * The CDN must be told the same in its own words (docs/edge-cache/README.md):
 * it serves a kept copy without asking this server, so its rule skips the
 * cache for these cookies and for the app's navigations.
 */

const DEFAULT_S_MAXAGE = 60;
const DEFAULT_STALE_WHILE_REVALIDATE = 300;
const MAX_SECONDS = 86_400;

/** Next's own header for a page rendered per request, which the guard puts back. */
export const PRIVATE_CACHE_CONTROL = "private, no-cache, no-store, max-age=0, must-revalidate";

export function edgeCacheEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.STOREFRONT_EDGE_CACHE_ENABLED === "true";
}

function seconds(value: string | undefined, fallback: number, min: number): number {
  if (value === undefined || !/^\d+$/.test(value.trim())) return fallback;
  const n = Number(value.trim());
  return n >= min && n <= MAX_SECONDS ? n : fallback;
}

/**
 * `public, max-age=0, s-maxage=<STOREFRONT_EDGE_CACHE_S_MAXAGE, 60>,
 * stale-while-revalidate=<STOREFRONT_EDGE_CACHE_SWR, 300>`. `max-age=0`: a
 * browser never keeps the page itself, only the CDN does. A value that is not
 * a whole number of seconds up to a day falls back to the default; a
 * stale-while-revalidate of 0 leaves that directive out.
 */
export function edgeCacheValue(env: NodeJS.ProcessEnv = process.env): string {
  const sMaxage = seconds(env.STOREFRONT_EDGE_CACHE_S_MAXAGE, DEFAULT_S_MAXAGE, 1);
  const swr = seconds(env.STOREFRONT_EDGE_CACHE_SWR, DEFAULT_STALE_WHILE_REVALIDATE, 0);
  return `public, max-age=0, s-maxage=${sMaxage}${swr > 0 ? `, stale-while-revalidate=${swr}` : ""}`;
}

/** Our own cookies that only scripts in the browser read: they never change the HTML. */
export const PAGE_NEUTRAL_COOKIES = ["zimos_touch"] as const;

/** Whether a cookie may change what the server renders: any of ours not known to be neutral. */
export function isPersonalCookie(name: string): boolean {
  return name.startsWith("zimos_") && !(PAGE_NEUTRAL_COOKIES as readonly string[]).includes(name);
}

/**
 * Headers only the proxy or the Worker may set. A request that arrives with
 * one either came through the Worker (keyed at the CDN on our host, not the
 * merchant's) or was made to change what a page renders.
 */
export const NOT_FROM_A_BROWSER = [
  EDGE_SECRET_HEADER,
  EDGE_HOST_HEADER,
  STORE_SLUG_HEADER,
  STORE_REF_HEADER,
  STORE_PREVIEW_HEADER,
  EDITOR_VIEW_HEADER,
] as const;

/** Links that open a staff preview or the website editor's view of a page. */
const PREVIEW_PARAMS = [STORE_PREVIEW_PARAM, PAYMENTS_PREVIEW_PARAM, EDITOR_VIEW_PARAM] as const;

/**
 * The first segment of every route under app/store/[workspaceId]. A path
 * whose first segment is none of these is a page the merchant built in the
 * website editor (app/store/[workspaceId]/[...path]): public. A new route
 * folder must be added to one list or the other (edgeCache.guard.test.tsx).
 */
export const PUBLIC_ROUTES = ["products", "policies", "learn", "looks", "blog", "store-reviews"] as const;
export const PRIVATE_ROUTES = [
  "account",
  "cart",
  "checkout",
  "compare",
  "downloads",
  "f",
  "gift-card",
  "manifest.webmanifest",
  "offer",
  "orders",
  "pay",
  "preview",
  "r",
  "robots.txt",
  "sitemap.xml",
  "track",
  "unsubscribe",
] as const;

/** The shapes of the public routes: home, catalogue, product, policy, learn, look, blog, store reviews. */
const PUBLIC_ROUTE = /^\/(?:products(?:\/[^/]+)?|policies\/[^/]+|learn(?:\/[^/]+)?|looks\/[^/]+|blog(?:\/[^/]+)?|store-reviews)?\/?$/;

/** Whether a store-relative path (`/`, `/products/x`, `/about`) renders the same for every visitor. */
export function isPublicStorePath(path: string): boolean {
  if (PUBLIC_ROUTE.test(path)) return true;
  let first: string;
  try {
    first = decodeURIComponent(path.split("/")[1] ?? "").toLowerCase();
  } catch {
    return false;
  }
  if (!first) return false;
  return !(PUBLIC_ROUTES as readonly string[]).includes(first) && !(PRIVATE_ROUTES as readonly string[]).includes(first);
}

/**
 * The store-relative path a proxy rewrite renders: `/store/<ref>/products/x`
 * → `/products/x`. Null for any other target.
 */
export function storePathOfRewrite(rewrite: string | null): string | null {
  if (!rewrite) return null;
  let pathname: string;
  try {
    pathname = new URL(rewrite).pathname;
  } catch {
    return null;
  }
  const match = /^\/store\/[^/]+(\/.*)?$/.exec(pathname);
  return match ? (match[1] ?? "/") : null;
}

export interface EdgeCacheInput {
  enabled: boolean;
  method: string;
  /** Where the proxy rewrote the request (`x-middleware-rewrite`); null when it didn't. */
  rewrite: string | null;
  /** What the proxy answered: only a plain 200 qualifies. */
  status: number;
  redirected: boolean;
  setsCookie: boolean;
  cookieNames: readonly string[];
  /** The request's header names, lowercase. */
  headerNames: readonly string[];
  /** The link's query parameter names. */
  paramNames: readonly string[];
}

/** The CDN header for this request, or null to leave the response as it is. */
export function edgeCacheControl(input: EdgeCacheInput, env: NodeJS.ProcessEnv = process.env): string | null {
  if (!input.enabled) return null;
  if (input.method !== "GET" && input.method !== "HEAD") return null;
  if (input.status !== 200 || input.redirected || input.setsCookie) return null;
  if (input.cookieNames.some(isPersonalCookie)) return null;
  if (input.headerNames.some((name) => (NOT_FROM_A_BROWSER as readonly string[]).includes(name))) return null;
  if (input.paramNames.some((name) => (PREVIEW_PARAMS as readonly string[]).includes(name))) return null;
  const path = storePathOfRewrite(input.rewrite);
  return path !== null && isPublicStorePath(path) ? edgeCacheValue(env) : null;
}

/** The proxy's last step: marks the response for the CDN when edgeCacheControl allows it. */
export function withEdgeCache(request: NextRequest, response: NextResponse): NextResponse {
  const value = edgeCacheControl({
    enabled: edgeCacheEnabled(),
    method: request.method.toUpperCase(),
    rewrite: response.headers.get("x-middleware-rewrite"),
    status: response.status,
    redirected: response.headers.has("location"),
    setsCookie: response.headers.has("set-cookie") || response.cookies.getAll().length > 0,
    cookieNames: request.cookies.getAll().map((c) => c.name),
    headerNames: [...request.headers.keys()],
    paramNames: [...request.nextUrl.searchParams.keys()],
  });
  if (value) response.headers.set("Cache-Control", value);
  return response;
}

/** The app's navigation requests (RSC payloads): never kept, whatever they answer. */
export const RSC_REQUEST_HEADERS = [
  "rsc",
  "next-router-prefetch",
  "next-router-state-tree",
  "next-router-segment-prefetch",
  "next-hmr-refresh",
] as const;

/**
 * The guard's check on the way out (lib/edgeCacheGuard): whether a response
 * the proxy marked may keep the mark. Only a 200 HTML page with no Set-Cookie,
 * answering a request that is not one of the app's navigations.
 */
export function keepsEdgeCache(input: {
  status: number;
  contentType: string | null;
  setsCookie: boolean;
  requestHeaderNames: readonly string[];
  requestUrl: string | null;
}): boolean {
  if (input.status !== 200 || input.setsCookie) return false;
  if (!(input.contentType ?? "").toLowerCase().startsWith("text/html")) return false;
  if (input.requestHeaderNames.some((name) => (RSC_REQUEST_HEADERS as readonly string[]).includes(name))) return false;
  if (/[?&]_rsc=/.test(input.requestUrl ?? "")) return false;
  return true;
}
