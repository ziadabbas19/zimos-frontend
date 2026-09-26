import { useId, useState, type FormEvent } from "react";
import { Alert, Button, Input, Label, cn } from "@store-builder/ui";
import {
  ApiError,
  BOSTA_PACKAGE_TYPES,
  apiFieldProblems,
  isApiErrorCode,
  type BostaTierPackage,
  type CarrierFieldDescriptor,
  type CarrierInfo,
  type CarrierPickupLocation,
  type ConnectCarrierPayload,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useCarrierErrorMessage, useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime } from "@/lib/format";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { CopyButton } from "@/components/CopyButton";
import { ProviderLogo } from "@/components/ProviderLogo";
import {
  ENVIRONMENT_FIELD,
  SHIPPING_ROLES,
  carrierEnvironment,
  rememberCarrierEnvironment,
} from "./carriers";
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
    connectedToastPlain: "{name} is connected.",
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
    // any courier (fields come from the server)
    keyHintGeneric: "Find it in {name}'s dashboard. We store it encrypted and never show it again.",
    settingsTitleGeneric: "Settings",
    editSettingsGeneric: "Edit settings",
    summaryValue: "{label}: {value}",
    notSet: "not set",
    connectConflict:
      "{name} was connected from another tab or by a teammate at the same moment, so this save didn't go through. The card now shows that connection. Check it, then save again if you need to.",
    webhookAccount:
      "For automatic status updates, paste this address into the webhook settings of your {name} dashboard:",
    webhookPolling: "We check {name} for status updates regularly. You can also press Sync on a shipment at any time.",
    webhookNone: "{name} doesn't send status updates. Press Sync on a shipment to pull its latest status.",
    copyWebhook: "Copy address",
    manualCancelNote:
      "{name} can't cancel deliveries from here. To call one off, cancel it in your {name} dashboard first, then confirm it here when you cancel the order or the shipment.",
    sandbox: "Sandbox",
    sandboxNote:
      "This connection uses the {name} sandbox. It only creates test shipments and nothing is delivered. Replace the key with a production {name} account to book real orders.",
    environment: "Environment",
    envProduction: "Production (real shipments)",
    envSandbox: "Sandbox (test shipments only)",
    environmentHint: "The sandbox only creates test shipments and never delivers them. Use Production for real orders.",
    sandboxNotAllowed:
      "The {name} sandbox only creates test shipments, so it's available to test stores only. A production {name} account is required: choose Production and enter your production {name} details.",
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
    connectedToastPlain: "تم ربط {name}.",
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
    keyHintGeneric: "تجده في لوحة تحكم {name}. نحفظه مشفّرًا ولا نعرضه مرة أخرى.",
    settingsTitleGeneric: "الإعدادات",
    editSettingsGeneric: "تعديل الإعدادات",
    summaryValue: "{label}: {value}",
    notSet: "غير محدد",
    connectConflict:
      "تم ربط {name} من تبويب آخر أو بواسطة زميل في نفس اللحظة، لذلك لم يُحفظ هذا الطلب. البطاقة تعرض الآن ذلك الربط. راجعه، ثم احفظ مرة أخرى إذا احتجت.",
    webhookAccount: "لتصلك تحديثات الحالة تلقائيًا، الصق هذا العنوان في إعدادات الـ webhook في لوحة تحكم {name}:",
    webhookPolling: "نراجع حالة الشحنات مع {name} بانتظام. ويمكنك أيضًا الضغط على مزامنة في أي شحنة.",
    webhookNone: "{name} لا ترسل تحديثات الحالة. اضغط مزامنة في الشحنة لجلب آخر حالة لها.",
    copyWebhook: "نسخ العنوان",
    manualCancelNote:
      "لا يمكن إلغاء شحنات {name} من هنا. لإلغاء شحنة، ألغِها من لوحة تحكم {name} أولًا، ثم أكّد ذلك هنا عند إلغاء الأوردر أو الشحنة.",
    sandbox: "تجريبي (Sandbox)",
    sandboxNote:
      "هذا الربط يستخدم بيئة التجربة (Sandbox) الخاصة بـ {name}. هي تنشئ شحنات تجريبية فقط ولا يتم توصيل أي شيء. غيّر المفتاح إلى حساب إنتاج (Production) لدى {name} لحجز أوردرات حقيقية.",
    environment: "البيئة",
    envProduction: "الإنتاج Production (شحنات حقيقية)",
    envSandbox: "التجربة Sandbox (شحنات تجريبية فقط)",
    environmentHint: "بيئة التجربة تنشئ شحنات تجريبية فقط ولا توصّلها أبدًا. استخدم الإنتاج للأوردرات الحقيقية.",
    sandboxNotAllowed:
      "بيئة التجربة (Sandbox) لدى {name} تنشئ شحنات تجريبية فقط، لذلك هي متاحة لمتاجر الاختبار فقط. يلزم حساب إنتاج (Production) لدى {name}: اختر الإنتاج وأدخل بيانات حسابك الفعلي لدى {name}.",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

const PACKAGE_LABEL: Record<(typeof BOSTA_PACKAGE_TYPES)[number], keyof Strings> = {
  Parcel: "parcel",
  Document: "document",
  "Light Bulky": "lightBulky",
  "Heavy Bulky": "heavyBulky",
};

/** Setting keys we have our own en/ar label for; any other field shows the server's label. */
const SETTING_LABEL: Record<string, keyof Strings> = {
  packageType: "packageType",
  awbType: "labelSize",
  awbLang: "labelLanguage",
};

/**
 * Courier-specific guidance the server doesn't describe: copy, and a
 * pre-check on the key's length. The form itself always comes from the
 * courier's credentialFields / settingFields on GET /carriers.
 */
interface CarrierGuide {
  keyHint: keyof Strings;
  /** The Read/Write-can't-cancel notice next to the key field. */
  fullAccessNotice: boolean;
  /** Shortest secret the Check button accepts. */
  minSecretLength: number;
  settingsTitle: keyof Strings;
  editSettings: keyof Strings;
  /** "Pickup: … · Package: … · Label: A4, Arabic" instead of one entry per field. */
  pickupPackageLabelSummary: boolean;
}

const GENERIC_GUIDE: CarrierGuide = {
  keyHint: "keyHintGeneric",
  fullAccessNotice: false,
  minSecretLength: 1,
  settingsTitle: "settingsTitleGeneric",
  editSettings: "editSettingsGeneric",
  pickupPackageLabelSummary: false,
};

const GUIDES: Record<string, CarrierGuide> = {
  bosta: {
    keyHint: "keyHint",
    fullAccessNotice: true,
    minSecretLength: 10,
    settingsTitle: "settingsStepTitle",
    editSettings: "editSettings",
    pickupPackageLabelSummary: true,
  },
};

/**
 * A setting that holds a pickup location id. Its choices are the
 * verification's pickupLocations, which only a verifying PUT returns.
 */
const isPickupField = (f: CarrierFieldDescriptor) => !f.options && f.kind !== "tier_map" && /locationid$/i.test(f.key);
const isTierMapField = (f: CarrierFieldDescriptor) => f.kind === "tier_map";

type Settings = Record<string, unknown>;
type TierMap = Record<string, BostaTierPackage>;

/** Courier connections on the Shipping page, one card per courier the server offers this store. */
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
            {list && (!list.configured || list.carriers.length === 0) ? (
              // The platform has no credentials key (or offers this store no
              // courier): neutral, not an error.
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
  const carrierError = useCarrierErrorMessage();
  const name = carrier.name;
  const connection = carrier.connection;
  const environment = carrierEnvironment(workspaceId, carrier);
  const guide = GUIDES[carrier.code] ?? GENERIC_GUIDE;

  const credentialFields = carrier.credentialFields ?? [];
  const settingFields = carrier.settingFields ?? [];
  const pickupField = settingFields.find(isPickupField);
  const tierField = settingFields.find(isTierMapField);
  const plainFields = settingFields.filter((f) => f !== pickupField && f !== tierField);
  const hasSettings = settingFields.length > 0;
  const webhookSetup = carrier.capabilities?.webhook ?? carrier.webhookSetup;

  const [mode, setMode] = useState<Mode>("view");
  const [firstConnect, setFirstConnect] = useState(false);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [locations, setLocations] = useState<CarrierPickupLocation[] | null>(null);
  const [draft, setDraft] = useState<Settings>({});
  const [busy, setBusy] = useState<"verify" | "save" | "load" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [credentialErrors, setCredentialErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const current: Settings = connection?.settings ?? {};
  const tiers = useWeightTiers();
  const currentTierMap = tierField ? (current[tierField.key] as TierMap | undefined) : undefined;
  const mappedTiers = Object.keys(pruneTierMap(currentTierMap, tiers.data) ?? {}).length;

  // A field with options is a select, so it always has a value: the one
  // chosen, else what this connection uses now, else the first option.
  const defaultOption = (f: CarrierFieldDescriptor) =>
    f.key === ENVIRONMENT_FIELD && environment && f.options?.includes(environment) ? environment : (f.options?.[0] ?? "");
  const typed: Record<string, string> = Object.fromEntries(
    credentialFields.map((f) => [f.key, (credentials[f.key] ?? (f.options?.length ? defaultOption(f) : "")).trim()])
  );
  const credentialsReady =
    credentialFields.length > 0 &&
    credentialFields.every((f) => typed[f.key].length >= (f.secret ? guide.minSecretLength : 1));

  function fail(err: unknown) {
    if (err instanceof ApiError && err.status === 403) {
      toast.error(errorMessage(err));
      onForbidden();
      setMode("view");
      return;
    }
    if (isApiErrorCode(err, "CARRIER_CONNECT_CONFLICT")) {
      // Another request's first connect won; nothing of ours was stored.
      // Show that connection so the merchant can check it before saving again.
      setError(fmt(t.connectConflict, { name }));
      setCredentials({});
      setMode("view");
      onChanged();
      return;
    }
    setError(carrierError(err, carrier));
  }

  function cancelEditing() {
    setMode("view");
    setCredentials({});
    setCredentialErrors({});
    setNotice(null);
    setError(null);
  }

  async function put(payload: ConnectCarrierPayload) {
    return apiClient.connectCarrier(workspaceId, carrier.code, payload);
  }

  /** `result` is a verifying PUT's answer; null opens the stored settings as they are. */
  function openSettings(result: Awaited<ReturnType<typeof put>> | null) {
    const next: Settings = result ? (result.carrier.connection?.settings ?? {}) : current;
    setLocations(result && pickupField ? (result.verification.pickupLocations ?? []) : null);
    setDraft(next);
    setMode("settings");
  }

  async function submitKey(e: FormEvent) {
    e.preventDefault();
    if (!credentialsReady) return;
    setBusy("verify");
    setError(null);
    setCredentialErrors({});
    setNotice(null);
    const wasConnected = Boolean(connection);
    try {
      let result;
      try {
        // Credentials only: the stored settings are kept and re-checked
        // against the new key's account.
        result = await put({ credentials: typed });
      } catch (err) {
        // The saved pickup location belongs to another account. Keep the
        // rest and fall back to the account default; step 2 asks again.
        const pickupKey = pickupField?.key;
        if (wasConnected && pickupKey && apiFieldProblems(err).some((p) => p.field === `settings.${pickupKey}`)) {
          result = await put({ credentials: typed, settings: { ...current, [pickupKey]: null } });
          setNotice(t.locationReset);
        } else {
          throw err;
        }
      }
      const connectedAt = result.carrier.connection?.connectedAt;
      if (credentialFields.some((f) => f.key === ENVIRONMENT_FIELD) && connectedAt) {
        rememberCarrierEnvironment(workspaceId, carrier.code, {
          environment: typed[ENVIRONMENT_FIELD] === "sandbox" ? "sandbox" : "production",
          connectedAt,
        });
      }
      setCredentials({});
      setFirstConnect(!wasConnected);
      toast.success(
        fmt(wasConnected ? t.keyReplacedToast : pickupField ? t.connectedToast : t.connectedToastPlain, { name })
      );
      onChanged();
      if (hasSettings) openSettings(result);
      else setMode("view");
    } catch (err) {
      // 422 on credentials.environment: a sandbox this store may not use.
      if (apiFieldProblems(err).some((p) => p.field === `credentials.${ENVIRONMENT_FIELD}`)) {
        setCredentialErrors({ [ENVIRONMENT_FIELD]: fmt(t.sandboxNotAllowed, { name }) });
        return;
      }
      fail(err);
    } finally {
      setBusy(null);
    }
  }

  /** Pickup locations only come back from a verifying PUT, so editing those re-checks the stored key. */
  async function startEditSettings() {
    setError(null);
    setNotice(null);
    setFirstConnect(false);
    if (!pickupField) {
      openSettings(null);
      return;
    }
    setBusy("load");
    try {
      openSettings(await put({ settings: { ...current } }));
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
    const settings: Settings = { ...draft };
    if (pickupField) settings[pickupField.key] = draft[pickupField.key] || null;
    if (tierField) settings[tierField.key] = pruneTierMap(draft[tierField.key] as TierMap | undefined, tiers.data) ?? {};
    // An emptied free-text setting is left out rather than sent as "".
    for (const f of plainFields) if (!f.options && settings[f.key] === "") delete settings[f.key];
    try {
      await put({ settings });
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
    rememberCarrierEnvironment(workspaceId, carrier.code, null);
    setDisconnecting(false);
    setMode("view");
    toast.success(fmt(t.disconnectedToast, { name }));
    onChanged();
  }

  function settingLabel(field: CarrierFieldDescriptor): string {
    const own = SETTING_LABEL[field.key];
    return own ? t[own] : field.label;
  }

  function optionLabel(field: CarrierFieldDescriptor, option: string): string {
    if (field.key === "packageType" && option in PACKAGE_LABEL) {
      return t[PACKAGE_LABEL[option as keyof typeof PACKAGE_LABEL]];
    }
    if (field.key === "awbLang" && (option === "ar" || option === "en")) return option === "en" ? t.langEn : t.langAr;
    return option;
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
  const currentPickup = pickupField ? current[pickupField.key] : null;
  const pickupSummary = !currentPickup
    ? fmt(t.accountDefault, { name })
    : locations
      ? (locations.find((l) => l.id === currentPickup)?.name ?? t.unknownLocation)
      : t.chosenLocation;

  return (
    <div className="rounded-[0.5rem] border border-line p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <ProviderLogo code={carrier.code} name={name} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-medium text-ink">{name}</h3>
              {statusBadge}
              {environment === "sandbox" && <StatusBadge value="sandbox" tone="warning" text={t.sandbox} />}
            </div>
            {connection && (
              <p className="mt-1 text-xs text-ink-soft">
                {fmt(t.connectedSince, { date: formatDateTime(connection.connectedAt) })}
                {connection.lastVerifiedAt && <> · {fmt(t.lastVerified, { date: formatDateTime(connection.lastVerifiedAt) })}</>}
              </p>
            )}
          </div>
        </div>
        {canManage && mode === "view" && !connection && (
          <Button className="min-h-11" onClick={() => setMode("key")}>
            {fmt(t.connect, { name })}
          </Button>
        )}
      </div>

      {environment === "sandbox" && mode === "view" && (
        <div className="mt-3 rounded-[0.5rem] border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-accent-dark">
          {fmt(t.sandboxNote, { name })}
        </div>
      )}

      {connection?.status === "invalid" && mode === "view" && (
        <Alert variant="danger" className="mt-3">
          {fmt(t.invalidNote, { name })}
        </Alert>
      )}

      {connection && mode === "view" && (
        <div className="mt-3 space-y-2 text-sm text-ink-soft">
          {guide.pickupPackageLabelSummary ? (
            <PickupPackageLabelSummary settings={current} pickup={pickupSummary} />
          ) : (
            <GenericSummary
              entries={[
                ...(pickupField ? [fmt(t.summaryValue, { label: t.pickupLocation, value: pickupSummary })] : []),
                ...plainFields
                  .filter((f) => !f.secret && current[f.key] != null && current[f.key] !== "")
                  .map((f) =>
                    fmt(t.summaryValue, { label: settingLabel(f), value: optionLabel(f, String(current[f.key])) })
                  ),
              ]}
            />
          )}
          {tierField && mappedTiers > 0 && tiers.data && (
            <p>{fmt(t.summaryTiers, { mapped: mappedTiers, total: tiers.data.length })}</p>
          )}
          <WebhookNote
            setup={webhookSetup}
            polling={Boolean(carrier.capabilities?.polling)}
            name={name}
            url={connection.webhookUrl}
          />
          {carrier.capabilities?.cancel === "manual" && <p className="text-xs">{fmt(t.manualCancelNote, { name })}</p>}
        </div>
      )}

      {canManage && connection && mode === "view" && (
        <div className="mt-4 flex flex-wrap gap-2">
          {hasSettings && (
            <Button variant="outline" className="min-h-11" disabled={busy !== null} onClick={startEditSettings}>
              {busy === "load" ? t.loadingLocations : t[guide.editSettings]}
            </Button>
          )}
          <Button
            variant={connection.status === "invalid" ? "primary" : "outline"}
            className="min-h-11"
            disabled={busy !== null}
            onClick={() => {
              setError(null);
              setCredentialErrors({});
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
          <StepHeading step={connection || !hasSettings ? null : 1} title={t.keyStepTitle} />
          {guide.fullAccessNotice && <FullAccessNotice name={name} />}
          <CredentialFields
            name={name}
            fields={credentialFields}
            values={{ ...typed, ...credentials }}
            errors={credentialErrors}
            onChange={(key, value) => {
              setCredentials((c) => ({ ...c, [key]: value }));
              setCredentialErrors((e) => {
                if (!(key in e)) return e;
                const rest = { ...e };
                delete rest[key];
                return rest;
              });
            }}
            hint={fmt(t[guide.keyHint], { name })}
            disabled={busy !== null}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" className="min-h-11" disabled={busy !== null} onClick={cancelEditing}>
              {common.cancel}
            </Button>
            <Button type="submit" className="min-h-11" disabled={busy !== null || !credentialsReady}>
              {busy === "verify" ? fmt(t.verifying, { name }) : t.verify}
            </Button>
          </div>
        </form>
      )}

      {canManage && mode === "settings" && (!pickupField || locations) && (
        <form onSubmit={saveSettings} className="mt-4 space-y-4 border-t border-line pt-4">
          <StepHeading step={firstConnect ? 2 : null} title={t[guide.settingsTitle]} />
          {notice && <Alert>{notice}</Alert>}
          {pickupField && locations && (
            <PickupLocationField
              name={name}
              locations={locations}
              value={String(draft[pickupField.key] ?? "")}
              onChange={(id) => setDraft((d) => ({ ...d, [pickupField.key]: id || null }))}
              disabled={busy !== null}
            />
          )}
          {plainFields.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-3">
              {plainFields.map((f) =>
                f.options && f.options.length > 0 ? (
                  <SelectField
                    key={f.key}
                    label={settingLabel(f)}
                    value={String(draft[f.key] ?? f.options[0])}
                    onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
                    options={f.options.map((o) => ({ value: o, label: optionLabel(f, o) }))}
                    disabled={busy !== null}
                  />
                ) : (
                  <TextSettingField
                    key={f.key}
                    label={settingLabel(f)}
                    value={String(draft[f.key] ?? "")}
                    secret={Boolean(f.secret)}
                    onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
                    disabled={busy !== null}
                  />
                )
              )}
            </div>
          )}
          {tierField && (
            <BostaTierMapField
              tiers={tiers.data}
              loading={tiers.loading}
              value={pruneTierMap(draft[tierField.key] as TierMap | undefined, tiers.data)}
              onChange={(tierMap) => setDraft((d) => ({ ...d, [tierField.key]: tierMap }))}
              disabled={busy !== null}
            />
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" className="min-h-11" disabled={busy !== null} onClick={cancelEditing}>
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

/** Bosta's one-line summary: pickup, package type and label format. */
function PickupPackageLabelSummary({ settings, pickup }: { settings: Settings; pickup: string }) {
  const t = useT(STRINGS);
  const packageType = settings.packageType as (typeof BOSTA_PACKAGE_TYPES)[number] | undefined;
  const awbType = settings.awbType as string | undefined;
  const awbLang = settings.awbLang as string | undefined;
  return (
    <p>
      {fmt(t.summaryPickup, { value: pickup })}
      {packageType && PACKAGE_LABEL[packageType] && (
        <> · {fmt(t.summaryPackage, { value: t[PACKAGE_LABEL[packageType]] })}</>
      )}
      {(awbType || awbLang) && (
        <>
          {" · "}
          {fmt(t.summaryLabel, {
            size: awbType ?? "A4",
            lang: awbLang === "en" ? t.langEn : t.langAr,
          })}
        </>
      )}
    </p>
  );
}

function GenericSummary({ entries }: { entries: string[] }) {
  if (entries.length === 0) return null;
  return <p dir="auto">{entries.join(" · ")}</p>;
}

/** How status updates reach us, from the courier's webhook capability. */
function WebhookNote({
  setup,
  polling,
  name,
  url,
}: {
  setup: CarrierInfo["webhookSetup"];
  polling: boolean;
  name: string;
  url: string;
}) {
  const t = useT(STRINGS);
  const publicUrl = /^https:\/\//i.test(url);
  if (setup === "per_shipment") return <p className="text-xs">{publicUrl ? t.webhookAuto : t.webhookManual}</p>;
  if (setup === "account") {
    if (!publicUrl) return <p className="text-xs">{t.webhookManual}</p>;
    return (
      <div className="space-y-1 text-xs">
        <p>{fmt(t.webhookAccount, { name })}</p>
        <div className="flex flex-wrap items-center gap-2">
          <code dir="ltr" className="min-w-0 break-all rounded bg-paper px-2 py-1 text-ink">
            {url}
          </code>
          <CopyButton value={url} label={t.copyWebhook} />
        </div>
      </div>
    );
  }
  return <p className="text-xs">{fmt(polling ? t.webhookPolling : t.webhookNone, { name })}</p>;
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

/**
 * The courier's credential fields, as GET /carriers describes them. An
 * "apiKey" field gets our own "{name} API key" label, and "environment" our
 * own label and options; other fields show the server's label. A field with
 * options is a select. Secrets are masked and never prefilled.
 */
function CredentialFields({
  name,
  fields,
  values,
  errors,
  onChange,
  hint,
  disabled,
}: {
  name: string;
  fields: CarrierFieldDescriptor[];
  values: Record<string, string>;
  errors: Record<string, string>;
  onChange: (key: string, value: string) => void;
  hint: string;
  disabled: boolean;
}) {
  const t = useT(STRINGS);
  const baseId = useId();
  const hintId = useId();
  const label = (field: CarrierFieldDescriptor) =>
    field.key === "apiKey" ? fmt(t.keyLabel, { name }) : field.key === ENVIRONMENT_FIELD ? t.environment : field.label;
  const optionLabel = (field: CarrierFieldDescriptor, option: string) => {
    if (field.key !== ENVIRONMENT_FIELD) return option;
    return option === "production" ? t.envProduction : option === "sandbox" ? t.envSandbox : option;
  };
  return (
    <div className="space-y-1.5">
      <div className="space-y-3">
        {fields.map((field, i) => {
          const id = `${baseId}-${i}`;
          const error = errors[field.key];
          if (field.options && field.options.length > 0) {
            const isEnvironment = field.key === ENVIRONMENT_FIELD;
            const describedBy = [isEnvironment && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ");
            return (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={id}>{label(field)}</Label>
                <Select
                  id={id}
                  value={values[field.key] || field.options[0]}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  disabled={disabled}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={describedBy || undefined}
                  className="h-11"
                >
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {optionLabel(field, option)}
                    </option>
                  ))}
                </Select>
                {isEnvironment && (
                  <p id={`${id}-hint`} className="text-xs text-ink-soft">
                    {t.environmentHint}
                  </p>
                )}
                {error && (
                  <p id={`${id}-error`} role="alert" className="text-sm text-danger">
                    {error}
                  </p>
                )}
              </div>
            );
          }
          return (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={id}>{label(field)}</Label>
              <Input
                id={id}
                type={field.secret ? "password" : "text"}
                dir="ltr"
                autoComplete="off"
                spellCheck={false}
                value={values[field.key] ?? ""}
                onChange={(e) => onChange(field.key, e.target.value)}
                disabled={disabled}
                aria-describedby={hintId}
                className="h-11"
              />
            </div>
          );
        })}
      </div>
      <p id={hintId} className="text-xs text-ink-soft">
        {hint}
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

function TextSettingField({
  label,
  value,
  secret,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  secret: boolean;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={secret ? "password" : "text"}
        dir="auto"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-11"
      />
    </div>
  );
}
