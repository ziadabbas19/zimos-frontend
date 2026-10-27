import { serverApiBase, serverApiFetch } from "./server-api";

/**
 * The plans on offer, from the API's public list (GET /plans/public): active
 * plans an admin marked "show at sign-up", in their display order. Prices are
 * in minor units of the plan's currency (piastres, cents), like every amount
 * the API sends.
 */
export type PlanFeatureKey =
  | "custom_domain"
  | "funnels"
  | "whatsapp_confirmation"
  | "abandoned_cart"
  | "multi_warehouse"
  | "api_access"
  | "staff_accounts"
  | "advanced_analytics"
  | "visitor_insights"
  | "remove_branding"
  | "priority_support"
  | "loyalty";

export interface PublicPlan {
  id: string;
  name: string;
  currency: string;
  monthlyPrice: number;
  yearlyPrice: number;
  trialDays: number;
  maxStores: number | null;
  maxFunnelsPerMonth: number | null;
  softOrderQuota: number | null;
  features: PlanFeatureKey[];
}

/** Every page that shows prices is regenerated at most this often. */
export const PLANS_REVALIDATE_SECONDS = 300;

/**
 * Read on the server, so the prices are in the page's HTML for visitors,
 * reviewers and search engines alike. Null when the API can't be reached or
 * answers oddly — the page then says prices are coming soon, never an error.
 * On the API's private address when INTERNAL_API_BASE_URL is set (lib/server-api).
 */
export async function getPublicPlans(): Promise<PublicPlan[] | null> {
  try {
    const res = await serverApiFetch(
      `${serverApiBase()}/plans/public`,
      { next: { revalidate: PLANS_REVALIDATE_SECONDS } },
      { timeoutMs: 8000 }
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { plans?: unknown };
    return Array.isArray(body.plans) ? (body.plans as PublicPlan[]) : null;
  } catch {
    return null;
  }
}
