import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Button, ZLoader } from "@store-builder/ui";
import { acceptInvite, getInvite, isApiErrorCode, type InviteDetails } from "@store-builder/api-client";
import { IconLinkOff, IconVerified } from "@/components/icons";
import { useAuth, ApiError } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { apiBaseUrl, apiClient } from "@/lib/apiClient";
import { clearPendingInvite, isInviteToken, readPendingInvite, rememberPendingInvite } from "@/lib/pendingInvite";
import { useLocale, useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { AUTH_SUBMIT, AuthBusy, AuthDivider, AuthHeading, AuthLink, AuthShell, GoogleMark } from "./AuthShell";

const STRINGS = {
  en: {
    loading: "Opening the invitation…",
    title: "Join {store}",
    asRole: "You're invited as {role}.",
    sentTo: "The invitation was sent to {email}.",
    accept: "Accept the invitation",
    accepting: "Joining…",
    signIn: "I have an account — sign in",
    signUp: "Create an account",
    google: "Continue with Google",
    or: "or",
    useSameEmail: "Use {email} to sign in or sign up.",
    otherAccountTitle: "You're signed in with another account",
    otherAccount: "You're signed in as {current}, but the invitation was sent to {email}. Sign out, then sign in or sign up with {email}.",
    signOut: "Sign out",
    noTokenTitle: "This invitation link is incomplete",
    noToken: "Open the link from the invitation email again. If it came from an older email, ask the store to send the invitation again.",
    invalidTitle: "This invitation link isn't valid",
    invalid: "It may have been replaced by a newer invitation. Use the latest email, or ask the store to send it again.",
    expiredTitle: "This invitation has expired",
    expired: "Ask the store owner to send you the invitation again.",
    acceptedTitle: "This invitation was already accepted",
    accepted: "Sign in to open the store.",
    openStores: "Open my stores",
    alreadyMember: "You're already a member of this store.",
    failed: "Couldn't accept the invitation. Try again in a moment.",
    loadFailed: "Couldn't open the invitation. Check your connection and try again.",
    retry: "Try again",
    back: "Back to sign in",
  },
  ar: {
    loading: "جارٍ فتح الدعوة…",
    title: "انضم إلى {store}",
    asRole: "دُعيت بدور {role}.",
    sentTo: "أُرسلت الدعوة إلى {email}.",
    accept: "قبول الدعوة",
    accepting: "جارٍ الانضمام…",
    signIn: "لدي حساب — تسجيل الدخول",
    signUp: "إنشاء حساب",
    google: "المتابعة بحساب جوجل",
    or: "أو",
    useSameEmail: "استخدم {email} لتسجيل الدخول أو إنشاء الحساب.",
    otherAccountTitle: "أنت مسجّل الدخول بحساب آخر",
    otherAccount: "أنت مسجّل الدخول باسم {current}، لكن الدعوة أُرسلت إلى {email}. سجّل الخروج، ثم سجّل الدخول أو أنشئ حسابًا بالبريد {email}.",
    signOut: "تسجيل الخروج",
    noTokenTitle: "رابط الدعوة غير مكتمل",
    noToken: "افتح الرابط من رسالة الدعوة مرة أخرى. وإذا كانت رسالة قديمة فاطلب من المتجر إرسال الدعوة من جديد.",
    invalidTitle: "رابط الدعوة غير صالح",
    invalid: "ربما استُبدل بدعوة أحدث. استخدم آخر رسالة وصلتك، أو اطلب من المتجر إرسالها من جديد.",
    expiredTitle: "انتهت صلاحية هذه الدعوة",
    expired: "اطلب من صاحب المتجر إرسال الدعوة إليك من جديد.",
    acceptedTitle: "قُبلت هذه الدعوة من قبل",
    accepted: "سجّل الدخول لفتح المتجر.",
    openStores: "فتح متاجري",
    alreadyMember: "أنت عضو في هذا المتجر بالفعل.",
    failed: "تعذّر قبول الدعوة. حاول مرة أخرى بعد قليل.",
    loadFailed: "تعذّر فتح الدعوة. تحقّق من اتصالك وحاول مرة أخرى.",
    retry: "حاول مرة أخرى",
    back: "العودة إلى تسجيل الدخول",
  },
} satisfies Messages;

/** The six system roles by key (core/security/permissions.js); a custom role keeps its own name. */
const ROLE_LABELS = {
  en: {
    owner: "Owner",
    workspace_manager: "Store manager",
    editor: "Editor",
    order_operator: "Order operator",
    confirmation_agent: "Confirmation agent",
    accountant: "Accountant",
  },
  ar: {
    owner: "المالك",
    workspace_manager: "مدير المتجر",
    editor: "المحرر",
    order_operator: "مسؤول الطلبات",
    confirmation_agent: "موظف التأكيد",
    accountant: "المحاسب",
  },
} as const;

const sameEmail = (a: string | null | undefined, b: string | null | undefined) =>
  Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());

type LoadState = { kind: "loading" } | { kind: "ready"; invite: InviteDetails } | { kind: "invalid" } | { kind: "failed" };

/**
 * The link in a team invite email: /invites?token=… (backend
 * workspaces/inviteAcceptance.js). Shows the store and the role to anyone;
 * the invitee signs in, signs up or continues with Google using the invited
 * address, comes back here (lib/pendingInvite), and the invite is accepted on
 * its own. Someone already signed in with that address accepts with a press.
 */
export function InviteAcceptPage() {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const [params] = useSearchParams();
  const token = params.get("token");
  const validToken = isInviteToken(token);
  const navigate = useNavigate();
  const { status, user, logout } = useAuth();
  const { refresh, selectWorkspace } = useWorkspace();

  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const autoTried = useRef(false);

  useEffect(() => {
    if (!validToken) return;
    let cancelled = false;
    getInvite(apiClient, token)
      .then((invite) => {
        if (cancelled) return;
        setLoad({ kind: "ready", invite });
        if (invite.state !== "pending") clearPendingInvite();
      })
      .catch((err) => {
        if (cancelled) return;
        if (isApiErrorCode(err, "INVITE_INVALID")) {
          clearPendingInvite();
          setLoad({ kind: "invalid" });
        } else {
          setLoad({ kind: "failed" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, validToken, attempt]);

  const invite = load.kind === "ready" ? load.invite : null;
  const signedIn = status === "authenticated" && Boolean(user);
  const matches = signedIn && invite?.state === "pending" && sameEmail(user?.email, invite.email);

  async function accept() {
    if (!validToken) return;
    setAccepting(true);
    setAcceptError(null);
    try {
      const joined = await acceptInvite(apiClient, token);
      clearPendingInvite();
      await refresh({ silent: true });
      selectWorkspace(joined.workspace.id);
      navigate("/", { replace: true });
    } catch (err) {
      if (isApiErrorCode(err, "INVITE_ALREADY_ACCEPTED") || isApiErrorCode(err, "INVITE_EXPIRED") || isApiErrorCode(err, "INVITE_INVALID")) {
        // The state changed since the page loaded: read it again.
        clearPendingInvite();
        setAttempt((n) => n + 1);
      } else if (isApiErrorCode(err, "ALREADY_MEMBER")) {
        clearPendingInvite();
        setAcceptError(t.alreadyMember);
      } else {
        setAcceptError(err instanceof ApiError && err.message ? err.message : t.failed);
      }
    } finally {
      setAccepting(false);
    }
  }

  // Back from signing in or signing up that started on this page: accept at
  // once, as the invitee already chose to join.
  useEffect(() => {
    if (!matches || autoTried.current || !validToken) return;
    if (readPendingInvite()?.token !== token) return;
    autoTried.current = true;
    void accept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, token, validToken]);

  function leaveFor(path: string) {
    if (!validToken || !invite) return;
    rememberPendingInvite({ token, email: invite.email });
    if (path === "/login") navigate("/login", { state: { from: { pathname: "/invites", search: `?token=${token}` } } });
    else navigate(path);
  }

  function continueWithGoogle() {
    if (!validToken || !invite) return;
    rememberPendingInvite({ token, email: invite.email });
    window.location.href = `${apiBaseUrl}/auth/google`;
  }

  if (!validToken) {
    return (
      <Problem title={t.noTokenTitle} body={t.noToken}>
        <AuthLink to="/login" back className="mt-3">
          {t.back}
        </AuthLink>
      </Problem>
    );
  }

  if (load.kind === "loading" || status === "loading") {
    return (
      <AuthShell>
        <AuthBusy>{t.loading}</AuthBusy>
      </AuthShell>
    );
  }

  if (load.kind === "failed") {
    return (
      <Problem title={t.invalidTitle} body={t.loadFailed}>
        <Button className={`mt-6 ${AUTH_SUBMIT}`} onClick={() => setAttempt((n) => n + 1)}>
          {t.retry}
        </Button>
      </Problem>
    );
  }

  if (load.kind === "invalid") return <Problem title={t.invalidTitle} body={t.invalid} />;

  const ready = load.invite;
  if (ready.state === "expired") return <Problem title={t.expiredTitle} body={t.expired} />;
  if (ready.state === "accepted") {
    return (
      <AuthShell>
        <AuthHeading title={t.acceptedTitle} icon={<IconVerified aria-hidden />} tone="success">
          {t.accepted}
        </AuthHeading>
        <Button asChild className={`mt-6 ${AUTH_SUBMIT}`}>
          <Link to={signedIn ? "/workspaces" : "/login"}>{t.openStores}</Link>
        </Button>
      </AuthShell>
    );
  }

  const labels = ROLE_LABELS[locale === "ar" ? "ar" : "en"];
  const roleLabel = (labels as Record<string, string>)[ready.role.key] ?? ready.role.name;
  const email = ready.email ?? "";

  return (
    <AuthShell>
      <AuthHeading title={fmt(t.title, { store: ready.workspace.name })}>{fmt(t.asRole, { role: roleLabel })}</AuthHeading>
      {email && (
        <p className="mt-2 text-sm text-ink-soft">
          {fmt(t.sentTo, { email })}
        </p>
      )}

      {acceptError && (
        <Alert variant="danger" className="mt-4">
          {acceptError}
        </Alert>
      )}

      {signedIn && matches ? (
        <Button className={`mt-6 ${AUTH_SUBMIT}`} onClick={() => void accept()} disabled={accepting}>
          {accepting ? <ZLoader size="sm" /> : null}
          {accepting ? t.accepting : t.accept}
        </Button>
      ) : signedIn ? (
        <div className="mt-6">
          <Alert variant="default">
            <p className="font-medium">{t.otherAccountTitle}</p>
            <p className="mt-1">{fmt(t.otherAccount, { current: user?.email ?? "", email })}</p>
          </Alert>
          <Button variant="secondary" className={`mt-4 ${AUTH_SUBMIT}`} onClick={() => void logout()}>
            {t.signOut}
          </Button>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {email && <p className="text-sm text-ink-soft">{fmt(t.useSameEmail, { email })}</p>}
          <Button className={AUTH_SUBMIT} onClick={() => leaveFor("/login")}>
            {t.signIn}
          </Button>
          <Button variant="secondary" className={AUTH_SUBMIT} onClick={() => leaveFor("/register")}>
            {t.signUp}
          </Button>
          <AuthDivider>{t.or}</AuthDivider>
          <Button variant="secondary" className={AUTH_SUBMIT} onClick={continueWithGoogle}>
            <GoogleMark />
            {t.google}
          </Button>
        </div>
      )}
    </AuthShell>
  );
}

function Problem({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <AuthShell>
      <AuthHeading title={title} icon={<IconLinkOff aria-hidden />} tone="danger">
        <span role="alert">{body}</span>
      </AuthHeading>
      {children}
    </AuthShell>
  );
}

