import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { ApiError, type Workspace } from "@store-builder/api-client";
import { invalidateCached } from "@/lib/useCachedAsync";
import { formatMoney } from "@/lib/format";
import { api, fake, testWorkspace, workspaceMock } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { CombosPage } from "./CombosPage";
import { OffersPage } from "./OffersPage";

// This file runs with product combos switched on; combosOff.test.tsx runs with it off.
vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  PRODUCT_COMBOS_ENABLED: true,
}));

interface Init {
  method?: string;
  body?: unknown;
}

const variant = (id: string, optionValues: Record<string, string>, priceAmount: string) => ({
  id,
  status: "active",
  optionValues,
  priceAmount,
  currency: "EGP",
  sku: null,
});

const products = [
  { id: "p1", name: "Mug", status: "active", variants: [variant("v1", { Color: "Red" }, "10000"), variant("v2", { Color: "Blue" }, "12000")] },
  { id: "p2", name: "T-shirt", status: "active", variants: [variant("v3", { Size: "M" }, "20000"), variant("v4", { Size: "L" }, "20000")] },
];

const combo = {
  id: "c1",
  name: "Morning set",
  description: null,
  imageUrl: null,
  status: "active",
  pricingMode: "fixed_price",
  priceValue: 25000,
  showOnProductIds: [],
  items: [
    { id: "i1", productId: "p1", productName: "Mug", productStatus: "active", variantId: "v1", variantOptions: { Color: "Red" }, pickVariant: false, quantity: 1 },
    { id: "i2", productId: "p2", productName: "T-shirt", productStatus: "active", variantId: null, variantOptions: null, pickVariant: true, quantity: 2 },
  ],
  price: { full: 50000, total: 25000 },
  available: true,
  createdAt: "2026-10-01T10:00:00Z",
  updatedAt: "2026-10-01T10:00:00Z",
};

/** Answers the combos calls; an Error is thrown as the server's refusal, undefined never settles. */
function serve(answer: (path: string, init?: Init) => unknown) {
  api.listProducts.mockResolvedValue(fake({ products, nextCursor: null }));
  api.request.mockImplementation(async (path: string, init?: Init) => {
    const found = answer(path, init);
    if (found instanceof Error) throw found;
    return found !== undefined ? found : new Promise(() => undefined);
  });
}

const callsTo = (method: string, path: string) =>
  api.request.mock.calls.filter(([p, init]) => p === path && init?.method === method).map(([, init]) => init?.body);

/** As the screen reads once its spaces are made plain (Intl puts a no-break space after the currency). */
const money = (minor: number) => formatMoney(minor).replace(/\s+/g, " ");

const refusal = (code: string, details: unknown[]) => new ApiError("Refused", 422, code, { error: { code, message: "Refused", details } });

afterEach(() => {
  api.request.mockReset();
  invalidateCached("offer-combos:");
  workspaceMock.currentWorkspace = testWorkspace;
});

describe("combos with the switch on", () => {
  it("has a card on the offers hub", async () => {
    serve(() => undefined);
    renderWithProviders(<OffersPage />, { route: "/offers" });
    const card = await screen.findByRole("link", { name: /Combos/ });
    expect(card).toHaveAttribute("href", "/offers/combos");
  });

  it("lists each combo with its products, the price apart and as a combo, its status, and when it cannot be bought", async () => {
    serve((path, init) =>
      path === "/workspaces/ws_1/combos" && !init?.method
        ? { combos: [combo, { ...combo, id: "c2", name: "Old set", status: "draft", available: false, price: { full: 30000, total: 30000 } }] }
        : undefined
    );
    renderWithProviders(<CombosPage />, { route: "/offers/combos" });

    const list = await screen.findByRole("list", { name: "Your combos" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    const first = within(rows[0]);
    expect(first.getByText("Mug (Color: Red) × 1 + T-shirt (the customer picks) × 2")).toBeInTheDocument();
    expect(first.getByText(money(50000))).toBeInTheDocument();
    expect(first.getByText(`Saves ${money(25000)}`)).toBeInTheDocument();
    expect(first.getByText("Active")).toBeInTheDocument();
    expect(first.queryByText("Unavailable")).not.toBeInTheDocument();

    const second = within(rows[1]);
    expect(second.getByText("Draft")).toBeInTheDocument();
    expect(second.getByText("Unavailable")).toBeInTheDocument();
    expect(second.queryByText(/^Saves/)).not.toBeInTheDocument();
  });

  it("explains what a combo is when there is none", async () => {
    serve((path, init) => (path === "/workspaces/ws_1/combos" && !init?.method ? { combos: [] } : undefined));
    renderWithProviders(<CombosPage />, { route: "/offers/combos" });
    expect(await screen.findByText("No combos yet")).toBeInTheDocument();
    expect(screen.getByText(/A combo puts different products together at one price/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New combo" })).toBeInTheDocument();
  });

  it("sends a set option and a customer's pick, and a percentage as basis points", async () => {
    serve((path, init) => {
      if (path === "/workspaces/ws_1/combos" && !init?.method) return { combos: [] };
      if (path === "/workspaces/ws_1/combos/preview") return { preview: { componentsTotal: 50000, total: 42500 } };
      if (path === "/workspaces/ws_1/combos" && init?.method === "POST") return { combo: { ...combo, ...(init.body as object) } };
      return undefined;
    });
    const { user } = renderWithProviders(<CombosPage />, { route: "/offers/combos" });

    await user.click(await screen.findByRole("button", { name: "New combo" }));
    const dialog = await screen.findByRole("dialog", { name: "New combo" });
    await user.type(within(dialog).getByLabelText(/Combo name/), "Morning set");

    const first = within(within(dialog).getByRole("group", { name: "Item 1" }));
    await waitFor(() => expect(first.getByLabelText("Product")).toBeEnabled());
    await user.selectOptions(first.getByLabelText("Product"), "p1");
    // A product with several options starts at the customer's pick; this one is set to Red.
    expect(first.getByLabelText("Option")).toHaveValue("pick");
    await user.selectOptions(first.getByLabelText("Option"), "v1");

    const second = within(within(dialog).getByRole("group", { name: "Item 2" }));
    await user.selectOptions(second.getByLabelText("Product"), "p2");
    await user.clear(second.getByLabelText("Quantity"));
    await user.type(second.getByLabelText("Quantity"), "2");

    await user.click(within(dialog).getByRole("radio", { name: "Percentage off" }));
    await user.type(within(dialog).getByLabelText("Percentage off (%)"), "15");

    await user.click(within(dialog).getByRole("button", { name: "Save combo" }));
    await waitFor(() => expect(callsTo("POST", "/workspaces/ws_1/combos")).toHaveLength(1));
    expect(callsTo("POST", "/workspaces/ws_1/combos")[0]).toEqual({
      name: "Morning set",
      description: null,
      imageUrl: null,
      status: "draft",
      pricingMode: "percent_off",
      priceValue: 1500,
      showOnProductIds: [],
      items: [
        { productId: "p1", variantId: "v1", pickVariant: false, quantity: 1 },
        { productId: "p2", variantId: null, pickVariant: true, quantity: 2 },
      ],
    });
  });

  it("prices the draft live and says in words why the server refuses it", async () => {
    let preview: unknown = { preview: { componentsTotal: 50000, total: 25000 } };
    serve((path, init) => {
      if (path === "/workspaces/ws_1/combos" && !init?.method) return { combos: [combo] };
      if (path === "/workspaces/ws_1/combos/preview") return preview;
      return undefined;
    });
    const { user } = renderWithProviders(<CombosPage />, { route: "/offers/combos" });

    await user.click(await screen.findByRole("button", { name: "Edit Morning set" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit combo" });
    expect(
      await within(dialog).findByText(
        `Products apart: ${money(50000)} — Combo: ${money(25000)} — Saving: ${money(25000)}`
      )
    ).toBeInTheDocument();
    expect(callsTo("POST", "/workspaces/ws_1/combos/preview")[0]).toEqual({
      pricingMode: "fixed_price",
      priceValue: 25000,
      items: [
        { productId: "p1", variantId: "v1", pickVariant: false, quantity: 1 },
        { productId: "p2", variantId: null, pickVariant: true, quantity: 2 },
      ],
    });

    preview = refusal("COMBO_PRICE_ABOVE_TOTAL", [{ field: "priceValue", componentsTotal: 50000 }]);
    const price = within(dialog).getByLabelText("Price of the whole combo");
    await user.clear(price);
    await user.type(price, "600");
    expect(
      await within(dialog).findByText(`The combo cannot cost more than its products bought apart (${money(50000)}).`)
    ).toBeInTheDocument();

    preview = refusal("COMBO_VARIANT_REQUIRED", [{ field: "items[0].variantId" }]);
    await user.clear(price);
    await user.type(price, "300");
    expect(await within(dialog).findByText("Choose the option of every product, or let the customer pick it.")).toBeInTheDocument();
  });

  it("asks before it archives a combo", async () => {
    serve((path, init) => {
      if (path === "/workspaces/ws_1/combos" && !init?.method) return { combos: [combo] };
      if (path === "/workspaces/ws_1/combos/c1" && init?.method === "DELETE") return {};
      return undefined;
    });
    const { user } = renderWithProviders(<CombosPage />, { route: "/offers/combos" });

    fireEvent.contextMenu((await screen.findByText("Morning set")).closest('[data-slot="offer-row"]') as HTMLElement);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Archive" }));
    const confirm = await screen.findByRole("dialog", { name: "Archive “Morning set”?" });
    expect(callsTo("DELETE", "/workspaces/ws_1/combos/c1")).toHaveLength(0);

    await user.click(within(confirm).getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(callsTo("DELETE", "/workspaces/ws_1/combos/c1")).toHaveLength(1));
    expect(await screen.findByText("“Morning set” was archived.")).toBeInTheDocument();
  });

  it("shows the list only to a role that cannot change products", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", role: "order_operator", permissions: ["orders.view", "products.view"] });
    serve((path, init) => (path === "/workspaces/ws_1/combos" && !init?.method ? { combos: [combo] } : undefined));
    renderWithProviders(<CombosPage />, { route: "/offers/combos" });

    expect(await screen.findByText("Morning set")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New combo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Morning set" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "More actions: Morning set" })).not.toBeInTheDocument();
  });

  it("reads in the dashboard's own Arabic", async () => {
    serve((path, init) => (path === "/workspaces/ws_1/combos" && !init?.method ? { combos: [combo] } : undefined));
    renderWithProviders(<CombosPage />, { route: "/offers/combos", locale: "ar" });
    expect(await screen.findByText("Mug (Color: Red) × 1 + T-shirt (يختار العميل) × 2")).toBeInTheDocument();
    expect(screen.getByText("مفعّلة")).toBeInTheDocument();
  });
});
