# Store pages cached at Cloudflare: manual setup

The storefront can let Cloudflare keep a store's public pages for anonymous
visitors (`apps/storefront/src/lib/edgeCache.ts`). Nothing happens until both
halves below are in place; either one alone changes nothing a shopper sees.

## 1. The storefront (Railway, server-only, read at run time)

| Variable | Value |
| --- | --- |
| `STOREFRONT_EDGE_CACHE_ENABLED` | `true` (anything else: off, every response exactly as before) |
| `STOREFRONT_EDGE_CACHE_S_MAXAGE` | optional, seconds, default `60` |
| `STOREFRONT_EDGE_CACHE_SWR` | optional, seconds, default `300` |

The earlier name `STOREFRONT_EDGE_CACHE` is no longer read: remove it if it is set.

On, an anonymous `GET`/`HEAD` of a public page on `<slug>.zimos.co` answers
`Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=300`.
Everything else keeps Next's `private, no-cache, no-store, max-age=0, must-revalidate`:
cart, checkout, `/pay`, account, orders, tracking, funnels, previews (the
editor's frame, `?storePreview=`, `?paymentsPreview=`), a visitor with a
`zimos_store_*` cookie (language, light/dark, staff preview), any redirect,
404/500, any response with `Set-Cookie`, the app's own navigations (RSC), and
every merchant domain unless section 4 is switched on.

## 2. The Cache Rule (zimos.co → Caching → Cache Rules → Create rule)

Name: `Storefront pages — respect origin`

**When incoming requests match** → Edit expression:

```
(ends_with(http.host, ".zimos.co")
 and not http.host in {"www.zimos.co" "store.zimos.co" "app.zimos.co" "admin.zimos.co" "api.zimos.co" "customers.zimos.co" "fallback.zimos.co"}
 and http.request.method in {"GET" "HEAD"}
 and not starts_with(http.request.uri.path, "/_next/")
 and not http.request.uri.query contains "_rsc="
 and not any(http.request.headers["rsc"][*] == "1")
 and not http.cookie contains "zimos_store_")
```

Add any other platform subdomain of the zone (anything that is not a store) to
the `not http.host in {…}` list.

**Then**:

- Cache eligibility: **Eligible for cache**
- Edge TTL: **Use cache-control header if present, bypass cache if not**
- Browser TTL: **Respect origin TTL**
- Cache key: leave the defaults (the full URL with its host and query string;
  do **not** turn on "Ignore query string")

Why each condition:

- `.zimos.co` hosts only: a merchant domain goes through the Worker, whose
  request to Railway would be kept under the Railway host and shared by every
  merchant domain. Never widen this rule to all hosts or to the Railway host.
- `rsc: 1` and `_rsc=`: the app's own navigations. Cloudflare ignores `Vary`,
  so without these a navigation's payload, or Next's 307 for a bad `_rsc`,
  could be kept under the page's own URL. The storefront also refuses them.
- `zimos_store_`: Cloudflare serves a kept copy without asking the storefront;
  a visitor who picked a language or light/dark must reach the storefront.

## 3. Checking it

```bash
for i in 1 2 3; do curl -s -o /dev/null -w '%{http_code} ttfb=%{time_starttransfer}s cf=%header{cf-cache-status} age=%header{age}\n' https://<slug>.zimos.co/; done
```

The first call is `MISS` (or `EXPIRED`), the next ones `HIT` with a growing
`age`. These must never be `HIT`:

```bash
curl -sI https://<slug>.zimos.co/ -H 'cookie: zimos_store_locale=en' | grep -iE 'cf-cache-status|cache-control'
curl -sI https://<slug>.zimos.co/cart | grep -iE 'cf-cache-status|cache-control'
curl -sI https://<slug>.zimos.co/ -H 'RSC: 1' | grep -iE '^HTTP|cf-cache-status|cache-control'
```

## 4. Merchant domains (off by default)

A merchant domain (`www.merchant-shop.com`) never reaches the Cache Rule above
in a way it could use: the Worker on route `*/*` runs **before** Cloudflare's
cache, and the only thing its `fetch()` to Railway could be kept under is the
Railway URL (`https://<ORIGIN_HOST>/products/x`), one key for every merchant
domain. Never add a Cache Rule for merchant hostnames or for the Railway host,
never widen the rule above, and never add a "Cache Everything" Page Rule that
could match the Railway host: one store's page would answer another's domain.

Instead, the Worker keeps the pages itself in the zone's cache (Cache API)
under the visitor's own URL — host, path and query — and the storefront marks a
merchant page public only when the Worker says it does so. Three switches, all
off by default, each one alone changing nothing a shopper sees:

| Where | Variable | Value |
| --- | --- | --- |
| Worker `zimos-custom-domains` (Settings → Variables, plain text) | `EDGE_CACHE_ENABLED` | `true` |
| Storefront (Railway) | `STOREFRONT_EDGE_CACHE_CUSTOM_DOMAINS` | `true` (with `STOREFRONT_EDGE_CACHE_ENABLED=true`) |
| Backend (Railway) | `CLOUDFLARE_PURGE_CUSTOM_DOMAINS` | `true` (with `CLOUDFLARE_PURGE_ENABLED=true`) |

What the Worker does with `EDGE_CACHE_ENABLED=true`
(`worker/custom-domains-worker.js`, tests: `npm run test:worker`):

- Only a `GET`/`HEAD` of a page (not `/_next/`, `/api/` or a file) from a
  visitor with none of our cookies but `zimos_touch`, no `RSC`/`Next-Router-*`/
  `Next-Url` header, no `_rsc`, `storePreview`, `paymentsPreview` or
  `zimos-view` in the link, no `Range` or `Authorization`. Anything else goes to
  the storefront exactly as before (`X-Zimos-Cache: BYPASS`).
- A kept copy answers with `X-Zimos-Cache: HIT` without calling Railway. A `GET`
  not kept goes to the storefront with `X-Zimos-Edge-Cache: 1` and
  `cache: "no-store"` (the subrequest itself is never kept under the Railway
  host), `X-Zimos-Cache: MISS`.
- It keeps only a `200` `text/html` answer without `Set-Cookie` whose
  `Cache-Control` is exactly the storefront's mark, as it came. It never adds,
  changes or removes `Cache-Control`.
- On a runtime whose compatibility date is before 2024-11-11 (no
  `cache: "no-store"`), it keeps nothing and behaves as with the variable off.

What the storefront does with `STOREFRONT_EDGE_CACHE_CUSTOM_DOMAINS=true`
(`apps/storefront/src/lib/edgeCache.ts`): a merchant page is marked like a
subdomain page only when the Worker proved itself (`X-Zimos-Edge`), sent
`X-Zimos-Edge-Cache: 1`, the visitor's host is exactly the store's primary
domain as `GET /store/resolve-host` answers it (verified, certificate issued),
and the proxy rewrote to that very store. Every other rule of section 1, and
the guard on the way out, is the same.

Checking it (replace `www.merchant-shop.com` and the product):

```bash
for i in 1 2 3; do curl -s -o /dev/null -w '%{http_code} zimos=%header{x-zimos-cache} cc=%header{cache-control} ray=%header{cf-ray}\n' https://www.merchant-shop.com/products/<product>; done
```

`MISS` then `HIT` (the Cache API is per data center: the `cf-ray` suffix names
it). These must never be `HIT`, and never `public` (GET, each run twice: a
`HEAD` never fills the cache, so it proves nothing here):

```bash
h() { curl -s -o /dev/null -D - "$@" | grep -iE '^HTTP|x-zimos-cache|cache-control'; }
h https://www.merchant-shop.com/products/<product> -H 'cookie: zimos_store_locale=en'
h https://www.merchant-shop.com/cart
h https://www.merchant-shop.com/pay/<order>
h https://www.merchant-shop.com/products/<product> -H 'RSC: 1'
h https://www.merchant-shop.com/store/<another-store-slug>
```

Turning it off: `EDGE_CACHE_ENABLED` to anything but `true` on the Worker
(kept copies are no longer read at once), or
`STOREFRONT_EDGE_CACHE_CUSTOM_DOMAINS=false` on the storefront (nothing new is
kept; what is kept expires within `s-maxage`).

## 5. Purge on publish (the backend)

With the cache on, a merchant's change still waits up to `s-maxage` to show.
The backend can drop the store's pages at once instead
(`zimos/src/modules/storefront/cloudflarePurge.js`, its
`REPORT-cloudflare-purge.md`): every change the store's shoppers see (design,
theme, products, collections, prices, stock going out or coming back, store
settings, shipping shown, coupons and combos, an approved review, a new
subdomain) purges that store's host by hostname, `<slug>.zimos.co`, a couple of
seconds after the last save. Never anything wider, and never a platform host.
Nothing changes here: no header to add. With `CLOUDFLARE_PURGE_CUSTOM_DOMAINS=true`
the same request also names the store's own verified domains, and a domain it
just removed (section 4).

| Variable (backend) | Value |
| --- | --- |
| `CLOUDFLARE_PURGE_ENABLED` | `true` (anything else: off, nothing is sent) |
| `CLOUDFLARE_PURGE_CUSTOM_DOMAINS` | `true` to purge the store's own domains too (section 4) |
| `CLOUDFLARE_API_TOKEN` | a token with **Zone › Cache Purge › Purge** on zimos.co |
| `CLOUDFLARE_ZONE_ID` | zimos.co's zone id |

## Turning it off

Set `STOREFRONT_EDGE_CACHE_ENABLED` to anything but `true` and redeploy; pages
already kept expire within `s-maxage` + `stale-while-revalidate`, or purge the
zone's cache. The Cache Rule can stay: with nothing marked public it keeps
nothing.
