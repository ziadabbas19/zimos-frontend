/**
 * How long a browser keeps the files of public/ (next.config.ts headers()).
 *
 * The folders the pages draw from: logos, icons, store and dashboard
 * captures, photographs, platform marks, sharing images. Their names carry no
 * content hash, so they are kept a week, then served from cache while a fresh
 * copy is fetched for up to thirty days more — never `immutable`: a file
 * replaced under the same name reaches every browser within the week. Without
 * this Next sends `public, max-age=0`, and the browser asks again for every
 * picture on every visit.
 *
 * What is not here keeps Next's own policy: `/_next/static/*` (hashed names)
 * is `public, max-age=31536000, immutable` and cannot be changed, and the
 * pages keep their ISR `s-maxage`. Cloudflare in front of Railway passes the
 * origin's Cache-Control through as it is (checked 2026-11-15).
 */
export const PUBLIC_ASSET_DIRS = ["brand", "icons", "stores", "photos", "product", "integrations", "og"] as const;

export const PUBLIC_ASSET_CACHE = "public, max-age=604800, stale-while-revalidate=2592000";

/** The rules for next.config.ts `headers()`. */
export function publicAssetHeaders() {
  return PUBLIC_ASSET_DIRS.map((dir) => ({
    source: `/${dir}/:path*`,
    headers: [{ key: "Cache-Control", value: PUBLIC_ASSET_CACHE }],
  }));
}
