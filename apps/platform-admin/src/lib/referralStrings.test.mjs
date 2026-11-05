import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { setActiveLocale } from "../i18n/activeLocale.ts";
import { PERMISSION_LABELS, PERMISSION_LABELS_AR, permissionLabel, permissionSummary } from "./permissions.ts";
import { REFERRAL_STRINGS, isolate, rangeArrow } from "./referralStrings.ts";
import { describeCommissionSteps, describeDiscountSteps, describeGrant, initialCodeForm, toCodeInput, usesLabel } from "./referralCodes.ts";

const pct = (count, value) => ({ count, type: "percentage", value });
const placeholders = (text) => (text.match(/\{\w+\}/g) ?? []).sort();

afterEach(() => setActiveLocale("en"));

describe("the referral strings", () => {
  it("Arabic says everything English says, with the same placeholders", () => {
    const { en, ar } = REFERRAL_STRINGS;
    assert.deepEqual(Object.keys(ar).sort(), Object.keys(en).sort());
    for (const key of Object.keys(en)) {
      assert.ok(ar[key].trim(), `ar.${key} is empty`);
      assert.deepEqual(placeholders(ar[key]), placeholders(en[key]), `placeholders of ${key}`);
    }
  });

  it("the permissions have Arabic labels, key for key", () => {
    assert.deepEqual(Object.keys(PERMISSION_LABELS_AR).sort(), Object.keys(PERMISSION_LABELS).sort());
  });
});

describe("in Arabic", () => {
  it("counts payments as Arabic counts them", () => {
    setActiveLocale("ar");
    assert.equal(describeDiscountSteps([pct(1, 10000)]), "خصم 100% على الدفعة الأولى");
    assert.equal(describeDiscountSteps([pct(2, 10000)]), "خصم 100% على أول دفعتين");
    assert.equal(describeDiscountSteps([pct(3, 2000)]), "خصم 20% على أول 3 دفعات");
    assert.equal(describeDiscountSteps([pct(12, 2000)]), "خصم 20% على أول 12 دفعة");
    assert.equal(describeDiscountSteps([pct(1, 10000), pct(1, 2000), pct(null, 1000)]), "خصم 100% على الدفعة الأولى، ثم خصم 20% على الدفعة رقم 2، ثم خصم 10% على كل دفعة بعدها");
    assert.equal(describeCommissionSteps([{ count: 1, rateBp: 10000 }, { count: 2, rateBp: 3000 }]), "100% على الدفعة الأولى، ثم 30% لمدة دفعتين");
    assert.equal(describeDiscountSteps([]), "بلا خصم");
  });

  it("counts free months, days and orders the same way, and no two counts read alike", () => {
    setActiveLocale("ar");
    assert.equal(describeDiscountSteps([{ count: 1, type: "free_months", value: 2 }]), "شهران مجانيان على الدفعة الأولى");
    assert.equal(describeGrant({ type: "free_orders", value: 1 }), "طلب مجاني واحد");
    assert.equal(describeGrant({ type: "free_orders", value: 11 }), "11 طلبًا مجانيًا");
    assert.equal(describeGrant({ type: "trial_days", value: 7 }), "7 أيام إضافية في الفترة التجريبية");
    assert.equal(usesLabel({ usesCount: 3, maxUses: null }), "3 / بلا حد");
    // A code's page compares these texts to find what a waiting change alters.
    const texts = [1, 2, 3, 10, 11, 100, 103].map((n) => describeDiscountSteps([pct(n, 1000)]));
    assert.equal(new Set(texts).size, texts.length);
  });

  it("refuses bad input in Arabic", () => {
    setActiveLocale("ar");
    const form = { ...initialCodeForm(undefined, 3000), code: "cairo-10" };
    form.monthly.discount = [{ count: "1", type: "percentage", amount: "120", currency: "EGP" }];
    assert.throws(() => toCodeInput(form, { creating: true }), /^Error: الخصم \(شهري\)، المرحلة 1: لا تتجاوز النسبة 100%\.$/);
  });

  it("follows the language in the permission labels and summary", () => {
    setActiveLocale("ar");
    assert.equal(permissionLabel("plans.view"), PERMISSION_LABELS_AR["plans.view"]);
    assert.equal(permissionLabel("later.key"), "later.key");
    assert.deepEqual([1, 2, 3, 11].map((n) => permissionSummary(Array(n).fill("k"))), ["صلاحية واحدة", "صلاحيتان", "3 صلاحيات", "11 صلاحية"]);
    setActiveLocale("en");
    assert.equal(permissionLabel("plans.view"), "Plans — view");
    assert.deepEqual([1, 2].map((n) => permissionSummary(Array(n).fill("k"))), ["1 permission", "2 permissions"]);
  });

  it("turns the arrow and isolates a value, and English stays as it was", () => {
    assert.equal(rangeArrow(), "→");
    assert.equal(isolate("CAIRO-10"), "CAIRO-10");
    setActiveLocale("ar");
    assert.equal(rangeArrow(), "←");
    assert.equal(isolate("CAIRO-10"), "\u2068CAIRO-10\u2069");
  });
});
