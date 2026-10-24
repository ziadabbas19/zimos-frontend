import { useId, useState } from "react";
import { Alert, Button, Input, Label } from "@store-builder/ui";
import { apiErrorDetails, isApiErrorCode } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate } from "@/lib/format";
import { normalizeUsername, usernameSubmittable, type UsernameStatus } from "@/lib/username";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { CopyButton } from "@/components/CopyButton";
import { UsernameField } from "@/components/UsernameField";
import { useToast } from "@/components/Toast";
import { useAsync } from "@/lib/useAsync";
import { AccountChangeDialog } from "./AccountChangeDialog";

/** How often a username may be changed (the backend's CHANGE_INTERVAL_DAYS). */
const CHANGE_INTERVAL_DAYS = 30;

const STRINGS = {
  en: {
    title: "Your account",
    description: "Your sign-in details. These belong to you, not to the store.",
    name: "Name",
    email: "Email",
    id: "Account ID",
    idHint: "Support may ask for it to find your account.",
    copyId: "Copy ID",
    save: "Save username",
    saving: "Saving…",
    rule: "You can change your username once every 30 days.",
    nextChange: "You changed your username recently. You can change it again on {date}.",
    saved: "Username saved.",
    taken: "Someone just took this username. Choose another one.",
    chooseAvailable: "Choose an available username first.",
    saveName: "Save name",
    nameSaved: "Name saved.",
    nameInvalid: "The name must be 2 to 200 characters.",
    phone: "Mobile number",
    noPhone: "Not set",
    change: "Change",
    changeEmail: "Change email",
    changePhone: "Change mobile number",
    emailChanged: "Your email is changed. You're signed out on your other devices.",
    phoneChanged: "Your mobile number is changed.",
  },
  ar: {
    title: "حسابك",
    description: "بيانات دخولك. هذه البيانات تخصك أنت، لا المتجر.",
    name: "الاسم",
    email: "البريد الإلكتروني",
    id: "معرّف الحساب",
    idHint: "قد يطلبه فريق الدعم للعثور على حسابك.",
    copyId: "نسخ المعرّف",
    save: "حفظ اسم المستخدم",
    saving: "جارٍ الحفظ…",
    rule: "يمكنك تغيير اسم المستخدم مرة واحدة كل 30 يومًا.",
    nextChange: "غيّرت اسم المستخدم مؤخرًا. يمكنك تغييره مرة أخرى في {date}.",
    saved: "تم حفظ اسم المستخدم.",
    taken: "استخدم شخص آخر هذا الاسم للتو. اختر اسمًا آخر.",
    chooseAvailable: "اختر اسم مستخدم متاحًا أولًا.",
    saveName: "حفظ الاسم",
    nameSaved: "تم حفظ الاسم.",
    nameInvalid: "يجب أن يتراوح الاسم بين 2 و200 حرف.",
    phone: "رقم الموبايل",
    noPhone: "غير محدد",
    change: "تغيير",
    changeEmail: "تغيير البريد الإلكتروني",
    changePhone: "تغيير رقم الموبايل",
    emailChanged: "تم تغيير بريدك الإلكتروني، وسُجّل خروجك من أجهزتك الأخرى.",
    phoneChanged: "تم تغيير رقم الموبايل.",
  },
} satisfies Messages;

export function AccountSection() {
  const t = useT(STRINGS);
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const current = user?.username ?? null;
  const [username, setUsername] = useState(current ?? "");
  const [status, setStatus] = useState<UsernameStatus>("idle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextAt, setNextAt] = useState<string | null>(null);
  // When this card was opened: the 30-day lock is judged against it.
  const [openedAt] = useState(() => Date.now());
  const nameId = useId();
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [changing, setChanging] = useState<"email" | "phone" | null>(null);
  // How a change is confirmed (password, or a code for a Google account) and
  // whether the phone can change (PHONE_CHANGE_ENABLED).
  const details = useAsync(() => apiClient.meDetails(), []);
  const account = details.data?.account ?? { hasPassword: true, phoneChange: false };

  if (!user) return null;

  async function saveName() {
    const next = fullName.replace(/\s+/g, " ").trim();
    if (next.length < 2 || next.length > 200) {
      setNameError(t.nameInvalid);
      return;
    }
    setSavingName(true);
    setNameError(null);
    try {
      await apiClient.changeName(next);
      await refreshUser();
      toast.success(t.nameSaved);
    } catch (err) {
      setNameError(errorMessage(err, { INVALID_NAME: t.nameInvalid }));
    } finally {
      setSavingName(false);
    }
  }

  const changedAt = user.usernameChangedAt ? new Date(user.usernameChangedAt) : null;
  const lockedUntil =
    nextAt ??
    (changedAt && current
      ? new Date(changedAt.getTime() + CHANGE_INTERVAL_DAYS * 86_400_000).toISOString()
      : null);
  const locked = Boolean(lockedUntil && new Date(lockedUntil).getTime() > openedAt);
  const dirty = normalizeUsername(username) !== (current ?? "");

  async function save() {
    if (!usernameSubmittable(status)) {
      setError(t.chooseAvailable);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiClient.changeUsername(normalizeUsername(username));
      await refreshUser();
      toast.success(t.saved);
    } catch (err) {
      if (isApiErrorCode(err, "USERNAME_CHANGE_TOO_SOON")) {
        setNextAt(apiErrorDetails<{ nextChangeAt: string }>(err)?.nextChangeAt ?? null);
      } else {
        setError(isApiErrorCode(err, "USERNAME_TAKEN") ? t.taken : errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-line p-5">
      <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t.description}</p>

      <div className="mt-4 max-w-md space-y-1.5">
        <Label htmlFor={nameId}>{t.name}</Label>
        <div className="flex flex-wrap gap-2">
          <Input id={nameId} value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={200} className="min-h-11 flex-1" />
          <Button
            variant="outline"
            className="min-h-11"
            disabled={savingName || fullName.trim() === user.fullName}
            onClick={() => void saveName()}
          >
            {savingName ? t.saving : t.saveName}
          </Button>
        </div>
        {nameError && <Alert variant="danger">{nameError}</Alert>}
      </div>

      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <div data-search-anchor="account-email">
          <dt className="text-ink-soft">{t.email}</dt>
          <dd className="mt-0.5 flex flex-wrap items-center gap-2 font-medium text-ink">
            <bdi dir="ltr" className="break-all">
              {user.email}
            </bdi>
            <Button size="sm" variant="outline" className="min-h-9" aria-label={t.changeEmail} onClick={() => setChanging("email")}>
              {t.change}
            </Button>
          </dd>
        </div>
        <div data-search-anchor="account-phone">
          <dt className="text-ink-soft">{t.phone}</dt>
          <dd className="mt-0.5 flex flex-wrap items-center gap-2 font-medium text-ink">
            {user.phone ? <bdi dir="ltr">{user.phone}</bdi> : <span className="text-ink-soft">{t.noPhone}</span>}
            {account.phoneChange && (
              <Button size="sm" variant="outline" className="min-h-9" aria-label={t.changePhone} onClick={() => setChanging("phone")}>
                {t.change}
              </Button>
            )}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-ink-soft">{t.id}</dt>
          <dd className="mt-0.5 flex flex-wrap items-center gap-2">
            <code dir="ltr" className="break-all rounded bg-paper px-2 py-1 font-mono text-xs text-ink">
              {user.id}
            </code>
            <CopyButton value={user.id} label={t.copyId} />
          </dd>
          <p className="mt-1 text-xs text-ink-soft">{t.idHint}</p>
        </div>
      </dl>

      <div className="mt-5 max-w-md space-y-3" data-search-anchor="username">
        <UsernameField value={username} onChange={setUsername} onStatus={setStatus} current={current} disabled={locked || saving} />
        <p className="text-xs text-ink-soft">
          {locked && lockedUntil ? fmt(t.nextChange, { date: formatDate(lockedUntil) }) : t.rule}
        </p>
        {error && <Alert variant="danger">{error}</Alert>}
        {!locked && (
          <Button className="min-h-11" disabled={saving || !dirty} onClick={() => void save()}>
            {saving ? t.saving : t.save}
          </Button>
        )}
      </div>

      <AccountChangeDialog
        kind={changing ?? "email"}
        open={changing !== null}
        email={user.email}
        hasPassword={account.hasPassword}
        onClose={() => setChanging(null)}
        onChanged={async () => {
          const kind = changing;
          await refreshUser();
          toast.success(kind === "phone" ? t.phoneChanged : t.emailChanged);
        }}
      />
    </section>
  );
}
