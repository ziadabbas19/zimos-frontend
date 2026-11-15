import type { PlanSwitchPreview, PlanSwitchTiming, SubscriptionPlans } from "@store-builder/api-client";
import type { PlanSwitchText } from "./planSwitchStrings";

/**
 * The timings the merchant chooses between (an upgrade inside a paid period:
 * "now" and "period_end"), or null when there is nothing to choose: one
 * timing, or an older API that sends none.
 */
export function timingChoices(preview: Pick<PlanSwitchPreview, "timings" | "options">): PlanSwitchTiming[] | null {
  const choices = (preview.timings ?? []).filter((timing) => Boolean(preview.options?.[timing]));
  return choices.length > 1 ? choices : null;
}

/**
 * The preview as it reads for `timing`: that option's terms over the top
 * level (when, what is due, the renewal, what blocks it). An upgrade left for
 * the period's end reads as a scheduled change. Without that option, the
 * preview as sent.
 */
export function withTiming(preview: PlanSwitchPreview, timing: PlanSwitchTiming): PlanSwitchPreview {
  const option = preview.options?.[timing];
  if (!option) return preview;
  return {
    ...preview,
    ...option,
    timing,
    kind: preview.kind === "upgrade" && timing === "period_end" ? "scheduled" : preview.kind,
  };
}

/** Whether a switch goes to pay per order (the server's reason), in a preview or waiting. */
export const toPayPerOrder = (sw: { reason?: string | null } | null | undefined) => sw?.reason === "to_pay_per_order";

/**
 * What the confirmation's "Next renewal" row says, from preview.nextRenewal:
 *   "date"           the amount on its date (every kind with a date, "none"
 *                    included: the store's renewal as it stands);
 *   "after_payment"  a move, or an upgrade now, with no date: its period
 *                    starts when it is paid;
 *   "amount"         a date missing where one was expected: the amount alone;
 *   null             no row: a free plan (nextRenewal null), or "none" from an
 *                    older API (which sent no date for it).
 * A date that doesn't read as one counts as missing, so "Invalid date" never shows.
 */
export function renewalLine(preview: Pick<PlanSwitchPreview, "kind" | "nextRenewal">): "date" | "after_payment" | "amount" | null {
  const renewal = preview.nextRenewal;
  if (!renewal) return null;
  const dated = typeof renewal.at === "string" && !Number.isNaN(new Date(renewal.at).getTime());
  if (dated) return "date";
  if (preview.kind === "move" || preview.kind === "upgrade") return "after_payment";
  if (preview.kind === "none") return null;
  return "amount";
}

/** A number of hours in words (as formatDays does for days): "48 hours", "٤٨ ساعة". */
export function formatHours(hours: number, locale: "ar" | "en"): string {
  if (locale === "en") return hours === 1 ? "1 hour" : `${hours} hours`;
  const n = new Intl.NumberFormat("ar-EG").format(hours);
  if (hours === 1) return "ساعة واحدة";
  if (hours === 2) return "ساعتان";
  if (hours >= 3 && hours <= 10) return `${n} ساعات`;
  return `${n} ساعة`;
}

/** Whether this subscription changes plan by itself through /billing/plan-switch (the server says so). */
export function selfServeSwitch(view: SubscriptionPlans): boolean {
  return Boolean(view.planSwitch?.enabled && view.planSwitch.mode === "switch");
}

/** The words for the reason the server gives when support decides (flag on, mode "support"); null otherwise. */
export function supportReasonText(view: SubscriptionPlans, s: PlanSwitchText): string | null {
  const sw = view.planSwitch;
  if (!sw?.enabled || sw.mode !== "support") return null;
  if (sw.reason === "MANUAL_PRICING") return s.reasonManual;
  if (sw.reason === "SPECIAL_TERMS_ACTIVE") return s.reasonSpecial;
  if (sw.reason === "PLAN_CHANGE_NEEDS_SUPPORT") return s.reasonClosed;
  return null;
}
