import type { AuthUser } from "@store-builder/api-client";
import { countForm, fmt, getActiveLocale } from "../i18n/activeLocale.ts";

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
  AGENTS_CREATE: "agents.create",
  REFERRAL_CODES_APPROVE: "referral_codes.approve",
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
 * Whether an account is within the viewer's reach: they hold every key on it.
 * Mirrors the API (platformPermissions.outOfReach), for the admin list, which
 * already shows the keys. An agent's own key doesn't count: it is given without
 * being held, and taken back the same way.
 */
export function withinReach(can: Can, account: { role: string; permissions: readonly string[] }): boolean {
  return account.permissions.every((key) => can(key) || (account.role === AGENT_ROLE && key === P.REFERRALS_VIEW_OWN));
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
  [P.REFERRAL_CODES_APPROVE]: P.AGENTS_VIEW,
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
  "agents.manage": "Referral codes — create and edit",
  "agents.create": "Agents — add a new agent",
  "referral_codes.approve": "Referral codes and agent links — approve or reject changes",
  "commissions.mark_paid": "Commissions — mark paid",
  "referrals.view_own": "Own referral codes and commissions (agents)",
  "platform_settings.view": "Platform settings — view",
  "platform_settings.manage": "Platform settings — edit, reset and restore",
};

/** The same labels in Arabic, key for key. */
export const PERMISSION_LABELS_AR: Record<string, string> = {
  "overview.view": "نظرة عامة",
  "workspaces.view": "المتاجر",
  "workspaces.manage": "المتاجر — الإيقاف وإعادة التفعيل",
  "subscriptions.view": "الاشتراكات",
  "subscriptions.manage": "الاشتراكات — دورة الفوترة، والشروط الخاصة، وفحص انتهاء الفترة التجريبية",
  "payments.record": "رسوم الاشتراك — التسعير وتسجيل المدفوعات يدويًا، ومراجعة إثباتات التحويل",
  "payment_methods.manage": "طرق الدفع — التفعيل والإيقاف والترتيب",
  "payment_methods.edit_numbers": "طرق الدفع — تغيير الرقم الذي يُحوَّل إليه",
  "plans.view": "الخطط — عرض",
  "plans.manage": "الخطط — تعديل",
  "templates.view": "القوالب — عرض",
  "templates.manage": "القوالب — تعديل ونشر",
  "risk.view": "إشارات الاحتيال وقائمة الحظر — عرض",
  "risk.manage": "قائمة الحظر — تعديل",
  "providers.view": "شركات الشحن وبوابات الدفع",
  "providers.manage": "خريطة مناطق شركات الشحن — تعديل لكل المتاجر",
  "system.view": "حالة النظام",
  "feature_flags.view": "مفاتيح الميزات — عرض",
  "feature_flags.manage": "مفاتيح الميزات — تعديل",
  "announcements.view": "الإعلانات — عرض",
  "announcements.manage": "الإعلانات — تعديل",
  "service_listings.view": "قوائم الخدمات — عرض",
  "service_listings.manage": "قوائم الخدمات — تعديل",
  "support.view": "تذاكر الدعم — عرض",
  "support.manage": "تذاكر الدعم — الرد والتحديث",
  "audit_log.view": "سجل التدقيق",
  "admins.view": "المسؤولون — عرض",
  "admins.manage": "المسؤولون — منح الأدوار وتغييرها وسحبها",
  "agents.view": "الوكلاء والأكواد والعمولات — عرض",
  "agents.manage": "أكواد الإحالة — إنشاء وتعديل",
  "agents.create": "الوكلاء — إضافة وكيل جديد",
  "referral_codes.approve": "أكواد الإحالة وروابط الوكلاء — الموافقة على التعديلات أو رفضها",
  "commissions.mark_paid": "العمولات — تحديد كمدفوعة",
  "referrals.view_own": "أكواد الإحالة والعمولات الخاصة بالحساب (الوكلاء)",
  "platform_settings.view": "إعدادات المنصة — عرض",
  "platform_settings.manage": "إعدادات المنصة — تعديل وإعادة ضبط واستعادة",
};

const PERMISSION_COUNT_AR = { one: "صلاحية واحدة", two: "صلاحيتان", few: "{n} صلاحيات", many: "{n} صلاحية" };

export function permissionLabel(key: string): string {
  const arabic = getActiveLocale() === "ar";
  if (key === "*") return arabic ? "كل شيء (منشئ)" : "Everything (creator)";
  return (arabic ? PERMISSION_LABELS_AR[key] : PERMISSION_LABELS[key]) ?? key;
}

export function permissionSummary(permissions: string[]): string {
  const arabic = getActiveLocale() === "ar";
  if (permissions.includes("*")) return arabic ? "كل شيء" : "Everything";
  if (arabic) return fmt(PERMISSION_COUNT_AR[countForm(permissions.length)], { n: permissions.length });
  return `${permissions.length} permission${permissions.length === 1 ? "" : "s"}`;
}
