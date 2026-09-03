import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@store-builder/api-client", "@store-builder/ui"],
};

export default nextConfig;
