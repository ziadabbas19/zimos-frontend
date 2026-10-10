import { useMemo } from "react";
import { orderListExtrasOf, ordersMeta, type Order, type OrderListExtras, type OrderMeta } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { formatMoney } from "@/lib/format";
import { providerName } from "@/lib/providers";
import { toWhatsAppNumber } from "@/lib/whatsapp";
import { useRiskLevelLabel, useRiskReasonLabel, type OrderRiskFields } from "@/pages/fraud/RiskBadge";
import { dialablePhone, orderPlace } from "@/pages/home/today/OrderQuickLook";
import { useOrderLabels } from "../orderLabels";

const STRINGS = {
  en: {
    noName: "Customer without a name",
    test: "Test",
    poorData: "Poor data",
  },
  ar: {
    noName: "عميل بدون اسم",
    test: "تجريبي",
    poorData: "بيانات ضعيفة",
  },
} satisfies Messages;

export type OrderFlagTone = "danger" | "attention" | "info";

/** One of the small chips beside a customer's name: flagged, risk, poor data, test, new customer. */
export interface OrderFlagInfo {
  id: string;
  tone: OrderFlagTone;
  label: string;
  /** Why, on hover: the risk reasons, the flags. */
  title?: string;
}

// The chip on its own (glass off): the soft token fills. glass/orders.css gives the tinted pane.
const FLAG_TONE: Record<OrderFlagTone, string> = {
  danger: "bg-danger-soft text-danger",
  attention: "bg-accent-soft text-accent-dark",
  info: "bg-primary-soft text-primary-dark dark:text-primary",
};

/** A small chip beside the customer's name. The word carries the meaning; the colour only helps. */
export function OrderFlag({ flag }: { flag: OrderFlagInfo }) {
  return (
    <span
      data-tone={flag.tone}
      title={flag.title}
      className={cn(
        "zimos-order-flag inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[11px] leading-none font-semibold whitespace-nowrap",
        FLAG_TONE[flag.tone]
      )}
    >
      {flag.label}
    </span>
  );
}

/** An order as a row of the list draws it: everything worked out once, for the table and the cards alike. */
export interface OrderRowView {
  order: Order;
  /** The order's own page. */
  to: string;
  /** The customer's name, or «عميل من غير اسم». */
  name: string;
  /** The number as it came — masked for most roles (010****665). */
  rawPhone: string;
  /** The number when it is whole: only then is there anything to dial, message or copy. */
  phone: string | null;
  whatsapp: string | null;
  /** «القاهرة · مدينة نصر»; empty without an address. */
  place: string;
  money: string;
  stageLabel: string | null;
  flagged: boolean;
  meta: OrderMeta;
  extras: OrderListExtras;
  flags: OrderFlagInfo[];
  /** "Cash on delivery", or "Card · Paymob" for an online order. */
  paymentLabel: string;
}

/** The rows of the list, worked out when the orders change — not on every tick of a checkbox. */
export function useOrderRowViews(orders: readonly Order[]): OrderRowView[] {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const labels = useOrderLabels();
  const riskLevelLabel = useRiskLevelLabel();
  const riskReasonLabel = useRiskReasonLabel();

  return useMemo(
    () =>
      orders.map((order): OrderRowView => {
        const meta = ordersMeta(order);
        const extras = orderListExtrasOf(order);
        const risk = order as Order & OrderRiskFields;
        const rawPhone = order.contactSnapshot?.phone?.trim() || "";
        // A masked number is not one to dial or copy: every action on it needs the whole number.
        const phone = dialablePhone(rawPhone);
        const method = labels.paymentMethod(order.paymentMethod);

        const flags: OrderFlagInfo[] = [];
        if (order.riskFlags.length > 0) {
          flags.push({
            id: "flagged",
            tone: "danger",
            label: labels.flagged,
            title: order.riskFlags.map((flag) => labels.riskFlag(flag)).join(" · "),
          });
        }
        // As pages/fraud/RiskBadge.tsx: low risk says nothing in a list; poor data is said at any level.
        const level = risk.riskLevel;
        const reasons = (risk.riskReasons ?? []).map(riskReasonLabel).join(" · ") || undefined;
        if (level === "high" || level === "moderate") {
          flags.push({ id: "risk", tone: level === "high" ? "danger" : "attention", label: riskLevelLabel(level), title: reasons });
        }
        if ((level === "low" || level === "moderate" || level === "high") && risk.dataQuality === "low") {
          flags.push({ id: "data", tone: "attention", label: t.poorData, title: reasons });
        }
        if (meta.isTest) flags.push({ id: "test", tone: "attention", label: t.test });

        return {
          order,
          to: `/orders/${order.id}`,
          name: order.contactSnapshot?.fullName?.trim() || t.noName,
          rawPhone,
          phone,
          whatsapp: phone ? toWhatsAppNumber(phone) : null,
          place: orderPlace(order),
          money: formatMoney(order.totalAmount, order.currency),
          stageLabel: order.stage ? labels.stage(order.stage) : null,
          flagged: order.riskFlags.length > 0,
          meta,
          extras,
          flags,
          paymentLabel: order.paymentProvider ? `${method} · ${providerName(order.paymentProvider)}` : method,
        };
      }),
    // The label helpers follow the language and nothing else.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, locale]
  );
}

/** The row (table) or card (phone) of an order, as it is in the page now. */
export function orderRowElement(orderId: string): Element | null {
  return document.querySelector(`[data-order-row="${orderId}"]`);
}

/** Puts `value` on the clipboard; false when the browser would not. */
export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    // No permission, or an origin without the clipboard API: the old selection way still works there.
    const field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      field.remove();
    }
  }
}
