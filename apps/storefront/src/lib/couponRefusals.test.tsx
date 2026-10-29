import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ApiError, COUPON_REFUSALS, type StorefrontCouponPreview } from "@store-builder/api-client";
import { DiscountRows } from "@/components/offers/CouponBits";
import { formatPrice, getDictionary, type Locale } from "./i18n";
import { StoreContextProvider, type StoreInfo } from "./StoreContext";
import { COUPON_REFUSAL_TEXT, couponRefusalMessage } from "./couponRefusals";
import { orderErrorMessage } from "./placeOrder";

/*
 * Every reason a coupon can be refused has its own line in both languages,
 * said by the coupon preview and by a checkout the server refused for its
 * code; a reason this storefront does not know keeps the generic line.
 */

const ctx = (locale: Locale) => ({ locale, money: (n: number) => formatPrice(n, "EGP", locale, null) });
const refused = (code: string, details?: unknown[]) => new ApiError("Discount code refused", 422, code, details ? { error: { code, details } } : undefined);
const STORE = { workspaceId: "ws1", id: "ws1", slug: "shop", name: "Shop", currency: "EGP", logoUrl: null, phone: null, checkout: {}, orderBump: null } as unknown as StoreInfo;

afterEach(cleanup);

describe("coupon refusal lines", () => {
  it("has a line for every code the API names, in Arabic and in English", () => {
    for (const locale of ["ar", "en"] as const) {
      expect(Object.keys(COUPON_REFUSAL_TEXT[locale]).sort()).toEqual([...COUPON_REFUSALS].sort());
      const lines = COUPON_REFUSALS.map((code) => couponRefusalMessage(code, undefined, ctx(locale)));
      for (const line of lines) expect(line).toMatch(/\S/);
      // Each says something of its own.
      expect(new Set(lines).size).toBe(COUPON_REFUSALS.length);
    }
    // French reads English.
    expect(couponRefusalMessage("DISCOUNT_EXPIRED", undefined, ctx("fr"))).toBe("This code has expired.");
  });

  it("says the shopper's Arabic for the common ones", () => {
    const say = (code: string) => couponRefusalMessage(code, undefined, ctx("ar"));
    expect(say("DISCOUNT_EXPIRED")).toBe("الكود ده خلص.");
    expect(say("DISCOUNT_FIRST_ORDER_ONLY")).toBe("الكود ده لأول طلب بس.");
    expect(say("DISCOUNT_RETURNING_ONLY")).toBe("الكود ده لعملائنا اللي طلبوا قبل كده.");
    expect(say("DISCOUNT_NOT_ACTIVE_NOW")).toBe("الكود ده مش شغال في الوقت ده.");
    expect(say("DISCOUNT_DISABLED")).toBe("الكود ده متوقف دلوقتي.");
    expect(say("DISCOUNT_NOT_COMBINABLE")).toBe("الكود ده مبيشتغلش على العروض أو المنتجات اللي عليها خصم.");
    expect(say("DISCOUNT_PER_CUSTOMER_LIMIT_REACHED")).toBe("انت استخدمت الكود ده قبل كده.");
  });

  it("says how much more is needed when the server says", () => {
    expect(couponRefusalMessage("DISCOUNT_MIN_QUANTITY_NOT_MET", [{ field: "items", minQuantity: 3, quantity: 1, remainingQuantity: 2 }], ctx("ar"))).toBe(
      "ضيف قطعتين كمان علشان الكود يشتغل."
    );
    expect(couponRefusalMessage("DISCOUNT_MIN_QUANTITY_NOT_MET", [{ remainingQuantity: 1 }], ctx("en"))).toBe("Add 1 more item to use this code.");
    // Buy X get Y names the units still missing.
    expect(couponRefusalMessage("DISCOUNT_QUANTITY_NOT_MET", [{ remainingUnits: 3 }], ctx("en"))).toBe("Add 3 more items to get this offer.");
    // Money in minor units, as the store writes it.
    const money = formatPrice(15000, "EGP", "en", null);
    expect(couponRefusalMessage("DISCOUNT_MINIMUM_NOT_MET", [{ field: "items", minimumAmount: 50000, subtotal: 35000, remainingAmount: 15000 }], ctx("en"))).toBe(
      `Add ${money} more to use this code.`
    );
    // Without the amount, still the reason.
    expect(couponRefusalMessage("DISCOUNT_MINIMUM_NOT_MET", undefined, ctx("ar"))).toBe("طلبك لسه أقل من الحد الأدنى للكود ده.");
  });

  it("gives null for a code it does not know", () => {
    expect(couponRefusalMessage("DISCOUNT_SOMETHING_NEW", undefined, ctx("ar"))).toBeNull();
    expect(couponRefusalMessage("toString", undefined, ctx("en"))).toBeNull();
    expect(couponRefusalMessage(null, undefined, ctx("en"))).toBeNull();
  });
});

describe("a refused coupon at checkout and in the preview", () => {
  it("names the reason for a checkout refused for its code", () => {
    const copy = getDictionary("ar").form.errors;
    expect(orderErrorMessage(refused("DISCOUNT_FIRST_ORDER_ONLY"), copy, ctx("ar"))).toBe("الكود ده لأول طلب بس.");
    expect(orderErrorMessage(refused("DISCOUNT_MINIMUM_NOT_MET", [{ remainingAmount: 5000 }]), copy, ctx("ar"))).toBe(
      `ضيف بـ ${formatPrice(5000, "EGP", "ar", null)} كمان علشان الكود يشتغل.`
    );
    // The store's own refusals keep their own lines; without the shopper's language, the old behaviour.
    expect(orderErrorMessage(new ApiError("Below minimum", 422, "MIN_ORDER_NOT_MET"), copy, ctx("ar"))).toBe(copy.minOrder);
    expect(orderErrorMessage(refused("DISCOUNT_EXPIRED"), copy)).toBe("Discount code refused");
  });

  function rows(coupon: StorefrontCouponPreview, locale: Locale) {
    return render(
      <StoreContextProvider locale={locale} store={STORE}>
        <dl>
          <DiscountRows extras={{ automaticDiscount: null, minimumOrder: null, bundleDiscountAmount: 0 }} coupon={coupon} />
        </dl>
      </StoreContextProvider>
    );
  }
  const invalid = (reason: string | null, details?: Array<Record<string, unknown>>): StorefrontCouponPreview => ({
    valid: false,
    code: "SAVE10",
    type: null,
    amount: 0,
    subtotal: 20000,
    reason,
    ...(details ? { details } : {}),
  });

  it("says why the preview refused the code, else the generic line", () => {
    rows(invalid("DISCOUNT_EXPIRED"), "ar");
    expect(screen.getByText("الكود ده خلص.")).toBeTruthy();
    cleanup();

    rows(invalid("DISCOUNT_MIN_QUANTITY_NOT_MET", [{ remainingQuantity: 4 }]), "ar");
    expect(screen.getByText("ضيف ٤ قطع كمان علشان الكود يشتغل.")).toBeTruthy();
    cleanup();

    rows(invalid("DISCOUNT_SOMETHING_NEW"), "en");
    expect(screen.getByText("Coupon SAVE10 doesn't apply to this order.")).toBeTruthy();
    cleanup();

    rows(invalid(null), "ar");
    expect(screen.getByText("الكوبون SAVE10 لا ينطبق على هذا الطلب.")).toBeTruthy();
  });
});
