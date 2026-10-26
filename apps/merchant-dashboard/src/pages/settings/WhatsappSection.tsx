import { useState, type FormEvent, type ReactNode } from "react";
import { Copy, MessageCircle, RefreshCw } from "lucide-react";
import { Alert, Button, Card, Spinner, cn } from "@store-builder/ui";
import type { WhatsappIntegrationConnected } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { ApiError, getErrorMessage, getFieldErrors } from "@/lib/errors";
import { formatRelativeTime } from "@/lib/relativeTime";
import { DataState } from "@/components/DataState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextField } from "@/components/Field";
import { PlanFeatureNotice } from "@/components/PlanFeatureNotice";
import { useToast } from "@/components/Toast";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { WhatsappTemplatesPanel } from "@/components/WhatsappTemplates";

const STRINGS = {
  en: {
    waTitle: "WhatsApp Cloud API",
    waHint:
      "Chat with your customers on WhatsApp from the Inbox page, using your own WhatsApp Business number.",
    notConnected: "Not connected",
    connected: "Connected",
    errorStatus: "Needs attention",
    guideTitle: "How to get your details from Meta",
    step1: "Go to developers.facebook.com, sign in, and create a new app of type “Business”.",
    step2: "Inside the app, add the “WhatsApp” product and link your WhatsApp Business account.",
    step3:
      "Open WhatsApp → API Setup. Copy the “Phone number ID” (and the “WhatsApp Business Account ID” if you want).",
    step4:
      "Create a permanent access token: Business Settings → System users → add a system user → Generate token with the whatsapp_business_messaging and whatsapp_business_management permissions.",
    step5:
      "Open App settings → Basic and copy the “App Secret”. We use it to make sure webhook messages really come from Meta.",
    step6: "Paste everything below and press Connect. We check it with Meta right away.",
    phoneNumberId: "Phone number ID",
    phoneNumberIdHint: "Digits only, from WhatsApp → API Setup.",
    accessToken: "Permanent access token",
    accessTokenHint: "Stored encrypted. We only ever show a masked version.",
    wabaId: "WhatsApp Business Account ID (optional)",
    appSecret: "App Secret",
    appSecretHint:
      "From App settings → Basic, at least 16 characters. Required: Meta signs every message with it, and without it we refuse them all — no customer reply or Confirm / Cancel tap would reach you.",
    appSecretKeepHint: "Leave it empty to keep the saved App Secret.",
    appSecretRequired: "The App Secret is required: without it no customer reply reaches you.",
    connect: "Connect",
    connecting: "Checking with Meta…",
    connectedToast: "WhatsApp connected.",
    invalidPhoneId: "Phone number ID must be digits only.",
    invalidToken: "The access token looks too short.",
    invalidSecret: "The App Secret must be at least 16 characters.",
    authFailed: "Meta rejected these details. Check the access token and phone number ID.",
    apiError: "Meta returned an error: {message}",
    unreachable: "We couldn't reach Meta right now. Try again in a minute.",
    permission: "Only store owners/managers can change integrations.",
    number: "Number",
    verifiedName: "Business name",
    token: "Access token",
    appSecretSet: "App Secret",
    secretYes: "Saved",
    secretNo: "Not set — no customer reply reaches you",
    noSecretTitle: "Add your App Secret",
    noSecretBody:
      "Meta signs every message it sends us with your App Secret. Without it we refuse them all, so your customers' replies and their taps on Confirm / Cancel never arrive.",
    addSecret: "Add App Secret",
    lastVerified: "Last checked",
    lastError: "Last error",
    reconnect: "Reconnect",
    cancelReconnect: "Cancel",
    webhookTitle: "Webhook (so you receive replies)",
    webhookHint:
      "In your Meta app open WhatsApp → Configuration → Webhook → Edit. Paste the Callback URL and Verify token below, press “Verify and save”, then click “Manage” and subscribe to the “messages” field.",
    webhookUrl: "Callback URL",
    verifyToken: "Verify token",
    copied: "Copied.",
    copyFailed: "Could not copy — select the text manually.",
    copyLabel: "Copy {label}",
    disconnect: "Disconnect",
    disconnectTitle: "Disconnect WhatsApp?",
    disconnectDescription:
      "You won't be able to send or receive WhatsApp messages until you connect again. Your saved conversations stay.",
    disconnectPlanNote:
      "Your current plan doesn't include WhatsApp order confirmation: once disconnected, you can only connect again after upgrading your plan.",
    disconnected: "WhatsApp disconnected.",
    working: "Working…",
  },
  ar: {
    waTitle: "واتساب Cloud API",
    waHint: "كلّم عملاءك على واتساب من صفحة صندوق الرسائل، برقم واتساب بيزنس بتاعك.",
    notConnected: "مش مربوط",
    connected: "مربوط",
    errorStatus: "محتاج مراجعة",
    guideTitle: "إزاي تجيب البيانات من Meta",
    step1: "ادخل developers.facebook.com وسجّل دخول، واعمل App جديد نوعه “Business”.",
    step2: "جوه الـ App ضيف منتج “WhatsApp” واربطه بحساب واتساب بيزنس بتاعك.",
    step3: "افتح WhatsApp ← API Setup وانسخ “Phone number ID” (و“WhatsApp Business Account ID” لو حابب).",
    step4:
      "اعمل Access token دايم: Business Settings ← System users ← ضيف System user ← Generate token بصلاحيات whatsapp_business_messaging و whatsapp_business_management.",
    step5: "افتح App settings ← Basic وانسخ “App Secret”. بنستخدمه عشان نتأكد إن الرسايل جاية فعلًا من Meta.",
    step6: "الصق كل ده تحت ودوس «اربط». هنتأكد من البيانات مع Meta على طول.",
    phoneNumberId: "Phone number ID",
    phoneNumberIdHint: "أرقام بس، من WhatsApp ← API Setup.",
    accessToken: "Access token الدايم",
    accessTokenHint: "بيتحفظ مشفّر، ومش هنعرضه غير متخبّي.",
    wabaId: "WhatsApp Business Account ID (اختياري)",
    appSecret: "App Secret",
    appSecretHint:
      "من App settings ← Basic، و١٦ حرفًا على الأقل. مطلوب: تُوقّع Meta به كل رسالة، وبدونه نرفض الرسائل كلها، فلن تصلك ردود العملاء ولا ضغطاتهم على «تأكيد» أو «إلغاء».",
    appSecretKeepHint: "اتركه فارغًا للإبقاء على الـ App Secret المحفوظ.",
    appSecretRequired: "الـ App Secret مطلوب: بدونه لن يصلك أي رد من العملاء.",
    connect: "اربط",
    connecting: "بنتأكد مع Meta…",
    connectedToast: "واتساب اتربط.",
    invalidPhoneId: "Phone number ID لازم يكون أرقام بس.",
    invalidToken: "الـ Access token شكله قصير أوي.",
    invalidSecret: "الـ App Secret لازم يكون ١٦ حرف على الأقل.",
    authFailed: "Meta رفضت البيانات دي. راجع الـ Access token والـ Phone number ID.",
    apiError: "Meta رجّعت خطأ: {message}",
    unreachable: "مش قادرين نوصل لـ Meta دلوقتي. جرّب كمان دقيقة.",
    permission: "صاحب المتجر أو المدير بس يقدر يغيّر الربط.",
    number: "الرقم",
    verifiedName: "اسم النشاط",
    token: "Access token",
    appSecretSet: "App Secret",
    secretYes: "متسجّل",
    secretNo: "غير محفوظ — لن تصلك ردود العملاء",
    noSecretTitle: "أضف الـ App Secret",
    noSecretBody:
      "تُوقّع Meta كل رسالة ترسلها إلينا بالـ App Secret الخاص بك. بدونه نرفض الرسائل كلها، فلا تصلك ردود العملاء ولا ضغطاتهم على «تأكيد» أو «إلغاء».",
    addSecret: "أضف الـ App Secret",
    lastVerified: "آخر تأكيد",
    lastError: "آخر خطأ",
    reconnect: "اربط تاني",
    cancelReconnect: "إلغاء",
    webhookTitle: "الـ Webhook (عشان توصلك الردود)",
    webhookHint:
      "في الـ App بتاعك افتح WhatsApp ← Configuration ← Webhook ← Edit. الصق الـ Callback URL والـ Verify token اللي تحت، دوس “Verify and save”، وبعدين “Manage” واشترك في خانة “messages”.",
    webhookUrl: "Callback URL",
    verifyToken: "Verify token",
    copied: "اتنسخ.",
    copyFailed: "مش قادرين ننسخ — حدّد النص وانسخه بإيدك.",
    copyLabel: "انسخ {label}",
    disconnect: "افصل",
    disconnectTitle: "تفصل واتساب؟",
    disconnectDescription:
      "مش هتقدر تبعت أو تستقبل رسايل واتساب لحد ما تربط تاني. المحادثات القديمة هتفضل موجودة.",
    disconnectPlanNote:
      "خطتك الحالية لا تشمل تأكيد الطلبات عبر واتساب: بعد الفصل لن تتمكن من الربط مرة أخرى إلا بعد ترقية خطتك.",
    disconnected: "واتساب اتفصل.",
    working: "جارٍ التنفيذ…",
  },
} satisfies Messages;

/**
 * The WhatsApp Cloud API card on the Settings page. Its `id` is the anchor the
 * Inbox and Automations screens link to when the integration is missing.
 */
export function WhatsappSection() {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const integration = useAsync(() => apiClient.getWhatsappIntegration(workspaceId), [workspaceId]);
  const [reconnecting, setReconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const data = integration.data;
  const isConnected = data?.connected === true;
  // The plan gate (WHATSAPP_REQUIRE_PLAN_FEATURE): a new connection would be refused for the plan.
  const planLocked = data?.planLocked === true;
  const appSecretSaved = isConnected && (data as WhatsappIntegrationConnected).appSecretSet;

  async function disconnect() {
    await apiClient.disconnectWhatsapp(workspaceId);
    toast.success(t.disconnected);
    setConfirmDisconnect(false);
    setReconnecting(false);
    await integration.refresh({ silent: true });
  }

  return (
    <Card id="whatsapp" className="gap-0 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <MessageCircle className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">{t.waTitle}</h2>
            <p className="mt-0.5 text-xs text-ink-soft">{t.waHint}</p>
          </div>
        </div>
        {data && <StatusPill integration={data.connected ? data : null} />}
      </div>

      <div className="mt-3">
        <DataState
          loading={integration.loading}
          error={integration.error}
          onRetry={() => integration.refresh()}
        >
          {data && isConnected && !reconnecting ? (
            <>
              <ConnectedView
                integration={data as WhatsappIntegrationConnected}
                onReconnect={() => setReconnecting(true)}
                onDisconnect={() => setConfirmDisconnect(true)}
              />
              {/* The account's templates and their status in Meta (components/WhatsappTemplates.tsx). */}
              <WhatsappTemplatesPanel />
            </>
          ) : data && !isConnected && planLocked ? (
            <PlanFeatureNotice feature="whatsapp_confirmation" />
          ) : data ? (
            <div className="space-y-5">
              {!isConnected && <SetupGuide />}
              <ConnectForm
                appSecretSaved={appSecretSaved}
                onCancel={reconnecting ? () => setReconnecting(false) : undefined}
                onDone={() => {
                  setReconnecting(false);
                  void integration.refresh({ silent: true });
                }}
              />
            </div>
          ) : null}
        </DataState>
      </div>

      <ConfirmDialog
        open={confirmDisconnect}
        title={t.disconnectTitle}
        description={planLocked ? `${t.disconnectDescription} ${t.disconnectPlanNote}` : t.disconnectDescription}
        confirmLabel={t.disconnect}
        cancelLabel={t.cancelReconnect}
        busyLabel={t.working}
        destructive
        onCancel={() => setConfirmDisconnect(false)}
        onConfirm={disconnect}
      />
    </Card>
  );
}

function StatusPill({ integration }: { integration: WhatsappIntegrationConnected | null }) {
  const t = useT(STRINGS);
  const tone = !integration
    ? "bg-paper text-ink-soft"
    : integration.status === "error"
      ? "bg-danger-soft text-danger"
      : "bg-success-soft text-success";
  const label = !integration
    ? t.notConnected
    : integration.status === "error"
      ? t.errorStatus
      : t.connected;
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone
      )}
    >
      {label}
    </span>
  );
}

function SetupGuide() {
  const t = useT(STRINGS);
  const steps = [t.step1, t.step2, t.step3, t.step4, t.step5, t.step6];
  return (
    <div className="rounded-lg bg-paper p-4 ring-1 ring-foreground/10">
      <h3 className="text-sm font-medium text-ink">{t.guideTitle}</h3>
      <ol className="mt-3 space-y-2">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-sm text-ink-soft">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
              {i + 1}
            </span>
            <span className="min-w-0 pt-0.5">{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * The App Secret is required unless one is saved already (a reconnect may
 * leave it empty to keep it): without it every webhook is refused.
 */
function ConnectForm({ appSecretSaved, onCancel, onDone }: { appSecretSaved: boolean; onCancel?: () => void; onDone: () => void }) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [businessAccountId, setBusinessAccountId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  // 403 PLAN_FEATURE_REQUIRED: the plan, not the member's role, is what refused.
  const [planRefused, setPlanRefused] = useState(false);

  function errorText(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 403) return t.permission;
      if (err.code === "WHATSAPP_AUTH_FAILED") return t.authFailed;
      if (err.code === "WHATSAPP_API_ERROR") return fmt(t.apiError, { message: err.message });
      if (err.code === "WHATSAPP_UNREACHABLE" || err.status === 502) return t.unreachable;
    }
    return getErrorMessage(err);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    const pid = phoneNumberId.trim();
    const token = accessToken.trim();
    const secret = appSecret.trim();
    if (!/^\d+$/.test(pid)) next.phoneNumberId = t.invalidPhoneId;
    if (token.length < 20) next.accessToken = t.invalidToken;
    if (!secret && !appSecretSaved) next.appSecret = t.appSecretRequired;
    else if (secret && secret.length < 16) next.appSecret = t.invalidSecret;
    setErrors(next);
    setFormError(null);
    setPlanRefused(false);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      await apiClient.connectWhatsapp(workspaceId, {
        phoneNumberId: pid,
        accessToken: token,
        ...(businessAccountId.trim() ? { businessAccountId: businessAccountId.trim() } : {}),
        ...(secret ? { appSecret: secret } : {}),
      });
      toast.success(t.connectedToast);
      onDone();
    } catch (err) {
      const fields = getFieldErrors(err);
      if (err instanceof ApiError && err.code === "PLAN_FEATURE_REQUIRED") setPlanRefused(true);
      else if (err instanceof ApiError && err.code === "WHATSAPP_APP_SECRET_REQUIRED") setErrors({ appSecret: t.appSecretRequired });
      else if (Object.keys(fields).length) setErrors(fields);
      else setFormError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {planRefused && <PlanFeatureNotice feature="whatsapp_confirmation" />}
      {formError && <Alert variant="danger">{formError}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t.phoneNumberId}
          required
          inputMode="numeric"
          dir="ltr"
          value={phoneNumberId}
          onChange={(e) => setPhoneNumberId(e.target.value)}
          error={errors.phoneNumberId}
          hint={t.phoneNumberIdHint}
        />
        <TextField
          label={t.wabaId}
          dir="ltr"
          value={businessAccountId}
          onChange={(e) => setBusinessAccountId(e.target.value)}
          error={errors.businessAccountId}
        />
      </div>
      <TextField
        label={t.accessToken}
        data-search-anchor="whatsapp-token"
        required
        type="password"
        autoComplete="off"
        dir="ltr"
        value={accessToken}
        onChange={(e) => setAccessToken(e.target.value)}
        error={errors.accessToken}
        hint={t.accessTokenHint}
      />
      <TextField
        label={t.appSecret}
        required={!appSecretSaved}
        type="password"
        autoComplete="off"
        dir="ltr"
        value={appSecret}
        onChange={(e) => setAppSecret(e.target.value)}
        error={errors.appSecret}
        hint={appSecretSaved ? t.appSecretKeepHint : t.appSecretHint}
      />
      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            {t.cancelReconnect}
          </Button>
        )}
        <Button
          type="submit"
          disabled={saving || !phoneNumberId.trim() || !accessToken.trim() || (!appSecretSaved && !appSecret.trim())}
        >
          {saving ? (
            <>
              <Spinner className="size-4" /> {t.connecting}
            </>
          ) : (
            t.connect
          )}
        </Button>
      </div>
    </form>
  );
}

function ConnectedView({
  integration,
  onReconnect,
  onDisconnect,
}: {
  integration: WhatsappIntegrationConnected;
  onReconnect: () => void;
  onDisconnect: () => void;
}) {
  const t = useT(STRINGS);
  return (
    <div className="space-y-5">
      {integration.status === "error" && (
        <Alert variant="danger" className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium">{t.lastError}</p>
            <p className="text-sm">{integration.lastError ?? "—"}</p>
          </div>
          <Button size="sm" onClick={onReconnect}>
            <RefreshCw className="size-4" /> {t.reconnect}
          </Button>
        </Alert>
      )}

      {/* Connected before the App Secret was required: every webhook is refused until it is added. */}
      {integration.status !== "error" && !integration.appSecretSet && (
        <Alert
          variant="default"
          className="flex flex-wrap items-center justify-between gap-3 border-accent/40 bg-accent-soft text-accent-dark dark:text-accent"
        >
          <div className="min-w-0">
            <p className="font-medium">{t.noSecretTitle}</p>
            <p className="text-sm">{t.noSecretBody}</p>
          </div>
          <Button size="sm" onClick={onReconnect}>
            {t.addSecret}
          </Button>
        </Alert>
      )}

      <dl className="grid gap-4 sm:grid-cols-2">
        <Info
          label={t.number}
          value={<bdi dir="ltr">{integration.displayPhoneNumber ?? integration.phoneNumberId}</bdi>}
        />
        <Info label={t.verifiedName} value={<bdi>{integration.verifiedName ?? "—"}</bdi>} />
        <Info
          label={t.token}
          searchAnchor="whatsapp-token"
          value={
            <code dir="ltr" className="text-xs">
              {integration.accessTokenMask ?? "—"}
            </code>
          }
        />
        <Info
          label={t.appSecretSet}
          value={
            <span className={integration.appSecretSet ? "text-success" : "text-accent-dark dark:text-accent"}>
              {integration.appSecretSet ? t.secretYes : t.secretNo}
            </span>
          }
        />
        <Info label={t.lastVerified} value={formatRelativeTime(integration.lastVerifiedAt)} />
      </dl>

      <div className="space-y-3 rounded-lg bg-paper p-4 ring-1 ring-foreground/10" data-search-anchor="whatsapp-webhook">
        <div>
          <h3 className="text-sm font-medium text-ink">{t.webhookTitle}</h3>
          <p className="mt-1 text-xs text-ink-soft">{t.webhookHint}</p>
        </div>
        <CopyRow label={t.webhookUrl} value={integration.webhook.url} />
        <CopyRow label={t.verifyToken} value={integration.webhook.verifyToken} />
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        {integration.status !== "error" && (
          <Button variant="outline" onClick={onReconnect}>
            {t.reconnect}
          </Button>
        )}
        <Button variant="ghost" className="text-danger hover:bg-danger-soft" onClick={onDisconnect}>
          {t.disconnect}
        </Button>
      </div>
    </div>
  );
}

function Info({ label, value, searchAnchor }: { label: string; value: ReactNode; searchAnchor?: string }) {
  return (
    <div className="min-w-0" data-search-anchor={searchAnchor}>
      <dt className="text-xs font-medium text-ink-soft">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const toast = useToast();
  const t = useT(STRINGS);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t.copied);
    } catch {
      toast.error(t.copyFailed);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
      <span className="w-28 shrink-0 text-xs font-medium text-ink-soft">{label}</span>
      <code
        dir="ltr"
        className="min-w-0 flex-1 truncate rounded-md bg-paper-raised px-2 py-1 text-start text-xs text-ink"
      >
        {value}
      </code>
      <Button size="icon-sm" variant="ghost" onClick={copy} aria-label={fmt(t.copyLabel, { label })}>
        <Copy className="size-4" />
      </Button>
    </div>
  );
}
