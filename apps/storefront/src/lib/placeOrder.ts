import {
  ApiError,
  apiErrorDetails,
  apiFieldProblems,
  isApiErrorCode,
  type ApiClient,
  type CheckoutPayload,
  type CustomizationInput,
  type Order,
} from "@store-builder/api-client";
import { botGuardFields } from "./botGuard";
import { adMatchFields } from "./adMatch";
import { withCheckoutOtp } from "./checkoutOtp";
import { saveOrderSnapshot, snapshotFromOrder } from "./commerce";
import { couponRefusalOfError, type CouponMessageContext } from "./couponRefusals";
import type { Dictionary } from "./i18n";
import type { OrderFormErrors, OrderFormField } from "./orderForm";
import { storeHref } from "./storeHref";

export interface OrderLine {
  variantId: string;
  offerId?: string;
  quantity: number;
  /** Answers to the product's custom fields (photos by upload id). */
  customizations?: CustomizationInput;
  /** Menu options picked (Size, Extras); the server prices them. */
  options?: import("@store-builder/api-client").MenuOptionsInput;
}

/**
 * Places a COD order through the real storefront checkout (which attaches a
 * fresh Idempotency-Key per request).
 *
 *  - `cartToken`  → order from the shopper's cart (the /checkout page).
 *  - no token     → Buy Now: `payload.item` is the single line.
 *
 * A ticked order bump rides along as `payload.orderBump` either way: the
 * server adds it to the same order from the merchant's offer.
 */
export async function placeCodOrder({
  client,
  workspaceId,
  payload,
  cartToken,
  visitorId,
  shopperToken,
}: {
  client: ApiClient;
  workspaceId: string;
  payload: CheckoutPayload;
  cartToken?: string;
  /** The shopper's visitor id — it owns any photo answering a custom field. */
  visitorId?: string;
  /** The signed-in shopper's token, when the order uses their points, credit, level or invite; nothing is sent without one. */
  shopperToken?: string | null;
}): Promise<Order> {
  // The bot guard's token and honeypot ride along with every order (lib/botGuard).
  const guarded = { ...payload, ...(await botGuardFields(client, workspaceId)), ...adMatchFields(workspaceId) };
  // A store that verifies phones answers OTP_REQUIRED first; the code is asked for and the order sent again.
  return withCheckoutOtp(workspaceId, payload.contact.phone, (otp) =>
    client.checkout(workspaceId, { ...guarded, ...otp }, cartToken, { visitorId, shopperToken })
  );
}

/**
 * The ticked order bump was refused: it sold out or was withdrawn a moment
 * ago (ORDER_BUMP_UNAVAILABLE), or the merchant changed it since this page
 * loaded (ORDER_BUMP_INVALID). Either way the form unticks it and says so.
 */
export function isOrderBumpRefused(err: unknown): boolean {
  return isApiErrorCode(err, "ORDER_BUMP_UNAVAILABLE") || isApiErrorCode(err, "ORDER_BUMP_INVALID");
}

/**
 * Remember the order on this device (thank-you + tracking) and return its
 * thank-you URL, resolved against how this store is being served — `basePath`
 * comes from `useStoreBasePath()`, and is empty on the store's own subdomain.
 */
export function afterOrder({
  workspaceId,
  basePath,
  order,
  phone,
}: {
  workspaceId: string;
  basePath: string;
  order: Order;
  phone: string;
}): string {
  saveOrderSnapshot(workspaceId, snapshotFromOrder(order, phone));
  const q = new URLSearchParams({ number: order.orderNumber });
  return storeHref(basePath, `/orders/${order.id}?${q.toString()}`);
}

type OrderErrorCopy = Dictionary["form"]["errors"];

/** The request fields a checkout 422 can name, mapped onto the form's fields. */
const SERVER_FIELDS: Record<string, OrderFormField> = {
  "contact.fullName": "fullName",
  "contact.phone": "phone",
  "contact.alternatePhone": "altPhone",
  "contact.email": "email",
  "shippingAddress.province": "governorate",
  "shippingAddress.city": "city",
  "shippingAddress.addressLine": "address",
  "shippingAddress.postalCode": "postalCode",
  "shippingAddress.notes": "notes",
  "shippingAddress.country": "country",
  "formFields.sa_national_address": "nationalAddress",
  "formFields.custom_1": "custom1",
  "formFields.custom_2": "custom2",
  "formFields.custom_3": "custom3",
  "formFields.custom_4": "custom4",
  "formFields.custom_5": "custom5",
};

/**
 * Field errors the server reported (e.g. a field the merchant made required
 * after this page loaded), in the shopper's language rather than Joi's.
 */
export function serverFieldErrors(err: unknown, copy: OrderErrorCopy): OrderFormErrors {
  const out: OrderFormErrors = {};
  if (isApiErrorCode(err, "INVALID_PHONE")) out.phone = copy.phone;
  // The store does not deliver there: said once, on the governorate, not as "required".
  if (isApiErrorCode(err, "AREA_NOT_SERVED")) return { ...out, governorate: copy.areaNotServed };
  if (isApiErrorCode(err, "DELIVERY_ZONE_REQUIRED")) return { ...out, deliveryZoneId: copy.zone };
  if (isApiErrorCode(err, "DELIVERY_ZONE_INVALID")) return { ...out, deliveryZoneId: copy.zoneInvalid };
  for (const problem of apiFieldProblems(err)) {
    const field = SERVER_FIELDS[problem.field];
    if (!field || out[field]) continue;
    out[field] =
      field === "email" && /required/i.test(problem.message)
        ? copy.emailRequired
        : ((copy as Record<string, unknown>)[field] as string | undefined) ?? copy.required;
  }
  return out;
}

/**
 * Self delivery and menu refusals (422), in the shopper's language; null for any other error.
 * Shared by the order forms and the cart (add, change quantity).
 */
function knownRefusal(err: unknown, copy: OrderErrorCopy): string | null {
  // Below the store's minimum, or outside the governorates it delivers to.
  if (isApiErrorCode(err, "MIN_ORDER_NOT_MET")) return copy.minOrder;
  if (isApiErrorCode(err, "AREA_NOT_SERVED")) return copy.areaNotServed;
  if (isApiErrorCode(err, "DELIVERY_ZONE_REQUIRED")) return copy.zone;
  if (isApiErrorCode(err, "DELIVERY_ZONE_INVALID")) return copy.zoneInvalid;
  if (isApiErrorCode(err, "PICKUP_NOT_AVAILABLE")) return copy.pickupUnavailable;
  // The store's Zimos balance reached its plan's limit: new orders wait, the store stays open.
  if (isApiErrorCode(err, "WALLET_LIMIT_REACHED")) return copy.ordersPaused;
  // Menu options missing, changed or no longer offered.
  if (isApiErrorCode(err, "OPTIONS_INVALID")) return copy.optionsInvalid;
  // Closed (opening hours or the "accepting orders" switch): the store's own message when it wrote one.
  if (isApiErrorCode(err, "STORE_CLOSED")) {
    const details = apiErrorDetails<Array<{ field?: string; message?: string }>>(err);
    const detail = Array.isArray(details) ? details.find((p) => p && p.field === "store") : undefined;
    return detail && detail.message && detail.message !== "The store is closed" ? detail.message : copy.storeClosed;
  }
  return null;
}

/**
 * A failed cart action (add a product, change a quantity): the refusals above
 * in the shopper's language; anything else as before — the server's text, else `fallback`.
 */
export function cartErrorMessage(err: unknown, copy: OrderErrorCopy, fallback: string): string {
  return knownRefusal(err, copy) ?? (err instanceof Error && err.message ? err.message : fallback);
}

/**
 * The banner for a failed order. A refused order (ORDER_REJECTED) always gets
 * the same polite, generic copy: the reason is the merchant's business, and
 * naming it would tell a fraudster which rule to dodge.
 */
export function orderErrorMessage(
  err: unknown,
  copy: OrderErrorCopy,
  /** The shopper's language and money: with them, a checkout refused for its coupon says why (lib/couponRefusals). */
  coupon?: CouponMessageContext
): string {
  if (isApiErrorCode(err, "ORDER_REJECTED")) return copy.rejected;
  // A custom-field answer that no longer holds (a photo past its 48 hours, a field the merchant changed).
  if (isApiErrorCode(err, "CUSTOM_FIELDS_INVALID")) return copy.customFields;
  if (isOrderBumpRefused(err)) return copy.bumpUnavailable;
  const known = knownRefusal(err, copy);
  if (known) return known;
  const couponRefused = coupon ? couponRefusalOfError(err, coupon) : null;
  if (couponRefused) return couponRefused;
  if (err instanceof ApiError && err.message) return err.message;
  if (err instanceof Error && err.message && !/fetch/i.test(err.message)) return err.message;
  return copy.generic;
}
