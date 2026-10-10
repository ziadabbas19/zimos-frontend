import {
  PROTECTION_NUMBER_RULES,
  PROTECTION_SWITCH_RULES,
  type CheckoutOtpSettings,
  type ProtectionAction,
  type ProtectionNumberRule,
  type ProtectionRuleKey,
  type ProtectionRules,
  type ProtectionSwitchRule,
} from "@store-builder/api-client";

/**
 * Role keys allowed to change the rules. The backend's real test is the
 * workspace.manage permission, which the dashboard can't see (GET /workspaces
 * exposes only the role key) — these are the two system roles that carry it.
 * A 403 on save flips an editable form to read-only too.
 */
export const EDITOR_ROLES: ReadonlySet<string> = new Set(["owner", "workspace_manager"]);

/** Backend bounds (workspaceValidation.js) and the value a rule starts at when switched on. */
export const NUMBER_BOUNDS: Record<ProtectionNumberRule, { min: number; max: number; initial: number }> = {
  duplicate_window_minutes: { min: 1, max: 10080, initial: 60 },
  max_orders_per_phone_per_day: { min: 1, max: 100, initial: 3 },
  high_rejection_threshold: { min: 1, max: 100, initial: 3 },
  max_items_per_order: { min: 1, max: 1000, initial: 5 },
  min_minutes_between_cod_orders_per_ip: { min: 1, max: 10080, initial: 10 },
  min_network_delivery_rate: { min: 1, max: 100, initial: 40 },
};

export type RuleGroupKey = "orderRules" | "visitorRules" | "customerRules";

/** The nine rules, in the three groups the page shows them in. */
export const GROUPS: ReadonlyArray<{ title: RuleGroupKey; rules: ReadonlyArray<ProtectionRuleKey> }> = [
  { title: "orderRules", rules: ["duplicate_window_minutes", "max_orders_per_phone_per_day", "max_items_per_order", "high_risk"] },
  { title: "visitorRules", rules: ["min_minutes_between_cod_orders_per_ip", "block_outside_country", "block_vpn"] },
  { title: "customerRules", rules: ["high_rejection_threshold", "min_network_delivery_rate"] },
];

export function isNumberRule(key: ProtectionRuleKey): key is ProtectionNumberRule {
  return (PROTECTION_NUMBER_RULES as readonly string[]).includes(key);
}

/** The form's working copy of the rules. */
export interface Draft {
  block_blacklisted: boolean;
  strictPhone: boolean;
  countries: string;
  blockedCountries: string;
  botProtection: boolean;
  botCaptcha: boolean;
  otp: CheckoutOtpSettings;
  on: Record<ProtectionRuleKey, boolean>;
  /** Raw input text of the number rules. */
  values: Record<ProtectionNumberRule, string>;
  actions: Record<ProtectionRuleKey, ProtectionAction>;
}

export function toDraft(rules: ProtectionRules): Draft {
  const on = {} as Record<ProtectionRuleKey, boolean>;
  const values = {} as Record<ProtectionNumberRule, string>;
  for (const key of PROTECTION_NUMBER_RULES) {
    on[key] = rules.numbers[key] != null;
    values[key] = String(rules.numbers[key] ?? NUMBER_BOUNDS[key].initial);
  }
  for (const key of PROTECTION_SWITCH_RULES) on[key] = rules.switches[key];
  return {
    block_blacklisted: rules.block_blacklisted,
    strictPhone: rules.phone_validation === "strict",
    countries: rules.allowed_countries.join(", "),
    blockedCountries: rules.blocked_countries.join(", "),
    // Unset means the platform default, which is on for a live store.
    botProtection: rules.bot_protection !== false,
    botCaptcha: rules.bot_captcha,
    otp: { ...rules.checkout_otp },
    on,
    values,
    actions: { ...rules.actions },
  };
}

/** ISO-2 codes out of a typed list ("EG, SA"), or null when something in it is not one. */
export function parseCountries(text: string): string[] | null {
  const parts = text
    .split(/[\s,،]+/)
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean);
  if (parts.some((p) => !/^[A-Z]{2}$/.test(p))) return null;
  return [...new Set(parts)];
}

export function toRules(draft: Draft): ProtectionRules {
  const numbers = {} as Record<ProtectionNumberRule, number | null>;
  for (const key of PROTECTION_NUMBER_RULES) numbers[key] = draft.on[key] ? Number(draft.values[key]) : null;
  const switches = {} as Record<ProtectionSwitchRule, boolean>;
  for (const key of PROTECTION_SWITCH_RULES) switches[key] = draft.on[key];
  return {
    block_blacklisted: draft.block_blacklisted,
    phone_validation: draft.strictPhone ? "strict" : "off",
    allowed_countries: parseCountries(draft.countries) ?? [],
    blocked_countries: parseCountries(draft.blockedCountries) ?? [],
    bot_protection: draft.botProtection,
    bot_captcha: draft.botCaptcha,
    checkout_otp: { ...draft.otp },
    numbers,
    switches,
    actions: { ...draft.actions },
  };
}

export function rangeProblem(key: ProtectionNumberRule, draft: Draft): boolean {
  if (!draft.on[key]) return false;
  const text = draft.values[key].trim();
  if (!/^\d+$/.test(text)) return true;
  const n = Number(text);
  return n < NUMBER_BOUNDS[key].min || n > NUMBER_BOUNDS[key].max;
}
