import { describe, expect, it } from "vitest";
import { yearlyBreakdown, yearlySaves } from "@store-builder/ui/plan-pricing";

/**
 * What a yearly price comes to (@store-builder/ui/plan-pricing, shared with
 * the dashboard's plan cards): worked out from the plan's own monthly and
 * yearly prices, in minor units, never from a fixed number of free months.
 */

const egp = (monthlyPrice: number, yearlyPrice: number) => ({ monthlyPrice, yearlyPrice, currency: "EGP" });

describe("yearlyBreakdown", () => {
  it("strikes twelve monthly payments and divides the year by twelve, to the whole pound", () => {
    // EGP 319 a month, EGP 3,190 a year: EGP 3,828 struck, EGP 265.83 → 266 a month.
    expect(yearlyBreakdown(egp(31900, 319000))).toEqual({ fullYear: 382800, perMonth: 26600 });
  });

  it("rounds to the nearest pound, half up", () => {
    expect(yearlyBreakdown(egp(10000, 100000))?.perMonth).toBe(8300); // 83.33 → 83
    expect(yearlyBreakdown(egp(10000, 100200))?.perMonth).toBe(8400); // 83.5 → 84
    expect(yearlyBreakdown(egp(10000, 120000))?.perMonth).toBe(10000); // exactly 100
  });

  it("follows the plan's prices, whatever the months free", () => {
    expect(yearlyBreakdown(egp(50000, 540000))).toEqual({ fullYear: 600000, perMonth: 45000 });
  });

  it("strikes nothing when yearly saves nothing, and still says what it comes to a month", () => {
    expect(yearlyBreakdown(egp(10000, 120000))).toEqual({ fullYear: null, perMonth: 10000 });
    expect(yearlyBreakdown(egp(10000, 130000))).toEqual({ fullYear: null, perMonth: 10800 });
  });

  it("is nothing for a plan with no yearly price, and strikes nothing for one free monthly", () => {
    expect(yearlyBreakdown(egp(10000, 0))).toBeNull();
    expect(yearlyBreakdown(egp(0, 0))).toBeNull();
    expect(yearlyBreakdown(egp(0, 120000))?.fullYear).toBeNull();
  });

  it("rounds to the currency's own unit", () => {
    // JPY has no minor unit: ¥10,000 a year is ¥833.33 → ¥833 a month.
    expect(yearlyBreakdown({ monthlyPrice: 1000, yearlyPrice: 10000, currency: "JPY" })).toEqual({ fullYear: 12000, perMonth: 833 });
  });
});

describe("yearlySaves", () => {
  it("is true while yearly saves on one plan at least", () => {
    expect(yearlySaves([egp(10000, 120000), egp(31900, 319000)])).toBe(true);
    expect(yearlySaves([egp(10000, 120000), egp(0, 0)])).toBe(false);
    expect(yearlySaves([])).toBe(false);
  });
});
