import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { TwoFactorStep } from "@/components/TwoFactorStep";
import { TWO_FACTOR_ENABLED } from "@/lib/features";
import { AuthBusy, AuthHeading, AuthShell } from "./AuthShell";
import { GoogleCallbackError } from "./auth/GoogleCallbackError";
import { afterSignInPath } from "@/lib/pendingInvite";
import { googleCallbackChallenge } from "./auth/googleCallbackChallenge";

const STRINGS = {
  en: {
    title: "Signing you in",
    signingIn: "One moment…",
  },
  ar: {
    title: "جارٍ تسجيل دخولك",
    signingIn: "لحظة واحدة…",
  },
} satisfies Messages;

/**
 * Landing page for the Google OAuth flow. After Google approves, the backend
 * redirects here with `?accessToken=...&refreshToken=...` on success or
 * `?error=...` on failure. We persist the tokens, let the auth context pick up
 * the session, then send the merchant to the workspace picker.
 */
export function AuthCallbackPage() {
  const t = useT(STRINGS);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const accessToken = searchParams.get("accessToken");
  const refreshToken = searchParams.get("refreshToken");
  // No tokens means the backend sent `?error=...` (or the page was opened
  // directly) — either way the sign-in didn't go through.
  const hasTokens = Boolean(accessToken && refreshToken);

  // An account with two-step sign-in is not signed in yet: it finishes with its code.
  const [challenge] = useState(() => (TWO_FACTOR_ENABLED ? googleCallbackChallenge(searchParams) : null));

  const [refreshFailed, setRefreshFailed] = useState(false);
  const handled = useRef(false);

  useEffect(() => {
    if (!accessToken || !refreshToken || handled.current) return;
    handled.current = true;

    apiClient.setTokens({ accessToken, refreshToken });
    refreshUser()
      .then(() => navigate(afterSignInPath(), { replace: true }))
      .catch(() => setRefreshFailed(true));
  }, [accessToken, refreshToken, navigate, refreshUser]);

  const failed = !hasTokens || refreshFailed;

  if (challenge && !hasTokens) {
    return (
      <AuthShell>
        <TwoFactorStep
          challenge={challenge}
          onBack={() => navigate("/login", { replace: true })}
          onVerified={async () => {
            await refreshUser();
            navigate(afterSignInPath(), { replace: true });
          }}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      {failed ? (
        <GoogleCallbackError code={searchParams.get("error")} />
      ) : (
        <>
          <AuthHeading title={t.title} center />
          <AuthBusy className="mt-4">{t.signingIn}</AuthBusy>
        </>
      )}
    </AuthShell>
  );
}
