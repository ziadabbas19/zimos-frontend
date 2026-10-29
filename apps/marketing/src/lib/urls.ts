/**
 * The one place the marketing site knows where the merchant dashboard lives.
 * Every "Sign in" / "Start free" link points here.
 */
export const DASHBOARD_URL = "https://app.zimos.co";

/** This site's own address, for absolute URLs (canonical links, the sitemap). */
export const SITE_URL = "https://zimos.co";

export const REGISTER_URL = `${DASHBOARD_URL}/register`;
export const LOGIN_URL = `${DASHBOARD_URL}/login`;

/** Sign-up with a plan already chosen: the dashboard's form starts on it. */
export function registerUrlFor(planId: string, cycle: "monthly" | "yearly"): string {
  return `${REGISTER_URL}?${new URLSearchParams({ plan: planId, cycle }).toString()}`;
}

/**
 * Sign-up from the pay-per-order card: the same form, with the plan named and
 * no cycle (it has none). The plan itself is chosen in the dashboard's My Plan
 * after sign-up: the sign-up form offers the monthly and yearly plans only.
 */
export function registerUrlForPayPerOrder(planId: string): string {
  return `${REGISTER_URL}?${new URLSearchParams({ plan: planId }).toString()}`;
}

/**
 * The API's public address, the same variable the storefront uses for the
 * same API. The browser's visit counting calls it; the server's own calls
 * start on lib/server-api's address (INTERNAL_API_BASE_URL when set) and fall
 * back to this one.
 */
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1").replace(/\/$/, "");
