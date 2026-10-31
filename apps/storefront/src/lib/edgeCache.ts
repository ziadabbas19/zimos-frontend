import type { NextRequest, NextResponse } from "next/server";
import { STORE_SLUG_HEADER } from "./domains";
import { STORE_REF_HEADER } from "./documentLocale";
import { EDGE_CACHE_HEADER, EDGE_HOST_HEADER, EDGE_SECRET_HEADER } from "./edgeHost";
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
 * never gets another's. Merchant domains reach this server through the Worker
 * (worker/custom-domains-worker.js), whose request names our own Railway
 * host: a copy the CDN kept for that request would be shared by every
 * merchant domain. So a request that came through the Worker is never marked,
 * with one exception (STOREFRONT_EDGE_CACHE_CUSTOM_DOMAINS, off unless exactly
 * "true"): the Worker proved itself with its secret, said it keeps the answer
 * itself under the visitor's own URL (X-Zimos-Edge-Cache: 1, its
 * EDGE_CACHE_ENABLED), the visitor's host is the store's primary domain as the
 * API answers it (verified, with its certificate: the host the backend purges,
 * CLOUDFLARE_PURGE_CUSTOM_DOMAINS), and the proxy rewrote to exactly that
 * store (merchantPage, then edgeCacheControl). Every other check is the same.
 *
 * The CDN must be told the same in its own words (docs/edge-cache/README.md):
 * it serves a kept copy without asking this server, so its rule (and the
 * Worker, for merchant domains) skips the cache for these cookies and for the
 * app's navigations.
 */

const DEFAULT_S_MAXAGE = 60;
const DEFAULT_STALE_WHILE_REVALIDATE = 300;
const MAX_SECONDS = 86_400;

/** Next's own header for a page rendered per request, which the guard puts back. */
export const PRIVATE_CACHE_CONTROL = "private, no-cache, no-store, max-age=0, must-revalidate";

export function edgeCacheEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.STOREFRONT_EDGE_CACHE_ENABLED === "true";
}

/** Merchant domains too (see above). Has no effect without STOREFRONT_EDGE_CACHE_ENABLED. */
export function edgeCacheCustomDomainsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.STOREFRONT_EDGE_CACHE_CUSTOM_DOMAINS === "true";
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
  EDGE_CACHE_HEADER,
  STORE_SLUG_HEADER,
  STORE_REF_HEADER,
  STORE_PREVIEW_HEADER,
  EDITOR_VIEW_HEADER,
] as const;

/** The Worker's own headers, the only ones of NOT_FROM_A_BROWSER a merchant page may arrive with. */
const WORKER_HEADERS = [EDGE_SECRET_HEADER, EDGE_HOST_HEADER, EDGE_CACHE_HEADER] as const;

/** A merchant domain's page the Worker keeps under the visitor's own URL: that host, and the store it is. */
export interface MerchantPage {
  host: string;
  slug: string;
}

/**
 * The page a merchant domain asked for, when the Worker keeps it (see above),
 * or null. `forwarded`: the host came from the Worker with its secret
 * (lib/edgeHost); `workerKeeps`: it sent X-Zimos-Edge-Cache: 1; `primaryHost`:
 * the store's primary domain as GET /store/resolve-host answers it for this
 * host. A host that is not exactly that one (another of the store's domains,
 * one set not to redirect, a port, a trailing dot) is never kept.
 */
export function merchantPage(
  input: { forwarded: boolean; workerKeeps: boolean; host: string | null; slug: string; primaryHost: string | null },
  env: NodeJS.ProcessEnv = process.env,
): MerchantPage | null {
  if (!edgeCacheEnabled(env) || !edgeCacheCustomDomainsEnabled(env)) return null;
  if (!input.forwarded || !input.workerKeeps || !input.slug) return null;
  if (!input.host || !input.primaryHost || input.host !== input.primaryHost) return null;
  return { host: input.host, slug: input.slug };
}

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
 * The store a proxy rewrite renders and the store-relative path:
 * `/store/<ref>/products/x` → `{ ref, path: "/products/x" }`. Null for any
 * other target.
 */
export function storeOfRewrite(rewrite: string | null): { ref: string; path: string } | null {
  if (!rewrite) return null;
  let pathname: string;
  try {
    pathname = new URL(rewrite).pathname;
  } catch {
    return null;
  }
  const match = /^\/store\/([^/]+)(\/.*)?$/.exec(pathname);
  return match ? { ref: match[1], path: match[2] ?? "/" } : null;
}

/** The store-relative path a proxy rewrite renders: `/store/<ref>/products/x` → `/products/x`. */
export function storePathOfRewrite(rewrite: string | null): string | null {
  return storeOfRewrite(rewrite)?.path ?? null;
}

export interface EdgeCacheInput {
  enabled: boolean;
  /** STOREFRONT_EDGE_CACHE_CUSTOM_DOMAINS: without it a merchant page is never marked. */
  customDomainsEnabled?: boolean;
  /** Set by the proxy for a merchant domain's page the Worker keeps (merchantPage); null otherwise. */
  merchantPage?: MerchantPage | null;
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
  const merchant = input.customDomainsEnabled ? (input.merchantPage ?? null) : null;
  const allowed: readonly string[] = merchant ? WORKER_HEADERS : [];
  if (input.headerNames.some((name) => (NOT_FROM_A_BROWSER as readonly string[]).includes(name) && !allowed.includes(name))) return null;
  if (input.paramNames.some((name) => (PREVIEW_PARAMS as readonly string[]).includes(name))) return null;
  const target = storeOfRewrite(input.rewrite);
  if (!target || !isPublicStorePath(target.path)) return null;
  // A merchant page: only the store its host resolved to.
  if (merchant && target.ref !== merchant.slug) return null;
  return edgeCacheValue(env);
}

/**
 * The proxy's last step: marks the response for the CDN when edgeCacheControl
 * allows it. `merchant`: the merchant page the proxy rewrote to (merchantPage).
 */
export function withEdgeCache(request: NextRequest, response: NextResponse, merchant: MerchantPage | null = null): NextResponse {
  const value = edgeCacheControl({
    enabled: edgeCacheEnabled(),
    customDomainsEnabled: edgeCacheCustomDomainsEnabled(),
    merchantPage: merchant,
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
