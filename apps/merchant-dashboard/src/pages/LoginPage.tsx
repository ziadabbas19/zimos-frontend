import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Alert } from "@store-builder/ui";
import { useAuth, ApiError } from "@/context/AuthContext";
import { apiBaseUrl, apiClient } from "@/lib/apiClient";
import { VerifyCodePanel } from "@/components/VerifyCodePanel";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { TwoFactorRequiredError, type TwoFactorChallenge, type VerificationChallenge } from "@store-builder/api-client";
import { TwoFactorStep } from "@/components/TwoFactorStep";
import { TWO_FACTOR_ENABLED } from "@/lib/features";
import { AUTH_SUBMIT, AuthDivider, AuthField, AuthFooter, AuthHeading, AuthLink, AuthPasswordField, AuthShell, GoogleMark } from "./AuthShell";

const STRINGS = {
  en: {
    title: "Welcome back",
    subtitle: "Sign in to manage your store.",
    google: "Continue with Google",
    or: "or",
    identifier: "Email or username",
    identifierPlaceholder: "you@example.com",
    password: "Password",
    forgot: "Forgot password?",
    show: "Show password",
    hide: "Hide password",
    signIn: "Sign in",
    signingIn: "Signing in…",
    newHere: "New to Zimos?",
    create: "Create an account",
    wrong: "Incorrect email, username or password.",
    generic: "Something went wrong. Please try again.",
    linkMissing: "Can't find the confirmation email?",
    resend: "Send it again",
    resending: "Sending…",
    resent: "If an account uses this email, a new confirmation email is on its way.",
    resendFailed: "The email couldn't be sent. Try again.",
  },
  ar: {
    title: "مرحبًا بعودتك",
    subtitle: "سجّل الدخول لإدارة متجرك.",
    google: "المتابعة بحساب جوجل",
    or: "أو",
    identifier: "البريد الإلكتروني أو اسم المستخدم",
    identifierPlaceholder: "you@example.com",
    password: "كلمة المرور",
    forgot: "نسيت كلمة المرور؟",
    show: "إظهار كلمة المرور",
    hide: "إخفاء كلمة المرور",
    signIn: "تسجيل الدخول",
    signingIn: "جارٍ تسجيل الدخول…",
    newHere: "جديد على Zimos؟",
    create: "أنشئ حسابًا",
    wrong: "البريد الإلكتروني أو اسم المستخدم أو كلمة المرور غير صحيحة.",
    generic: "حدث خطأ ما. حاول مرة أخرى.",
    linkMissing: "لم تجد رسالة التأكيد؟",
    resend: "أعد إرسالها",
    resending: "جارٍ الإرسال…",
    resent: "إذا كان هناك حساب بهذا البريد الإلكتروني، فستصلك رسالة تأكيد جديدة خلال دقائق.",
    resendFailed: "تعذّر إرسال الرسالة. حاول مرة أخرى.",
  },
} satisfies Messages;

export function LoginPage() {
  const t = useT(STRINGS);
  const { login, refreshUser } = useAuth();
  const { locale } = useLocale();
  // An account that still has to confirm its sign-up code gets the code
  // screen here instead of being signed in.
  const [challenge, setChallenge] = useState<VerificationChallenge | null>(null);
  // An account with two-step sign-in, or a browser new to it, is asked for a
  // code before it is signed in (TWO_FACTOR_ENABLED).
  const [twoFactor, setTwoFactor] = useState<TwoFactorChallenge | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  // Back where the visitor was sent from, its query included (the invite
  // page's ?token=, pages/InviteAcceptPage).
  const fromLocation = (location.state as { from?: Location })?.from;
  const from = fromLocation?.pathname ? `${fromLocation.pathname}${fromLocation.search ?? ""}` : "/";

  // The email or the username, as typed; the server tells them apart.
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Only an API from before soft confirmation refuses a `pending_verification`
  // account (ACCOUNT_INACTIVE); the confirmation link can then be sent again,
  // when what was typed is an email.
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const typedEmail = identifier.includes("@") ? identifier.trim() : "";

  function handleGoogleLogin() {
    window.location.href = `${apiBaseUrl}/auth/google`;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNeedsVerification(false);
    setResent(false);
    setSubmitting(true);
    try {
      const pending = await login({ identifier: identifier.trim(), password, locale });
      if (pending) {
        setChallenge(pending);
        return;
      }
      navigate(from, { replace: true });
    } catch (err) {
      if (TWO_FACTOR_ENABLED && err instanceof TwoFactorRequiredError) {
        setTwoFactor(err.challenge);
        return;
      }
      if (err instanceof ApiError) {
        setError(err.status === 401 ? t.wrong : err.message);
        if (err.code === "ACCOUNT_INACTIVE") setNeedsVerification(true);
      } else {
        setError(t.generic);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendVerification() {
    setResending(true);
    try {
      await apiClient.resendVerification(typedEmail);
      // Like the password-reset request: a resolved call only means "show the
      // notice"; it doesn't confirm the address exists. `resent` hides the
      // button for the rest of this page load, so it can't be spammed.
      setResent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.resendFailed);
    } finally {
      setResending(false);
    }
  }

  if (twoFactor) {
    return (
      <AuthShell>
        <TwoFactorStep
          challenge={twoFactor}
          onBack={() => {
            setTwoFactor(null);
            setPassword("");
          }}
          onVerified={async () => {
            await refreshUser();
            navigate(from, { replace: true });
          }}
        />
      </AuthShell>
    );
  }

  if (challenge) {
    return (
      <AuthShell>
        <VerifyCodePanel
          challenge={challenge}
          onVerified={async () => {
            await refreshUser();
            navigate(from, { replace: true });
          }}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthHeading title={t.title}>{t.subtitle}</AuthHeading>

      <div className="mt-6">
        <Button type="button" variant="outline" className="min-h-12 w-full text-base" onClick={handleGoogleLogin}>
          <GoogleMark />
          {t.google}
        </Button>
        <AuthDivider>{t.or}</AuthDivider>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="danger" role="alert">
            {error}
          </Alert>
        )}

        {needsVerification &&
          typedEmail &&
          (resent ? (
            <Alert variant="success">{t.resent}</Alert>
          ) : (
            <div className="text-sm text-ink-soft">
              {t.linkMissing}{" "}
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-sm"
                onClick={handleResendVerification}
                disabled={resending}
              >
                {resending ? t.resending : t.resend}
              </Button>
            </div>
          ))}

        <AuthField
          label={t.identifier}
          fieldId="identifier"
          name="username"
          type="text"
          dir="ltr"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder={t.identifierPlaceholder}
        />

        <AuthPasswordField
          label={t.password}
          fieldId="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          labelEnd={
            <AuthLink to="/forgot-password" className="min-h-6 text-xs">
              {t.forgot}
            </AuthLink>
          }
        />

        <Button type="submit" className={AUTH_SUBMIT} disabled={submitting}>
          {submitting ? t.signingIn : t.signIn}
        </Button>
      </form>

      <AuthFooter>
        {t.newHere}
        <AuthLink to="/register">{t.create}</AuthLink>
      </AuthFooter>
    </AuthShell>
  );
}
