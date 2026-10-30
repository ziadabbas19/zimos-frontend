import { ApiClient } from "@store-builder/api-client";
import { draftRefusal, holdForGoLive } from "@/lib/goLive";
import { emailRefusal, holdForEmailConfirm } from "@/lib/emailConfirm";
import { forgetAll, sharedGet } from "@/lib/requestCache";

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

// A draft store's refusal (403 SUBSCRIPTION_REQUIRED, details.draft) opens the
// subscribe dialog and waits on it: going live there sends the request again
// (lib/goLive). An account whose email isn't confirmed yet (403
// EMAIL_NOT_VERIFIED) gets the code dialog the same way (lib/emailConfirm);
// its retry goes through here again, so a draft store's refusal that comes
// next still opens the subscribe dialog. Every typed method goes through
// `request`, so this covers all.
const send = apiClient.request.bind(apiClient);
async function sendWithHolds<T>(path: string, opts?: Parameters<typeof send>[1]): Promise<T> {
  try {
    return await send<T>(path, opts);
  } catch (err) {
    if (emailRefusal(err)) return holdForEmailConfirm(err, () => apiClient.request<T>(path, opts));
    const refusal = draftRefusal(err);
    if (!refusal) throw err;
    return holdForGoLive(err, refusal, () => send<T>(path, opts));
  }
}

// Plain GETs are shared (lib/requestCache): one request for the same read
// asked twice at once, the bootstrap's answers for the frame's first reads.
// Anything else forgets what is kept, before it goes and once it is answered.
const clearSession = apiClient.clearSession.bind(apiClient);
apiClient.clearSession = () => {
  forgetAll();
  clearSession();
};
apiClient.request = async function request<T>(path: string, opts?: Parameters<typeof send>[1]): Promise<T> {
  const method = opts?.method ?? "GET";
  if (method !== "GET") {
    forgetAll();
    try {
      return await sendWithHolds<T>(path, opts);
    } finally {
      forgetAll();
    }
  }
  if (opts?.signal || opts?.headers || opts?.redirect || opts?.auth === false) return sendWithHolds<T>(path, opts);
  return sharedGet<T>(path, () => sendWithHolds<T>(path, opts));
};
