import { ApiClient } from "@store-builder/api-client";

/** Base URL every API call is built on. Exported so non-ApiClient flows (e.g.
 * the Google OAuth redirect) can hit the same backend. */
export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api/v1";

export const apiClient = new ApiClient({
  baseUrl: apiBaseUrl,
  onSessionExpired: () => {
    // Full reload so every in-flight auth state resets cleanly.
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  },
});
