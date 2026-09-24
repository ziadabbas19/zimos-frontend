import {
  ApiError,
  apiFieldProblems,
  isApiErrorCode,
  type ApiClient,
  type CheckoutPayload,
  type Order,
} from "@store-builder/api-client";
import { saveOrderSnapshot, snapshotFromOrder } from "./commerce";
import type { Dictionary } from "./i18n";
import type { OrderFormErrors, OrderFormField } from "./orderForm";
import { storeHref } from "./storeHref";

export interface OrderLine {
  variantId: string;
  offerId?: string;
  quantity: number;
}

/**
 * Places a COD order through the real storefront checkout (which attaches a
 * fresh Idempotency-Key per request).
 *
 *  - `cartToken`  → order from the shopper's cart (the /checkout page).
 *  - `lines`      → several lines from a product page (e.g. product + order
 *                   bump): they go into a *fresh, isolated* guest cart so the
 *                   shopper's main cart is never touched, then check out.
 *  - neither      → Buy Now: `payload.item` is the single line.
 */
export async function placeCodOrder({
  client,
  workspaceId,
  payload,
  cartToken,
  lines,
}: {
  client: ApiClient;
  workspaceId: string;
  payload: CheckoutPayload;
  cartToken?: string;
  lines?: OrderLine[];
}): Promise<Order> {
  if (lines && lines.length > 0) {
    const cart = await client.getOrCreateCart(workspaceId);
    for (const line of lines) {
      await client.addCartItem(workspaceId, cart.guestToken, line);
    }
    const { item: _ignored, ...rest } = payload;
    void _ignored;
    return client.checkout(workspaceId, rest, cart.guestToken);
  }
  return client.checkout(workspaceId, payload, cartToken);
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
};

/**
 * Field errors the server reported (e.g. a field the merchant made required
 * after this page loaded), in the shopper's language rather than Joi's.
 */
export function serverFieldErrors(err: unknown, copy: OrderErrorCopy): OrderFormErrors {
  const out: OrderFormErrors = {};
  if (isApiErrorCode(err, "INVALID_PHONE")) out.phone = copy.phone;
  for (const problem of apiFieldProblems(err)) {
    const field = SERVER_FIELDS[problem.field];
    if (!field || out[field]) continue;
    out[field] =
      field === "email" && /required/i.test(problem.message) ? copy.emailRequired : copy[field];
  }
  return out;
}

/**
 * The banner for a failed order. A refused order (ORDER_REJECTED) always gets
 * the same polite, generic copy: the reason is the merchant's business, and
 * naming it would tell a fraudster which rule to dodge.
 */
export function orderErrorMessage(err: unknown, copy: OrderErrorCopy): string {
  if (isApiErrorCode(err, "ORDER_REJECTED")) return copy.rejected;
  if (err instanceof ApiError && err.message) return err.message;
  if (err instanceof Error && err.message && !/fetch/i.test(err.message)) return err.message;
  return copy.generic;
}
