import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  NO_FILTERS,
  activeFilterChips,
  activeFilterCount,
  catalogHref,
  readCatalogState,
  sameListing,
  sortChoices,
  toListingParams,
  toggleOption,
} from "./catalogQuery.ts";

describe("catalog URL state", () => {
  it("reads every filter from the query string", () => {
    const state = readCatalogState({
      q: "  linen   shirt ",
      collection: "men",
      tag: ["summer", "summer", "linen"],
      min: "100",
      max: "450.5",
      "option[Size]": ["M", "L"],
      "option[Color]": "Blue",
      sort: "price_asc",
      page: "2",
    });
    assert.deepEqual(state, {
      q: "linen shirt",
      collection: "men",
      tags: ["summer", "linen"],
      min: 100,
      max: 450.5,
      options: { Size: ["M", "L"], Color: ["Blue"] },
      sort: "price_asc",
      page: 2,
    });
  });

  it("ignores what it cannot use", () => {
    const state = readCatalogState({ sort: "random", page: "-3", min: "abc", "option[]": "x" });
    assert.equal(state.sort, null);
    assert.equal(state.page, 1);
    assert.equal(state.min, null);
    assert.deepEqual(state.options, {});
  });

  it("writes a link that changes one thing and starts again from page 1", () => {
    const state = readCatalogState({ collection: "men", page: "3", "option[Size]": "M" });
    assert.equal(catalogHref(state, { tags: ["summer"] }), "/products?collection=men&tag=summer&option%5BSize%5D=M");
    assert.equal(catalogHref(state, { page: 4 }), "/products?collection=men&option%5BSize%5D=M&page=4");
    assert.equal(catalogHref(readCatalogState({})), "/products");
  });

  it("toggles option values and counts the filters", () => {
    let options = toggleOption({}, "Size", "M");
    options = toggleOption(options, "Size", "L");
    assert.deepEqual(options, { Size: ["M", "L"] });
    assert.deepEqual(toggleOption(options, "Size", "M"), { Size: ["L"] });
    assert.deepEqual(toggleOption({ Size: ["M"] }, "Size", "M"), {});
    assert.equal(activeFilterCount(readCatalogState({ collection: "x", tag: ["a", "b"], min: "1", "option[S]": ["M", "L"] })), 6);
  });

  it("asks the API in minor units, best match first while searching", () => {
    const state = readCatalogState({ q: "mug", min: "10", max: "20.5" });
    assert.deepEqual(toListingParams(state, "newest"), {
      search: "mug",
      minPrice: 1000,
      maxPrice: 2050,
      sort: "relevance",
      page: 1,
    });
    assert.equal(toListingParams(readCatalogState({}), "price_desc").sort, "price_desc");
  });
});

describe("the filters in use, as chips", () => {
  const state = readCatalogState({
    q: "shirt",
    collection: "men",
    tag: ["summer", "linen"],
    min: "100",
    max: "450",
    "option[Size]": ["M", "L"],
    sort: "price_asc",
    page: "3",
  });

  it("is one chip per filter, as many as the filter count says", () => {
    const chips = activeFilterChips(state);
    assert.equal(chips.length, activeFilterCount(state));
    assert.deepEqual(
      chips.map((c) => [c.kind, c.name ?? null, c.value]),
      [
        ["collection", null, "men"],
        ["tag", null, "summer"],
        ["tag", null, "linen"],
        ["price", null, ""],
        ["option", "Size", "M"],
        ["option", "Size", "L"],
      ]
    );
    assert.equal(new Set(chips.map((c) => c.key)).size, chips.length);
    assert.deepEqual(activeFilterChips(readCatalogState({ q: "shirt", sort: "name", page: "2" })), []);
  });

  it("links each chip to the list without that one filter, back on page 1", () => {
    const rest = "option%5BSize%5D=M&option%5BSize%5D=L&sort=price_asc";
    const href = Object.fromEntries(activeFilterChips(state).map((c) => [c.key, c.href]));
    assert.equal(href.collection, `/products?q=shirt&tag=summer&tag=linen&min=100&max=450&${rest}`);
    assert.equal(href["tag:summer"], `/products?q=shirt&collection=men&tag=linen&min=100&max=450&${rest}`);
    assert.equal(href.price, `/products?q=shirt&collection=men&tag=summer&tag=linen&${rest}`);
    assert.equal(
      href["option:Size:M"],
      "/products?q=shirt&collection=men&tag=summer&tag=linen&min=100&max=450&option%5BSize%5D=L&sort=price_asc"
    );
    // The last value of an option takes the option with it.
    const one = readCatalogState({ "option[Size]": "M", min: "5" });
    assert.equal(activeFilterChips(one).find((c) => c.kind === "option").href, "/products?min=5");
    // Half a range is still one chip.
    assert.equal(activeFilterChips(one).find((c) => c.kind === "price").href, "/products?option%5BSize%5D=M");
  });

  it("clears every filter at once, keeping the search and the sort", () => {
    assert.equal(catalogHref(state, NO_FILTERS), "/products?q=shirt&sort=price_asc");
    assert.equal(activeFilterCount({ ...state, ...NO_FILTERS }), 0);
    assert.equal(catalogHref(readCatalogState({ collection: "men", page: "4" }), NO_FILTERS), "/products");
  });

  it("offers best match only while searching and the store's own order only in a collection", () => {
    assert.deepEqual(sortChoices(readCatalogState({})), ["newest", "price_asc", "price_desc", "name"]);
    assert.deepEqual(sortChoices(readCatalogState({ q: "mug" })), ["relevance", "newest", "price_asc", "price_desc", "name"]);
    assert.deepEqual(sortChoices(readCatalogState({ collection: "men" })), ["newest", "price_asc", "price_desc", "name", "position"]);
  });

  it("tells whether two states ask for the same list, whatever page each is on", () => {
    assert.equal(sameListing(state, { ...state, page: 1 }), true);
    assert.equal(sameListing(state, { ...state, tags: ["summer"] }), false);
    assert.equal(sameListing(state, { ...state, sort: null }), false);
  });
});
