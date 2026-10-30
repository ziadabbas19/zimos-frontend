import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ApiError,
  TwoFactorRequiredError,
  isTwoFactorChallenge,
  type AuthUser,
  type LoginPayload,
  type RegisterPayload,
  type VerificationChallenge,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { startBootstrap } from "@/lib/bootstrap";
import { listenForConfirmation, noteCodeSent } from "@/lib/emailConfirm";
import { leavePushOnSignOut } from "@/lib/push/pushClient";

interface AuthContextValue {
  user: AuthUser | null;
  /**
   * "unavailable": signed in, but the account couldn't be read when the page
   * loaded (rate limited, a server error, no network). The session is kept
   * and `retry` reads it again; only a 401 makes the user a guest.
   */
  status: "loading" | "authenticated" | "guest" | "unavailable";
  /**
   * An account made through Google while a plan is required, still to choose
   * one: the dashboard asks for it before anything else (ChoosePlanPage).
   */
  needsPlan: boolean;
  /**
   * The account's email (or phone) is confirmed. Until it is, the banner asks
   * for the code, and starting a trial or publishing opens the code dialog
   * (lib/emailConfirm).
   */
  confirmed: boolean;
  /** Resolves with a challenge when the account must confirm a code first (nothing is signed in then). */
  login: (payload: LoginPayload) => Promise<VerificationChallenge | null>;
  /** Resolves with a challenge while sign-up codes are on; otherwise the new account is signed in. */
  register: (payload: RegisterPayload) => Promise<VerificationChallenge | null>;
  logout: () => Promise<void>;
  /**
   * Signs the account out of every device, this one included. Rejects, and
   * keeps this session, when the server could not be told.
   */
  signOutEverywhere: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Reads the account again after "unavailable". */
  retry: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// How often an unconfirmed account's state is re-read while the page is in
// view, so a confirmation made on another device clears the banner.
const RECHECK_MS = 60_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [needsPlan, setNeedsPlan] = useState(false);
  const [confirmed, setConfirmed] = useState(true);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");

  const loadUser = async () => {
    if (!apiClient.isAuthenticated()) {
      setUser(null);
      setNeedsPlan(false);
      setConfirmed(true);
      setStatus("guest");
      return;
    }
    // The frame's reads in one request, this one's answer among them (lib/bootstrap);
    // already on its way when the page has just started.
    startBootstrap();
    try {
      const me = await apiClient.meDetails();
      setUser(me.user);
      setNeedsPlan(me.needsPlan);
      setConfirmed(me.confirmed);
      setStatus("authenticated");
    } catch (err) {
      // Only the server refusing the session signs out: a 401 from /auth/me,
      // or from /auth/refresh behind it (the client has cleared the tokens
      // then). Anything else — 429, a 5xx, no network — keeps the session:
      // a page already showing goes on as it is, and a page load offers to
      // try again.
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
        setNeedsPlan(false);
        setConfirmed(true);
        setStatus("guest");
        return;
      }
      setStatus((current) => (current === "authenticated" ? current : "unavailable"));
    }
  };

  const retry = useCallback(async () => {
    setStatus("loading");
    await loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A quiet re-read for the banner: a failure (offline, a blip) changes nothing.
  const recheck = useCallback(async () => {
    if (!apiClient.isAuthenticated()) return;
    try {
      const me = await apiClient.meDetails();
      setUser(me.user);
      setConfirmed(me.confirmed);
    } catch {
      // Keep what we have; the next check tries again.
    }
  }, []);

  useEffect(() => {
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Back online after a failed page load: try again by itself.
  useEffect(() => {
    if (status !== "unavailable") return;
    const onOnline = () => void retry();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [status, retry]);

  // While unconfirmed: re-read on coming back to the tab, every minute while
  // it is in view, and at once when another tab confirms.
  const waiting = status === "authenticated" && !confirmed;
  useEffect(() => {
    if (!waiting) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void recheck();
    };
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void recheck();
    }, RECHECK_MS);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    const stopListening = listenForConfirmation(() => void recheck());
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      stopListening();
    };
  }, [waiting, recheck]);

  const value = useMemo<AuthContextValue>(() => {
    async function login(payload: LoginPayload): Promise<VerificationChallenge | null> {
      const result = await apiClient.login(payload);
      // Sign-up codes on: an account not confirmed yet gets its code screen.
      if ("verificationRequired" in result) return result;
      // Two-step sign-in: the login page catches this and asks for the code.
      if (isTwoFactorChallenge(result)) throw new TwoFactorRequiredError(result);
      // An API from before soft confirmation hands out tokens to a
      // `pending_verification` account that its `authenticate` middleware
      // then rejects (it requires `status === "active"`), and so does
      // `/auth/refresh`. Entering the "authenticated" state would bounce
      // straight back to /login; stop with a clear message instead. The
      // current API lets such an account in, active.
      if (result.user.status !== "active") {
        apiClient.clearSession();
        throw new ApiError(
          "Please verify your email address before signing in — check your inbox for the verification link.",
          403,
          "ACCOUNT_INACTIVE"
        );
      }
      await loadUser();
      return null;
    }

    return {
      user,
      status,
      needsPlan,
      confirmed,
      login,
      async register(payload) {
        const result = await apiClient.register(payload);
        if ("verificationRequired" in result) return result;
        if (result.emailCode?.sent) {
          noteCodeSent({
            target: result.emailCode.target,
            expiresAt: result.emailCode.expiresAt,
            resendAvailableAt: result.emailCode.resendAvailableAt,
          });
        }
        // The account is signed in with the tokens it came back with; an API
        // from before that returns none is signed in with the same details.
        if (result.accessToken) await loadUser();
        else await login({ identifier: payload.email, password: payload.password, locale: payload.locale });
        return null;
      },
      async logout() {
        // This browser stops receiving the account's device notifications first
        // (a moment at most; nothing while VITE_PUSH_ENABLED is off).
        await leavePushOnSignOut();
        // Signed out here even when the server can't be told: the client has
        // already dropped the tokens (ApiClient.logout).
        try {
          await apiClient.logout();
        } finally {
          setUser(null);
          setNeedsPlan(false);
          setConfirmed(true);
          setStatus("guest");
        }
      },
      async signOutEverywhere() {
        // A guest only once the server has ended the sessions: a failure
        // leaves this device signed in, and the screen says it did not work.
        await apiClient.signOutEverywhere();
        await leavePushOnSignOut();
        setUser(null);
        setNeedsPlan(false);
        setConfirmed(true);
        setStatus("guest");
      },
      refreshUser: loadUser,
      retry,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, status, needsPlan, confirmed, retry]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export { ApiError };
