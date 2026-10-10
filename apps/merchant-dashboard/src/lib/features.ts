/**
 * Features that ship switched off and are turned on per deploy with a build
 * variable. Anything but the exact string "true" leaves a feature off, and
 * off means the dashboard shows nothing of it.
 */

/** Merchant-owned domains: the Domains tab in Store settings and its setup step. Pairs with the storefront's CUSTOM_DOMAINS_ENABLED. */
export const CUSTOM_DOMAINS_ENABLED = import.meta.env.VITE_CUSTOM_DOMAINS_ENABLED === "true";

/**
 * The AI features: AI studio, the AI description, translation and funnel
 * helpers, and the WhatsApp reply bot. Off, every entry point is hidden and
 * /ai and /inbox/bot go home. Turn on only once the API runs with AI_ENABLED.
 */
export const AI_ENABLED = import.meta.env.VITE_AI_ENABLED === "true";

/*
 * Screens ported from the zimos-additions branch, one switch per group. Each
 * pairs with the API switch of the same name without the VITE_ prefix and is
 * turned on only after that API part is live. Until a group's screens land,
 * its switch hides nothing because nothing reads it yet.
 */

/** Two-step sign-in: the code step at sign-in, Security in Settings, backup codes, and the console reset. */
export const TWO_FACTOR_ENABLED = import.meta.env.VITE_TWO_FACTOR_ENABLED === "true";

/** Sending a store's other domains to its primary one. Shown only when CUSTOM_DOMAINS_ENABLED is on too. */
export const DOMAIN_REDIRECT_ENABLED = import.meta.env.VITE_DOMAIN_REDIRECT_ENABLED === "true";

/** Size charts: the list, the editor, and the chart on product pages. */
export const SIZE_CHARTS_ENABLED = import.meta.env.VITE_SIZE_CHARTS_ENABLED === "true";

/** Shoppers' questions on products, and the team's answers. */
export const PRODUCT_QUESTIONS_ENABLED = import.meta.env.VITE_PRODUCT_QUESTIONS_ENABLED === "true";

/** Product specifications: the shared list and the table on product pages. */
export const PRODUCT_SPECS_ENABLED = import.meta.env.VITE_PRODUCT_SPECS_ENABLED === "true";

/** "Tell me when it is back" sign-ups on sold-out products (email only, no push). */
export const STOCK_ALERTS_ENABLED = import.meta.env.VITE_STOCK_ALERTS_ENABLED === "true";

/** Taking orders for products not in stock yet. */
export const PREORDERS_ENABLED = import.meta.env.VITE_PREORDERS_ENABLED === "true";

/** Closing the store for a holiday, with a notice to shoppers. */
export const HOLIDAY_MODE_ENABLED = import.meta.env.VITE_HOLIDAY_MODE_ENABLED === "true";

/** Redirects from old store addresses to new ones. */
export const URL_REDIRECTS_ENABLED = import.meta.env.VITE_URL_REDIRECTS_ENABLED === "true";

/** Least and most a shopper may buy of a product. */
export const PURCHASE_LIMITS_ENABLED = import.meta.env.VITE_PURCHASE_LIMITS_ENABLED === "true";

/** Gift wrap and a gift message at checkout. */
export const GIFT_OPTIONS_ENABLED = import.meta.env.VITE_GIFT_OPTIONS_ENABLED === "true";

/** Gift cards: issuing, balances, and paying with one at checkout. */
export const GIFT_CARDS_ENABLED = import.meta.env.VITE_GIFT_CARDS_ENABLED === "true";

/** The store blog: posts, categories, and the blog pages. */
export const BLOG_ENABLED = import.meta.env.VITE_BLOG_ENABLED === "true";

/** The messages a customer was sent about an order (email, SMS, WhatsApp) on its timeline, and whether each arrived. */
export const ORDER_MESSAGES_ENABLED = import.meta.env.VITE_ORDER_MESSAGES_ENABLED === "true";

/** The language each order email is sent in. */
export const ORDER_EMAIL_LOCALES_ENABLED = import.meta.env.VITE_ORDER_EMAIL_LOCALES_ENABLED === "true";

/** Addresses that stopped receiving email (bounces and complaints). */
export const EMAIL_SUPPRESSIONS_ENABLED = import.meta.env.VITE_EMAIL_SUPPRESSIONS_ENABLED === "true";

/** Custom headers on outgoing webhooks. */
export const WEBHOOK_HEADERS_ENABLED = import.meta.env.VITE_WEBHOOK_HEADERS_ENABLED === "true";

/** The block designer for order emails. */
export const ORDER_EMAIL_DESIGN_ENABLED = import.meta.env.VITE_ORDER_EMAIL_DESIGN_ENABLED === "true";

/** Shopper accounts and wishlists: the settings here and the account pages in the store. */
export const SHOPPER_ACCOUNTS_ENABLED = import.meta.env.VITE_SHOPPER_ACCOUNTS_ENABLED === "true";

/** Loyalty points. Needs SHOPPER_ACCOUNTS_ENABLED. */
export const LOYALTY_ENABLED = import.meta.env.VITE_LOYALTY_ENABLED === "true";

/** VIP tiers. Needs SHOPPER_ACCOUNTS_ENABLED. */
export const VIP_TIERS_ENABLED = import.meta.env.VITE_VIP_TIERS_ENABLED === "true";

/** Store credit. Needs SHOPPER_ACCOUNTS_ENABLED. */
export const STORE_CREDIT_ENABLED = import.meta.env.VITE_STORE_CREDIT_ENABLED === "true";

/** Shoppers inviting friends. Needs SHOPPER_ACCOUNTS_ENABLED. */
export const CUSTOMER_REFERRALS_ENABLED = import.meta.env.VITE_CUSTOMER_REFERRALS_ENABLED === "true";

/** Returns and exchanges that shoppers request themselves. */
export const SHOPPER_RETURNS_ENABLED = import.meta.env.VITE_SHOPPER_RETURNS_ENABLED === "true";

/** Shipment tracking through an outside tracking service. */
export const TRACKING_PROVIDERS_ENABLED = import.meta.env.VITE_TRACKING_PROVIDERS_ENABLED === "true";

/** The X, Reddit, Microsoft and Pinterest pixels, and the GTM container. */
export const AD_PIXELS_ENABLED = import.meta.env.VITE_AD_PIXELS_ENABLED === "true";

/** Store reports, scheduled reports, and customer segments (RFM). */
export const STORE_REPORTS_ENABLED = import.meta.env.VITE_STORE_REPORTS_ENABLED === "true";

/**
 * The lost orders page's "When a checkout counts as lost" tool: the minutes of
 * silence after which a checkout is listed as lost, saved on the store
 * (`settings.fraud_rules.abandoned_after_minutes`, which the API already
 * takes from a role with workspace.manage). Off: the tool is not offered and
 * the store keeps the value it has (15 minutes unless it was set).
 */
export const LOST_ORDER_TIMING_ENABLED = import.meta.env.VITE_LOST_ORDER_TIMING_ENABLED === "true";
