import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No workspace packages are consumed yet (the marketing site is standalone
  // and has no dynamic data). If a follow-up wires in `@store-builder/ui`,
  // add it to `transpilePackages` here — mirroring apps/storefront.
};

export default nextConfig;
