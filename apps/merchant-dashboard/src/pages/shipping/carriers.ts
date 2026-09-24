import type { Order, Shipment, ShipmentStatus } from "@store-builder/api-client";
import type { Locale } from "@/i18n/LocaleContext";

/**
 * Role keys that manage couriers and shipments. Connecting a courier needs
 * shipping.manage; creating, updating, syncing and labelling a shipment
 * need orders.manage. The system roles holding either are the same three
 * (Backend core/security/permissions.js SYSTEM_ROLES; owner holds "*").
 * The dashboard only sees the role key, so a custom role reads as view-only,
 * and a 403 flips an editable screen to view-only.
 */
export const SHIPPING_ROLES: ReadonlySet<string> = new Set(["owner", "workspace_manager", "order_operator"]);

export const BOSTA = "bosta";

/**
 * A courier name reduced to what distinguishes it, as the backend folds it
 * (carriers/index.js foldCourierName): case, spacing and separators dropped;
 * for Arabic, tatweel and diacritics dropped and ة read as ه.
 */
function foldCourierName(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "")
    .replace(/ة/g, "ه")
    .replace(/[\s\-_.]+/g, "");
}

/** Bosta's code and nameAliases (Backend carriers/bosta.js), folded. */
const RESERVED_COURIER_NAMES: ReadonlySet<string> = new Set([BOSTA, "بوسطة", "بوسته"].map(foldCourierName));

/**
 * Whether free text spells a courier's name ("Bosta", "bo-sta", "بوسطه").
 * The backend refuses those as manual courier names (422
 * CARRIER_NAME_RESERVED) so a manual row never passes for a booking.
 */
export function isReservedCourierName(name: string): boolean {
  return RESERVED_COURIER_NAMES.has(foldCourierName(name));
}

/** "The COD amount should be less than or equal 30000 EGP" — Bosta error 3007. In piastres. */
export const BOSTA_MAX_COD_MINOR = 30_000 * 100;

/**
 * Statuses after which the order may be booked again. `failed` is NOT one:
 * at Bosta it is often an exception the courier will re-attempt, so the
 * backend refuses a second booking until the merchant marks it cancelled.
 */
export const FINISHED_SHIPMENT_STATUSES: ReadonlySet<ShipmentStatus> = new Set(["cancelled", "returned"]);

/**
 * Booked through a connected courier, as opposed to a manual row whose free
 * text happens to say "bosta". Mirrors isCarrierBooked in the backend's
 * carrierShipmentService: only these can be synced or labelled.
 */
export function isCarrierBooked(shipment: Shipment): boolean {
  const response = shipment.carrierResponse;
  return Boolean(
    shipment.carrierCode !== "manual" &&
      shipment.waybillNumber &&
      response &&
      Object.prototype.hasOwnProperty.call(response, "carrierShipmentId")
  );
}

/** What the courier collects, in minor units: the unpaid part of a COD order (codAmountFor). */
export function codAmountFor(order: Pick<Order, "paymentMethod" | "totalAmount" | "amountPaid">): number {
  if (order.paymentMethod !== "cod") return 0;
  return Math.max(0, Number(order.totalAmount) - Number(order.amountPaid));
}

/** A courier's city/district name in the active language, falling back to the other one. */
export function placeName(
  place: { name: string | null; nameAr: string | null } | null | undefined,
  locale: Locale
): string {
  if (!place) return "—";
  const first = locale === "ar" ? place.nameAr : place.name;
  return first || place.name || place.nameAr || "—";
}
