import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Alert, Spinner } from "@store-builder/ui";
import { ApiError } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { BrandPanel } from "@/components/BrandPanel";

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
  const [searchParams] = useSearchParams();
  // The emailed link is /verify-email?token=xxx — the token rides in a query
  // param named exactly `token` (matches /reset-password).
  const token = searchParams.get("token");

  const [apiState, setApiState] = useState<VerifyState>("verifying");
  const [apiErrorMessage, setApiErrorMessage] = useState<string | null>(null);
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
        setApiErrorMessage(
          err instanceof ApiError
            ? err.message
            : "تعذّر تأكيد الإيميل، حاول تاني بعد شوية."
        );
      });
  }, [token]);

  // A link with no token has nothing to verify — treat it as an error state
  // without touching the API (mirrors how AuthCallbackPage derives its failure).
  const state: VerifyState = token ? apiState : "error";
  const errorMessage = token
    ? apiErrorMessage
    : "الرابط غير صالح. يمكن يكون ناقص أو اتنسخ غلط.";

  return (
    <div className="flex min-h-screen">
      <BrandPanel />
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-3xl font-medium text-ink">Verify your email</h2>

          {state === "verifying" ? (
            <div className="mt-8 flex items-center justify-center gap-3 text-sm text-ink-soft">
              <Spinner className="size-5" />
              <span>جارٍ تأكيد الإيميل…</span>
            </div>
          ) : state === "success" ? (
            <>
              <Alert variant="success" className="mt-6">
                تم تأكيد إيميلك بنجاح. تقدر تسجّل الدخول دلوقتي.
              </Alert>
              <Link
                to="/login"
                className="mt-6 inline-block text-sm font-medium text-primary hover:underline"
              >
                تسجيل الدخول
              </Link>
            </>
          ) : (
            <>
              <Alert variant="danger" className="mt-6">
                {errorMessage ?? "الرابط غير صالح أو انتهت صلاحيته."}
              </Alert>
              <p className="mt-4 text-sm text-ink-soft">
                لو اللينك قديم أو استُخدم قبل كده، سجّل الدخول واطلب رسالة تأكيد جديدة.
              </p>
              <Link
                to="/login"
                className="mt-6 inline-block text-sm font-medium text-primary hover:underline"
              >
                ← Back to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
