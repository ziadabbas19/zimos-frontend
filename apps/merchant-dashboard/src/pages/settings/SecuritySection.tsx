import { useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  apiErrorCode,
  securityConfirmAuthenticator,
  securityDisableTwoFactor,
  securityEnableEmailCode,
  securityForgetDevices,
  securitySetupAuthenticator,
  securityTwoFactorStatus,
  type TwoFactorStatus,
  twoFactorEnableWhatsapp,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { TWO_FACTOR_ENABLED } from "@/lib/features";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataState } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/Field";
import { StatusBadge } from "@/components/StatusBadge";
import { IconKey, IconShield } from "@/components/icons";
import { SettingsGroup, SettingsLinkRow, SettingsPane, SettingsRow } from "@/components/settings";
import { BackupCodesPanel } from "./BackupCodesPanel";
import { PaneSkeleton } from "./sections/SettingsCard";

/**
 * Settings → Security: the way to a new password and signing out of every
 * device, always; two-step sign-in with its methods and backup codes while
 * TWO_FACTOR_ENABLED is on.
 */

const STRINGS = {
  en: {
    title: "Security",
    description: "Two-step sign-in, your password and your signed-in devices",
    descriptionBasic: "Your password and your signed-in devices",
    devicesTitle: "Signed-in devices",
    signOutAll: "Sign out of all devices",
    signOutAllHint: "Every phone and computer signed in to your account signs in again, this one included.",
    signOut: "Sign out",
    signOutAllTitle: "Sign out of all devices?",
    signOutAllBody: "Every phone and computer signed in to your account will be signed out, this one included. You will sign in again here.",
    signOutAllBodyTwoStep: "Devices remembered for two-step sign-in will be asked for a code again.",
    signingOut: "Signing out…",
    twoTitle: "Two-step sign-in",
    twoHint: "After your password, a code is asked for when you sign in from a device we do not know.",
    status: "Now",
    off: "Off",
    on: "On",
    emailMode: "Code by email",
    emailModeHint: "A code is sent to your sign-in email.",
    appMode: "Authenticator app",
    appModeHint: "Google Authenticator or a similar app shows the code.",
    whatsappMode: "Code on WhatsApp",
    whatsappModeHint: "A code is sent to your verified phone.",
    use: "Use this",
    whatsappOn: "Sign-in codes now go to your phone on WhatsApp.",
    needPhone: "Verify your phone number in your account to get codes on WhatsApp.",
    turnOffRow: "Turn off two-step sign-in",
    turnOffHint: "You sign in with your password alone.",
    turnOff: "Turn off",
    remembered: "{count} remembered device(s) are not asked for a code.",
    forget: "Forget them",
    forgotten: "Remembered devices were forgotten.",
    password: "Your password",
    passwordHint: "To confirm it is you.",
    continue: "Continue",
    working: "Working…",
    cancel: "Cancel",
    emailOn: "Two-step sign-in by email is on.",
    appOn: "Two-step sign-in with your app is on.",
    turnedOff: "Two-step sign-in is off.",
    scanTitle: "Set up your authenticator app",
    scanBody: "Scan this code with Google Authenticator or a similar app, then type the 6-digit code it shows.",
    manual: "Or type this key into the app:",
    code: "Code from the app",
    confirm: "Turn on",
    passwordTitle: "Password",
    resetPassword: "Change your password",
    resetPasswordHint: "We email you a link to set a new one.",
  },
  ar: {
    title: "الأمان",
    description: "تسجيل الدخول بخطوتين وكلمة المرور والأجهزة المسجَّل دخولها",
    descriptionBasic: "كلمة المرور والأجهزة المسجَّل دخولها",
    devicesTitle: "الأجهزة المسجَّل دخولها",
    signOutAll: "تسجيل الخروج من كل الأجهزة",
    signOutAllHint: "كل هاتف وحاسوب مسجَّل دخوله إلى حسابك سيسجّل الدخول من جديد، وهذا الجهاز منها.",
    signOut: "تسجيل الخروج",
    signOutAllTitle: "تسجيل الخروج من كل الأجهزة؟",
    signOutAllBody: "سيُسجَّل خروج كل هاتف وحاسوب مسجَّل دخوله إلى حسابك، وهذا الجهاز منها، وستسجّل الدخول هنا من جديد.",
    signOutAllBodyTwoStep: "الأجهزة المحفوظة لتسجيل الدخول بخطوتين سيُطلب منها الرمز من جديد.",
    signingOut: "جارٍ تسجيل الخروج…",
    twoTitle: "تسجيل الدخول بخطوتين",
    twoHint: "بعد كلمة المرور، يُطلب رمز عند تسجيل الدخول من جهاز غير معروف.",
    status: "الحالة الآن",
    off: "متوقف",
    on: "مفعّل",
    emailMode: "رمز بالبريد الإلكتروني",
    emailModeHint: "يُرسل الرمز إلى بريد تسجيل الدخول الخاص بك.",
    appMode: "تطبيق المصادقة",
    appModeHint: "يعرض Google Authenticator أو تطبيق مشابه الرمز.",
    whatsappMode: "رمز عبر واتساب",
    whatsappModeHint: "يُرسل الرمز إلى رقم هاتفك الموثّق.",
    use: "استخدمه",
    whatsappOn: "تصل رموز تسجيل الدخول الآن إلى هاتفك عبر واتساب.",
    needPhone: "وثّق رقم هاتفك في حسابك لتصلك الرموز عبر واتساب.",
    turnOffRow: "إيقاف تسجيل الدخول بخطوتين",
    turnOffHint: "ستسجّل الدخول بكلمة المرور فقط.",
    turnOff: "إيقاف",
    remembered: "{count} جهاز محفوظ لا يُطلب منه رمز.",
    forget: "نسيانها",
    forgotten: "تم نسيان الأجهزة المحفوظة.",
    password: "كلمة المرور",
    passwordHint: "للتأكد من أنك صاحب الحساب.",
    continue: "متابعة",
    working: "جارٍ التنفيذ…",
    cancel: "إلغاء",
    emailOn: "تم تفعيل تسجيل الدخول بخطوتين بالبريد الإلكتروني.",
    appOn: "تم تفعيل تسجيل الدخول بخطوتين بالتطبيق.",
    turnedOff: "تم إيقاف تسجيل الدخول بخطوتين.",
    scanTitle: "إعداد تطبيق المصادقة",
    scanBody: "امسح هذا الرمز بتطبيق Google Authenticator أو تطبيق مشابه، ثم اكتب الرمز المكوّن من ٦ أرقام الذي يعرضه.",
    manual: "أو اكتب هذا المفتاح في التطبيق:",
    code: "الرمز من التطبيق",
    confirm: "تفعيل",
    passwordTitle: "كلمة المرور",
    resetPassword: "تغيير كلمة المرور",
    resetPasswordHint: "نرسل إليك رابطًا بالبريد الإلكتروني لتعيين كلمة مرور جديدة.",
  },
} satisfies Messages;

type T = Record<keyof (typeof STRINGS)["en"], string>;

export function SecuritySection() {
  const t = useT(STRINGS);
  return (
    <SettingsPane title={t.title} description={TWO_FACTOR_ENABLED ? t.description : t.descriptionBasic} icon={IconShield} tone="green">
      {/* The part behind the switch: while it is off the API is not asked about the second step. */}
      {TWO_FACTOR_ENABLED && <TwoStepPanel t={t} />}
      {/* There is no change-password call: the way to a new password is the reset link (/forgot-password). */}
      <SettingsGroup title={t.passwordTitle} searchAnchor="password">
        <SettingsLinkRow to="/forgot-password" icon={IconKey} tone="gray" label={t.resetPassword} hint={t.resetPasswordHint} />
      </SettingsGroup>
      <DevicesPanel t={t} />
    </SettingsPane>
  );
}

// ───────────────────────────── devices ─────────────────────────────

/**
 * "Sign out of all devices": asks first, then ends every session of the
 * account on the server, this one included, and the sign-in page follows
 * (AuthContext.signOutEverywhere). When the server cannot be told, nothing is
 * signed out: the dialog stays open with the reason.
 */
function DevicesPanel({ t }: { t: T }) {
  const { signOutEverywhere } = useAuth();
  const [asking, setAsking] = useState(false);

  return (
    <>
      <SettingsGroup title={t.devicesTitle} searchAnchor="devices">
        <SettingsRow
          label={t.signOutAll}
          hint={t.signOutAllHint}
          control={
            <Button variant="ghost" className="min-h-11 text-danger hover:bg-danger-soft" onClick={() => setAsking(true)}>
              {t.signOut}
            </Button>
          }
        />
      </SettingsGroup>
      <ConfirmDialog
        open={asking}
        title={t.signOutAllTitle}
        description={TWO_FACTOR_ENABLED ? `${t.signOutAllBody} ${t.signOutAllBodyTwoStep}` : t.signOutAllBody}
        confirmLabel={t.signOutAll}
        cancelLabel={t.cancel}
        busyLabel={t.signingOut}
        destructive
        onCancel={() => setAsking(false)}
        onConfirm={async () => {
          await signOutEverywhere();
          setAsking(false);
        }}
      />
    </>
  );
}

// ───────────────────────────── two-step ─────────────────────────────

type Method = "email" | "totp" | "whatsapp";
type Step = { kind: "password"; next: Method | "off" } | { kind: "scan"; secret: string; qr: string | null } | null;

function TwoStepPanel({ t }: { t: T }) {
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const status = useAsync(() => securityTwoFactorStatus(apiClient), []);
  const [step, setStep] = useState<Step>(null);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = status.data;
  // The API runs without two-step sign-in (404 TWO_FACTOR_UNAVAILABLE): nothing to set here yet.
  const unavailable = apiErrorCode(status.error) === "TWO_FACTOR_UNAVAILABLE";
  const modeLabel: Record<TwoFactorStatus["mode"], string> = { off: t.off, email: t.emailMode, totp: t.appMode, whatsapp: t.whatsappMode };
  // The WhatsApp code goes to the verified phone (PhoneVerification in the profile).
  const { user } = useAuth();
  const phoneVerified = Boolean(user?.phone && user?.phoneVerifiedAt);

  function close() {
    setStep(null);
    setPassword("");
    setCode("");
    setError(null);
  }

  // An account without a password (Google sign-in) is not asked for one.
  function start(next: Method | "off") {
    setError(null);
    if (data && !data.hasPassword) void run(next, "");
    else setStep({ kind: "password", next });
  }

  async function run(next: Method | "off", pass: string) {
    setBusy(true);
    setError(null);
    try {
      if (next === "email") {
        status.setData(await securityEnableEmailCode(apiClient, pass));
        toast.success(t.emailOn);
        close();
      } else if (next === "whatsapp") {
        status.setData(await twoFactorEnableWhatsapp(apiClient, pass));
        toast.success(t.whatsappOn);
        close();
      } else if (next === "off") {
        status.setData(await securityDisableTwoFactor(apiClient, pass));
        toast.success(t.turnedOff);
        close();
      } else {
        const setup = await securitySetupAuthenticator(apiClient, pass);
        setPassword("");
        setStep({ kind: "scan", secret: setup.secret, qr: setup.qrDataUrl });
      }
    } catch (err) {
      // A wrong password comes back as a field problem (422).
      setError(errorMessage(err));
      if (!step) toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      status.setData(await securityConfirmAuthenticator(apiClient, code.trim()));
      toast.success(t.appOn);
      close();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function forget() {
    try {
      status.setData(await securityForgetDevices(apiClient));
      toast.success(t.forgotten);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  /** One method: «شغّال» on the one in use, a button on the others. */
  const methodRow = (method: Method, label: string, hint: string, blocked = false) => (
    <SettingsRow
      label={label}
      hint={hint}
      control={
        data?.mode === method ? (
          <StatusBadge value="on" tone="success" text={t.on} />
        ) : (
          <Button variant="outline" className="min-h-11" disabled={busy || blocked} onClick={() => start(method)}>
            {t.use}
          </Button>
        )
      }
    />
  );

  if (unavailable) return null;

  return (
    <>
      <DataState loading={status.loading} error={status.error} onRetry={() => void status.refresh()} skeleton={<PaneSkeleton rows={4} />}>
        {data && (
          <SettingsGroup title={t.twoTitle} description={t.twoHint} searchAnchor="two-step">
            <SettingsRow
              label={t.status}
              hint={data.mode !== "off" && data.rememberedDevices > 0 ? fmt(t.remembered, { count: data.rememberedDevices }) : undefined}
              control={
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <StatusBadge value={data.mode} tone={data.mode === "off" ? "neutral" : "success"} text={modeLabel[data.mode]} />
                  {data.mode !== "off" && data.rememberedDevices > 0 && (
                    <Button variant="ghost" className="min-h-11" onClick={() => void forget()}>
                      {t.forget}
                    </Button>
                  )}
                </div>
              }
            />
            {methodRow("email", t.emailMode, t.emailModeHint)}
            {/* A phone never shows a tooltip: the reason the button is held is the row's own hint. */}
            {methodRow("whatsapp", t.whatsappMode, phoneVerified || data.mode === "whatsapp" ? t.whatsappModeHint : t.needPhone, !phoneVerified)}
            {methodRow("totp", t.appMode, t.appModeHint)}
            {data.mode !== "off" && <BackupCodesPanel status={data} onChanged={(next) => status.setData({ ...data, ...next })} />}
            {data.mode !== "off" && (
              <SettingsRow
                label={t.turnOffRow}
                hint={t.turnOffHint}
                control={
                  <Button variant="ghost" className="min-h-11 text-danger hover:bg-danger-soft" disabled={busy} onClick={() => start("off")}>
                    {t.turnOff}
                  </Button>
                }
              />
            )}
          </SettingsGroup>
        )}
      </DataState>

      <Modal open={step?.kind === "password"} onClose={close} title={t.twoTitle}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (step?.kind === "password") void run(step.next, password);
          }}
        >
          {error && <Alert variant="danger">{error}</Alert>}
          <TextField
            label={t.password}
            hint={t.passwordHint}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" className="min-h-11" onClick={close} disabled={busy}>
              {t.cancel}
            </Button>
            <Button type="submit" className="min-h-11" disabled={busy || password === ""}>
              {busy ? t.working : t.continue}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={step?.kind === "scan"} onClose={close} title={t.scanTitle} description={t.scanBody}>
        {step?.kind === "scan" && (
          <form className="space-y-4" onSubmit={confirm}>
            {error && <Alert variant="danger">{error}</Alert>}
            {step.qr && <img src={step.qr} alt="" className="mx-auto size-44 rounded-xl bg-white p-2 ring-1 ring-line" />}
            <p className="text-[13px] leading-5 text-ink-soft">
              {t.manual}{" "}
              <code dir="ltr" className="font-mono break-all text-ink">
                {step.secret}
              </code>
            </p>
            <TextField
              label={t.code}
              dir="ltr"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" className="min-h-11" onClick={close} disabled={busy}>
                {t.cancel}
              </Button>
              <Button type="submit" className="min-h-11" disabled={busy || code.length !== 6}>
                {busy ? t.working : t.confirm}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
