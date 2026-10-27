import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button, ZLoader } from "@store-builder/ui";
import { SignOutButton } from "@/components/SignOutButton";
import { PageLoader } from "@/components/DataState";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "We couldn't load your account",
    body: "You're still signed in. The connection to Zimos dropped or the server is busy. Try again in a moment.",
    retry: "Try again",
    signOut: "Sign out",
  },
  ar: {
    title: "تعذّر تحميل حسابك",
    body: "ما زلت مسجّلًا الدخول. انقطع الاتصال بزيموس أو أن الخادم مشغول، فحاول مرة أخرى بعد لحظات.",
    retry: "حاول مرة أخرى",
    signOut: "تسجيل الخروج",
  },
} satisfies Messages;

export function ProtectedRoute() {
  const { status, user, needsPlan } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-paper">
        <PageLoader />
      </div>
    );
  }

  if (status === "guest") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Signed in, but the account couldn't be read (429, a 5xx, offline): the
  // session stays, and the page offers to try again.
  if (status === "unavailable") return <AccountUnavailable />;

  // An account made through Google picks a username before anything else.
  // `username === undefined` is an API from before usernames: let it through.
  if (user && user.username === null && location.pathname !== "/choose-username") {
    return <Navigate to="/choose-username" replace state={{ from: location }} />;
  }

  // Then, while the server requires a plan at sign-up, one made through Google
  // chooses its plan (needsPlan from /auth/me).
  if (user && user.username !== null && needsPlan && location.pathname !== "/choose-plan") {
    return <Navigate to="/choose-plan" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

function AccountUnavailable() {
  const t = useT(STRINGS);
  const { retry } = useAuth();
  const [busy, setBusy] = useState(false);

  async function tryAgain() {
    setBusy(true);
    try {
      await retry();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-4">
      <div role="alert" className="w-full max-w-sm rounded-[var(--radius-card)] border border-line bg-paper-raised p-6 text-center shadow-sm">
        <h1 className="font-display text-lg font-medium text-ink">{t.title}</h1>
        <p className="mt-2 text-sm text-ink-soft">{t.body}</p>
        <div className="mt-5 flex flex-col items-center gap-2">
          <Button onClick={tryAgain} disabled={busy} className="w-full">
            {busy ? <ZLoader size="sm" /> : null}
            {t.retry}
          </Button>
          <SignOutButton className="min-h-11 cursor-pointer text-sm text-ink-soft hover:text-danger hover:underline">{t.signOut}</SignOutButton>
        </div>
      </div>
    </div>
  );
}
