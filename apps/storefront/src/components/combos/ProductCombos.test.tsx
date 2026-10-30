import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import type { StorefrontCombo, StorefrontVariant } from "@store-builder/api-client";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";
import { CartProvider } from "@/lib/CartProvider";
import { formatPrice, type Locale } from "@/lib/i18n";

// --- the card's surroundings, stubbed --------------------------------------
const addCartItem = vi.fn();
const getOrCreateCart = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceId: "ws1" }),
}));

vi.mock("@/components/StoreRoute", () => ({
  StoreLink: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/apiClient", () => ({
  createStorefrontApiClient: () => ({
    getOrCreateCart: (...args: unknown[]) => getOrCreateCart(...args),
    getCart: () => Promise.reject(new Error("no saved cart in tests")),
    addCartItem: (...args: unknown[]) => addCartItem(...args),
  }),
}));

vi.mock("@/lib/track", () => ({ track: vi.fn() }));

const { ProductCombos } = await import("./ProductCombos");

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

const variant = (id: string, priceAmount: number, optionValues: Record<string, string>, inStock = true): StorefrontVariant => ({
  id,
  sku: id.toUpperCase(),
  optionValues,
  priceAmount,
  compareAtAmount: null,
  currency: "EGP",
  weightGrams: null,
  inStock,
});

/** A shirt the shopper sizes, and trousers fixed by the merchant: 10% off the two. */
const COMBO: StorefrontCombo = {
  id: "c1",
  name: "Summer set",
  description: "Shirt and trousers",
  imageUrl: null,
  pricingMode: "percent_off",
  priceValue: 1000,
  items: [
    {
      id: "i1",
      quantity: 1,
      pickVariant: true,
      product: { id: "p1", name: "Shirt", slug: "shirt", imageUrl: "https://cdn.example.com/shirt.jpg" },
      variants: [variant("vs", 10000, { Size: "S" }), variant("vl", 11000, { Size: "L" }, false), variant("vxl", 12000, { Size: "XL" })],
    },
    {
      id: "i2",
      quantity: 1,
      pickVariant: false,
      product: { id: "p2", name: "Trousers", slug: "trousers", imageUrl: "https://cdn.example.com/trousers.jpg" },
      variants: [variant("vt", 20000, { Colour: "Navy" })],
    },
  ],
  price: { full: 30000, total: 27000, saving: 3000 },
  available: true,
};

/** A price as the page shows it, its spaces as the text queries read them. */
const egp = (amount: number, locale: Locale = "en") => formatPrice(amount, "EGP", locale, null).replace(/\s+/g, " ").trim();

function renderCombos(combos: StorefrontCombo[], locale: Locale = "en") {
  return render(
    <StoreContextProvider locale={locale} store={STORE}>
      <CartProvider>
        <ProductCombos combos={combos} />
      </CartProvider>
    </StoreContextProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  addCartItem.mockReset();
  getOrCreateCart.mockReset();
  getOrCreateCart.mockResolvedValue({ id: "cart1", guestToken: "tok", currency: "EGP", status: "active", items: [], subtotal: 0 });
  addCartItem.mockResolvedValue({ id: "cart1", guestToken: "tok", currency: "EGP", status: "active", items: [], subtotal: 0 });
});
afterEach(cleanup);

describe("combos on the product page", () => {
  it("draws nothing for a product in no combo", () => {
    const { container } = renderCombos([]);
    expect(container.querySelector("section")).toBeNull();
    expect(screen.queryByText("Buy it as a combo")).toBeNull();
  });

  it("shows each combo as a card: badge, products linked to their pages, and the server's price before any pick", () => {
    renderCombos([COMBO]);
    expect(screen.getByRole("heading", { name: "Buy it as a combo" })).toBeTruthy();
    const card = screen.getByRole("article", { name: "Summer set" });
    expect(within(card).getByText("Combo")).toBeTruthy();
    expect(within(card).getByRole("link", { name: "Shirt" }).getAttribute("href")).toBe("/products/shirt");
    expect(within(card).getByRole("link", { name: "Trousers" }).getAttribute("href")).toBe("/products/trousers");
    // The fixed product's variant is named; the one the shopper picks gets a chooser.
    expect(within(card).getByText("Navy")).toBeTruthy();
    expect(within(card).getByText(egp(27000))).toBeTruthy();
    expect(within(card).getByText(egp(30000))).toBeTruthy();
    expect(within(card).getByText(`You save ${egp(3000)}`)).toBeTruthy();
    // No combo picture: the products' pictures side by side.
    expect(card.querySelectorAll("img")).toHaveLength(2);
  });

  it("prices the chosen variants by the combo's rule, and keeps a sold-out variant unpickable", () => {
    renderCombos([COMBO]);
    const select = screen.getByLabelText("Option for Shirt") as HTMLSelectElement;
    const large = Array.from(select.options).find((o) => o.value === "vl")!;
    expect(large.disabled).toBe(true);
    expect(large.textContent).toBe("L — Sold out");

    fireEvent.change(select, { target: { value: "vxl" } });
    // 12000 + 20000 = 32000, 10% off: 28800.
    expect(screen.getByText(egp(28800))).toBeTruthy();
    expect(screen.getByText(egp(32000))).toBeTruthy();
    expect(screen.getByText(`You save ${egp(3200)}`)).toBeTruthy();
  });

  it("adds the whole combo as one cart line, only once every pick is made", async () => {
    renderCombos([COMBO]);
    const button = screen.getByRole("button", { name: "Add the combo to cart" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText("Choose an option for each product first.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Option for Shirt"), { target: { value: "vxl" } });
    expect(button.disabled).toBe(false);
    fireEvent.click(button);

    await waitFor(() => expect(addCartItem).toHaveBeenCalledTimes(1));
    const [workspaceId, token, payload] = addCartItem.mock.calls[0];
    expect(workspaceId).toBe("ws1");
    expect(token).toBe("tok");
    expect(payload).toEqual({ comboId: "c1", comboSelection: [{ itemId: "i1", variantId: "vxl" }], quantity: 1 });
    await screen.findByRole("button", { name: "Added to cart" });
  });

  it("says sold out when the server says the combo cannot be bought", () => {
    renderCombos([{ ...COMBO, available: false }], "ar");
    const card = screen.getByRole("article", { name: "Summer set" });
    const button = within(card).getByRole("button", { name: "خلصان" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByRole("heading", { name: "اشتري الطقم ووفّر" })).toBeTruthy();
    expect(within(card).getByText("طقم")).toBeTruthy();
  });

  it("says sold out when the product the merchant fixed has no stock", () => {
    const fixedGone = { ...COMBO, items: [COMBO.items[0], { ...COMBO.items[1], variants: [variant("vt", 20000, { Colour: "Navy" }, false)] }] };
    renderCombos([fixedGone]);
    fireEvent.change(screen.getByLabelText("Option for Shirt"), { target: { value: "vs" } });
    expect((screen.getByRole("button", { name: "Sold out" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("has nothing to pick for a product with one variant in stock: the button is ready", () => {
    const one = { ...COMBO, items: [{ ...COMBO.items[0], variants: [variant("vs", 10000, { Size: "S" })] }, COMBO.items[1]] };
    renderCombos([one], "ar");
    expect((screen.getByRole("button", { name: "ضيف الطقم للسلة" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
