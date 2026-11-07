import { describe, expect, it } from "vitest";
import { CONSOLE_SHORTCUTS, FALLBACK_DEFAULTS, rowIds, shortcutsOf } from "@/lib/consoleShortcuts";
import { hasPermission, P } from "@/lib/permissions";

// The console's shortcuts row and phone bar (lib/consoleShortcuts): the ids in
// step with the API's list, and what an account sees of them.

// The API's catalogue (platformAdmin/consoleShortcuts.js CONSOLE_SHORTCUT_CATALOG), in its order.
const SERVER_IDS = [
  "overview",
  "notifications",
  "site_traffic",
  "store_traffic",
  "workspaces",
  "users",
  "subscriptions",
  "plans",
  "payment_proofs",
  "wallet_refunds",
  "payment_methods",
  "agents",
  "referral_codes",
  "my_referrals",
  "templates",
  "themes",
  "suppliers",
  "apps",
  "carriers",
  "payment_gateways",
  "whatsapp_numbers",
  "fraud_signals",
  "blocklist",
  "tickets",
  "suggestions",
  "announcements",
  "service_listings",
  "feature_flags",
  "audit_log",
  "system_health",
  "admin_users",
  "platform_settings",
];

const account = (keys: string[], platformRole = "admin") => ({ id: "u1", platformRole, platformPermissions: keys }) as never;
const canOf = (keys: string[], role?: string) => (permission: Parameters<typeof hasPermission>[1]) => hasPermission(account(keys, role), permission);
const ids = (entries: { id: string }[]) => entries.map((entry) => entry.id);

describe("the console's shortcuts", () => {
  it("names only ids the API knows, each once; every API id but Store traffic (behind its switch) is a page here", () => {
    const here = ids([...CONSOLE_SHORTCUTS]);
    expect(new Set(here).size).toBe(here.length);
    for (const id of here) expect(SERVER_IDS).toContain(id);
    expect(SERVER_IDS.filter((id) => !here.includes(id) && id !== "store_traffic")).toEqual([]);
    for (const row of Object.values(FALLBACK_DEFAULTS)) for (const id of row) expect(SERVER_IDS).toContain(id);
  });

  it("shows an account only the pages it opens", () => {
    const support = canOf([P.SUPPORT_VIEW]);
    expect(ids(shortcutsOf(["tickets", "admin_users", "notifications"], support))).toEqual(["tickets", "notifications"]);
    // The server's word narrows it further (a key taken away since this page loaded).
    expect(ids(shortcutsOf(["tickets", "notifications"], support, ["notifications"]))).toEqual(["notifications"]);
  });

  it("falls back to the defaults the account may open until the API answers", () => {
    const agent = canOf([P.REFERRALS_VIEW_OWN], "agent");
    expect(ids(rowIds("home", null, null, agent))).toEqual(["my_referrals", "notifications"]);
    const creator = canOf([], "creator");
    expect(ids(rowIds("mobileNav", null, null, creator))).toEqual(["overview", "workspaces", "subscriptions", "tickets"]);
    expect(rowIds("home", null, null, creator)).toHaveLength(8);
    // This device's copy of what the account arranged, still narrowed to what it opens.
    expect(ids(rowIds("home", null, ["admin_users", "my_referrals"], agent))).toEqual(["my_referrals"]);
  });
});
