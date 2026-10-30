import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ApiError, type CartLine, type Order, type StorefrontCombo, type StorefrontProduct } from "@store-builder/api-client";
import { StoreContextProvider, type StoreInfo } from "./StoreContext";
import { getDictionary } from "./i18n";
import { cartErrorMessage, orderErrorMessage } from "./placeOrder";
import { snapshotFromOrder } from "./commerce";
import { cartProductIds, cartQuoteLines, comboLineFullTotal, comboPriceFor, comboSelectionOf, comboSoldOut, initialComboPicks } from "./combos";
import { OrderSnapshotSummary } from "@/components/OrderConfirmation";

afterEach(cleanup);

const v = (id: string, priceAmount: number, inStock = true) => ({
  id,
  sku: id,
  optionValues: { Size: id },
  priceAmount,
  compareAtAmount: null,
  currency: "EGP",
  weightGrams: null,
  inStock,
});

/** 50.00 off a shirt the shopper sizes (two of them) and a cap the merchant fixed. */
const COMBO: StorefrontCombo = {
  id: "c1",
  name: "Pair",
  description: null,
  imageUrl: null,
  pricingMode: "amount_off",
  priceValue: 5000,
  items: [
    { id: "i1", quantity: 2, pickVariant: true, product: { id: "p1", name: "Shirt", slug: "shirt", imageUrl: null }, variants: [v("s", 10000, false), v("m", 11000), v("l", 13000)] },
    { id: "i2", quantity: 1, pickVariant: false, product: { id: "p2", name: "Cap", slug: null, imageUrl: null }, variants: [v("cap", 4000)] },
  ],
  price: { full: 26000, total: 21000, saving: 5000 },
  available: true,
};

describe("combo picks and price (display only)", () => {
  it("shows the server's price until something is picked, then the combo's rule over the picks", () => {
    expect(comboPriceFor(COMBO, {})).toEqual(COMBO.price);
    // 2 × 130.00 + 40.00 = 300.00, 50.00 off.
    expect(comboPriceFor(COMBO, { i1: "l" })).toEqual({ full: 30000, total: 25000, saving: 5000 });
    expect(comboPriceFor({ ...COMBO, pricingMode: "fixed_price", priceValue: 20000 }, { i1: "l" })).toEqual({ full: 30000, total: 20000, saving: 10000 });
  });

  it("sends a pick for every product the shopper chooses, none for the fixed ones", () => {
    expect(comboSelectionOf(COMBO, {})).toBeNull();
    expect(comboSelectionOf(COMBO, { i1: "not-a-variant" })).toBeNull();
    expect(comboSelectionOf(COMBO, { i1: "m" })).toEqual([{ itemId: "i1", variantId: "m" }]);
    expect(initialComboPicks(COMBO)).toEqual({});
  });

  it("is sold out when the server says so or a pick has no stock", () => {
    expect(comboSoldOut(COMBO, {})).toBe(false);
    expect(comboSoldOut(COMBO, { i1: "s" })).toBe(true);
    expect(comboSoldOut({ ...COMBO, available: false }, { i1: "m" })).toBe(true);
  });
});

describe("combo cart lines", () => {
  const line = { comboId: "c1", fullUnitPrice: 26000, quantity: 2, lineTotal: 42000 } as CartLine;

  it("strikes the products bought apart only when that costs more", () => {
    expect(comboLineFullTotal(line)).toBe(52000);
    expect(comboLineFullTotal({ ...line, fullUnitPrice: 21000 })).toBeNull();
    expect(comboLineFullTotal({ ...line, comboId: null })).toBeNull();
  });

  it("quotes shipping for a combo by the combo and its picks, never its first product, and leaves out one that is gone", () => {
    const items = [
      { id: "a", variantId: "v9", offerId: "o1", quantity: 2, comboId: null },
      { id: "b", variantId: "s", offerId: null, quantity: 3, comboId: "c1", comboSelection: [{ itemId: "i1", variantId: "m" }], unavailable: false },
      { id: "c", variantId: "z", offerId: null, quantity: 1, comboId: "c2", comboSelection: [], unavailable: true },
    ] as unknown as CartLine[];
    expect(cartQuoteLines(items)).toEqual([
      { variantId: "v9", offerId: "o1", quantity: 2 },
      { comboId: "c1", comboSelection: [{ itemId: "i1", variantId: "m" }], quantity: 3 },
    ]);
  });

  it("counts every product of a combo among the cart's products", () => {
    const byVariant = new Map([["v9", { id: "p9" } as StorefrontProduct]]);
    const items = [
      { variantId: "v9", combo: null },
      { variantId: "s", combo: { id: "c1", name: "Pair", items: [{ productId: "p1" }, { productId: "p2" }] } },
    ] as unknown as CartLine[];
    expect(cartProductIds(items, byVariant)).toEqual(["p9", "p1", "p2"]);
  });
});

describe("combo refusals in the shopper's language", () => {
  const codes = [
    ["COMBO_UNAVAILABLE", "comboUnavailable"],
    ["COMBO_VARIANT_REQUIRED", "comboVariantRequired"],
    ["COMBO_NOT_IN_FUNNEL", "comboNotInFunnel"],
  ] as const;

  it.each(["ar", "en", "fr"] as const)("maps each code on orders and on the cart (%s)", (locale) => {
    const copy = getDictionary(locale).form.errors;
    for (const [code, key] of codes) {
      const err = new ApiError("Raw English from the server", 422, code, { error: { code, details: [] } });
      expect(orderErrorMessage(err, copy)).toBe(copy[key]);
      expect(cartErrorMessage(err, copy, "fallback")).toBe(copy[key]);
    }
  });

  it("says them in Egyptian Arabic", () => {
    const copy = getDictionary("ar").form.errors;
    expect(copy.comboUnavailable).toContain("منتج من الطقم مبقاش متاح");
    expect(copy.comboVariantRequired).toContain("اختار الاختيار لكل منتج في الطقم");
  });
});

describe("the thank-you page's copy of an order with a combo", () => {
  const order = {
    id: "o1",
    orderNumber: "1001",
    currency: "EGP",
    createdAt: "2026-10-30T10:00:00.000Z",
    subtotalAmount: "21000",
    discountAmount: "0",
    shippingAmount: "0",
    totalAmount: "21000",
    items: [
      { productId: "p1", variantId: "m", productNameSnapshot: "Shirt", variantOptionsSnapshot: { Size: "M" }, quantity: 2, lineTotalAmount: "17000", comboId: "c1", comboKey: "k1", comboNameSnapshot: "Pair" },
      { productId: "p2", variantId: "cap", productNameSnapshot: "Cap", variantOptionsSnapshot: {}, quantity: 1, lineTotalAmount: "4000", comboId: "c1", comboKey: "k1", comboNameSnapshot: "Pair" },
      { productId: "p3", variantId: "x", productNameSnapshot: "Socks", variantOptionsSnapshot: {}, quantity: 1, lineTotalAmount: "1000" },
    ],
  } as unknown as Order;

  it("keeps the combo's name on its products' lines, and nothing new on the others", () => {
    const snapshot = snapshotFromOrder(order, "01012345678");
    expect(snapshot.items.map((item) => item.combo)).toEqual(["Pair", "Pair", undefined]);
    expect("combo" in snapshot.items[2]).toBe(false);
  });

  it("shows it under each of those lines", () => {
    const STORE: StoreInfo = {
      workspaceId: "ws1",
      id: "ws1",
      slug: "shop",
      name: "Shop",
      currency: "EGP",
      logoUrl: null,
      phone: null,
      checkout: { email: "optional", postal_code: "hidden", notes: "optional" },
      orderBump: null,
    };
    render(
      <StoreContextProvider locale="ar" store={STORE}>
        <OrderSnapshotSummary snapshot={snapshotFromOrder(order, "01012345678")} currency="EGP" />
      </StoreContextProvider>
    );
    expect(screen.getAllByText("من طقم: Pair")).toHaveLength(2);
  });
});
