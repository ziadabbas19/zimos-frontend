import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button, Input, Label, Alert } from "@store-builder/ui";
import { ApiError } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { BrandPanel } from "@/components/BrandPanel";

const MIN_PASSWORD_LENGTH = 8;

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // The emailed link is /reset-password?token=xxx — the token rides in a query
  // param named exactly `token`.
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // On success, bounce to the login page after a short beat. The manual button
  // below covers the case where the timer is missed (tab backgrounded, etc.).
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => navigate("/login", { replace: true }), 2000);
    return () => clearTimeout(timer);
  }, [done, navigate]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError("الباسورد لازم يكون 8 أحرف على الأقل.");
      return;
    }
    if (password !== confirm) {
      setError("الباسورد وتأكيده مش زي بعض.");
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      // Keep the form mounted so they can fix a typo or go request a fresh link.
      setError(
        err instanceof ApiError ? err.message : "تعذّر تغيير الباسورد، حاول تاني."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <BrandPanel />
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-3xl font-medium text-ink">Set a new password</h2>

          {!token ? (
            <>
              <Alert variant="danger" className="mt-6">
                الرابط غير صالح. يمكن يكون ناقص أو اتنسخ غلط.
              </Alert>
              <Link
                to="/forgot-password"
                className="mt-6 inline-block text-sm font-medium text-primary hover:underline"
              >
                اطلب لينك جديد
              </Link>
            </>
          ) : done ? (
            <>
              <Alert variant="success" className="mt-6">
                تم تغيير الباسورد بنجاح. هنحوّلك لتسجيل الدخول…
              </Alert>
              <Button
                type="button"
                className="mt-6 w-full"
                onClick={() => navigate("/login", { replace: true })}
              >
                تسجيل الدخول
              </Button>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-ink-soft">اختار باسورد جديد لحسابك.</p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                {error && <Alert variant="danger">{error}</Alert>}

                <div className="space-y-1.5">
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm">Confirm password</Label>
                  <Input
                    id="confirm"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "جارٍ الحفظ…" : "Save new password"}
                </Button>
              </form>

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
