import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Input, cn } from "@store-builder/ui";
import {
  ApiError,
  apiErrorDetails,
  apiFieldProblems,
  isApiErrorCode,
  type CarrierAddressUnmatchedDetails,
  type CarrierInfo,
  type Order,
  type Shipment,
  type ShipmentStatus,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useCommon, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import {
  BOSTA,
  BOSTA_MAX_COD_MINOR,
  FINISHED_SHIPMENT_STATUSES,
  SHIPPING_ROLES,
  codAmountFor,
  isCarrierBooked,
  placeName,
} from "@/pages/shipping/carriers";
import { useOrderLabels } from "../orderLabels";

const STATUSES: ShipmentStatus[] = [
  "created",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "failed",
  "returned",
  "cancelled",
];

const STRINGS = {
  en: {
    title: "Shipments",
    empty: "No shipments yet.",
    manual: "Manual",
    via: "via {carrier}",
    waybill: "Tracking no.",
    track: "Track parcel",
    shipped: "Shipped {date}",
    delivered: "Delivered {date}",
    courierState: "{carrier} status: {state}",
    setStatus: "Status",
    statusUpdated: "Shipment marked “{status}”.",
    sync: "Sync status",
    syncing: "Syncing…",
    syncChanged: "Updated from {carrier}: {status}.",
    syncSame: "No change. {carrier} says: {state}.",
    label: "Download label",
    labelLoading: "Preparing label…",
    failedNote:
      "Failed isn't final: the courier may try the delivery again. If it's really over, mark it cancelled so you can book a new shipment.",
    carrierCreatedNote:
      "To call off this delivery, cancel the order: {carrier} is cancelled first. If you cancel it in {carrier}'s dashboard instead, press Sync. It will show as Failed, and you can mark it cancelled here.",
    markCancelled: "Mark as cancelled",
    markCancelledTitle: "Mark this {carrier} delivery cancelled?",
    markCancelledBody:
      "This only changes it here. {carrier} is not contacted. Check in {carrier}'s dashboard that the parcel isn't still on its way, or a new booking could put two parcels on the road.",
    markCancelledConfirm: "Mark cancelled",
    cancelledToast: "Shipment marked cancelled. You can book a new one.",
    orderCancelled: "This order is cancelled, so it can't be shipped.",
    activeBlocks:
      "This order already has an active shipment ({status}). You can book a new one once it's cancelled or returned.",
    viewOnly: "Only the store owner, a workspace manager or an order operator can manage shipments.",
    viewOnlyForbidden: "Your role can't manage shipments, so they're shown read-only.",
    newShipment: "New shipment",
    method: "How is it shipped?",
    methodManual: "Manual",
    methodManualHint: "You book it yourself and type the tracking number in.",
    methodCourierHint: "Booked in your {carrier} account, with label and status updates.",
    courierNotConnected: "Connect {carrier} under Shipping to book from here.",
    courierUnavailable: "Courier booking isn't available on your store yet.",
    goToShipping: "Open Shipping settings",
    carrierName: "Courier name",
    carrierNamePlaceholder: "e.g. Aramex",
    carrierNameHint: "Optional. Leave empty for your own delivery.",
    useCourierOption: "{carrier} is connected. Choose the {carrier} option above to book it through your account.",
    trackingUrl: "Tracking link",
    create: "Add shipment",
    creating: "Adding…",
    createdToast: "Shipment added.",
    codToCollect: "Cash to collect",
    noCod: "Nothing to collect: this order is prepaid.",
    codOverLimit:
      "{carrier} collects at most {limit} cash on delivery, and this order's amount is {amount}. It can't be booked with {carrier}; ship it manually instead.",
    currencyBlocked: "{carrier} only collects cash in EGP, and this order is in {currency}.",
    notConfirmed: "Confirm this cash-on-delivery order before booking a courier.",
    notPaid: "This prepaid order must be paid before booking a courier.",
    noAddress: "This order has no shipping address.",
    deliverTo: "Deliver to",
    chooseAddress: "Choose city and district myself",
    useOrderAddress: "Match the order's address automatically",
    unmatchedCity: "{carrier} doesn't have a city matching “{value}”. Choose the city, then the district.",
    unmatchedDistrict: "Matched {city}, but not the area “{value}”. Choose the district.",
    city: "City / governorate",
    district: "District / area",
    chooseCity: "Choose a city",
    chooseDistrict: "Choose a district",
    chooseCityFirst: "Choose a city first",
    loadingPlaces: "Loading…",
    suggested: "Best matches",
    allDistricts: "All districts",
    allCities: "All cities",
    placesFailed: "Couldn't load {carrier}'s list.",
    notes: "Note for the courier",
    notesHint: "Optional, up to 500 characters.",
    book: "Book with {carrier}",
    booking: "Booking with {carrier}…",
    bookedToast: "Booked with {carrier}. Tracking number {number}.",
    uncertainHint: "Reload this page to book again, after you've checked.",
    timeoutNote:
      "If an earlier booking attempt timed out, check your {carrier} dashboard first: the delivery may already exist there.",
  },
  ar: {
    title: "الشحنات",
    empty: "لا توجد شحنات بعد.",
    manual: "يدوي",
    via: "عبر {carrier}",
    waybill: "رقم التتبع",
    track: "تتبع الطرد",
    shipped: "تم الشحن {date}",
    delivered: "تم التسليم {date}",
    courierState: "حالة {carrier}: {state}",
    setStatus: "الحالة",
    statusUpdated: "تم تغيير حالة الشحنة إلى «{status}».",
    sync: "مزامنة الحالة",
    syncing: "جارٍ المزامنة…",
    syncChanged: "تم التحديث من {carrier}: {status}.",
    syncSame: "لا تغيير. حالة {carrier}: {state}.",
    label: "تنزيل البوليصة",
    labelLoading: "جارٍ تجهيز البوليصة…",
    failedNote:
      "الفشل ليس نهائيًا: قد تعيد شركة الشحن محاولة التوصيل. إذا انتهت الشحنة فعلًا، علّمها كملغاة لتتمكن من حجز شحنة جديدة.",
    carrierCreatedNote:
      "لإلغاء هذه الشحنة، ألغِ الأوردر: سيتم إلغاؤها لدى {carrier} أولًا. وإذا ألغيتها من لوحة تحكم {carrier} بدلًا من ذلك، اضغط مزامنة. ستظهر كفاشلة، ويمكنك بعدها تعليمها كملغاة هنا.",
    markCancelled: "تعليم كملغاة",
    markCancelledTitle: "تعليم شحنة {carrier} هذه كملغاة؟",
    markCancelledBody:
      "هذا يغيّرها هنا فقط، ولن يتم التواصل مع {carrier}. تأكد من لوحة تحكم {carrier} أن الطرد لم يعد في الطريق، وإلا فقد يؤدي الحجز الجديد إلى طردين في الطريق.",
    markCancelledConfirm: "تعليم كملغاة",
    cancelledToast: "تم تعليم الشحنة كملغاة. يمكنك حجز شحنة جديدة.",
    orderCancelled: "هذا الأوردر ملغي، لذلك لا يمكن شحنه.",
    activeBlocks: "لهذا الأوردر شحنة نشطة بالفعل ({status}). يمكنك حجز شحنة جديدة بعد إلغائها أو إرجاعها.",
    viewOnly: "يمكن لمالك المتجر أو مدير مساحة العمل أو مسؤول الأوردرات فقط إدارة الشحنات.",
    viewOnlyForbidden: "دورك لا يسمح بإدارة الشحنات، لذلك تظهر للعرض فقط.",
    newShipment: "شحنة جديدة",
    method: "كيف سيتم الشحن؟",
    methodManual: "يدوي",
    methodManualHint: "تحجزها بنفسك وتكتب رقم التتبع.",
    methodCourierHint: "تُحجز في حسابك على {carrier}، مع البوليصة وتحديثات الحالة.",
    courierNotConnected: "اربط {carrier} من صفحة الشحن لتحجز من هنا.",
    courierUnavailable: "الحجز مع شركات الشحن غير متاح لمتجرك بعد.",
    goToShipping: "فتح إعدادات الشحن",
    carrierName: "اسم شركة الشحن",
    carrierNamePlaceholder: "مثلًا: أرامكس",
    carrierNameHint: "اختياري. اتركه فارغًا إذا كنت توصّل بنفسك.",
    useCourierOption: "{carrier} مربوطة. اختر {carrier} بالأعلى لحجزها عبر حسابك.",
    trackingUrl: "رابط التتبع",
    create: "إضافة الشحنة",
    creating: "جارٍ الإضافة…",
    createdToast: "تمت إضافة الشحنة.",
    codToCollect: "المبلغ المطلوب تحصيله",
    noCod: "لا يوجد مبلغ للتحصيل: هذا الأوردر مدفوع مسبقًا.",
    codOverLimit:
      "أقصى مبلغ تحصّله {carrier} عند الاستلام هو {limit}، ومبلغ هذا الأوردر {amount}. لا يمكن حجزه مع {carrier}؛ اشحنه يدويًا.",
    currencyBlocked: "{carrier} تحصّل بالجنيه المصري فقط، وهذا الأوردر بعملة {currency}.",
    notConfirmed: "أكّد أوردر الدفع عند الاستلام قبل حجز شركة الشحن.",
    notPaid: "يجب دفع هذا الأوردر المدفوع مسبقًا قبل حجز شركة الشحن.",
    noAddress: "لا يوجد عنوان شحن لهذا الأوردر.",
    deliverTo: "التوصيل إلى",
    chooseAddress: "اختيار المدينة والمنطقة بنفسي",
    useOrderAddress: "مطابقة عنوان الأوردر تلقائيًا",
    unmatchedCity: "لا توجد لدى {carrier} مدينة تطابق «{value}». اختر المدينة ثم المنطقة.",
    unmatchedDistrict: "تمت مطابقة {city}، لكن ليس المنطقة «{value}». اختر المنطقة.",
    city: "المدينة / المحافظة",
    district: "المنطقة / الحي",
    chooseCity: "اختر مدينة",
    chooseDistrict: "اختر منطقة",
    chooseCityFirst: "اختر مدينة أولًا",
    loadingPlaces: "جارٍ التحميل…",
    suggested: "الأقرب للعنوان",
    allDistricts: "كل المناطق",
    allCities: "كل المدن",
    placesFailed: "تعذّر تحميل قائمة {carrier}.",
    notes: "ملاحظة للمندوب",
    notesHint: "اختياري، حتى 500 حرف.",
    book: "احجز مع {carrier}",
    booking: "جارٍ الحجز مع {carrier}…",
    bookedToast: "تم الحجز مع {carrier}. رقم التتبع {number}.",
    uncertainHint: "بعد أن تتأكد، أعد تحميل الصفحة لتحجز مرة أخرى.",
    timeoutNote: "إذا انتهت مهلة محاولة حجز سابقة، راجع لوحة تحكم {carrier} أولًا: قد تكون الشحنة موجودة هناك بالفعل.",
  },
} satisfies Messages;

/** Isolates an LTR run (tracking number) inside a plain-text toast, where <bdi> can't go. */
const isolate = (value: string) => `⁦${value}⁩`;

interface Props {
  order: Order;
  onChanged: () => void;
}

export function ShipmentsSection({ order, onChanged }: Props) {
  const t = useT(STRINGS);
  const labels = useOrderLabels();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { currentWorkspace } = useWorkspace();
  const roleAllows = SHIPPING_ROLES.has(currentWorkspace?.role ?? "");
  const [forbidden, setForbidden] = useState(false);
  const canManage = roleAllows && !forbidden;

  // Which couriers this store connected. Needed only to book or label; a
  // failure here just leaves the manual option.
  const carriers = useAsync(
    () => (roleAllows ? apiClient.listCarriers(workspaceId) : Promise.resolve(null)),
    [workspaceId, roleAllows]
  );
  const carrierList = carriers.data?.configured ? carriers.data.carriers : [];
  const carrierByCode = new Map(carrierList.map((c) => [c.code, c]));

  const shipments = order.shipments ?? [];
  const active = shipments.find((s) => !FINISHED_SHIPMENT_STATUSES.has(s.status));

  /** A 403 turns the section read-only, with the reason as a toast. */
  function handleForbidden(err: unknown): boolean {
    if (err instanceof ApiError && err.status === 403) {
      toast.error(errorMessage(err));
      setForbidden(true);
      return true;
    }
    return false;
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-line p-5">
      <h2 className="mb-3 font-display text-lg font-medium text-ink">{t.title}</h2>

      {shipments.length === 0 ? (
        <p className="rounded-[0.5rem] border border-dashed border-line px-4 py-6 text-center text-sm text-ink-soft">
          {t.empty}
        </p>
      ) : (
        <ul className="space-y-3">
          {shipments.map((s) => (
            <ShipmentRow
              key={s.id}
              orderId={order.id}
              shipment={s}
              carrier={carrierByCode.get(s.carrierCode)}
              canManage={canManage}
              onForbidden={handleForbidden}
              onChanged={onChanged}
            />
          ))}
        </ul>
      )}

      <div className="mt-4 space-y-3 border-t border-line pt-4">
        {!roleAllows ? (
          <p className="text-sm text-ink-soft">{t.viewOnly}</p>
        ) : forbidden ? (
          <p className="text-sm text-ink-soft">{t.viewOnlyForbidden}</p>
        ) : order.cancelledAt ? (
          <p className="text-sm text-ink-soft">{t.orderCancelled}</p>
        ) : active ? (
          <p className="text-sm text-ink-soft">
            {fmt(t.activeBlocks, { status: labels.shipment(active.status) })}
          </p>
        ) : (
          <CreateShipmentForm
            order={order}
            carriersConfigured={Boolean(carriers.data?.configured)}
            courier={carrierByCode.get(BOSTA)}
            onForbidden={handleForbidden}
            onCourierStale={() => carriers.refresh({ silent: true })}
            onCreated={onChanged}
          />
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// One shipment
// ---------------------------------------------------------------------

function ShipmentRow({
  orderId,
  shipment,
  carrier,
  canManage,
  onForbidden,
  onChanged,
}: {
  orderId: string;
  shipment: Shipment;
  carrier: CarrierInfo | undefined;
  canManage: boolean;
  onForbidden: (err: unknown) => boolean;
  onChanged: () => void;
}) {
  const t = useT(STRINGS);
  const common = useCommon();
  const labels = useOrderLabels();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState<"status" | "sync" | "label" | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const booked = isCarrierBooked(shipment);
  const carrierName = shipment.carrierCode === "manual" ? t.manual : (carrier?.name ?? shipment.carrierCode);
  const courierState = shipment.carrierResponse?.lastCarrierStatus?.value;

  function fail(err: unknown) {
    if (!onForbidden(err)) toast.error(errorMessage(err));
  }

  async function updateStatus(status: ShipmentStatus) {
    setBusy("status");
    try {
      await apiClient.updateShipment(workspaceId, orderId, shipment.id, { status });
      toast.success(fmt(t.statusUpdated, { status: labels.shipment(status) }));
      onChanged();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  }

  async function sync() {
    setBusy("sync");
    try {
      const result = await apiClient.syncShipment(workspaceId, orderId, shipment.id);
      toast.success(
        result.changed
          ? fmt(t.syncChanged, { carrier: carrierName, status: labels.shipment(result.shipment.status) })
          : fmt(t.syncSame, {
              carrier: carrierName,
              state: result.carrierStatus?.value ?? labels.shipment(result.shipment.status),
            })
      );
      onChanged();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  }

  async function downloadLabel() {
    setBusy("label");
    try {
      const blob = await apiClient.getShipmentLabel(workspaceId, orderId, shipment.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${shipment.carrierCode}-${shipment.waybillNumber ?? shipment.trackingCode}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Give the browser a moment to start the download before freeing it.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  }

  async function markCancelled() {
    try {
      await apiClient.updateShipment(workspaceId, orderId, shipment.id, { status: "cancelled" });
    } catch (err) {
      if (onForbidden(err)) {
        setConfirmCancel(false);
        return;
      }
      throw new Error(errorMessage(err));
    }
    setConfirmCancel(false);
    toast.success(t.cancelledToast);
    onChanged();
  }

  return (
    <li className="rounded-[0.5rem] border border-line px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <bdi dir="ltr" className="font-medium text-ink">
            {shipment.trackingCode}
          </bdi>
          <span className="ms-2 text-sm text-ink-soft">{fmt(t.via, { carrier: carrierName })}</span>
        </div>
        <StatusBadge value={shipment.status} text={labels.shipment(shipment.status)} />
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
        {shipment.waybillNumber && (
          <span>
            {t.waybill}{" "}
            <bdi dir="ltr" className="font-medium text-ink">
              {shipment.waybillNumber}
            </bdi>
          </span>
        )}
        {shipment.shippedAt && <span>{fmt(t.shipped, { date: formatDateTime(shipment.shippedAt) })}</span>}
        {shipment.deliveredAt && <span>{fmt(t.delivered, { date: formatDateTime(shipment.deliveredAt) })}</span>}
        {booked && courierState && (
          <span>
            {fmt(t.courierState, { carrier: carrierName, state: "" })}
            <bdi dir="ltr">{courierState}</bdi>
          </span>
        )}
      </div>

      {shipment.status === "failed" && (
        <p className="mt-2 rounded-[0.5rem] border border-accent/40 bg-accent-soft px-3 py-2 text-xs text-accent-dark">
          {t.failedNote}
        </p>
      )}
      {booked && shipment.status === "created" && canManage && (
        <p className="mt-2 text-xs text-ink-soft">{fmt(t.carrierCreatedNote, { carrier: carrierName })}</p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {shipment.trackingUrl && (
          <a
            href={shipment.trackingUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center rounded-[0.5rem] px-2 text-sm font-medium text-primary hover:underline"
          >
            {t.track}
          </a>
        )}

        {canManage && booked && (
          <>
            <Button variant="outline" className="min-h-11" disabled={busy !== null} onClick={sync}>
              {busy === "sync" ? t.syncing : t.sync}
            </Button>
            {carrier?.supportsLabel !== false && (
              <Button variant="outline" className="min-h-11" disabled={busy !== null} onClick={downloadLabel}>
                {busy === "label" ? t.labelLoading : t.label}
              </Button>
            )}
            {shipment.status === "failed" && (
              <Button
                variant="ghost"
                className="min-h-11 text-danger hover:bg-danger-soft"
                disabled={busy !== null}
                onClick={() => setConfirmCancel(true)}
              >
                {t.markCancelled}
              </Button>
            )}
          </>
        )}

        {canManage && !booked && (
          <ManualStatusSelect
            value={shipment.status}
            disabled={busy !== null}
            onChange={updateStatus}
            label={t.setStatus}
            optionLabel={labels.shipment}
          />
        )}
      </div>

      <ConfirmDialog
        open={confirmCancel}
        title={fmt(t.markCancelledTitle, { carrier: carrierName })}
        description={fmt(t.markCancelledBody, { carrier: carrierName })}
        confirmLabel={t.markCancelledConfirm}
        cancelLabel={common.cancel}
        busyLabel={common.saving}
        destructive
        onCancel={() => setConfirmCancel(false)}
        onConfirm={markCancelled}
      />
    </li>
  );
}

function ManualStatusSelect({
  value,
  disabled,
  onChange,
  label,
  optionLabel,
}: {
  value: ShipmentStatus;
  disabled: boolean;
  onChange: (status: ShipmentStatus) => void;
  label: string;
  optionLabel: (status: ShipmentStatus) => string;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-xs text-ink-soft">
        {label}
      </label>
      <Select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as ShipmentStatus)}
        className="h-11 w-52"
      >
        {STATUSES.map((st) => (
          <option key={st} value={st}>
            {optionLabel(st)}
          </option>
        ))}
      </Select>
    </div>
  );
}

// ---------------------------------------------------------------------
// New shipment
// ---------------------------------------------------------------------

type Method = "manual" | "courier";

interface PlaceOption {
  id: string;
  name: string | null;
  nameAr: string | null;
  suggested?: boolean;
}

/** What the address picker is working from. */
type PickerSource =
  | { kind: "free" }
  | { kind: "unmatched"; details: CarrierAddressUnmatchedDetails };

function CreateShipmentForm({
  order,
  carriersConfigured,
  courier,
  onForbidden,
  onCourierStale,
  onCreated,
}: {
  order: Order;
  carriersConfigured: boolean;
  courier: CarrierInfo | undefined;
  onForbidden: (err: unknown) => boolean;
  onCourierStale: () => void;
  onCreated: () => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();

  const courierName = courier?.name ?? "Bosta";
  const courierConnected = Boolean(courier?.connection);
  // Until the merchant picks, the default follows the carriers list, which
  // arrives after the first render: the courier once it's known connected.
  const [pickedMethod, setPickedMethod] = useState<Method | null>(null);
  const method: Method = pickedMethod ?? (courierConnected ? "courier" : "manual");

  // Manual
  const [carrierName, setCarrierName] = useState("");
  const [waybillNumber, setWaybillNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");

  // Courier
  const [notes, setNotes] = useState("");
  const [picker, setPicker] = useState<PickerSource | null>(null);
  const [cityId, setCityId] = useState("");
  const [districtId, setDistrictId] = useState("");
  // A create that got no answer may still exist at the courier. No retry
  // from this screen until the merchant has checked and reloaded.
  const [uncertain, setUncertain] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const cod = codAmountFor(order);
  const blockers: string[] = [];
  if (order.currency !== "EGP") blockers.push(fmt(t.currencyBlocked, { carrier: courierName, currency: order.currency }));
  else if (cod > BOSTA_MAX_COD_MINOR)
    blockers.push(
      fmt(t.codOverLimit, {
        carrier: courierName,
        limit: formatMoney(BOSTA_MAX_COD_MINOR, "EGP"),
        amount: formatMoney(cod, "EGP"),
      })
    );
  if (order.paymentMethod === "cod" && order.confirmationState !== "confirmed") blockers.push(t.notConfirmed);
  if (order.paymentMethod !== "cod" && order.financialState !== "paid") blockers.push(t.notPaid);
  if (!order.shippingAddressSnapshot) blockers.push(t.noAddress);

  const pickerIncomplete = picker !== null && (!cityId || !districtId);

  function chooseMethod(next: Method) {
    setPickedMethod(next);
    setFormError(null);
    setFieldErrors({});
  }

  async function submitManual(e: FormEvent) {
    e.preventDefault();
    const name = carrierName.trim();
    // A connected courier's code as free text would be booked with that
    // courier by the server — send the merchant to the right option instead.
    if (courierConnected && courier && name.toLowerCase() === courier.code) {
      setFieldErrors({ carrierCode: fmt(t.useCourierOption, { carrier: courierName }) });
      return;
    }
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    try {
      await apiClient.createShipment(workspaceId, order.id, {
        carrierCode: name || "manual",
        waybillNumber: waybillNumber.trim() || undefined,
        trackingUrl: trackingUrl.trim() || undefined,
      });
      toast.success(t.createdToast);
      setCarrierName("");
      setWaybillNumber("");
      setTrackingUrl("");
      onCreated();
    } catch (err) {
      handleError(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitCourier(e: FormEvent) {
    e.preventDefault();
    if (!courier || uncertain || blockers.length > 0 || pickerIncomplete) return;
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const shipment = await apiClient.createShipment(workspaceId, order.id, {
        carrierCode: courier.code,
        carrierAddress: picker && cityId && districtId ? { cityId, districtId } : undefined,
        notes: notes.trim() || undefined,
      });
      toast.success(
        fmt(t.bookedToast, { carrier: courierName, number: isolate(shipment.waybillNumber ?? shipment.trackingCode) })
      );
      setNotes("");
      setPicker(null);
      setCityId("");
      setDistrictId("");
      onCreated();
    } catch (err) {
      if (isApiErrorCode(err, "CARRIER_ADDRESS_UNMATCHED")) {
        const details = apiErrorDetails<CarrierAddressUnmatchedDetails>(err);
        if (details) {
          setPicker({ kind: "unmatched", details });
          // At district level the city is settled; at city level start over.
          setCityId(details.level === "district" && details.matchedCity ? details.matchedCity.id : "");
          setDistrictId("");
          return;
        }
      }
      if (isApiErrorCode(err, "CARRIER_ERROR") && err.status === 502) {
        // Shown exactly as the server says it ("check your Bosta dashboard").
        setUncertain(true);
      }
      if (isApiErrorCode(err, "CARRIER_NOT_CONNECTED")) onCourierStale();
      if (isApiErrorCode(err, "SHIPMENT_ALREADY_EXISTS")) onCreated();
      handleError(err);
    } finally {
      setSubmitting(false);
    }
  }

  function handleError(err: unknown) {
    if (onForbidden(err)) return;
    const problems = apiFieldProblems(err);
    if (problems.length > 0) {
      const fields: Record<string, string> = {};
      for (const p of problems) fields[p.field] = p.message;
      setFieldErrors(fields);
      // Fields this form doesn't show still need saying somewhere.
      const shown = ["carrierCode", "waybillNumber", "trackingUrl", "notes", "carrierAddress.cityId", "carrierAddress.districtId"];
      if (!problems.some((p) => shown.includes(p.field))) setFormError(errorMessage(err));
      return;
    }
    setFormError(errorMessage(err));
  }

  const address = order.shippingAddressSnapshot;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-ink">{t.newShipment}</h3>

      <MethodPicker
        legend={t.method}
        value={method}
        onChange={chooseMethod}
        options={[
          { value: "courier", label: courierName, hint: fmt(t.methodCourierHint, { carrier: courierName }), disabled: !courierConnected },
          { value: "manual", label: t.methodManual, hint: t.methodManualHint },
        ]}
      />
      {!courierConnected && (
        <p className="text-xs text-ink-soft">
          {carriersConfigured ? fmt(t.courierNotConnected, { carrier: courierName }) : t.courierUnavailable}{" "}
          {carriersConfigured && (
            <Link to="/shipping" className="inline-flex min-h-11 items-center font-medium text-primary hover:underline">
              {t.goToShipping}
            </Link>
          )}
        </p>
      )}

      {formError && (
        <Alert variant="danger">
          <p>{formError}</p>
          {uncertain && <p className="mt-1">{t.uncertainHint}</p>}
        </Alert>
      )}

      {method === "manual" ? (
        <form onSubmit={submitManual} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <TextInput
              label={t.carrierName}
              value={carrierName}
              onChange={setCarrierName}
              placeholder={t.carrierNamePlaceholder}
              hint={t.carrierNameHint}
              error={fieldErrors.carrierCode}
              maxLength={100}
            />
            <TextInput
              label={t.waybill}
              value={waybillNumber}
              onChange={setWaybillNumber}
              error={fieldErrors.waybillNumber}
              dir="ltr"
              maxLength={100}
            />
            <TextInput
              label={t.trackingUrl}
              value={trackingUrl}
              onChange={setTrackingUrl}
              error={fieldErrors.trackingUrl}
              dir="ltr"
              type="url"
              maxLength={500}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" className="min-h-11" disabled={submitting}>
              {submitting ? t.creating : t.create}
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={submitCourier} className="space-y-4">
          <div className="grid gap-3 rounded-[0.5rem] border border-line p-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs text-ink-soft">{t.codToCollect}</p>
              <p className="font-medium text-ink">{cod > 0 ? formatMoney(cod, "EGP") : t.noCod}</p>
            </div>
            <div>
              <p className="text-xs text-ink-soft">{t.deliverTo}</p>
              <p className="text-ink" dir="auto">
                {address ? [address.province, address.city].filter(Boolean).join(" · ") || "—" : "—"}
              </p>
            </div>
          </div>

          {blockers.length > 0 && (
            <div className="space-y-1 rounded-[0.5rem] border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-accent-dark">
              {blockers.map((b) => (
                <p key={b}>{b}</p>
              ))}
            </div>
          )}

          {picker && courier ? (
            <AddressPicker
              courier={courier}
              source={picker}
              cityId={cityId}
              districtId={districtId}
              onCityChange={(id) => {
                setCityId(id);
                setDistrictId("");
              }}
              onDistrictChange={setDistrictId}
              cityError={fieldErrors["carrierAddress.cityId"]}
              districtError={fieldErrors["carrierAddress.districtId"]}
              disabled={submitting}
            />
          ) : null}
          {(!picker || picker.kind === "free") && blockers.length === 0 && (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 px-2 text-primary"
              onClick={() => {
                setPicker(picker ? null : { kind: "free" });
                setCityId("");
                setDistrictId("");
              }}
            >
              {picker ? t.useOrderAddress : t.chooseAddress}
            </Button>
          )}

          <Field label={t.notes} hint={t.notesHint} error={fieldErrors.notes}>
            {({ id, ...aria }) => (
              <Input
                id={id}
                {...aria}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                dir="auto"
                className="h-11"
              />
            )}
          </Field>

          {/* Nothing records a create that got no answer, so this can't be
              conditional: after a reload the Book button is back. */}
          <p className="text-xs text-ink-soft">{fmt(t.timeoutNote, { carrier: courierName })}</p>

          <div className="flex justify-end">
            {!uncertain && (
              <Button
                type="submit"
                className="min-h-11"
                disabled={submitting || blockers.length > 0 || pickerIncomplete}
              >
                {submitting ? fmt(t.booking, { carrier: courierName }) : fmt(t.book, { carrier: courierName })}
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

function MethodPicker({
  legend,
  value,
  onChange,
  options,
}: {
  legend: string;
  value: Method;
  onChange: (m: Method) => void;
  options: { value: Method; label: string; hint: string; disabled?: boolean }[];
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-2 text-sm text-ink-soft">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const checked = value === o.value;
          return (
            <label
              key={o.value}
              className={cn(
                "flex min-h-11 cursor-pointer items-start gap-3 rounded-[0.5rem] border px-3 py-2.5 text-sm transition-colors",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
                checked ? "border-primary bg-primary-soft/40" : "border-line hover:border-primary/50",
                "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 has-[:disabled]:hover:border-line"
              )}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={checked}
                disabled={o.disabled}
                onChange={() => onChange(o.value)}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span className="min-w-0">
                <span className={cn("block text-ink", checked && "font-medium")}>{o.label}</span>
                <span className="block text-xs text-ink-soft">{o.hint}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * City → district picker over the courier's own list. From scratch it lists
 * every city; after a 422 CARRIER_ADDRESS_UNMATCHED it starts from the
 * server's candidates — cities at level "city", the matched city's districts
 * (best matches first) at level "district". Districts of a chosen city come
 * from GET .../cities?cityId=.
 */
function AddressPicker({
  courier,
  source,
  cityId,
  districtId,
  onCityChange,
  onDistrictChange,
  cityError,
  districtError,
  disabled,
}: {
  courier: CarrierInfo;
  source: PickerSource;
  cityId: string;
  districtId: string;
  onCityChange: (id: string) => void;
  onDistrictChange: (id: string) => void;
  cityError?: string;
  districtError?: string;
  disabled: boolean;
}) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const details = source.kind === "unmatched" ? source.details : null;
  const districtLevel = details?.level === "district";

  // Cities: the candidates at city level, the whole list from scratch, and
  // at district level just the city that matched.
  const allCities = useAsync<PlaceOption[] | null>(
    () =>
      source.kind === "free"
        ? apiClient.listCarrierCities(workspaceId, courier.code).then((cities) => cities.filter((c) => c.dropOffAvailable !== false))
        : Promise.resolve(null),
    [workspaceId, courier.code, source.kind]
  );
  const cityOptions: PlaceOption[] = details
    ? districtLevel && details.matchedCity
      ? [details.matchedCity]
      : details.candidates.map((c) => ({ id: c.cityId, name: c.cityName, nameAr: c.cityNameAr, suggested: c.suggested }))
    : (allCities.data ?? []);

  // Districts: the server's candidates when it already narrowed them down,
  // otherwise the chosen city's list.
  const fetchDistricts = Boolean(cityId) && !districtLevel;
  const cityDistricts = useAsync<PlaceOption[] | null>(
    () =>
      fetchDistricts
        ? apiClient
            .listCarrierCities(workspaceId, courier.code, cityId)
            .then((cities) => (cities[0]?.districts ?? []).filter((d) => d.dropOffAvailable !== false))
        : Promise.resolve(null),
    [workspaceId, courier.code, cityId, fetchDistricts]
  );
  const districtOptions: PlaceOption[] = districtLevel
    ? details!.candidates
        .filter((c) => c.districtId)
        .map((c) => ({ id: c.districtId as string, name: c.districtName, nameAr: c.districtNameAr, suggested: c.suggested }))
    : (cityDistricts.data ?? []);

  const orderValue =
    (details?.level === "city" ? details.orderAddress.province || details.orderAddress.city : details?.orderAddress.city) ?? "—";

  return (
    <div className="space-y-3 rounded-[0.5rem] border border-line p-3">
      {details && (
        <p className="text-sm text-ink">
          {details.level === "city"
            ? fmt(t.unmatchedCity, { carrier: courier.name, value: orderValue })
            : fmt(t.unmatchedDistrict, { city: placeName(details.matchedCity, locale), value: orderValue })}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <PlaceSelect
          label={t.city}
          placeholder={allCities.loading ? t.loadingPlaces : t.chooseCity}
          options={cityOptions}
          value={cityId}
          onChange={onCityChange}
          disabled={disabled || districtLevel}
          error={cityError ?? (allCities.error ? fmt(t.placesFailed, { carrier: courier.name }) : undefined)}
          suggestedLabel={t.suggested}
          restLabel={t.allCities}
        />
        <PlaceSelect
          label={t.district}
          placeholder={!cityId ? t.chooseCityFirst : cityDistricts.loading ? t.loadingPlaces : t.chooseDistrict}
          options={cityId ? districtOptions : []}
          value={districtId}
          onChange={onDistrictChange}
          disabled={disabled || !cityId || cityDistricts.loading}
          error={districtError ?? (cityDistricts.error ? fmt(t.placesFailed, { carrier: courier.name }) : undefined)}
          suggestedLabel={t.suggested}
          restLabel={t.allDistricts}
        />
      </div>
    </div>
  );
}

function PlaceSelect({
  label,
  placeholder,
  options,
  value,
  onChange,
  disabled,
  error,
  suggestedLabel,
  restLabel,
}: {
  label: string;
  placeholder: string;
  options: PlaceOption[];
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
  error?: string;
  suggestedLabel: string;
  restLabel: string;
}) {
  const { locale } = useLocale();
  const suggested = options.filter((o) => o.suggested);
  const rest = options.filter((o) => !o.suggested);
  const render = (o: PlaceOption): ReactNode => (
    <option key={o.id} value={o.id}>
      {placeName(o, locale)}
    </option>
  );
  const byName = (a: PlaceOption, b: PlaceOption) =>
    placeName(a, locale).localeCompare(placeName(b, locale), locale === "ar" ? "ar" : "en");
  return (
    <Field label={label} error={error} required>
      {({ id, ...aria }) => (
        <Select id={id} {...aria} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="h-11">
          <option value="">{placeholder}</option>
          {suggested.length > 0 ? (
            <>
              <optgroup label={suggestedLabel}>{suggested.map(render)}</optgroup>
              {rest.length > 0 && <optgroup label={restLabel}>{[...rest].sort(byName).map(render)}</optgroup>}
            </>
          ) : (
            [...rest].sort(byName).map(render)
          )}
        </Select>
      )}
    </Field>
  );
}

function TextInput({
  label,
  value,
  onChange,
  error,
  hint,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  dir?: "ltr" | "auto";
  type?: string;
  maxLength?: number;
}) {
  return (
    <Field label={label} error={error} hint={hint}>
      {({ id, ...aria }) => (
        <Input id={id} {...aria} {...rest} value={value} onChange={(e) => onChange(e.target.value)} className="h-11" />
      )}
    </Field>
  );
}
