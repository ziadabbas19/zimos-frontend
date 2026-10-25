/**
 * Orders — what the orders screens need beyond the methods already on
 * ApiClient (backend: src/modules/orders). Functions take the shared client
 * and use its public `request()`. Every exported name is prefixed with
 * `orders` / `Order`.
 *
 * Mounted at /workspaces/:workspaceId/orders (orders.view to read,
 * orders.manage to change).
 *
 * Notable codes: INVALID_STATUS_TRANSITION (409 — details.from, details.to,
 * details.allowed), STATUS_UNCHANGED (409), ORDER_NOT_CANCELLED (409),
 * INSUFFICIENT_STOCK (409 — reopening a cancelled order whose stock is gone),
 * CARRIER_MANUAL_CANCEL_REQUIRED (409 — cancelling an order booked with a
 * courier that has no cancel API; resend with acknowledgeManualCancel).
 */
import type { ApiClient } from "../client";
import type { Order, OrderStage, PaymentMethod } from "../types";

const base = (workspaceId: string, orderId?: string) =>
  `/workspaces/${workspaceId}/orders${orderId ? `/${orderId}` : ""}`;

// ---------------------------------------------------------------- status --

/** GET one order also says which stages it may be moved to by hand. */
export type OrderWithNextStages = Order & { nextStages?: OrderStage[] };

/** The stages `order` may be moved to from the order page; empty when none. */
export function ordersNextStages(order: Order): OrderStage[] {
  return (order as OrderWithNextStages).nextStages ?? [];
}

export type OrderActorType = "user" | "system" | "carrier" | "customer" | "api";

export interface OrderStatusHistoryEntry {
  id: string;
  /** null on the order's first row. */
  fromStatus: OrderStage | null;
  toStatus: OrderStage;
  actorType: OrderActorType;
  actorId: string | null;
  /** The staff member's name when actorType is "user". */
  actorName: string | null;
  reason: string | null;
  createdAt: string;
}

export interface OrderStatusChangePayload {
  status: OrderStage;
  reason?: string;
  /** → needs_follow_up: which of the two it is (default unreachable). */
  followUp?: "unreachable" | "postponed";
  /** → cancelled, after cancelling the booking in the courier's own dashboard. */
  acknowledgeManualCancel?: boolean;
  /** A shipping stage on an order with no shipment yet: the manual shipment created for it. */
  carrierCode?: string;
  /** One of the store's own couriers (couriersList); wins over carrierCode. */
  courierId?: string;
  waybillNumber?: string;
  trackingUrl?: string;
}

/** Moves the order to another stage. Answers the order as GET one does. */
export async function ordersChangeStatus(
  client: ApiClient,
  workspaceId: string,
  orderId: string,
  payload: OrderStatusChangePayload
): Promise<OrderWithNextStages> {
  const { order } = await client.request<{ order: OrderWithNextStages }>(`${base(workspaceId, orderId)}/status`, {
    method: "PATCH",
    body: payload,
  });
  return order;
}

/** Every move of the order between stages, oldest first. */
export async function ordersStatusHistory(
  client: ApiClient,
  workspaceId: string,
  orderId: string
): Promise<OrderStatusHistoryEntry[]> {
  const { history } = await client.request<{ history: OrderStatusHistoryEntry[] }>(
    `${base(workspaceId, orderId)}/status-history`
  );
  return history;
}

// ------------------------------------------------ meta: tags, seen, test --

export type OrderSource = "store" | "funnel" | "manual" | "api" | "import" | "upsell";
export const ORDER_SOURCES: readonly OrderSource[] = ["store", "funnel", "manual", "api", "import", "upsell"];

/** The SPEC §4.2 fields every order carries (list and GET one). */
export interface OrderMeta {
  source: OrderSource;
  tags: string[];
  isSeen: boolean;
  seenAt: string | null;
  /** Placed while previewing the store, or marked by hand; not a sale. */
  isTest: boolean;
  /** Set when the order was archived ("deleted" from the lists). */
  archivedAt: string | null;
}

/** Reads the meta fields off an order, with safe defaults for older responses. */
export function ordersMeta(order: Order): OrderMeta {
  const o = order as Order & Partial<OrderMeta>;
  return {
    source: o.source ?? "store",
    tags: o.tags ?? [],
    isSeen: o.isSeen ?? true,
    seenAt: o.seenAt ?? null,
    isTest: o.isTest ?? false,
    archivedAt: o.archivedAt ?? null,
  };
}

export interface OrderMetaPatch {
  /** Replaces the order's tags. */
  tags?: string[];
  addTags?: string[];
  removeTags?: string[];
  isTest?: boolean;
  isSeen?: boolean;
  archived?: boolean;
}

/** Tags, test, archive need orders.manage; `{ isSeen }` alone needs orders.view. */
export async function ordersUpdateMeta(
  client: ApiClient,
  workspaceId: string,
  orderId: string,
  patch: OrderMetaPatch
): Promise<OrderMeta & { id: string }> {
  const { order } = await client.request<{ order: OrderMeta & { id: string } }>(`${base(workspaceId, orderId)}/meta`, {
    method: "PATCH",
    body: patch,
  });
  return order;
}

export interface OrderTagCount {
  tag: string;
  count: number;
}

/** Every tag in use in the store, most used first. */
export async function ordersListTags(client: ApiClient, workspaceId: string): Promise<OrderTagCount[]> {
  const { tags } = await client.request<{ tags: OrderTagCount[] }>(`${base(workspaceId)}/tags`);
  return tags;
}

// ----------------------------------------------------------------- notes --

export type OrderNoteVisibility = "internal" | "public";

export interface OrderNote {
  id: string;
  orderId: string;
  body: string;
  /** "public" notes are shown to the customer on the tracking page. */
  visibility: OrderNoteVisibility;
  author: { id: string; fullName: string } | null;
  createdAt: string;
}

/** Newest first. */
export async function ordersListNotes(client: ApiClient, workspaceId: string, orderId: string): Promise<OrderNote[]> {
  const { notes } = await client.request<{ notes: OrderNote[] }>(`${base(workspaceId, orderId)}/notes`);
  return notes;
}

export async function ordersAddNote(
  client: ApiClient,
  workspaceId: string,
  orderId: string,
  payload: { body: string; visibility?: OrderNoteVisibility }
): Promise<OrderNote> {
  const { note } = await client.request<{ note: OrderNote }>(`${base(workspaceId, orderId)}/notes`, {
    method: "POST",
    body: payload,
  });
  return note;
}

export async function ordersDeleteNote(
  client: ApiClient,
  workspaceId: string,
  orderId: string,
  noteId: string
): Promise<void> {
  await client.request<void>(`${base(workspaceId, orderId)}/notes/${noteId}`, { method: "DELETE" });
}

// --------------------------------------------------------------- filters --

/** The orders list's SPEC §4.3 filters, accepted by the list, the tab counts and the export. */
export interface OrderListFilters {
  archived?: "exclude" | "only" | "include";
  tag?: string;
  source?: OrderSource;
  paymentMethod?: PaymentMethod;
  governorate?: string;
  carrier?: string;
  seen?: boolean;
  test?: boolean;
  /** Orders containing this product. */
  productId?: string;
  funnelId?: string;
  dataQuality?: "good" | "low";
  /** Two letters, any case. */
  ipCountry?: string;
  /** A discount code the order used, any case. */
  discountCode?: string;
  /** The visit's utm_source / utm_campaign (last touch, else first), any case. */
  utmSource?: string;
  utmCampaign?: string;
}

// -------------------------------------------------- timeline, neighbours --

export type OrderTimelineEventType = "status" | "audit" | "note" | "automation" | "webhook" | "courier" | "message" | "message_status";

export interface OrderTimelineEvent {
  id: string;
  type: OrderTimelineEventType;
  at: string;
  actor: { type: OrderActorType; name: string | null };
  /**
   * status: { from, to, reason } · audit: { action, entity, before, after } ·
   * note: { body, visibility } · automation: { trigger, status, detail } ·
   * webhook: { eventType, status, attempts, responseStatus } ·
   * courier: { carrierCode, status, carrierStatusCode, description, shipmentId } ·
   * message (with the API's order_messages): { channel, template, subject, status, error,
   * deliveryStatus, statusAt, statusReason, bot? } · message_status: { channel, status, reason, subject }
   */
  data: Record<string, unknown>;
}

/** Everything that happened to the order, newest first. */
export async function ordersTimeline(
  client: ApiClient,
  workspaceId: string,
  orderId: string
): Promise<OrderTimelineEvent[]> {
  const { events } = await client.request<{ events: OrderTimelineEvent[] }>(`${base(workspaceId, orderId)}/timeline`);
  return events;
}

export interface OrderNeighbors {
  prevId: string | null;
  nextId: string | null;
}

/** The orders before and after this one under the list's filters (a query string without "?"). */
export async function ordersNeighbors(
  client: ApiClient,
  workspaceId: string,
  orderId: string,
  listQuery = ""
): Promise<OrderNeighbors> {
  return client.request<OrderNeighbors>(`${base(workspaceId, orderId)}/neighbors${listQuery ? `?${listQuery}` : ""}`);
}

// ------------------------------------------------------------------ bulk --

export type OrderBulkAction =
  | "set_status"
  | "add_tag"
  | "remove_tag"
  | "archive"
  | "unarchive"
  | "mark_seen"
  | "mark_unseen"
  | "ship";

export interface OrderBulkPayload {
  status?: OrderStage;
  reason?: string;
  followUp?: "unreachable" | "postponed";
  tags?: string[];
  /** ship: a connected courier's code, or a name for a manual shipment. */
  carrierCode?: string;
  /** set_status to a shipping stage: the store's courier who takes the orders. */
  courierId?: string;
  notes?: string;
}

export interface OrderBulkResult {
  orderId: string;
  orderNumber: string | null;
  ok: boolean;
  /** Set when `ok` is false: the code the single-order endpoint would have answered. */
  code?: string;
  message?: string;
}

export interface OrderBulkResponse {
  action: OrderBulkAction;
  total: number;
  succeeded: number;
  failed: number;
  results: OrderBulkResult[];
}

/**
 * One action over many orders: named (`orderIds`) or everything the list
 * shows for `filter` (up to 500). Always 200 when the request is valid —
 * read `results` for what happened to each order.
 */
export async function ordersBulk(
  client: ApiClient,
  workspaceId: string,
  body: { action: OrderBulkAction; payload?: OrderBulkPayload } & (
    | { orderIds: string[]; filter?: undefined }
    | { filter: Record<string, unknown>; orderIds?: undefined }
  )
): Promise<OrderBulkResponse> {
  return client.request<OrderBulkResponse>(`${base(workspaceId)}/bulk`, { method: "POST", body });
}

// ---------------------------------------------------------- manual order --

export interface OrderDraftItem {
  variantId: string;
  offerId?: string;
  quantity: number;
}

export interface OrderDraft {
  items: OrderDraftItem[];
  contact?: { fullName: string; phone: string; email?: string };
  shippingAddress?: { country: string; province?: string; city?: string; addressLine?: string };
  paymentMethod?: PaymentMethod;
  discountCode?: string;
  /** Minor units. Set by staff to replace the calculated shipping. */
  shippingAmount?: number;
}

export interface OrderDraftPreview {
  currency: string;
  subtotalAmount: string;
  discountAmount: string;
  shippingAmount: string;
  taxAmount: string;
  totalAmount: string;
  items: Array<{
    variantId: string;
    offerId: string | null;
    name: string;
    options: Record<string, string> | null;
    offerName: string | null;
    quantity: number;
    unitPriceAmount: string;
    lineTotalAmount: string;
  }>;
}

/** Prices a manual order exactly as creating it would, without saving anything. */
export async function ordersPreviewDraft(client: ApiClient, workspaceId: string, draft: OrderDraft): Promise<OrderDraftPreview> {
  const { preview } = await client.request<{ preview: OrderDraftPreview }>(`${base(workspaceId)}/manual/preview`, {
    method: "POST",
    body: draft,
  });
  return preview;
}

export interface OrderDraftCustomer {
  /** null for a customer who comes hidden (locked orders): every order in the list carries it, so it would lead to theirs. */
  id: string | null;
  fullName: string | null;
  phone: string;
  email: string | null;
  isBlacklisted: boolean;
  /** null for a customer who comes hidden (locked orders): the counts would tie the typed phone to their orders. */
  totalOrders: number | null;
  totalRejectedOrders: number | null;
  lastAddress: { country?: string; province?: string | null; city?: string; addressLine?: string } | null;
  /** null for a customer who comes hidden, as the counts. */
  lastOrder: { id: string; orderNumber: string; createdAt: string } | null;
  /** Locked orders on: true when every order this customer placed is locked (their details come "••••"). */
  contactLocked?: boolean;
}

/** The customer behind a phone number, or null when it is new to the store. */
export async function ordersCustomerByPhone(
  client: ApiClient,
  workspaceId: string,
  phone: string
): Promise<OrderDraftCustomer | null> {
  const { customer } = await client.request<{ customer: OrderDraftCustomer | null }>(
    `${base(workspaceId)}/manual/customer?phone=${encodeURIComponent(phone)}`
  );
  return customer;
}

export interface OrderGovernorate {
  code: string;
  ar: string;
  en: string;
}

export async function ordersManualOptions(client: ApiClient, workspaceId: string): Promise<{ governorates: OrderGovernorate[] }> {
  return client.request<{ governorates: OrderGovernorate[] }>(`${base(workspaceId)}/manual/options`);
}

// ------------------------------------- edit items, refund quote, fulfill --

export interface OrderTotals {
  subtotalAmount: string;
  discountAmount: string;
  shippingAmount: string;
  taxAmount: string;
  totalAmount: string;
}

export interface OrderItemsPreview {
  currency: string;
  before: OrderTotals;
  after: OrderTotals;
  /** after.total − before.total, minor units; negative when the order got cheaper. */
  differenceAmount: string;
  items: Array<{
    id: string;
    variantId: string;
    offerId: string | null;
    name: string;
    options: Record<string, string> | null;
    offerName: string | null;
    quantity: number;
    unitPriceAmount: string;
    lineTotalAmount: string;
  }>;
}

/**
 * What saving this list of lines would do to the order; nothing is saved.
 * Codes: ORDER_ALREADY_SHIPPED, ORDER_ALREADY_PAID, ORDER_CANCELLED (409),
 * INSUFFICIENT_STOCK (409).
 */
export async function ordersPreviewItems(
  client: ApiClient,
  workspaceId: string,
  orderId: string,
  items: OrderDraftItem[]
): Promise<OrderItemsPreview> {
  const { preview } = await client.request<{ preview: OrderItemsPreview }>(`${base(workspaceId, orderId)}/items/preview`, {
    method: "POST",
    body: { items },
  });
  return preview;
}

/** Replaces the order's lines (before it ships). Answers the order as GET one does. */
export async function ordersUpdateItems(
  client: ApiClient,
  workspaceId: string,
  orderId: string,
  items: OrderDraftItem[]
): Promise<OrderWithNextStages> {
  const { order } = await client.request<{ order: OrderWithNextStages }>(`${base(workspaceId, orderId)}/items`, {
    method: "PUT",
    body: { items },
  });
  return order;
}

export interface OrderRefundQuote {
  currency: string;
  /** What these lines come to, less their share of the order's discount (minor units). */
  amount: string;
  refundableAmount: string;
  lines: Array<{ orderItemId: string; name: string; quantity: number; amount: string }>;
}

export async function ordersRefundQuote(
  client: ApiClient,
  workspaceId: string,
  orderId: string,
  lines: Array<{ orderItemId: string; quantity: number }>
): Promise<OrderRefundQuote> {
  const { quote } = await client.request<{ quote: OrderRefundQuote }>(`${base(workspaceId, orderId)}/refund-quote`, {
    method: "POST",
    body: { lines },
  });
  return quote;
}

/** "Shipped" by hand: a manual shipment with the tracking number and link. */
export async function ordersFulfill(
  client: ApiClient,
  workspaceId: string,
  orderId: string,
  payload: { carrierCode?: string; trackingNumber?: string; trackingUrl?: string }
): Promise<OrderWithNextStages> {
  const { order } = await client.request<{ order: OrderWithNextStages }>(`${base(workspaceId, orderId)}/fulfill`, {
    method: "POST",
    body: payload,
  });
  return order;
}

// ------------------------------------ documents and tracking import (§12.4) --

interface OrderDocumentAnswer {
  filename: string;
  contentType: string;
  base64: string;
}

function documentBlob(answer: OrderDocumentAnswer): Blob {
  const binary = atob(answer.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: answer.contentType });
}

/** The order's invoice as a PDF. 409 INVOICE_NOT_ISSUED while an online order is still unpaid. */
export async function ordersInvoicePdf(client: ApiClient, workspaceId: string, orderId: string): Promise<Blob> {
  const answer = await client.request<OrderDocumentAnswer>(`${base(workspaceId, orderId)}/invoice.pdf?as=base64`);
  return documentBlob(answer);
}

export type OrderWaybillFormat = "a4x4" | "10x15";

/** One PDF of labels for the given orders: four to an A4 page, or one per 10×15 cm label. Up to 200 orders. */
export async function ordersWaybillsPdf(
  client: ApiClient,
  workspaceId: string,
  orderIds: string[],
  format: OrderWaybillFormat = "a4x4"
): Promise<Blob> {
  const answer = await client.request<OrderDocumentAnswer>(`${base(workspaceId)}/documents/waybills?as=base64`, {
    method: "POST",
    body: { orderIds, format },
  });
  return documentBlob(answer);
}

/**
 * The courier handover sheet: the given orders' shipments, or — with none
 * named — every shipment created on `date` (default today, UTC).
 * 422 NO_SHIPMENTS when there is nothing to hand over.
 */
export async function ordersManifestPdf(
  client: ApiClient,
  workspaceId: string,
  params: { orderIds?: string[]; date?: string; carrier?: string } = {}
): Promise<Blob> {
  const answer = await client.request<OrderDocumentAnswer>(`${base(workspaceId)}/documents/manifest?as=base64`, {
    method: "POST",
    body: params,
  });
  return documentBlob(answer);
}

export interface OrderTrackingImportRow {
  /** The file's line number (the header is line 1). */
  line: number;
  orderNumber: string | null;
  orderId?: string;
  ok: boolean;
  /** ok: any of shipment_created, tracking_updated, status_updated (empty when nothing changed). */
  changes?: string[];
  code?: string;
  message?: string;
}

export interface OrderTrackingImportResult {
  total: number;
  succeeded: number;
  failed: number;
  results: OrderTrackingImportRow[];
}

/**
 * Applies a courier's sheet. `csv` is the file's text; columns order_number
 * (required), tracking_number, tracking_url, carrier, status.
 * 422 EMPTY_FILE / MISSING_COLUMN / TOO_MANY_ROWS for a file that can't be read.
 */
export async function ordersImportTracking(
  client: ApiClient,
  workspaceId: string,
  csv: string
): Promise<OrderTrackingImportResult> {
  return client.request<OrderTrackingImportResult>(`${base(workspaceId)}/import-tracking`, { method: "POST", body: { csv } });
}
