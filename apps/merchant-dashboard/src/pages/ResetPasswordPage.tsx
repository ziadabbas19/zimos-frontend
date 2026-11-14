import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Alert } from "@store-builder/ui";
import { ApiError } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { AUTH_SUBMIT, AuthHeading, AuthLink, AuthPasswordField, AuthRules, AuthShell } from "./AuthShell";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { MIN_PASSWORD_LENGTH, isPasswordStrong, passwordRuleLabel, unmetPasswordRules } from "@/lib/passwordRules";

const STRINGS = {
  en: {
    title: "Set a new password",
    intro: "Choose a new password for your account. You'll be signed out everywhere else.",
    password: "New password",
    passwordPlaceholder: "At least 8 characters",
    confirm: "Confirm password",
    show: "Show password",
    hide: "Hide password",
    save: "Save new password",
    saving: "Saving…",
    rulesUnmet: "The password still misses some of the rules listed below it.",
    mismatch: "The two passwords don't match.",
    invalidLink: "This link isn't valid: it may be incomplete or copied wrongly.",
    expired: "This link has expired or was already used. Ask for a new one.",
    askAgain: "Ask for a new link",
    done: "Your password has been changed. Taking you to sign in…",
    signIn: "Sign in",
    back: "Back to sign in",
    generic: "The password couldn't be changed. Try again.",
  },
  ar: {
    title: "تعيين كلمة مرور جديدة",
    intro: "اختر كلمة مرور جديدة لحسابك. سيُسجَّل خروجك من كل الأجهزة الأخرى.",
    password: "كلمة المرور الجديدة",
    passwordPlaceholder: "8 أحرف على الأقل",
    confirm: "تأكيد كلمة المرور",
    show: "إظهار كلمة المرور",
    hide: "إخفاء كلمة المرور",
    save: "حفظ كلمة المرور الجديدة",
    saving: "جارٍ الحفظ…",
    rulesUnmet: "كلمة المرور لا تستوفي بعد بعض الشروط المذكورة أسفلها.",
    mismatch: "كلمتا المرور غير متطابقتين.",
    invalidLink: "هذا الرابط غير صالح: ربما يكون ناقصًا أو نُسخ بشكل خاطئ.",
    expired: "انتهت صلاحية هذا الرابط أو سبق استخدامه. اطلب رابطًا جديدًا.",
    askAgain: "طلب رابط جديد",
    done: "تم تغيير كلمة المرور. جارٍ نقلك إلى تسجيل الدخول…",
    signIn: "تسجيل الدخول",
    back: "العودة إلى تسجيل الدخول",
    generic: "تعذّر تغيير كلمة المرور. حاول مرة أخرى.",
  },
} satisfies Messages;

/**
 * The page the emailed link opens (/reset-password?token=…): a new password
 * (the same rules as sign-up), then sign in. Works for an account made with
 * Google, which sets its first password here. The server signs the account
 * out everywhere and counts its email as confirmed.
 */
export function ResetPasswordPage() {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // The emailed link is /reset-password?token=xxx.
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [linkDead, setLinkDead] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const unmetRules = unmetPasswordRules(password);

  // On success, on to sign in after a short beat; the button covers a missed timer.
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => navigate("/login", { replace: true }), 2000);
    return () => clearTimeout(timer);
  }, [done, navigate]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setError(null);

    if (!isPasswordStrong(password)) {
      setError(t.rulesUnmet);
      return;
    }
    if (password !== confirm) {
      setError(t.mismatch);
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      // An expired or used link can't be retried: send them for a new one.
      if (err instanceof ApiError && err.code === "INVALID_RESET_TOKEN") setLinkDead(true);
      else setError(t.generic);
    } finally {
      setSubmitting(false);
    }
  }

  const askAgain = (
    <AuthLink to="/forgot-password" className="mt-4">
      {t.askAgain}
    </AuthLink>
  );

  return (
    <AuthShell side>
      {!token ? (
        <>
          <AuthHeading title={t.title} />
          <Alert variant="danger" className="mt-6" role="alert">
            {t.invalidLink}
          </Alert>
          {askAgain}
        </>
      ) : linkDead ? (
        <>
          <AuthHeading title={t.title} />
          <Alert variant="danger" className="mt-6" role="alert">
            {t.expired}
          </Alert>
          {askAgain}
        </>
      ) : done ? (
        <>
          <AuthHeading title={t.title} />
          <Alert variant="success" className="mt-6" role="status">
            {t.done}
          </Alert>
          <Button type="button" className={`mt-6 ${AUTH_SUBMIT}`} onClick={() => navigate("/login", { replace: true })}>
            {t.signIn}
          </Button>
        </>
      ) : (
        <>
          <AuthHeading title={t.title}>{t.intro}</AuthHeading>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && (
              <Alert variant="danger" role="alert">
                {error}
              </Alert>
            )}

            <AuthPasswordField
              label={t.password}
              fieldId="password"
              autoComplete="new-password"
              enterKeyHint="next"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.passwordPlaceholder}
              aria-describedby={password.length > 0 && unmetRules.length > 0 ? "password-rules" : undefined}
            >
              {/* What is still missing, while the password is being typed. */}
              {password.length > 0 && <AuthRules id="password-rules" rules={unmetRules.map((rule) => passwordRuleLabel(rule, locale))} />}
            </AuthPasswordField>

            <AuthPasswordField
              label={t.confirm}
              fieldId="confirm"
              autoComplete="new-password"
              enterKeyHint="done"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              error={confirm.length > 0 && password !== confirm ? t.mismatch : undefined}
            />

            <Button type="submit" className={AUTH_SUBMIT} disabled={submitting}>
              {submitting ? t.saving : t.save}
            </Button>
          </form>

          <AuthLink to="/login" back className="mt-4">
            {t.back}
          </AuthLink>
        </>
      )}
    </AuthShell>
  );
}
