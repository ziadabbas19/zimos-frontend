import { ApiError, apiFieldProblems, isApiErrorCode, type ApiErrorCode } from "@store-builder/api-client";

/**
 * Sorts a funnel-runtime failure by what the shopper should see next. Only
 * error codes, HTTP status and `details[].field` are read, never the message
 * text, which the backend is free to reword.
 *
 * The backend names each funnel failure with its own code (FUNNEL_NOT_FOUND,
 * FUNNEL_SESSION_NOT_FOUND, …). Older backends sent a bare NOT_FOUND or
 * VALIDATION_ERROR for the same cases, so the code is tried first and the
 * status / `details[].field` checks stay as the fallback.
 *
 * `notFound` still covers every 404 on purpose: an unknown session, a funnel
 * that isn't published, a step missing from the snapshot, and an accepted
 * offer whose order or offer is gone. The callers work out which case it is
 * by asking for the session's step (see FunnelStep's `useAdvance` and the
 * step page's redirect to the entry), which works against either backend.
 */
export type FunnelErrorKind =
  | "paused" // 410 FUNNEL_PAUSED
  | "stepMismatch" // 409 STEP_MISMATCH: the session is no longer on the step this outcome came from
  | "notFound" // 404 FUNNEL_NOT_FOUND / FUNNEL_SESSION_NOT_FOUND / FUNNEL_STEP_NOT_FOUND / FUNNEL_OFFER_UNAVAILABLE / NOT_FOUND
  | "offerNeedsOrder" // 422 FUNNEL_OFFER_NEEDS_ORDER, or VALIDATION_ERROR on `session`: an upsell accepted before any checkout order
  | "network" // no answer at all
  | "other";

const KIND_BY_CODE: Partial<Record<ApiErrorCode, FunnelErrorKind>> = {
  FUNNEL_PAUSED: "paused",
  STEP_MISMATCH: "stepMismatch",
  FUNNEL_NOT_FOUND: "notFound",
  FUNNEL_SESSION_NOT_FOUND: "notFound",
  FUNNEL_STEP_NOT_FOUND: "notFound",
  FUNNEL_OFFER_UNAVAILABLE: "notFound",
  FUNNEL_OFFER_NEEDS_ORDER: "offerNeedsOrder",
};

export function funnelErrorKind(err: unknown): FunnelErrorKind {
  if (!(err instanceof ApiError)) return "network";
  const byCode = err.code ? KIND_BY_CODE[err.code] : undefined;
  if (byCode) return byCode;
  // Fallback for a backend without the funnel codes.
  if (err.status === 410) return "paused";
  if (err.status === 404) return "notFound";
  if (apiFieldProblems(err).some((p) => p.field === "session")) return "offerNeedsOrder";
  return "other";
}

/** A refusal from the order engine behind an accepted offer. */
export function isOutOfStock(err: unknown): boolean {
  return isApiErrorCode(err, "INSUFFICIENT_STOCK");
}
