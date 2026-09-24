import { useMemo } from "react";
import type {
  ConfirmationState,
  FinancialState,
  FulfillmentState,
  OrderStage,
  PaymentMethod,
  RiskFlag,
  ShipmentStatus,
} from "@store-builder/api-client";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { humanize } from "@/lib/format";

/**
 * The orders module's shared vocabulary — stage, state, payment-method and
 * risk-flag names in both languages. Every orders screen reads its labels
 * from here so a status is called the same thing on the list, the detail
 * page and the confirmation queue.
 */
const LABELS = {
  en: {
    // pipeline stages (orders/orderStage.js)
    stage_pending_confirmation: "New",
    stage_needs_follow_up: "Follow up",
    stage_ready_to_ship: "Ready to ship",
    stage_shipped: "Shipped",
    stage_out_for_delivery: "Out for delivery",
    stage_delivery_failed: "Delivery failed",
    stage_delivered: "Delivered",
    stage_returned: "Returned",
    stage_cancelled: "Cancelled",
    // confirmation
    conf_pending: "Awaiting call",
    conf_confirmed: "Confirmed",
    conf_rejected: "Rejected",
    conf_unreachable: "Unreachable",
    conf_postponed: "Postponed",
    // financial
    fin_pending: "Unpaid",
    fin_partially_paid: "Partially paid",
    fin_paid: "Paid",
    fin_failed: "Payment failed",
    fin_refunded: "Refunded",
    fin_partially_refunded: "Partially refunded",
    // fulfillment
    ful_unfulfilled: "Not shipped",
    ful_partially_fulfilled: "Partially shipped",
    ful_fulfilled: "Fulfilled",
    ful_returned: "Returned",
    // shipment
    ship_created: "Created",
    ship_picked_up: "Picked up",
    ship_in_transit: "In transit",
    ship_out_for_delivery: "Out for delivery",
    ship_delivered: "Delivered",
    ship_failed: "Failed",
    ship_returned: "Returned",
    ship_cancelled: "Cancelled",
    // payment method
    pay_cod: "Cash on delivery",
    pay_card: "Card",
    pay_wallet: "Wallet",
    pay_bank_transfer: "Bank transfer",
    // risk flags
    risk_blacklisted_customer: "Blocked customer",
    risk_duplicate_order: "Possible duplicate order",
    risk_phone_daily_limit: "Too many orders today",
    risk_high_rejection_customer: "Often rejects orders",
    flagged: "Flagged",
  },
  ar: {
    stage_pending_confirmation: "جديد",
    stage_needs_follow_up: "للمتابعة",
    stage_ready_to_ship: "جاهز للشحن",
    stage_shipped: "تم الشحن",
    stage_out_for_delivery: "خرج للتوصيل",
    stage_delivery_failed: "فشل التوصيل",
    stage_delivered: "تم التسليم",
    stage_returned: "مرتجع",
    stage_cancelled: "ملغي",
    conf_pending: "في انتظار المكالمة",
    conf_confirmed: "مؤكد",
    conf_rejected: "مرفوض",
    conf_unreachable: "لم يتم الوصول إليه",
    conf_postponed: "مؤجل",
    fin_pending: "غير مدفوع",
    fin_partially_paid: "مدفوع جزئيًا",
    fin_paid: "مدفوع",
    fin_failed: "فشل الدفع",
    fin_refunded: "مسترد",
    fin_partially_refunded: "مسترد جزئيًا",
    ful_unfulfilled: "لم يُشحن",
    ful_partially_fulfilled: "شُحن جزئيًا",
    ful_fulfilled: "مكتمل",
    ful_returned: "مرتجع",
    ship_created: "تم الإنشاء",
    ship_picked_up: "تم الاستلام من المتجر",
    ship_in_transit: "في الطريق",
    ship_out_for_delivery: "خرج للتوصيل",
    ship_delivered: "تم التسليم",
    ship_failed: "فشل",
    ship_returned: "مرتجع",
    ship_cancelled: "ملغية",
    pay_cod: "الدفع عند الاستلام",
    pay_card: "بطاقة",
    pay_wallet: "محفظة إلكترونية",
    pay_bank_transfer: "تحويل بنكي",
    risk_blacklisted_customer: "عميل محظور",
    risk_duplicate_order: "أوردر مكرر محتمل",
    risk_phone_daily_limit: "أوردرات كثيرة اليوم",
    risk_high_rejection_customer: "يرفض الأوردرات كثيرًا",
    flagged: "مشتبه به",
  },
} satisfies Messages;

type LabelKey = keyof typeof LABELS.en;

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

/** Tone per stage, for <StatusBadge tone>. Stage keys aren't in its own table. */
export const STAGE_TONE: Record<OrderStage, BadgeTone> = {
  pending_confirmation: "warning",
  needs_follow_up: "warning",
  ready_to_ship: "info",
  shipped: "info",
  out_for_delivery: "info",
  delivery_failed: "danger",
  delivered: "success",
  returned: "danger",
  cancelled: "neutral",
};

function pick(t: Record<LabelKey, string>, prefix: string, value: string | null | undefined): string {
  if (!value) return "—";
  const key = `${prefix}_${value}` as LabelKey;
  // An enum value this build doesn't know yet still reads as something.
  return key in t ? t[key] : humanize(value);
}

export function useOrderLabels() {
  const t = useT(LABELS);
  return useMemo(
    () => ({
      stage: (v: OrderStage | null | undefined) => pick(t, "stage", v),
      confirmation: (v: ConfirmationState | null | undefined) => pick(t, "conf", v),
      financial: (v: FinancialState | null | undefined) => pick(t, "fin", v),
      fulfillment: (v: FulfillmentState | null | undefined) => pick(t, "ful", v),
      shipment: (v: ShipmentStatus | null | undefined) => pick(t, "ship", v),
      paymentMethod: (v: PaymentMethod | null | undefined) => pick(t, "pay", v),
      riskFlag: (v: RiskFlag | string | null | undefined) => pick(t, "risk", v),
      flagged: t.flagged,
    }),
    [t]
  );
}
