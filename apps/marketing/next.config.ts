import type { NextConfig } from "next";
import { publicAssetHeaders } from "./src/lib/asset-cache";

const nextConfig: NextConfig = {
  // The site imports `@store-builder/ui` subpaths only — the footer's and
  // the contact page's social links, shared with the dashboard, and the
  // theme switch's circle (theme-reveal), shared with the storefront. The
  // package ships TypeScript source, so Next compiles it, as apps/storefront does.
  transpilePackages: ["@store-builder/ui"],

  // A week of cache for the files of public/ (src/lib/asset-cache.ts); pages and
  // /_next/static keep Next's own Cache-Control.
  async headers() {
    return publicAssetHeaders();
  },
};

export default nextConfig;
