import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect, type ReactElement } from "react";
import type { StorefrontCollection, StorefrontMeta } from "@store-builder/api-client";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";
import { StoreShellProvider, useSetShellOverride } from "@/lib/StoreShellContext";
import type { Locale } from "@/lib/i18n";

/*
 * The store-wide side navigation with its build switch on (lib/features
 * STORE_SIDEBAR_ENABLED). sideNavOff.test.tsx is the switch off: every store
 * on the top bar, whatever it saved.
 */

const nav = vi.hoisted(() => ({ segment: "products" as string | null }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/products",
  useParams: () => ({ workspaceId: "shop" }),
  useSelectedLayoutSegment: () => nav.segment,
}));
vi.mock("@/lib/CartProvider", () => ({ useCart: () => ({ itemCount: 2, openDrawer: vi.fn() }) }));
vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  STORE_SIDEBAR_ENABLED: true,
}));

import { StoreHeader } from "@/components/StoreHeader";
import { hasSideNav } from "@/lib/storeNav";
import { StoreNavFrame } from "./StoreNavFrame";
import { StoreSideNav } from "./StoreSideNav";

const INFO = { workspaceId: "shop", id: "shop", slug: "shop", name: "Shop", currency: "EGP", logoUrl: null, phone: null, checkout: {}, orderBump: null } as unknown as StoreInfo;

const collection = (id: string, name: string, slug: string, parentId: string | null = null): StorefrontCollection => ({
  id,
  name,
  slug,
  description: null,
  seo: null,
  parentId,
});
const COLLECTIONS = [collection("c1", "Men", "men"), collection("c2", "Women", "women"), collection("c3", "Shirts", "shirts", "c1")];

function aStore(header: Record<string, unknown> | null, extra: Record<string, unknown> = {}): StorefrontMeta {
  return {
    id: "shop",
    name: "Shop",
    slug: "shop",
    logoUrl: null,
    tagline: null,
    currency: "EGP",
    themeSettings: header ? { header } : {},
    navPages: [{ path: "/about", title: "About us", showInHeader: true, showInFooter: false }],
    headerCollections: [{ id: "c1", name: "Men", slug: "men" }],
    ...extra,
  } as unknown as StorefrontMeta;
}
const TOP = aStore(null);
const SIDE = aStore({ layout: "side" });

function show(ui: ReactElement, locale: Locale = "en") {
  return render(
    <StoreContextProvider locale={locale} store={INFO}>
      <StoreShellProvider>{ui}</StoreShellProvider>
    </StoreContextProvider>
  );
}

const column = (root: ParentNode = document) => root.querySelector<HTMLElement>("[data-store-sidenav]");

// jsdom has no matchMedia; the light / dark switch in the header listens to it.
beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});
beforeEach(() => {
  nav.segment = "products";
});
afterEach(() => {
  cleanup();
});

describe("where the side navigation goes (StoreNavFrame)", () => {
  it("leaves a store on the top bar laid out as it was: no column, two boxes that take no part in the layout", () => {
    const { container } = show(
      <StoreNavFrame store={TOP} locale="en" collections={COLLECTIONS}>
        <p data-testid="page">page</p>
      </StoreNavFrame>
    );
    expect(hasSideNav({ layout: "top" })).toBe(false);
    expect(column(container)).toBeNull();
    expect(container.querySelector("[data-store-nav]")).toBeNull();
    const page = screen.getByTestId("page");
    expect(page.parentElement?.className).toBe("contents");
    expect(page.parentElement?.parentElement?.className).toBe("contents");
    expect(page.parentElement?.parentElement?.parentElement).toBe(container);
  });

  it("puts the column beside the page from xl for a store that chose it, and nothing on a phone", () => {
    const { container } = show(
      <StoreNavFrame store={SIDE} locale="en" collections={COLLECTIONS}>
        <p data-testid="page">page</p>
      </StoreNavFrame>
    );
    const frame = container.querySelector<HTMLElement>('[data-store-nav="side"]')!;
    // A column up to xl (the bar across the top, then the page), a row from there.
    expect(frame.className.split(" ")).toEqual(expect.arrayContaining(["flex", "flex-col", "xl:flex-row"]));
    const aside = column(container)!;
    expect(aside.parentElement).toBe(frame);
    // Not drawn below xl; from xl it stays in view beside the scrolling page.
    expect(aside.className.split(" ")).toEqual(expect.arrayContaining(["hidden", "xl:flex", "xl:sticky", "xl:top-0", "xl:h-dvh"]));
    // The page comes after it in the row and may shrink beside it.
    const page = screen.getByTestId("page");
    expect(aside.nextElementSibling).toBe(page.parentElement);
    expect(page.parentElement?.className.split(" ")).toEqual(expect.arrayContaining(["min-w-0", "flex-1"]));
  });

  it("keeps the column off a funnel page, as the header is", () => {
    nav.segment = "f";
    const { container } = show(
      <StoreNavFrame store={SIDE} locale="en" collections={COLLECTIONS}>
        <p data-testid="page">page</p>
      </StoreNavFrame>
    );
    expect(column(container)).toBeNull();
    expect(screen.getByTestId("page").parentElement?.className).toBe("contents");
  });

  it("follows the editor's unsaved choice without mounting the page again", () => {
    let mounts = 0;
    function Page() {
      useEffect(() => {
        mounts += 1;
      }, []);
      return <p data-testid="page">page</p>;
    }
    function Editor() {
      const setOverride = useSetShellOverride();
      return (
        <>
          <button type="button" onClick={() => setOverride({ header: { layout: "side" }, footer: null })}>
            side
          </button>
          <button type="button" onClick={() => setOverride({ header: {}, footer: null })}>
            top
          </button>
        </>
      );
    }
    const { container } = show(
      <>
        <Editor />
        <StoreNavFrame store={TOP} locale="en" collections={COLLECTIONS}>
          <Page />
        </StoreNavFrame>
      </>
    );
    expect(column(container)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "side" }));
    expect(column(container)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "top" }));
    expect(column(container)).toBeNull();
    expect(mounts).toBe(1);
  });
});

describe("the side navigation (StoreSideNav)", () => {
  it("holds the logo, the search, the menu, the categories, the cart and the switches", () => {
    show(<StoreSideNav store={SIDE} locale="en" collections={COLLECTIONS} />);
    const aside = screen.getByRole("complementary", { name: "Menu" });
    // The editor's preview selects it as the header; a product page that hides the header hides it too.
    expect(aside.getAttribute("data-zimos-shell")).toBe("header");

    const logo = aside.querySelector<HTMLAnchorElement>("[data-store-logo]")!;
    expect(logo.getAttribute("href")).toBe("/");
    expect(logo.textContent).toContain("Shop");
    expect(within(aside).getByRole("combobox", { name: "Search products" })).toBeTruthy();

    const menu = within(aside).getByRole("navigation", { name: "Menu" });
    expect(within(menu).getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Home", "/"],
      ["About us", "/about"],
      ["Track order", "/track"],
    ]);

    const categories = within(aside).getByRole("navigation", { name: "Collections" });
    expect(within(categories).getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["All products", "/products"],
      ["Men", "/products?collection=men"],
      ["Shirts", "/products?collection=shirts"],
      ["Women", "/products?collection=women"],
    ]);
    // "Men" is flagged "show in header": it is in the tree once, not in the menu as well.
    expect(within(aside).getAllByRole("link", { name: "Men" })).toHaveLength(1);

    expect(within(aside).getByRole("link", { name: "Cart — 2 items" }).getAttribute("href")).toBe("/cart");
    expect(within(aside).getByRole("button", { name: /Arabic|العربية|عربي/i })).toBeTruthy();
    expect(within(aside).getAllByRole("button").length).toBeGreaterThanOrEqual(3);
  });

  it("obeys the header's own switches", () => {
    show(
      <StoreSideNav
        store={aStore({ layout: "side", show: { cart: false, language: false, theme: false, trackOrder: false } })}
        locale="en"
        collections={COLLECTIONS}
      />
    );
    const aside = screen.getByRole("complementary", { name: "Menu" });
    expect(within(aside).queryByRole("link", { name: /Cart/ })).toBeNull();
    expect(within(aside).queryByRole("link", { name: "Track order" })).toBeNull();
    // What is left is the search's own button.
    expect(within(aside).getAllByRole("button")).toHaveLength(1);
  });

  it("draws the merchant's own menu, with the list under a link that has one", () => {
    const store = aStore(
      { layout: "side", menu: [{ label: "Shop", href: "/products", children: [{ label: "Sale", href: "/products?tag=sale" }] }, { label: "", href: "/" }] },
      { navPages: [], headerCollections: [] }
    );
    show(<StoreSideNav store={store} locale="en" collections={[]} />);
    const menu = screen.getByRole("navigation", { name: "Menu" });
    expect(within(menu).getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Shop", "/products"],
      ["Sale", "/products?tag=sale"],
      ["Home", "/"],
      ["Track order", "/track"],
    ]);
    // A store with no categories gets no empty block for them.
    expect(screen.queryByRole("navigation", { name: "Collections" })).toBeNull();
  });

  it("is written for right to left first, and speaks Arabic to an Arabic shopper", () => {
    show(<StoreSideNav store={SIDE} locale="ar" collections={COLLECTIONS} />, "ar");
    const aside = screen.getByRole("complementary", { name: "القائمة" });
    expect(within(aside).getByRole("navigation", { name: "الأقسام" })).toBeTruthy();
    expect(within(aside).getByRole("link", { name: "كل المنتجات" })).toBeTruthy();
    expect(within(aside).getByRole("link", { name: "تتبع الطلب" })).toBeTruthy();
    // Sides are named by the reading direction, never left or right.
    const classes = Array.from(aside.querySelectorAll<HTMLElement>("*"))
      .concat(aside)
      .flatMap((el) => (typeof el.className === "string" ? el.className.split(/\s+/) : []));
    expect(classes).toContain("border-e");
    expect(classes.filter((c) => /^(?:[a-z]+:)*(?:border-[lr](?:-|$)|rounded-[lr](?:-|$)|[mp][lr]-|left-|right-|text-left$|text-right$)/.test(c))).toEqual([]);
  });
});

describe("the top bar of a store with the side navigation", () => {
  const bar = (root: ParentNode) => root.querySelector<HTMLElement>('header[data-zimos-shell="header"]')!;

  it("stays as it was for a store on the top bar", () => {
    const { container } = show(<StoreHeader store={TOP} locale="en" />);
    expect(bar(container).outerHTML).not.toContain("xl:hidden");
  });

  it("steps aside from xl for the column, whole, when it has no announcement", () => {
    const { container } = show(<StoreHeader store={SIDE} locale="en" />);
    expect(bar(container).className.split(" ")).toContain("xl:hidden");
    // Below xl it is the bar every store has, with the menu sheet's button.
    expect(within(bar(container)).getByRole("button", { name: "Open menu" })).toBeTruthy();
  });

  it("keeps the announcement across the top from xl and hides only the bar's rows", () => {
    const store = aStore({ layout: "side", announcement: { enabled: true, text: "Free delivery this week" } });
    const { container } = show(<StoreHeader store={store} locale="en" />);
    const header = bar(container);
    expect(header.className.split(" ")).not.toContain("xl:hidden");
    expect(header.querySelector(".zt-header-bar")?.className.split(" ")).toContain("xl:hidden");
    expect(header.querySelector(".zt-brand-bar")?.className.split(" ")).toContain("xl:hidden");
    const line = within(header).getByText("Free delivery this week");
    expect(line.closest(".xl\\:hidden")).toBeNull();
  });
});
