/**
 * Cloudflare Worker in front of merchant custom domains (Cloudflare for SaaS).
 *
 * A shopper opens https://www.merchant-shop.com/products/x. That hostname is a
 * custom hostname on our zone, so Cloudflare terminates TLS with its own
 * certificate and runs this Worker. Railway only answers hosts registered on
 * the storefront service, so the Worker calls the storefront's own Railway
 * host (ORIGIN_HOST) and says which host the shopper asked for:
 *
 *   X-Zimos-Host       the shopper's host (www.merchant-shop.com)
 *   X-Forwarded-Host   the same, for a storefront from before X-Zimos-Host
 *   X-Forwarded-Proto  https
 *   X-Zimos-Edge       EDGE_SECRET, the proof that this Worker sent it; the
 *                      storefront (apps/storefront/src/lib/edgeHost.ts)
 *                      ignores X-Zimos-Host without it
 *   X-Zimos-Client-IP  the shopper's IP (CF-Connecting-IP)
 *
 * The host goes in a header of our own because Railway's edge sets
 * X-Forwarded-Host itself, to the host it was called on (ORIGIN_HOST), so the
 * value sent here never reaches the storefront under that name.
 *
 * Secrets (wrangler secret put / dashboard > Settings > Variables):
 *   ORIGIN_HOST  e.g. storefront-production.up.railway.app (no scheme)
 *   EDGE_SECRET  the same value as the storefront's CUSTOM_DOMAIN_EDGE_SECRET
 *
 * Store pages kept at the edge (EDGE_CACHE_ENABLED, a plain variable; off
 * unless exactly "true"). A Worker on a route runs before Cloudflare's cache,
 * and what its fetch() to ORIGIN_HOST could be kept under is ORIGIN_HOST's
 * URL: one key for every merchant domain. So no Cache Rule can keep a
 * merchant domain's pages apart, and this Worker keeps them itself, in the
 * zone's cache (Cache API), under the shopper's own URL: host, path and
 * query. Never under ORIGIN_HOST.
 *
 *   - Only a page (not /_next/, /api/ or a file) asked for with GET or HEAD by
 *     an anonymous visitor: none of our cookies but zimos_touch, no
 *     navigation of the app (RSC headers, _rsc), no preview link, no Range
 *     or Authorization. Anything else goes to the storefront as before.
 *   - A GET not kept yet goes to the storefront with X-Zimos-Edge-Cache: 1
 *     and `cache: "no-store"`, so the subrequest itself is never kept under
 *     ORIGIN_HOST. The storefront marks a merchant page public only with
 *     that header (STOREFRONT_EDGE_CACHE_CUSTOM_DOMAINS, lib/edgeCache.ts).
 *   - Kept only: a 200 text/html answer, without Set-Cookie, whose
 *     Cache-Control is exactly the storefront's mark (`public, max-age=0,
 *     s-maxage=…`), as it came. This Worker never adds, changes or removes
 *     Cache-Control; the cache keeps the copy for s-maxage.
 *   - X-Zimos-Cache: HIT, MISS or BYPASS on a page's answer, for checking.
 *
 * A runtime that refuses `cache: "no-store"` (a compatibility date before
 * 2024-11-11) keeps nothing: every request goes as with the variable off.
 *
 * Setup steps: docs/custom-domains/README.md and docs/edge-cache/README.md.
 * Nothing here is deployed by the repository.
 */

const HOP_HEADERS = ["x-zimos-host", "x-forwarded-host", "x-zimos-edge", "x-zimos-client-ip", "x-zimos-edge-cache"];

// The storefront's mark for a page every visitor gets alike (lib/edgeCache.ts, edgeCacheValue).
const PUBLIC_MARK = /^public, max-age=0, s-maxage=\d{1,5}(?:, stale-while-revalidate=\d{1,5})?$/;
// The app's own navigations (lib/edgeCache.ts RSC_REQUEST_HEADERS, and next-url), and requests a copy must not answer.
const SKIP_HEADERS = [
  "rsc",
  "next-router-prefetch",
  "next-router-state-tree",
  "next-router-segment-prefetch",
  "next-hmr-refresh",
  "next-url",
  "range",
  "authorization",
];
// A navigation of the app, a staff preview, the website editor's view.
const SKIP_PARAMS = ["_rsc", "storePreview", "paymentsPreview", "zimos-view"];
// Ours, read only by scripts in the browser (lib/edgeCache.ts PAGE_NEUTRAL_COOKIES).
const NEUTRAL_COOKIES = ["zimos_touch"];

let noStoreTaken;

/** Whether this runtime takes `cache: "no-store"` on a subrequest. */
function canSkipFetchCache() {
  if (noStoreTaken === undefined) {
    try {
      new Request("https://zimos.invalid/", { cache: "no-store" });
      noStoreTaken = true;
    } catch {
      noStoreTaken = false;
    }
  }
  return noStoreTaken;
}

/** A page: not Next's own files, a route handler, or anything that names a file. */
function isPagePath(pathname) {
  return !pathname.startsWith("/_next/") && !pathname.startsWith("/api/") && !/\.[^./]+$/.test(pathname);
}

function hasPersonalCookie(cookie) {
  return (cookie || "").split(";").some((part) => {
    const name = part.split("=")[0].trim();
    return name.startsWith("zimos_") && !NEUTRAL_COOKIES.includes(name);
  });
}

/** Whether a kept copy may answer this GET or HEAD, and whether its answer may be kept. */
function mayUseCache(url, headers) {
  if (SKIP_HEADERS.some((name) => headers.has(name))) return false;
  if (SKIP_PARAMS.some((name) => url.searchParams.has(name))) return false;
  return !hasPersonalCookie(headers.get("cookie"));
}

/** Only what the storefront marked as the same for every visitor, exactly as it marked it. */
function mayKeep(response) {
  return (
    response.status === 200 &&
    PUBLIC_MARK.test(response.headers.get("cache-control") || "") &&
    !response.headers.has("set-cookie") &&
    (response.headers.get("content-type") || "").toLowerCase().startsWith("text/html")
  );
}

function labelled(response, state) {
  const out = new Response(response.body, response);
  out.headers.set("X-Zimos-Cache", state);
  return out;
}

/** The request to the storefront. `keep`: this Worker keeps the answer, so the subrequest is never kept. */
function forward(request, env, method, keep = false) {
  const incoming = new URL(request.url);
  const target = new URL(request.url);
  target.protocol = "https:";
  target.host = env.ORIGIN_HOST;

  const headers = new Headers(request.headers);
  // Whatever the shopper sent under these names is dropped first.
  for (const name of HOP_HEADERS) headers.delete(name);
  headers.set("X-Zimos-Host", incoming.host);
  headers.set("X-Forwarded-Host", incoming.host);
  headers.set("X-Forwarded-Proto", "https");
  headers.set("X-Zimos-Edge", env.EDGE_SECRET);
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) headers.set("X-Zimos-Client-IP", ip);
  if (keep) headers.set("X-Zimos-Edge-Cache", "1");

  const init = {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : request.body,
    // The storefront's redirects already name the shopper's host: pass them on as they are.
    redirect: "manual",
  };
  if (keep) init.cache = "no-store";
  return fetch(target.toString(), init);
}

export default {
  async fetch(request, env, ctx) {
    if (!env.ORIGIN_HOST || !env.EDGE_SECRET) {
      return new Response("Custom domains are not configured", { status: 503 });
    }

    const method = request.method.toUpperCase();
    const url = new URL(request.url);
    const page = (method === "GET" || method === "HEAD") && isPagePath(url.pathname);
    if (env.EDGE_CACHE_ENABLED !== "true" || !page || !canSkipFetchCache()) {
      return forward(request, env, method);
    }
    if (!mayUseCache(url, request.headers)) {
      return labelled(await forward(request, env, method), "BYPASS");
    }

    const cache = caches.default;
    // The shopper's own URL, never ORIGIN_HOST's: one store's copy can only answer its own host.
    const key = new Request(url.toString(), { method: "GET" });
    const kept = await cache.match(key).catch(() => undefined);
    if (kept) return labelled(method === "HEAD" ? new Response(null, kept) : kept, "HIT");
    if (method === "HEAD") return labelled(await forward(request, env, method), "MISS");

    const response = await forward(request, env, method, true);
    if (mayKeep(response)) ctx.waitUntil(cache.put(key, response.clone()).catch(() => undefined));
    return labelled(response, "MISS");
  },
};
