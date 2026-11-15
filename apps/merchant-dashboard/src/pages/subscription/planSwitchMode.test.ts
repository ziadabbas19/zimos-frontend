import { describe, expect, it } from "vitest";
import type { PlanSwitchPreview } from "@store-builder/api-client";
import { formatHours, renewalLine, timingChoices, toPayPerOrder, withTiming } from "./planSwitchMode";

const renewal = (at: string | null) => ({ at, amount: 60000, currency: "EGP", billingCycle: "monthly" as const });
const line = (kind: PlanSwitchPreview["kind"], nextRenewal: PlanSwitchPreview["nextRenewal"]) => renewalLine({ kind, nextRenewal });

// What the confirmation's "Next renewal" row says (preview.nextRenewal).
describe("renewalLine", () => {
  it("a date: shown for every kind, the plan the store is on included", () => {
    for (const kind of ["upgrade", "scheduled", "immediate", "trial_change", "none", "move"] as const) {
      expect(line(kind, renewal("2030-02-01T00:00:00.000Z"))).toBe("date");
    }
  });

  it("a move, or an upgrade now, without a date: it follows the payment", () => {
    expect(line("move", renewal(null))).toBe("after_payment");
    expect(line("upgrade", renewal(null))).toBe("after_payment");
  });

  it("a free plan (nextRenewal null): no row", () => {
    for (const kind of ["immediate", "scheduled", "move"] as const) expect(line(kind, null)).toBeNull();
  });

  it("the plan the store is on, from an older API without a date: no row", () => {
    expect(line("none", renewal(null))).toBeNull();
  });

  it("a date missing or unreadable where one was expected: the amount alone, never an invalid date", () => {
    expect(line("immediate", renewal(null))).toBe("amount");
    expect(line("scheduled", renewal("not a date"))).toBe("amount");
    expect(line("move", renewal("not a date"))).toBe("after_payment");
  });
});

// The hours a plan switch's charge lives, in words (the confirmation's line).
describe("formatHours", () => {
  it("in English", () => {
    expect(formatHours(1, "en")).toBe("1 hour");
    expect(formatHours(48, "en")).toBe("48 hours");
  });

  it("in Arabic, with its number forms", () => {
    expect(formatHours(1, "ar")).toBe("ساعة واحدة");
    expect(formatHours(2, "ar")).toBe("ساعتان");
    expect(formatHours(5, "ar")).toBe("٥ ساعات");
    expect(formatHours(48, "ar")).toBe("٤٨ ساعة");
  });
});

// An upgrade's two timings (preview.timings / preview.options).
describe("timingChoices and withTiming", () => {
  const upgrade: PlanSwitchPreview = {
    kind: "upgrade",
    reason: "upgrade",
    timing: "now",
    timings: ["now", "period_end"],
    options: {
      now: { effective: "on_payment", effectiveAt: null, amountDue: 60000, currency: "EGP", chargeExpiry: { hours: 48, expiresAt: "2030-01-19T12:00:00.000Z" }, nextRenewal: renewal(null), payable: true, blockedBy: null },
      period_end: { effective: "period_end", effectiveAt: "2030-02-01T00:00:00.000Z", amountDue: 0, currency: "EGP", chargeExpiry: null, nextRenewal: renewal("2030-02-01T00:00:00.000Z"), payable: null, blockedBy: null },
    },
    currentPeriod: { endsAt: "2030-02-01T00:00:00.000Z", remainingDays: 15 },
    effective: "on_payment",
    effectiveAt: null,
    from: { planId: "plan_starter", planName: "Starter", billingCycle: "monthly", currency: "EGP" },
    to: { planId: "plan_pro", planName: "Pro", billingCycle: "monthly", currency: "EGP" },
    amountDue: 60000,
    currency: "EGP",
    proration: null,
    trial: false,
    chargeExpiry: { hours: 48, expiresAt: "2030-01-19T12:00:00.000Z" },
    nextRenewal: renewal(null),
    payable: true,
    blockedBy: null,
    replaces: null,
  };

  it("an upgrade offers both; one timing, or an older API, offers no choice", () => {
    expect(timingChoices(upgrade)).toEqual(["now", "period_end"]);
    expect(timingChoices({ timings: ["period_end"], options: { period_end: upgrade.options!.period_end } })).toBeNull();
    expect(timingChoices({})).toBeNull();
    // A timing listed without its terms is not offered.
    expect(timingChoices({ timings: ["now", "period_end"], options: { now: upgrade.options!.now } })).toBeNull();
  });

  it("at the end of the period it reads as a scheduled change with nothing due", () => {
    expect(withTiming(upgrade, "period_end")).toMatchObject({
      kind: "scheduled",
      timing: "period_end",
      effective: "period_end",
      effectiveAt: "2030-02-01T00:00:00.000Z",
      amountDue: 0,
      chargeExpiry: null,
      payable: null,
      reason: "upgrade",
    });
    expect(withTiming(upgrade, "now")).toMatchObject({ kind: "upgrade", amountDue: 60000, payable: true });
    // No such option: as sent.
    const plain = { ...upgrade, options: undefined };
    expect(withTiming(plain, "period_end")).toBe(plain);
  });

  it("toPayPerOrder reads the server's reason", () => {
    expect(toPayPerOrder({ reason: "to_pay_per_order" })).toBe(true);
    expect(toPayPerOrder({ reason: "downgrade" })).toBe(false);
    expect(toPayPerOrder(null)).toBe(false);
  });
});
