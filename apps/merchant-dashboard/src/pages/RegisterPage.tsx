import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Button, Input, Label, Alert } from "@store-builder/ui";
import { useAuth, ApiError } from "@/context/AuthContext";
import { apiBaseUrl } from "@/lib/apiClient";
import { BrandPanel } from "@/components/BrandPanel";
import { unmetPasswordRules } from "@/lib/passwordRules";

/** Brand-coloured Google "G" — an inline SVG so we don't pull in an icon set. */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" className="shrink-0" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export function RegisterPage() {
  const { register, login } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const unmetRules = unmetPasswordRules(password);

  function handleGoogleLogin() {
    window.location.href = `${apiBaseUrl}/auth/google`;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    // Client-side gate before the API call — the backend enforces the same
    // password rule, so blocking here just spares a round-trip and a raw
    // server error. Typing is never blocked, only submitting.
    if (unmetRules.length > 0) {
      setError("الباسورد لسه ناقص شوية شروط، بصّ على القايمة اللي تحت.");
      return;
    }
    if (password !== confirm) {
      setError("الباسورد وتأكيده مش زي بعض.");
      return;
    }

    setSubmitting(true);
    try {
      await register({ fullName, email, phone: phone || undefined, password });
      // Registration doesn't return tokens (email verification pending on the
      // backend), so we log in immediately with the same credentials to get
      // the merchant straight into the workspace picker.
      await login({ email, password });
      navigate("/workspaces", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <BrandPanel />
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-3xl font-medium text-ink">Create your account</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Start building your store in a few minutes.
          </p>

          <div className="mt-8">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleLogin}
            >
              <GoogleIcon />
              المتابعة بحساب جوجل
            </Button>

            <div className="my-5 flex items-center gap-3 text-xs text-ink-soft">
              <span className="h-px flex-1 bg-line" />
              أو
              <span className="h-px flex-1 bg-line" />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <Alert variant="danger">{error}</Alert>}

            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ahmed Hassan"
              />
            </div>

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

            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01000000000"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="pr-10"
                  aria-describedby="password-rules"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "إخفاء الباسورد" : "إظهار الباسورد"}
                  aria-pressed={showPassword}
                  className="cursor-pointer absolute inset-y-0 right-0 flex items-center px-3 text-ink-soft transition-colors hover:text-ink"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" aria-hidden />
                  ) : (
                    <Eye className="size-4" aria-hidden />
                  )}
                </button>
              </div>
              {password.length > 0 && unmetRules.length > 0 && (
                <ul id="password-rules" className="mt-1 space-y-1 text-xs text-ink-soft">
                  {unmetRules.map((rule) => (
                    <li key={rule.id} className="flex items-center gap-1.5">
                      <span aria-hidden>•</span>
                      {rule.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <div className="relative">
                <Input
                  id="confirm"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? "إخفاء الباسورد" : "إظهار الباسورد"}
                  aria-pressed={showConfirm}
                  className="cursor-pointer absolute inset-y-0 right-0 flex items-center px-3 text-ink-soft transition-colors hover:text-ink"
                >
                  {showConfirm ? (
                    <EyeOff className="size-4" aria-hidden />
                  ) : (
                    <Eye className="size-4" aria-hidden />
                  )}
                </button>
              </div>
              {confirm.length > 0 && password !== confirm && (
                <p className="mt-1 text-xs text-danger">الباسورد وتأكيده مش زي بعض.</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Creating account…" : "Create account"}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-ink-soft">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
