/**
 * Where shoppers sign up for a store's marketing emails, chosen by the
 * merchant (backend: src/modules/emailCampaigns/signupSettings.js,
 * signupService.js, EMAIL_CAMPAIGNS_ENABLED). Same gate as the campaigns
 * (endpoints/emailCampaigns.ts): 404 while off, 403 PLAN_FEATURE_REQUIRED
 * without the plan's `email_campaigns`, discounts.manage.
 *
 * The places: the checkout box (on unless switched off), the same box in a
 * product page's quick order form and in the cart, a footer form, and a
 * popup. A box place may start ticked; what the box shows when the order is
 * placed is what the server records.
 */
import type { ApiClient } from "../client";

export type EmailSignupBoxPlace = "checkout" | "quickOrder" | "cart";
export type EmailSignupPlace = EmailSignupBoxPlace | "footer" | "popup";
/** Where a consent came from, as the server records it. */
export type EmailSignupSource = "checkout" | "quick_order" | "cart" | "footer" | "popup";
export type EmailSignupPopupTrigger = "delay" | "exit_intent";

export const EMAIL_SIGNUP_SOURCES: readonly EmailSignupSource[] = ["checkout", "quick_order", "cart", "footer", "popup"];
export const EMAIL_SIGNUP_POPUP_DELAY = { min: 3, max: 120 } as const;

/** The merchant's words, per language; null = the storefront's own default. */
export interface EmailSignupCopy {
  /** The box's words, or the footer and popup heading (≤ 160). */
  label: string | null;
  /** A short line about privacy (≤ 240). */
  privacy: string | null;
  /** "Get 10% off your next order" — shown only, no coupon is made (≤ 120). */
  incentive: string | null;
}

export interface EmailSignupSettings {
  checkout: { enabled: boolean; preTicked: boolean };
  quickOrder: { enabled: boolean; preTicked: boolean };
  cart: { enabled: boolean; preTicked: boolean };
  footer: { enabled: boolean };
  popup: { enabled: boolean; trigger: EmailSignupPopupTrigger; delaySeconds: number };
  text: { ar: EmailSignupCopy; en: EmailSignupCopy };
}

const NO_COPY: EmailSignupCopy = { label: null, privacy: null, incentive: null };

/** What a store that never saved the section has (the server's defaults). */
export const EMAIL_SIGNUP_DEFAULTS: EmailSignupSettings = {
  checkout: { enabled: true, preTicked: false },
  quickOrder: { enabled: false, preTicked: false },
  cart: { enabled: false, preTicked: false },
  footer: { enabled: false },
  popup: { enabled: false, trigger: "delay", delaySeconds: 15 },
  text: { ar: NO_COPY, en: NO_COPY },
};

export interface EmailSignupStats {
  /** Addresses a campaign to everyone subscribed reaches now. */
  subscribers: number;
  /** Where their consent came from; `other` = before sources were kept, or elsewhere (account, forms…). */
  bySource: Record<EmailSignupSource | "other", number>;
}

export interface EmailSignupView {
  settings: EmailSignupSettings;
  stats: EmailSignupStats;
  /** "hidden": the order form asks for no email, so the checkout and quick order boxes are not shown. */
  checkoutEmailField: "hidden" | "optional" | "required";
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/email-campaigns/signup`;

/** GET /workspaces/:ws/email-campaigns/signup */
export function emailSignupGet(client: ApiClient, workspaceId: string) {
  return client.request<EmailSignupView>(base(workspaceId));
}

/** PUT /workspaces/:ws/email-campaigns/signup — the settings, whole. Answers like the GET. */
export function emailSignupSave(client: ApiClient, workspaceId: string, settings: EmailSignupSettings) {
  return client.request<EmailSignupView>(base(workspaceId), { method: "PUT", body: settings });
}

// ------------------------------------------------------------ storefront --

/** GET /store/:ws → `emailSignup`: each place switched on (null for one that is off). */
export interface StoreEmailSignup {
  checkout: { preTicked: boolean } | null;
  quickOrder: { preTicked: boolean } | null;
  cart: { preTicked: boolean } | null;
  footer: Record<string, never> | null;
  popup: { trigger: EmailSignupPopupTrigger; delaySeconds: number } | null;
  text: { ar: EmailSignupCopy; en: EmailSignupCopy };
}

/**
 * The store's signup places: null while the feature is off or the plan lacks
 * it; undefined from an API older than the places (it showed the checkout
 * box, unticked, and nothing else).
 */
export function storeEmailSignupOf(store: unknown): StoreEmailSignup | null | undefined {
  if (!store || typeof store !== "object" || !("emailSignup" in store)) return undefined;
  const value = (store as { emailSignup?: unknown }).emailSignup;
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<StoreEmailSignup>;
  const box = (b: unknown) => (b && typeof b === "object" ? { preTicked: (b as { preTicked?: unknown }).preTicked === true } : null);
  const popup = v.popup && typeof v.popup === "object" ? v.popup : null;
  const copy = (c: unknown): EmailSignupCopy => {
    const o = (c && typeof c === "object" ? c : {}) as Partial<EmailSignupCopy>;
    const str = (x: unknown) => (typeof x === "string" && x.trim() ? x : null);
    return { label: str(o.label), privacy: str(o.privacy), incentive: str(o.incentive) };
  };
  return {
    checkout: box(v.checkout),
    quickOrder: box(v.quickOrder),
    cart: box(v.cart),
    footer: v.footer && typeof v.footer === "object" ? {} : null,
    popup: popup
      ? {
          trigger: popup.trigger === "exit_intent" ? "exit_intent" : "delay",
          delaySeconds: typeof popup.delaySeconds === "number" && popup.delaySeconds > 0 ? popup.delaySeconds : EMAIL_SIGNUP_DEFAULTS.popup.delaySeconds,
        }
      : null,
    text: { ar: copy(v.text?.ar), en: copy(v.text?.en) },
  };
}

/**
 * POST /store/:ws/email-signup — the footer or popup form. The answer is the
 * same whether or not the address was known (`{ ok: true }`); 422 for an
 * address the server can't take, 404 for a place switched off, 429 for too many.
 * `website` is the honeypot: left empty by people.
 */
export function storefrontEmailSignup(client: ApiClient, workspaceId: string, body: { email: string; source: "footer" | "popup"; website?: string }) {
  return client.request<{ ok: true }>(`/store/${workspaceId}/email-signup`, { method: "POST", body, auth: false });
}
