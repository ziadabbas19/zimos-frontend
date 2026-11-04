import { render, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const cart = vi.hoisted(() => ({ value: { itemCount: 0, isDrawerOpen: false, isAdding: false } }));
vi.mock("@/lib/CartProvider", () => ({ useCart: () => cart.value }));
vi.mock("next/dynamic", () => ({ default: () => () => <p data-testid="drawer" /> }));

afterEach(() => {
  cleanup();
  cart.value = { itemCount: 0, isDrawerOpen: false, isAdding: false };
});

describe("the cart drawer's download", () => {
  it("does not happen while the cart is empty and closed", async () => {
    const { CartDrawer } = await import("./lazyFrame");
    const { queryByTestId } = render(<CartDrawer />);
    expect(queryByTestId("drawer")).toBeNull();
  });

  it.each([
    ["a line already in the cart", { itemCount: 1, isDrawerOpen: false, isAdding: false }],
    ["the drawer opening", { itemCount: 0, isDrawerOpen: true, isAdding: false }],
    ["a line on its way in", { itemCount: 0, isDrawerOpen: false, isAdding: true }],
  ])("happens for %s, and stays", async (_name, state) => {
    const { CartDrawer } = await import("./lazyFrame");
    const { queryByTestId, rerender } = render(<CartDrawer />);
    cart.value = state;
    rerender(<CartDrawer />);
    expect(queryByTestId("drawer")).not.toBeNull();
    cart.value = { itemCount: 0, isDrawerOpen: false, isAdding: false };
    rerender(<CartDrawer />);
    expect(queryByTestId("drawer")).not.toBeNull();
  });
});
