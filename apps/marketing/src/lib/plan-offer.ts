/*
 * The plans on offer, as the API's public list sends them, and the one reader
 * of that answer: the server reads it into the page's HTML (lib/plans.ts),
 * the browser reads it again on every visit (components/live-plans.tsx), so a
 * plan changed in the console is on the page as soon as it is opened. Kept
 * free of anything server-only so both can import it.
 */

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
  | "cart_rewards"
  | "email_campaigns"
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

/**
 * Every page that shows prices is regenerated at most this often; the
 * browser reads the plans again on every visit besides (components/live-plans.tsx).
 */
export const PLANS_REVALIDATE_SECONDS = 60;

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

const isText = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";
const isLimit = (value: unknown): value is number | null => value === null || isCount(value);

/** One plan of the list, or null when it is not what a card can show honestly. */
function readPlan(value: unknown): PublicPlan | null {
  if (!value || typeof value !== "object") return null;
  const plan = value as Record<string, unknown>;
  if (!isText(plan.id) || !isText(plan.name) || !isText(plan.currency)) return null;
  if (!isCount(plan.monthlyPrice) || !isCount(plan.yearlyPrice) || !isCount(plan.trialDays)) return null;
  if (!isLimit(plan.maxStores) || !isLimit(plan.maxFunnelsPerMonth) || !isLimit(plan.softOrderQuota)) return null;
  const features = Array.isArray(plan.features) ? plan.features.filter((key): key is PlanFeatureKey => typeof key === "string") : [];
  return {
    id: plan.id,
    name: plan.name,
    currency: plan.currency,
    monthlyPrice: plan.monthlyPrice,
    yearlyPrice: plan.yearlyPrice,
    trialDays: plan.trialDays,
    maxStores: plan.maxStores,
    maxFunnelsPerMonth: plan.maxFunnelsPerMonth,
    softOrderQuota: plan.softOrderQuota,
    features,
  };
}

/**
 * The API's answer to `GET /plans/public`: its plans, in the order the console
 * set, each with only the fields a card shows, and the pay-per-order plan
 * beside them. Null for an answer that is not that list at all; a plan that
 * cannot be shown honestly is left out, never guessed at.
 */
export function readOffer(body: unknown): PublicOffer | null {
  if (!body || typeof body !== "object") return null;
  const { plans, payPerOrder } = body as { plans?: unknown; payPerOrder?: unknown };
  if (!Array.isArray(plans)) return null;
  return {
    plans: plans.map(readPlan).filter((plan): plan is PublicPlan => plan !== null),
    payPerOrder: readPayPerOrder(payPerOrder),
  };
}
