import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@store-builder/ui";
import { IconLinkOff, IconVerified } from "@/components/icons";
import { ApiError } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { AUTH_SUBMIT, AuthBusy, AuthHeading, AuthLink, AuthShell } from "./AuthShell";

const STRINGS = {
  en: {
    title: "Confirming your email",
    verifying: "One moment…",
    successTitle: "Your email is confirmed",
    success: "You can sign in now.",
    signIn: "Sign in",
    failedTitle: "We couldn't confirm your email",
    badLink: "This link isn't valid. It may be incomplete or copied wrongly.",
    expired: "This link isn't valid or has expired.",
    hint: "If the link is old or was already used, sign in and ask for a new confirmation email.",
    back: "Back to sign in",
    failed: "Couldn't confirm the email. Try again in a moment.",
  },
  ar: {
    title: "جارٍ تأكيد بريدك الإلكتروني",
    verifying: "لحظة واحدة…",
    successTitle: "تم تأكيد بريدك الإلكتروني",
    success: "يمكنك تسجيل الدخول الآن.",
    signIn: "تسجيل الدخول",
    failedTitle: "تعذّر تأكيد بريدك الإلكتروني",
    badLink: "هذا الرابط غير صالح. قد يكون ناقصًا أو نُسخ بشكل خاطئ.",
    expired: "الرابط غير صالح أو انتهت صلاحيته.",
    hint: "إذا كان الرابط قديمًا أو استُخدم من قبل، سجّل الدخول واطلب رسالة تأكيد جديدة.",
    back: "العودة إلى تسجيل الدخول",
    failed: "تعذّر تأكيد البريد الإلكتروني. حاول مرة أخرى بعد قليل.",
  },
} satisfies Messages;

/**
 * Landing page for the email-verification link the backend sends after
 * registration: `https://app.zimos.co/verify-email?token=<opaque-token>`.
 * We read `token` from the query string (same param name as /reset-password),
 * confirm it against the API once on mount, then show either a success state
 * or an invalid/expired state — both point back to /login, where an expired
 * link can be re-sent.
 */
type VerifyState = "verifying" | "success" | "error";

export function VerifyEmailPage() {
  const t = useT(STRINGS);
  const [searchParams] = useSearchParams();
  // The emailed link is /verify-email?token=xxx — the token rides in a query
  // param named exactly `token` (matches /reset-password).
  const token = searchParams.get("token");

  const [apiState, setApiState] = useState<VerifyState>("verifying");
  // `true` = failed with nothing to quote from the server (network, odd shape).
  const [apiErrorMessage, setApiErrorMessage] = useState<string | true | null>(null);
  // Guard against React's double-invoke in StrictMode firing verifyEmail twice
  // (same pattern as AuthCallbackPage).
  const handled = useRef(false);

  useEffect(() => {
    if (!token || handled.current) return;
    handled.current = true;

    apiClient
      .verifyEmail(token)
      .then(() => setApiState("success"))
      .catch((err) => {
        // A known/used/expired token comes back as an ApiError (assumed code
        // "INVALID_VERIFICATION_TOKEN") — show its message; fall back to a
        // generic line for anything else (network, unexpected shape).
        setApiState("error");
        setApiErrorMessage(err instanceof ApiError ? err.message : true);
      });
  }, [token]);

  // A link with no token has nothing to verify — treat it as an error state
  // without touching the API (mirrors how AuthCallbackPage derives its failure).
  const state: VerifyState = token ? apiState : "error";
  const errorMessage = token ? (apiErrorMessage === true ? t.failed : apiErrorMessage) : t.badLink;

  return (
    <AuthShell>
      {state === "verifying" ? (
        <>
          <AuthHeading title={t.title} center />
          <AuthBusy className="mt-4">{t.verifying}</AuthBusy>
        </>
      ) : state === "success" ? (
        <>
          <AuthHeading title={t.successTitle} icon={<IconVerified aria-hidden />} tone="success">
            {t.success}
          </AuthHeading>
          <Button asChild className={`mt-6 ${AUTH_SUBMIT}`}>
            <Link to="/login">{t.signIn}</Link>
          </Button>
        </>
      ) : (
        <>
          <AuthHeading title={t.failedTitle} icon={<IconLinkOff aria-hidden />} tone="danger">
            <span role="alert">{errorMessage ?? t.expired}</span>
          </AuthHeading>
          <p className="mt-3 text-sm leading-6 text-ink-soft">{t.hint}</p>
          <AuthLink to="/login" back className="mt-3">
            {t.back}
          </AuthLink>
        </>
      )}
    </AuthShell>
  );
}
