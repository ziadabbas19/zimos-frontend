import { useCallback } from "react";
import { ApiError } from "@store-builder/api-client";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useErrorMessage } from "@/lib/errorMessages";

/**
 * Error wording for the orders screens' own API codes (status changes, notes,
 * tags, bulk actions…). Anything it does not know falls through to the shared
 * `useErrorMessage`.
 */
const STRINGS = {
  en: {
    INVALID_STATUS_TRANSITION: "This order can't be moved to that status from where it is now.",
    STATUS_UNCHANGED: "The order is already in that status.",
    ORDER_NOT_CANCELLED: "This order isn't cancelled.",
    ORDER_CANCELLED: "This order is cancelled.",
    ORDER_NOT_COD: "Only cash-on-delivery orders are confirmed by phone.",
    ORDER_ALREADY_CONFIRMED: "This order is already confirmed.",
    ORDER_NOT_CONFIRMED: "Confirm this order before shipping it.",
    ORDER_NOT_PAID: "This prepaid order must be paid before it ships.",
    ORDER_ALREADY_SHIPPED: "This order has already shipped and can't be changed.",
    INSUFFICIENT_STOCK: "There isn't enough stock left for this order.",
    // One order of a bulk result (no reason with it); a single refusal reads the shared, reason-aware wording.
    ORDER_LOCKED: "This order's customer details are hidden. Renew your subscription or top up your balance from My Plan, then try again.",
  },
  ar: {
    INVALID_STATUS_TRANSITION: "لا يمكن نقل هذا الأوردر إلى هذه الحالة من حالته الحالية.",
    STATUS_UNCHANGED: "الأوردر في هذه الحالة بالفعل.",
    ORDER_NOT_CANCELLED: "هذا الأوردر غير ملغي.",
    ORDER_CANCELLED: "هذا الأوردر ملغي.",
    ORDER_NOT_COD: "التأكيد بالهاتف لأوردرات الدفع عند الاستلام فقط.",
    ORDER_ALREADY_CONFIRMED: "هذا الأوردر مؤكد بالفعل.",
    ORDER_NOT_CONFIRMED: "أكّد الأوردر أولًا قبل شحنه.",
    ORDER_NOT_PAID: "يجب دفع هذا الأوردر قبل شحنه.",
    ORDER_ALREADY_SHIPPED: "تم شحن هذا الأوردر ولا يمكن تغييره.",
    INSUFFICIENT_STOCK: "لا يوجد مخزون كافٍ لهذا الأوردر.",
    ORDER_LOCKED: "بيانات عميل هذا الطلب مخفية. جدّد اشتراكك أو اشحن رصيدك من خطتي ثم حاول مرة أخرى.",
  },
} satisfies Messages;

type Code = keyof (typeof STRINGS)["en"];

export function useOrderErrorMessage() {
  const t = useT(STRINGS);
  const fallback = useErrorMessage();
  return useCallback(
    (err: unknown): string => {
      // An ApiError, or one order's { code, message } out of a bulk answer.
      const plain =
        !(err instanceof ApiError) && err && typeof err === "object" && "code" in err
          ? (err as { code?: string; message?: string })
          : null;
      const code = err instanceof ApiError ? (err.code as string | undefined) : plain?.code;
      // A whole refusal carries its reason (subscription or balance): the shared wording says which.
      if (code === "ORDER_LOCKED" && err instanceof ApiError) return fallback(err);
      if (code && code in t) return t[code as Code];
      if (plain) return plain.message || code || fallback(err);
      return fallback(err);
    },
    [t, fallback]
  );
}
