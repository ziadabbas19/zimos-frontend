import { serverApiBase, serverApiFetch } from "./server-api";
import { PLANS_REVALIDATE_SECONDS, readOffer, type PublicOffer, type PublicPlan } from "./plan-offer";

export { PLANS_REVALIDATE_SECONDS, readOffer } from "./plan-offer";
export type { PayPerOrderPlan, PlanFeatureKey, PublicOffer, PublicPlan } from "./plan-offer";

/**
 * Read on the server, so the prices are in the page's HTML for visitors,
 * reviewers and search engines alike. Null when the API can't be reached or
 * answers oddly — the page then says prices are coming soon, never an error.
 * On the API's private address when INTERNAL_API_BASE_URL is set (lib/server-api).
 */
export async function getPublicOffer(): Promise<PublicOffer | null> {
  try {
    const res = await serverApiFetch(
      `${serverApiBase()}/plans/public`,
      { next: { revalidate: PLANS_REVALIDATE_SECONDS } },
      { timeoutMs: 8000 }
    );
    if (!res.ok) return null;
    return readOffer(await res.json());
  } catch {
    return null;
  }
}

/** The list alone (getPublicOffer's `plans`). */
export async function getPublicPlans(): Promise<PublicPlan[] | null> {
  const offer = await getPublicOffer();
  return offer ? offer.plans : null;
}
