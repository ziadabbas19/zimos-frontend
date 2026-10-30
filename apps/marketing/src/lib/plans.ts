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
  | "loyalty"
  | "reviews"
  | "about_gallery"
  | "combos"
  | "advanced_coupons";

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

/**
 * The pay-per-order plan, sent beside the list (`payPerOrder`), never in it:
 * nothing monthly, a fee for each order from a prepaid balance. The API sends
 * it only while the plan is active and shown at sign-up and the prepaid
 * balance is switched on (WALLET_ENABLED), so it is exactly the one merchants
 * can choose in their dashboard. An API from before it sends nothing.
 */
export interface PayPerOrderPlan {
  id: string;
  name: string;
  currency: string;
  /** The fee for one order, in minor units. */
  feePerOrder: number;
  /** Orders a store places free before any fee — the console's "Free orders per store". */
  freeOrders: number;
  /** When the fee leaves the balance: when the order is confirmed, or when it is placed. */
  feeChargedAt: "confirmation" | "placement";
}

export interface PublicOffer {
  plans: PublicPlan[];
  payPerOrder: PayPerOrderPlan | null;
}

/** Every page that shows prices is regenerated at most this often. */
export const PLANS_REVALIDATE_SECONDS = 300;

const isCount = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;

/** The API's `payPerOrder`, or null for anything else (absent, null, or not what this page can show honestly). */
function readPayPerOrder(value: unknown): PayPerOrderPlan | null {
  if (!value || typeof value !== "object") return null;
  const plan = value as Record<string, unknown>;
  if (typeof plan.id !== "string" || typeof plan.name !== "string" || typeof plan.currency !== "string") return null;
  if (!isCount(plan.feePerOrder) || plan.feePerOrder === 0 || !isCount(plan.freeOrders)) return null;
  if (plan.feeChargedAt !== "confirmation" && plan.feeChargedAt !== "placement") return null;
  return {
    id: plan.id,
    name: plan.name,
    currency: plan.currency,
    feePerOrder: plan.feePerOrder,
    freeOrders: plan.freeOrders,
    feeChargedAt: plan.feeChargedAt,
  };
}

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
    const body = (await res.json()) as { plans?: unknown; payPerOrder?: unknown };
    if (!Array.isArray(body.plans)) return null;
    return { plans: body.plans as PublicPlan[], payPerOrder: readPayPerOrder(body.payPerOrder) };
  } catch {
    return null;
  }
}

/** The list alone (getPublicOffer's `plans`). */
export async function getPublicPlans(): Promise<PublicPlan[] | null> {
  const offer = await getPublicOffer();
  return offer ? offer.plans : null;
}
