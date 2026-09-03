import { ApiClient, createMemoryTokenStorage } from "@store-builder/api-client";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";

/**
 * The storefront only ever talks to the public `/store/:workspaceId/...`
 * API, which needs no auth — so a fresh in-memory token storage per
 * request (server components) or per session (client) is enough. Nothing
 * here ever calls the merchant-auth endpoints.
 */
export function createStorefrontApiClient() {
  return new ApiClient({ baseUrl, tokenStorage: createMemoryTokenStorage() });
}
