import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Cart, CartLine } from "@store-builder/api-client";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";
import { formatPrice, getDictionary, type Locale } from "@/lib/i18n";

// --- the cart's surroundings, stubbed --------------------------------------
const removeItem = vi.fn();
const state: { cart: Cart | null } = { cart: null };
/** Every API request the pages made: [path, options]. */
const requests: Array<[string, { body?: unknown }]> = [];

vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceId: "ws1" }),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/store/ws1/cart",
}));

vi.mock("@/components/StoreRoute", () => ({
  StoreLink: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useStoreBasePath: () => "/store/ws1",
}));

vi.mock("@/lib/CartProvider", () => ({
  useCart: () => ({
    cart: state.cart,
    isLoading: false,
    itemCount: state.cart?.items.reduce((sum, line) => sum + line.quantity, 0) ?? 0,
    addItem: vi.fn(),
    updateItem: vi.fn(),
    removeItem: (...args: unknown[]) => removeItem(...args),
    refreshCart: vi.fn(),
    clearCart: vi.fn(),
    isDrawerOpen: true,
    openDrawer: vi.fn(),
    closeDrawer: vi.fn(),
  }),
}));

// Every API call the pages make fails quietly (no catalogue, no quote, no offers); the raw requests are kept.
vi.mock("@/lib/apiClient", () => ({
  createStorefrontApiClient: () =>
    new Proxy(
      {},
      {
        get: (_target, name) => (...args: unknown[]) => {
          if (name === "request") requests.push(args as [string, { body?: unknown }]);
          return Promise.reject(new Error("offline in tests"));
        },
      }
    ),
}));

vi.mock("@/lib/track", () => ({ track: vi.fn() }));

const { default: CartPage } = await import("@/app/store/[workspaceId]/cart/page");
const { default: CheckoutPage } = await import("@/app/store/[workspaceId]/checkout/page");
const { CartDrawer } = await import("@/components/CartDrawer");

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

/** A combo of a shirt (picked in XL) and two trousers, at 288.00 instead of 520.00. */
const COMBO_LINE: CartLine = {
  id: "line1",
  variantId: "vxl",
  offerId: null,
  quantity: 1,
  unitPriceSnapshot: "28800",
  currentUnitPrice: "28800",
  priceChanged: false,
  lineTotal: 28800,
  variant: { id: "vxl", sku: "VXL", optionValues: { Size: "XL" }, priceAmount: 12000, compareAtAmount: null, currency: "EGP", weightGrams: null, inStock: true },
  isOrderBump: false,
  comboId: "c1",
  comboSelection: [{ itemId: "i1", variantId: "vxl" }],
  combo: {
    id: "c1",
    name: "Summer set",
    items: [
      { itemId: "i1", productId: "p1", productName: "Shirt", variantId: "vxl", optionValues: { Size: "XL" }, quantity: 1 },
      { itemId: "i2", productId: "p2", productName: "Trousers", variantId: "vt", optionValues: null, quantity: 2 },
    ],
  },
  unavailable: false,
  fullUnitPrice: 52000,
};

/** A combo the merchant archived since it was added: it counts nothing. */
const GONE_LINE: CartLine = {
  ...COMBO_LINE,
  id: "line2",
  variantId: "vz",
  comboId: "c2",
  comboSelection: [],
  combo: null,
  unavailable: true,
  fullUnitPrice: null,
  unitPriceSnapshot: "15000",
  currentUnitPrice: "0",
  lineTotal: 0,
};

const cartOf = (items: CartLine[]): Cart => ({
  id: "cart1",
  guestToken: "tok",
  currency: "EGP",
  status: "active",
  items,
  subtotal: items.reduce((sum, line) => sum + line.lineTotal, 0),
});

const egp = (amount: number, locale: Locale = "en") => formatPrice(amount, "EGP", locale, null).replace(/\s+/g, " ").trim();

function renderIn(ui: ReactNode, locale: Locale = "en") {
  return render(
    <StoreContextProvider locale={locale} store={STORE}>
      {ui}
    </StoreContextProvider>
  );
}

/** The items of the last shipping quote asked for. */
async function quotedItems() {
  await waitFor(() => expect(requests.some(([path]) => path.endsWith("/shipping-quote"))).toBe(true), { timeout: 3000 });
  const quotes = requests.filter(([path]) => path.endsWith("/shipping-quote"));
  return (quotes[quotes.length - 1][1].body as { items: unknown[] }).items;
}

/** A plain line beside the combos. */
const PLAIN_LINE: CartLine = { ...COMBO_LINE, id: "line3", variantId: "v9", offerId: null, comboId: null, comboSelection: undefined, combo: null, fullUnitPrice: null, quantity: 2 };

beforeEach(() => {
  requests.length = 0;
  removeItem.mockReset();
  removeItem.mockResolvedValue(undefined);
  localStorage.clear();
});
afterEach(cleanup);

describe("a combo line in the cart", () => {
  it("is titled by the combo, lists its products with their variants, and strikes the price bought apart", () => {
    state.cart = cartOf([COMBO_LINE]);
    renderIn(<CartPage />);
    expect(screen.getByText("Summer set")).toBeTruthy();
    expect(screen.getByText("Combo")).toBeTruthy();
    expect(screen.getByText("Shirt × 1 · XL")).toBeTruthy();
    expect(screen.getByText("Trousers × 2")).toBeTruthy();
    // The line's total (and the subtotal under it), and the products bought apart, struck through.
    expect(screen.getAllByText(egp(28800)).length).toBeGreaterThan(0);
    expect(screen.getByText(egp(52000)).className).toContain("line-through");
    // Its quantity changes like any other line's.
    expect(screen.getAllByRole("button", { name: getDictionary("en").product.increase })).toHaveLength(1);
  });

  it("asks to remove a combo that is no longer available, with no stepper or price for it", () => {
    state.cart = cartOf([COMBO_LINE, GONE_LINE]);
    renderIn(<CartPage />, "ar");
    expect(screen.getByText("الطقم ده مبقاش متاح، شيله من السلة")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: getDictionary("ar").product.increase })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: getDictionary("ar").cart.remove })).toHaveLength(2);
  });

  it("reads the same in the cart drawer", () => {
    state.cart = cartOf([COMBO_LINE, GONE_LINE]);
    renderIn(<CartDrawer />);
    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByText("Summer set")).toBeTruthy();
    expect(within(drawer).getByText("Shirt × 1 · XL")).toBeTruthy();
    expect(within(drawer).getByText("This combo is no longer available. Remove it from your cart.")).toBeTruthy();
    expect(within(drawer).getByRole("button", { name: "Remove — Summer set" })).toBeTruthy();
    expect(within(drawer).getAllByRole("button", { name: getDictionary("en").product.increase })).toHaveLength(1);
  });
});

describe("shipping for a combo line", () => {
  const expected = [
    { comboId: "c1", comboSelection: [{ itemId: "i1", variantId: "vxl" }], quantity: 1 },
    { variantId: "v9", quantity: 2 },
  ];

  it("is quoted in the cart by the combo and its picks, a combo that is gone left out", async () => {
    state.cart = cartOf([COMBO_LINE, GONE_LINE, PLAIN_LINE]);
    renderIn(<CartPage />);
    expect(await quotedItems()).toEqual(expected);
  });

  it("is quoted the same way at checkout", async () => {
    state.cart = cartOf([COMBO_LINE, GONE_LINE, PLAIN_LINE]);
    renderIn(<CheckoutPage />);
    expect(await quotedItems()).toEqual(expected);
  });
});

describe("a combo line at checkout", () => {
  it("shows the combo in the summary with its products and the price bought apart", () => {
    state.cart = cartOf([COMBO_LINE]);
    renderIn(<CheckoutPage />);
    const summary = screen.getByRole("region", { name: getDictionary("en").checkout.summary });
    expect(within(summary).getByText("Summer set")).toBeTruthy();
    expect(within(summary).getByText("Trousers × 2")).toBeTruthy();
    expect(within(summary).getByText(egp(52000))).toBeTruthy();
    expect(screen.queryByText("A combo in your cart is no longer available. Remove it to place your order.")).toBeNull();
  });

  it("will not place an order while a combo that can no longer be bought is in the cart, and removes it there", async () => {
    state.cart = cartOf([COMBO_LINE, GONE_LINE]);
    renderIn(<CheckoutPage />, "ar");
    expect(screen.getByText("فيه طقم في السلة مبقاش متاح. شيله عشان تكمّل الطلب.")).toBeTruthy();
    const submits = screen.getAllByRole("button", { hidden: true }).filter((b) => b.getAttribute("type") === "submit") as HTMLButtonElement[];
    expect(submits.length).toBeGreaterThan(0);
    for (const button of submits) expect(button.disabled).toBe(true);

    const summary = screen.getByRole("region", { name: getDictionary("ar").checkout.summary });
    fireEvent.click(within(summary).getByRole("button", { name: getDictionary("ar").cart.remove }));
    await waitFor(() => expect(removeItem).toHaveBeenCalledWith("line2"));
  });
});
