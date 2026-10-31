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
every merchant domain (see 4).

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

## 4. Merchant domains

Not cached, by design: the storefront never marks a request that came through
the Worker (`worker/custom-domains-worker.js`). Caching them needs the Worker
to keep pages itself under the visitor's own URL (Cache API), only for
responses carrying exactly the storefront's `public, max-age=0, s-maxage=…`
header, and the storefront to trust a signal from the Worker that it does so.

## 5. Purge on publish (the backend)

With the cache on, a merchant's change still waits up to `s-maxage` to show.
The backend can drop the store's pages at once instead
(`zimos/src/modules/storefront/cloudflarePurge.js`, its
`REPORT-cloudflare-purge.md`): every change the store's shoppers see (design,
theme, products, collections, prices, stock going out or coming back, store
settings, shipping shown, coupons and combos, an approved review, a new
subdomain) purges that store's host by hostname, `<slug>.zimos.co`, a couple of
seconds after the last save. Never anything wider, and never a platform host.
Nothing changes here: no header to add.

| Variable (backend) | Value |
| --- | --- |
| `CLOUDFLARE_PURGE_ENABLED` | `true` (anything else: off, nothing is sent) |
| `CLOUDFLARE_API_TOKEN` | a token with **Zone › Cache Purge › Purge** on zimos.co |
| `CLOUDFLARE_ZONE_ID` | zimos.co's zone id |

## Turning it off

Set `STOREFRONT_EDGE_CACHE_ENABLED` to anything but `true` and redeploy; pages
already kept expire within `s-maxage` + `stale-while-revalidate`, or purge the
zone's cache. The Cache Rule can stay: with nothing marked public it keeps
nothing.
