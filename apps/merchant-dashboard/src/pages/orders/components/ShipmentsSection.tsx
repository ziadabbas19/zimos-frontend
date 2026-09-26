import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Input, cn } from "@store-builder/ui";
import {
  ApiError,
  apiErrorDetails,
  apiFieldProblems,
  isApiErrorCode,
  isAreaUnmatchedDetails,
  type AnyCarrierAddressUnmatchedDetails,
  type CarrierAddressInput,
  type CarrierBookingNotSavedDetails,
  type CarrierInfo,
  type Order,
  type Shipment,
  type ShipmentStatus,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useCarrierErrorMessage, useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { StatusBadge } from "@/components/StatusBadge";
import { ProviderLogo } from "@/components/ProviderLogo";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import {
  COURIER_BOOKING_LIMITS,
  FINISHED_SHIPMENT_STATUSES,
  SHIPPING_ROLES,
  TEAM_ROLES,
  TERMINAL_SHIPMENT_STATUSES,
  cancelsManually,
  carrierLevels,
  codAmountFor,
  isCarrierBooked,
  isPathComplete,
  reservedCourierFor,
  usesCityDistrict,
} from "@/pages/shipping/carriers";
import { useManualCancelPrompt } from "@/pages/shipping/useManualCancelPrompt";
import { useOrderLabels } from "../orderLabels";
import { BookingWeightField } from "./BookingWeightField";
import { CityDistrictPicker, LevelAddressPicker, type PickerSource } from "./CarrierAddressPicker";

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

/** The order flag set when a manually cancelled booking still moves at the courier. */
const FLAG_CANCEL_UNCONFIRMED = "carrier_cancel_unconfirmed";

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
    lastChecked: "Last checked with {carrier} {date}",
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
    manualCarrierCreatedNote:
      "{carrier} can't cancel deliveries from here. To call this one off, cancel it in your {carrier} dashboard, then press Cancel shipment (or cancel the order) and confirm.",
    markCancelled: "Mark as cancelled",
    markCancelledTitle: "Mark this {carrier} delivery cancelled?",
    markCancelledBody:
      "This only changes it here. {carrier} is not contacted. Check in {carrier}'s dashboard that the parcel isn't still on its way, or a new booking could put two parcels on the road.",
    markCancelledConfirm: "Mark cancelled",
    cancelShipment: "Cancel shipment",
    cancellingShipment: "Cancelling…",
    cancelledToast: "Shipment marked cancelled. You can book a new one.",
    manualAck: "Cancelled in {carrier}'s dashboard. Confirmed by {who}, {date}.",
    ackYou: "you",
    ackTeammate: "a team member",
    unconfirmedTitle: "{carrier} still shows a cancelled delivery as moving",
    unconfirmedBody:
      "You cancelled {numbers} in {carrier}'s dashboard, but {carrier} still reports the parcel as picked up, on its way or delivered. Open your {carrier} dashboard and check it: if the parcel is still moving, cancel it there again or contact {carrier}.",
    theCourier: "The courier",
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
    methodCourierHintNoLabel: "Booked in your {carrier} account, with status updates.",
    methodNotConnectedHint: "Not connected. Connect it under Shipping to book from here.",
    courierGeneric: "Courier",
    courierGenericHint: "Booked through a connected courier account.",
    chooseMethod: "Choose how this order is shipped.",
    courierNotConnected: "Connect {carrier} under Shipping to book from here.",
    courierUnavailable: "Courier booking isn't available on your store yet.",
    or: " or ",
    goToShipping: "Open Shipping settings",
    carrierName: "Courier name",
    carrierNamePlaceholder: "e.g. Aramex",
    carrierNameHint: "Optional. Leave empty for your own delivery.",
    useCourierOption: "{carrier} is connected. Choose the {carrier} option above to book it through your account.",
    connectCourierFirst:
      "“{carrier}” can't be a manual courier name. To ship with {carrier}, connect it under Shipping, then choose the {carrier} option.",
    alreadyExistsToast: "This order already has an active shipment, now shown above. Cancel it before adding another.",
    trackingUrl: "Tracking link",
    create: "Add shipment",
    creating: "Adding…",
    createdToast: "Shipment added.",
    codToCollect: "Cash to collect",
    noCod: "Nothing to collect: this order is prepaid.",
    codOverLimit:
      "{carrier} collects at most {limit} cash on delivery, and this order's amount is {amount}. It can't be booked with {carrier}; ship it manually instead.",
    currencyBlocked: "{carrier} only collects cash in {limitCurrency}, and this order is in {currency}.",
    notConfirmed: "Confirm this cash-on-delivery order before booking a courier.",
    notConfirmedManual: "Confirm this cash-on-delivery order before shipping it.",
    notPaidManual: "This prepaid order must be paid before shipping it.",
    notPaid: "This prepaid order must be paid before booking a courier.",
    noAddress: "This order has no shipping address.",
    deliverTo: "Deliver to",
    chooseAddress: "Choose city and district myself",
    chooseArea: "Choose the delivery area myself",
    useOrderAddress: "Match the order's address automatically",
    notes: "Note for the courier",
    notesHint: "Optional, up to 500 characters.",
    book: "Book with {carrier}",
    booking: "Booking with {carrier}…",
    bookedToast: "Booked with {carrier}. Tracking number {number}.",
    uncertainHint: "Reload this page to book again, after you've checked.",
    timeoutNote:
      "If an earlier booking attempt timed out, check your {carrier} dashboard first: the delivery may already exist there.",
    notSavedTitle: "Cancel {number} in your {carrier} dashboard",
    notSaved:
      "{carrier} created delivery {number}, but it couldn't be saved here, and {carrier} can't cancel it from here. Cancel it in your {carrier} dashboard first, then book this order again.",
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
    lastChecked: "آخر مراجعة مع {carrier} {date}",
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
    manualCarrierCreatedNote:
      "لا يمكن إلغاء شحنات {carrier} من هنا. لإلغاء هذه الشحنة، ألغِها من لوحة تحكم {carrier}، ثم اضغط إلغاء الشحنة (أو ألغِ الأوردر) وأكّد ذلك.",
    markCancelled: "تعليم كملغاة",
    markCancelledTitle: "تعليم شحنة {carrier} هذه كملغاة؟",
    markCancelledBody:
      "هذا يغيّرها هنا فقط، ولن يتم التواصل مع {carrier}. تأكد من لوحة تحكم {carrier} أن الطرد لم يعد في الطريق، وإلا فقد يؤدي الحجز الجديد إلى طردين في الطريق.",
    markCancelledConfirm: "تعليم كملغاة",
    cancelShipment: "إلغاء الشحنة",
    cancellingShipment: "جارٍ الإلغاء…",
    cancelledToast: "تم تعليم الشحنة كملغاة. يمكنك حجز شحنة جديدة.",
    manualAck: "أُلغيت من لوحة تحكم {carrier}. أكّد ذلك {who}، {date}.",
    ackYou: "أنت",
    ackTeammate: "أحد أعضاء الفريق",
    unconfirmedTitle: "{carrier} ما زالت تُظهر شحنة ملغاة كأنها تتحرك",
    unconfirmedBody:
      "ألغيت {numbers} من لوحة تحكم {carrier}، لكن {carrier} ما زالت تُظهر الطرد كمُستلَم أو في الطريق أو تم تسليمه. افتح لوحة تحكم {carrier} وراجعه: إذا كان الطرد ما زال يتحرك، ألغِه هناك مرة أخرى أو تواصل مع {carrier}.",
    theCourier: "شركة الشحن",
    orderCancelled: "هذا الأوردر ملغي، لذلك لا يمكن شحنه.",
    activeBlocks: "لهذا الأوردر شحنة نشطة بالفعل ({status}). يمكنك حجز شحنة جديدة بعد إلغائها أو إرجاعها.",
    viewOnly: "يمكن لمالك المتجر أو مدير مساحة العمل أو مسؤول الأوردرات فقط إدارة الشحنات.",
    viewOnlyForbidden: "دورك لا يسمح بإدارة الشحنات، لذلك تظهر للعرض فقط.",
    newShipment: "شحنة جديدة",
    method: "كيف سيتم الشحن؟",
    methodManual: "يدوي",
    methodManualHint: "تحجزها بنفسك وتكتب رقم التتبع.",
    methodCourierHint: "تُحجز في حسابك على {carrier}، مع البوليصة وتحديثات الحالة.",
    methodCourierHintNoLabel: "تُحجز في حسابك على {carrier}، مع تحديثات الحالة.",
    methodNotConnectedHint: "غير مربوطة. اربطها من صفحة الشحن لتحجز من هنا.",
    courierGeneric: "شركة شحن",
    courierGenericHint: "تُحجز عبر حساب شركة شحن مربوط.",
    chooseMethod: "اختر طريقة شحن هذا الأوردر.",
    courierNotConnected: "اربط {carrier} من صفحة الشحن لتحجز من هنا.",
    courierUnavailable: "الحجز مع شركات الشحن غير متاح لمتجرك بعد.",
    or: " أو ",
    goToShipping: "فتح إعدادات الشحن",
    carrierName: "اسم شركة الشحن",
    carrierNamePlaceholder: "مثلًا: أرامكس",
    carrierNameHint: "اختياري. اتركه فارغًا إذا كنت توصّل بنفسك.",
    useCourierOption: "{carrier} مربوطة. اختر {carrier} بالأعلى لحجزها عبر حسابك.",
    connectCourierFirst:
      "لا يمكن استخدام «{carrier}» كاسم شركة شحن يدوي. للشحن مع {carrier}، اربطها من صفحة الشحن ثم اختر خيار {carrier}.",
    alreadyExistsToast: "لهذا الأوردر شحنة نشطة بالفعل، وتظهر الآن بالأعلى. ألغِها قبل إضافة شحنة أخرى.",
    trackingUrl: "رابط التتبع",
    create: "إضافة الشحنة",
    creating: "جارٍ الإضافة…",
    createdToast: "تمت إضافة الشحنة.",
    codToCollect: "المبلغ المطلوب تحصيله",
    noCod: "لا يوجد مبلغ للتحصيل: هذا الأوردر مدفوع مسبقًا.",
    codOverLimit:
      "أقصى مبلغ تحصّله {carrier} عند الاستلام هو {limit}، ومبلغ هذا الأوردر {amount}. لا يمكن حجزه مع {carrier}؛ اشحنه يدويًا.",
    // Only Bosta declares a currency limit today (EGP), so this names it.
    currencyBlocked: "{carrier} تحصّل بالجنيه المصري فقط، وهذا الأوردر بعملة {currency}.",
    notConfirmed: "أكّد أوردر الدفع عند الاستلام قبل حجز شركة الشحن.",
    notConfirmedManual: "أكّد أوردر الدفع عند الاستلام قبل شحنه.",
    notPaidManual: "يجب دفع هذا الأوردر المدفوع مسبقًا قبل شحنه.",
    notPaid: "يجب دفع هذا الأوردر المدفوع مسبقًا قبل حجز شركة الشحن.",
    noAddress: "لا يوجد عنوان شحن لهذا الأوردر.",
    deliverTo: "التوصيل إلى",
    chooseAddress: "اختيار المدينة والمنطقة بنفسي",
    chooseArea: "اختيار منطقة التوصيل بنفسي",
    useOrderAddress: "مطابقة عنوان الأوردر تلقائيًا",
    notes: "ملاحظة للمندوب",
    notesHint: "اختياري، حتى 500 حرف.",
    book: "احجز مع {carrier}",
    booking: "جارٍ الحجز مع {carrier}…",
    bookedToast: "تم الحجز مع {carrier}. رقم التتبع {number}.",
    uncertainHint: "بعد أن تتأكد، أعد تحميل الصفحة لتحجز مرة أخرى.",
    timeoutNote: "إذا انتهت مهلة محاولة حجز سابقة، راجع لوحة تحكم {carrier} أولًا: قد تكون الشحنة موجودة هناك بالفعل.",
    notSavedTitle: "ألغِ {number} من لوحة تحكم {carrier}",
    notSaved:
      "أنشأت {carrier} الشحنة {number}، لكن تعذّر حفظها هنا، ولا يمكن إلغاؤها لدى {carrier} من هنا. ألغِها من لوحة تحكم {carrier} أولًا، ثم احجز هذا الأوردر مرة أخرى.",
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
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const role = currentWorkspace?.role ?? "";
  const roleAllows = SHIPPING_ROLES.has(role);
  const [forbidden, setForbidden] = useState(false);
  const canManage = roleAllows && !forbidden;

  // The couriers this store may use, connected or not. Needed to book,
  // label and name them; a failure here just leaves the manual option.
  const carriers = useAsync(
    () => (roleAllows ? apiClient.listCarriers(workspaceId) : Promise.resolve(null)),
    [workspaceId, roleAllows]
  );
  const carrierList = carriers.data?.configured ? carriers.data.carriers : [];
  const carrierByCode = new Map<string, CarrierInfo>(carrierList.map((c) => [c.code, c]));

  const shipments = order.shipments ?? [];
  const active = shipments.find((s) => !FINISHED_SHIPMENT_STATUSES.has(s.status));

  // Who acknowledged a manual cancel: only a user id is stored. Names come
  // from the team list, which needs users.manage; anyone else sees "a team
  // member" for colleagues.
  const needNames =
    TEAM_ROLES.has(role) && shipments.some((s) => s.cancelAcknowledgedBy && s.cancelAcknowledgedBy !== user?.id);
  const members = useAsync(
    () => (needNames ? apiClient.listWorkspaceMembers(workspaceId).catch(() => null) : Promise.resolve(null)),
    [workspaceId, needNames]
  );
  function acknowledgedBy(userId: string | null | undefined): string {
    if (userId && userId === user?.id) return t.ackYou;
    const member = userId ? members.data?.find((m) => m.user?.id === userId) : undefined;
    return member?.user?.fullName || t.ackTeammate;
  }

  const unconfirmed = (order.riskFlags ?? []).includes(FLAG_CANCEL_UNCONFIRMED);
  const acknowledgedCancels = shipments.filter((s) => s.cancelMode === "manual_ack");

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

      {unconfirmed && (
        <UnconfirmedCancelAlert shipments={acknowledgedCancels} carrierByCode={carrierByCode} />
      )}

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
              acknowledgedBy={acknowledgedBy}
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
            carriers={carrierList}
            onForbidden={handleForbidden}
            onCourierStale={() => carriers.refresh({ silent: true })}
            onCreated={onChanged}
          />
        )}
      </div>
    </section>
  );
}

/**
 * The order's carrier_cancel_unconfirmed flag, explained: a booking the
 * merchant said they cancelled in the courier's dashboard still moves there.
 */
function UnconfirmedCancelAlert({
  shipments,
  carrierByCode,
}: {
  shipments: Shipment[];
  carrierByCode: Map<string, CarrierInfo>;
}) {
  const t = useT(STRINGS);
  const names = [...new Set(shipments.map((s) => carrierByCode.get(s.carrierCode)?.name ?? s.carrierCode))];
  const carrier = names.length > 0 ? names.join(t.or) : t.theCourier;
  const numbers = shipments.map((s) => isolate(s.waybillNumber ?? s.trackingCode)).join(", ") || "—";
  return (
    <Alert variant="danger" className="mb-3">
      <p className="font-medium">{fmt(t.unconfirmedTitle, { carrier })}</p>
      <p className="mt-1">{fmt(t.unconfirmedBody, { carrier, numbers })}</p>
    </Alert>
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
  acknowledgedBy,
  onForbidden,
  onChanged,
}: {
  orderId: string;
  shipment: Shipment;
  carrier: CarrierInfo | undefined;
  canManage: boolean;
  acknowledgedBy: (userId: string | null | undefined) => string;
  onForbidden: (err: unknown) => boolean;
  onChanged: () => void;
}) {
  const t = useT(STRINGS);
  const common = useCommon();
  const labels = useOrderLabels();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const carrierError = useCarrierErrorMessage();
  const manualCancelPrompt = useManualCancelPrompt();
  const [busy, setBusy] = useState<"status" | "sync" | "label" | "cancel" | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const booked = isCarrierBooked(shipment);
  const carrierName = shipment.carrierCode === "manual" ? t.manual : (carrier?.name ?? shipment.carrierCode);
  const courierState = shipment.carrierResponse?.lastCarrierStatus?.value;
  // The courier has no cancel API: cancelling needs the merchant's word
  // that it was done in the courier's dashboard (the 409 dialog).
  const cancelByHand = booked && cancelsManually(carrier);

  const courierRef = booked ? { code: shipment.carrierCode, name: carrierName } : null;

  function fail(err: unknown) {
    if (!onForbidden(err)) toast.error(carrierError(err, courierRef));
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

  /**
   * A courier without a cancel API: ask as-is first (the server decides
   * whether an acknowledgement is needed), then repeat with it once the
   * merchant confirms in the dialog.
   */
  async function cancelAtCourierDashboard() {
    const cancelled = () => {
      toast.success(t.cancelledToast);
      onChanged();
    };
    setBusy("cancel");
    try {
      await apiClient.updateShipment(workspaceId, orderId, shipment.id, { status: "cancelled" });
      cancelled();
    } catch (err) {
      const offered = manualCancelPrompt.offer(err, async () => {
        try {
          await apiClient.updateShipment(workspaceId, orderId, shipment.id, {
            status: "cancelled",
            acknowledgeManualCancel: true,
          });
        } catch (retryErr) {
          if (onForbidden(retryErr)) return;
          throw new Error(errorMessage(retryErr));
        }
        cancelled();
      });
      if (!offered) fail(err);
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="rounded-[0.5rem] border border-line px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          {shipment.carrierCode !== "manual" && (
            <ProviderLogo code={shipment.carrierCode} name={carrierName} size="sm" />
          )}
          <div className="min-w-0">
            <bdi dir="ltr" className="font-medium text-ink">
              {shipment.trackingCode}
            </bdi>
            <span className="ms-2 text-sm text-ink-soft">{fmt(t.via, { carrier: carrierName })}</span>
          </div>
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
        {booked && shipment.lastPolledAt && (
          <span>{fmt(t.lastChecked, { carrier: carrierName, date: formatDateTime(shipment.lastPolledAt) })}</span>
        )}
      </div>

      {shipment.cancelMode === "manual_ack" && (
        <p className="mt-2 text-xs text-ink-soft">
          {fmt(t.manualAck, {
            carrier: carrierName,
            who: acknowledgedBy(shipment.cancelAcknowledgedBy),
            date: shipment.cancelAcknowledgedAt ? formatDateTime(shipment.cancelAcknowledgedAt) : "—",
          })}
        </p>
      )}

      {shipment.status === "failed" && (
        <p className="mt-2 rounded-[0.5rem] border border-accent/40 bg-accent-soft px-3 py-2 text-xs text-accent-dark">
          {t.failedNote}
        </p>
      )}
      {booked && shipment.status === "created" && canManage && (
        <p className="mt-2 text-xs text-ink-soft">
          {fmt(cancelByHand ? t.manualCarrierCreatedNote : t.carrierCreatedNote, { carrier: carrierName })}
        </p>
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
            {cancelByHand
              ? !TERMINAL_SHIPMENT_STATUSES.has(shipment.status) && (
                  <Button
                    variant="ghost"
                    className="min-h-11 text-danger hover:bg-danger-soft"
                    disabled={busy !== null}
                    onClick={cancelAtCourierDashboard}
                  >
                    {busy === "cancel" ? t.cancellingShipment : t.cancelShipment}
                  </Button>
                )
              : shipment.status === "failed" && (
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
      {manualCancelPrompt.dialog}
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

/** "manual", or the code of the courier to book with. */
type Method = string;
const MANUAL: Method = "manual";

function CreateShipmentForm({
  order,
  carriersConfigured,
  carriers,
  onForbidden,
  onCourierStale,
  onCreated,
}: {
  order: Order;
  carriersConfigured: boolean;
  /** Every courier the server offers this store, connected or not. */
  carriers: CarrierInfo[];
  onForbidden: (err: unknown) => boolean;
  onCourierStale: () => void;
  onCreated: () => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const carrierError = useCarrierErrorMessage();

  const connected = carriers.filter((c) => c.connection);
  // Until the merchant picks, the default follows the carriers list, which
  // arrives after the first render: the one connected courier once it's
  // known (booking stays one step), manual when there is none, and no
  // default when there are several to choose from.
  const [pickedMethod, setPickedMethod] = useState<Method | null>(null);
  const picked = pickedMethod === MANUAL || connected.some((c) => c.code === pickedMethod) ? pickedMethod : null;
  const method: Method | null =
    picked ?? (connected.length === 1 ? connected[0].code : connected.length === 0 ? MANUAL : null);
  const courier = method && method !== MANUAL ? connected.find((c) => c.code === method) : undefined;
  const courierName = courier?.name ?? t.courierGeneric;
  const cityDistrict = courier ? usesCityDistrict(courier) : true;

  // Manual
  const [carrierName, setCarrierName] = useState("");
  const [waybillNumber, setWaybillNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");

  // Courier
  const [notes, setNotes] = useState("");
  const [picker, setPicker] = useState<PickerSource | null>(null);
  const [cityId, setCityId] = useState("");
  const [districtId, setDistrictId] = useState("");
  // Any other courier: one id per address level, top first.
  const [areaPath, setAreaPath] = useState<string[]>([]);
  // "" books with the order's own weight tier.
  const [tierId, setTierId] = useState("");
  const [tierUnmapped, setTierUnmapped] = useState(false);
  // A create that got no answer may still exist at the courier. No retry
  // from this screen until the merchant has checked and reloaded.
  const [uncertain, setUncertain] = useState(false);
  // The courier booked it but we couldn't record it (no cancel API).
  const [notSaved, setNotSaved] = useState<{ carrier: string; number: string } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const cod = codAmountFor(order);
  const limits = courier ? COURIER_BOOKING_LIMITS[courier.code] : undefined;
  const codCurrency = limits?.currency ?? order.currency;
  const blockers: string[] = [];
  if (limits && order.currency !== limits.currency) {
    blockers.push(
      fmt(t.currencyBlocked, { carrier: courierName, limitCurrency: limits.currency, currency: order.currency })
    );
  } else if (limits && cod > limits.maxCodMinor) {
    blockers.push(
      fmt(t.codOverLimit, {
        carrier: courierName,
        limit: formatMoney(limits.maxCodMinor, limits.currency),
        amount: formatMoney(cod, limits.currency),
      })
    );
  }
  if (order.paymentMethod === "cod" && order.confirmationState !== "confirmed") blockers.push(t.notConfirmed);
  if (order.paymentMethod !== "cod" && order.financialState !== "paid") blockers.push(t.notPaid);
  if (!order.shippingAddressSnapshot) blockers.push(t.noAddress);
  // A manual shipment has the same confirmation/payment rule as a booking
  // (the server answers ORDER_NOT_CONFIRMED / ORDER_NOT_PAID), none of the
  // courier's own limits.
  const manualBlockers: string[] = [];
  if (order.paymentMethod === "cod" && order.confirmationState !== "confirmed") manualBlockers.push(t.notConfirmedManual);
  if (order.paymentMethod !== "cod" && order.financialState !== "paid") manualBlockers.push(t.notPaidManual);

  const levels = courier ? carrierLevels(courier) : [];
  const pickerIncomplete =
    picker !== null && (cityDistrict ? !cityId || !districtId : !isPathComplete(areaPath, levels));

  function resetPicker() {
    setPicker(null);
    setCityId("");
    setDistrictId("");
    setAreaPath([]);
  }

  function chooseMethod(next: Method) {
    if (next !== method) {
      // Another courier's address ids and tiers mean nothing to this one.
      resetPicker();
      setTierId("");
      setTierUnmapped(false);
    }
    setPickedMethod(next);
    setFormError(null);
    setFieldErrors({});
  }

  function reservedNameMessage(name: string, connectedNow: boolean) {
    return fmt(connectedNow ? t.useCourierOption : t.connectCourierFirst, { carrier: name });
  }

  async function submitManual(e: FormEvent) {
    e.preventDefault();
    if (manualBlockers.length > 0) return;
    const name = carrierName.trim();
    // The server refuses a courier's name (any spelling) as a manual courier
    // when the store connected it (Bosta: always): it would pass for a
    // booking that never happened.
    const reserved = reservedCourierFor(name, carriers);
    if (reserved) {
      setFieldErrors({ carrierCode: reservedNameMessage(reserved.name, reserved.connected) });
      return;
    }
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    try {
      await apiClient.createShipment(workspaceId, order.id, {
        carrierCode: name || MANUAL,
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

  function chosenAddress(): CarrierAddressInput | undefined {
    if (!picker) return undefined;
    if (cityDistrict) return cityId && districtId ? { cityId, districtId } : undefined;
    return isPathComplete(areaPath, levels) ? { path: areaPath } : undefined;
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
        carrierAddress: chosenAddress(),
        notes: notes.trim() || undefined,
        tierId: tierId || undefined,
      });
      toast.success(
        fmt(t.bookedToast, { carrier: courierName, number: isolate(shipment.waybillNumber ?? shipment.trackingCode) })
      );
      setNotes("");
      resetPicker();
      setTierId("");
      setTierUnmapped(false);
      setNotSaved(null);
      onCreated();
    } catch (err) {
      setTierUnmapped(isApiErrorCode(err, "CARRIER_TIER_UNMAPPED"));
      if (isApiErrorCode(err, "CARRIER_ADDRESS_UNMATCHED")) {
        const details = apiErrorDetails<AnyCarrierAddressUnmatchedDetails>(err);
        if (details) {
          if (isAreaUnmatchedDetails(details)) {
            // Keep what matched; the merchant picks from the unmatched level down.
            setPicker({ kind: "unmatchedArea", details });
            setAreaPath(details.matchedPath.slice(0, details.levelIndex).map((node) => node.id));
            return;
          }
          setPicker({ kind: "unmatched", details });
          // At district level the city is settled; at city level start over.
          setCityId(details.level === "district" && details.matchedCity ? details.matchedCity.id : "");
          setDistrictId("");
          return;
        }
      }
      if (isApiErrorCode(err, "CARRIER_BOOKING_NOT_SAVED")) {
        const details = apiErrorDetails<CarrierBookingNotSavedDetails>(err);
        setNotSaved({ carrier: courierName, number: details?.trackingNumber ?? "—" });
        return;
      }
      if (isApiErrorCode(err, "CARRIER_ERROR") && err.status === 502) {
        // Shown exactly as the server says it ("check your Bosta dashboard").
        setUncertain(true);
      }
      if (isApiErrorCode(err, "CARRIER_NOT_CONNECTED")) onCourierStale();
      handleError(err);
    } finally {
      setSubmitting(false);
    }
  }

  function handleError(err: unknown) {
    if (onForbidden(err)) return;
    if (isApiErrorCode(err, "SHIPMENT_ALREADY_EXISTS")) {
      // Another tab or teammate got there first. The refresh swaps this form
      // for the "active shipment" note, so say it in a toast.
      toast.error(t.alreadyExistsToast);
      onCreated();
      return;
    }
    if (isApiErrorCode(err, "CARRIER_NAME_RESERVED")) {
      // details: [{ field: "carrierCode", carrierCode, connected }]; the
      // server's sentence is English-only, so use ours.
      const details = apiErrorDetails<unknown>(err);
      const first = Array.isArray(details)
        ? (details[0] as { carrierCode?: string; connected?: boolean } | undefined)
        : undefined;
      const known = first?.carrierCode ? carriers.find((c) => c.code === first.carrierCode) : undefined;
      const fallback = reservedCourierFor(carrierName.trim(), carriers);
      const name = known?.name ?? fallback?.name ?? first?.carrierCode ?? carrierName.trim();
      setFieldErrors({ carrierCode: reservedNameMessage(name, first?.connected ?? Boolean(known?.connection)) });
      return;
    }
    const problems = apiFieldProblems(err);
    if (problems.length > 0) {
      const fields: Record<string, string> = {};
      for (const p of problems) fields[p.field] = p.message;
      setFieldErrors(fields);
      // Fields this form doesn't show still need saying somewhere.
      const shown = ["carrierCode", "waybillNumber", "trackingUrl", "notes"];
      const isShown = (field: string) => shown.includes(field) || (picker !== null && field.startsWith("carrierAddress."));
      if (!problems.some((p) => isShown(p.field))) setFormError(errorMessage(err));
      return;
    }
    // `courier` is set only while booking through one.
    setFormError(carrierError(err, courier));
  }

  const address = order.shippingAddressSnapshot;

  // One option per courier the store may use; connected ones are bookable.
  const courierOptions =
    carriers.length > 0
      ? carriers.map((c) => ({
          value: c.code,
          label: c.name,
          logo: <ProviderLogo code={c.code} name={c.name} size="sm" />,
          hint:
            c.connection || connected.length === 0
              ? fmt(c.supportsLabel === false ? t.methodCourierHintNoLabel : t.methodCourierHint, { carrier: c.name })
              : t.methodNotConnectedHint,
          disabled: !c.connection,
        }))
      : [{ value: "__courier", label: t.courierGeneric, hint: t.courierGenericHint, disabled: true }];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-ink">{t.newShipment}</h3>

      <MethodPicker
        legend={t.method}
        value={method}
        onChange={chooseMethod}
        options={[...courierOptions, { value: MANUAL, label: t.methodManual, hint: t.methodManualHint }]}
      />
      {connected.length === 0 && (
        <p className="text-xs text-ink-soft">
          {carriersConfigured && carriers.length > 0
            ? fmt(t.courierNotConnected, { carrier: carriers.map((c) => c.name).join(t.or) })
            : t.courierUnavailable}{" "}
          {carriersConfigured && carriers.length > 0 && (
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

      {method === null ? (
        <p className="text-sm text-ink-soft">{t.chooseMethod}</p>
      ) : method === MANUAL ? (
        <form onSubmit={submitManual} className="space-y-3">
          {manualBlockers.length > 0 && (
            <div className="space-y-1 rounded-[0.5rem] border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-accent-dark">
              {manualBlockers.map((b) => (
                <p key={b}>{b}</p>
              ))}
            </div>
          )}
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
            <Button type="submit" className="min-h-11" disabled={submitting || manualBlockers.length > 0}>
              {submitting ? t.creating : t.create}
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={submitCourier} className="space-y-4">
          {notSaved && (
            <Alert variant="danger">
              <p className="font-medium">{fmt(t.notSavedTitle, { carrier: notSaved.carrier, number: isolate(notSaved.number) })}</p>
              <p className="mt-1">{fmt(t.notSaved, { carrier: notSaved.carrier, number: isolate(notSaved.number) })}</p>
            </Alert>
          )}

          <div className="grid gap-3 rounded-[0.5rem] border border-line p-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs text-ink-soft">{t.codToCollect}</p>
              <p className="font-medium text-ink">{cod > 0 ? formatMoney(cod, codCurrency) : t.noCod}</p>
            </div>
            <div>
              <p className="text-xs text-ink-soft">{t.deliverTo}</p>
              <p className="text-ink" dir="auto">
                {address ? [address.province, address.city].filter(Boolean).join(" · ") || "—" : "—"}
              </p>
            </div>
          </div>

          <BookingWeightField
            order={order}
            carrierName={courierName}
            value={tierId}
            onChange={(next) => {
              setTierId(next);
              setTierUnmapped(false);
            }}
            unmapped={tierUnmapped}
            disabled={submitting}
          />

          {blockers.length > 0 && (
            <div className="space-y-1 rounded-[0.5rem] border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-accent-dark">
              {blockers.map((b) => (
                <p key={b}>{b}</p>
              ))}
            </div>
          )}

          {picker && courier && picker.kind !== "unmatchedArea" && cityDistrict && (
            <CityDistrictPicker
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
          )}
          {picker && courier && picker.kind !== "unmatched" && !cityDistrict && (
            <LevelAddressPicker
              courier={courier}
              levels={levels}
              source={picker}
              path={areaPath}
              onChange={setAreaPath}
              errors={fieldErrors}
              disabled={submitting}
            />
          )}
          {(!picker || picker.kind === "free") && blockers.length === 0 && (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 px-2 text-primary"
              onClick={() => {
                const next = picker ? null : ({ kind: "free" } as const);
                resetPicker();
                setPicker(next);
              }}
            >
              {picker ? t.useOrderAddress : cityDistrict ? t.chooseAddress : t.chooseArea}
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
  value: Method | null;
  onChange: (m: Method) => void;
  options: { value: Method; label: string; hint: string; disabled?: boolean; logo?: ReactNode }[];
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
              {o.logo}
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
