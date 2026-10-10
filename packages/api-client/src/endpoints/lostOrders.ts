/**
 * Lost orders (backend: src/modules/checkoutSessions/lostOrderService.js).
 *
 * Every checkout that did not become an order: refused by a rule, the
 * blocklist or a bot check, waiting on an unverified phone, typed with bad
 * data, or simply left. Mounted at /workspaces/:workspaceId/checkout-sessions
 * (reads: orders.view, writes: orders.manage) and, for the recovery link, at
 * /store/:workspaceId/recover/:token (no auth). All exported names in this
 * file are prefixed with `lostOrders` / `LostOrder`.
 *
 * Notable codes: CHECKOUT_SESSION_CONVERTED (409 — it already became an
 * order), VALIDATION_ERROR on convert (`shippingAddress`, `contact.fullName`,
 * `items` — what is missing to place the order), and every refusal
 * createOrder can give.
 */
import type { ApiClient } from "../client";
import type { PaymentMethod } from "../types";

export const LOST_ORDER_REASONS = [
  "incomplete",
  "invalid_data",
  "integrity_check",
  "otp_unverified",
  "outside_country",
  "vpn",
  "blocked",
  "limit_exceeded",
  "payment_failed",
] as const;
export type LostOrderReason = (typeof LOST_ORDER_REASONS)[number];

export const LOST_ORDER_TABS = ["all", "under_review", "completed", "recovered"] as const;
export type LostOrderTab = (typeof LOST_ORDER_TABS)[number];

export type LostOrderStatus = "in_progress" | "abandoned" | "lost" | "awaiting_otp" | "converted";
export type LostOrderReviewStatus = "under_review" | "completed";
export const LOST_ORDER_RECOVERY_STATUSES = ["not_contacted", "contacted", "recovered", "lost"] as const;
export type LostOrderRecoveryStatus = (typeof LOST_ORDER_RECOVERY_STATUSES)[number];

export interface LostOrderAddress {
  country: string;
  province?: string | null;
  city: string;
  addressLine: string;
  postalCode?: string | null;
  notes?: string | null;
}

export interface LostOrderLine {
  productId: string;
  variantId: string;
  productName: string;
  options?: Record<string, string> | null;
  offerName?: string | null;
  quantity: number;
  /** Minor units. */
  lineTotalAmount: number;
}

export interface LostOrder {
  id: string;
  status: LostOrderStatus;
  /** Null while in progress or once converted. `incomplete` = the shopper just left. */
  lostReason: LostOrderReason | null;
  reviewStatus: LostOrderReviewStatus;
  recoveryStatus: LostOrderRecoveryStatus;
  customerName: string | null;
  phone: string;
  email: string | null;
  /** Present when the shopper got as far as submitting the form. */
  shippingAddress: LostOrderAddress | null;
  paymentMethod: string | null;
  items: LostOrderLine[];
  /** Minor units. */
  subtotalAmount: number;
  currency: string;
  source: "store" | "funnel";
  ipAddress: string | null;
  ipCountry: string | null;
  /** `/r/<token>` — put the store's address in front for the recovery link. */
  recoveryPath: string | null;
  lastActivityAt: string;
  contactedAt: string | null;
  createdAt: string;
  convertedOrder: { id: string; orderNumber: string } | null;
}

export interface LostOrderFilters {
  tab?: LostOrderTab;
  lostReason?: LostOrderReason;
  reviewStatus?: LostOrderReviewStatus;
  recoveryStatus?: LostOrderRecoveryStatus;
  /** ISO dates, on the last activity. */
  from?: string;
  to?: string;
  productId?: string;
  source?: "store" | "funnel";
}

export interface LostOrderList {
  sessions: LostOrder[];
  nextCursor: string | null;
  /** The store's setting: minutes of silence after which a checkout counts as abandoned. */
  abandonedAfterMinutes: number;
}

export interface LostOrderStats {
  from: string;
  to: string;
  lost: number;
  byReason: Partial<Record<LostOrderReason, number>>;
  visits: number;
  /** Lost checkouts per 100 visits; null when no visit was recorded. */
  lostRate: number | null;
  recovered: number;
  /** Minor units, as a string. */
  recoveredAmount: string;
  currency: string;
  abandonedAfterMinutes: number;
}

export interface LostOrderConvertPayload {
  contact?: { fullName?: string; phone?: string; email?: string | null };
  shippingAddress?: LostOrderAddress;
  paymentMethod?: PaymentMethod;
  notes?: string;
  items?: { variantId: string; offerId?: string; quantity: number }[];
}

/** What a recovery link rebuilds in the storefront. */
export interface LostOrderRecovery {
  contact: { fullName: string | null; phone: string | null; email: string | null };
  shippingAddress: LostOrderAddress | null;
  items: { variantId: string; offerId: string | null; quantity: number }[];
  source: "store" | "funnel";
  couponCode: string | null;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/checkout-sessions`;

function query(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export async function lostOrdersList(
  client: ApiClient,
  workspaceId: string,
  params: LostOrderFilters & { limit?: number; before?: string } = {}
): Promise<LostOrderList> {
  return client.request<LostOrderList>(`${base(workspaceId)}${query(params)}`);
}

/** The panel above the list; default period: this calendar month. */
export async function lostOrdersStats(
  client: ApiClient,
  workspaceId: string,
  params: { from?: string; to?: string } = {}
): Promise<LostOrderStats> {
  return client.request<LostOrderStats>(`${base(workspaceId)}/stats${query(params)}`);
}

export async function lostOrdersUpdate(
  client: ApiClient,
  workspaceId: string,
  sessionId: string,
  payload: { recoveryStatus?: LostOrderRecoveryStatus; reviewStatus?: LostOrderReviewStatus }
): Promise<LostOrder> {
  const { session } = await client.request<{ session: LostOrder }>(`${base(workspaceId)}/${sessionId}`, {
    method: "PATCH",
    body: payload,
  });
  return session;
}

/** Places the order (source `manual`) from what the shopper typed, corrected by `payload`. */
export async function lostOrdersConvert(
  client: ApiClient,
  workspaceId: string,
  sessionId: string,
  payload: LostOrderConvertPayload = {}
): Promise<{ order: { id: string; orderNumber: string }; session: LostOrder }> {
  return client.request<{ order: { id: string; orderNumber: string }; session: LostOrder }>(
    `${base(workspaceId)}/${sessionId}/convert`,
    { method: "POST", body: payload }
  );
}

export async function lostOrdersDelete(client: ApiClient, workspaceId: string, sessionId: string): Promise<void> {
  await client.request<unknown>(`${base(workspaceId)}/${sessionId}`, { method: "DELETE" });
}

/** The filtered list as CSV text (UTF-8 with a BOM, so Excel opens it). At most 5000 rows. */
export async function lostOrdersExport(
  client: ApiClient,
  workspaceId: string,
  filters: LostOrderFilters = {}
): Promise<{ csv: string; count: number; filename: string }> {
  return client.request<{ csv: string; count: number; filename: string }>(`${base(workspaceId)}/export`, {
    method: "POST",
    body: filters,
  });
}

/** Storefront, no auth. 404 for an unknown link or one whose checkout already became an order. */
export async function lostOrdersRecover(client: ApiClient, workspaceId: string, token: string): Promise<LostOrderRecovery> {
  const { recovery } = await client.request<{ recovery: LostOrderRecovery }>(
    `/store/${workspaceId}/recover/${encodeURIComponent(token)}`,
    { auth: false }
  );
  return recovery;
}

/**
 * The full phone behind a masked one (lists mask phones for roles without
 * customers.reveal_sensitive). Needs orders.view; every call is in the activity log.
 */
export async function lostOrdersRevealPhone(client: ApiClient, workspaceId: string, sessionId: string): Promise<string | null> {
  const { phone } = await client.request<{ phone: string | null }>(`${base(workspaceId)}/${sessionId}/reveal-phone`, {
    method: "POST",
  });
  return phone;
}

/**
 * Sends the recovery template from the store's connected WhatsApp number
 * (backend checkoutSessions/lostOrderWhatsapp.js): `cart_reminder` unless
 * another approved template is named, filled with the customer's name, the
 * store's name and the recovery link. Marks the lost order contacted.
 * Codes: WHATSAPP_NOT_CONNECTED, WHATSAPP_TEMPLATE_NOT_APPROVED,
 * MARKETING_NOT_ALLOWED (the phone answered STOP or is blocked), NO_PHONE — all 422.
 */
export async function lostOrdersSendWhatsapp(
  client: ApiClient,
  workspaceId: string,
  sessionId: string,
  options: { template?: string; language?: string } = {}
): Promise<{ message: { id: string; conversationId: string; status: string }; recoveryStatus: LostOrderRecoveryStatus }> {
  return client.request(`${base(workspaceId)}/${sessionId}/whatsapp`, { method: "POST", body: options });
}

/**
 * How long a checkout may sit quiet before it counts as lost:
 * `settings.fraud_rules.abandoned_after_minutes`, 5–1440 minutes; null puts
 * back the default (15). Needs workspace.manage (403 otherwise). Returns the
 * minutes now in force.
 */
export async function lostOrdersSaveAbandonAfter(client: ApiClient, workspaceId: string, minutes: number | null): Promise<number> {
  const body = await client.request<{
    workspace?: { settings?: { fraud_rules?: { abandoned_after_minutes?: unknown } } };
    settings?: { fraud_rules?: { abandoned_after_minutes?: unknown } };
  }>(`/workspaces/${workspaceId}`, { method: "PATCH", body: { settings: { fraud_rules: { abandoned_after_minutes: minutes } } } });
  const stored = (body.workspace?.settings ?? body.settings)?.fraud_rules?.abandoned_after_minutes;
  return typeof stored === "number" ? stored : LOST_ORDER_DEFAULT_ABANDON_MINUTES;
}

/** The backend's default (lostOrderService.js) and the bounds it accepts. */
export const LOST_ORDER_DEFAULT_ABANDON_MINUTES = 15;
export const LOST_ORDER_ABANDON_MINUTES_RANGE = { min: 5, max: 1440 } as const;
