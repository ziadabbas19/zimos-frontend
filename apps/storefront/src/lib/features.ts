/**
 * Store features that ship switched off and are turned on per deploy with a
 * build variable. Anything but the exact string "true" leaves a feature off,
 * and off means the store shows and sends nothing of it. Each pairs with the
 * dashboard's VITE_ switch and the API switch of the same name.
 */

/** Shopper accounts (sign-in, account pages, wishlist). Off, no shopper token is kept, read or sent. */
export const SHOPPER_ACCOUNTS_ENABLED = process.env.NEXT_PUBLIC_SHOPPER_ACCOUNTS_ENABLED === "true";

/*
 * The store side of the features ported from zimos-additions. Each pairs with
 * the dashboard's VITE_ switch of the same name and with its name in the
 * API's STORE_FEATURES list; off, the store shows and sends nothing of it.
 */

/** The "Size guide" link on a product page. */
export const SIZE_CHARTS_ENABLED = process.env.NEXT_PUBLIC_SIZE_CHARTS_ENABLED === "true";

/** Shoppers' questions and the store's answers on a product page. */
export const PRODUCT_QUESTIONS_ENABLED = process.env.NEXT_PUBLIC_PRODUCT_QUESTIONS_ENABLED === "true";

/** The specifications table on a product page. */
export const PRODUCT_SPECS_ENABLED = process.env.NEXT_PUBLIC_PRODUCT_SPECS_ENABLED === "true";

/** "Tell me when it is back" on a sold-out product (email or SMS, no push). */
export const STOCK_ALERTS_ENABLED = process.env.NEXT_PUBLIC_STOCK_ALERTS_ENABLED === "true";

/** Ordering a sold-out product ahead, with its ship date. */
export const PREORDERS_ENABLED = process.env.NEXT_PUBLIC_PREORDERS_ENABLED === "true";

/** The holiday banner, and paused or late-shipping orders. */
export const HOLIDAY_MODE_ENABLED = process.env.NEXT_PUBLIC_HOLIDAY_MODE_ENABLED === "true";

/** Following the store's redirects from an address that is not there. */
export const URL_REDIRECTS_ENABLED = process.env.NEXT_PUBLIC_URL_REDIRECTS_ENABLED === "true";

/** The least and most of a product one order may hold, said before the order is placed. */
export const PURCHASE_LIMITS_ENABLED = process.env.NEXT_PUBLIC_PURCHASE_LIMITS_ENABLED === "true";

/** Gift wrap and a gift message at checkout. */
export const GIFT_OPTIONS_ENABLED = process.env.NEXT_PUBLIC_GIFT_OPTIONS_ENABLED === "true";

/** Paying part of an order with a gift card (cash on delivery only), and the balance page. */
export const GIFT_CARDS_ENABLED = process.env.NEXT_PUBLIC_GIFT_CARDS_ENABLED === "true";

/** The store blog: the posts list and each post's page. */
export const BLOG_ENABLED = process.env.NEXT_PUBLIC_BLOG_ENABLED === "true";

/** Loyalty points: the points tab of the account, earning notes, and points at checkout (cash on delivery). Needs shopper accounts. */
export const LOYALTY_ENABLED = process.env.NEXT_PUBLIC_LOYALTY_ENABLED === "true";

/** VIP levels: the level tab of the account and the level's perks said at checkout. Needs shopper accounts. */
export const VIP_TIERS_ENABLED = process.env.NEXT_PUBLIC_VIP_TIERS_ENABLED === "true";

/** Store credit: the credit tab of the account and paying with it at checkout (cash on delivery). Needs shopper accounts. */
export const STORE_CREDIT_ENABLED = process.env.NEXT_PUBLIC_STORE_CREDIT_ENABLED === "true";

/** Shoppers inviting friends: the invite tab, the banner of a `?ref=` link and the invite at checkout. Needs shopper accounts. */
export const CUSTOMER_REFERRALS_ENABLED = process.env.NEXT_PUBLIC_CUSTOMER_REFERRALS_ENABLED === "true";

/** A shopper asks for a return (or an exchange) from the tracking page and from their account's order. */
export const SHOPPER_RETURNS_ENABLED = process.env.NEXT_PUBLIC_SHOPPER_RETURNS_ENABLED === "true";

/** The extra ad platforms' pixels: Pinterest, X, Taboola, Outbrain, Kwai, Reddit and Microsoft Ads. */
export const AD_PIXELS_ENABLED = process.env.NEXT_PUBLIC_AD_PIXELS_ENABLED === "true";

/*
 * Our own additions to the website builder. No API switch pairs with this one:
 * what it reads is stored in the page's own props, which the API keeps as they are.
 */

/**
 * The hero slider's newer settings: where the text sits on a phone, the veil
 * over the picture, and a background video. With it on, a slide that has text
 * and sets no veil also gets a default one, and the heading is larger on a
 * computer. Off, none of these is read or drawn, whatever a slide's props
 * hold. Pairs with the dashboard's VITE_HERO_MEDIA_ENABLED.
 */
export const HERO_MEDIA_ENABLED = process.env.NEXT_PUBLIC_HERO_MEDIA_ENABLED === "true";

/**
 * The store's side columns. On the product listing: the chosen filters as
 * chips over the grid, the sort inside the filter column, and on a phone a
 * bottom sheet whose choices wait for "Apply". Store-wide: the side
 * navigation a store can pick in its look (`themeSettings.header.layout`).
 * Off, the listing and the header are exactly as before, whatever the store
 * saved. Pairs with the dashboard's VITE_STORE_SIDEBAR_ENABLED, which offers the choice.
 */
export const STORE_SIDEBAR_ENABLED = process.env.NEXT_PUBLIC_STORE_SIDEBAR_ENABLED === "true";

/**
 * Visible time per page for the Visitors screens: each page view gets an id,
 * and its time on screen (counted only while the tab is visible) is reported
 * when the next page is viewed, when the tab is hidden and when the page goes
 * away; the batch also says when the browser is driven by automation. Off,
 * the tracker sends exactly what it always has. Pairs with the API's
 * TRAFFIC_DETAILS_ENABLED (without it the reports are dropped).
 */
export const DWELL_TRACKING_ENABLED = process.env.NEXT_PUBLIC_DWELL_TRACKING_ENABLED === "true";

/**
 * Loading shapes while the store moves between its main pages: a click on a
 * link to the front page, all products, a product or the cart shows that
 * page's skeleton (components/Skeleton) in place of the page being left, until
 * the new one is drawn. Only on a navigation inside the store: the first
 * load is the server's whole page as before, so its HTML, status codes and
 * largest paint are untouched. Off, links and pages are exactly as before.
 */
export const STORE_SKELETONS_ENABLED = process.env.NEXT_PUBLIC_STORE_SKELETONS_ENABLED === "true";
