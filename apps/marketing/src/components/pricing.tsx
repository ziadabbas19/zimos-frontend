import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary, FaqItem } from "@/i18n/dictionary";
import { formatOrderCount, formatPrice } from "@/lib/format";
import type { PayPerOrderPlan } from "@/lib/plans";

/**
 * "Payment is currently by manual transfer; refunds follow the refund policy",
 * under every list of prices.
 */
export function PaymentNote({ copy, locale }: { copy: Dictionary["pricing"]; locale: Locale }) {
  return (
    <p className="mt-8 text-center text-sm text-ink-soft">
      {copy.paymentNote}{" "}
      <Link href={`/${locale}/refund-policy`} className="font-medium text-primary underline underline-offset-2">
        {copy.refundLink}
      </Link>
      .
    </p>
  );
}

/**
 * The pricing page's questions about the pay-per-order plan, for the Faq
 * section: what follows the free orders (only when the plan has some), when
 * the fee is taken (as the API says), whether the balance expires, and where
 * the plan is chosen. The fee and the free orders are the plan's own.
 */
export function payPerOrderQuestions(
  plan: PayPerOrderPlan,
  copy: Dictionary["pricing"],
  contactLink: string,
  locale: Locale
): Dictionary["faq"] {
  const t = copy.payPerOrder.faq;
  const items: FaqItem[] = [];
  if (plan.freeOrders > 0) {
    items.push({
      question: t.afterFreeQuestion,
      answer: t.afterFreeAnswer
        .replace("{orders}", formatOrderCount(plan.freeOrders, locale))
        .replace("{fee}", formatPrice(plan.feePerOrder, plan.currency, locale)),
    });
  }
  items.push(
    { question: t.whenQuestion, answer: plan.feeChargedAt === "confirmation" ? t.whenAtConfirmation : t.whenAtPlacement },
    { question: t.expiryQuestion, answer: t.expiryAnswer },
    { question: t.chooseQuestion, answer: t.chooseAnswer }
  );
  return { kicker: t.kicker, heading: t.heading, contactLink, items };
}
