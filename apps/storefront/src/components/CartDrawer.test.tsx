import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

// The drawer reads the catalogue only to name and picture its lines: not on
// every page a visitor with an empty cart opens, but once the cart has a
// line, the drawer opens or a line is on its way in. The cart and checkout
// pages read the same catalogue at the same moment: one request between them.

const listStorefrontProducts = vi.fn();

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

// Whatever else the open drawer asks for (shipping, holidays) fails quietly.
vi.mock("@/lib/apiClient", () => ({
  createStorefrontApiClient: () =>
    new Proxy(
      {},
      { get: (_t, name) => (name === "listStorefrontProducts" ? listStorefrontProducts : () => Promise.reject(new Error("offline in tests"))) }
    ),
}));

type CartState = {
  cart: unknown;
  isLoading: boolean;
  isAdding: boolean;
  itemCount: number;
  isDrawerOpen: boolean;
};
const cartState: CartState = { cart: null, isLoading: false, isAdding: false, itemCount: 0, isDrawerOpen: false };

vi.mock("@/lib/CartProvider", () => ({
  useCart: () => ({
    ...cartState,
    updateItem: vi.fn(),
    removeItem: vi.fn(),
    closeDrawer: vi.fn(),
  }),
}));

const { CartDrawer } = await import("./CartDrawer");
const { forgetCatalogs, useCatalog } = await import("@/lib/useCatalog");

const coat = {
  id: "p1",
  slug: "coat",
  name: "Belted coat",
  images: [],
  variants: [{ id: "v1", optionValues: {} }],
};
const line = {
  id: "line1",
  variantId: "v1",
  offerId: null,
  quantity: 1,
  unitPriceSnapshot: "1000",
  currentUnitPrice: "1000",
  priceChanged: false,
  lineTotal: 100000,
  variant: { id: "v1", optionValues: {} },
  isOrderBump: false,
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  forgetCatalogs();
  listStorefrontProducts.mockReset();
  listStorefrontProducts.mockResolvedValue({ products: [coat] });
  Object.assign(cartState, { cart: { currency: "EGP", items: [], subtotal: 0 }, isLoading: false, isAdding: false, itemCount: 0, isDrawerOpen: false });
});

afterEach(() => cleanup());

describe("the cart drawer's catalogue", () => {
  it("is not read on a page whose visitor has an empty cart and a closed drawer", async () => {
    render(<CartDrawer />);
    await tick();
    expect(listStorefrontProducts).not.toHaveBeenCalled();
  });

  it("is read once the cart has a line, and names it in the open drawer", async () => {
    Object.assign(cartState, { cart: { currency: "EGP", items: [line], subtotal: 100000 }, itemCount: 1, isDrawerOpen: true });
    render(<CartDrawer />);
    expect(await screen.findByText("Belted coat")).toBeTruthy();
    expect(listStorefrontProducts).toHaveBeenCalledTimes(1);
    expect(listStorefrontProducts).toHaveBeenCalledWith("ws1", { limit: 48 });
  });

  it("is read while a first line is being added, before the cart answers", async () => {
    cartState.isAdding = true;
    render(<CartDrawer />);
    await waitFor(() => expect(listStorefrontProducts).toHaveBeenCalledTimes(1));
  });

  it("is read when the drawer is opened on an empty cart", async () => {
    cartState.isDrawerOpen = true;
    render(<CartDrawer />);
    await waitFor(() => expect(listStorefrontProducts).toHaveBeenCalledTimes(1));
  });

  it("stays read when the cart empties again: no second request", async () => {
    Object.assign(cartState, { cart: { currency: "EGP", items: [line], subtotal: 100000 }, itemCount: 1 });
    const view = render(<CartDrawer />);
    await waitFor(() => expect(listStorefrontProducts).toHaveBeenCalledTimes(1));
    Object.assign(cartState, { cart: { currency: "EGP", items: [], subtotal: 0 }, itemCount: 0 });
    view.rerender(<CartDrawer />);
    Object.assign(cartState, { cart: { currency: "EGP", items: [line], subtotal: 100000 }, itemCount: 1 });
    view.rerender(<CartDrawer />);
    await tick();
    expect(listStorefrontProducts).toHaveBeenCalledTimes(1);
  });
});

describe("useCatalog", () => {
  it("is one request for two readers at the same moment (the drawer and the cart page)", async () => {
    const a = renderHook(() => useCatalog("ws1"));
    const b = renderHook(() => useCatalog("ws1"));
    await waitFor(() => expect(a.result.current.loaded && b.result.current.loaded).toBe(true));
    expect(listStorefrontProducts).toHaveBeenCalledTimes(1);
    expect(b.result.current.byVariant.get("v1")?.name).toBe("Belted coat");
  });

  it("asks nothing without a store", async () => {
    const { result } = renderHook(() => useCatalog(undefined));
    await tick();
    expect(listStorefrontProducts).not.toHaveBeenCalled();
    expect(result.current.loaded).toBe(false);
  });

  it("asks again after a failure", async () => {
    listStorefrontProducts.mockRejectedValueOnce(new Error("offline"));
    const first = renderHook(() => useCatalog("ws1"));
    await waitFor(() => expect(first.result.current.loaded).toBe(true));
    expect(first.result.current.products).toEqual([]);
    const second = renderHook(() => useCatalog("ws1"));
    await waitFor(() => expect(second.result.current.products).toEqual([coat]));
    expect(listStorefrontProducts).toHaveBeenCalledTimes(2);
  });
});
