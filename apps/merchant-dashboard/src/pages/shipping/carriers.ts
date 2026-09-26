import {
  isCityDistrictLevels,
  type CarrierInfo,
  type Order,
  type Shipment,
  type ShipmentStatus,
} from "@store-builder/api-client";
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

/**
 * Role keys holding users.manage, which GET /members needs. Used only to
 * put a name to "who acknowledged a manual cancel"; any other role (or a
 * 403) falls back to "a team member".
 */
export const TEAM_ROLES: ReadonlySet<string> = new Set(["owner", "workspace_manager"]);

/**
 * Couriers whose name is refused as a manual courier name even on a store
 * that hasn't connected them (the adapter's reserveNameWhenUnconnected,
 * which GET /carriers doesn't expose). Every other courier's name is
 * reserved only once the store connects it.
 */
const ALWAYS_RESERVED_CODES: ReadonlySet<string> = new Set(["bosta"]);

/**
 * A courier's own limits that the booking form checks before asking the
 * server (the server refuses with CARRIER_CURRENCY_UNSUPPORTED /
 * CARRIER_COD_LIMIT either way). Couriers not listed have none known here.
 */
export const COURIER_BOOKING_LIMITS: Readonly<Record<string, { currency: string; maxCodMinor: number }>> = {
  // "The COD amount should be less than or equal 30000 EGP" — Bosta error 3007. In piastres.
  bosta: { currency: "EGP", maxCodMinor: 30_000 * 100 },
};

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

export interface ReservedCourier {
  code: string;
  name: string;
  connected: boolean;
}

/**
 * The courier free text spells ("Bosta", " bo-sta "), when that name is
 * refused as a manual courier name on this store: an always-reserved
 * courier, or one the store connected (by code or display name). null when
 * the name is free. The backend has the last word (422
 * CARRIER_NAME_RESERVED, including aliases this list can't see).
 */
export function reservedCourierFor(name: string, carriers: readonly CarrierInfo[]): ReservedCourier | null {
  const folded = foldCourierName(name);
  if (!folded) return null;
  for (const carrier of carriers) {
    const spells = [carrier.code, carrier.name].some((n) => foldCourierName(n) === folded);
    if (spells && (carrier.connection || ALWAYS_RESERVED_CODES.has(carrier.code))) {
      return { code: carrier.code, name: carrier.name, connected: Boolean(carrier.connection) };
    }
  }
  // An always-reserved courier this server's list didn't include.
  if (ALWAYS_RESERVED_CODES.has(folded)) {
    return { code: folded, name: folded.charAt(0).toUpperCase() + folded.slice(1), connected: false };
  }
  return null;
}

/** The courier's address levels, top first. A server without them only had city/district couriers. */
export function carrierLevels(carrier: CarrierInfo): string[] {
  return carrier.capabilities?.addressLevels ?? ["city", "district"];
}

/** Keeps the original city/district picker and `{ cityId, districtId }` payload. */
export function usesCityDistrict(carrier: CarrierInfo): boolean {
  return isCityDistrictLevels(carrier.capabilities?.addressLevels);
}

/** Whether a level path picks one node on every level (what `carrierAddress.path` must be). */
export function isPathComplete(path: string[], levels: string[]): boolean {
  return path.length === levels.length && path.every(Boolean);
}

/** No cancel API: the merchant cancels in the courier's dashboard and tells us so. */
export function cancelsManually(carrier: CarrierInfo | undefined): boolean {
  return carrier?.capabilities?.cancel === "manual";
}

/**
 * Statuses after which the order may be booked again. `failed` is NOT one:
 * at Bosta it is often an exception the courier will re-attempt, so the
 * backend refuses a second booking until the merchant marks it cancelled.
 */
export const FINISHED_SHIPMENT_STATUSES: ReadonlySet<ShipmentStatus> = new Set(["cancelled", "returned"]);

/** A shipment the courier can no longer move (Backend TERMINAL_STATUSES). */
export const TERMINAL_SHIPMENT_STATUSES: ReadonlySet<ShipmentStatus> = new Set(["delivered", "returned", "cancelled"]);

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

/** A courier's place name in the active language, falling back to the other one. */
export function placeName(
  place: { name: string | null; nameAr: string | null } | null | undefined,
  locale: Locale
): string {
  if (!place) return "—";
  const first = locale === "ar" ? place.nameAr : place.name;
  return first || place.name || place.nameAr || "—";
}

export type CarrierEnvironment = "production" | "sandbox";

/** The credential key that picks a courier's system (J&T: production or sandbox). */
export const ENVIRONMENT_FIELD = "environment";

const environmentKey = (workspaceId: string, code: string) => `zimos_carrier_env_${workspaceId}_${code}`;

/**
 * Records which system this browser last connected a courier with. GET
 * /carriers doesn't say (credentials are write-only), so this is what the
 * Sandbox badge falls back to. Tied to the connection's connectedAt: a
 * disconnect and reconnect elsewhere makes it stale, and it is then ignored.
 */
export function rememberCarrierEnvironment(
  workspaceId: string,
  code: string,
  value: { environment: CarrierEnvironment; connectedAt: string } | null
) {
  try {
    if (value) localStorage.setItem(environmentKey(workspaceId, code), JSON.stringify(value));
    else localStorage.removeItem(environmentKey(workspaceId, code));
  } catch {
    // Storage blocked: the badge just follows the server alone.
  }
}

/** Which system a connected courier uses: the server's word when it sends one, else what this browser connected with. */
export function carrierEnvironment(workspaceId: string, carrier: CarrierInfo): CarrierEnvironment | null {
  const connection = carrier.connection;
  if (!connection) return null;
  if (connection.environment) return connection.environment;
  try {
    const raw = localStorage.getItem(environmentKey(workspaceId, carrier.code));
    const saved = raw ? (JSON.parse(raw) as { environment?: unknown; connectedAt?: unknown }) : null;
    if (saved && saved.connectedAt === connection.connectedAt && (saved.environment === "sandbox" || saved.environment === "production")) {
      return saved.environment;
    }
  } catch {
    // Unreadable or blocked storage: unknown.
  }
  return null;
}
