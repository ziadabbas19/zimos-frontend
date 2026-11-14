import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { StorefrontCartSheet } from "@store-builder/api-client";

// What opens the cart sheet (lib/cartSheet), as the merchant chose in
// Store settings → Cart behavior: the header's cart icon (on by default; off,
// it is a link to the cart page), "Add to cart" (on by default), the quick
// order button (off by default), or nothing at all. A store that never chose
// gets the defaults.

// The page the shopper is on, as the browser has it.
const goTo = (path: string) => window.history.pushState({}, "", path);
vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceId: "ws1" }),
  usePathname: () => window.location.pathname,
}));

vi.mock("@/components/StoreRoute", () => ({
  StoreLink: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useStoreBasePath: () => "/store/ws1",
}));

const openDrawer = vi.fn();
const addItem = vi.fn();
vi.mock("@/lib/CartProvider", () => ({
  useCart: () => ({ itemCount: 2, addItem, openDrawer }),
}));

const { StoreContextProvider } = await import("@/lib/StoreContext");
const { CartIcon } = await import("@/components/CartIcon");
const { AddToCartButton } = await import("@/components/AddToCartButton");
const { useCartSheet, cartSheetOf, sheetOpensOn } = await import("./cartSheet");

const DEFAULTS: StorefrontCartSheet = { enabled: true, openOn: { addToCart: true, cartIcon: true, quickOrder: false }, presentation: "auto", speed: "fast", trustItems: [] };

function store(cartSheet: StorefrontCartSheet | undefined) {
  return { workspaceId: "ws1", id: "ws1", slug: "shop", name: "Shop", currency: "EGP", logoUrl: null, phone: null, checkout: { email: "optional", postal_code: "hidden", notes: "optional" }, orderBump: null, cartSheet } as never;
}
const withStore = (cartSheet: StorefrontCartSheet | undefined) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StoreContextProvider locale="en" store={store(cartSheet)}>
        {children}
      </StoreContextProvider>
    );
  };
const settings = (change: Partial<StorefrontCartSheet> & { openOn?: Partial<StorefrontCartSheet["openOn"]> } = {}): StorefrontCartSheet => ({
  ...DEFAULTS,
  ...change,
  openOn: { ...DEFAULTS.openOn, ...(change.openOn ?? {}) },
});

beforeEach(() => {
  goTo("/store/ws1/products/coat");
  openDrawer.mockReset();
  addItem.mockReset();
  addItem.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("defaults", () => {
  it("a store that never chose: the cart icon and add to cart open it, the quick order does not", () => {
    const sheet = cartSheetOf(null);
    expect(sheet).toEqual(DEFAULTS);
    expect(sheetOpensOn(sheet, "cartIcon")).toBe(true);
    expect(sheetOpensOn(sheet, "addToCart")).toBe(true);
    expect(sheetOpensOn(sheet, "quickOrder")).toBe(false);
  });

  it("off for all: no trigger opens it", () => {
    const sheet = settings({ enabled: false, openOn: { addToCart: true, cartIcon: true, quickOrder: true } });
    for (const trigger of ["addToCart", "cartIcon", "quickOrder"] as const) expect(sheetOpensOn(sheet, trigger)).toBe(false);
  });
});

describe("the cart icon", () => {
  const click = (init: Partial<MouseEventInit> = {}) => fireEvent.click(screen.getByRole("link", { name: /cart/i }), { button: 0, ...init });

  it("opens the sheet in place while the merchant has it on (the default)", () => {
    render(<CartIcon />, { wrapper: withStore(undefined) });
    expect(click()).toBe(false); // the link was not followed
    expect(openDrawer).toHaveBeenCalledTimes(1);
  });

  it("is a plain link to the cart page while it is off, or the sheet is off for all", () => {
    render(<CartIcon />, { wrapper: withStore(settings({ openOn: { cartIcon: false } })) });
    expect(screen.getByRole("link", { name: /cart/i }).getAttribute("href")).toBe("/cart");
    expect(click()).toBe(true);
    cleanup();
    render(<CartIcon />, { wrapper: withStore(settings({ enabled: false })) });
    expect(click()).toBe(true);
    expect(openDrawer).not.toHaveBeenCalled();
  });

  it("goes through on the cart page itself, and with a modifier key", () => {
    render(<CartIcon />, { wrapper: withStore(undefined) });
    expect(click({ ctrlKey: true })).toBe(true);
    expect(click({ metaKey: true })).toBe(true);
    cleanup();
    goTo("/store/ws1/cart");
    render(<CartIcon />, { wrapper: withStore(undefined) });
    expect(click()).toBe(true);
    expect(openDrawer).not.toHaveBeenCalled();
  });
});

describe("add to cart", () => {
  it("opens the sheet once the line is in, for a store that never chose (on by default)", async () => {
    render(<AddToCartButton variantId="v1" />, { wrapper: withStore(undefined) });
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    await waitFor(() => expect(openDrawer).toHaveBeenCalledTimes(1));
    expect(addItem).toHaveBeenCalledWith("v1", undefined, 1, undefined, undefined);
  });

  it("adds and says so, without opening the sheet, once the merchant switched it off", async () => {
    render(<AddToCartButton variantId="v1" />, { wrapper: withStore(settings({ openOn: { addToCart: false } })) });
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    expect(await screen.findByRole("button", { name: "Added to cart" })).toBeTruthy();
    expect(openDrawer).not.toHaveBeenCalled();
  });

  it("does not open it while the sheet is off for all", async () => {
    render(<AddToCartButton variantId="v1" />, { wrapper: withStore(settings({ enabled: false, openOn: { addToCart: true } })) });
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    expect(await screen.findByRole("button", { name: "Added to cart" })).toBeTruthy();
    expect(openDrawer).not.toHaveBeenCalled();
  });
});

describe("the quick order button", () => {
  it("opens the sheet only while the merchant has it on", () => {
    const off = renderHook(() => useCartSheet(openDrawer), { wrapper: withStore(undefined) });
    expect(off.result.current.opensOn("quickOrder")).toBe(false);
    const on = renderHook(() => useCartSheet(openDrawer), { wrapper: withStore(settings({ openOn: { quickOrder: true } })) });
    expect(on.result.current.opensOn("quickOrder")).toBe(true);
    const none = renderHook(() => useCartSheet(openDrawer), { wrapper: withStore(settings({ enabled: false, openOn: { quickOrder: true } })) });
    expect(none.result.current.opensOn("quickOrder")).toBe(false);
  });
});
