import { ApiError } from "./client";
import type {
  CarrierAddressNamesRequiredDetail,
  CarrierAddressRejectedDetail,
  ManualCancelRequiredDetails,
  ManualCancelShipment,
} from "./types";

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
  | "TASK_ASSIGNED_TO_OTHER" // 403, details = { assignedTo } — only the assignee or a manager may take it
  | "ASSIGNEE_NOT_MEMBER" // 422 — not an active member of this workspace
  | "ASSIGNEE_CANNOT_CONFIRM" // 422 — their role lacks orders.confirm
  // custom fields and shoppers' photos
  | "CUSTOM_FIELDS_INVALID" // 422, details = [{ field: "customizations.<id>", code }]
  | "FILE_TOO_LARGE" // 413
  | "UNSUPPORTED_MEDIA_TYPE" // 415
  | "IMAGE_UNREADABLE" // 422
  | "TOO_MANY_PENDING_UPLOADS" // 429
  | "VISITOR_ID_REQUIRED" // 400
  // storefront checkout / fraud / autosave
  | "ORDER_REJECTED"
  | "INVALID_PHONE"
  // 422 on saving the fraud rules: phone codes switched on (or a rule asking for one) while no
  // channel can deliver them; details[0] = { field, message, channel } (CHECKOUT_OTP_DELIVERY_GUARD_ENABLED)
  | "OTP_CHANNEL_UNAVAILABLE"
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
  // billing — agent referral codes
  | "REFERRAL_CODE_INVALID" // 422 — unknown or inactive code (never says which)
  | "REFERRAL_CODE_ALREADY_SET" // 409 — the subscription already has a code
  | "CHARGE_ALREADY_PAID" // 409 — recording a payment on a paid charge (console)
  | "CHARGE_NOT_PAID" // 409 — reversing a charge that isn't paid (console)
  | "PAYMENT_CONFIRMED_BY_GATEWAY" // 409 — reversing a gateway payment; only manual ones can be (console)
  | "OPEN_CHARGE_EXISTS" // 409 — reversing while the subscription has another pending charge (console)
  | "COMMISSION_VOIDED" // 409 — marking a voided ledger row paid
  // billing — paying the subscription online (Fawaterak)
  | "ONLINE_BILLING_DISABLED" // 404 — online payment is switched off on the platform
  | "ONLINE_BILLING_UNAVAILABLE" // 503 — the gateway keys are missing or refused
  | "ONLINE_PAYMENT_CURRENCY_UNSUPPORTED" // 409 — the plan isn't priced in EGP
  | "ONLINE_PAYMENT_START_FAILED" // 502 — the gateway gave no checkout; nothing was charged
  | "PAYMENT_STARTING" // 409 — a second press while the first checkout is being made
  | "NOTHING_TO_PAY" // 409 — the charge comes to nothing (a full discount)
  | "CHARGE_NOT_PENDING" // 409 — the charge was settled in the meantime
  | "CHARGE_AMOUNT_CHANGED" // 409, details = { amountDue, currency } — a transfer's proof sent with an expectedAmount the charge no longer comes to
  // billing — changing plan by itself (/billing/plan-switch, PLAN_SWITCH_ENABLED)
  | "PLAN_SWITCH_DISABLED" // 404 — preview or start while the switch is off
  | "PLAN_CHANGE_NEEDS_SUPPORT" // 409 — the subscription is cancelled or suspended (or, on POST /billing/plan, paid)
  | "MANUAL_PRICING" // 409 — the plan's price was set in the console
  | "SPECIAL_TERMS_ACTIVE" // 409 — a special-terms grant is running
  | "PROOF_UNDER_REVIEW" // 409, details = { invoiceId } — a transfer for the charge waiting is being checked
  | "PLAN_SWITCH_ALREADY_BILLED" // 409, details = { invoiceId, effectiveAt } — the period after a scheduled change is paid at its price
  | "NO_PAYMENT_METHOD" // 409, details = { currency } — no gateway or transfer is offered for that currency
  | "SWITCH_AMOUNT_CHANGED" // 409, details = { amountDue, currency } — expectedAmount is no longer the amount due
  | "PLAN_SWITCH_BUSY" // 409 — another change was made at the same moment
  | "PLAN_SWITCH_WAITING" // 409 — PATCH /billing (the cycle) while a switch waits
  // store access (workspaces/workspaceAccessService)
  | "SUBSCRIPTION_REQUIRED" // 402 — creating a product or funnel while unpaid past the grace day
  | "STORE_SUSPENDED" // 403 — creating a product or funnel while suspended by the platform
  | "STORE_UNAVAILABLE" // 423 — any public store route of a restricted store; details.store = { name, slug, defaultLocale, logoUrl }
  // 402 — locked orders on: the order's customer details are hidden, so it is not confirmed, shipped,
  // messaged or edited; details = { reason: "subscription" | "balance", balance?, fee?, freeLeft?, currency? }
  | "ORDER_LOCKED"
  | "WORKSPACE_ALREADY_SUSPENDED" // 409 (console)
  | "WORKSPACE_NOT_SUSPENDED" // 409 (console)
  | "WORKSPACE_NOT_ACTIVE" // 409 (console)
  | "SPECIAL_PRICE_ACTIVE" // 409 — another price override still has charges left (console)
  | "SUBSCRIPTION_CANCELLED" // 409 — special terms on a cancelled subscription (console)
  | "PLAN_IS_FREE" // 409 — pricing a charge on a free plan (console)
  | "NO_PLAN" // 409 — pricing a charge for a subscription with no plan (console)
  | "PLAN_FEATURE_NOT_AVAILABLE" // 422, details[] = { field: "features", key, message } — a feature that doesn't exist yet added to a plan (console)
  | "PLAN_FEATURE_REQUIRED" // 403, details = PlanFeatureRequiredDetails — the store's plan lacks the feature (PLAN_FEATURE_ENFORCEMENT on)
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
  | "CARRIER_ADDRESS_NAMES_REQUIRED" // 422, details[0] = CarrierAddressNamesRequiredDetail — resend with carrierAddress.names
  | "CARRIER_ADDRESS_REJECTED" // 422, details[0] = CarrierAddressRejectedDetail — the courier refused one level (or all) of the address
  | "CARRIER_CURRENCY_UNSUPPORTED"
  | "CARRIER_COD_LIMIT"
  | "CARRIER_ERROR" // 424 (502 on older servers), details = CarrierErrorDetails — the courier failed; show the server's message
  | "CARRIER_NOT_CONNECTED"
  | "CARRIER_CANCEL_FAILED"
  | "CARRIER_CREDENTIALS_UNREADABLE"
  | "SHIPMENT_NOT_CARRIER_MANAGED"
  | "LABEL_NOT_AVAILABLE"
  | "CARRIER_TIER_UNMAPPED" // 422, details = { tierId } — the booked tier has no package mapping
  | "CARRIER_MANUAL_CANCEL_REQUIRED" // 409, details = ManualCancelRequiredDetails — repeat with acknowledgeManualCancel
  | "CARRIER_CONNECT_CONFLICT" // 409 — two first-time connects raced; the other one was stored
  | "CARRIER_BOOKING_NOT_SAVED" // 424 (502 on older servers), details = CarrierBookingNotSavedDetails — cancel it in the courier's dashboard
  // online payments
  | "PAYMENTS_ONLINE_DISABLED" // 404 — shopper payment endpoints while online payments are off
  | "GATEWAYS_NOT_CONFIGURED" // 503 — no GATEWAY_CREDENTIALS_KEY on the server
  | "GATEWAY_AUTH_FAILED" // 422 — the gateway refused the keys
  | "GATEWAY_KEYS_MODE_MISMATCH" // 422 — a test key with a live key
  | "GATEWAY_KEYS_UNRECOGNISED" // 422
  | "GATEWAY_REJECTED" // 422
  | "GATEWAY_ERROR" // 424 (502 on older servers) — the gateway failed; show the server's message
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

/**
 * The address levels a 422 CARRIER_ADDRESS_NAMES_REQUIRED asks names for,
 * top first (J&T: governorate, city, area). null for any other error.
 */
export function carrierAddressNamesLevels(err: unknown): string[] | null {
  if (!isApiErrorCode(err, "CARRIER_ADDRESS_NAMES_REQUIRED")) return null;
  const details = apiErrorDetails<unknown>(err);
  const first = Array.isArray(details) ? (details[0] as Partial<CarrierAddressNamesRequiredDetail> | undefined) : undefined;
  const levels = first?.levels;
  return Array.isArray(levels) ? levels.filter((l): l is string => typeof l === "string") : [];
}

/**
 * Which part of the drop-off address a 422 CARRIER_ADDRESS_REJECTED names:
 * `index` is the level's position (from `field`'s ".N" suffix), null when
 * the courier refused the address as a whole. `message` is the server's
 * sentence ("J&T does not recognise the city …"). null for any other error.
 */
export function carrierAddressRejection(
  err: unknown
): { index: number | null; level: string | null; message: string } | null {
  if (!isApiErrorCode(err, "CARRIER_ADDRESS_REJECTED")) return null;
  const details = apiErrorDetails<unknown>(err);
  const first = Array.isArray(details) ? (details[0] as Partial<CarrierAddressRejectedDetail> | undefined) : undefined;
  const match = typeof first?.field === "string" ? /\.(\d+)$/.exec(first.field) : null;
  return {
    index: match ? Number(match[1]) : null,
    level: typeof first?.level === "string" ? first.level : null,
    message: err.message,
  };
}
