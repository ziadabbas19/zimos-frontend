import { afterEach, describe, expect, it, vi } from "vitest";
import { LOST_ORDER_TABS } from "@store-builder/api-client";
import appSource from "../../App.tsx?raw";

type SiteIndex = typeof import("./siteIndex");

/** Every address App.tsx has a page for. */
const ROUTES = Array.from(appSource.matchAll(/path="([^"]+)"/g), (match) => match[1]);

/** The screens' sources, where the settings carry their marks (`data-search-anchor`). */
const SOURCES = import.meta.glob<string>(["/src/**/*.tsx", "!/src/**/*.test.tsx"], { query: "?raw", import: "default", eager: true });

/** The pages that read a `?tab=` of their own, and the file that reads it. */
const TAB_PAGES: Record<string, string> = {
  "/subscription": "/src/pages/subscription/SubscriptionPage.tsx",
  "/customers": "/src/pages/customers/ContactsPage.tsx",
  "/fraud": "/src/pages/fraud/FraudPage.tsx",
  "/analytics": "/src/pages/analytics/reports/ReportsPage.tsx",
  "/analytics/visitors": "/src/pages/analytics/visitors/VisitorsPage.tsx",
  "/settlements": "/src/pages/settlements/SettlementsPage.tsx",
};

/**
 * The index as the switches build it: every `*_ENABLED` switch of
 * lib/features set to `on`, so each entry behind a switch is in it.
 */
async function indexWith(on: boolean): Promise<SiteIndex> {
  vi.resetModules();
  vi.doMock("@/lib/features", async (original) => {
    const real = await original<Record<string, unknown>>();
    return Object.fromEntries(Object.entries(real).map(([key, value]) => [key, key.endsWith("_ENABLED") ? on : value]));
  });
  return import("./siteIndex");
}

function pathOf(to: string): string {
  return to.split("?")[0];
}

function tabOf(to: string): string | null {
  return new URLSearchParams(to.split("?")[1] ?? "").get("tab");
}

/** The route of App.tsx an address lands on (`:id` takes one part, `:id?` one or none). */
function routeFor(path: string): string | undefined {
  return ROUTES.find((route) => {
    if (route === "*") return false;
    const pattern = route
      .replace(/[.*+^${}()|[\]\\]/g, "\\$&")
      .replace(/\/:[A-Za-z]+\?/g, "(?:/[^/]+)?")
      .replace(/:[A-Za-z]+/g, "[^/]+");
    return new RegExp(`^${pattern}$`).test(path);
  });
}

afterEach(() => {
  vi.doUnmock("@/lib/features");
});

describe("the search index", () => {
  it("has an entry for every page of the side menu", async () => {
    const index = await indexWith(true);
    const { NAV_ITEMS } = await import("@/lib/navigation");
    const missing = NAV_ITEMS.filter((item) => !index.findEntry(index.pageId(item.to))).map((item) => item.to);
    expect(NAV_ITEMS.length).toBeGreaterThan(30);
    expect(missing).toEqual([]);
  });

  it("offers every route of App.tsx, or says why not", async () => {
    const index = await indexWith(true);
    const reachable = new Set(index.SEARCH_INDEX.map((entry) => pathOf(entry.to)));
    // A route with a parameter is a record (an order, a product): the record search finds those.
    const pages = ROUTES.filter((route) => route !== "*" && !route.includes(":"));
    expect(pages).toContain("/orders/board");
    const unlisted = pages.filter((route) => !reachable.has(route) && !index.ROUTES_NOT_IN_SEARCH.has(route));
    expect(unlisted).toEqual([]);
  });

  it("opens only addresses App.tsx has a page for", async () => {
    const index = await indexWith(true);
    const broken = index.SEARCH_INDEX.filter((entry) => !routeFor(pathOf(entry.to))).map((entry) => entry.to);
    expect(broken).toEqual([]);
    // What is excluded is a real route, not a stale name.
    for (const route of index.ROUTES_NOT_IN_SEARCH.keys()) expect(ROUTES).toContain(route);
  });

  it("opens only tabs and sections the page reads", async () => {
    const index = await indexWith(true);
    const { SETTINGS_SECTIONS } = await import("@/pages/settings/settingsSections");
    const { ALL_STORE_SETTINGS_TABS } = await import("@/pages/storeDesign/storeSettingsSections");
    const { SHIPPING_TABS } = await import("@/pages/shipping/ShippingTabs");
    const { PAYMENT_SECTIONS } = await import("@/pages/payments/paymentSections");
    const known: Record<string, readonly string[]> = {
      "/settings": SETTINGS_SECTIONS.map((section) => section.id),
      "/shipping": SHIPPING_TABS,
      "/payments": PAYMENT_SECTIONS.map((section) => section.id),
      "/abandoned-carts": LOST_ORDER_TABS,
    };
    const wrong: string[] = [];
    for (const entry of index.SEARCH_INDEX) {
      const path = pathOf(entry.to);
      if (path.startsWith("/store-settings/")) {
        if (!(ALL_STORE_SETTINGS_TABS as readonly string[]).includes(path.slice("/store-settings/".length))) wrong.push(entry.to);
        continue;
      }
      const tab = tabOf(entry.to);
      if (tab === null) continue;
      if (known[path]) {
        if (!known[path].includes(tab)) wrong.push(entry.to);
      } else if (!TAB_PAGES[path] || !SOURCES[TAB_PAGES[path]]?.includes(`"${tab}"`)) {
        // A new page with tabs: name the file that reads its ?tab= in TAB_PAGES.
        wrong.push(entry.to);
      }
    }
    expect(wrong).toEqual([]);
  });

  it("marks every single setting on its page", async () => {
    const index = await indexWith(true);
    const sources = Object.values(SOURCES);
    const unmarked = index.SEARCH_INDEX.filter((entry) => entry.anchor)
      .filter(({ anchor }) => {
        const mark = new RegExp(`(?:data-search-anchor|searchAnchor)=(?:"${anchor}"|\\{[^}]*"${anchor}")`);
        return !sources.some((source) => mark.test(source));
      })
      .map((entry) => entry.anchor);
    expect(index.SEARCH_INDEX.filter((entry) => entry.kind === "setting").length).toBeGreaterThan(30);
    expect(unmarked).toEqual([]);
  });

  it("has unique ids, both names, and places that exist", async () => {
    const index = await indexWith(true);
    const ids = index.SEARCH_INDEX.map((entry) => entry.id);
    expect(ids.length - new Set(ids).size).toBe(0);
    for (const entry of index.SEARCH_INDEX) {
      expect(entry.title.en, entry.id).toBeTruthy();
      expect(entry.title.ar, entry.id).toBeTruthy();
      if (entry.parent) expect(index.findEntry(entry.parent), entry.id).toBeDefined();
      // A single setting of a settings list sits under a section of the same list.
      if (entry.kind === "setting") expect(index.findEntry(entry.parent ?? "")?.scope, entry.id).toBe(entry.scope);
    }
  });

  it("puts a setting under its section and the menu heading of its page", async () => {
    const index = await indexWith(true);
    const token = index.findEntry("setting:whatsappToken");
    expect(token?.to).toBe("/settings?tab=whatsapp");
    expect(token?.anchor).toBe("whatsapp-token");
    expect(token?.trail.map((place) => place.en)).toEqual(["Settings", "WhatsApp connection"]);
    expect(token?.heading.en).toBe("Settings");
    const favicon = index.findEntry("setting:favicon");
    expect(favicon?.to).toBe("/store-settings/general");
    expect(favicon?.heading).toEqual({ en: "Online store", ar: "المتجر" });
  });
});

describe("what a build leaves out", () => {
  it("has nothing of a switched-off feature", async () => {
    const index = await indexWith(false);
    for (const id of ["action:new-blog-post", "page:/blog", "settings:holiday", "store-settings:domains", "setting:connectDomain", "setting:twoStep", "tab:/customers?tab=suppressed", "page:/analytics/reports"]) {
      expect(index.findEntry(id), id).toBeUndefined();
    }
    // Always there.
    expect(index.findEntry("settings:security")?.description?.en).toBe("Password and signed-in devices");
  });

  it("has each of them with its switch on", async () => {
    const index = await indexWith(true);
    for (const id of ["action:new-blog-post", "page:/blog", "settings:holiday", "store-settings:domains", "setting:connectDomain", "setting:twoStep", "tab:/customers?tab=suppressed", "page:/analytics/reports"]) {
      expect(index.findEntry(id), id).toBeDefined();
    }
  });
});

describe("who sees what", () => {
  it("hides from a role what the side menu and the settings hide from it", async () => {
    const index = await indexWith(true);
    const shown = (id: string, role: string) => index.isEntryShown(index.findEntry(id)!, role);

    // Analytics: hidden for an editor, with everything under it.
    expect(shown("page:/analytics", "editor")).toBe(false);
    expect(shown("tab:/analytics?tab=delivery", "editor")).toBe(false);
    expect(shown("page:/analytics/reports/tax", "editor")).toBe(false);
    expect(shown("tab:/analytics?tab=delivery", "owner")).toBe(true);

    // My Plan and its tabs: not for a store manager.
    expect(shown("tab:/subscription?tab=invoices", "workspace_manager")).toBe(false);
    expect(shown("tab:/subscription?tab=invoices", "accountant")).toBe(true);

    // Plan and billing in Settings: the owner and the accountant only.
    expect(shown("settings:billing", "editor")).toBe(false);
    expect(shown("settings:billing", "owner")).toBe(true);

    // Payments' sections: the owner and the store manager; the page itself stays, as in the menu.
    expect(shown("payments:gateways", "accountant")).toBe(false);
    expect(shown("payments:gateways", "workspace_manager")).toBe(true);
    expect(shown("page:/payments", "accountant")).toBe(true);
  });

  it("says which entries the plan holds back", async () => {
    const index = await indexWith(true);
    expect(index.findEntry("setting:inviteMember")?.plan).toEqual({ feature: "staff_accounts" });
    expect(index.findEntry("setting:connectDomain")?.plan).toEqual({ feature: "custom_domain" });
    expect(index.findEntry("page:/analytics/web")?.plan).toEqual({ feature: "advanced_analytics" });
    expect(index.findEntry("setting:hideBranding")?.plan).toEqual({ feature: "remove_branding", benefit: true });
    expect(index.findEntry("page:/orders")?.plan).toBeUndefined();
  });
});

describe("finding", () => {
  it("finds a setting by its name in either language, and ranks the closest first", async () => {
    const index = await indexWith(true);
    const ids = (query: string) => index.searchEntries(query, index.SEARCH_INDEX).map(({ entry }) => entry.id);
    expect(ids("favicon")[0]).toBe("setting:favicon");
    expect(ids("أيقونة التبويب")[0]).toBe("setting:favicon");
    expect(ids("whatsapp token")[0]).toBe("setting:whatsappToken");
    expect(ids("api key")).toContain("setting:apiKeys");
    expect(ids("اعدادات المتجر")[0]).toBe("page:/store-settings");
    expect(ids("store settings")[0]).toBe("page:/store-settings");
    expect(ids("shiping")).toContain("page:/shipping");
  });

  it("knows the entry an address is", async () => {
    const index = await indexWith(true);
    expect(index.entryForLocation("/settings", "?tab=whatsapp")?.id).toBe("settings:whatsapp");
    expect(index.entryForLocation("/store-settings/seo", "")?.id).toBe("store-settings:seo");
    expect(index.entryForLocation("/fraud", "?tab=blocklist&x=1")?.id).toBe("tab:/fraud?tab=blocklist");
    expect(index.entryForLocation("/orders/ord_1", "")?.id).toBe("page:/orders");
    expect(index.entryForLocation("/settings", "")?.id).toBe("page:/settings");
  });
});
