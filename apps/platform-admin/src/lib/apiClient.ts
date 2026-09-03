import { ApiClient } from "@store-builder/api-client";

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api/v1";

export const apiClient = new ApiClient({
  baseUrl,
  onSessionExpired: () => {
    // Full reload so every in-flight auth state resets cleanly.
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  },
});
