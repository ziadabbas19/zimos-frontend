import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { DEFAULT_CATALOG_SETTINGS } from "@store-builder/api-client";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";

/*
 * The products page with the side columns switched on (lib/features
 * STORE_SIDEBAR_ENABLED). productsPage.sidebarOff.test.tsx is the same page
 * with the switch off: the listing as it was.
 */

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/products",
  useParams: () => ({ workspaceId: "shop" }),
  useSelectedLayoutSegment: () => "products",
  notFound: () => {
    throw new Error("not found");
  },
}));
vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  STORE_SIDEBAR_ENABLED: true,
}));

const COLLECTIONS = [
  { id: "c1", name: "Men", slug: "men", description: null, seo: null, parentId: null },
  { id: "c2", name: "Women", slug: "women", description: null, seo: null, parentId: null },
];
const FACETS = {
  collections: [
    { id: "c1", name: "Men", slug: "men", parentId: null, count: 60 },
    { id: "c2", name: "Women", slug: "women", parentId: null, count: 3 },
  ],
  tags: [{ value: "summer", count: 60 }],
  options: [{ name: "Size", values: [{ value: "M", count: 2 }] }],
  price: { min: 5000, max: 45000 },
};

const store = vi.hoisted(() => ({ catalog: null as unknown }));
const searchStorefrontProducts = vi.hoisted(() => vi.fn());
vi.mock("@/lib/storeMeta", () => ({
  getStoreMeta: async () => ({ id: "shop", name: "Shop", slug: "shop", currency: "EGP", themeSettings: {}, catalog: store.catalog }),
  getStoreCollections: async () => COLLECTIONS,
}));
vi.mock("@/lib/storeLocale", () => ({ getStoreLocale: async () => "en" }));
vi.mock("@/lib/serverApiClient", () => ({ createServerStorefrontApiClient: async () => ({ searchStorefrontProducts }) }));

import ProductsPage from "@/app/store/[workspaceId]/products/page";

const STORE = { workspaceId: "shop", id: "shop", slug: "shop", name: "Shop", currency: "EGP", logoUrl: null, phone: null, checkout: {}, orderBump: null } as unknown as StoreInfo;

async function openPage(query: Record<string, string | string[]>) {
  const page = await ProductsPage({ params: Promise.resolve({ workspaceId: "shop" }), searchParams: Promise.resolve(query) });
  return render(
    <StoreContextProvider locale="en" store={STORE}>
      {page}
    </StoreContextProvider>
  );
}

beforeEach(() => {
  push.mockClear();
  store.catalog = DEFAULT_CATALOG_SETTINGS;
  searchStorefrontProducts.mockReset();
  searchStorefrontProducts.mockImplementation(async (_ws: string, params: { facets?: boolean; page?: number }) => ({
    products: [],
    nextCursor: null,
    page: params.page ?? 1,
    pageSize: 24,
    total: 60,
    hasMore: true,
    sort: "newest",
    collection: { ...COLLECTIONS[0], imageUrl: null },
    breadcrumbs: [{ id: "c1", name: "Men", slug: "men" }],
    ...(params.facets ? { facets: FACETS } : {}),
  }));
});
afterEach(() => {
  cleanup();
});

describe("the products page with the side columns on", () => {
  it("asks the API for the list the URL describes: every filter goes to the server", async () => {
    await openPage({ collection: "men", tag: "summer", min: "100", "option[Size]": "M", page: "2" });
    expect(searchStorefrontProducts).toHaveBeenCalledTimes(1);
    expect(searchStorefrontProducts.mock.calls[0][1]).toEqual({
      collection: "men",
      tags: ["summer"],
      minPrice: 10000,
      maxPrice: undefined,
      options: { Size: ["M"] },
      sort: "newest",
      page: 2,
      limit: 24,
      facets: true,
    });
  });

  it("shows the filters in use as chips over the grid", async () => {
    const { container } = await openPage({ collection: "men", tag: "summer" });
    const chips = within(container.querySelector<HTMLElement>("[data-filter-chips]")!);
    expect(chips.getByRole("link", { name: "Remove filter: Men" }).getAttribute("href")).toBe("/products?tag=summer");
    expect(chips.getByRole("link", { name: "Remove filter: summer" }).getAttribute("href")).toBe("/products?collection=men");
    expect(chips.getByRole("link", { name: "Clear all" }).getAttribute("href")).toBe("/products");
  });

  it("puts the sort in the column and keeps the select for a phone only", async () => {
    await openPage({ collection: "men" });
    const column = screen.getByRole("complementary", { name: "Filters" });
    expect(within(column).getByRole("group", { name: "Sort by" })).toBeTruthy();
    expect(within(column).getAllByRole("radio").length).toBeGreaterThan(0);
    expect(screen.getByRole("combobox", { name: "Sort by" }).closest(".lg\\:hidden")).not.toBeNull();
    // One "clear all" at the head of the column, in place of the button under it.
    expect(within(column).getByRole("link", { name: "Clear all" }).getAttribute("href")).toBe("/products");
    expect(within(column).queryByRole("link", { name: "Clear all filters" })).toBeNull();
  });

  it("opens the phone's filters as a bottom sheet that waits for Apply", async () => {
    await openPage({ collection: "men" });
    fireEvent.click(screen.getByRole("button", { name: "Filter (1)" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("data-filter-sheet")).toBe("bottom");
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /summer/ }));
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Apply" }));
    expect(push.mock.calls[0][0]).toBe("/products?collection=men&tag=summer");
  });

  it("keeps the filters on every page link", async () => {
    await openPage({ collection: "men", tag: "summer", page: "2" });
    const pages = screen.getByRole("navigation", { name: "Pages" });
    expect(within(pages).getByRole("link", { name: "Page 3" }).getAttribute("href")).toBe("/products?collection=men&tag=summer&page=3");
    expect(within(pages).getByRole("link", { name: "Page 1" }).getAttribute("href")).toBe("/products?collection=men&tag=summer");
  });

  it("offers no stock filter: the API has none to ask for", async () => {
    await openPage({ collection: "men" });
    expect(screen.queryByText(/in stock|available/i)).toBeNull();
  });

  it("stays out of the way of a store that switched its filter column off", async () => {
    store.catalog = { ...DEFAULT_CATALOG_SETTINGS, sidebar_enabled: false };
    const { container } = await openPage({ collection: "men", tag: "summer" });
    expect(searchStorefrontProducts.mock.calls[0][1].facets).toBe(false);
    expect(container.querySelector("[data-filter-chips]")).toBeNull();
    expect(screen.queryByRole("complementary", { name: "Filters" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Filter/ })).toBeNull();
    // The sort is the header's select at every width, as before.
    expect(screen.getByRole("combobox", { name: "Sort by" }).closest(".lg\\:hidden")).toBeNull();
  });
});
