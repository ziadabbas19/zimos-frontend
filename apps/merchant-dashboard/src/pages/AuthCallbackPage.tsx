import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Spinner } from "@store-builder/ui";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { BrandPanel } from "@/components/BrandPanel";

/**
 * Landing page for the Google OAuth flow. After Google approves, the backend
 * redirects here with `?accessToken=...&refreshToken=...` on success or
 * `?error=...` on failure. We persist the tokens, let the auth context pick up
 * the session, then send the merchant to the workspace picker.
 */
export function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const accessToken = searchParams.get("accessToken");
  const refreshToken = searchParams.get("refreshToken");
  // No tokens means the backend sent `?error=...` (or the page was opened
  // directly) — either way the sign-in didn't go through.
  const hasTokens = Boolean(accessToken && refreshToken);

  const [refreshFailed, setRefreshFailed] = useState(false);
  const handled = useRef(false);

  useEffect(() => {
    if (!accessToken || !refreshToken || handled.current) return;
    handled.current = true;

    apiClient.setTokens({ accessToken, refreshToken });
    refreshUser()
      .then(() => navigate("/workspaces", { replace: true }))
      .catch(() => setRefreshFailed(true));
  }, [accessToken, refreshToken, navigate, refreshUser]);

  const failed = !hasTokens || refreshFailed;

  return (
    <div className="flex min-h-screen">
      <BrandPanel />
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm text-center">
          {failed ? (
            <>
              <h2 className="font-display text-2xl font-medium text-ink">
                تعذّر تسجيل الدخول بجوجل
              </h2>
              <p className="mt-3 text-sm text-ink-soft">
                حدث خطأ أثناء تسجيل الدخول بحساب جوجل. من فضلك حاول مرة أخرى.
              </p>
              <Link
                to="/login"
                className="mt-6 inline-block text-sm font-medium text-primary hover:underline"
              >
                ← Back to sign in
              </Link>
            </>
          ) : (
            <div className="flex items-center justify-center gap-3 text-sm text-ink-soft">
              <Spinner className="size-5" />
              <span>جارٍ تسجيل الدخول…</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
