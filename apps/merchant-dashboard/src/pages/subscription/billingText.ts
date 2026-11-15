import type { MerchantReferralCode } from "@store-builder/api-client";
import { formatMoney } from "@/lib/format";
import { fmt, type Messages } from "@/i18n/LocaleContext";

/** The words and small helpers of the billing parts (billingParts.tsx), kept apart so that file holds components only. */

/**
 * Role keys that hold billing.manage, which the /workspaces/:id/billing
 * endpoints need: the owner ('*') and the accountant (SYSTEM_ROLES in the
 * backend's core/security/permissions.js).
 */
export const BILLING_ROLES: ReadonlySet<string> = new Set(["owner", "accountant"]);

export const BILLING_STRINGS = {
  en: {
    title: "Plan and referral code",
    description: "Your Zimos plan, and the referral code of the agent who introduced you, if you have one.",
    plan: "Plan",
    noPlan: "No plan",
    status: "Status",
    trialing: "Free trial",
    draft: "Draft (not subscribed yet)",
    active: "Active",
    past_due: "Payment due",
    suspended: "Suspended",
    cancelled: "Cancelled",
    trialEnds: "Trial ends {date}",
    renews: "Current period ends {date}",
    monthly: "Monthly",
    yearly: "Yearly",
    cycle: "Billing cycle",
    cycleMonthly: "Monthly — {price} a month",
    cycleYearly: "Annual — {price} a year",
    /** While annual is less than twelve monthly payments (@store-builder/ui/plan-pricing). */
    cycleYearlySaves: "Annual — {price} a year · Save",
    cycleHint: "Applies from your next payment.",
    cycleSaved: "Billing cycle updated. It applies from your next payment.",
    cycleOpenCharge: "A payment is already open at your current billing cycle. You can switch once it's settled.",
    nextCharge: "Next charge",
    nextChargeDiscount: "{amount} (plan price {gross}, {discount} off with your code)",
    paymentLink: "Pay and see invoices",
    referralCode: "Referral code",
    referralHint: "Got a code from a Zimos agent? Enter it here. It applies to your plan's payments and can only be set once.",
    codePlaceholder: "e.g. CAIRO10",
    apply: "Apply code",
    applying: "Applying…",
    applied: "Referral code applied.",
    attachedOn: "Applied on {date}",
    noDiscount: "No discount — it records who referred you.",
    percentOff: "{value}% off each payment",
    fixedOff: "{amount} off each payment",
    inactive: "This code is no longer active, so it gives no discount on new payments.",
    invalid: "That referral code isn't valid. Check it and try again.",
    alreadySet: "This store already has a referral code.",
    payTitle: "Pay online",
    payHint: "Pay one period of your plan ({amount}) on Fawaterak's secure payment page.",
    payNow: "Pay now",
    opening: "Opening the payment page…",
    awaitingReference: "Waiting for your payment by {method}. Reference number: {reference}",
    checking: "Checking your payment…",
    paid: "Payment received. Your subscription is active.",
    stillPending: "Your payment is still being processed. This page will show it once it's confirmed.",
    notCompleted: "The payment wasn't completed. You can try again.",
    leftPayment: "You left the payment page without paying. You can pay any time.",
    review: "We received a payment that needs review by the Zimos team. We'll contact you.",
    duplicate: "This charge was already paid. The Zimos team will contact you about refunding this payment.",
    notConfirmedYet: "We couldn't confirm the payment yet. If you paid, it will show here shortly.",
    payDisabled: "Online payment isn't available right now.",
    payUnavailable: "Online payment isn't available right now. Try again later.",
    payCurrency: "Online payment is only available for plans priced in Egyptian pounds.",
    payStartFailed: "The payment page couldn't be opened. Try again in a few minutes.",
    payStarting: "A payment is already being opened. Wait a moment and try again.",
    nothingToPay: "Nothing is due right now.",
    chargeSettled: "This charge was settled in the meantime. Reload the page.",
  },
  ar: {
    title: "الخطة وكود الإحالة",
    description: "خطتك في Zimos، وكود الإحالة الخاص بالمندوب الذي عرّفك بنا إن وُجد.",
    plan: "الخطة",
    noPlan: "بدون خطة",
    status: "الحالة",
    trialing: "فترة تجريبية",
    draft: "مسودة (لم يُشترك بعد)",
    active: "نشطة",
    past_due: "مستحقة الدفع",
    suspended: "موقوفة",
    cancelled: "ملغاة",
    trialEnds: "تنتهي الفترة التجريبية في {date}",
    renews: "تنتهي الفترة الحالية في {date}",
    monthly: "شهري",
    yearly: "سنوي",
    cycle: "دورة الفوترة",
    cycleMonthly: "شهري — {price} شهريًا",
    cycleYearly: "سنوي — {price} سنويًا",
    cycleYearlySaves: "سنوي — {price} سنويًا · وفّر",
    cycleHint: "يُطبق من دفعتك القادمة.",
    cycleSaved: "تم تحديث دورة الفوترة. تُطبق من دفعتك القادمة.",
    cycleOpenCharge: "هناك دفعة مفتوحة بدورة الفوترة الحالية. يمكنك التبديل بعد تسويتها.",
    nextCharge: "الدفعة القادمة",
    nextChargeDiscount: "{amount} (سعر الخطة {gross}، وخصم {discount} بكودك)",
    paymentLink: "ادفع واعرض الفواتير",
    referralCode: "كود الإحالة",
    referralHint: "حصلت على كود من أحد مندوبي Zimos؟ أدخله هنا. يُطبق على مدفوعات خطتك ويمكن إدخاله مرة واحدة فقط.",
    codePlaceholder: "مثال: CAIRO10",
    apply: "تطبيق الكود",
    applying: "جارٍ التطبيق…",
    applied: "تم تطبيق كود الإحالة.",
    attachedOn: "طُبق في {date}",
    noDiscount: "بدون خصم — يسجل فقط من قام بإحالتك.",
    percentOff: "خصم {value}% على كل دفعة",
    fixedOff: "خصم {amount} على كل دفعة",
    inactive: "هذا الكود لم يعد نشطًا، لذلك لا يمنح خصمًا على المدفوعات الجديدة.",
    invalid: "كود الإحالة غير صالح. تحقق منه وحاول مرة أخرى.",
    alreadySet: "هذا المتجر لديه كود إحالة بالفعل.",
    payTitle: "الدفع الإلكتروني",
    payHint: "ادفع قيمة فترة واحدة من خطتك ({amount}) عبر صفحة الدفع الآمنة من فواتيرك.",
    payNow: "ادفع الآن",
    opening: "جارٍ فتح صفحة الدفع…",
    awaitingReference: "بانتظار دفعتك عبر {method}. الرقم المرجعي: {reference}",
    checking: "جارٍ التحقق من دفعتك…",
    paid: "تم استلام الدفعة، واشتراكك نشط.",
    stillPending: "دفعتك قيد المعالجة. ستظهر في هذه الصفحة عند تأكيدها.",
    notCompleted: "لم تكتمل عملية الدفع. يمكنك المحاولة مرة أخرى.",
    leftPayment: "غادرت صفحة الدفع دون إتمام الدفع. يمكنك الدفع في أي وقت.",
    review: "استلمنا دفعة تحتاج إلى مراجعة من فريق Zimos، وسنتواصل معك.",
    duplicate: "هذه الدفعة مسددة بالفعل. سيتواصل معك فريق Zimos بشأن استرداد هذا المبلغ.",
    notConfirmedYet: "لم نتمكن من تأكيد الدفعة بعد. إذا أتممت الدفع فستظهر هنا قريبًا.",
    payDisabled: "الدفع الإلكتروني غير متاح حاليًا.",
    payUnavailable: "الدفع الإلكتروني غير متاح حاليًا. حاول مرة أخرى لاحقًا.",
    payCurrency: "الدفع الإلكتروني متاح فقط للخطط المسعّرة بالجنيه المصري.",
    payStartFailed: "تعذّر فتح صفحة الدفع. حاول مرة أخرى بعد بضع دقائق.",
    payStarting: "هناك عملية دفع يجري فتحها بالفعل. انتظر لحظة ثم حاول مرة أخرى.",
    nothingToPay: "لا يوجد مبلغ مستحق حاليًا.",
    chargeSettled: "تمت تسوية هذه الدفعة في الأثناء. أعد تحميل الصفحة.",
  },
} satisfies Messages;

// Which of Fawaterak's redirects brought the merchant back. It only words the
// message; the payment's state always comes from the server.
export type ReturnHint = "success" | "fail" | "pending" | "back" | null;
export const hintOf = (value: string | null): ReturnHint =>
  value === "success" || value === "fail" || value === "pending" || value === "back" ? value : null;

/** "10% off each payment", "EGP 50 off each payment", or that it gives no discount. */
export function codeDiscountLabel(code: MerchantReferralCode, t: Record<keyof (typeof BILLING_STRINGS)["en"], string>): string {
  if (code.discountType === "percentage" && code.discountValue != null) return fmt(t.percentOff, { value: code.discountValue / 100 });
  if (code.discountType === "fixed" && code.discountValue != null && code.discountCurrency) {
    return fmt(t.fixedOff, { amount: formatMoney(code.discountValue, code.discountCurrency) });
  }
  return t.noDiscount;
}
