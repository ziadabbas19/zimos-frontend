import type { AuthUser } from "@store-builder/api-client";

/**
 * Platform-console permission keys, mirroring the backend's
 * `core/security/platformPermissions.js`. The backend is the gate — every
 * `/admin` route checks one of these — so the console only uses them to leave
 * out what the signed-in account cannot open anyway.
 *
 * `hasPermission` is the one check: pages reach it through `useAuth().can`,
 * `<Can>` and `<CanLink>` (components/Can.tsx).
 */
export const P = {
  OVERVIEW_VIEW: "overview.view",
  WORKSPACES_VIEW: "workspaces.view",
  WORKSPACES_MANAGE: "workspaces.manage",
  SUBSCRIPTIONS_MANAGE: "subscriptions.manage",
  SUBSCRIPTIONS_VIEW: "subscriptions.view",
  PAYMENTS_RECORD: "payments.record",
  PAYMENT_METHODS_MANAGE: "payment_methods.manage",
  PAYMENT_METHODS_EDIT_NUMBERS: "payment_methods.edit_numbers",
  PLANS_VIEW: "plans.view",
  PLANS_MANAGE: "plans.manage",
  TEMPLATES_VIEW: "templates.view",
  TEMPLATES_MANAGE: "templates.manage",
  RISK_VIEW: "risk.view",
  RISK_MANAGE: "risk.manage",
  PROVIDERS_VIEW: "providers.view",
  PROVIDERS_MANAGE: "providers.manage",
  SYSTEM_VIEW: "system.view",
  FEATURE_FLAGS_VIEW: "feature_flags.view",
  FEATURE_FLAGS_MANAGE: "feature_flags.manage",
  ANNOUNCEMENTS_VIEW: "announcements.view",
  ANNOUNCEMENTS_MANAGE: "announcements.manage",
  SERVICE_LISTINGS_VIEW: "service_listings.view",
  SERVICE_LISTINGS_MANAGE: "service_listings.manage",
  SUPPORT_VIEW: "support.view",
  // Answering suggestions (backend platformPermissions SUPPORT_MANAGE).
  SUPPORT_MANAGE: "support.manage",
  AUDIT_LOG_VIEW: "audit_log.view",
  ADMINS_VIEW: "admins.view",
  ADMINS_MANAGE: "admins.manage",
  AGENTS_VIEW: "agents.view",
  AGENTS_MANAGE: "agents.manage",
  COMMISSIONS_MARK_PAID: "commissions.mark_paid",
  REFERRALS_VIEW_OWN: "referrals.view_own",
  // The platform's public details (pages/PlatformSettingsPage.tsx).
  PLATFORM_SETTINGS_VIEW: "platform_settings.view",
  PLATFORM_SETTINGS_MANAGE: "platform_settings.manage",
} as const;

export type PermissionKey = (typeof P)[keyof typeof P];

/** One key, several when holding any of them is enough, or ANY_CONSOLE_ACCOUNT. */
export type PermissionCheck = string | readonly string[] | null;

/** For what opens to everyone with a console role, whatever they hold: their notifications. */
export const ANY_CONSOLE_ACCOUNT = null;

/** A boolean answer for one key: what `useAuth().can` gives a plain function. */
export type Can = (permission: string) => boolean;

/** Payment methods opens for whoever holds a key it edits (GET /admin/payment-methods). */
export const PAYMENT_METHODS_PAGE = [P.PAYMENTS_RECORD, P.PAYMENT_METHODS_MANAGE, P.PAYMENT_METHODS_EDIT_NUMBERS] as const;

export const CREATOR_ROLE = "creator";
export const AGENT_ROLE = "agent";

export function isCreator(user: AuthUser | null): boolean {
  return user?.platformRole === CREATOR_ROLE;
}

/**
 * A creator holds every key, including ones added later. `*` means nothing on
 * any other role, as on the backend.
 */
export function hasPermission(user: AuthUser | null, permission: PermissionCheck): boolean {
  if (!user || !user.platformRole) return false;
  if (isCreator(user) || permission === ANY_CONSOLE_ACCOUNT) return true;
  const held = user.platformPermissions ?? [];
  return typeof permission === "string" ? held.includes(permission) : permission.some((key) => held.includes(key));
}

/**
 * The key that opens the page a key edits: an edit key alone gives a person
 * nothing to press. The role and access editors tick and untick them together.
 */
export const PERMISSION_NEEDS: Record<string, string> = {
  [P.WORKSPACES_MANAGE]: P.WORKSPACES_VIEW,
  [P.SUBSCRIPTIONS_MANAGE]: P.SUBSCRIPTIONS_VIEW,
  [P.PLANS_MANAGE]: P.PLANS_VIEW,
  [P.TEMPLATES_MANAGE]: P.TEMPLATES_VIEW,
  [P.RISK_MANAGE]: P.RISK_VIEW,
  [P.PROVIDERS_MANAGE]: P.PROVIDERS_VIEW,
  [P.FEATURE_FLAGS_MANAGE]: P.FEATURE_FLAGS_VIEW,
  [P.ANNOUNCEMENTS_MANAGE]: P.ANNOUNCEMENTS_VIEW,
  [P.SERVICE_LISTINGS_MANAGE]: P.SERVICE_LISTINGS_VIEW,
  [P.SUPPORT_MANAGE]: P.SUPPORT_VIEW,
  [P.ADMINS_MANAGE]: P.ADMINS_VIEW,
  [P.AGENTS_MANAGE]: P.AGENTS_VIEW,
  [P.COMMISSIONS_MARK_PAID]: P.AGENTS_VIEW,
  [P.PLATFORM_SETTINGS_MANAGE]: P.PLATFORM_SETTINGS_VIEW,
};

/** A permission set with `key` ticked or unticked, and what goes with it. */
export function withPermission(set: readonly string[], key: string, on: boolean): string[] {
  if (on) {
    const needs = PERMISSION_NEEDS[key];
    return [...new Set([...set, key, ...(needs ? [needs] : [])])];
  }
  return set.filter((held) => held !== key && PERMISSION_NEEDS[held] !== key);
}

/**
 * Human labels for the permission editor. A key missing here (one the backend
 * added later) still shows, under its raw name.
 */
export const PERMISSION_LABELS: Record<string, string> = {
  "overview.view": "Overview",
  "workspaces.view": "Workspaces",
  "workspaces.manage": "Stores — suspend and reactivate",
  "subscriptions.view": "Subscriptions",
  "subscriptions.manage": "Subscriptions — billing cycle, special terms, trial-expiry check",
  "payments.record": "Subscription charges — price and record payments by hand, review transfer proofs",
  "payment_methods.manage": "Payment methods — turn on and off, order",
  "payment_methods.edit_numbers": "Payment methods — change the number a transfer goes to",
  "plans.view": "Plans — view",
  "plans.manage": "Plans — edit",
  "templates.view": "Templates — view",
  "templates.manage": "Templates — edit and publish",
  "risk.view": "Fraud signals and blocklist — view",
  "risk.manage": "Blocklist — edit",
  "providers.view": "Carriers and payment gateways",
  "providers.manage": "Courier areas map — edit for every store",
  "system.view": "System health",
  "feature_flags.view": "Feature flags — view",
  "feature_flags.manage": "Feature flags — edit",
  "announcements.view": "Announcements — view",
  "announcements.manage": "Announcements — edit",
  "service_listings.view": "Service listings — view",
  "service_listings.manage": "Service listings — edit",
  "support.view": "Support tickets — view",
  "support.manage": "Support tickets — reply and update",
  "audit_log.view": "Audit log",
  "admins.view": "Admin users — view",
  "admins.manage": "Admin users — grant, change and revoke roles",
  "agents.view": "Agents, codes and commissions — view",
  "agents.manage": "Agents and referral codes — create and edit",
  "commissions.mark_paid": "Commissions — mark paid",
  "referrals.view_own": "Own referral codes and commissions (agents)",
  "platform_settings.view": "Platform settings — view",
  "platform_settings.manage": "Platform settings — edit, reset and restore",
};

export function permissionLabel(key: string): string {
  return key === "*" ? "Everything (creator)" : (PERMISSION_LABELS[key] ?? key);
}

export function permissionSummary(permissions: string[]): string {
  if (permissions.includes("*")) return "Everything";
  return `${permissions.length} permission${permissions.length === 1 ? "" : "s"}`;
}
