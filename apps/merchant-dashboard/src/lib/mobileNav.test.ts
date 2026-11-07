import { describe, expect, it } from "vitest";
import { DEFAULT_DOCK_IDS, DOCK_CATALOG, MAX_DOCK_SLOTS, dockEntriesOf, dockLabel } from "@/lib/mobileNav";

// The phone's bottom bar (lib/mobileNav): the slots it may hold, what a role
// sees of them, and the bar of a member who never arranged it.

// The server's list (backend dashboard/homeShortcuts.js, MOBILE_NAV_IDS): Home, then the Home row's catalogue.
const SERVER_HAS_HOME_FIRST = "home";

const ids = (entries: { id: string }[]) => entries.map((entry) => entry.id);

describe("the phone's bottom bar", () => {
  it("offers Home and every Home shortcut, each once", () => {
    expect(DOCK_CATALOG[0]?.id).toBe(SERVER_HAS_HOME_FIRST);
    expect(new Set(ids([...DOCK_CATALOG])).size).toBe(DOCK_CATALOG.length);
  });

  it("is the bar it always was for a member who never arranged it, in its words", () => {
    const owner = dockEntriesOf(DEFAULT_DOCK_IDS, { permissions: ["*"] });
    expect(ids(owner)).toEqual(["home", "orders", "confirmation_queue", "products"]);
    expect(owner.map((entry) => dockLabel(entry, "en"))).toEqual(["Today", "Orders", "Confirm", "Products"]);
    expect(owner.map((entry) => dockLabel(entry, "ar"))).toEqual(["اليوم", "الطلبات", "التأكيد", "المنتجات"]);
  });

  it("leaves out a page the role cannot open, and what the server no longer allows; Home stays", () => {
    const editor = dockEntriesOf(DEFAULT_DOCK_IDS, { permissions: ["website.edit"] });
    expect(ids(editor)).toEqual(["home"]);
    const narrowed = dockEntriesOf(["home", "discounts", "orders"], { permissions: ["*"], available: ["orders"] });
    expect(ids(narrowed)).toEqual(["home", "orders"]);
  });

  it(`holds ${MAX_DOCK_SLOTS} slots at most`, () => {
    expect(dockEntriesOf(["home", "orders", "products", "customers", "discounts"], { permissions: ["*"] })).toHaveLength(MAX_DOCK_SLOTS);
  });
});
