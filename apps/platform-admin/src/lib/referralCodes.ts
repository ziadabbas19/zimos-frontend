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
import { formatMinorMoneyExact, minorUnitDigits } from "./format.ts";

/**
 * The second kind of referral code (Agents → Referral codes, migration 725):
 * the form's state and the API's units. The API speaks basis points and minor
 * units; the form speaks percent and major units, as typed. A schedule is
 * steps of `count` payments each, the last one optionally "every payment
 * after" (an empty count). Everything here is pure so node --test checks it.
 */

export const CYCLES: BillingCycle[] = ["monthly", "yearly"];
export const WALLET_CURRENCY = "EGP";

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
    if (!last) throw new Error(`${where}: only the last step can run for every payment after.`);
    return null;
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 1200) throw new Error(`${where}: the number of payments is a whole number from 1 to 1200.`);
  return n;
}

function discountStep(d: DiscountStepDraft, last: boolean, where: string): ReferralDiscountStep {
  const count = parseCount(d.count, last, where);
  const n = Number(d.amount);
  if (!d.amount.trim() || !Number.isFinite(n) || n <= 0) throw new Error(`${where}: enter a discount greater than zero.`);
  if (d.type === "percentage") {
    if (n > 100) throw new Error(`${where}: a percentage is at most 100%.`);
    return { count, type: "percentage", value: Math.round(n * 100) };
  }
  if (d.type === "free_months") {
    if (!Number.isInteger(n) || n > 36) throw new Error(`${where}: free months are a whole number from 1 to 36.`);
    return { count, type: "free_months", value: n };
  }
  const currency = d.currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error(`${where}: enter a 3-letter currency code, such as EGP.`);
  return { count, type: "fixed", value: Math.round(n * 10 ** minorUnitDigits(currency)), currency };
}

function rateStep(d: RateStepDraft, last: boolean, where: string): ReferralCommissionStep {
  const count = parseCount(d.count, last, where);
  const n = Number(d.percent);
  if (!d.percent.trim() || !Number.isFinite(n) || n < 0 || n > 100) throw new Error(`${where}: a rate is a percentage from 0 to 100.`);
  return { count, rateBp: Math.round(n * 100) };
}

function cycleTerms(draft: CycleDraft, cycle: BillingCycle) {
  const label = cycle === "monthly" ? "Monthly" : "Yearly";
  return {
    discount: draft.discount.map((d, i) => discountStep(d, i === draft.discount.length - 1, `${label} discount step ${i + 1}`)),
    commission: draft.commission.map((d, i) => rateStep(d, i === draft.commission.length - 1, `${label} commission step ${i + 1}`)),
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
    if (!/^[A-Z0-9][A-Z0-9-]{2,31}$/.test(code)) throw new Error("A code is 3 to 32 letters, digits or dashes, starting with a letter or digit.");
    input.code = code;
  } else {
    input.active = form.active;
  }
  if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) throw new Error("The end date must be after the start date.");
  if (form.maxUses.trim()) {
    const n = Number(form.maxUses);
    if (!Number.isInteger(n) || n < 1) throw new Error("The use limit is a whole number of stores, 1 or more.");
    input.maxUses = n;
  }
  if (form.minPriceAmount.trim()) {
    const n = Number(form.minPriceAmount);
    const currency = form.minPriceCurrency.trim().toUpperCase();
    if (!Number.isFinite(n) || n < 0) throw new Error("The minimum price is an amount of 0 or more.");
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error("The minimum price needs a 3-letter currency code.");
    input.minPriceAmount = Math.round(n * 10 ** minorUnitDigits(currency));
    input.minPriceCurrency = currency;
  }
  if (form.grantType) {
    const n = Number(form.grantValue);
    if (form.grantType === "wallet_credit") {
      if (!Number.isFinite(n) || n <= 0) throw new Error("Enter the balance credit, more than zero.");
      input.grantValue = Math.round(n * 100);
    } else {
      if (!Number.isInteger(n) || n < 1) throw new Error(form.grantType === "trial_days" ? "Enter the extra trial days, 1 or more." : "Enter the free orders, 1 or more.");
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

const paymentsWord = (n: number) => (n === 1 ? "1 payment" : `${n} payments`);

function stepAmount(step: ReferralDiscountStep): string {
  if (step.type === "percentage") return `${percentText(step.value)} off`;
  if (step.type === "fixed") return `${formatMinorMoneyExact(step.value, step.currency ?? "EGP")} off`;
  return step.value === 1 ? "1 month free" : `${step.value} months free`;
}

function describeRun(steps: { count: number | null }[], one: (i: number) => string): string {
  if (steps.length === 0) return "";
  let start = 1;
  const parts = steps.map((step, i) => {
    const what = one(i);
    const from = start;
    if (step.count == null) return i === 0 ? `${what} on every payment` : `then ${what} on every payment after`;
    start += step.count;
    if (i === 0) return step.count === 1 ? `${what} on the first payment` : `${what} on the first ${paymentsWord(step.count)}`;
    return step.count === 1 ? `then ${what} on payment ${from}` : `then ${what} for ${paymentsWord(step.count)}`;
  });
  return parts.join(", ");
}

/** "100% off on the first payment, then 20% off for 3 payments" — "No discount" for none. */
export function describeDiscountSteps(steps: ReferralDiscountStep[]): string {
  return steps.length === 0 ? "No discount" : describeRun(steps, (i) => stepAmount(steps[i]));
}

/** "100% on the first payment, then 30% for 12 payments" — "No commission" for none. */
export function describeCommissionSteps(steps: ReferralCommissionStep[]): string {
  return steps.length === 0 ? "No commission" : describeRun(steps, (i) => percentText(steps[i].rateBp));
}

export const AUDIENCE_LABELS: Record<ReferralAudience, string> = {
  new: "New merchants only",
  existing: "Existing merchants only",
  any: "New and existing merchants",
};

export const STATE_LABELS: Record<ReferralCodeState, string> = {
  active: "Active",
  inactive: "Off",
  scheduled: "Not started",
  expired: "Expired",
  full: "Used up",
};

export const SOURCE_LABELS: Record<AdminRedemption["source"], string> = {
  signup: "At sign-up",
  plan_page: "Plans page",
  plan_switch: "With a plan change",
  legacy: "Before this version",
};

export const GRANT_LABELS: Record<ReferralGrantType, string> = {
  trial_days: "Extra trial days",
  wallet_credit: "Balance credit (pay per order)",
  free_orders: "Free orders (pay per order)",
};

export function describeGrant(grant: { type: ReferralGrantType; value: number } | null | undefined): string | null {
  if (!grant) return null;
  if (grant.type === "trial_days") return `${grant.value} extra trial ${grant.value === 1 ? "day" : "days"}`;
  if (grant.type === "free_orders") return `${grant.value} free ${grant.value === 1 ? "order" : "orders"}`;
  return `${formatMinorMoneyExact(grant.value, WALLET_CURRENCY)} balance credit`;
}

/** "12 / 100", "3 / no limit". */
export function usesLabel(code: Pick<AdminReferralCode, "usesCount" | "maxUses">): string {
  return `${code.usesCount ?? 0} / ${code.maxUses == null ? "no limit" : code.maxUses}`;
}

/** What a code takes off, monthly (and yearly when it differs), for a list row. */
export function describeCodeDiscount(code: AdminReferralCode): string {
  const terms = code.terms ?? code.effectiveTerms;
  if (!terms) return "No discount";
  const monthly = describeDiscountSteps(terms.monthly.discount);
  const yearly = describeDiscountSteps(terms.yearly.discount);
  return monthly === yearly ? monthly : `Monthly: ${monthly}. Yearly: ${yearly}`;
}
