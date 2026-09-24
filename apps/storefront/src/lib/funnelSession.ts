import { useMemo, useSyncExternalStore } from "react";
import type { FunnelRuntimeFollowOnOrder } from "@store-builder/api-client";

/**
 * What a funnel keeps on this device, next to the session the backend holds.
 *
 *  - The funnel visitor id. The backend resumes a visitor's newest *active*
 *    session when the funnel is entered again, so the id must outlive the tab:
 *    localStorage, per store. (The checkout autosave's id in ./visitorId is a
 *    different thing — one per tab, on purpose.)
 *  - The order placed on a checkout step. Once it exists it must never be
 *    placed again: if the advance after it fails (network, reload), the step
 *    only retries the advance with the same order id.
 *  - Accepted upsell/downsell orders. The backend returns them once, on the
 *    advance that created them, and has no public endpoint to list them, so
 *    the thank-you step reads them from here.
 *
 * Storage failures are swallowed: the funnel still works, it just forgets.
 */

const visitorKey = (workspaceId: string) => `zimos_funnel_visitor_${workspaceId}`;
const placedKey = (sessionId: string) => `zimos_funnel_placed_${sessionId}`;
const followOnKey = (sessionId: string) => `zimos_funnel_orders_${sessionId}`;

// Same-tab writes don't fire `storage`, so subscribers are told directly.
const CHANGE = "zimos-funnel-storage";

/** The API wants 8–64 characters. */
const isValidVisitorId = (id: string | null): id is string => !!id && id.length >= 8 && id.length <= 64;

const memoryVisitorIds = new Map<string, string>();

function freshId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    const rand = () => Math.random().toString(36).slice(2, 10).padEnd(8, "0");
    return `f${Date.now().toString(36)}${rand()}${rand()}`;
  }
}

function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
    window.dispatchEvent(new Event(CHANGE));
  } catch {
    /* storage disabled */
  }
}

function remove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* storage disabled */
  }
}

/**
 * Stable per browser and store; in memory when storage is unavailable.
 *
 * Keyed by the workspace's UUID, so `<slug>.zimos.co` and `/store/<uuid>`
 * share one visitor, and the backend resumes the same session on either.
 * Ids saved earlier under the address the store was reached by (its slug, or
 * the route segment) are moved over once, so a returning visitor keeps their
 * session.
 */
export function funnelVisitorId(workspaceUuid: string, legacyRefs: string[] = []): string {
  const key = visitorKey(workspaceUuid);
  const saved = read(key);
  if (isValidVisitorId(saved)) return saved;

  for (const ref of legacyRefs) {
    if (!ref || ref === workspaceUuid) continue;
    const legacyKey = visitorKey(ref);
    const legacy = read(legacyKey);
    if (!isValidVisitorId(legacy)) continue;
    write(key, legacy);
    // Only drop the old key once the new one holds the id.
    if (read(key) === legacy) remove(legacyKey);
    memoryVisitorIds.set(key, legacy);
    return legacy;
  }

  const id = memoryVisitorIds.get(key) ?? freshId();
  memoryVisitorIds.set(key, id);
  write(key, id);
  return id;
}

export interface PlacedOrder {
  id: string;
  orderNumber: string;
  /** The checkout step it was placed on. */
  stepKey: string;
}

export function rememberPlacedOrder(sessionId: string, order: PlacedOrder) {
  write(placedKey(sessionId), JSON.stringify(order));
}

export function rememberFollowOn(sessionId: string, order: FunnelRuntimeFollowOnOrder) {
  const list = parseList(read(followOnKey(sessionId))).filter((o) => o.id !== order.id);
  write(followOnKey(sessionId), JSON.stringify([...list, order]));
}

function parsePlaced(raw: string | null): PlacedOrder | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as PlacedOrder;
    return v && typeof v.id === "string" && typeof v.stepKey === "string" ? v : null;
  } catch {
    return null;
  }
}

function parseList(raw: string | null): FunnelRuntimeFollowOnOrder[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as FunnelRuntimeFollowOnOrder[];
    return Array.isArray(v) ? v.filter((o) => o && typeof o.id === "string") : [];
  } catch {
    return [];
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

/** A stored string, read after hydration (null on the server and first paint). */
function useStored(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null
  );
}

export function usePlacedOrder(sessionId: string): PlacedOrder | null {
  const raw = useStored(placedKey(sessionId));
  return useMemo(() => parsePlaced(raw), [raw]);
}

export function useFollowOnOrders(sessionId: string): FunnelRuntimeFollowOnOrder[] {
  const raw = useStored(followOnKey(sessionId));
  return useMemo(() => parseList(raw), [raw]);
}
