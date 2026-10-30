/**
 * Runs once when the server starts. With STOREFRONT_EDGE_CACHE_ENABLED exactly
 * "true", installs the last check on public store pages kept by the CDN
 * (lib/edgeCacheGuard); otherwise it does nothing.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.STOREFRONT_EDGE_CACHE_ENABLED !== "true") return;
  const { installEdgeCacheGuard } = await import("./lib/edgeCacheGuard");
  installEdgeCacheGuard();
}
