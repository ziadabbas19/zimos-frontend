import { useId, useState, type FormEvent } from "react";
import { Alert, Button, Input, Label, cn } from "@store-builder/ui";
import {
  ApiError,
  BOSTA_PACKAGE_TYPES,
  apiFieldProblems,
  type BostaSettings,
  type CarrierInfo,
  type CarrierPickupLocation,
  type ConnectCarrierPayload,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime } from "@/lib/format";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { BOSTA, SHIPPING_ROLES } from "./carriers";
import { BostaTierMapField } from "./BostaTierMapField";
import { pruneTierMap, useWeightTiers } from "./weightTiers";

const STRINGS = {
  en: {
    title: "Couriers",
    description: "Connect a courier account to book deliveries, print labels and get status updates from the order page.",
    notAvailableTitle: "Not available yet",
    notAvailable:
      "Courier integrations aren't switched on for your store yet. You can keep adding shipments by hand on each order.",
    viewOnly: "Only the store owner, a workspace manager or an order operator can connect couriers.",
    viewOnlyForbidden: "Your role can't manage couriers, so this is shown read-only.",
    notConnected: "Not connected",
    connected: "Connected",
    invalid: "Key rejected",
    invalidNote: "{name} rejected the saved API key. Enter a new key to keep booking deliveries.",
    connectedSince: "Connected {date}",
    lastVerified: "Last checked {date}",
    connect: "Connect {name}",
    step: "Step {n} of 2",
    keyStepTitle: "API key",
    keyLabel: "{name} API key",
    keyHint: "Find it in {name}'s dashboard, under Settings → API integration. We store it encrypted and never show it again.",
    fullAccessTitle: "Use a key with Full Access",
    fullAccess:
      "A Read/Write key can book deliveries but can't cancel them, so cancelling an order that has a {name} delivery would fail. We can't see a key's access level, so check it in {name}'s dashboard before you paste it.",
    verify: "Check key and continue",
    verifying: "Checking with {name}…",
    settingsStepTitle: "Pickup and labels",
    pickupLocation: "Pickup location",
    pickupHint: "Where {name}'s courier collects your parcels.",
    accountDefault: "{name} account default",
    defaultTag: "default",
    noLocations: "This {name} account has no pickup locations yet. Add one in {name}'s dashboard, or keep the account default.",
    packageType: "Package type",
    labelSize: "Label size",
    labelLanguage: "Label language",
    langAr: "Arabic",
    langEn: "English",
    saveSettings: "Save settings",
    loadingLocations: "Loading pickup locations…",
    editSettings: "Edit pickup and labels",
    replaceKey: "Replace API key",
    disconnect: "Disconnect",
    connectedToast: "{name} is connected. Choose where parcels are collected from.",
    savedToast: "{name} settings saved.",
    keyReplacedToast: "New {name} key saved.",
    locationReset:
      "The saved pickup location isn't in the account this key belongs to, so it was reset to the account default. Choose one below.",
    disconnectTitle: "Disconnect {name}?",
    disconnectDescription:
      "Existing {name} shipments keep their tracking numbers but stop updating. New shipments will be manual until you connect again.",
    disconnectConfirm: "Disconnect",
    disconnectedToast: "{name} disconnected.",
    summaryPickup: "Pickup: {value}",
    summaryPackage: "Package: {value}",
    summaryLabel: "Label: {size}, {lang}",
    summaryTiers: "Tiers mapped: {mapped} of {total}",
    webhookAuto: "Status updates arrive automatically. You can also press Sync on a shipment at any time.",
    webhookManual:
      "Automatic status updates need the server on a public HTTPS address, so for now use Sync on each shipment to pull its status.",
    unknownLocation: "a location no longer listed",
    chosenLocation: "your chosen location",
    parcel: "Parcel",
    document: "Document",
    lightBulky: "Light bulky",
    heavyBulky: "Heavy bulky",
  },
  ar: {
    title: "شركات الشحن",
    description: "اربط حساب شركة شحن لحجز الشحنات وطباعة البوالص ومتابعة حالتها من صفحة الأوردر.",
    notAvailableTitle: "غير متاح بعد",
    notAvailable: "ربط شركات الشحن غير مفعّل لمتجرك بعد. يمكنك الاستمرار في إضافة الشحنات يدويًا من كل أوردر.",
    viewOnly: "يمكن لمالك المتجر أو مدير مساحة العمل أو مسؤول الأوردرات فقط ربط شركات الشحن.",
    viewOnlyForbidden: "دورك لا يسمح بإدارة شركات الشحن، لذلك تظهر للعرض فقط.",
    notConnected: "غير مربوط",
    connected: "مربوط",
    invalid: "المفتاح مرفوض",
    invalidNote: "رفضت {name} مفتاح API المحفوظ. أدخل مفتاحًا جديدًا لمواصلة حجز الشحنات.",
    connectedSince: "مربوط منذ {date}",
    lastVerified: "آخر تحقق {date}",
    connect: "ربط {name}",
    step: "الخطوة {n} من 2",
    keyStepTitle: "مفتاح API",
    keyLabel: "مفتاح API الخاص بـ {name}",
    keyHint: "تجده في لوحة تحكم {name} من الإعدادات ← API integration. نحفظه مشفّرًا ولا نعرضه مرة أخرى.",
    fullAccessTitle: "استخدم مفتاحًا بصلاحية Full Access",
    fullAccess:
      "المفتاح بصلاحية Read/Write يستطيع حجز الشحنات لكنه لا يستطيع إلغاءها، لذلك سيفشل إلغاء أي أوردر له شحنة مع {name}. لا يمكننا معرفة صلاحية المفتاح، فتأكد منها في لوحة تحكم {name} قبل لصقه.",
    verify: "تحقق من المفتاح وتابع",
    verifying: "جارٍ التحقق مع {name}…",
    settingsStepTitle: "الاستلام والبوالص",
    pickupLocation: "مكان الاستلام",
    pickupHint: "المكان الذي يستلم منه مندوب {name} طرودك.",
    accountDefault: "الافتراضي في حساب {name}",
    defaultTag: "افتراضي",
    noLocations: "لا توجد أماكن استلام في حساب {name} بعد. أضف مكانًا من لوحة تحكم {name}، أو استخدم الافتراضي.",
    packageType: "نوع الطرد",
    labelSize: "مقاس البوليصة",
    labelLanguage: "لغة البوليصة",
    langAr: "العربية",
    langEn: "الإنجليزية",
    saveSettings: "حفظ الإعدادات",
    loadingLocations: "جارٍ تحميل أماكن الاستلام…",
    editSettings: "تعديل الاستلام والبوالص",
    replaceKey: "تغيير مفتاح API",
    disconnect: "إلغاء الربط",
    connectedToast: "تم ربط {name}. اختر مكان استلام الطرود.",
    savedToast: "تم حفظ إعدادات {name}.",
    keyReplacedToast: "تم حفظ مفتاح {name} الجديد.",
    locationReset:
      "مكان الاستلام المحفوظ غير موجود في الحساب الذي يتبعه هذا المفتاح، لذلك أُعيد إلى الافتراضي. اختر مكانًا بالأسفل.",
    disconnectTitle: "إلغاء ربط {name}؟",
    disconnectDescription:
      "شحنات {name} الحالية تحتفظ بأرقام التتبع لكن حالتها لن تتحدث. الشحنات الجديدة ستكون يدوية حتى تعيد الربط.",
    disconnectConfirm: "إلغاء الربط",
    disconnectedToast: "تم إلغاء ربط {name}.",
    summaryPickup: "الاستلام: {value}",
    summaryPackage: "الطرد: {value}",
    summaryLabel: "البوليصة: {size}، {lang}",
    summaryTiers: "الشرائح المربوطة: {mapped} من {total}",
    webhookAuto: "تصل تحديثات الحالة تلقائيًا. ويمكنك أيضًا الضغط على مزامنة في أي شحنة.",
    webhookManual: "التحديثات التلقائية تحتاج أن يكون الخادم على عنوان HTTPS عام، لذلك استخدم حاليًا زر المزامنة في كل شحنة.",
    unknownLocation: "مكان لم يعد موجودًا",
    chosenLocation: "المكان الذي اخترته",
    parcel: "طرد",
    document: "مستند",
    lightBulky: "حجم كبير خفيف",
    heavyBulky: "حجم كبير ثقيل",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

const PACKAGE_LABEL: Record<(typeof BOSTA_PACKAGE_TYPES)[number], keyof Strings> = {
  Parcel: "parcel",
  Document: "document",
  "Light Bulky": "lightBulky",
  "Heavy Bulky": "heavyBulky",
};

/** Courier connections on the Shipping page. Only Bosta has an adapter today. */
export function CarrierConnectionsSection() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const roleAllows = SHIPPING_ROLES.has(currentWorkspace?.role ?? "");
  const [forbidden, setForbidden] = useState(false);

  // GET /carriers needs shipping.manage or orders.manage — no point asking
  // for a role that has neither.
  const carriers = useAsync(
    () => (roleAllows ? apiClient.listCarriers(workspaceId) : Promise.resolve(null)),
    [workspaceId, roleAllows]
  );
  const list = carriers.data;
  const canManage = roleAllows && !forbidden;

  return (
    <section className="rounded-[var(--radius-card)] border border-line p-5">
      <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t.description}</p>

      <div className="mt-4 space-y-4">
        {!roleAllows ? (
          <Alert>{t.viewOnly}</Alert>
        ) : (
          <DataState loading={carriers.loading} error={carriers.error} onRetry={() => carriers.refresh()}>
            {list && !list.configured ? (
              // The platform has no credentials key: neutral, not an error.
              <div className="rounded-[0.5rem] border border-dashed border-line px-4 py-5">
                <p className="text-sm font-medium text-ink">{t.notAvailableTitle}</p>
                <p className="mt-1 text-sm text-ink-soft">{t.notAvailable}</p>
              </div>
            ) : (
              <>
                {forbidden && <Alert>{t.viewOnlyForbidden}</Alert>}
                {list?.carriers.map((carrier) => (
                  <CarrierCard
                    key={carrier.code}
                    carrier={carrier}
                    canManage={canManage}
                    onForbidden={() => setForbidden(true)}
                    onChanged={() => carriers.refresh({ silent: true })}
                  />
                ))}
              </>
            )}
          </DataState>
        )}
      </div>
    </section>
  );
}

type Mode = "view" | "key" | "settings";

function CarrierCard({
  carrier,
  canManage,
  onForbidden,
  onChanged,
}: {
  carrier: CarrierInfo;
  canManage: boolean;
  onForbidden: () => void;
  onChanged: () => void;
}) {
  const t = useT(STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const name = carrier.name;
  const connection = carrier.connection;
  const isBosta = carrier.code === BOSTA;

  const [mode, setMode] = useState<Mode>("view");
  const [firstConnect, setFirstConnect] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [locations, setLocations] = useState<CarrierPickupLocation[] | null>(null);
  const [draft, setDraft] = useState<BostaSettings>({});
  const [busy, setBusy] = useState<"verify" | "save" | "load" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const current = (connection?.settings ?? {}) as BostaSettings;
  const tiers = useWeightTiers();
  const mappedTiers = Object.keys(pruneTierMap(current.tierMap, tiers.data) ?? {}).length;

  function fail(err: unknown) {
    if (err instanceof ApiError && err.status === 403) {
      toast.error(errorMessage(err));
      onForbidden();
      setMode("view");
      return;
    }
    setError(errorMessage(err));
  }

  async function put(payload: ConnectCarrierPayload) {
    return apiClient.connectCarrier(workspaceId, carrier.code, payload);
  }

  function openSettings(result: Awaited<ReturnType<typeof put>>) {
    const next = (result.carrier.connection?.settings ?? {}) as BostaSettings;
    setLocations(result.verification.pickupLocations ?? []);
    setDraft(next);
    setMode("settings");
  }

  async function submitKey(e: FormEvent) {
    e.preventDefault();
    const key = apiKey.trim();
    if (!key) return;
    setBusy("verify");
    setError(null);
    setNotice(null);
    const wasConnected = Boolean(connection);
    try {
      let result;
      try {
        // Credentials only: the stored settings are kept and re-checked
        // against the new key's account.
        result = await put({ credentials: { apiKey: key } });
      } catch (err) {
        // The saved pickup location belongs to another Bosta account. Keep
        // the rest and fall back to the account default; step 2 asks again.
        if (wasConnected && apiFieldProblems(err).some((p) => p.field === "settings.businessLocationId")) {
          result = await put({ credentials: { apiKey: key }, settings: { ...current, businessLocationId: null } });
          setNotice(t.locationReset);
        } else {
          throw err;
        }
      }
      setApiKey("");
      setFirstConnect(!wasConnected);
      toast.success(fmt(wasConnected ? t.keyReplacedToast : t.connectedToast, { name }));
      onChanged();
      openSettings(result);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  }

  /** Pickup locations only come back from a verifying PUT, so editing re-checks the stored key. */
  async function startEditSettings() {
    setBusy("load");
    setError(null);
    setNotice(null);
    try {
      openSettings(await put({ settings: { ...current } }));
      setFirstConnect(false);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  }

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    setBusy("save");
    setError(null);
    try {
      await put({
        settings: {
          ...draft,
          businessLocationId: draft.businessLocationId || null,
          tierMap: pruneTierMap(draft.tierMap, tiers.data) ?? {},
        },
      });
      toast.success(fmt(t.savedToast, { name }));
      setMode("view");
      setNotice(null);
      onChanged();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  }

  async function confirmDisconnect() {
    try {
      await apiClient.disconnectCarrier(workspaceId, carrier.code);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setDisconnecting(false);
        fail(err);
        return;
      }
      throw new Error(errorMessage(err));
    }
    setDisconnecting(false);
    setMode("view");
    toast.success(fmt(t.disconnectedToast, { name }));
    onChanged();
  }

  const statusBadge = !connection ? (
    <StatusBadge value="not_connected" tone="neutral" text={t.notConnected} />
  ) : connection.status === "invalid" ? (
    <StatusBadge value="invalid" tone="danger" text={t.invalid} />
  ) : (
    <StatusBadge value="connected" tone="success" text={t.connected} />
  );

  // Location names only come back from a verifying PUT; before one, all we
  // know is that a location was chosen.
  const pickupSummary = !current.businessLocationId
    ? fmt(t.accountDefault, { name })
    : locations
      ? (locations.find((l) => l.id === current.businessLocationId)?.name ?? t.unknownLocation)
      : t.chosenLocation;

  return (
    <div className="rounded-[0.5rem] border border-line p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-medium text-ink">{name}</h3>
            {statusBadge}
          </div>
          {connection && (
            <p className="mt-1 text-xs text-ink-soft">
              {fmt(t.connectedSince, { date: formatDateTime(connection.connectedAt) })}
              {connection.lastVerifiedAt && <> · {fmt(t.lastVerified, { date: formatDateTime(connection.lastVerifiedAt) })}</>}
            </p>
          )}
        </div>
        {canManage && mode === "view" && !connection && (
          <Button className="min-h-11" onClick={() => setMode("key")}>
            {fmt(t.connect, { name })}
          </Button>
        )}
      </div>

      {connection?.status === "invalid" && mode === "view" && (
        <Alert variant="danger" className="mt-3">
          {fmt(t.invalidNote, { name })}
        </Alert>
      )}

      {connection && mode === "view" && isBosta && (
        <div className="mt-3 space-y-2 text-sm text-ink-soft">
          <p>
            {fmt(t.summaryPickup, { value: pickupSummary })}
            {current.packageType && (
              <> · {fmt(t.summaryPackage, { value: t[PACKAGE_LABEL[current.packageType]] })}</>
            )}
            {(current.awbType || current.awbLang) && (
              <>
                {" · "}
                {fmt(t.summaryLabel, {
                  size: current.awbType ?? "A4",
                  lang: current.awbLang === "en" ? t.langEn : t.langAr,
                })}
              </>
            )}
          </p>
          {mappedTiers > 0 && tiers.data && (
            <p>{fmt(t.summaryTiers, { mapped: mappedTiers, total: tiers.data.length })}</p>
          )}
          <p className="text-xs">
            {/^https:\/\//i.test(connection.webhookUrl) ? t.webhookAuto : t.webhookManual}
          </p>
        </div>
      )}

      {canManage && connection && mode === "view" && (
        <div className="mt-4 flex flex-wrap gap-2">
          {isBosta && (
            <Button variant="outline" className="min-h-11" disabled={busy !== null} onClick={startEditSettings}>
              {busy === "load" ? t.loadingLocations : t.editSettings}
            </Button>
          )}
          <Button
            variant={connection.status === "invalid" ? "primary" : "outline"}
            className="min-h-11"
            disabled={busy !== null}
            onClick={() => {
              setError(null);
              setMode("key");
            }}
          >
            {t.replaceKey}
          </Button>
          <Button
            variant="ghost"
            className="min-h-11 text-danger hover:bg-danger-soft"
            disabled={busy !== null}
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

      {canManage && mode === "key" && (
        <form onSubmit={submitKey} className="mt-4 space-y-4 border-t border-line pt-4">
          <StepHeading step={connection ? null : 1} title={t.keyStepTitle} />
          <FullAccessNotice name={name} />
          <KeyField name={name} value={apiKey} onChange={setApiKey} disabled={busy !== null} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={busy !== null}
              onClick={() => {
                setMode("view");
                setApiKey("");
                setError(null);
              }}
            >
              {common.cancel}
            </Button>
            <Button type="submit" className="min-h-11" disabled={busy !== null || apiKey.trim().length < 10}>
              {busy === "verify" ? fmt(t.verifying, { name }) : t.verify}
            </Button>
          </div>
        </form>
      )}

      {canManage && mode === "settings" && isBosta && locations && (
        <form onSubmit={saveSettings} className="mt-4 space-y-4 border-t border-line pt-4">
          <StepHeading step={firstConnect ? 2 : null} title={t.settingsStepTitle} />
          {notice && <Alert>{notice}</Alert>}
          <PickupLocationField
            name={name}
            locations={locations}
            value={draft.businessLocationId ?? ""}
            onChange={(id) => setDraft((d) => ({ ...d, businessLocationId: id || null }))}
            disabled={busy !== null}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField
              label={t.packageType}
              value={draft.packageType ?? "Parcel"}
              onChange={(v) => setDraft((d) => ({ ...d, packageType: v as BostaSettings["packageType"] }))}
              options={BOSTA_PACKAGE_TYPES.map((p) => ({ value: p, label: t[PACKAGE_LABEL[p]] }))}
              disabled={busy !== null}
            />
            <SelectField
              label={t.labelSize}
              value={draft.awbType ?? "A4"}
              onChange={(v) => setDraft((d) => ({ ...d, awbType: v as "A4" | "A6" }))}
              options={[
                { value: "A4", label: "A4" },
                { value: "A6", label: "A6" },
              ]}
              disabled={busy !== null}
            />
            <SelectField
              label={t.labelLanguage}
              value={draft.awbLang ?? "ar"}
              onChange={(v) => setDraft((d) => ({ ...d, awbLang: v as "ar" | "en" }))}
              options={[
                { value: "ar", label: t.langAr },
                { value: "en", label: t.langEn },
              ]}
              disabled={busy !== null}
            />
          </div>
          <BostaTierMapField
            tiers={tiers.data}
            loading={tiers.loading}
            value={pruneTierMap(draft.tierMap, tiers.data)}
            onChange={(tierMap) => setDraft((d) => ({ ...d, tierMap }))}
            disabled={busy !== null}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={busy !== null}
              onClick={() => {
                setMode("view");
                setNotice(null);
                setError(null);
              }}
            >
              {common.cancel}
            </Button>
            <Button type="submit" className="min-h-11" disabled={busy !== null}>
              {busy === "save" ? common.saving : t.saveSettings}
            </Button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={disconnecting}
        title={fmt(t.disconnectTitle, { name })}
        description={fmt(t.disconnectDescription, { name })}
        confirmLabel={t.disconnectConfirm}
        cancelLabel={common.cancel}
        busyLabel={common.loading}
        destructive
        onCancel={() => setDisconnecting(false)}
        onConfirm={confirmDisconnect}
      />
    </div>
  );
}

function StepHeading({ step, title }: { step: number | null; title: string }) {
  const t = useT(STRINGS);
  return (
    <div>
      {step !== null && <p className="text-xs font-medium text-ink-soft">{fmt(t.step, { n: step })}</p>}
      <h4 className="text-sm font-medium text-ink">{title}</h4>
    </div>
  );
}

/** The Read/Write-can't-cancel trap. Always shown next to the key field: the scope is invisible to us. */
function FullAccessNotice({ name }: { name: string }) {
  const t = useT(STRINGS);
  return (
    <div className="rounded-[0.5rem] border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-accent-dark">
      <p className="font-medium">{t.fullAccessTitle}</p>
      <p className="mt-0.5">{fmt(t.fullAccess, { name })}</p>
    </div>
  );
}

function KeyField({
  name,
  value,
  onChange,
  disabled,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const t = useT(STRINGS);
  const id = useId();
  const hintId = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{fmt(t.keyLabel, { name })}</Label>
      <Input
        id={id}
        type="password"
        dir="ltr"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-describedby={hintId}
        className="h-11"
      />
      <p id={hintId} className="text-xs text-ink-soft">
        {fmt(t.keyHint, { name })}
      </p>
    </div>
  );
}

function PickupLocationField({
  name,
  locations,
  value,
  onChange,
  disabled,
}: {
  name: string;
  locations: CarrierPickupLocation[];
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
}) {
  const t = useT(STRINGS);
  const labelId = useId();
  const hintId = useId();
  const options = [{ id: "", label: fmt(t.accountDefault, { name }), isDefault: false }].concat(
    locations.map((l) => ({ id: l.id, label: l.name || l.id, isDefault: l.isDefault }))
  );
  return (
    <div className="space-y-2">
      <div>
        <p id={labelId} className="text-sm font-medium text-ink">
          {t.pickupLocation}
        </p>
        <p id={hintId} className="text-xs text-ink-soft">
          {fmt(t.pickupHint, { name })}
        </p>
      </div>
      <div role="radiogroup" aria-labelledby={labelId} aria-describedby={hintId} className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const checked = value === option.id;
          return (
            <label
              key={option.id || "default"}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-2 rounded-[0.5rem] border px-3 py-2 text-sm transition-colors",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
                checked ? "border-primary bg-primary-soft/40 font-medium text-ink" : "border-line text-ink-soft hover:border-primary/50",
                "has-[:disabled]:cursor-default has-[:disabled]:opacity-80"
              )}
            >
              <input
                type="radio"
                name="pickup-location"
                value={option.id}
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(option.id)}
                className="size-4 shrink-0 accent-primary"
              />
              <span className="min-w-0 flex-1 truncate" dir="auto">
                {option.label}
              </span>
              {option.isDefault && <span className="text-xs text-ink-soft">({t.defaultTag})</span>}
            </label>
          );
        })}
      </div>
      {locations.length === 0 && <p className="text-xs text-ink-soft">{fmt(t.noLocations, { name })}</p>}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled: boolean;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="h-11">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
