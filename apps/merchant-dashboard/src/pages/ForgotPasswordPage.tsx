import { useState, type FormEvent } from "react";
import { Button, Alert } from "@store-builder/ui";
import { ApiError } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { AUTH_SUBMIT, AuthField, AuthHeading, AuthLink, AuthShell } from "./AuthShell";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Reset your password",
    intro: "Enter your account's email and we'll send you a link to set a new password.",
    email: "Email",
    send: "Send reset link",
    sending: "Sending…",
    sent: "If an account uses this email, a link to set a new password is on its way. It's valid for 30 minutes and works once.",
    spam: "Can't find it? Check your spam folder.",
    back: "Back to sign in",
    tooMany: "Too many requests from here. Try again in an hour.",
    unavailable: "Password reset isn't available right now. Try again later.",
    generic: "Something went wrong. Try again.",
  },
  ar: {
    title: "إعادة تعيين كلمة المرور",
    intro: "أدخل البريد الإلكتروني لحسابك وسنرسل إليك رابطًا لتعيين كلمة مرور جديدة.",
    email: "البريد الإلكتروني",
    send: "إرسال رابط إعادة التعيين",
    sending: "جارٍ الإرسال…",
    sent: "إذا كان هناك حساب بهذا البريد الإلكتروني، فسيصلك رابط لتعيين كلمة مرور جديدة. الرابط صالح لمدة 30 دقيقة ولمرة واحدة فقط.",
    spam: "لم تجده؟ ابحث في مجلد الرسائل غير المرغوب فيها.",
    back: "العودة إلى تسجيل الدخول",
    tooMany: "طلبات كثيرة من هذا الجهاز. حاول مرة أخرى بعد ساعة.",
    unavailable: "إعادة تعيين كلمة المرور غير متاحة الآن. حاول مرة أخرى لاحقًا.",
    generic: "حدث خطأ ما. حاول مرة أخرى.",
  },
} satisfies Messages;

/**
 * "Forgot password": the email gets a link to set a new password. The server
 * answers the same whether or not the address has an account, so a success
 * only means "show the notice" — the page never says whether it exists.
 */
export function ForgotPasswordPage() {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiClient.requestPasswordReset(email.trim(), locale);
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) setError(t.tooMany);
      else if (err instanceof ApiError && err.code === "PASSWORD_RESET_UNAVAILABLE") setError(t.unavailable);
      else setError(t.generic);
    } finally {
      setSubmitting(false);
    }
  }

  const back = (
    <AuthLink to="/login" back className="mt-4">
      {t.back}
    </AuthLink>
  );

  return (
    <AuthShell side>
      {sent ? (
        <>
          <AuthHeading title={t.title} />
          <Alert variant="success" className="mt-6" role="status">
            {t.sent}
          </Alert>
          <p className="mt-3 text-xs text-ink-soft">{t.spam}</p>
          {back}
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

            <AuthField
              label={t.email}
              fieldId="email"
              type="email"
              inputMode="email"
              dir="ltr"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="send"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />

            <Button type="submit" className={AUTH_SUBMIT} disabled={submitting}>
              {submitting ? t.sending : t.send}
            </Button>
          </form>

          {back}
        </>
      )}
    </AuthShell>
  );
}
