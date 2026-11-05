import type {
  AdminReferralCode,
  AdminReferralCodeInput,
  CommissionListStatus,
  ReferralDiscountType,
} from "@store-builder/api-client";
import { fmt } from "@/i18n/activeLocale";
import { formatBp, formatMinorMoneyExact, minorUnitDigits } from "@/lib/format";
import { referralStrings } from "@/lib/referralStrings";

/**
 * Referral-code helpers shared by the Agents screens and an agent's own My
 * referrals page. The API speaks basis points (1500 = 15.00%) for rates and
 * percentage discounts, and minor units for amounts; the forms speak percent
 * and major units, and these convert between the two.
 */

export function describeDiscount(code: Pick<AdminReferralCode, "discountType" | "discountValue" | "discountCurrency">) {
  const t = referralStrings();
  if (code.discountType === "percentage" && code.discountValue != null) return fmt(t.describeOff, { amount: formatBp(code.discountValue) });
  if (code.discountType === "fixed" && code.discountValue != null && code.discountCurrency) {
    return fmt(t.describeOff, { amount: formatMinorMoneyExact(code.discountValue, code.discountCurrency) });
  }
  return t.describeNoDiscount;
}

export function payoutOptions(): Array<{ value: "all" | CommissionListStatus; label: string }> {
  const t = referralStrings();
  return [
    { value: "all", label: t.payout_all },
    { value: "pending", label: t.payout_pending },
    { value: "marked_paid", label: t.payout_marked_paid },
    // Rows whose payment was reversed; they never count in totals.
    { value: "voided", label: t.payout_voided },
  ];
}

export interface CodeFormState {
  code: string;
  label: string;
  discountType: ReferralDiscountType;
  /** Percent (15, 12.5) or a major-unit amount (50, 49.99), as typed. */
  discountAmount: string;
  discountCurrency: string;
  /** Percent, as typed; empty = the platform default. */
  commissionPercent: string;
  active: boolean;
}

/**
 * Never approved yet (migration 742): it isn't on or off, it is waiting or
 * turned down, and approving it is what switches it on. A change waiting on an
 * approved code doesn't count, and an older API sends no status.
 */
export function neverApproved(code: Pick<AdminReferralCode, "approvalStatus" | "proposed">): boolean {
  return (code.approvalStatus === "pending" || code.approvalStatus === "rejected") && !code.proposed;
}

/**
 * The code a form edits. A creator's changes go on the code as it stands;
 * anyone else's are read against what would apply once reviewed, so saving a
 * form that shows the live values would throw away the change waiting.
 */
export function codeToEdit(code: AdminReferralCode, creator: boolean): AdminReferralCode {
  return creator ? code : (code.proposed ?? code);
}

/** What saving means for someone whose changes wait for a creator's review, from the console. */
export function consoleReviewHint(): string {
  return referralStrings().consoleReviewHint;
}

/** The same, for a new code. */
export function newCodeReviewHint(): string {
  return referralStrings().newCodeReviewHint;
}

export function initialCodeForm(code?: AdminReferralCode): CodeFormState {
  if (!code) {
    return {
      code: "",
      label: "",
      discountType: "none",
      discountAmount: "",
      discountCurrency: "USD",
      commissionPercent: "",
      active: true,
    };
  }
  const currency = code.discountCurrency ?? "USD";
  return {
    code: code.code,
    label: code.label ?? "",
    discountType: code.discountType,
    discountAmount:
      code.discountValue == null
        ? ""
        : code.discountType === "percentage"
          ? String(code.discountValue / 100)
          : String(code.discountValue / 10 ** minorUnitDigits(currency)),
    discountCurrency: currency,
    commissionPercent: code.commissionRateBp == null ? "" : String(code.commissionRateBp / 100),
    active: code.active,
  };
}

/** Form state → the API's units: basis points and minor units. Throws a message on bad input. */
export function toCodeInput(form: CodeFormState, { includeCode }: { includeCode: boolean }): AdminReferralCodeInput {
  const t = referralStrings();
  const input: AdminReferralCodeInput = {
    label: form.label.trim() || null,
    discountType: form.discountType,
    discountValue: null,
    discountCurrency: null,
    commissionRateBp: null,
  };
  if (includeCode) input.code = form.code.trim().toUpperCase();
  if (form.discountType !== "none") {
    const n = Number(form.discountAmount);
    if (!form.discountAmount.trim() || !Number.isFinite(n) || n <= 0) throw new Error(t.errLegacyDiscount);
    if (form.discountType === "percentage") {
      if (n > 100) throw new Error(t.errLegacyPercent);
      input.discountValue = Math.round(n * 100);
    } else {
      const currency = form.discountCurrency.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(currency)) throw new Error(t.errLegacyCurrency);
      input.discountCurrency = currency;
      input.discountValue = Math.round(n * 10 ** minorUnitDigits(currency));
    }
  }
  if (form.commissionPercent.trim()) {
    const rate = Number(form.commissionPercent);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error(t.errLegacyRate);
    input.commissionRateBp = Math.round(rate * 100);
  }
  return input;
}
