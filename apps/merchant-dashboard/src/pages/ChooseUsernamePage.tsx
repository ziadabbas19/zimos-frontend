import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert, Button } from "@store-builder/ui";
import { isApiErrorCode } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { UsernameField } from "@/components/UsernameField";
import { useErrorMessage } from "@/lib/errorMessages";
import { normalizeUsername, usernameSubmittable, type UsernameStatus } from "@/lib/username";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { AUTH_SUBMIT, AuthHeading, AuthShell } from "./AuthShell";

const STRINGS = {
  en: {
    title: "Choose your username",
    body: "Your account needs one before you go on. We suggested a name — keep it or write your own.",
    save: "Continue",
    saving: "Saving…",
    chooseAvailable: "Choose a username that is free first.",
    taken: "Someone just took this username. Choose another one.",
  },
  ar: {
    title: "اختر اسم المستخدم",
    body: "يحتاج حسابك إلى اسم مستخدم قبل المتابعة. اقترحنا اسمًا — احتفظ به أو اختر اسمك.",
    save: "متابعة",
    saving: "جارٍ الحفظ…",
    chooseAvailable: "اختر اسم مستخدم متاحًا أولًا.",
    taken: "استخدم شخص آخر هذا الاسم للتو. اختر اسمًا آخر.",
  },
} satisfies Messages;

const FIELD = "choose-username";

/**
 * The step an account made through Google goes through before the dashboard:
 * it has no username yet (ProtectedRoute sends it here). The field starts
 * with the server's suggestion, made from the email.
 */
export function ChooseUsernamePage() {
  const t = useT(STRINGS);
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const errorMessage = useErrorMessage();
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<UsernameStatus>("idle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/workspaces";

  // Already has one (another tab chose it): nothing to do here.
  useEffect(() => {
    if (user?.username) navigate(from, { replace: true });
  }, [user?.username, from, navigate]);

  useEffect(() => {
    let cancelled = false;
    apiClient.getUsernameSuggestion().then(
      (suggestion) => {
        if (!cancelled && suggestion) setUsername((current) => current || suggestion);
      },
      () => undefined
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // The problem is said under the field, and the cursor goes back into it.
  function fail(message: string) {
    setError(message);
    window.setTimeout(() => document.getElementById(FIELD)?.querySelector("input")?.focus(), 0);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!usernameSubmittable(status)) {
      fail(t.chooseAvailable);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiClient.changeUsername(normalizeUsername(username));
      await refreshUser();
      navigate(from, { replace: true });
    } catch (err) {
      if (isApiErrorCode(err, "USERNAME_TAKEN")) fail(t.taken);
      else setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const underField = error === t.chooseAvailable || error === t.taken;

  return (
    <AuthShell>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <AuthHeading title={t.title}>{t.body}</AuthHeading>
        {error && !underField && <Alert variant="danger">{error}</Alert>}
        <div id={FIELD} className="space-y-1.5">
          <UsernameField
            value={username}
            onChange={(value) => {
              setUsername(value);
              if (underField) setError(null);
            }}
            onStatus={setStatus}
            autoFocus
            disabled={saving}
          />
          {error && underField && (
            <p role="alert" className="text-[13px] leading-5 font-medium text-danger">
              {error}
            </p>
          )}
        </div>
        <Button type="submit" className={AUTH_SUBMIT} disabled={saving}>
          {saving ? t.saving : t.save}
        </Button>
      </form>
    </AuthShell>
  );
}
