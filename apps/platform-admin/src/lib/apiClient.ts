import { ApiClient } from "@store-builder/api-client";

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

/** A request was refused with a 403: AuthContext reads the account again. */
export const FORBIDDEN_EVENT = "zimos:forbidden";

export const apiClient = new ApiClient({
  baseUrl: API_BASE_URL,
  onSessionExpired: () => {
    // Full reload so every in-flight auth state resets cleanly.
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  },
  onForbidden: () => {
    window.dispatchEvent(new Event(FORBIDDEN_EVENT));
  },
});

/**
 * Root of the backend (the API base with its `/api/vN` suffix removed). Health
 * endpoints live at the root, e.g. `/health` and `/health/ready`.
 */
export function backendRootUrl(): string {
  return API_BASE_URL.replace(/\/+$/, "").replace(/\/api(\/v\d+)?$/, "");
}
