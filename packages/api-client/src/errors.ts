import { ApiError } from "./client";
import type { ManualCancelRequiredDetails, ManualCancelShipment } from "./types";

/**
 * The backend's stable error codes that the apps give their own copy to.
 * The envelope is `{ error: { code, message, details?, requestId } }`, and
 * `ApiError.details` holds that WHOLE body — read it through the helpers
 * below, never by hand.
 *
 * Open-ended on purpose (`| (string & {})`): the server adds codes before the
 * apps learn them, and an unknown code must still type-check and fall back
 * to the server's message.
 */
export type ApiErrorCode =
  // generic (core/errors/AppError.js, errorHandler.js)
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "IDEMPOTENCY_KEY_CONFLICT"
  | "INSUFFICIENT_STOCK"
  | "DUPLICATE_RESOURCE"
  | "INVALID_REFERENCE"
  | "INTERNAL_SERVER_ERROR"
  // orders
  | "ORDER_CANCELLED"
  | "ORDER_ALREADY_CANCELLED"
  | "ORDER_ALREADY_SHIPPED"
  | "ORDER_NOT_CONFIRMED"
  | "ORDER_NOT_PAID"
  | "SHIPMENT_ALREADY_EXISTS"
  | "CARRIER_NAME_RESERVED"
  | "SHIPPING_ADDRESS_REQUIRED"
  | "ORDER_NOT_COD" // 409 — only COD orders are confirmed by phone
  | "ORDER_ALREADY_CONFIRMED" // 409
  // confirmation queue
  | "TASK_ALREADY_LOCKED" // 409, details = ConfirmationLockDetails
  | "TASK_ALREADY_DONE" // 409 — claim/outcome/release on a finished task
  | "TASK_NOT_LOCKED_BY_YOU" // 403 — claim first, or your claim expired and was taken
  | "TASK_NOT_CLAIMED" // 409 — release on a task nobody holds
  | "TASK_NOT_DONE" // 409 — correction on an open task
  | "OUTCOME_UNCHANGED" // 409 — correction to the outcome it already has
  | "CORRECTION_NOT_ALLOWED" // 409 — merchant-cancelled order, or no final outcome
  // storefront checkout / fraud / autosave
  | "ORDER_REJECTED"
  | "INVALID_PHONE"
  | "CART_NOT_FOUND"
  | "CART_TOKEN_OR_ITEM_REQUIRED"
  // funnel runtime
  | "STEP_MISMATCH"
  | "FUNNEL_PAUSED" // 410
  | "FUNNEL_NOT_FOUND" // 404
  | "FUNNEL_SESSION_NOT_FOUND" // 404
  | "FUNNEL_STEP_NOT_FOUND" // 404
  | "FUNNEL_OFFER_UNAVAILABLE" // 404
  | "FUNNEL_OFFER_NEEDS_ORDER" // 422, details[].field = "session"
  // catalog
  | "PRODUCT_HAS_ORDERS" // 409 — permanent delete refused; archive instead
  | "PRODUCT_IN_FUNNEL" // 409, details[0] = { field: "funnelIds", message, funnelIds }
  | "PRODUCT_NOT_ARCHIVED" // 409 — restore on a product that isn't archived
  // website pages
  | "PAGE_PATH_RESERVED" // 422, details[0] = { field: "path", message, reserved }
  // couriers
  | "CARRIERS_NOT_CONFIGURED"
  | "CARRIER_AUTH_FAILED"
  | "CARRIER_PERMISSION_DENIED" // 422 — the carrier accepted the login but refused the call (API access not enabled / key scope)
  | "CARRIER_SANDBOX_NOT_ALLOWED" // 409, details = { carrierCode } — booking with a stored sandbox connection outside the test stores
  | "CARRIER_ADDRESS_UNMATCHED"
  | "CARRIER_CURRENCY_UNSUPPORTED"
  | "CARRIER_COD_LIMIT"
  | "CARRIER_ERROR"
  | "CARRIER_NOT_CONNECTED"
  | "CARRIER_CANCEL_FAILED"
  | "CARRIER_CREDENTIALS_UNREADABLE"
  | "SHIPMENT_NOT_CARRIER_MANAGED"
  | "LABEL_NOT_AVAILABLE"
  | "CARRIER_TIER_UNMAPPED" // 422, details = { tierId } — the booked tier has no package mapping
  | "CARRIER_MANUAL_CANCEL_REQUIRED" // 409, details = ManualCancelRequiredDetails — repeat with acknowledgeManualCancel
  | "CARRIER_CONNECT_CONFLICT" // 409 — two first-time connects raced; the other one was stored
  | "CARRIER_BOOKING_NOT_SAVED" // 502, details = CarrierBookingNotSavedDetails — cancel it in the courier's dashboard
  // online payments
  | "PAYMENTS_ONLINE_DISABLED" // 404 — shopper payment endpoints while online payments are off
  | "GATEWAYS_NOT_CONFIGURED" // 503 — no GATEWAY_CREDENTIALS_KEY on the server
  | "GATEWAY_AUTH_FAILED" // 422 — the gateway refused the keys
  | "GATEWAY_KEYS_MODE_MISMATCH" // 422 — a test key with a live key
  | "GATEWAY_KEYS_UNRECOGNISED" // 422
  | "GATEWAY_REJECTED" // 422
  | "GATEWAY_ERROR" // 502
  | "GATEWAY_NOT_CONNECTED" // 409
  | "GATEWAY_HAS_PENDING_PAYMENTS" // 409 — disconnect while an order waits on its payment
  | "GATEWAY_CREDENTIALS_UNREADABLE" // 409
  | "PAYMENT_METHOD_UNAVAILABLE" // 422
  | "PAYMENT_CURRENCY_UNSUPPORTED" // 422
  | "PAYMENT_RETRY_LIMIT" // 409
  | "ORDER_ALREADY_PAID" // 409
  | "ORDER_PAYMENT_EXPIRED" // 409
  | "ORDER_IS_COD" // 409
  | "ORDER_TEST_PAYMENT" // 409 — paid in test mode, cannot ship
  | "FUNNEL_ORDER_NOT_PAID" // 409 — completed_checkout with an unpaid online order
  | "REFUND_EXCEEDS_ELIGIBLE_AMOUNT" // 422
  | "REFUND_EXCEEDS_PAYMENT" // 422 — one refund cannot draw on two payments
  | "REFUND_PAYMENT_INVALID" // 422
  // weight tiers
  | "SHIPPING_TIERS_REQUIRED" // 422 — tier pricing needs at least one tier
  | "DEFAULT_ITEM_WEIGHT_REQUIRED" // 422 — tier pricing needs a default item weight
  | (string & {});

/** `details` of a 409 TASK_ALREADY_LOCKED: who holds the task and until when. */
export interface ConfirmationLockDetails {
  lockedBy: { id: string; fullName: string } | null;
  lockExpiresAt: string | null;
}

/** One entry of a VALIDATION_ERROR's `details` list. */
export interface ApiFieldProblem {
  field: string;
  message: string;
}

/** The server's error code, or undefined for a non-API failure (network, bug). */
export function apiErrorCode(err: unknown): ApiErrorCode | undefined {
  return err instanceof ApiError ? err.code : undefined;
}

/** Whether `err` is an ApiError carrying exactly this code. */
export function isApiErrorCode(err: unknown, code: ApiErrorCode): err is ApiError {
  return err instanceof ApiError && err.code === code;
}

/**
 * The server's `error.details`, unwrapped from the body ApiError keeps.
 * The type parameter is the caller's claim about the shape for the code it
 * has already checked — e.g. `CarrierAddressUnmatchedDetails` after
 * `isApiErrorCode(err, "CARRIER_ADDRESS_UNMATCHED")`.
 */
export function apiErrorDetails<T = unknown>(err: unknown): T | undefined {
  if (!(err instanceof ApiError)) return undefined;
  const body = err.details as { error?: { details?: unknown } } | null | undefined;
  const details = body && typeof body === "object" ? body.error?.details : undefined;
  return (details ?? undefined) as T | undefined;
}

/** The `{ field, message }` list of a 422 VALIDATION_ERROR, or [] for anything else. */
export function apiFieldProblems(err: unknown): ApiFieldProblem[] {
  if (!isApiErrorCode(err, "VALIDATION_ERROR")) return [];
  const details = apiErrorDetails<unknown>(err);
  if (!Array.isArray(details)) return [];
  return details.filter(
    (d): d is ApiFieldProblem =>
      !!d && typeof (d as ApiFieldProblem).field === "string" && typeof (d as ApiFieldProblem).message === "string"
  );
}

/**
 * Whether a list request failed because its paging cursor is unknown (the
 * anchor row was deleted, or the URL came from another workspace). The
 * backend reports it as a VALIDATION_ERROR on the cursor field — `cursor`
 * on the orders list, `before` on the flagged-orders and sessions lists.
 */
export function isInvalidCursorError(err: unknown, field: "cursor" | "before" = "cursor"): boolean {
  return apiFieldProblems(err).some((p) => p.field === field);
}

/** The request id the server logged this failure under, for support. */
export function apiErrorRequestId(err: unknown): string | undefined {
  if (!(err instanceof ApiError)) return undefined;
  const body = err.details as { error?: { requestId?: unknown } } | null | undefined;
  const id = body && typeof body === "object" ? body.error?.requestId : undefined;
  return typeof id === "string" ? id : undefined;
}

/**
 * The funnels blocking a permanent product delete — PRODUCT_IN_FUNNEL puts
 * them at `details[0].funnelIds`. [] for any other error.
 */
export function productInFunnelIds(err: unknown): string[] {
  if (!isApiErrorCode(err, "PRODUCT_IN_FUNNEL")) return [];
  const details = apiErrorDetails<unknown>(err);
  const first = Array.isArray(details) ? (details[0] as { funnelIds?: unknown } | undefined) : undefined;
  const ids = first?.funnelIds;
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
}

/**
 * The bookings a 409 CARRIER_MANUAL_CANCEL_REQUIRED names — the ones the
 * merchant must cancel in the courier's own dashboard. [] for any other error.
 */
export function manualCancelShipments(err: unknown): ManualCancelShipment[] {
  if (!isApiErrorCode(err, "CARRIER_MANUAL_CANCEL_REQUIRED")) return [];
  const shipments = apiErrorDetails<ManualCancelRequiredDetails>(err)?.shipments;
  return Array.isArray(shipments) ? shipments : [];
}
