import type {
  AdminRedemption,
  AdminReferralCode,
  AdminReferralCodeInput,
  BillingCycle,
  ReferralAudience,
  ReferralCodeState,
  ReferralCommissionBasis,
  ReferralCommissionStep,
  ReferralDiscountStep,
  ReferralGrantType,
  ReferralTerms,
} from "@store-builder/api-client";
import { fmt } from "../i18n/activeLocale.ts";
import { formatMinorMoneyExact, minorUnitDigits } from "./format.ts";
import { counted, referralStrings } from "./referralStrings.ts";

/**
 * The second kind of referral code (Agents → Referral codes, migration 725):
 * the form's state and the API's units. The API speaks basis points and minor
 * units; the form speaks percent and major units, as typed. A schedule is
 * steps of `count` payments each, the last one optionally "every payment
 * after" (an empty count). Everything here is pure so node --test checks it.
 */

export const CYCLES: BillingCycle[] = ["monthly", "yearly"];
export const WALLET_CURRENCY = "EGP";

export function cycleLabel(cycle: BillingCycle): string {
  return referralStrings()[`cycle_${cycle}` as const];
}

export interface DiscountStepDraft {
  /** Payments the step covers, as typed; "" = every payment after (last step only). */
  count: string;
  type: ReferralDiscountStep["type"];
  /** Percent, a major-unit amount, or a number of months, as typed. */
  amount: string;
  currency: string;
}

export interface RateStepDraft {
  count: string;
  percent: string;
}

export interface CycleDraft {
  discount: DiscountStepDraft[];
  commission: RateStepDraft[];
}

export interface CodeForm {
  code: string;
  label: string;
  /** "" = no agent: a discount only. */
  agentId: string;
  active: boolean;
  audience: ReferralAudience;
  /** datetime-local values ("" = none). */
  startsAt: string;
  endsAt: string;
  maxUses: string;
  allowedPlanIds: string[];
  allowedCycles: BillingCycle[];
  minPriceAmount: string;
  minPriceCurrency: string;
  /**
   * Whether the form sends its schedules. A code of the first kind (no
   * schedule: its one discount on every payment) keeps that until this is
   * turned on; a new code always has one.
   */
  useSchedule: boolean;
  /** Monthly and yearly share one schedule in the form. */
  sameForBoth: boolean;
  monthly: CycleDraft;
  yearly: CycleDraft;
  commissionBasis: ReferralCommissionBasis;
  linksAgent: boolean;
  grantType: "" | ReferralGrantType;
  grantValue: string;
}

const trimNumber = (n: number) => String(Math.round(n * 10000) / 10000);

/** 2000 → "20%", 1250 → "12.5%". */
export const percentText = (bp: number) => `${trimNumber(bp / 100)}%`;

function stepToDraft(step: ReferralDiscountStep): DiscountStepDraft {
  const currency = step.currency ?? "EGP";
  return {
    count: step.count == null ? "" : String(step.count),
    type: step.type,
    amount:
      step.type === "percentage"
        ? trimNumber(step.value / 100)
        : step.type === "fixed"
          ? trimNumber(step.value / 10 ** minorUnitDigits(currency))
          : String(step.value),
    currency,
  };
}

const rateToDraft = (step: ReferralCommissionStep): RateStepDraft => ({
  count: step.count == null ? "" : String(step.count),
  percent: trimNumber(step.rateBp / 100),
});

function cycleToDraft(terms: ReferralTerms | undefined | null, cycle: BillingCycle): CycleDraft {
  const t = terms?.[cycle];
  return { discount: (t?.discount ?? []).map(stepToDraft), commission: (t?.commission ?? []).map(rateToDraft) };
}

/** A new code's form: its discount on the first payment only, the platform's rate on every payment, new merchants only. */
export function newCycleDraft(defaultRateBp: number): CycleDraft {
  return {
    discount: [{ count: "1", type: "percentage", amount: "", currency: "EGP" }],
    commission: [{ count: "", percent: trimNumber(defaultRateBp / 100) }],
  };
}

/** datetime-local value for an ISO date (local time), "" for none. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const sameDraft = (a: CycleDraft, b: CycleDraft) => JSON.stringify(a) === JSON.stringify(b);

export function initialCodeForm(code: AdminReferralCode | undefined, defaultRateBp: number): CodeForm {
  if (!code) {
    return {
      code: "",
      label: "",
      agentId: "",
      active: true,
      audience: "new",
      startsAt: "",
      endsAt: "",
      maxUses: "",
      allowedPlanIds: [],
      allowedCycles: [],
      minPriceAmount: "",
      minPriceCurrency: "EGP",
      useSchedule: true,
      sameForBoth: true,
      monthly: newCycleDraft(defaultRateBp),
      yearly: newCycleDraft(defaultRateBp),
      commissionBasis: "paid",
      linksAgent: true,
      grantType: "",
      grantValue: "",
    };
  }
  const terms = code.terms ?? code.effectiveTerms ?? null;
  const monthly = cycleToDraft(terms, "monthly");
  const yearly = cycleToDraft(terms, "yearly");
  const grant = code.grant ?? null;
  return {
    code: code.code,
    label: code.label ?? "",
    agentId: code.agentId ?? "",
    active: code.active,
    audience: code.audience ?? "any",
    startsAt: toLocalInput(code.startsAt),
    endsAt: toLocalInput(code.endsAt),
    maxUses: code.maxUses == null ? "" : String(code.maxUses),
    allowedPlanIds: code.allowedPlanIds ?? [],
    allowedCycles: code.allowedCycles ?? [],
    minPriceAmount: code.minPrice ? trimNumber(code.minPrice.amount / 10 ** minorUnitDigits(code.minPrice.currency)) : "",
    minPriceCurrency: code.minPrice?.currency ?? "EGP",
    useSchedule: code.kind !== "legacy",
    sameForBoth: sameDraft(monthly, yearly),
    monthly,
    yearly,
    commissionBasis: code.commissionBasis ?? "paid",
    linksAgent: code.linksAgent ?? true,
    grantType: grant ? grant.type : "",
    grantValue: grant ? (grant.type === "wallet_credit" ? trimNumber(grant.value / 100) : String(grant.value)) : "",
  };
}

function parseCount(raw: string, last: boolean, where: string): number | null {
  if (!raw.trim()) {
    if (!last) throw new Error(fmt(referralStrings().errOnlyLastStep, { where }));
    return null;
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 1200) throw new Error(fmt(referralStrings().errPaymentsRange, { where }));
  return n;
}

function discountStep(d: DiscountStepDraft, last: boolean, where: string): ReferralDiscountStep {
  const t = referralStrings();
  const count = parseCount(d.count, last, where);
  const n = Number(d.amount);
  if (!d.amount.trim() || !Number.isFinite(n) || n <= 0) throw new Error(fmt(t.errDiscountAboveZero, { where }));
  if (d.type === "percentage") {
    if (n > 100) throw new Error(fmt(t.errPercentMax, { where }));
    return { count, type: "percentage", value: Math.round(n * 100) };
  }
  if (d.type === "free_months") {
    if (!Number.isInteger(n) || n > 36) throw new Error(fmt(t.errFreeMonths, { where }));
    return { count, type: "free_months", value: n };
  }
  const currency = d.currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error(fmt(t.errCurrency, { where }));
  return { count, type: "fixed", value: Math.round(n * 10 ** minorUnitDigits(currency)), currency };
}

function rateStep(d: RateStepDraft, last: boolean, where: string): ReferralCommissionStep {
  const count = parseCount(d.count, last, where);
  const n = Number(d.percent);
  if (!d.percent.trim() || !Number.isFinite(n) || n < 0 || n > 100) throw new Error(fmt(referralStrings().errRate, { where }));
  return { count, rateBp: Math.round(n * 100) };
}

function cycleTerms(draft: CycleDraft, cycle: BillingCycle) {
  const t = referralStrings();
  const label = cycleLabel(cycle);
  return {
    discount: draft.discount.map((d, i) => discountStep(d, i === draft.discount.length - 1, fmt(t.whereDiscount, { cycle: label, n: i + 1 }))),
    commission: draft.commission.map((d, i) => rateStep(d, i === draft.commission.length - 1, fmt(t.whereCommission, { cycle: label, n: i + 1 }))),
  };
}

/** The form's schedules in the API's units (the simulator sends these unsaved). Throws a message on bad input. */
export function termsOf(form: CodeForm): ReferralTerms {
  const monthly = cycleTerms(form.monthly, "monthly");
  return { monthly, yearly: form.sameForBoth ? cycleTerms(form.monthly, "monthly") : cycleTerms(form.yearly, "yearly") };
}

const isoOrNull = (local: string) => (local ? new Date(local).toISOString() : null);

/** The whole form in the API's units. `creating` adds the code itself. Throws a message on bad input. */
export function toCodeInput(form: CodeForm, { creating }: { creating: boolean }): AdminReferralCodeInput & { code?: string } {
  const t = referralStrings();
  const input: AdminReferralCodeInput & { code?: string } = {
    label: form.label.trim() || null,
    agentId: form.agentId || null,
    audience: form.audience,
    startsAt: isoOrNull(form.startsAt),
    endsAt: isoOrNull(form.endsAt),
    maxUses: null,
    allowedPlanIds: form.allowedPlanIds.length ? form.allowedPlanIds : null,
    allowedCycles: form.allowedCycles.length ? form.allowedCycles : null,
    minPriceAmount: null,
    minPriceCurrency: null,
    terms: termsOf(form),
    commissionBasis: form.commissionBasis,
    linksAgent: form.linksAgent,
    grantType: form.grantType || null,
    grantValue: null,
  };
  // A first-kind code keeps its every-payment discount unless it is given a schedule.
  if (!creating && !form.useSchedule) delete input.terms;
  if (creating) {
    const code = form.code.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9-]{2,31}$/.test(code)) throw new Error(t.errCodeFormat);
    input.code = code;
  } else {
    input.active = form.active;
  }
  if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) throw new Error(t.errDates);
  if (form.maxUses.trim()) {
    const n = Number(form.maxUses);
    if (!Number.isInteger(n) || n < 1) throw new Error(t.errUseLimit);
    input.maxUses = n;
  }
  if (form.minPriceAmount.trim()) {
    const n = Number(form.minPriceAmount);
    const currency = form.minPriceCurrency.trim().toUpperCase();
    if (!Number.isFinite(n) || n < 0) throw new Error(t.errMinPrice);
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error(t.errMinPriceCurrency);
    input.minPriceAmount = Math.round(n * 10 ** minorUnitDigits(currency));
    input.minPriceCurrency = currency;
  }
  if (form.grantType) {
    const n = Number(form.grantValue);
    if (form.grantType === "wallet_credit") {
      if (!Number.isFinite(n) || n <= 0) throw new Error(t.errGrantCredit);
      input.grantValue = Math.round(n * 100);
    } else {
      if (!Number.isInteger(n) || n < 1) throw new Error(form.grantType === "trial_days" ? t.errGrantTrial : t.errGrantOrders);
      input.grantValue = n;
    }
  }
  return input;
}

// ------------------------------------------------------------ presets

/** The discount half of a preset, for one cycle. */
export const PRESETS = {
  firstPayment: (percent: string): DiscountStepDraft[] => [{ count: "1", type: "percentage", amount: percent, currency: "EGP" }],
  forPayments: (percent: string, payments: string): DiscountStepDraft[] => [{ count: payments, type: "percentage", amount: percent, currency: "EGP" }],
  everyPayment: (percent: string): DiscountStepDraft[] => [{ count: "", type: "percentage", amount: percent, currency: "EGP" }],
  /** X free months: X free payments when monthly, one payment X months off when yearly. */
  freeMonths: (months: string, cycle: BillingCycle): DiscountStepDraft[] =>
    cycle === "monthly"
      ? [{ count: months, type: "percentage", amount: "100", currency: "EGP" }]
      : [{ count: "1", type: "free_months", amount: months, currency: "EGP" }],
};

// ------------------------------------------------------------ describe

function stepAmount(step: ReferralDiscountStep): string {
  const t = referralStrings();
  if (step.type === "percentage") return fmt(t.describeOff, { amount: percentText(step.value) });
  if (step.type === "fixed") return fmt(t.describeOff, { amount: formatMinorMoneyExact(step.value, step.currency ?? "EGP") });
  return counted(t, "freeMonths", step.value);
}

function describeRun(steps: { count: number | null }[], one: (i: number) => string): string {
  if (steps.length === 0) return "";
  const t = referralStrings();
  let start = 1;
  const parts = steps.map((step, i) => {
    const what = one(i);
    const from = start;
    if (step.count == null) return fmt(i === 0 ? t.runEvery : t.runEveryAfter, { what });
    start += step.count;
    const payments = counted(t, "payments", step.count);
    if (i === 0) return step.count === 1 ? fmt(t.runFirstOne, { what }) : fmt(t.runFirstMany, { what, payments });
    return step.count === 1 ? fmt(t.runAtPayment, { what, from }) : fmt(t.runForMany, { what, payments });
  });
  return parts.join(t.listSeparator);
}

/** "100% off on the first payment, then 20% off for 3 payments" — "No discount" for none. */
export function describeDiscountSteps(steps: ReferralDiscountStep[]): string {
  return steps.length === 0 ? referralStrings().describeNoDiscount : describeRun(steps, (i) => stepAmount(steps[i]));
}

/** "100% on the first payment, then 30% for 12 payments" — "No commission" for none. */
export function describeCommissionSteps(steps: ReferralCommissionStep[]): string {
  return steps.length === 0 ? referralStrings().describeNoCommission : describeRun(steps, (i) => percentText(steps[i].rateBp));
}

export function audienceLabels(): Record<ReferralAudience, string> {
  const t = referralStrings();
  return { new: t.audience_new, existing: t.audience_existing, any: t.audience_any };
}

export function stateLabels(): Record<ReferralCodeState, string> {
  const t = referralStrings();
  return { active: t.state_active, inactive: t.state_inactive, scheduled: t.state_scheduled, expired: t.state_expired, full: t.state_full };
}

export function sourceLabels(): Record<AdminRedemption["source"], string> {
  const t = referralStrings();
  return { signup: t.source_signup, plan_page: t.source_plan_page, plan_switch: t.source_plan_switch, legacy: t.source_legacy };
}

export function grantLabels(): Record<ReferralGrantType, string> {
  const t = referralStrings();
  return { trial_days: t.grant_trial_days, wallet_credit: t.grant_wallet_credit, free_orders: t.grant_free_orders };
}

export function describeGrant(grant: { type: ReferralGrantType; value: number } | null | undefined): string | null {
  if (!grant) return null;
  const t = referralStrings();
  if (grant.type === "trial_days") return counted(t, "grantTrial", grant.value);
  if (grant.type === "free_orders") return counted(t, "grantOrders", grant.value);
  return fmt(t.grantCredit, { amount: formatMinorMoneyExact(grant.value, WALLET_CURRENCY) });
}

/** "12 / 100", "3 / no limit". */
export function usesLabel(code: Pick<AdminReferralCode, "usesCount" | "maxUses">): string {
  return `${code.usesCount ?? 0} / ${code.maxUses == null ? referralStrings().describeNoLimit : code.maxUses}`;
}

/** What a code takes off, monthly (and yearly when it differs), for a list row. */
export function describeCodeDiscount(code: AdminReferralCode): string {
  const t = referralStrings();
  const terms = code.terms ?? code.effectiveTerms;
  if (!terms) return t.describeNoDiscount;
  const monthly = describeDiscountSteps(terms.monthly.discount);
  const yearly = describeDiscountSteps(terms.yearly.discount);
  return monthly === yearly ? monthly : fmt(t.describeByCycle, { monthly, yearly });
}

/** What a code pays its agent, monthly (and yearly when it differs), for a list row. */
export function describeCodeCommission(code: AdminReferralCode): string {
  const t = referralStrings();
  const terms = code.terms ?? code.effectiveTerms;
  if (!terms) return fmt(t.describeOfEachPayment, { rate: percentText(code.effectiveCommissionRateBp) });
  const monthly = describeCommissionSteps(terms.monthly.commission);
  const yearly = describeCommissionSteps(terms.yearly.commission);
  return monthly === yearly ? monthly : fmt(t.describeByCycle, { monthly, yearly });
}
