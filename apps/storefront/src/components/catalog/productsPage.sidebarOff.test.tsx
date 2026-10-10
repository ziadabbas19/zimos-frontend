import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { DEFAULT_CATALOG_SETTINGS } from "@store-builder/api-client";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";

/*
 * The products page with the side columns switched off, which is how every
 * store runs unless NEXT_PUBLIC_STORE_SIDEBAR_ENABLED is "true": the listing
 * a store had before the switch existed. lib/features is the real module here.
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

const searchStorefrontProducts = vi.hoisted(() => vi.fn());
vi.mock("@/lib/storeMeta", () => ({
  getStoreMeta: async () => ({ id: "shop", name: "Shop", slug: "shop", currency: "EGP", themeSettings: {}, catalog: DEFAULT_CATALOG_SETTINGS }),
  getStoreCollections: async () => COLLECTIONS,
}));
vi.mock("@/lib/storeLocale", () => ({ getStoreLocale: async () => "en" }));
vi.mock("@/lib/serverApiClient", () => ({ createServerStorefrontApiClient: async () => ({ searchStorefrontProducts }) }));

import ProductsPage from "@/app/store/[workspaceId]/products/page";
import { STORE_SIDEBAR_ENABLED } from "@/lib/features";

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
  searchStorefrontProducts.mockReset();
  searchStorefrontProducts.mockImplementation(async (_ws: string, params: { page?: number }) => ({
    products: [],
    nextCursor: null,
    page: params.page ?? 1,
    pageSize: 24,
    total: 60,
    hasMore: true,
    sort: "newest",
    collection: { ...COLLECTIONS[0], imageUrl: null },
    breadcrumbs: [{ id: "c1", name: "Men", slug: "men" }],
    facets: FACETS,
  }));
});
afterEach(() => {
  cleanup();
});

describe("the products page with the side columns off", () => {
  it("is off unless the build says otherwise", () => {
    expect(STORE_SIDEBAR_ENABLED).toBe(false);
  });

  it("draws no chips over the grid and no sort in the column", async () => {
    const { container } = await openPage({ collection: "men", tag: "summer" });
    expect(container.querySelector("[data-filter-chips]")).toBeNull();
    expect(screen.queryByRole("link", { name: /Remove filter/ })).toBeNull();
    const column = screen.getByRole("complementary", { name: "Filters" });
    expect(within(column).queryAllByRole("radio")).toHaveLength(0);
    // The one way to clear is the button under the column, as before.
    expect(within(column).getByRole("link", { name: "Clear all filters" }).getAttribute("href")).toBe("/products");
    expect(within(column).queryByRole("link", { name: "Clear all" })).toBeNull();
  });

  it("keeps the sort as the header's select at every width", async () => {
    await openPage({ collection: "men" });
    expect(screen.getByRole("combobox", { name: "Sort by" }).closest(".lg\\:hidden")).toBeNull();
  });

  it("opens the phone's filters as the side sheet, where a choice applies at once", async () => {
    await openPage({ collection: "men" });
    fireEvent.click(screen.getByRole("button", { name: "Filter (1)" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("data-filter-sheet")).toBeNull();
    expect(dialog.className).toContain("inset-y-0");
    expect(within(dialog).getByRole("button", { name: "Show 60 products" })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /summer/ }));
    expect(push.mock.calls[0][0]).toBe("/products?collection=men&tag=summer");
  });
});
