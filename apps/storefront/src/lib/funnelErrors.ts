import { ApiError, apiFieldProblems, isApiErrorCode } from "@store-builder/api-client";

/**
 * Sorts a funnel-runtime failure by what the shopper should see next. Only
 * error codes, HTTP status and `details[].field` are read, never the message
 * text, which the backend is free to reword.
 *
 * The backend doesn't separate its 404s yet: an unknown session, a funnel
 * that isn't published, a step missing from the snapshot, and an accepted
 * offer whose order or offer is gone all come back as NOT_FOUND. So `notFound`
 * is ambiguous on purpose, and the callers work out which case it is by
 * asking for the session's step (see FunnelStep's `useAdvance` and the step
 * page's redirect to the entry).
 */
export type FunnelErrorKind =
  | "paused" // 410 FUNNEL_PAUSED
  | "stepMismatch" // 409 STEP_MISMATCH: the session is no longer on the step this outcome came from
  | "notFound" // 404 NOT_FOUND
  | "offerNeedsOrder" // 422 on the `session` field: an upsell accepted before any checkout order
  | "network" // no answer at all
  | "other";

export function funnelErrorKind(err: unknown): FunnelErrorKind {
  if (!(err instanceof ApiError)) return "network";
  if (err.code === "FUNNEL_PAUSED" || err.status === 410) return "paused";
  if (err.code === "STEP_MISMATCH") return "stepMismatch";
  if (err.status === 404) return "notFound";
  if (apiFieldProblems(err).some((p) => p.field === "session")) return "offerNeedsOrder";
  return "other";
}

/** A refusal from the order engine behind an accepted offer. */
export function isOutOfStock(err: unknown): boolean {
  return isApiErrorCode(err, "INSUFFICIENT_STOCK");
}
