import { useEffect, useSyncExternalStore } from "react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { NAV_GROUPS, type NavItem } from "@/lib/nav";
import type { PermissionCheck } from "@/lib/permissions";

/**
 * The console's two rows each account arranges for itself (the API's
 * platformAdmin/consoleShortcuts.js, migration 746): the shortcuts on its
 * first page and the phone's bottom bar. The merchant dashboard's Home row
 * and bar, per console account instead of per member and store.
 *
 * The id is what the server stores, so it never changes; a page takes its
 * address, icon, words and permission from its side menu entry (lib/nav.ts),
 * so a page the menu does not have in this build (Store traffic while its
 * switch is off) is not offered either, and an entry opens to exactly the
 * accounts the menu's row opens to. consoleShortcuts.test.ts keeps the ids in
 * step with the server's list.
 */

/** Each page's id, by its address in the side menu. */
export const SHORTCUT_IDS: Readonly<Record<string, string>> = {
  "/": "overview",
  "/notifications": "notifications",
  "/site-traffic": "site_traffic",
  "/store-traffic": "store_traffic",
  "/workspaces": "workspaces",
  "/users": "users",
  "/subscriptions": "subscriptions",
  "/plans": "plans",
  "/payment-proofs": "payment_proofs",
  "/wallet-refunds": "wallet_refunds",
  "/payment-methods": "payment_methods",
  "/agents": "agents",
  "/referral-codes": "referral_codes",
  "/my-referrals": "my_referrals",
  "/templates": "templates",
  "/themes": "themes",
  "/suppliers": "suppliers",
  "/apps": "apps",
  "/carriers": "carriers",
  "/payment-gateways": "payment_gateways",
  "/whatsapp-numbers": "whatsapp_numbers",
  "/fraud-signals": "fraud_signals",
  "/blocklist": "blocklist",
  "/tickets": "tickets",
  "/suggestions": "suggestions",
  "/announcements": "announcements",
  "/service-listings": "service_listings",
  "/feature-flags": "feature_flags",
  "/audit-log": "audit_log",
  "/system-health": "system_health",
  "/admin-users": "admin_users",
  "/platform-settings": "platform_settings",
};

export interface ConsoleShortcut {
  id: string;
  to: string;
  icon: LucideIcon;
  /** The side menu's English label; useNavLabel gives the Arabic. */
  label: string;
  permission: PermissionCheck;
  /** The side menu group it is listed in (its English heading), or null for the unheaded first one. */
  group: string | null;
}

/** Every page this build offers, in the side menu's order. */
export const CONSOLE_SHORTCUTS: readonly ConsoleShortcut[] = NAV_GROUPS.flatMap((group) =>
  group.items.flatMap((item: NavItem) => {
    const id = SHORTCUT_IDS[item.to];
    return id ? [{ id, to: item.to, icon: item.icon, label: item.label, permission: item.permission, group: group.label }] : [];
  })
);

const BY_ID = new Map(CONSOLE_SHORTCUTS.map((entry) => [entry.id, entry]));

/** The rows: the shortcuts on the first page, and the phone's bar. */
export type ConsoleRow = "home" | "mobileNav";

/** What the server answers for a row (the dashboard's HomeShortcuts). */
export interface RowAnswer {
  /** False: the account never arranged the row and `shortcuts` is the default one. */
  customized: boolean;
  shortcuts: string[];
  /** The default row, for going back to it. */
  defaults: string[];
  /** Every id this account may put on the row. */
  available: string[];
  max: number;
}

/** The row of an account whose answer has not come (or never comes: an API from before it). The server's defaults, as it sends them. */
export const FALLBACK_DEFAULTS: Record<ConsoleRow, readonly string[]> = {
  home: ["workspaces", "users", "subscriptions", "payment_proofs", "tickets", "referral_codes", "agents", "admin_users", "my_referrals", "notifications"],
  mobileNav: ["overview", "workspaces", "subscriptions", "tickets"],
};
const FALLBACK_COUNT: Record<ConsoleRow, number> = { home: 8, mobileNav: 4 };

/** The entries of `ids` this account may open, in that order, each once; `available` (the server's word) narrows them further. */
export function shortcutsOf(ids: readonly string[], can: (permission: PermissionCheck) => boolean, available?: readonly string[] | null): ConsoleShortcut[] {
  return [...new Set(ids)].flatMap((id) => {
    const entry = BY_ID.get(id);
    if (!entry || !can(entry.permission)) return [];
    return available && !available.includes(id) ? [] : [entry];
  });
}

/** The ids a row shows: the server's answer, else this device's copy, else the defaults this account may open. */
export function rowIds(row: ConsoleRow, answer: RowAnswer | null, hint: string[] | null, can: (permission: PermissionCheck) => boolean): ConsoleShortcut[] {
  if (answer) return shortcutsOf(answer.shortcuts, can, answer.available);
  if (hint) return shortcutsOf(hint, can).slice(0, row === "mobileNav" ? 4 : 12);
  return shortcutsOf(FALLBACK_DEFAULTS[row], can).slice(0, FALLBACK_COUNT[row]);
}

const PATH: Record<ConsoleRow, string> = { home: "/admin/me/home-shortcuts", mobileNav: "/admin/me/mobile-nav" };
const KEY: Record<ConsoleRow, "homeShortcuts" | "mobileNav"> = { home: "homeShortcuts", mobileNav: "mobileNav" };

export async function getRow(row: ConsoleRow): Promise<RowAnswer> {
  const body = await apiClient.request<Record<string, RowAnswer>>(PATH[row]);
  return body[KEY[row]];
}

/** Replaces the row. 403 HOME_SHORTCUT_NOT_ALLOWED for a page this account may not open. */
export async function saveRow(row: ConsoleRow, shortcuts: string[]): Promise<RowAnswer> {
  const body = await apiClient.request<Record<string, RowAnswer>>(PATH[row], { method: "PUT", body: { shortcuts } });
  return body[KEY[row]];
}

/** Back to the default row. */
export async function resetRow(row: ConsoleRow): Promise<RowAnswer> {
  const body = await apiClient.request<Record<string, RowAnswer>>(PATH[row], { method: "DELETE" });
  return body[KEY[row]];
}

/*
 * Kept for the page's life, per account and row, so going back to the first
 * page or moving between pages asks nothing: read once, again when an editor
 * opens, replaced by what a save answers. Until an answer is in (and if none
 * comes), a row is the one this device last saw this account arrange, or the
 * default one, and it cannot be edited.
 */
const kept = new Map<string, RowAnswer | null>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const keyOf = (row: ConsoleRow, userId: string) => `${userId}:${row}`;
const hintKey = (row: ConsoleRow, userId: string) => `zimos.consoleShortcuts.${row}.${userId}`;

export function seedRow(row: ConsoleRow, userId: string, answer: RowAnswer) {
  kept.set(keyOf(row, userId), answer);
  try {
    if (answer.customized) localStorage.setItem(hintKey(row, userId), JSON.stringify(answer.shortcuts));
    else localStorage.removeItem(hintKey(row, userId));
  } catch {
    // Private mode: the row waits for the server's answer on the next visit.
  }
  emit();
}

/** Asks the server. A failed read keeps what was known; with nothing known, the next look asks again. */
export async function readRow(row: ConsoleRow, userId: string): Promise<void> {
  const answer = await getRow(row).catch(() => null);
  if (answer) seedRow(row, userId, answer);
  else if (!kept.get(keyOf(row, userId))) kept.delete(keyOf(row, userId));
}

/** Tests only. */
export function forgetRows() {
  kept.clear();
  emit();
}

function readHint(row: ConsoleRow, userId: string): string[] | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(hintKey(row, userId)) ?? "null");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : null;
  } catch {
    return null;
  }
}

export interface ConsoleRowState {
  answer: RowAnswer | null;
  /** The row to show now, for this account. */
  entries: ConsoleShortcut[];
}

/** One of the signed-in account's rows. */
export function useConsoleRow(row: ConsoleRow): ConsoleRowState {
  const { user, can } = useAuth();
  const userId = user?.id ?? null;
  const answer = useSyncExternalStore(subscribe, () => (userId ? kept.get(keyOf(row, userId)) : null)) ?? null;

  useEffect(() => {
    if (!userId || kept.has(keyOf(row, userId))) return;
    kept.set(keyOf(row, userId), null);
    void readRow(row, userId);
  }, [row, userId]);

  return { answer, entries: rowIds(row, answer, answer || !userId ? null : readHint(row, userId), can) };
}
