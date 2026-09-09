import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError, type AuthUser, type LoginPayload, type RegisterPayload } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";

interface AuthContextValue {
  user: AuthUser | null;
  status: "loading" | "authenticated" | "guest";
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");

  const loadUser = async () => {
    if (!apiClient.isAuthenticated()) {
      setUser(null);
      setStatus("guest");
      return;
    }
    try {
      const me = await apiClient.me();
      setUser(me);
      setStatus("authenticated");
    } catch {
      setUser(null);
      setStatus("guest");
    }
  };

  useEffect(() => {
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      async login(payload) {
        const result = await apiClient.login(payload);
        // The backend hands out tokens to a `pending_verification` account, but
        // its `authenticate` middleware rejects those same tokens on every
        // protected endpoint (it requires `status === "active"`), and so does
        // `/auth/refresh`. If we entered the "authenticated" state here, the
        // first workspace fetch would 401 → the api-client would treat it as a
        // dead session, wipe the freshly-issued tokens and bounce back to
        // /login — an unexplained "logged straight back out" loop. Stop with a
        // clear message instead.
        if (result.user.status !== "active") {
          apiClient.clearSession();
          throw new ApiError(
            "Please verify your email address before signing in — check your inbox for the verification link.",
            403,
            "ACCOUNT_INACTIVE"
          );
        }
        setUser(result.user);
        setStatus("authenticated");
      },
      async register(payload) {
        await apiClient.register(payload);
      },
      async logout() {
        await apiClient.logout();
        setUser(null);
        setStatus("guest");
      },
      refreshUser: loadUser,
    }),
    [user, status]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export { ApiError };
