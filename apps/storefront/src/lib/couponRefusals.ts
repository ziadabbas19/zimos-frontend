import { ApiError, apiErrorDetails, type CouponRefusal } from "@store-builder/api-client";
import { pickText, type Locale } from "./i18n";

/**
 * Why a coupon was refused, in the shopper's words — one map for the coupon
 * preview (components/offers/CouponBits) and a checkout the server refused
 * for its code (lib/placeOrder orderErrorMessage). Every code of
 * COUPON_REFUSALS (@store-builder/api-client) has its line; a code this
 * storefront does not know gives null, and the caller keeps its own generic
 * text. Arabic is the shopper's Egyptian colloquial; French reads English.
 */

const arNum = (n: number) => new Intl.NumberFormat("ar-EG").format(n);

/** What is still missing, from the refusal's `details[0]` (minor units for money). */
export interface CouponShortfall {
  /** Formatted money still missing, or null when the server did not say. */
  amount: string | null;
  /** Pieces still missing, or null when the server did not say. */
  quantity: number | null;
}

type Line = (missing: CouponShortfall) => string;

/** "قطعة" / "قطعتين" / "٣ قطع" / "١١ قطعة". */
function arPieces(n: number): string {
  if (n === 1) return "قطعة واحدة";
  if (n === 2) return "قطعتين";
  if (n >= 3 && n <= 10) return `${arNum(n)} قطع`;
  return `${arNum(n)} قطعة`;
}

export const COUPON_REFUSAL_TEXT: { ar: Record<CouponRefusal, Line>; en: Record<CouponRefusal, Line> } = {
  ar: {
    INVALID_DISCOUNT_CODE: () => "الكود ده مش صحيح — اتأكد منه وجرّب تاني.",
    DISCOUNT_DISABLED: () => "الكود ده متوقف دلوقتي.",
    DISCOUNT_NOT_STARTED: () => "الكود ده لسه مبدأش.",
    DISCOUNT_EXPIRED: () => "الكود ده خلص.",
    DISCOUNT_NOT_ACTIVE_NOW: () => "الكود ده مش شغال في الوقت ده.",
    DISCOUNT_MINIMUM_NOT_MET: ({ amount }) => (amount ? `ضيف بـ ${amount} كمان علشان الكود يشتغل.` : "طلبك لسه أقل من الحد الأدنى للكود ده."),
    DISCOUNT_MIN_QUANTITY_NOT_MET: ({ quantity }) =>
      quantity ? `ضيف ${arPieces(quantity)} كمان علشان الكود يشتغل.` : "ضيف قطع أكتر علشان الكود يشتغل.",
    DISCOUNT_QUANTITY_NOT_MET: ({ quantity }) =>
      quantity ? `ضيف ${arPieces(quantity)} كمان علشان تاخد العرض ده.` : "ضيف قطع أكتر علشان تاخد العرض ده.",
    DISCOUNT_NOT_APPLICABLE: () => "الكود ده مش على المنتجات اللي في طلبك.",
    DISCOUNT_NOT_COMBINABLE: () => "الكود ده مبيشتغلش على العروض أو المنتجات اللي عليها خصم.",
    DISCOUNT_NOT_ELIGIBLE: () => "الكود ده مش متاح ليك.",
    DISCOUNT_FIRST_ORDER_ONLY: () => "الكود ده لأول طلب بس.",
    DISCOUNT_RETURNING_ONLY: () => "الكود ده لعملائنا اللي طلبوا قبل كده.",
    DISCOUNT_USAGE_LIMIT_REACHED: () => "الكود ده خلص عدد مرات استخدامه.",
    DISCOUNT_PER_CUSTOMER_LIMIT_REACHED: () => "انت استخدمت الكود ده قبل كده.",
  },
  en: {
    INVALID_DISCOUNT_CODE: () => "This code isn't valid — check it and try again.",
    DISCOUNT_DISABLED: () => "This code is paused right now.",
    DISCOUNT_NOT_STARTED: () => "This code hasn't started yet.",
    DISCOUNT_EXPIRED: () => "This code has expired.",
    DISCOUNT_NOT_ACTIVE_NOW: () => "This code doesn't work at this time.",
    DISCOUNT_MINIMUM_NOT_MET: ({ amount }) => (amount ? `Add ${amount} more to use this code.` : "Your order is below this code's minimum."),
    DISCOUNT_MIN_QUANTITY_NOT_MET: ({ quantity }) =>
      quantity ? `Add ${quantity} more ${quantity === 1 ? "item" : "items"} to use this code.` : "Add more items to use this code.",
    DISCOUNT_QUANTITY_NOT_MET: ({ quantity }) =>
      quantity ? `Add ${quantity} more ${quantity === 1 ? "item" : "items"} to get this offer.` : "Add more items to get this offer.",
    DISCOUNT_NOT_APPLICABLE: () => "This code doesn't apply to the items in your order.",
    DISCOUNT_NOT_COMBINABLE: () => "This code doesn't work on offers or items that are already discounted.",
    DISCOUNT_NOT_ELIGIBLE: () => "This code isn't available to you.",
    DISCOUNT_FIRST_ORDER_ONLY: () => "This code is for a first order only.",
    DISCOUNT_RETURNING_ONLY: () => "This code is for customers who have ordered before.",
    DISCOUNT_USAGE_LIMIT_REACHED: () => "This code has been used up.",
    DISCOUNT_PER_CUSTOMER_LIMIT_REACHED: () => "You've already used this code.",
  },
};

export interface CouponMessageContext {
  locale: Locale;
  /** Minor units → the store's money, in the order's currency. */
  money: (amountMinor: number) => string;
}

const positive = (value: unknown): number | null => {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * The shopper's line for a refused coupon: `code` is the preview's `reason`
 * or the checkout error's code, `details` its details (the first one says
 * what is missing: `remainingAmount` in minor units, `remainingQuantity`, or
 * `remainingUnits` for a buy-X-get-Y offer). Null for any other code.
 */
export function couponRefusalMessage(code: string | null | undefined, details: unknown, ctx: CouponMessageContext): string | null {
  if (!code) return null;
  const lines = pickText(COUPON_REFUSAL_TEXT, ctx.locale) as Record<string, Line | undefined>;
  const line = Object.prototype.hasOwnProperty.call(lines, code) ? lines[code] : undefined;
  if (!line) return null;
  const first = (Array.isArray(details) ? details[0] : null) as Record<string, unknown> | null | undefined;
  const amount = positive(first?.remainingAmount);
  const quantity = positive(first?.remainingQuantity) ?? positive(first?.remainingUnits);
  return line({ amount: amount === null ? null : ctx.money(amount), quantity: quantity === null ? null : Math.ceil(quantity) });
}

/** The same line for a refused checkout (an ApiError carrying one of these codes), or null. */
export function couponRefusalOfError(err: unknown, ctx: CouponMessageContext): string | null {
  if (!(err instanceof ApiError)) return null;
  return couponRefusalMessage(err.code, apiErrorDetails(err), ctx);
}
