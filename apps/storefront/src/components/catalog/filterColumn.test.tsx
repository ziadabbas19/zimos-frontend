import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { DEFAULT_CATALOG_SETTINGS, type StorefrontCollection, type StorefrontFacets } from "@store-builder/api-client";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";
import { readCatalogState } from "@/lib/catalogQuery";
import { getDictionary, type Locale } from "@/lib/i18n";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/products",
  useParams: () => ({ workspaceId: "shop" }),
  useSelectedLayoutSegment: () => "products",
}));

import { ActiveFilterChips } from "./ActiveFilterChips";
import { CatalogFilters } from "./CatalogFilters";
import { FilterSheet } from "./FilterSheet";

const STORE = { workspaceId: "shop", id: "shop", slug: "shop", name: "Shop", currency: "EGP", logoUrl: null, phone: null, checkout: {}, orderBump: null } as unknown as StoreInfo;

const collection = (id: string, name: string, slug: string): StorefrontCollection => ({ id, name, slug, description: null, seo: null, parentId: null });
const COLLECTIONS = [collection("c1", "Men", "men"), collection("c2", "Women", "women")];

const FACETS: StorefrontFacets = {
  collections: [
    { id: "c1", name: "Men", slug: "men", parentId: null, count: 4 },
    { id: "c2", name: "Women", slug: "women", parentId: null, count: 3 },
  ],
  tags: [
    { value: "summer", count: 3 },
    { value: "linen", count: 2 },
  ],
  options: [{ name: "Size", values: [{ value: "M", count: 2 }, { value: "L", count: 1 }] }],
  price: { min: 5000, max: 45000 },
};
const FILTERS = DEFAULT_CATALOG_SETTINGS.filters;

function show(ui: ReactElement, locale: Locale = "en") {
  return render(
    <StoreContextProvider locale={locale} store={STORE}>
      {ui}
    </StoreContextProvider>
  );
}

const checkbox = (name: string | RegExp, root: HTMLElement = document.body) =>
  within(root).getByRole("checkbox", { name }) as HTMLInputElement;

beforeEach(() => {
  push.mockClear();
});
afterEach(() => {
  cleanup();
});

describe("the filter column", () => {
  const url = { collection: "men", tag: "summer", "option[Size]": "M", min: "100", max: "450", page: "3" };

  it("shows the filter state the URL holds", () => {
    show(<CatalogFilters state={readCatalogState(url)} filters={FILTERS} facets={FACETS} collections={COLLECTIONS} idPrefix="side" />);
    expect(screen.getByRole("link", { name: /Men/ }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: /Women/ }).getAttribute("aria-current")).toBeNull();
    expect(checkbox(/summer/).checked).toBe(true);
    expect(checkbox(/linen/).checked).toBe(false);
    expect(checkbox(/^M/).checked).toBe(true);
    expect(checkbox(/^L/).checked).toBe(false);
    expect((screen.getByLabelText("From") as HTMLInputElement).value).toBe("100");
    expect((screen.getByLabelText("To") as HTMLInputElement).value).toBe("450");
  });

  it("puts a choice straight into the URL, back on page 1, keeping the others", () => {
    show(<CatalogFilters state={readCatalogState(url)} filters={FILTERS} facets={FACETS} collections={COLLECTIONS} idPrefix="side" />);
    fireEvent.click(checkbox(/linen/));
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0][0]).toBe("/products?collection=men&tag=summer&tag=linen&min=100&max=450&option%5BSize%5D=M");
    // A collection is a link to its own URL, with the other filters kept.
    expect(screen.getByRole("link", { name: /Women/ }).getAttribute("href")).toBe(
      "/products?collection=women&tag=summer&min=100&max=450&option%5BSize%5D=M"
    );
  });

  it("has no sort of its own unless asked for one", () => {
    show(<CatalogFilters state={readCatalogState(url)} filters={FILTERS} facets={FACETS} collections={COLLECTIONS} idPrefix="side" />);
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  it("lists the sorts as its first block when asked, and a choice goes into the URL", () => {
    show(
      <CatalogFilters
        state={readCatalogState(url)}
        filters={FILTERS}
        facets={FACETS}
        collections={COLLECTIONS}
        idPrefix="side"
        sort={{ current: "newest" }}
      />
    );
    const group = screen.getByRole("group", { name: "Sort by" });
    // Inside a collection: no "best match" (nothing is searched), and the store's own order is offered.
    expect(within(group).getAllByRole("radio").map((r) => r.parentElement?.textContent)).toEqual([
      "Newest",
      "Price: low to high",
      "Price: high to low",
      "Name",
      "Featured",
    ]);
    expect((within(group).getByRole("radio", { name: "Newest" }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(within(group).getByRole("radio", { name: "Price: low to high" }));
    expect(push.mock.calls[0][0]).toBe("/products?collection=men&tag=summer&min=100&max=450&option%5BSize%5D=M&sort=price_asc");
  });
});

describe("the filters in use, as chips over the grid", () => {
  const state = readCatalogState({ q: "shirt", collection: "men", tag: "summer", min: "100", max: "450", "option[Size]": "M", sort: "price_asc", page: "2" });

  it("names each filter and links it to the list without it", () => {
    show(<ActiveFilterChips t={getDictionary("en")} state={state} collections={COLLECTIONS} />);
    const list = screen.getByRole("list", { name: "Filters in use" });
    const chips = within(list).getAllByRole("link");
    expect(chips.map((c) => c.textContent)).toEqual(["Men", "summer", "100 – 450", "Size: M", "Clear all"]);
    expect(within(list).getByRole("link", { name: "Remove filter: Men" }).getAttribute("href")).toBe(
      "/products?q=shirt&tag=summer&min=100&max=450&option%5BSize%5D=M&sort=price_asc"
    );
    expect(within(list).getByRole("link", { name: "Remove filter: 100 – 450" }).getAttribute("href")).toBe(
      "/products?q=shirt&collection=men&tag=summer&option%5BSize%5D=M&sort=price_asc"
    );
    expect(within(list).getByRole("link", { name: "Remove filter: Size: M" }).getAttribute("href")).toBe(
      "/products?q=shirt&collection=men&tag=summer&min=100&max=450&sort=price_asc"
    );
  });

  it("clears every filter with one link that keeps the search and the sort", () => {
    show(<ActiveFilterChips t={getDictionary("en")} state={state} collections={COLLECTIONS} />);
    expect(screen.getByRole("link", { name: "Clear all" }).getAttribute("href")).toBe("/products?q=shirt&sort=price_asc");
  });

  it("draws nothing while no filter is set", () => {
    const { container } = show(
      <ActiveFilterChips t={getDictionary("en")} state={readCatalogState({ q: "shirt", sort: "name", page: "2" })} collections={COLLECTIONS} />
    );
    expect(container.querySelector("[data-filter-chips]")).toBeNull();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("names a collection the store no longer lists by what the URL says, and half a range as it is", () => {
    show(
      <ActiveFilterChips t={getDictionary("en")} state={readCatalogState({ collection: "old-one", max: "90" })} collections={COLLECTIONS} />
    );
    expect(screen.getByRole("link", { name: "Remove filter: old-one" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Remove filter: Up to 90" })).toBeTruthy();
  });

  it("speaks to the shopper in Egyptian Arabic", () => {
    show(<ActiveFilterChips t={getDictionary("ar")} state={state} collections={COLLECTIONS} />, "ar");
    expect(screen.getByRole("list", { name: "الفلاتر اللي اخترتها" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "شيل الفلتر: من ١٠٠ لحد ٤٥٠" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "امسح الكل" })).toBeTruthy();
  });
});

describe("the filter sheet on a phone", () => {
  const sheet = (query: Record<string, string | string[]>, locale: Locale = "en") =>
    show(<FilterSheet state={readCatalogState(query)} filters={FILTERS} facets={FACETS} collections={COLLECTIONS} />, locale);
  const open = () => {
    fireEvent.click(screen.getByRole("button", { name: /^Filter/ }));
    return screen.getByRole("dialog");
  };

  it("rises from the bottom from the Filter button, with an Apply button", () => {
    sheet({ collection: "men", tag: "summer" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Filter (2)" })).toBeTruthy();
    const dialog = open();
    expect(dialog.getAttribute("data-filter-sheet")).toBe("bottom");
    expect(dialog.className).toContain("bottom-0");
    expect(within(dialog).getByRole("button", { name: "Apply" })).toBeTruthy();
    // It opens on what the URL holds.
    expect(within(dialog).getByRole("button", { name: /Men/ }).getAttribute("aria-pressed")).toBe("true");
    expect(checkbox(/summer/, dialog).checked).toBe(true);
    expect(within(dialog).getByText("2 filters chosen")).toBeTruthy();
  });

  it("keeps the choices to itself until Apply, then sends them all at once from page 1", () => {
    sheet({ collection: "men", tag: "summer", page: "2" });
    const dialog = open();
    fireEvent.click(checkbox(/linen/, dialog));
    fireEvent.click(checkbox(/^L/, dialog));
    fireEvent.click(within(dialog).getByRole("button", { name: /Women/ }));
    fireEvent.change(within(dialog).getByLabelText("To"), { target: { value: "300" } });
    expect(checkbox(/linen/, dialog).checked).toBe(true);
    expect(within(dialog).getByText("5 filters chosen")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Apply" }));
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0][0]).toBe("/products?collection=women&tag=summer&tag=linen&max=300&option%5BSize%5D=L");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("drops the draft when it is closed any other way", () => {
    sheet({ tag: "summer" });
    let dialog = open();
    fireEvent.click(checkbox(/linen/, dialog));
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();

    dialog = open();
    expect(checkbox(/linen/, dialog).checked).toBe(false);
    expect(checkbox(/summer/, dialog).checked).toBe(true);
  });

  it("clears every filter inside the sheet, and that waits for Apply too", () => {
    sheet({ q: "shirt", collection: "men", tag: "summer", min: "100", "option[Size]": "M", sort: "price_asc", page: "4" });
    const dialog = open();
    fireEvent.click(within(dialog).getByRole("button", { name: "Clear all" }));
    expect(push).not.toHaveBeenCalled();
    expect(checkbox(/summer/, dialog).checked).toBe(false);
    expect(checkbox(/^M/, dialog).checked).toBe(false);
    expect((within(dialog).getByLabelText("From") as HTMLInputElement).value).toBe("");
    expect(within(dialog).getByText("Nothing chosen yet")).toBeTruthy();
    // Nothing left to clear.
    expect(within(dialog).queryByRole("button", { name: "Clear all" })).toBeNull();

    fireEvent.click(within(dialog).getByRole("button", { name: "Apply" }));
    expect(push.mock.calls[0][0]).toBe("/products?q=shirt&sort=price_asc");
  });

  it("goes nowhere when Apply is pressed with nothing changed: the shopper keeps their page", () => {
    sheet({ collection: "men", page: "3" });
    const dialog = open();
    fireEvent.click(checkbox(/linen/, dialog));
    fireEvent.click(checkbox(/linen/, dialog));
    fireEvent.click(within(dialog).getByRole("button", { name: "Apply" }));
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("reads a price range typed the wrong way round the right way round", () => {
    sheet({});
    const dialog = open();
    fireEvent.change(within(dialog).getByLabelText("From"), { target: { value: "500" } });
    fireEvent.change(within(dialog).getByLabelText("To"), { target: { value: "100" } });
    // The range has no button of its own in the sheet: Apply covers it.
    expect(within(dialog).getAllByRole("button", { name: "Apply" })).toHaveLength(1);
    fireEvent.click(within(dialog).getByRole("button", { name: "Apply" }));
    expect(push.mock.calls[0][0]).toBe("/products?min=100&max=500");
  });

  it("speaks to the shopper in Egyptian Arabic", () => {
    sheet({ tag: "summer" }, "ar");
    fireEvent.click(screen.getByRole("button", { name: "فلترة (١)" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "طبّق" })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "امسح الكل" })).toBeTruthy();
    expect(within(dialog).getByText("فلتر واحد مختار")).toBeTruthy();
  });
});
