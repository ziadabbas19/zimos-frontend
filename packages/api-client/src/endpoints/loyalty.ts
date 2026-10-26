/**
 * Loyalty points (backend src/modules/loyalty).
 *
 * Customers earn points on delivered orders and spend them at checkout. The
 * merchant sets every number; with no earn rate or point value the programme
 * stays off.
 *
 * Dashboard, /workspaces/:ws/loyalty:
 *   GET  /                              (customers.view)   → LoyaltyOverview
 *   PUT  /  LoyaltySettingsPayload      (discounts.manage) → { settings, active }
 *   GET  /customers/:customerId         (customers.view)   → LoyaltyAccount (last 200 changes)
 *   POST /customers/:customerId/adjust  (customers.manage) { points: ±int, note } → { balance, applied }
 *        The balance never goes below 0: `applied` is what really moved.
 *
 * Storefront:
 *   GET /store/:ws/loyalty              → { program | null } (public, cached 5 minutes)
 *   GET /store/:ws/account/loyalty      → ShopperLoyalty (X-Shopper-Token; 401 SHOPPER_NOT_SIGNED_IN)
 *   Checkout: `loyaltyPoints` (int) with X-Shopper-Token, with cash on delivery only.
 *   On field `loyaltyPoints`: 401 SHOPPER_NOT_SIGNED_IN,
 *   422 LOYALTY_OFF, LOYALTY_FROZEN, LOYALTY_TOO_FEW, LOYALTY_NOT_ENOUGH, and with the
 *   API's LOYALTY_GUARD_ENABLED LOYALTY_UNAVAILABLE / LOYALTY_DEVICE_LIMIT.
 *   The 201 adds `loyalty` (LoyaltyRedemption).
 *
 * Frozen (the store's plan lacks `loyalty` with LOYALTY_REQUIRE_PLAN_FEATURE, or its
 * subscription stopped with LOYALTY_GUARD_ENABLED): balances are kept and shown, but
 * nothing is earned, spent or expired; the storefront's `program` is null meanwhile.
 *
 * Points are whole numbers. Money is integer minor units (sent as a string in the ledger).
 */
import { ApiError, type ApiClient } from "../client";
import { apiErrorDetails } from "../errors";
import { shopperTokenHeaders } from "../shopperToken";

export interface LoyaltySettings {
  /** What the merchant switched: the programme only runs when the two rates are set too (`active`). */
  enabled: boolean;
  /** Points per 1 unit of the store currency spent (0.01–1000), or null when unset. */
  earnPointsPerUnit: number | null;
  /** What one point is worth, in minor units (10 = EGP 0.10), or null when unset. */
  pointValue: number | null;
  /** Fewest points a shopper may use on an order (≥ 1). */
  minRedeemPoints: number;
  /** Most of an order's total points may pay, 1–100. */
  maxRedeemPercent: number;
  /** Most points one order may take (1–10,000,000), or null for no cap but the percent. Older APIs leave it out. */
  maxRedeemPointsPerOrder?: number | null;
  /** Days without earning or spending after which a balance expires (30–1825), or null for never. */
  expiryDays: number | null;
}

/** Why a store's points are frozen: its plan lacks `loyalty`, or its subscription stopped. */
export type LoyaltyFrozenReason = "plan" | "subscription";

export interface LoyaltyOverview {
  settings: LoyaltySettings;
  /** Enabled and fully set: shoppers earn and spend. */
  active: boolean;
  /** Switching the programme on would be refused (403 PLAN_FEATURE_REQUIRED). Older APIs leave it out. */
  planLocked?: boolean;
  /** Points kept and shown, but neither earned, spent nor expired now. */
  frozen?: boolean;
  frozenReason?: LoyaltyFrozenReason | null;
  currency: string;
  customersWithPoints: number;
  outstandingPoints: number;
  /** Minor units, as a string; null while no point value is set. */
  outstandingWorth: string | null;
}

export interface LoyaltySettingsPayload {
  enabled: boolean;
  /** Required when `enabled`. */
  earnPointsPerUnit?: number | null;
  /** Required when `enabled`. */
  pointValue?: number | null;
  minRedeemPoints?: number;
  maxRedeemPercent?: number;
  maxRedeemPointsPerOrder?: number | null;
  expiryDays?: number | null;
}

/** The API's limits, for the form's own checks. */
export const LOYALTY_LIMITS = {
  earnMin: 0.01,
  earnMax: 1000,
  pointValueMin: 1,
  pointValueMax: 1_000_000,
  minRedeemMax: 10_000_000,
  maxPerOrderMax: 10_000_000,
  expiryMin: 30,
  expiryMax: 1825,
  adjustMax: 10_000_000,
  noteMax: 200,
} as const;

/**
 * Why a balance moved: earned on a delivered order, spent, held for an unpaid
 * online order, given back (the hold was not needed, or the order ended),
 * a refund of a points payment, taken back after a return or cancel, expired,
 * changed by staff, or the reward for an invited friend's delivered order
 *.
 */
export type LoyaltyTransactionKind = "earn" | "redeem" | "hold" | "release" | "refund" | "reverse" | "expire" | "adjust" | "referral";

/** One change of a balance; `points` is signed (−500 for a spend). */
export interface LoyaltyTransaction {
  id: string;
  kind: LoyaltyTransactionKind;
  points: number;
  balanceAfter: number;
  /** The money those points stood for (minor units), when the change was a payment. */
  amount: string | null;
  currency: string | null;
  orderId: string | null;
  /** Staff's reason on `adjust`; the system's own remark otherwise (not for display). */
  note: string | null;
  createdAt: string;
}

export interface LoyaltyAccount {
  balance: number;
  /** What the balance is worth, minor units; null while no point value is set. */
  worth: string | null;
  currency: string;
  /** When the balance expires if nothing is earned or spent; null for never, an empty balance or a frozen one. */
  expiresAt: string | null;
  /** The store's points are frozen: the balance shows, but can't be earned or spent now. Older APIs leave it out. */
  frozen?: boolean;
  /** Newest first. */
  history: LoyaltyTransaction[];
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/loyalty`;

export function loyaltyGet(client: ApiClient, workspaceId: string): Promise<LoyaltyOverview> {
  return client.request<LoyaltyOverview>(base(workspaceId));
}

/** Answers only the settings and `active`: keep the counts of the last `loyaltyGet`. */
export function loyaltySave(
  client: ApiClient,
  workspaceId: string,
  body: LoyaltySettingsPayload
): Promise<Pick<LoyaltyOverview, "settings" | "active">> {
  return client.request<Pick<LoyaltyOverview, "settings" | "active">>(base(workspaceId), { method: "PUT", body });
}

export function loyaltyCustomerGet(client: ApiClient, workspaceId: string, customerId: string): Promise<LoyaltyAccount> {
  return client.request<LoyaltyAccount>(`${base(workspaceId)}/customers/${customerId}`);
}

export function loyaltyCustomerAdjust(
  client: ApiClient,
  workspaceId: string,
  customerId: string,
  body: { points: number; note: string }
): Promise<{ balance: number; applied: number }> {
  return client.request<{ balance: number; applied: number }>(`${base(workspaceId)}/customers/${customerId}/adjust`, {
    method: "POST",
    body,
  });
}

// ----------------------------------------------------------- storefront --

/** What a store tells its shoppers about the programme; null when it is off. */
export interface LoyaltyProgram {
  earnPointsPerUnit: number;
  pointValue: number;
  minRedeemPoints: number;
  maxRedeemPercent: number;
  /** Most points one order takes, or null / absent for no cap but the percent. */
  maxRedeemPointsPerOrder?: number | null;
  expiryDays: number | null;
  currency: string;
}

export async function storeLoyaltyProgram(client: ApiClient, workspaceRef: string): Promise<LoyaltyProgram | null> {
  const { program } = await client.request<{ program: LoyaltyProgram | null }>(`/store/${workspaceRef}/loyalty`, { auth: false });
  return program;
}

export interface ShopperLoyalty extends LoyaltyAccount {
  program: LoyaltyProgram | null;
}

/** The signed-in shopper's points (last 50 changes). */
export function shopperLoyalty(client: ApiClient, workspaceRef: string, token: string): Promise<ShopperLoyalty> {
  return client.request<ShopperLoyalty>(`/store/${workspaceRef}/account/loyalty`, {
    auth: false,
    headers: shopperTokenHeaders(token),
  });
}

/**
 * The points one unit of a product earns: price ÷ one currency unit × the earn
 * rate, rounded down (the server works the order's own figure out on delivery).
 */
export function loyaltyPointsFor(priceMinor: number, program: Pick<LoyaltyProgram, "earnPointsPerUnit"> | null | undefined): number {
  if (!program || !(program.earnPointsPerUnit > 0) || !(priceMinor > 0)) return 0;
  return Math.floor((priceMinor / 100) * program.earnPointsPerUnit);
}

/** What the checkout's 201 adds when points came with the order. */
export interface LoyaltyRedemption {
  applied: boolean;
  /** Points really used — fewer than asked when the order could not take them all. */
  points?: number;
  /** Their worth, minor units. */
  amount?: string;
  /** Points left. */
  balance?: number;
  currency?: string;
  /** When not applied: "unusable", "frozen", "nothing_due", "error" or "covers_order_cod_unavailable". */
  reason?: string;
}

/** The checkout body's points field (with the X-Shopper-Token header). */
export interface LoyaltyCheckoutFields {
  loyaltyPoints?: number;
}

/**
 * Why a checkout refused the points, when they were the reason: "signed_out",
 * "off" (the store has no programme now, or its points are frozen),
 * "too_few" (under the minimum), "not_enough" (more than the balance),
 * "unavailable" (not on this order: the store's guard), "device_limit"
 * (this device used another account's points within a day), "cod_only" (the
 * way to pay is not cash on delivery), or null.
 */
export type LoyaltyRefusal = "signed_out" | "off" | "too_few" | "not_enough" | "unavailable" | "device_limit" | "cod_only";

export function loyaltyRefusalOf(err: unknown): LoyaltyRefusal | null {
  if (!(err instanceof ApiError)) return null;
  if (err.code === "LOYALTY_OFF" || err.code === "LOYALTY_FROZEN") return "off";
  if (err.code === "LOYALTY_TOO_FEW") return "too_few";
  if (err.code === "LOYALTY_NOT_ENOUGH") return "not_enough";
  if (err.code === "LOYALTY_UNAVAILABLE") return "unavailable";
  if (err.code === "LOYALTY_DEVICE_LIMIT") return "device_limit";
  // The other refusals carry their own code and name the field in `details`.
  const details = apiErrorDetails<unknown>(err);
  const named = Array.isArray(details) && details.some((d) => !!d && (d as { field?: unknown }).field === "loyaltyPoints");
  if (!named) return null;
  if (err.code === "SHOPPER_NOT_SIGNED_IN") return "signed_out";
  return "cod_only";
}
