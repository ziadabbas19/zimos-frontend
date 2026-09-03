import { Link } from "react-router-dom";
import { BrandPanel } from "@/components/BrandPanel";

export function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen">
      <BrandPanel />
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm text-center">
          <h2 className="font-display text-2xl font-medium text-ink">Password reset</h2>
          <p className="mt-3 text-sm text-ink-soft">
            This flow isn't wired up yet — the backend already supports both
            email and SMS reset, we just need the form here.
          </p>
          <Link to="/login" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
