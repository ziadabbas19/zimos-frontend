/**
 * Features that ship switched off and are turned on per deploy with a build
 * variable. Anything but the exact string "true" leaves a feature off, and
 * off means the console shows nothing of it.
 */

/**
 * Two-step sign-in: the code step at console sign-in, and support's reset on
 * a person's page. Pairs with the API's TWO_FACTOR_ENABLED (and NEW_DEVICE_CODE).
 */
export const TWO_FACTOR_ENABLED = import.meta.env.VITE_TWO_FACTOR_ENABLED === "true";

/**
 * Store traffic: every store's storefront visitors (where from, governorate,
 * device, time per page, the funnel, campaigns, outcomes per governorate) and
 * what the API's events guard kept out. Pairs with the API's
 * TRAFFIC_DETAILS_ENABLED and TRAFFIC_GUARD_ENABLED, which fill it.
 */
export const STORE_TRAFFIC_ENABLED = import.meta.env.VITE_STORE_TRAFFIC_ENABLED === "true";

/**
 * Site traffic in detail: zimos.co visits laid out as Store traffic (filters,
 * each visit in order with its account, campaigns, what the beacon's guard
 * kept out). Pairs with the API's SITE_TRAFFIC_DETAILS_ENABLED, which fills
 * it; off, the page is the summary it was.
 */
export const SITE_TRAFFIC_DETAILS_ENABLED = import.meta.env.VITE_SITE_TRAFFIC_DETAILS_ENABLED === "true";

/**
 * The bell on the API's live updates (its REALTIME_ENABLED): a sign-up, a paid
 * subscription or a new support ticket updates the count at once, for the
 * accounts whose permissions open those pages. While connected the count is
 * also read when the tab comes back and every 5 minutes (the other kinds of
 * notification are not sent live); while the connection is down, every 30
 * seconds. Off: the count is read every 60 seconds, as before.
 */
export const CONSOLE_REALTIME_ENABLED = import.meta.env.VITE_CONSOLE_REALTIME_ENABLED === "true";
