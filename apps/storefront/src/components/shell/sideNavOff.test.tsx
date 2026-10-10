import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import type { StorefrontCollection, StorefrontMeta } from "@store-builder/api-client";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";
import { StoreShellProvider } from "@/lib/StoreShellContext";

/*
 * The side navigation with its build switch off, which is how every store
 * runs unless NEXT_PUBLIC_STORE_SIDEBAR_ENABLED is "true". lib/features is the
 * real module here: a store that saved the side layout must look exactly like
 * one that never did.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/products",
  useParams: () => ({ workspaceId: "shop" }),
  useSelectedLayoutSegment: () => "products",
}));
vi.mock("@/lib/CartProvider", () => ({ useCart: () => ({ itemCount: 2, openDrawer: vi.fn() }) }));

import { StoreHeader } from "@/components/StoreHeader";
import { STORE_SIDEBAR_ENABLED } from "@/lib/features";
import { hasSideNav } from "@/lib/storeNav";
import { StoreNavFrame } from "./StoreNavFrame";

const INFO = { workspaceId: "shop", id: "shop", slug: "shop", name: "Shop", currency: "EGP", logoUrl: null, phone: null, checkout: {}, orderBump: null } as unknown as StoreInfo;
const COLLECTIONS: StorefrontCollection[] = [{ id: "c1", name: "Men", slug: "men", description: null, seo: null, parentId: null }];

function aStore(header: Record<string, unknown>): StorefrontMeta {
  return {
    id: "shop",
    name: "Shop",
    slug: "shop",
    logoUrl: null,
    tagline: null,
    currency: "EGP",
    themeSettings: { header },
    navPages: [{ path: "/about", title: "About us", showInHeader: true, showInFooter: false }],
    headerCollections: [{ id: "c1", name: "Men", slug: "men" }],
  } as unknown as StorefrontMeta;
}
const saved = { menu: [{ label: "Shop", href: "/products" }], announcement: { enabled: true, text: "Free delivery this week" } };
const OLD = aStore(saved);
const CHOSE_SIDE = aStore({ ...saved, layout: "side" });

function show(ui: ReactElement) {
  return render(
    <StoreContextProvider locale="en" store={INFO}>
      <StoreShellProvider>{ui}</StoreShellProvider>
    </StoreContextProvider>
  );
}

/** React's generated ids differ from one render to the next; everything else must not. */
const html = (el: Element) => el.innerHTML.replace(/(_r_[a-z0-9]+_|:r[a-z0-9]+:|«r[a-z0-9]+»)/gi, "ID");

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
afterEach(() => {
  cleanup();
});

describe("the side navigation with its switch off", () => {
  it("is off unless the build says otherwise, whatever a store saved", () => {
    expect(STORE_SIDEBAR_ENABLED).toBe(false);
    expect(hasSideNav({ layout: "side" })).toBe(false);
  });

  it("adds not one element around the store's pages", () => {
    const { container } = show(
      <StoreNavFrame store={CHOSE_SIDE} locale="en" collections={COLLECTIONS}>
        <p data-testid="page">page</p>
      </StoreNavFrame>
    );
    expect(container.innerHTML).toBe('<p data-testid="page">page</p>');
    expect(container.querySelector("[data-store-sidenav]")).toBeNull();
  });

  it("draws the same header for a store that saved the side layout as for one that never did", () => {
    const before = show(<StoreHeader store={OLD} locale="en" />);
    const old = html(before.container);
    before.unmount();
    const after = show(<StoreHeader store={CHOSE_SIDE} locale="en" />);
    expect(html(after.container)).toBe(old);
    expect(old).not.toContain("xl:hidden");
    expect(old).toContain("Free delivery this week");
  });
});
