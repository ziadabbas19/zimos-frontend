import type { MerchantReferralCode, ReferralDiscountStep } from "@store-builder/api-client";
import { formatMoney } from "@/lib/format";
import { fmt, type Messages } from "@/i18n/LocaleContext";

/**
 * The words of a referral code on the plans page and in a plan change
 * (migration 725): why a code was refused, its discount payment by payment,
 * and the price before and after it.
 */
export const REFERRAL_CODE_STRINGS = {
  en: {
    REFERRAL_CODE_INVALID: "That referral code isn't valid. Check it and try again.",
    REFERRAL_CODE_ALREADY_SET: "Your store's current code still has a discount to give, so another code can't be added yet.",
    REFERRAL_CODE_ALREADY_USED: "This code has already been used on your account or store. Each code can be used once.",
    REFERRAL_CODE_EXPIRED: "This code has expired.",
    REFERRAL_CODE_NOT_STARTED: "This code can't be used yet.",
    REFERRAL_CODE_LIMIT_REACHED: "This code has been used as many times as it allows.",
    REFERRAL_CODE_NEW_MERCHANTS_ONLY: "This code is for new merchants only.",
    REFERRAL_CODE_EXISTING_MERCHANTS_ONLY: "This code is for existing merchants only.",
    REFERRAL_CODE_NOT_FOR_PLAN: "This code isn't for this plan.",
    REFERRAL_CODE_NOT_FOR_CYCLE: "This code isn't for this billing cycle.",
    REFERRAL_CODE_BELOW_MIN_PRICE: "This code is for higher-priced plans.",
    REFERRAL_CODE_TRIAL_ONLY: "This code adds trial days, so it's for stores still on their trial.",
    REFERRAL_V2_DISABLED: "Codes can't be added with a plan change yet.",
    listSep: ", ",
    stepFirst: "{off} on your first payment",
    stepFirstN: "{off} on your first {count} payments",
    stepEvery: "{off} on every payment",
    stepThen: "then {off} for {count} payments",
    stepThenOne: "then {off} on payment {from}",
    stepThenEvery: "then {off} on every payment after",
    pctOff: "{value}% off",
    amountOff: "{amount} off",
    monthsFree: "{count} month(s) free",
    grantTrial: "plus {count} extra trial day(s)",
    grantCredit: "plus {amount} balance credit",
    grantOrders: "plus {count} free order(s)",
    codeLabel: "Discount code",
    codeHint: "Have a code? It applies to your next payment.",
    check: "Check",
    checking: "Checking…",
    remove: "Remove",
    before: "Before",
    after: "With {code}",
    appliesNow: "This payment",
    appliesRenewal: "Your next renewal",
    payment: "Payment",
    youPay: "You pay",
    discount: "Discount",
  },
  ar: {
    REFERRAL_CODE_INVALID: "كود الإحالة غير صالح. تحقق منه وحاول مرة أخرى.",
    REFERRAL_CODE_ALREADY_SET: "الكود الحالي لمتجرك ما زال يمنح خصمًا، لذلك لا يمكن إضافة كود آخر الآن.",
    REFERRAL_CODE_ALREADY_USED: "استُخدم هذا الكود من قبل على حسابك أو متجرك. يُستخدم كل كود مرة واحدة.",
    REFERRAL_CODE_EXPIRED: "انتهت صلاحية هذا الكود.",
    REFERRAL_CODE_NOT_STARTED: "لا يمكن استخدام هذا الكود بعد.",
    REFERRAL_CODE_LIMIT_REACHED: "وصل هذا الكود إلى الحد الأقصى لعدد مرات الاستخدام.",
    REFERRAL_CODE_NEW_MERCHANTS_ONLY: "هذا الكود للتجار الجدد فقط.",
    REFERRAL_CODE_EXISTING_MERCHANTS_ONLY: "هذا الكود للتجار الحاليين فقط.",
    REFERRAL_CODE_NOT_FOR_PLAN: "هذا الكود غير مخصص لهذه الخطة.",
    REFERRAL_CODE_NOT_FOR_CYCLE: "هذا الكود غير مخصص لدورة الفوترة هذه.",
    REFERRAL_CODE_BELOW_MIN_PRICE: "هذا الكود مخصص للخطط الأعلى سعرًا.",
    REFERRAL_CODE_TRIAL_ONLY: "هذا الكود يضيف أيامًا للتجربة المجانية، لذلك هو للمتاجر التي ما زالت في فترة التجربة.",
    REFERRAL_V2_DISABLED: "لا يمكن إضافة كود مع تغيير الخطة حاليًا.",
    listSep: "، ",
    stepFirst: "{off} على دفعتك الأولى",
    stepFirstN: "{off} على أول {count} دفعات",
    stepEvery: "{off} على كل دفعة",
    stepThen: "ثم {off} لمدة {count} دفعات",
    stepThenOne: "ثم {off} على الدفعة رقم {from}",
    stepThenEvery: "ثم {off} على كل دفعة بعد ذلك",
    pctOff: "خصم {value}%",
    amountOff: "خصم {amount}",
    monthsFree: "{count} شهر مجانًا",
    grantTrial: "مع {count} يوم إضافي للتجربة",
    grantCredit: "مع رصيد {amount}",
    grantOrders: "مع {count} طلب مجاني",
    codeLabel: "كود الخصم",
    codeHint: "لديك كود؟ يُطبق على دفعتك القادمة.",
    check: "تحقق",
    checking: "جارٍ التحقق…",
    remove: "إزالة",
    before: "قبل",
    after: "مع {code}",
    appliesNow: "هذه الدفعة",
    appliesRenewal: "تجديدك القادم",
    payment: "الدفعة",
    youPay: "تدفع",
    discount: "الخصم",
  },
} satisfies Messages;

export type ReferralCodeText = Record<keyof (typeof REFERRAL_CODE_STRINGS)["en"], string>;

const ERROR_CODES = [
  "REFERRAL_CODE_INVALID",
  "REFERRAL_CODE_ALREADY_SET",
  "REFERRAL_CODE_ALREADY_USED",
  "REFERRAL_CODE_EXPIRED",
  "REFERRAL_CODE_NOT_STARTED",
  "REFERRAL_CODE_LIMIT_REACHED",
  "REFERRAL_CODE_NEW_MERCHANTS_ONLY",
  "REFERRAL_CODE_EXISTING_MERCHANTS_ONLY",
  "REFERRAL_CODE_NOT_FOR_PLAN",
  "REFERRAL_CODE_NOT_FOR_CYCLE",
  "REFERRAL_CODE_BELOW_MIN_PRICE",
  "REFERRAL_CODE_TRIAL_ONLY",
  "REFERRAL_V2_DISABLED",
] as const;

/** Every refusal of a code, for useErrorMessage's map. */
export function referralErrorMap(t: ReferralCodeText): Record<string, string> {
  return Object.fromEntries(ERROR_CODES.map((code) => [code, t[code]]));
}

function stepOff(step: ReferralDiscountStep, t: ReferralCodeText): string {
  if (step.type === "percentage") return fmt(t.pctOff, { value: step.value / 100 });
  if (step.type === "fixed") return fmt(t.amountOff, { amount: formatMoney(step.value, step.currency ?? "EGP") });
  return fmt(t.monthsFree, { count: step.value });
}

/** "100% off on your first payment, then 20% off for 3 payments". Empty for no steps. */
export function describeSchedule(steps: ReferralDiscountStep[], t: ReferralCodeText): string {
  let from = 1;
  return steps
    .map((step, i) => {
      const off = stepOff(step, t);
      const at = from;
      if (step.count != null) from += step.count;
      if (i === 0) return step.count == null ? fmt(t.stepEvery, { off }) : step.count === 1 ? fmt(t.stepFirst, { off }) : fmt(t.stepFirstN, { off, count: step.count });
      if (step.count == null) return fmt(t.stepThenEvery, { off });
      return step.count === 1 ? fmt(t.stepThenOne, { off, from: at }) : fmt(t.stepThen, { off, count: step.count });
    })
    .join(t.listSep);
}

/** A code with a schedule, for the cycle shown: its steps and its one-time benefit. Null for the first kind. */
export function scheduleLabel(code: MerchantReferralCode, cycle: "monthly" | "yearly", t: ReferralCodeText): string | null {
  if (!code.discountSchedule) return null;
  const parts = [describeSchedule(code.discountSchedule[cycle], t)].filter(Boolean);
  const g = code.grant;
  if (g) {
    parts.push(
      g.type === "trial_days" ? fmt(t.grantTrial, { count: g.value }) : g.type === "free_orders" ? fmt(t.grantOrders, { count: g.value }) : fmt(t.grantCredit, { amount: formatMoney(g.value, "EGP") })
    );
  }
  return parts.join(" ");
}
