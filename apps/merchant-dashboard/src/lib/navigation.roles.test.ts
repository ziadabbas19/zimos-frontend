import { describe, expect, it } from "vitest";
import { NAV_ITEMS, isNavItemVisible, type NavKey } from "@/lib/navigation";
import { SYSTEM_ROLE_PERMISSIONS } from "@/test/systemRoles";

/**
 * The side menu per role: an entry shows only to a role whose permissions
 * (as GET /workspaces sends them) hold one its page's API asks for. The
 * lists below are what each system role can open in this build (switches
 * off), read from the backend routes' requirePermission.
 */
const visibleFor = (permissions: readonly string[] | null | undefined): NavKey[] =>
  NAV_ITEMS.filter((item) => isNavItemVisible(item, permissions)).map((item) => item.key);

const FOR_EVERYONE: NavKey[] = ["overview", "fraud", "settings", "services", "suggestions"];

const EXPECTED: Record<string, NavKey[]> = {
  owner: NAV_ITEMS.map((item) => item.key),
  workspace_manager: NAV_ITEMS.map((item) => item.key).filter((key) => key !== "inbox" && key !== "subscription"),
  editor: [...FOR_EVERYONE, "catalog", "reviews", "digital", "courses", "media", "offers", "website", "funnels", "shoppableImages", "storeSettings"],
  order_operator: [
    ...FOR_EVERYONE,
    "orders",
    "confirmationQueue",
    "abandonedCarts",
    "returns",
    "catalog",
    "digital",
    "courses",
    "customers",
    "offers",
    "shoppableImages",
    "shipping",
  ],
  confirmation_agent: [...FOR_EVERYONE, "orders", "confirmationQueue", "abandonedCarts", "returns", "customers", "inbox"],
  accountant: [
    ...FOR_EVERYONE,
    "orders",
    "abandonedCarts",
    "returns",
    "analytics",
    "realtime",
    "webAnalytics",
    "attribution",
    "profit",
    "ads",
    "settlements",
    "shipping",
    "subscription",
  ],
};

describe("the side menu for each role", () => {
  for (const [role, expected] of Object.entries(EXPECTED)) {
    it(`${role} sees exactly the pages its role can open`, () => {
      expect(visibleFor(SYSTEM_ROLE_PERMISSIONS[role]).sort()).toEqual([...expected].sort());
    });
  }

  it("keeps the pages each system role used to get a 403 on out of its menu", () => {
    const hidden = (role: string) => NAV_ITEMS.filter((item) => !isNavItemVisible(item, SYSTEM_ROLE_PERMISSIONS[role])).map((item) => item.key);
    expect(hidden("editor")).toEqual(expect.arrayContaining(["orders", "returns", "abandonedCarts", "confirmationQueue", "customers", "inbox", "marketing", "discounts", "automations", "payments", "settlements", "shipping", "activity", "support"]));
    expect(hidden("order_operator")).toEqual(expect.arrayContaining(["reviews", "media", "inbox", "website", "funnels", "storeSettings", "settlements", "marketing", "payments", "activity", "support"]));
    expect(hidden("confirmation_agent")).toEqual(expect.arrayContaining(["catalog", "reviews", "media", "shipping", "settlements", "website", "funnels", "storeSettings", "marketing", "discounts", "activity", "support"]));
    expect(hidden("accountant")).toEqual(expect.arrayContaining(["catalog", "confirmationQueue", "customers", "inbox", "website", "funnels", "storeSettings", "marketing", "discounts", "automations", "payments", "activity", "support"]));
    expect(hidden("workspace_manager")).toEqual(["inbox", "subscription"]);
  });

  it("follows a custom role's own permissions", () => {
    expect(visibleFor(["orders.view", "discounts.manage"]).sort()).toEqual(
      [...FOR_EVERYONE, "orders", "abandonedCarts", "returns", "discounts"].sort()
    );
  });

  it("shows everything while the permissions are unknown (an API that doesn't send them)", () => {
    expect(visibleFor(undefined)).toEqual(NAV_ITEMS.map((item) => item.key));
  });
});
