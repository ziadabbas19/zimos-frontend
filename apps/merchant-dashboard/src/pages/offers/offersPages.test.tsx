import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { BundlesPage } from "./BundlesPage";
import { CrossSellPage } from "./CrossSellPage";
import { OffersPage } from "./OffersPage";
import { OrderRulesPage } from "./OrderRulesPage";
import { ProductFeedPage } from "./ProductFeedPage";

/**
 * The offers screens: the hub that lists the tools, the rule lists (a row per
 * rule with its switch), and the settings pages that save from one bar. Every
 * one of them makes the calls it made before.
 */

interface Init {
  method?: string;
  body?: unknown;
}

function serve(answer: (path: string, init?: Init) => unknown) {
  api.listProducts.mockResolvedValue(fake({ products: [], nextCursor: null }));
  api.request.mockImplementation(async (path: string, init?: Init) => {
    const found = answer(path, init);
    return found !== undefined ? found : new Promise(() => undefined);
  });
}

const writes = () => api.request.mock.calls.filter(([, init]) => init?.method).map(([path, init]) => ({ path, method: init?.method, body: init?.body }));

afterEach(() => {
  api.request.mockReset();
  vi.restoreAllMocks();
});

describe("the offers hub", () => {
  const summary = {
    days: 30,
    bundles: { active: 2, orders: 12, savedAmount: "30000" },
    bumps: { active: 0, sold: 0, revenue: "0" },
    upsells: { active: 0, accepted: 0, revenue: "0" },
    crossSell: { active: 1 },
    discounts: { active: 0, redemptions: 0, amount: "0" },
    newsletter: { subscribers: 0 },
  };

  it("lists the tools this product has, grouped by what they are for, and no others", async () => {
    serve((path) => (path.startsWith("/workspaces/ws_1/offers/summary") ? { summary } : undefined));
    renderWithProviders(<OffersPage />, { route: "/offers" });

    const links = (await screen.findAllByRole("link")).map((a) => a.getAttribute("href")).filter((href) => href?.startsWith("/offers/") || href === "/discounts");
    expect(new Set(links)).toEqual(
      new Set([
        "/offers/bundles",
        "/offers/order-bumps",
        "/offers/upsells",
        "/offers/cross-sell",
        "/offers/exit-popup",
        "/offers/social-proof",
        "/offers/order-rules",
        "/discounts",
        "/offers/newsletter",
        "/offers/referrals",
        "/offers/feed",
      ])
    );
    // What is running is said on the card.
    expect(await screen.findByText("2 running")).toBeInTheDocument();
  });

  it("reads in the dashboard's own Arabic", async () => {
    serve((path) => (path.startsWith("/workspaces/ws_1/offers/summary") ? { summary } : undefined));
    renderWithProviders(<OffersPage />, { route: "/offers", locale: "ar" });

    expect(await screen.findByText("زيادة قيمة الطلب")).toBeInTheDocument();
    expect(screen.getByText("جذب العملاء")).toBeInTheDocument();
    expect(await screen.findByText("اثنان مفعّلان")).toBeInTheDocument();
  });
});

describe("the bundles list", () => {
  const bundle = {
    id: "b1",
    name: "Buy more",
    displayStyle: "cards",
    isActive: true,
    tiers: [{ id: "t1", quantity: 2, discountType: "percentage", discountValue: 10, freeShipping: false }],
    productCount: 3,
    createdAt: "2026-10-01T10:00:00Z",
    updatedAt: "2026-10-01T10:00:00Z",
  };

  it("turns a bundle off from its row and takes that back with the same call", async () => {
    serve((path, init) => {
      if (path === "/workspaces/ws_1/bundles" && !init?.method) return { bundles: [bundle] };
      if (path === "/workspaces/ws_1/bundles/b1" && init?.method === "PATCH") return { bundle: { ...bundle, ...(init.body as object) } };
      return undefined;
    });
    const { user } = renderWithProviders(<BundlesPage />, { route: "/offers/bundles" });

    await user.click(await screen.findByRole("switch", { name: "Turn off Buy more" }));
    await waitFor(() => expect(writes()).toEqual([{ path: "/workspaces/ws_1/bundles/b1", method: "PATCH", body: { isActive: false } }]));

    await user.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() => expect(writes()).toHaveLength(2));
    expect(writes()[1]).toEqual({ path: "/workspaces/ws_1/bundles/b1", method: "PATCH", body: { isActive: true } });
  });
});

describe("the minimum order page", () => {
  it("saves from one bar, and only what changed", async () => {
    serve((path, init) => {
      if (path === "/workspaces/ws_1/offers/order-rules" && !init?.method) return { orderRules: { minOrderAmount: null } };
      if (path === "/workspaces/ws_1/offers/order-rules" && init?.method === "PUT") return { orderRules: init.body };
      return undefined;
    });
    const { user } = renderWithProviders(<OrderRulesPage />, { route: "/offers/order-rules" });

    const field = await screen.findByLabelText("Minimum order amount");
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.getByText("No minimum: every order is accepted, whatever its amount.")).toBeInTheDocument();

    await user.type(field, "150");
    await user.click(await screen.findByRole("button", { name: "Save" }));

    await waitFor(() => expect(writes()).toEqual([{ path: "/workspaces/ws_1/offers/order-rules", method: "PUT", body: { minOrderAmount: 15000 } }]));
  });

  it("can drop what was typed and go back to what is saved", async () => {
    serve((path, init) => (path === "/workspaces/ws_1/offers/order-rules" && !init?.method ? { orderRules: { minOrderAmount: 5000 } } : undefined));
    const { user } = renderWithProviders(<OrderRulesPage />, { route: "/offers/order-rules" });

    const field = await screen.findByLabelText("Minimum order amount");
    await user.clear(field);
    await user.type(field, "90");
    await user.click(await screen.findByRole("button", { name: "Discard" }));

    expect((field as HTMLInputElement).value).toMatch(/^50(\.00)?$/);
    expect(writes()).toHaveLength(0);
  });
});

describe("the product feed page", () => {
  const feed = { enabled: false, collectionIds: [], excludeOutOfStock: false, brand: "", googleProductCategory: "" };
  const links = Object.fromEntries(["meta", "google", "tiktok", "snapchat"].map((c) => [c, { xml: `/feeds/ws_1/${c}.xml`, csv: `/feeds/ws_1/${c}.csv` }]));

  it("gives each ad channel its fixed link, and only lets it be copied once the feed is published", async () => {
    serve((path, init) => {
      if (path === "/workspaces/ws_1/offers/feed" && !init?.method) return { feed, itemCount: 0, productCount: 0, links };
      if (path === "/workspaces/ws_1/offers/merchant-checklist") return { ready: false, checks: [{ key: "feed_enabled", ok: false, fixAt: "feed" }] };
      return undefined;
    });
    renderWithProviders(<ProductFeedPage />, { route: "/offers/feed" });

    const meta = (await screen.findByLabelText("Meta (Facebook and Instagram)")) as HTMLInputElement;
    expect(meta.value.endsWith("/feeds/ws_1/meta.xml")).toBe(true);
    expect(screen.getByLabelText("Snapchat")).toBeInTheDocument();
    for (const button of screen.getAllByRole("button", { name: "Copy XML link" })) expect(button).toBeDisabled();
    expect(screen.getByText("Switch the feed on and save to get working links.")).toBeInTheDocument();
  });

  it("saves the store-wide settings as they were sent before: no per-channel settings", async () => {
    serve((path, init) => {
      if (path === "/workspaces/ws_1/offers/feed" && !init?.method) return { feed, itemCount: 0, productCount: 0, links };
      if (path === "/workspaces/ws_1/offers/feed" && init?.method === "PUT") return { feed: init.body, itemCount: 0, productCount: 0, links };
      if (path === "/workspaces/ws_1/offers/merchant-checklist") return { ready: true, checks: [] };
      return undefined;
    });
    const { user } = renderWithProviders(<ProductFeedPage />, { route: "/offers/feed" });

    await user.click(await screen.findByRole("switch", { name: "Publish the product feed" }));
    await user.click(await screen.findByRole("button", { name: "Save" }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0].body).toEqual({ ...feed, enabled: true });
  });
});

describe("the cross-sell page", () => {
  it("offers the three places this API knows for a rule", async () => {
    serve((path, init) => (path === "/workspaces/ws_1/offers/cross-sell" && !init?.method ? { rules: [] } : undefined));
    const { user } = renderWithProviders(<CrossSellPage />, { route: "/offers/cross-sell" });

    await user.click((await screen.findAllByRole("button", { name: "New rule" }))[0]);
    const where = await screen.findByLabelText("Where");
    expect(within(where).getAllByRole("option").map((o) => o.textContent)).toEqual(["In the cart", "At checkout", "On the thank-you page"]);
  });
});
