import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import type { StorefrontCartSheet } from "@store-builder/api-client";

// The cart sheet is every store's (components/cart/CartSheet): a store without
// rewards gets it with no bar; a store with rewards gets the bar at the top of
// the sheet's scrolling part, kept there while the lines scroll. The merchant's
// presentation (bottom sheet, side drawer, popup, or by screen) and speed
// (none draws it at once), off for all, Arabic, the keyboard, the quick order
// view, and the swipe down.

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
    { thresholdAmount: 50000, type: "free_shipping", value: null, label: { en: "Free shipping", ar: "شحن مجاني" }, icon: "truck" },
    { thresholdAmount: 100000, type: "percent", value: 5, label: { en: "5% off", ar: "خصم 5%" }, icon: "crown" },
  ],
  trustItems: [],
  appearance: { mode: "inherit" },
};

let withRewards = true;
const quoteFor = (subtotal: number) => ({
  pricingMode: "flat",
  amount: 6000,
  currency: "EGP",
  subtotal,
  configured: true,
  destinationRequired: false,
  freeShipping: null,
  automaticDiscount: null,
  minimumOrder: null,
  bundleDiscountAmount: 0,
  lineSavingsAmount: 3000,
  ...(withRewards
    ? {
        rewards: {
          currency: "EGP",
          allowCouponStacking: false,
          tiers: CONFIG.tiers.map((t) => ({ ...t, reached: subtotal >= t.thresholdAmount })),
          next: null,
          applied: null,
          discountAmount: 0,
          coupon: null,
          notes: [],
          shippingFeeAmount: 6000,
          compareAtSavings: 3000,
          savedAmount: 3000,
        },
      }
    : {}),
});

const request = vi.fn();
const listStorefrontProducts = vi.fn();
vi.mock("@/lib/apiClient", () => ({
  createStorefrontApiClient: () => ({ request, listStorefrontProducts }),
}));

type CartState = { cart: unknown; isLoading: boolean; isAdding: boolean; itemCount: number; isDrawerOpen: boolean; sheetView: "cart" | "quick" };
const cartState: CartState = { cart: null, isLoading: false, isAdding: false, itemCount: 0, isDrawerOpen: true, sheetView: "cart" };
const closeDrawer = vi.fn();
vi.mock("@/lib/CartProvider", () => ({
  useCart: () => ({ ...cartState, updateItem: vi.fn(), removeItem: vi.fn(), closeDrawer, openDrawer: vi.fn(), openQuickOrder: vi.fn() }),
  useOptionalCart: () => ({ ...cartState, closeDrawer, openDrawer: vi.fn() }),
}));

const { CartSheet } = await import("./CartSheet");
const { StoreContextProvider } = await import("@/lib/StoreContext");
const { forgetCatalogs } = await import("@/lib/useCatalog");
const { useQuickOrderSlot } = await import("@/lib/cartSheet");

const line = {
  id: "line1",
  variantId: "v1",
  offerId: null,
  quantity: 2,
  unitPriceSnapshot: "50000",
  currentUnitPrice: "50000",
  priceChanged: false,
  lineTotal: 100000,
  variant: { id: "v1", sku: "C1", optionValues: {}, priceAmount: 50000, compareAtAmount: 51500, currency: "EGP", weightGrams: null, inStock: true },
  isOrderBump: false,
};
const CART = { id: "c1", guestToken: "t", currency: "EGP", status: "active", items: [line], subtotal: 100000 };

const SETTINGS: StorefrontCartSheet = {
  enabled: true,
  openOn: { addToCart: false, cartIcon: true, quickOrder: false },
  presentation: "auto",
  speed: "fast",
  trustItems: [{ text: { ar: "الدفع عند الاستلام", en: "Cash on delivery" } }],
};

function storeWith(cartSheet: StorefrontCartSheet) {
  return { workspaceId: "ws1", id: "ws1", slug: "shop", name: "Shop", currency: "EGP", logoUrl: null, phone: null, checkout: { email: "optional", postal_code: "hidden", notes: "optional" }, orderBump: null, cartSheet } as never;
}

function sheet({ rewards = true, settings = {}, locale = "ar" as "ar" | "en", extra = null as ReactNode } = {}) {
  const cartSheet = { ...SETTINGS, ...settings } as StorefrontCartSheet;
  return render(
    <StoreContextProvider locale={locale} store={storeWith(cartSheet)}>
      <div dir={locale === "ar" ? "rtl" : "ltr"}>
        <button type="button">opener</button>
        <CartSheet config={rewards ? (CONFIG as never) : null} />
        {extra}
      </div>
    </StoreContextProvider>
  );
}

const panel = () => screen.getByRole("dialog");
const layer = () => document.querySelector("[data-cart-sheet]") as HTMLElement;

beforeEach(() => {
  forgetCatalogs();
  withRewards = true;
  request.mockReset();
  request.mockImplementation(async (path: string) => {
    if (path.includes("/shipping-quote")) return { quote: quoteFor(100000) };
    return new Promise(() => undefined);
  });
  listStorefrontProducts.mockReset();
  listStorefrontProducts.mockResolvedValue({ products: [{ id: "p1", slug: "coat", name: "Belted coat", images: [], variants: [{ id: "v1", optionValues: {} }] }] });
  closeDrawer.mockReset();
  Object.assign(cartState, { cart: CART, isLoading: false, isAdding: false, itemCount: 2, isDrawerOpen: true, sheetView: "cart" });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("a store without rewards", () => {
  it("gets the sheet with no bar: the old price struck, what was saved, the totals, the way to checkout and its trust lines", async () => {
    withRewards = false;
    sheet({ rewards: false });
    const dialog = await screen.findByRole("dialog", { name: /سلة المشتريات/ });
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(dialog.querySelector("[data-rewards-sticky]")).toBeNull();
    expect(dialog.querySelector("s")).not.toBeNull();
    // Compare-at and bundle savings from the server's quote, rewards or not.
    expect(await screen.findByText(/^وفّرت .* في الطلب ده$/)).toBeTruthy();
    expect(within(dialog).getByRole("link", { name: "كمّل الطلب" }).getAttribute("href")).toBe("/checkout");
    expect(within(dialog).getByText("الدفع عند الاستلام")).toBeTruthy();
  });
});

describe("a store with rewards", () => {
  it("has the bar at the top of the scrolling part, above the lines, kept there while they scroll", async () => {
    sheet();
    const dialog = await screen.findByRole("dialog");
    const bar = await within(dialog).findByRole("progressbar");
    const sticky = dialog.querySelector("[data-rewards-sticky]") as HTMLElement;
    expect(sticky.contains(bar)).toBe(true);
    expect(sticky.className).toMatch(/\bsticky\b/);
    expect(sticky.className).toMatch(/(^|\s)-top-4(\s|$)/);
    const list = dialog.querySelector("ul.divide-y") as HTMLElement;
    // The bar comes first in the scrolling part.
    expect(sticky.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sticky.parentElement?.parentElement?.className).toContain("overflow-y-auto");
    // Each reward's own icon.
    expect(dialog.querySelector('[data-reward-icon="crown"]')).not.toBeNull();
  });

  it("shows the store's own trust lines, never the rewards config's", async () => {
    const config = { ...CONFIG, trustItems: [{ text: { ar: "سطر قديم", en: "Old line" } }] };
    render(
      <StoreContextProvider locale="ar" store={storeWith({ ...SETTINGS, trustItems: [{ text: { ar: "شحن سريع", en: "Fast delivery" } }] })}>
        <CartSheet config={config as never} />
      </StoreContextProvider>
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("شحن سريع")).toBeTruthy();
    expect(within(dialog).queryByText("سطر قديم")).toBeNull();
  });

  it("shows the bar on an empty cart too", async () => {
    Object.assign(cartState, { cart: { ...CART, items: [], subtotal: 0 }, itemCount: 0 });
    sheet();
    expect(await screen.findByText("سلة التسوق فاضية.")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
  });
});

describe("how it appears", () => {
  it("auto: a bottom sheet on a phone, a side drawer on a wider screen", () => {
    sheet();
    expect(layer().dataset.cartSheet).toBe("bottom");
    cleanup();
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("640"), addEventListener: () => undefined, removeEventListener: () => undefined }));
    sheet();
    expect(layer().dataset.cartSheet).toBe("side");
  });

  it.each([
    ["bottom_sheet", "bottom", /rounded-t-3xl/],
    ["side_drawer", "side", /(^|\s)end-0(\s|$)/],
    ["popup", "popup", /rounded-2xl/],
  ] as const)("%s", (presentation, variant, shape) => {
    sheet({ settings: { presentation } });
    expect(layer().dataset.cartSheet).toBe(variant);
    expect(panel().className).toMatch(shape);
    // Only a bottom sheet has the handle to pull it down by.
    expect(panel().querySelector(".h-1\\.5.w-10") !== null).toBe(variant === "bottom");
  });

  it("the side drawer mirrors with the text: the inline end, parked off the left in Arabic, off the right in English", async () => {
    vi.useFakeTimers();
    sheet({ settings: { presentation: "side_drawer" }, locale: "ar" });
    expect(panel().closest("[dir]")?.getAttribute("dir")).toBe("rtl");
    expect(panel().className).toMatch(/(^|\s)end-0(\s|$)/);
    expect(panel().className).not.toMatch(/(^|\s)(right-0|left-0)(\s|$)/);
    // Closed (before it slides in): off the inline end, flipped for right to left.
    expect(panel().className).toContain("translate-x-full rtl:-translate-x-full");
    await act(async () => {
      vi.advanceTimersByTime(30);
    });
    expect(panel().className).toContain("translate-x-0");
  });
});

describe("its speed", () => {
  it("none: drawn open at once, nothing moves", () => {
    sheet({ settings: { speed: "none" } });
    expect(panel().className).toContain("translate-y-0");
    expect(panel().style.transitionDuration).toBe("0ms");
  });

  it.each([
    ["fast", "260ms"],
    ["normal", "400ms"],
  ] as const)("%s slides in over %s, from off the edge", async (speed, ms) => {
    vi.useFakeTimers();
    sheet({ settings: { speed } });
    expect(panel().className).toContain("translate-y-full");
    expect(panel().style.transitionDuration).toBe(ms);
    await act(async () => {
      vi.advanceTimersByTime(30);
    });
    expect(panel().className).toContain("translate-y-0");
  });
});

describe("off for all", () => {
  it("never opens, whatever asks", () => {
    sheet({ settings: { enabled: false } });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("the keyboard", () => {
  it("keeps Tab inside, closes on Escape, and gives focus back to what opened it", async () => {
    Object.assign(cartState, { isDrawerOpen: false });
    const view = render(<Rerender />);
    const opener = screen.getByRole("button", { name: "opener" });
    opener.focus();
    Object.assign(cartState, { isDrawerOpen: true });
    view.rerender(<Rerender />);
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    const close = within(dialog).getByRole("button", { name: "إغلاق" });
    const complete = within(dialog).getByRole("link", { name: "كمّل الطلب" });
    complete.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(complete);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(closeDrawer).toHaveBeenCalled();
    Object.assign(cartState, { isDrawerOpen: false });
    view.rerender(<Rerender />);
    expect(document.activeElement).toBe(opener);
  });
});

function Rerender() {
  return (
    <StoreContextProvider locale="ar" store={storeWith({ ...SETTINGS, speed: "none" })}>
      <div dir="rtl">
        <button type="button">opener</button>
        <CartSheet config={CONFIG as never} />
      </div>
    </StoreContextProvider>
  );
}

describe("a product page's quick order", () => {
  function Form() {
    const slot = useQuickOrderSlot();
    return slot ? createPortal(<form aria-label="quick order form" />, slot) : null;
  }

  it("shows the page's own form in the sheet, with no cart lines and no checkout button", async () => {
    Object.assign(cartState, { sheetView: "quick" });
    sheet({ extra: <Form /> });
    const dialog = await screen.findByRole("dialog", { name: /اطلب الآن/ });
    expect(within(dialog).getByRole("form", { name: "quick order form" })).toBeTruthy();
    expect(within(dialog).queryByRole("link", { name: "كمّل الطلب" })).toBeNull();
    expect(dialog.querySelector("ul.divide-y")).toBeNull();
  });
});

describe("the swipe down", () => {
  it("closes a bottom sheet pulled a third of the way down", () => {
    vi.stubGlobal("DOMMatrixReadOnly", class {
      m42 = 0;
    });
    sheet({ settings: { presentation: "bottom_sheet" } });
    const dialog = panel();
    Object.defineProperty(dialog, "offsetHeight", { value: 600 });
    fireEvent.touchStart(dialog, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(dialog, { touches: [{ clientY: 140 }] });
    fireEvent.touchMove(dialog, { touches: [{ clientY: 400 }] });
    fireEvent.touchEnd(dialog);
    expect(closeDrawer).toHaveBeenCalled();
  });

  it("is not there on a side drawer", () => {
    sheet({ settings: { presentation: "side_drawer" } });
    const dialog = panel();
    fireEvent.touchStart(dialog, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(dialog, { touches: [{ clientY: 500 }] });
    fireEvent.touchEnd(dialog);
    expect(closeDrawer).not.toHaveBeenCalled();
  });
});
