import { describe, expect, it } from "vitest";
import type { AuthUser } from "@store-builder/api-client";
import appSource from "@/App.tsx?raw";
import { STORE_TRAFFIC_ENABLED } from "./features";
import { NAV_GROUPS, findNavItem, landingPath, visibleNavGroups } from "./nav";
import { ANY_CONSOLE_ACCOUNT, P, PAYMENT_METHODS_PAGE, PERMISSION_LABELS, PERMISSION_NEEDS, hasPermission, isCreator, permissionLabel, withPermission, type PermissionCheck } from "./permissions";

/** The one check behind `can`, `<Can>` and `<CanLink>`, and what the menu and the routes make of it. */

function account(platformRole: string | null, platformPermissions: string[] = []): AuthUser {
  return { id: "u1", email: "a@example.com", platformRole, platformPermissions } as unknown as AuthUser;
}

const canFor = (user: AuthUser) => (permission: PermissionCheck) => hasPermission(user, permission);

describe("hasPermission", () => {
  it("answers no for nobody, and for an account with no console role", () => {
    expect(hasPermission(null, P.PLANS_VIEW)).toBe(false);
    expect(hasPermission(account(null, [P.PLANS_VIEW]), P.PLANS_VIEW)).toBe(false);
  });

  it("answers from the account's own set, not from its role", () => {
    const user = account("admin", [P.PLANS_VIEW]);
    expect(hasPermission(user, P.PLANS_VIEW)).toBe(true);
    expect(hasPermission(user, P.PLANS_MANAGE)).toBe(false);
    expect(hasPermission(account("some_custom_role", [P.PLANS_MANAGE]), P.PLANS_MANAGE)).toBe(true);
  });

  it("gives a creator everything, keys added later included", () => {
    const creator = account("creator", []);
    expect(isCreator(creator)).toBe(true);
    expect(hasPermission(creator, P.ADMINS_MANAGE)).toBe(true);
    expect(hasPermission(creator, "a.key.from.next.year")).toBe(true);
  });

  it('gives nothing for "*" on any other role', () => {
    const user = account("admin", ["*"]);
    expect(isCreator(user)).toBe(false);
    expect(hasPermission(user, P.PLANS_VIEW)).toBe(false);
  });

  it("takes several keys, any of which is enough", () => {
    expect(hasPermission(account("admin", [P.PAYMENT_METHODS_MANAGE]), PAYMENT_METHODS_PAGE)).toBe(true);
    expect(hasPermission(account("admin", [P.PLANS_VIEW]), PAYMENT_METHODS_PAGE)).toBe(false);
  });

  it("opens ANY_CONSOLE_ACCOUNT to anyone with a console role, and to nobody else", () => {
    expect(hasPermission(account("admin", []), ANY_CONSOLE_ACCOUNT)).toBe(true);
    expect(hasPermission(account("agent", ["referrals.view_own"]), ANY_CONSOLE_ACCOUNT)).toBe(true);
    expect(hasPermission(account(null, []), ANY_CONSOLE_ACCOUNT)).toBe(false);
    expect(hasPermission(null, ANY_CONSOLE_ACCOUNT)).toBe(false);
  });
});

describe("the permission keys", () => {
  it("are all labelled for the editor", () => {
    for (const key of Object.values(P)) expect([key, permissionLabel(key) === key]).toEqual([key, false]);
    expect(Object.keys(PERMISSION_LABELS).sort()).toEqual(Object.values(P).slice().sort());
  });

  it("tick the key that opens the page along with the key that edits it, and untick it the other way", () => {
    expect(withPermission([], P.PLANS_MANAGE, true).sort()).toEqual([P.PLANS_MANAGE, P.PLANS_VIEW].sort());
    expect(withPermission([P.PLANS_VIEW, P.PLANS_MANAGE, P.RISK_VIEW], P.PLANS_VIEW, false)).toEqual([P.RISK_VIEW]);
    // Unticking the edit key leaves the page open.
    expect(withPermission([P.PLANS_VIEW, P.PLANS_MANAGE], P.PLANS_MANAGE, false)).toEqual([P.PLANS_VIEW]);
    expect(withPermission([P.PLANS_VIEW], P.PLANS_VIEW, true)).toEqual([P.PLANS_VIEW]);
    for (const [key, needs] of Object.entries(PERMISSION_NEEDS)) {
      expect(Object.values(P)).toContain(key);
      expect(Object.values(P)).toContain(needs);
    }
  });
});

describe("the menu", () => {
  it("shows a creator every page", () => {
    const creator = account("creator", []);
    const every = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.to));
    expect(visibleNavGroups(canFor(creator)).flatMap((g) => g.items.map((i) => i.to))).toEqual(every);
  });

  it("leaves out each page the account can't open, and a section with nothing left", () => {
    const groups = visibleNavGroups(canFor(account("admin", [P.SUPPORT_VIEW])));
    expect(groups.map((g) => g.id)).toEqual(["main", "support"]);
    expect(groups[1].items.map((i) => i.to)).toEqual(["/tickets", "/suggestions"]);
  });

  it("offers an account with no permissions its notifications and nothing else", () => {
    const groups = visibleNavGroups(canFor(account("admin", [])));
    expect(groups.flatMap((g) => g.items.map((i) => i.to))).toEqual(["/notifications"]);
  });

  it("starts with the first page the account can open, not the overview it can't", () => {
    const first = (permissions: string[]) => landingPath(canFor(account("admin", permissions)));
    expect(first([P.OVERVIEW_VIEW, P.SUPPORT_VIEW])).toBe("/");
    expect(first([P.SUPPORT_VIEW, P.PLANS_VIEW])).toBe("/plans");
    expect(first([P.REFERRALS_VIEW_OWN])).toBe("/my-referrals");
    expect(first([])).toBeNull();
  });

  it("opens the payment methods page for whoever holds a key it edits", () => {
    const pages = (key: string) => visibleNavGroups(canFor(account("admin", [key]))).flatMap((g) => g.items.map((i) => i.to));
    expect(pages(P.PAYMENT_METHODS_EDIT_NUMBERS)).toContain("/payment-methods");
    expect(pages(P.PAYMENT_METHODS_MANAGE)).toContain("/payment-methods");
  });
});

describe("the routes", () => {
  // `gated(P.X, <Page />)` or `gated(NAME, <Page />)`, as App.tsx writes them.
  const routes = [...appSource.matchAll(/path="([^"]+)" element=\{gated\(([A-Za-z_.]+),/g)].map(([, path, permission]) => ({ path, permission }));
  const keyOf = (name: string): PermissionCheck => {
    if (name === "PAYMENT_METHODS_PAGE") return PAYMENT_METHODS_PAGE;
    if (name === "ANY_CONSOLE_ACCOUNT") return ANY_CONSOLE_ACCOUNT;
    return P[name.replace("P.", "") as keyof typeof P];
  };

  it("are all behind a permission, /login aside", () => {
    expect(routes.length).toBeGreaterThan(30);
    expect(appSource.match(/<Route path="\/[^"]*" element=\{<(?!LoginPage)/g)).toBeNull();
  });

  it("ask for the same permission as the menu entry they sit under, so a redirect can't loop", () => {
    for (const { path, permission } of routes) {
      // Behind its own switch, in the menu and in the routes alike.
      if (path === "/store-traffic" && !STORE_TRAFFIC_ENABLED) continue;
      const item = findNavItem(path);
      expect([path, item?.permission]).toEqual([path, keyOf(permission)]);
    }
    for (const group of NAV_GROUPS) {
      for (const item of group.items) expect(routes.map((r) => r.path)).toContain(item.to);
    }
  });
});
