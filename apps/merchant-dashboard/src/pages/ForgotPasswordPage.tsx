import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button, Input, Label, Alert } from "@store-builder/ui";
import { ApiError } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { BrandPanel } from "@/components/BrandPanel";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiClient.requestPasswordReset(email);
      // The backend returns the same response whether or not the address is
      // registered, so any resolved call just means "show the notice".
      setSent(true);
    } catch (err) {
      // Only a genuine server-side failure lands here (the endpoint never
      // rejects a merely-unknown email) — surface it and let them retry.
      setError(
        err instanceof ApiError ? err.message : "حصل خطأ غير متوقع، حاول تاني بعد شوية."
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
          <h2 className="font-display text-3xl font-medium text-ink">Reset your password</h2>

          {sent ? (
            <>
              <Alert variant="success" className="mt-6">
                لو الإيميل ده مسجل عندنا، هيوصلك لينك تعيين باسورد جديد خلال دقايق.
              </Alert>
              <Link
                to="/login"
                className="mt-6 inline-block text-sm font-medium text-primary hover:underline"
              >
                ← Back to sign in
              </Link>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-ink-soft">
                اكتب إيميلك وهنبعتلك لينك تعيّن منه باسورد جديد.
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                {error && <Alert variant="danger">{error}</Alert>}

                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "جارٍ الإرسال…" : "Send reset link"}
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
