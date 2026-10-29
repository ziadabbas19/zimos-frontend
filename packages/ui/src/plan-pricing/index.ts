// Imported as `@store-builder/ui/plan-pricing`, apart from the package's main
// entry, like `platform-info`: no React and no dependency, so the marketing
// site's server and the dashboard can both read it.

/** A plan's two prices, in minor units of its currency, as the API sends every amount. */
export interface CyclePrices {
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
}

/** What a yearly price comes to, worked out from the plan's own prices — never a fixed number of months. */
export interface YearlyBreakdown {
  /** The yearly price over twelve months, rounded to the currency's whole unit (EGP 265.83 → 266), in minor units. */
  perMonth: number;
  /** Twelve months at the monthly price, in minor units, while that is more than the yearly price; null when yearly saves nothing. */
  fullYear: number | null;
}

/** Decimal places of a currency's minor unit (EGP/USD 2, JPY 0, KWD 3), from Intl. */
function minorUnitDigits(currency: string): number {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/** The yearly price's month and the year it saves against; null for a plan with no yearly price. */
export function yearlyBreakdown(plan: CyclePrices): YearlyBreakdown | null {
  if (!(plan.yearlyPrice > 0)) return null;
  const unit = 10 ** minorUnitDigits(plan.currency);
  const fullYear = plan.monthlyPrice * 12;
  return {
    perMonth: Math.round(plan.yearlyPrice / 12 / unit) * unit,
    fullYear: plan.monthlyPrice > 0 && plan.yearlyPrice < fullYear ? fullYear : null,
  };
}

/** Whether paying yearly saves anything on at least one of the plans — the monthly/yearly switch says "save" only then. */
export function yearlySaves(plans: CyclePrices[]): boolean {
  return plans.some((plan) => yearlyBreakdown(plan)?.fullYear != null);
}
