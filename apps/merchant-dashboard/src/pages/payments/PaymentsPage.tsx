import { useId, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, ExternalLink } from "lucide-react";
import { Alert, Button, Input, Label, cn } from "@store-builder/ui";
import {
  ApiError,
  type PaymentGatewayInfo,
  type PaymentMethodEntry,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime } from "@/lib/format";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useCommon, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CopyButton } from "@/components/CopyButton";
import { useToast } from "@/components/Toast";

/**
 * Role keys that manage payments: the backend gates every /payments call on
 * workspace.manage, which only the owner ("*") and the workspace manager hold
 * among the system roles. A custom role reads as view-only here, and a 403
 * flips the page to view-only.
 */
const PAYMENT_ROLES: ReadonlySet<string> = new Set(["owner", "workspace_manager"]);

const STRINGS = {
  en: {
    title: "Payments",
    description: "Connect your own payment gateway so shoppers can pay by card or wallet. The money goes straight to your gateway account.",
    viewOnly: "Only the store owner or a workspace manager can manage payments.",
    viewOnlyForbidden: "Your role can't manage payments, so this is shown read-only.",
    notAvailableTitle: "Not available yet",
    notAvailable: "Online payments aren't switched on for this server yet. Your store keeps taking cash on delivery.",
    offlineNotice:
      "Online checkout isn't live on the platform yet, so shoppers only see cash on delivery for now. You can connect and test your gateway already; nothing changes for shoppers until it goes live.",
    gatewaysTitle: "Gateways",
    notConnected: "Not connected",
    connected: "Connected",
    invalid: "Keys rejected",
    invalidNote: "{name} rejected the saved keys. Enter them again to keep taking online payments.",
    modeTest: "Test mode",
    modeLive: "Live",
    testNote:
      "Test keys: card and wallet only show in your store preview, never to real shoppers, and orders paid in test mode can't be shipped.",
    previewButton: "Test checkout in store preview",
    previewOpening: "Opening preview…",
    connectedSince: "Connected {date}",
    lastWebhook: "Last payment update received {date}",
    noWebhookYet: "No payment update received yet. Check that the webhook URL below is pasted into each integration.",
    noWebhookYetAutomatic: "No payment update received yet. {name} is sent the webhook URL with every payment, so the first one arrives with the first payment.",
    webhookTitle: "Webhook URL",
    webhookHint: "Paste this into \"{field}\" of each {name} integration you entered below.",
    webhookHintAutomatic:
      "Nothing to paste for payments: {name} is given this URL with every payment. To also see refunds you make in {name}'s own dashboard, add it there under \"{field}\" (events: refund, partial_refund, void).",
    copyWebhook: "Copy webhook URL",
    setupTitle: "How to connect {name}",
    helpLinks: "Help",
    connect: "Connect {name}",
    credentialsTitle: "Keys",
    credentialsHint: "Stored encrypted and never shown again.",
    methodsTitle: "Payment methods",
    methodsHint: "Enter the integration ID for each method you want to offer.",
    submitConnect: "Check keys and connect",
    checking: "Checking with {name}…",
    replaceKeys: "Replace keys",
    editIds: "Edit integration IDs",
    accountMethods: "Methods on your {name} account",
    recheck: "Check the account again",
    rechecking: "Checking…",
    recheckedToast: "{name} account checked.",
    methodNames: "card|mobile wallet",
    saveIds: "Save",
    disconnect: "Disconnect",
    disconnectTitle: "Disconnect {name}?",
    disconnectDescription: "Shoppers will no longer be able to pay with {name}. Past payments and refunds stay on their orders.",
    connectedToast: "{name} is connected.",
    savedToast: "{name} settings saved.",
    disconnectedToast: "{name} disconnected.",
    methodListTitle: "Checkout methods",
    methodListHint:
      "Choose which methods shoppers see and in what order. One gateway per method: turning one on turns the other gateway's same method off. At least one must stay on.",
    methodCod: "Cash on delivery",
    methodCard: "{name}: card",
    methodWallet: "{name}: mobile wallet",
    methodUnavailable: "Not connected",
    moveUp: "Move up",
    moveDown: "Move down",
    saveMethods: "Save methods",
    methodsSaved: "Payment methods saved.",
    on: "On",
  },
  ar: {
    title: "المدفوعات",
    description: "اربط بوابة الدفع الخاصة بك لكي يدفع العملاء بالكارت أو المحفظة. الفلوس بتروح مباشرة لحساب البوابة بتاعك.",
    viewOnly: "مالك المتجر أو مدير مساحة العمل فقط يمكنه إدارة المدفوعات.",
    viewOnlyForbidden: "دورك لا يسمح بإدارة المدفوعات، لذلك تظهر للعرض فقط.",
    notAvailableTitle: "غير متاح بعد",
    notAvailable: "الدفع الإلكتروني غير مفعّل على هذا الخادم بعد. متجرك مستمر في الدفع عند الاستلام.",
    offlineNotice:
      "الدفع الإلكتروني لم يُفعَّل على المنصة بعد، لذلك يرى العملاء الدفع عند الاستلام فقط حاليًا. يمكنك ربط البوابة وتجربتها من الآن، ولن يتغير شيء للعملاء قبل التفعيل.",
    gatewaysTitle: "البوابات",
    notConnected: "غير مربوطة",
    connected: "مربوطة",
    invalid: "المفاتيح مرفوضة",
    invalidNote: "رفضت {name} المفاتيح المحفوظة. أدخلها مرة أخرى لمواصلة الدفع الإلكتروني.",
    modeTest: "وضع التجربة",
    modeLive: "تشغيل فعلي",
    testNote:
      "مفاتيح تجربة: الكارت والمحفظة يظهران في معاينة متجرك فقط وليس للعملاء الحقيقيين، والأوردرات المدفوعة في وضع التجربة لا يمكن شحنها.",
    previewButton: "جرّب الدفع في معاينة المتجر",
    previewOpening: "جارٍ فتح المعاينة…",
    connectedSince: "مربوطة منذ {date}",
    lastWebhook: "آخر تحديث دفع وصل {date}",
    noWebhookYet: "لم يصل أي تحديث دفع بعد. تأكد أن رابط الـ webhook بالأسفل ملصوق في كل تكامل.",
    noWebhookYetAutomatic: "لم يصل أي تحديث دفع بعد. {name} يستلم رابط الـ webhook مع كل عملية دفع، فأول تحديث سيصل مع أول عملية دفع.",
    webhookTitle: "رابط الـ Webhook",
    webhookHint: "الصق هذا الرابط في خانة \"{field}\" لكل تكامل من تكاملات {name} التي أدخلتها بالأسفل.",
    webhookHintAutomatic:
      "لا حاجة للصق أي شيء للمدفوعات: {name} يستلم هذا الرابط مع كل عملية دفع. لو تريد أن تظهر هنا الاستردادات التي تعملها من لوحة {name} نفسها، أضفه هناك في \"{field}\" (الأحداث: refund و partial_refund و void).",
    copyWebhook: "نسخ رابط الـ webhook",
    setupTitle: "طريقة ربط {name}",
    helpLinks: "مساعدة",
    connect: "ربط {name}",
    credentialsTitle: "المفاتيح",
    credentialsHint: "تُحفظ مشفّرة ولا تظهر مرة أخرى.",
    methodsTitle: "طرق الدفع",
    methodsHint: "أدخل رقم التكامل لكل طريقة تريد تقديمها.",
    submitConnect: "تحقق من المفاتيح واربط",
    checking: "جارٍ التحقق مع {name}…",
    replaceKeys: "تغيير المفاتيح",
    editIds: "تعديل أرقام التكامل",
    accountMethods: "الطرق المتاحة في حساب {name}",
    recheck: "إعادة فحص الحساب",
    rechecking: "جارٍ الفحص…",
    recheckedToast: "تم فحص حساب {name}.",
    methodNames: "كارت|محفظة إلكترونية",
    saveIds: "حفظ",
    disconnect: "إلغاء الربط",
    disconnectTitle: "إلغاء ربط {name}؟",
    disconnectDescription: "لن يستطيع العملاء الدفع عبر {name}. المدفوعات والاستردادات السابقة تبقى على أوردراتها.",
    connectedToast: "تم ربط {name}.",
    savedToast: "تم حفظ إعدادات {name}.",
    disconnectedToast: "تم إلغاء ربط {name}.",
    methodListTitle: "طرق الدفع في صفحة الدفع",
    methodListHint:
      "اختر الطرق التي يراها العملاء وترتيبها. بوابة واحدة لكل طريقة: تفعيل طريقة من بوابة يوقف نفس الطريقة من البوابة الأخرى. لازم تفضل طريقة واحدة على الأقل مفعّلة.",
    methodCod: "الدفع عند الاستلام",
    methodCard: "{name}: كارت",
    methodWallet: "{name}: محفظة إلكترونية",
    methodUnavailable: "غير مربوطة",
    moveUp: "تحريك لأعلى",
    moveDown: "تحريك لأسفل",
    saveMethods: "حفظ طرق الدفع",
    methodsSaved: "تم حفظ طرق الدفع.",
    on: "مفعّلة",
  },
} satisfies Messages;

/** /payments — gateway connections and the checkout method list. */
export function PaymentsPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const roleAllows = PAYMENT_ROLES.has(currentWorkspace?.role ?? "");
  const [forbidden, setForbidden] = useState(false);
  const canManage = roleAllows && !forbidden;

  const gateways = useAsync(
    () => (roleAllows ? apiClient.listPaymentGateways(workspaceId) : Promise.resolve(null)),
    [workspaceId, roleAllows]
  );
  const methods = useAsync(
    () => (roleAllows ? apiClient.listPaymentMethods(workspaceId) : Promise.resolve(null)),
    [workspaceId, roleAllows]
  );
  const list = gateways.data;

  function refreshAll() {
    void gateways.refresh({ silent: true });
    void methods.refresh({ silent: true });
  }

  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader title={t.title} description={t.description} />
      {!roleAllows ? (
        <Alert>{t.viewOnly}</Alert>
      ) : (
        <DataState loading={gateways.loading} error={gateways.error} onRetry={() => gateways.refresh()}>
          {list && !list.configured ? (
            <div className="rounded-[0.5rem] border border-dashed border-line px-4 py-5">
              <p className="text-sm font-medium text-ink">{t.notAvailableTitle}</p>
              <p className="mt-1 text-sm text-ink-soft">{t.notAvailable}</p>
            </div>
          ) : (
            <div className="space-y-8">
              {forbidden && <Alert>{t.viewOnlyForbidden}</Alert>}
              {list && !list.onlineEnabled && <Alert>{t.offlineNotice}</Alert>}
              <section className="space-y-4">
                <h2 className="font-display text-lg font-medium text-ink">{t.gatewaysTitle}</h2>
                {list?.gateways.map((gateway) => (
                  <GatewayCard
                    key={gateway.code}
                    gateway={gateway}
                    canManage={canManage}
                    onForbidden={() => setForbidden(true)}
                    onChanged={refreshAll}
                  />
                ))}
              </section>
              {methods.data && list && (
                <MethodList
                  key={JSON.stringify(methods.data.methods.map((m) => [m.id, m.enabled, m.available]))}
                  methods={methods.data.methods}
                  gateways={list.gateways}
                  canManage={canManage}
                  onForbidden={() => setForbidden(true)}
                  onSaved={(next) => methods.setData({ ...methods.data!, methods: next })}
                />
              )}
            </div>
          )}
        </DataState>
      )}
    </div>
  );
}

type CardMode = "view" | "connect" | "ids";

function GatewayCard({
  gateway,
  canManage,
  onForbidden,
  onChanged,
}: {
  gateway: PaymentGatewayInfo;
  canManage: boolean;
  onForbidden: () => void;
  onChanged: () => void;
}) {
  const t = useT(STRINGS);
  const common = useCommon();
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const name = gateway.name;
  const connection = gateway.connection;
  // Kashier: the methods come from the account itself; only keys are typed in.
  const fromAccount = gateway.methodsFromAccount;
  const [cardName, walletName] = t.methodNames.split("|");

  const [mode, setMode] = useState<CardMode>("view");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [ids, setIds] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [openingPreview, setOpeningPreview] = useState(false);

  // The integration IDs as saved, to start the form from each time it opens.
  function savedIds() {
    const settings = connection?.settings ?? {};
    return Object.fromEntries(
      gateway.settingFields.map((f) => [f.key, settings[f.key] != null ? String(settings[f.key]) : ""])
    );
  }

  function openForm(next: CardMode) {
    setError(null);
    setIds(savedIds());
    setMode(next);
  }

  function fail(err: unknown) {
    if (err instanceof ApiError && err.status === 403) {
      toast.error(errorMessage(err));
      onForbidden();
      setMode("view");
      return;
    }
    setError(errorMessage(err));
  }

  function settingsPayload() {
    return Object.fromEntries(
      gateway.settingFields.map((f) => [f.key, ids[f.key]?.trim() ? Number(ids[f.key].trim()) : null])
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const wasConnected = Boolean(connection);
    try {
      await apiClient.connectPaymentGateway(workspaceId, gateway.code, {
        ...(mode === "connect" ? { credentials } : {}),
        ...(fromAccount ? {} : { settings: settingsPayload() }),
      });
      setCredentials({});
      setMode("view");
      toast.success(fmt(mode === "connect" && !wasConnected ? t.connectedToast : t.savedToast, { name }));
      onChanged();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  /** Re-verifies the stored keys and re-reads the account's methods. */
  async function recheck() {
    setBusy(true);
    setError(null);
    try {
      await apiClient.connectPaymentGateway(workspaceId, gateway.code, {});
      toast.success(fmt(t.recheckedToast, { name }));
      onChanged();
    } catch (err) {
      fail(err);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function confirmDisconnect() {
    try {
      await apiClient.disconnectPaymentGateway(workspaceId, gateway.code);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setDisconnecting(false);
        fail(err);
        return;
      }
      throw new Error(errorMessage(err));
    }
    setDisconnecting(false);
    toast.success(fmt(t.disconnectedToast, { name }));
    onChanged();
  }

  async function openPreview() {
    setOpeningPreview(true);
    // Opened before the await so the browser treats it as a user action.
    const win = window.open("", "_blank");
    try {
      const { token } = await apiClient.createPaymentPreviewToken(workspaceId);
      const url = `${STOREFRONT_URL}/store/${workspaceId}?paymentsPreview=${encodeURIComponent(token)}`;
      if (win) win.location.href = url;
      else window.open(url, "_blank", "noopener");
    } catch (err) {
      win?.close();
      fail(err);
    } finally {
      setOpeningPreview(false);
    }
  }

  const credentialsComplete = gateway.credentialFields.every((f) => (credentials[f.key] ?? "").trim().length > 0);
  const anyId = gateway.settingFields.some((f) => /^\d+$/.test((ids[f.key] ?? "").trim()));
  const idsValid = gateway.settingFields.every((f) => !(ids[f.key] ?? "").trim() || /^\d+$/.test(ids[f.key].trim()));

  return (
    <div className="rounded-[var(--radius-card)] border border-line p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-medium text-ink">{name}</h3>
            {!connection ? (
              <StatusBadge value="not_connected" tone="neutral" text={t.notConnected} />
            ) : connection.status === "invalid" ? (
              <StatusBadge value="invalid" tone="danger" text={t.invalid} />
            ) : (
              <StatusBadge value="connected" tone="success" text={t.connected} />
            )}
            {connection && (
              <StatusBadge
                value={connection.mode}
                tone={connection.mode === "live" ? "info" : "warning"}
                text={connection.mode === "live" ? t.modeLive : t.modeTest}
              />
            )}
          </div>
          {connection && (
            <p className="mt-1 text-xs text-ink-soft">
              {fmt(t.connectedSince, { date: formatDateTime(connection.connectedAt) })}
            </p>
          )}
        </div>
        {canManage && mode === "view" && !connection && (
          <Button className="min-h-11" onClick={() => openForm("connect")}>
            {fmt(t.connect, { name })}
          </Button>
        )}
      </div>

      {connection?.status === "invalid" && mode === "view" && (
        <Alert variant="danger" className="mt-3">
          {fmt(t.invalidNote, { name })}
        </Alert>
      )}

      {connection && mode === "view" && (
        <div className="mt-4 space-y-3">
          {connection.mode === "test" && (
            <div className="rounded-[0.5rem] border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-accent-dark">
              <p>{t.testNote}</p>
              <Button variant="outline" className="mt-2 min-h-11" disabled={openingPreview} onClick={openPreview}>
                <ExternalLink className="size-4" aria-hidden />
                {openingPreview ? t.previewOpening : t.previewButton}
              </Button>
            </div>
          )}
          <p className={cn("text-sm", connection.lastWebhookAt ? "text-ink-soft" : "text-warning")}>
            {connection.lastWebhookAt
              ? fmt(t.lastWebhook, { date: formatDateTime(connection.lastWebhookAt) })
              : gateway.webhookSetup.automatic
                ? fmt(t.noWebhookYetAutomatic, { name })
                : t.noWebhookYet}
          </p>
          <WebhookUrl gateway={gateway} url={connection.webhookUrl} />
          <p className="text-sm text-ink-soft">
            {fromAccount
              ? `${fmt(t.accountMethods, { name })}: ${connection.methods
                  .map((m) => (m === "card" ? cardName : walletName))
                  .join(" · ")}`
              : gateway.settingFields
                  .filter((f) => connection.settings[f.key])
                  .map((f) => `${f.label[locale]}: ${String(connection.settings[f.key])}`)
                  .join(" · ")}
          </p>
        </div>
      )}

      {canManage && connection && mode === "view" && (
        <div className="mt-4 flex flex-wrap gap-2">
          {fromAccount ? (
            <Button variant="outline" className="min-h-11" disabled={busy} onClick={recheck}>
              {busy ? t.rechecking : t.recheck}
            </Button>
          ) : (
            <Button variant="outline" className="min-h-11" onClick={() => openForm("ids")}>
              {t.editIds}
            </Button>
          )}
          <Button
            variant={connection.status === "invalid" ? "primary" : "outline"}
            className="min-h-11"
            onClick={() => openForm("connect")}
          >
            {t.replaceKeys}
          </Button>
          <Button
            variant="ghost"
            className="min-h-11 text-danger hover:bg-danger-soft"
            onClick={() => setDisconnecting(true)}
          >
            {t.disconnect}
          </Button>
        </div>
      )}

      {error && (
        <Alert variant="danger" className="mt-3">
          {error}
        </Alert>
      )}

      {(!connection || mode === "connect") && (
        <SetupGuide gateway={gateway} webhookUrl={connection?.webhookUrl ?? null} />
      )}

      {canManage && (mode === "connect" || mode === "ids") && (
        <form onSubmit={submit} className="mt-4 space-y-5 border-t border-line pt-4">
          {mode === "connect" && (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-ink">{t.credentialsTitle}</legend>
              <p className="text-xs text-ink-soft">{t.credentialsHint}</p>
              {gateway.credentialFields.map((field) => (
                <TextInput
                  key={field.key}
                  label={field.label[locale]}
                  type={field.secret ? "password" : "text"}
                  placeholder={field.placeholder}
                  value={credentials[field.key] ?? ""}
                  onChange={(v) => setCredentials((c) => ({ ...c, [field.key]: v }))}
                  disabled={busy}
                />
              ))}
            </fieldset>
          )}
          {!fromAccount && (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-ink">{t.methodsTitle}</legend>
              <p className="text-xs text-ink-soft">{t.methodsHint}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {gateway.settingFields.map((field) => (
                  <TextInput
                    key={field.key}
                    label={field.label[locale]}
                    inputMode="numeric"
                    value={ids[field.key] ?? ""}
                    onChange={(v) => setIds((c) => ({ ...c, [field.key]: v }))}
                    disabled={busy}
                  />
                ))}
              </div>
            </fieldset>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={busy}
              onClick={() => { setMode("view"); setCredentials({}); setError(null); }}
            >
              {common.cancel}
            </Button>
            <Button
              type="submit"
              className="min-h-11"
              disabled={busy || (!fromAccount && (!anyId || !idsValid)) || (mode === "connect" && !credentialsComplete)}
            >
              {busy ? fmt(t.checking, { name }) : mode === "connect" ? t.submitConnect : t.saveIds}
            </Button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={disconnecting}
        title={fmt(t.disconnectTitle, { name })}
        description={fmt(t.disconnectDescription, { name })}
        confirmLabel={t.disconnect}
        cancelLabel={common.cancel}
        busyLabel={common.loading}
        destructive
        onCancel={() => setDisconnecting(false)}
        onConfirm={confirmDisconnect}
      />
    </div>
  );
}

function WebhookUrl({ gateway, url }: { gateway: PaymentGatewayInfo; url: string }) {
  const t = useT(STRINGS);
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-ink">{t.webhookTitle}</p>
      <div className="flex items-center gap-2 rounded-[0.5rem] border border-line bg-paper px-3 py-2">
        <code dir="ltr" className="min-w-0 flex-1 truncate text-xs text-ink">
          {url}
        </code>
        <CopyButton value={url} label={t.copyWebhook} />
      </div>
      <p className="text-xs text-ink-soft">
        {fmt(gateway.webhookSetup.automatic ? t.webhookHintAutomatic : t.webhookHint, {
          field: gateway.webhookSetup.field,
          name: gateway.name,
        })}
      </p>
    </div>
  );
}

function SetupGuide({ gateway, webhookUrl }: { gateway: PaymentGatewayInfo; webhookUrl: string | null }) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  return (
    <div className="mt-4 space-y-3 rounded-[0.5rem] bg-paper px-4 py-3">
      <p className="text-sm font-medium text-ink">{fmt(t.setupTitle, { name: gateway.name })}</p>
      <ol className="list-decimal space-y-1.5 ps-5 text-sm text-ink-soft">
        {gateway.setupSteps[locale].map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {webhookUrl && <WebhookUrl gateway={gateway} url={webhookUrl} />}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span className="text-ink-soft">{t.helpLinks}:</span>
        {gateway.helpLinks.map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            {link.label[locale]}
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        ))}
      </div>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  disabled,
  type = "text",
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  type?: "text" | "password";
  placeholder?: string;
  inputMode?: "numeric";
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        dir="ltr"
        autoComplete="off"
        spellCheck={false}
        inputMode={inputMode}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-11"
      />
    </div>
  );
}

function MethodList({
  methods,
  gateways,
  canManage,
  onForbidden,
  onSaved,
}: {
  methods: PaymentMethodEntry[];
  gateways: PaymentGatewayInfo[];
  canManage: boolean;
  onForbidden: () => void;
  onSaved: (next: PaymentMethodEntry[]) => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  // Remounted (key) whenever the saved list changes, so the draft starts from it.
  const [draft, setDraft] = useState(methods);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameOf = (provider: string | null) => gateways.find((g) => g.code === provider)?.name ?? provider ?? "";
  const labelOf = (m: PaymentMethodEntry) =>
    m.method === "cod"
      ? t.methodCod
      : fmt(m.method === "card" ? t.methodCard : t.methodWallet, { name: nameOf(m.provider) });

  const dirty = JSON.stringify(draft.map((m) => [m.id, m.enabled])) !== JSON.stringify(methods.map((m) => [m.id, m.enabled]));

  function move(index: number, delta: number) {
    setDraft((list) => {
      const next = [...list];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const result = await apiClient.updatePaymentMethods(
        workspaceId,
        draft.map((m) => ({ id: m.id, enabled: m.enabled }))
      );
      toast.success(t.methodsSaved);
      onSaved(result.methods);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) onForbidden();
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-lg font-medium text-ink">{t.methodListTitle}</h2>
        <p className="mt-1 text-sm text-ink-soft">{t.methodListHint}</p>
      </div>
      <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line">
        {draft.map((m, index) => (
          <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <label className={cn("flex min-h-11 flex-1 items-center gap-3", !m.available && "opacity-60")}>
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={m.enabled}
                disabled={!canManage || busy}
                onChange={(e) => {
                  const on = e.target.checked;
                  // One gateway per method: switching this on switches off the
                  // same method on any other gateway.
                  setDraft((list) =>
                    list.map((x) =>
                      x.id === m.id
                        ? { ...x, enabled: on }
                        : on && m.method !== "cod" && x.method === m.method
                          ? { ...x, enabled: false }
                          : x
                    )
                  );
                }}
              />
              <span className="text-sm font-medium text-ink">{labelOf(m)}</span>
              {m.mode === "test" && m.method !== "cod" && (
                <StatusBadge value="test" tone="warning" text={t.modeTest} />
              )}
              {!m.available && <StatusBadge value="unavailable" tone="neutral" text={t.methodUnavailable} />}
            </label>
            {canManage && (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  className="min-h-11 min-w-11"
                  aria-label={t.moveUp}
                  disabled={busy || index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp className="size-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  className="min-h-11 min-w-11"
                  aria-label={t.moveDown}
                  disabled={busy || index === draft.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown className="size-4" aria-hidden />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {error && <Alert variant="danger">{error}</Alert>}
      {canManage && (
        <div className="flex justify-end">
          <Button className="min-h-11" disabled={!dirty || busy} onClick={save}>
            {t.saveMethods}
          </Button>
        </div>
      )}
    </section>
  );
}
