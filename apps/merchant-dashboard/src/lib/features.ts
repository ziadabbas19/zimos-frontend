/**
 * Features that ship switched off and are turned on per deploy with a build
 * variable. Anything but the exact string "true" leaves a feature off, and
 * off means the dashboard shows nothing of it.
 */

/**
 * Merchant-owned domains: the Domains tab in Store settings and its setup step.
 * Turn on only once the API runs with its own CUSTOM_DOMAINS_ENABLED: while that
 * is off the API answers every domains route with 404 and the tab says the
 * feature is not available. The storefront's CUSTOM_DOMAINS_ENABLED goes on with them.
 */
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

/** Two-step sign-in: the code step at sign-in, its part of Security in Settings (the section itself is always there), backup codes, and the console reset. */
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

/**
 * Tills and kitchens on the public API: the API key option for the order's
 * kitchen status (orders:pos_status). Turn on with the API's PUBLIC_API_ACK_ENABLED.
 */
export const PUBLIC_API_ACK_ENABLED = import.meta.env.VITE_PUBLIC_API_ACK_ENABLED === "true";

/**
 * Each menu choice's code in the merchant's till, sent with the order's
 * options to integrations. Turn on with the API's ORDER_PAYLOAD_OPTIONS_ENABLED.
 */
export const ORDER_PAYLOAD_OPTIONS_ENABLED = import.meta.env.VITE_ORDER_PAYLOAD_OPTIONS_ENABLED === "true";

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

/**
 * The confirmation queue's calling station: one order on the screen at a time
 * with the result of the call as one press, the next order coming by itself.
 * On: a role that takes calls gets it on the waiting tab (and a switch back to
 * the list). Off: the queue is the list for everyone, as it always was. Both
 * make the same requests; the station claims an order when Call, WhatsApp or a
 * result is pressed.
 */
export const CONFIRMATION_STATION_ENABLED = import.meta.env.VITE_CONFIRMATION_STATION_ENABLED === "true";

/*
 * Our own additions to the website builder. No API switch pairs with this one:
 * what it writes goes into the page's own props, which the API keeps as they are.
 */

/**
 * The picture slider's newer settings in the website editor: where the text
 * sits on a phone, the veil over the picture, and a background video. Turn on
 * together with the storefront's NEXT_PUBLIC_HERO_MEDIA_ENABLED, which is what draws them.
 */
export const HERO_MEDIA_ENABLED = import.meta.env.VITE_HERO_MEDIA_ENABLED === "true";

/**
 * The Store look's "Navigation" choice in the website editor: the bar across
 * the top, which every store has, or a column beside the page on a wide
 * screen. It is saved with the look (`themeSettings.header.layout`), which the
 * API keeps as it is. Off: the choice is not offered, and a store keeps
 * whichever layout it has saved. Turn on together with the storefront's
 * NEXT_PUBLIC_STORE_SIDEBAR_ENABLED, which is what draws the column.
 */
export const STORE_SIDEBAR_ENABLED = import.meta.env.VITE_STORE_SIDEBAR_ENABLED === "true";

/**
 * A shape for new pictures in the website editor: a block added from the
 * library gives its full-width pictures a 4:3 box (the `ratio` the storefront
 * already reads), so whatever file the merchant then puts in fills that box
 * instead of stretching the section to the file's own height. Off: a new
 * picture names no shape and keeps the file's own, as before. Pages already
 * saved are never touched either way, and a picture that is given a size
 * (an icon, a logo) keeps its own shape. No storefront or API switch pairs
 * with it: it only decides what the editor writes for a new block.
 */
export const PICTURE_SHAPE_DEFAULT_ENABLED = import.meta.env.VITE_PICTURE_SHAPE_DEFAULT_ENABLED === "true";

/**
 * The website editor offers only the imported templates' bands ("xs" looks):
 * the side library lists those and the basic elements, and Zimos's own ready
 * styles, store themes and the store theme row are not shown. Pages that use
 * Zimos's own blocks keep them and can still be edited; nothing is deleted.
 * Off: every block, style and theme is offered as before, and a store that
 * wears an imported template also finds that template's bands in the library.
 * No storefront or API switch pairs with it.
 */
export const XS_ONLY_ENABLED = import.meta.env.VITE_XS_ONLY_ENABLED === "true";

/**
 * ZIMOS's social accounts on the support page come from the console's
 * "Platform settings" (the API's public GET /platform-settings/public) instead
 * of the list in packages/ui/src/social-links/config.ts. Off: that list, as
 * before. On, the code's list is still what shows when the API is off, down or
 * the links were never saved. Turn on once the API runs with
 * PLATFORM_SETTINGS_ENABLED.
 */
export const PLATFORM_SETTINGS_ENABLED = import.meta.env.VITE_PLATFORM_SETTINGS_ENABLED === "true";

/**
 * Visitors (Analytics → Visitors): the store's own visitors — where they came
 * from, their governorate (approximate from the IP, then from their order),
 * device, time on each page and product, the funnel, campaigns with cost per
 * order, and how orders ended per governorate. Off, no menu entry and no
 * route. Filled by the API's TRAFFIC_DETAILS_ENABLED and the storefront's
 * NEXT_PUBLIC_DWELL_TRACKING_ENABLED.
 */
export const VISITORS_ENABLED = import.meta.env.VITE_VISITORS_ENABLED === "true";

/**
 * Live updates: one connection to the API's live updates (its REALTIME_ENABLED)
 * for the whole dashboard. A new, paid or moved order refreshes the orders
 * list, the counts and the Confirmation queue badge at once, with a toast and
 * the new-order sound when the teammate turned it on (Settings → My
 * notifications). While the connection is down they are read every 30
 * seconds instead. Off: no connection, and every screen polls as it always
 * has. Turn on only once the API runs with REALTIME_ENABLED.
 */
export const REALTIME_ENABLED = import.meta.env.VITE_REALTIME_ENABLED === "true";

/**
 * Device notifications (Web Push): "Notifications on this device" and "My
 * devices" in Settings → My notifications, the "Push" column there, the
 * install advice (a banner on an iPhone or iPad), the app's manifest and its
 * service worker (public/sw.js, notifications only — no fetch handler, no
 * cache). Shown only while the API's /me/push/config answers too (its
 * PUSH_ENABLED and VAPID keys): a 404 there hides all of it. Off: none of it,
 * the "Push" column stays hidden even if the API offers it, and a service
 * worker a browser kept from an earlier build is unregistered (lib/push).
 */
export const PUSH_ENABLED = import.meta.env.VITE_PUSH_ENABLED === "true";
