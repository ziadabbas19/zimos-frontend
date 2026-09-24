import { ApiError } from "./client";

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
  // storefront checkout / fraud / autosave
  | "ORDER_REJECTED"
  | "INVALID_PHONE"
  | "CART_NOT_FOUND"
  | "CART_TOKEN_OR_ITEM_REQUIRED"
  // funnel runtime
  | "STEP_MISMATCH"
  | "FUNNEL_PAUSED"
  // couriers
  | "CARRIERS_NOT_CONFIGURED"
  | "CARRIER_AUTH_FAILED"
  | "CARRIER_PERMISSION_DENIED"
  | "CARRIER_ADDRESS_UNMATCHED"
  | "CARRIER_CURRENCY_UNSUPPORTED"
  | "CARRIER_COD_LIMIT"
  | "CARRIER_ERROR"
  | "CARRIER_NOT_CONNECTED"
  | "CARRIER_CANCEL_FAILED"
  | "CARRIER_CREDENTIALS_UNREADABLE"
  | "SHIPMENT_NOT_CARRIER_MANAGED"
  | "LABEL_NOT_AVAILABLE"
  | (string & {});

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
