import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { NAV_ITEMS, findNavItem, isNavItemVisible } from "@/lib/navigation";
import { SYSTEM_ROLES, SYSTEM_ROLE_PERMISSIONS } from "@/test/systemRoles";
import { DEFAULT_SHORTCUT_IDS, SHORTCUT_CATALOG, categoriesOf, shortcutAllowed, shortcutsOf } from "./shortcutCatalog";

/**
 * The server's catalogue, copied from the backend's
 * modules/dashboard/homeShortcuts.js: the dashboard never reads this list, it
 * is what its own catalogue must agree with. Changing an entry means changing
 * both sides and this copy.
 */
const SERVER_CATALOG: Record<string, { requires: string[]; plan?: string }> = {
  new_order: { requires: ["orders.view"] },
  orders: { requires: ["orders.view"] },
  confirmation_queue: { requires: ["orders.confirm", "orders.manage"] },
  lost_orders: { requires: ["orders.view"] },
  returns: { requires: ["orders.view"] },
  fraud: { requires: [] },
  add_product: { requires: ["products.view"] },
  products: { requires: ["products.view"] },
  reviews: { requires: ["products.manage"], plan: "reviews" },
  questions: { requires: ["products.view"] },
  size_charts: { requires: ["products.view"] },
  digital_products: { requires: ["products.view"] },
  courses: { requires: ["products.view"] },
  media: { requires: ["products.manage"] },
  customers: { requires: ["customers.view"] },
  loyalty: { requires: ["customers.view"] },
  inbox: { requires: ["orders.confirm"] },
  marketing: { requires: ["workspace.manage"] },
  offers: { requires: ["products.view"] },
  discounts: { requires: ["discounts.manage"] },
  gift_cards: { requires: ["discounts.manage"] },
  automations: { requires: ["automations.manage"] },
  ai_studio: { requires: ["products.manage", "website.edit", "funnels.manage", "orders.confirm"] },
  website: { requires: ["website.edit"] },
  blog: { requires: ["website.edit"] },
  funnels: { requires: ["funnels.manage"] },
  shoppable_images: { requires: ["products.view"] },
  store_settings: { requires: ["website.edit"] },
  analytics: { requires: ["analytics.view"] },
  realtime: { requires: ["analytics.view"], plan: "advanced_analytics" },
  web_analytics: { requires: ["analytics.view"], plan: "advanced_analytics" },
  visitors: { requires: ["analytics.view"], plan: "advanced_analytics" },
  attribution: { requires: ["analytics.view"] },
  profit: { requires: ["financial_reports.view"] },
  ad_spend: { requires: ["financial_reports.view"] },
  payments: { requires: ["workspace.manage"] },
  settlements: { requires: ["financial_reports.view"] },
  shipping: { requires: ["shipping.manage", "tax.manage"] },
  subscription: { requires: ["billing.manage"] },
  settings: { requires: [] },
  activity: { requires: ["audit_log.view"] },
  services: { requires: [] },
  support: { requires: ["workspace.manage"] },
  suggestions: { requires: [] },
};

/** The row as Home drew it before it could be arranged: its order, words, paths and rule. */
const OLD_ROW = [
  { id: "new_order", en: "New order", ar: "طلب جديد", to: "/orders/new", icon: "Plus" },
  { id: "add_product", en: "Add product", ar: "إضافة منتج", to: "/catalog/new", icon: "PackagePlus" },
  { id: "confirmation_queue", en: "Confirm orders", ar: "تأكيد الطلبات", to: "/confirmation-queue", icon: "PhoneCall" },
  { id: "orders", en: "All orders", ar: "كل الطلبات", to: "/orders", icon: "ShoppingBag" },
  { id: "lost_orders", en: "Lost orders", ar: "الطلبات المفقودة", to: "/abandoned-carts", icon: "ShoppingCart" },
  { id: "discounts", en: "Discounts", ar: "الخصومات", to: "/discounts", icon: "Tag" },
  { id: "website", en: "Edit website", ar: "تعديل الموقع", to: "/website", icon: "Globe" },
  { id: "store_settings", en: "Store settings", ar: "إعدادات المتجر", to: "/store-settings", icon: "Store" },
];

function oldRowFor(permissions: readonly string[] | undefined): string[] {
  return OLD_ROW.filter((action) => {
    const item = findNavItem(action.to);
    return !item || isNavItemVisible(item, permissions);
  }).map((action) => action.id);
}

function entry(id: string) {
  const found = SHORTCUT_CATALOG.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`no entry ${id}`);
  return found;
}

/** The catalogue is built once from the switches, so each case loads it afresh. */
async function catalogWith(on: Record<string, boolean>) {
  vi.resetModules();
  vi.doMock("@/lib/features", async (original) => ({ ...(await original<typeof import("@/lib/features")>()), ...on }));
  const loaded = await import("./shortcutCatalog");
  vi.doUnmock("@/lib/features");
  return loaded;
}

describe("the catalogue", () => {
  it("has unique, stable ids, each with an icon, a path and both languages", () => {
    const ids = SHORTCUT_CATALOG.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of SHORTCUT_CATALOG) {
      expect(item.id).toMatch(/^[a-z][a-z_]*[a-z]$/);
      expect(item.icon).toBeTruthy();
      expect(item.to).toMatch(/^\//);
      expect(item.title.en.trim()).not.toBe("");
      expect(item.title.ar.trim()).not.toBe("");
      expect(item.title.ar).toMatch(/\p{Script=Arabic}/u);
    }
  });

  it("agrees with the server's catalogue on ids, permissions and plan", () => {
    for (const item of SHORTCUT_CATALOG) {
      const server = SERVER_CATALOG[item.id];
      expect(server, `${item.id} is not in the server's catalogue`).toBeDefined();
      expect([...(item.requires ?? [])].sort(), item.id).toEqual([...server.requires].sort());
      expect(item.plan, item.id).toBe(server.plan);
    }
  });

  it("offers everything the server does once every switch is on", async () => {
    const { SHORTCUT_CATALOG: all } = await catalogWith({
      AI_ENABLED: true,
      BLOG_ENABLED: true,
      GIFT_CARDS_ENABLED: true,
      LOYALTY_ENABLED: true,
      PRODUCT_QUESTIONS_ENABLED: true,
      SIZE_CHARTS_ENABLED: true,
      VISITORS_ENABLED: true,
    });
    expect(all.map((item) => item.id).sort()).toEqual(Object.keys(SERVER_CATALOG).sort());
    for (const item of all) {
      const server = SERVER_CATALOG[item.id];
      expect([...(item.requires ?? [])].sort(), item.id).toEqual([...server.requires].sort());
    }
  });

  it("leaves out a page whose feature is switched off, as the side menu does", () => {
    const ids = SHORTCUT_CATALOG.map((item) => item.id);
    for (const id of ["questions", "size_charts", "gift_cards", "blog", "loyalty", "ai_studio", "visitors"]) expect(ids).not.toContain(id);
  });

  it("every page's path is a side menu entry's, with that entry's permissions", () => {
    for (const item of SHORTCUT_CATALOG) {
      const nav = findNavItem(item.to);
      expect(nav, item.id).toBeDefined();
      expect(item.requires).toEqual(nav?.requires);
    }
  });

  it("every path has a route in App.tsx", () => {
    const app = readFileSync(resolve(__dirname, "../../App.tsx"), "utf8");
    for (const item of SHORTCUT_CATALOG) expect(app, item.to).toContain(`path="${item.to}"`);
  });

  it("offers every page of the side menu but Home itself", () => {
    const paths = new Set(SHORTCUT_CATALOG.map((item) => item.to));
    expect(NAV_ITEMS.filter((item) => !paths.has(item.to)).map((item) => item.to)).toEqual(["/"]);
  });

  it("sorts every entry into a section, the menu's order first", () => {
    const sections = categoriesOf(SHORTCUT_CATALOG);
    expect(sections[0]).toBe("orders");
    expect(sections.at(-1)).toBe("more");
    expect(entry("new_order").category).toBe("orders");
    expect(entry("add_product").category).toBe("products");
    expect(entry("media").category).toBe("products");
    expect(entry("settings").category).toBe("more");
  });

  it("keeps the counts on their pages", () => {
    expect(entry("confirmation_queue").badge).toBe("awaiting");
    expect(entry("reviews").badge).toBe("reviews");
    expect(entry("inbox").badge).toBe("unread");
    // These had none on the row, and the default row stays as it was.
    expect(entry("orders").badge).toBeUndefined();
    expect(entry("lost_orders").badge).toBeUndefined();
  });
});

describe("the default row", () => {
  it("is the old row, in its order, with its words, paths and icons", () => {
    expect(DEFAULT_SHORTCUT_IDS).toEqual(OLD_ROW.map((action) => action.id));
    for (const old of OLD_ROW) {
      const item = entry(old.id);
      expect(item.title.en).toBe(old.en);
      expect(item.title.ar).toBe(old.ar);
      expect(item.to).toBe(old.to);
      expect((item.icon as { displayName?: string }).displayName).toBe(old.icon);
    }
    expect(entry("new_order").primary).toBe(true);
    expect(SHORTCUT_CATALOG.filter((item) => item.primary).map((item) => item.id)).toEqual(["new_order"]);
  });

  it.each(SYSTEM_ROLES)("leaves for %s exactly what the old row's rule did", (role) => {
    const permissions = SYSTEM_ROLE_PERMISSIONS[role];
    expect(shortcutsOf(DEFAULT_SHORTCUT_IDS, { permissions }).map((item) => item.id)).toEqual(oldRowFor(permissions));
  });

  it("with permissions not known yet, shows them all, as the old row did", () => {
    expect(shortcutsOf(DEFAULT_SHORTCUT_IDS, { permissions: undefined }).map((item) => item.id)).toEqual(oldRowFor(undefined));
    expect(shortcutsOf(DEFAULT_SHORTCUT_IDS, {})).toHaveLength(8);
  });

  it("hangs on no plan feature, so no plan changes it", () => {
    for (const id of DEFAULT_SHORTCUT_IDS) expect(entry(id).plan).toBeUndefined();
  });
});

describe("what a member may have", () => {
  it("needs one of the entry's permissions", () => {
    expect(shortcutAllowed(entry("confirmation_queue"), { permissions: ["orders.manage"] })).toBe(true);
    expect(shortcutAllowed(entry("confirmation_queue"), { permissions: ["orders.confirm"] })).toBe(true);
    expect(shortcutAllowed(entry("confirmation_queue"), { permissions: ["orders.view"] })).toBe(false);
    expect(shortcutAllowed(entry("fraud"), { permissions: [] })).toBe(true);
    expect(shortcutAllowed(entry("orders"), { permissions: ["*"] })).toBe(true);
  });

  it("follows the server's list", () => {
    expect(shortcutAllowed(entry("orders"), { permissions: ["*"], available: ["orders"] })).toBe(true);
    expect(shortcutAllowed(entry("customers"), { permissions: ["*"], available: ["orders"] })).toBe(false);
  });

  it("is refused a page the plan holds back", () => {
    const gated = (key: string) => key === "reviews";
    expect(shortcutAllowed(entry("reviews"), { permissions: ["*"], gated })).toBe(false);
    expect(shortcutAllowed(entry("reviews"), { permissions: ["*"], gated: () => false })).toBe(true);
    expect(shortcutAllowed(entry("orders"), { permissions: ["*"], gated })).toBe(true);
  });

  it("shortcutsOf keeps the order given, drops repeats and ids this build does not know", () => {
    const list = shortcutsOf(["customers", "gone", "orders", "customers"], { permissions: ["*"] });
    expect(list.map((item) => item.id)).toEqual(["customers", "orders"]);
  });
});
