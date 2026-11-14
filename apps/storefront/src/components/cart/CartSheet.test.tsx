import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

// The cart with rewards (components/cart/CartSheet): the bar and the totals
// from the server's quote, a quantity shown at once and taken back when the
// server refuses it, the empty cart, and Escape. Runs with
// NEXT_PUBLIC_CART_REWARDS_ENABLED on.

vi.stubEnv("NEXT_PUBLIC_CART_REWARDS_ENABLED", "true");

vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceId: "ws1" }),
  usePathname: () => "/store/ws1",
}));

vi.mock("@/components/StoreRoute", () => ({
  StoreLink: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useStoreBasePath: () => "/store/ws1",
}));

const CONFIG = {
  currency: "EGP",
  allowCouponStacking: false,
  tiers: [
    { thresholdAmount: 50000, type: "free_shipping", value: null, label: { en: "Free shipping", ar: "شحن مجاني" } },
    { thresholdAmount: 100000, type: "percent", value: 5, label: { en: "5% off", ar: "خصم 5%" } },
    { thresholdAmount: 200000, type: "percent", value: 10, label: { en: "10% off", ar: "خصم 10%" } },
  ],
  trustItems: [{ text: { ar: "الدفع عند الاستلام", en: "Cash on delivery" } }],
};

const quoteFor = (subtotal: number) => ({
  pricingMode: "flat",
  amount: 6000,
  currency: "EGP",
  subtotal,
  weightGrams: null,
  weightEstimated: false,
  tier: null,
  rule: "default_rate",
  configured: true,
  destinationRequired: false,
  freeShipping: null,
  automaticDiscount: null,
  minimumOrder: null,
  bundleDiscountAmount: 0,
  rewards: {
    currency: "EGP",
    allowCouponStacking: false,
    tiers: CONFIG.tiers.map((t) => ({ ...t, reached: subtotal >= t.thresholdAmount })),
    next: null,
    applied: { type: "percent", value: 5, thresholdAmount: 100000, label: { en: "5% off", ar: "خصم 5%" }, amount: 7500, freeShipping: false },
    discountAmount: 7500,
    coupon: null,
    notes: ["discount_over_free_shipping"],
    shippingFeeAmount: 6000,
    compareAtSavings: 3000,
    savedAmount: 10500,
  },
});

const request = vi.fn();
const listStorefrontProducts = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  createStorefrontApiClient: () => ({ request, listStorefrontProducts }),
}));

type CartState = { cart: unknown; isLoading: boolean; isAdding: boolean; itemCount: number; isDrawerOpen: boolean };
const cartState: CartState = { cart: null, isLoading: false, isAdding: false, itemCount: 0, isDrawerOpen: true };
const updateItem = vi.fn();
const removeItem = vi.fn();
const closeDrawer = vi.fn();
vi.mock("@/lib/CartProvider", () => ({
  useCart: () => ({ ...cartState, updateItem, removeItem, closeDrawer }),
}));

const { CartSheet } = await import("./CartSheet");
const { forgetCatalogs } = await import("@/lib/useCatalog");

const line = (quantity: number) => ({
  id: "line1",
  variantId: "v1",
  offerId: null,
  quantity,
  unitPriceSnapshot: "50000",
  currentUnitPrice: "50000",
  priceChanged: false,
  lineTotal: 50000 * quantity,
  variant: { id: "v1", sku: "C1", optionValues: {}, priceAmount: 50000, compareAtAmount: 51000, currency: "EGP", weightGrams: null, inStock: true },
  isOrderBump: false,
});
const cartWith = (quantity: number) => ({ id: "c1", guestToken: "t", currency: "EGP", status: "active", items: [line(quantity)], subtotal: 50000 * quantity });

beforeEach(() => {
  forgetCatalogs();
  request.mockReset();
  request.mockImplementation(async (path: string) => {
    if (path.includes("/shipping-quote")) return { quote: quoteFor(150000) };
    return new Promise(() => undefined);
  });
  listStorefrontProducts.mockReset();
  listStorefrontProducts.mockResolvedValue({ products: [{ id: "p1", slug: "coat", name: "Belted coat", images: [], variants: [{ id: "v1", optionValues: {} }] }] });
  updateItem.mockReset();
  removeItem.mockReset();
  closeDrawer.mockReset();
  Object.assign(cartState, { cart: cartWith(3), isLoading: false, isAdding: false, itemCount: 3, isDrawerOpen: true });
});

afterEach(() => cleanup());

// The trust lines are the store's own (Store settings → Cart behavior), not the rewards config's.
const SETTINGS = { enabled: true, openOn: { addToCart: false, cartIcon: true, quickOrder: false }, presentation: "auto", speed: "fast", trustItems: CONFIG.trustItems } as const;
const sheet = () => render(<CartSheet config={CONFIG as never} settings={SETTINGS as never} />);

describe("the cart sheet", () => {
  it("a dialog with the title, the count, the server's reward, what was saved and the total", async () => {
    sheet();
    const dialog = await screen.findByRole("dialog", { name: /سلة المشتريات/ });
    // The count in the shopper's digits.
    expect(dialog.querySelector("#cart-sheet-title")?.textContent).toBe("سلة المشتريات٣");
    const bar = await screen.findByRole("progressbar", { name: "التقدم نحو المكافآت" });
    await waitFor(() => expect(bar.getAttribute("aria-valuetext")).toContain("خصم 5% اتطبّق تلقائيًا"));
    expect(screen.getByText("طبّقنا الخصم بدل الشحن المجاني لأنه بيوفّر لك أكتر")).toBeTruthy();
    expect(await screen.findByText(/^مكافأة: خصم 5%$/)).toBeTruthy();
    expect(screen.getByText(/^وفّرت .* في الطلب ده$/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "كمّل الطلب" }).getAttribute("href")).toBe("/checkout");
    expect(screen.getByText("الدفع عند الاستلام")).toBeTruthy();
    // The old price, struck through, beside the line's own.
    expect(dialog.querySelector("s")).not.toBeNull();
  });

  it("asks the quote with the cart's lines", async () => {
    sheet();
    await waitFor(() => expect(request.mock.calls.some(([path]) => String(path).includes("/shipping-quote"))).toBe(true));
    const [, init] = request.mock.calls.find(([path]) => String(path).includes("/shipping-quote"))!;
    expect((init as { body: { items: unknown[] } }).body.items).toEqual([{ variantId: "v1", quantity: 3 }]);
  });

  it("shows a new quantity at once, and the server's again when it refuses it", async () => {
    let refuse: (err: Error) => void = () => undefined;
    updateItem.mockImplementation(() => new Promise((_, reject) => (refuse = reject)));
    sheet();
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "زيادة الكمية" }));
    expect(updateItem).toHaveBeenCalledWith("line1", 4);
    expect(screen.getByRole("group", { name: "الكمية" }).textContent).toContain("٤");
    await act(async () => refuse(new Error("Only 3 left")));
    await waitFor(() => expect(screen.getByRole("group", { name: "الكمية" }).textContent).toContain("٣"));
    expect(screen.getByText("Only 3 left")).toBeTruthy();
  });

  it("an empty cart: the empty state, and the bar from nothing", async () => {
    Object.assign(cartState, { cart: { ...cartWith(1), items: [], subtotal: 0 }, itemCount: 0 });
    sheet();
    expect(await screen.findByText("سلة التسوق فاضية.")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
    expect(screen.queryByRole("link", { name: "كمّل الطلب" })).toBeNull();
  });

  it("closes on Escape", async () => {
    sheet();
    await screen.findByRole("dialog");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(closeDrawer).toHaveBeenCalled();
  });
});
