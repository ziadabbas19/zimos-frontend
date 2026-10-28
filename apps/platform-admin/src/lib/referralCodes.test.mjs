import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PRESETS,
  describeCommissionSteps,
  describeDiscountSteps,
  describeGrant,
  initialCodeForm,
  termsOf,
  toCodeInput,
  usesLabel,
} from "./referralCodes.ts";

const pct = (count, value) => ({ count, type: "percentage", value });

describe("a new code's form", () => {
  it("starts as first payment only, new merchants only, the platform's rate on every payment", () => {
    const form = initialCodeForm(undefined, 3000);
    assert.equal(form.audience, "new");
    assert.deepEqual(form.monthly.discount, [{ count: "1", type: "percentage", amount: "", currency: "EGP" }]);
    assert.deepEqual(form.monthly.commission, [{ count: "", percent: "30" }]);
    assert.equal(form.sameForBoth, true);
  });
});

describe("form → API units", () => {
  const base = () => ({ ...initialCodeForm(undefined, 3000), code: " cairo-10 " });

  it("percent to basis points, major units to minor, the same schedule on both cycles", () => {
    const form = base();
    form.monthly.discount = [
      { count: "1", type: "percentage", amount: "100", currency: "EGP" },
      { count: "3", type: "percentage", amount: "12.5", currency: "EGP" },
    ];
    form.monthly.commission = [
      { count: "1", percent: "100" },
      { count: "12", percent: "30" },
    ];
    form.maxUses = "100";
    form.grantType = "wallet_credit";
    form.grantValue = "25.50";
    const input = toCodeInput(form, { creating: true });
    assert.equal(input.code, "CAIRO-10");
    assert.deepEqual(input.terms.monthly.discount, [pct(1, 10000), pct(3, 1250)]);
    assert.deepEqual(input.terms.yearly, input.terms.monthly);
    assert.deepEqual(input.terms.monthly.commission, [{ count: 1, rateBp: 10000 }, { count: 12, rateBp: 3000 }]);
    assert.equal(input.maxUses, 100);
    assert.equal(input.agentId, null);
    assert.deepEqual([input.grantType, input.grantValue], ["wallet_credit", 2550]);
  });

  it("separate cycles, a fixed amount and free months", () => {
    const form = base();
    form.sameForBoth = false;
    form.monthly.discount = [{ count: "", type: "fixed", amount: "50", currency: "egp" }];
    form.yearly.discount = PRESETS.freeMonths("2", "yearly");
    const terms = termsOf(form);
    assert.deepEqual(terms.monthly.discount, [{ count: null, type: "fixed", value: 5000, currency: "EGP" }]);
    assert.deepEqual(terms.yearly.discount, [{ count: 1, type: "free_months", value: 2 }]);
    assert.deepEqual(PRESETS.freeMonths("3", "monthly"), [{ count: "3", type: "percentage", amount: "100", currency: "EGP" }]);
  });

  it("refuses an open-ended step that is not the last, and bad numbers, with a message", () => {
    const form = base();
    form.monthly.discount = [
      { count: "", type: "percentage", amount: "10", currency: "EGP" },
      { count: "1", type: "percentage", amount: "5", currency: "EGP" },
    ];
    assert.throws(() => toCodeInput(form, { creating: true }), /only the last step/);
    const bad = base();
    bad.monthly.discount = [{ count: "1", type: "percentage", amount: "120", currency: "EGP" }];
    assert.throws(() => toCodeInput(bad, { creating: true }), /at most 100%/);
    const dates = base();
    dates.monthly.discount = [{ count: "1", type: "percentage", amount: "10", currency: "EGP" }];
    dates.startsAt = "2026-11-02T10:00";
    dates.endsAt = "2026-11-01T10:00";
    assert.throws(() => toCodeInput(dates, { creating: true }), /end date/);
  });

  it("an edit sends `active` and no code; a saved code reads back into the same form", () => {
    const saved = {
      id: "c1",
      agentId: "a1",
      code: "STEPS",
      label: null,
      discountType: "none",
      discountValue: null,
      discountCurrency: null,
      commissionRateBp: null,
      effectiveCommissionRateBp: 3000,
      active: false,
      createdAt: "",
      updatedAt: "",
      audience: "any",
      maxUses: 5,
      usesCount: 2,
      terms: { monthly: { discount: [pct(1, 10000)], commission: [{ count: null, rateBp: 3000 }] }, yearly: { discount: [pct(1, 5000)], commission: [] } },
      commissionBasis: "list",
      linksAgent: false,
      grant: { type: "trial_days", value: 7 },
    };
    const form = initialCodeForm({ ...saved, kind: "schedule" }, 3000);
    assert.equal(form.sameForBoth, false);
    assert.equal(form.yearly.discount[0].amount, "50");
    const input = toCodeInput(form, { creating: false });
    assert.equal(input.code, undefined);
    assert.equal(input.active, false);
    assert.deepEqual(input.terms, saved.terms);
    assert.deepEqual([input.commissionBasis, input.linksAgent, input.grantType, input.grantValue, input.maxUses], ["list", false, "trial_days", 7, 5]);
  });
});

describe("a code of the first kind", () => {
  it("keeps its every-payment discount on an edit unless it is given a schedule", () => {
    const legacy = {
      id: "c2", agentId: "a1", code: "FREE100", label: null, discountType: "percentage", discountValue: 10000, discountCurrency: null,
      commissionRateBp: 0, effectiveCommissionRateBp: 0, active: true, createdAt: "", updatedAt: "", kind: "legacy", audience: "any",
      terms: null, effectiveTerms: { monthly: { discount: [pct(null, 10000)], commission: [{ count: null, rateBp: 0 }] }, yearly: { discount: [pct(null, 10000)], commission: [{ count: null, rateBp: 0 }] } },
    };
    const form = initialCodeForm(legacy, 3000);
    assert.equal(form.useSchedule, false);
    assert.equal("terms" in toCodeInput(form, { creating: false }), false);
    form.useSchedule = true;
    form.monthly.discount = PRESETS.firstPayment("100");
    assert.deepEqual(toCodeInput(form, { creating: false }).terms.monthly.discount, [pct(1, 10000)]);
  });
});

describe("descriptions", () => {
  it("say each step in order", () => {
    assert.equal(describeDiscountSteps([pct(1, 10000), pct(3, 2000)]), "100% off on the first payment, then 20% off for 3 payments");
    assert.equal(describeDiscountSteps([pct(null, 1500)]), "15% off on every payment");
    assert.equal(describeDiscountSteps([]), "No discount");
    assert.equal(describeCommissionSteps([{ count: 1, rateBp: 10000 }, { count: null, rateBp: 3000 }]), "100% on the first payment, then 30% on every payment after");
    assert.equal(describeGrant({ type: "trial_days", value: 7 }), "7 extra trial days");
    assert.equal(usesLabel({ usesCount: 12, maxUses: 100 }), "12 / 100");
    assert.equal(usesLabel({ usesCount: 3, maxUses: null }), "3 / no limit");
  });
});
