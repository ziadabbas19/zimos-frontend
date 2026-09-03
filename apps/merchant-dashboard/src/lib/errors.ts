import { ApiError } from "@store-builder/api-client";

export { ApiError };

interface FieldDetail {
  field: string;
  message: string;
}

/** A human message for any thrown value. */
export function getErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (err instanceof ApiError) {
    if (err.status === 403) {
      return err.message || "You don't have permission to do that.";
    }
    if (err.status === 0 || err.message === "Failed to fetch") {
      return "Can't reach the server. Check your connection and try again.";
    }
    return err.message || fallback;
  }
  if (err instanceof TypeError && /fetch/i.test(err.message)) {
    return "Can't reach the server. Check your connection and try again.";
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

/**
 * Field-level validation errors from a 422, keyed by field name. The backend
 * envelope is { error: { code, details: [{ field, message }] } } and ApiError
 * stores the whole body in `.details`. A duplicate-SKU 409 is mapped onto `sku`.
 */
export function getFieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError)) return {};

  if (err.code === "DUPLICATE_RESOURCE") {
    return { sku: "That SKU is already used by another variant." };
  }

  const body = err.details as { error?: { details?: unknown } } | undefined;
  const details = body?.error?.details;
  if (!Array.isArray(details)) return {};

  const out: Record<string, string> = {};
  for (const d of details as FieldDetail[]) {
    if (d && typeof d.field === "string" && !out[d.field]) {
      // Joi paths like "lines.0.variantId" — key on the leaf and the head.
      out[d.field] = d.message;
      const head = d.field.split(".")[0];
      if (head && !out[head]) out[head] = d.message;
    }
  }
  return out;
}

export function isPermissionError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403;
}
