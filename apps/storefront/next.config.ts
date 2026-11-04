import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from "next/constants";
import { buildXsLookCss, watchXsLookCss } from "./scripts/xs-look-css.mjs";
import { frameAncestorsPolicy } from "./src/lib/frameAncestors";
import { parseImageOrigins } from "./src/lib/imageOrigins";

// Who may frame the store's pages (src/lib/frameAncestors.ts): nothing is sent
// while STOREFRONT_FRAME_ANCESTORS is unset, so any site may, as before.
const frameAncestors = frameAncestorsPolicy(process.env.STOREFRONT_FRAME_ANCESTORS);

// The imported templates' files (public/xs): the pictures and their smaller
// copies may change when a template is redone; the faces never do; each look's
// stylesheet carries a hash of its content in its name, so it never changes.
// When several rules match a file, the last one's header is the one sent.
const XS_CACHE = [
  { source: "/xs/:path*", value: "public, max-age=86400, stale-while-revalidate=604800" },
  { source: "/xs/fonts/:file*", value: "public, max-age=31536000, immutable" },
  { source: "/xs/:look/:file(look\\.[0-9a-f]{10}\\.css)", value: "public, max-age=31536000, immutable" },
  { source: "/xs/:file(phone\\.[0-9a-f]{10}\\.css)", value: "public, max-age=31536000, immutable" },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@store-builder/api-client", "@store-builder/ui", "@store-builder/image-tools"],
  async headers() {
    return [
      ...(frameAncestors ? [{ source: "/:path*", headers: [{ key: "Content-Security-Policy", value: frameAncestors }] }] : []),
      ...XS_CACHE.map(({ source, value }) => ({ source, headers: [{ key: "Cache-Control", value }] })),
    ];
  },
  images: {
    // Resized merchant photos only from the origins listed in
    // NEXT_PUBLIC_STORE_IMAGE_ORIGINS (src/lib/imageOrigins.ts); none when it
    // is unset, and then components/StoreImage draws plain <img> as before.
    remotePatterns: parseImageOrigins(process.env.NEXT_PUBLIC_STORE_IMAGE_ORIGINS).map((url) => ({
      protocol: url.protocol === "http:" ? ("http" as const) : ("https" as const),
      hostname: url.hostname,
      port: url.port,
      pathname: "/**",
    })),
    // One quality, so the optimizer can't be asked for any other (Next 16 requires the list).
    qualities: [75],
    // The dashboard lets through uploads of up to 5 MB untouched.
    maximumResponseBody: 10_000_000,
    // AVIF for the browsers that ask for it, only with STOREFRONT_IMAGE_AVIF_ENABLED: the optimizer then answers one
    // address in two formats by the Accept header, so the CDN's rule must keep them apart first (docs/edge-cache,
    // "AVIF") or a browser without AVIF can be given a kept copy it cannot draw. Off: WebP, as before.
    ...(process.env.STOREFRONT_IMAGE_AVIF_ENABLED === "true" ? { formats: ["image/avif", "image/webp"] as ("image/avif" | "image/webp")[] } : {}),
  },
};

/**
 * Each imported template's own stylesheet (scripts/xs-look-css.mjs) is built
 * before a build — and rebuilt on every change while developing — so the
 * files src/lib/xsLookCss.json names always exist and match their sources.
 * The built files are checked in, and a running server (`next start`) only
 * serves them: it writes nothing.
 */
export default function config(phase: string): NextConfig {
  if (phase === PHASE_DEVELOPMENT_SERVER) watchXsLookCss();
  else if (phase === PHASE_PRODUCTION_BUILD) buildXsLookCss();
  return nextConfig;
}
