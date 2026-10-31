# Merchant custom domains: manual setup

How a merchant's own domain (`www.merchant-shop.com`) reaches the storefront:

```
shopper → www.merchant-shop.com   (merchant's CNAME → customers.zimos.co)
        → Cloudflare, zone zimos.co   (custom hostname + DV certificate)
        → Worker worker/custom-domains-worker.js
              calls ORIGIN_HOST (the storefront's Railway host) with
              X-Zimos-Host: www.merchant-shop.com
              X-Zimos-Edge: <EDGE_SECRET>
        → storefront proxy (apps/storefront/src/proxy.ts) → /store/<slug>
```

Nothing in the repository deploys any of this. Every step below is done by
hand, on staging first. Keep all the flags off until the staging test at the
end passes.

## 1. Cloudflare for SaaS on the zimos.co zone

1. Dashboard → zimos.co → SSL/TLS → Custom Hostnames → enable Cloudflare for
   SaaS (first 100 hostnames free, then per hostname per month).
2. DNS → add two records, both **Proxied** (orange cloud):
   - `fallback` → `AAAA 100::` (a placeholder; the Worker answers, not this
     address).
   - `customers` → `CNAME fallback.zimos.co`.
3. Custom Hostnames → **Fallback Origin** → `fallback.zimos.co` → Add. Wait
   until it shows Active. (API: `PUT /zones/{zone_id}/custom_hostnames/fallback_origin`
   with `{"origin":"fallback.zimos.co"}`.)

## 2. The Worker

1. Workers & Pages → Create → Worker → name it `zimos-custom-domains` → paste
   `worker/custom-domains-worker.js` → Deploy.
2. Settings → Variables and Secrets → add two **secrets**:
   - `ORIGIN_HOST`: the storefront's Railway host, no scheme, e.g.
     `storefront-production.up.railway.app`.
   - `EDGE_SECRET`: a random value of at least 32 characters. In PowerShell
     (terminal, not a file):
     `$b = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)`
     Never commit it.
3. zimos.co → Workers Routes → Add route:
   - Route `*/*`, Worker `zimos-custom-domains` (custom hostnames go through
     the Worker).
   - Route `*zimos.co/*`, Worker **None** (the platform's own hosts never go
     through it).

Why `X-Zimos-Host` and not `X-Forwarded-Host`: Railway's edge sets
`X-Forwarded-Host` itself, to the host it was called on, which is
`ORIGIN_HOST`. The visitor's host the Worker put there never reaches the
storefront, which then shows its own default "Storefront" page on every
merchant domain. The Worker still sends `X-Forwarded-Host` too, for a
storefront deployed before `X-Zimos-Host`; the storefront reads
`X-Forwarded-Host` only when `X-Zimos-Host` is absent. Both are trusted only
with `X-Zimos-Edge` equal to the storefront's `CUSTOM_DOMAIN_EDGE_SECRET` (at
least 32 characters).

After changing the Worker's code, paste it again and press **Deploy**: the
repository never deploys it.

The Worker can also keep store pages at the edge under the visitor's own URL
(variable `EDGE_CACHE_ENABLED`, off unless `true`): docs/edge-cache/README.md,
section 4. Never add a Cache Rule for merchant hostnames or the Railway host.

Whatever that variable says, the Worker fetches `/robots.txt`, `/sitemap.xml`
and `/manifest.webmanifest` with `cache: "no-store"`: each store answers them
for itself, but their URL on the Railway host is one for every merchant domain.
After deploying a Worker from before this, purge those three URLs on the
Railway host once (docs/edge-cache/README.md, section 4).

## 3. Edge settings

- SSL/TLS → Edge Certificates → **Always Use HTTPS**: on.
- **No HSTS** for merchant domains: leave HSTS off on the zone (a merchant who
  leaves us could not serve plain http for months otherwise).
- Minimum TLS 1.2 is set per custom hostname by the API.

## 4. The apps (environment, names only)

Backend:
- `CUSTOM_DOMAINS_ENABLED=true` (opens the dashboard routes)
- `CERTIFICATE_PROVIDER=cloudflare`
- `CLOUDFLARE_API_TOKEN`: API token with Zone → SSL and Certificates → Edit,
  on zimos.co only
- `CLOUDFLARE_ZONE_ID`
- `CUSTOM_DOMAIN_CNAME_TARGET=customers.zimos.co`
- optional: `CUSTOM_DOMAINS_MAX_PER_STORE` (default 1), `DOMAIN_VERIFY_RESOLVERS`

Storefront:
- `CUSTOM_DOMAINS_ENABLED=true`
- `CUSTOM_DOMAIN_EDGE_SECRET`: the same value as the Worker's `EDGE_SECRET`

Dashboard:
- `VITE_CUSTOM_DOMAINS_ENABLED=true` (build-time)

## 5. What the merchant adds (shown in the dashboard)

Subdomains only (`www.` or `shop.`). A bare `merchant-shop.com` is refused;
the merchant forwards it to `https://www.merchant-shop.com` at the registrar.

| Type | Name | Value |
| --- | --- | --- |
| CNAME | `www` | `customers.zimos.co` |
| TXT | `_zimos-verify.www` | `zimos-verify=<token>` |

## 6. Staging test before turning anything on in production

1. A test domain on GoDaddy, Namecheap and Cloudflare DNS (grey cloud): add
   the two records, verify in the dashboard, wait for **active**.
2. Open the domain: the store loads over https with Cloudflare's certificate.
3. Open `/store/<slug>/products/x` on it: redirected to `/products/x` on the
   **same** domain, never the Railway host.
4. Call the Railway host directly with a made-up `X-Zimos-Host` and
   `X-Forwarded-Host` and no `X-Zimos-Edge`: the store of that host must
   **not** load.
5. Check the shopper's IP in the backend logs is the real one, not
   Cloudflare's.
6. Remove the domain in the dashboard: the custom hostname disappears from
   Cloudflare. Add the same domain from another store: it works once the TXT
   is changed.
