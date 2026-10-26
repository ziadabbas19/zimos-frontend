import { useEffect, useRef, useSyncExternalStore } from "react";
import { connectRealtime, type RealtimeMessage, type RealtimeStatus } from "@store-builder/api-client/realtime";
import { apiBaseUrl, apiClient } from "@/lib/apiClient";
import { REALTIME_ENABLED } from "@/lib/features";

/**
 * The live updates (VITE_REALTIME_ENABLED, the API's REALTIME_ENABLED): one
 * connection for the whole dashboard, opened by <LiveUpdates /> in the shell
 * (useLiveConnection). Off, nothing here runs: no connection, the status
 * stays "off", and every screen keeps its own polling as before.
 *
 * Messages carry ids only, for every store the account belongs to; a screen
 * takes those of its own store and reads what it shows through the API, as
 * it already does (useLiveEvents). While the connection is down, the same
 * screens are asked to read again every FALLBACK_MS instead, and once more
 * when it comes back: what was sent meanwhile is not sent again.
 */

export type LiveStatus = RealtimeStatus | "off";
export type { RealtimeMessage };

export const ORDER_EVENTS = ["order.created", "order.paid", "order.status_changed"];
export const FALLBACK_MS = 30_000;
/** A burst of events (a bulk action, several orders at once) is one refresh. */
const SETTLE_MS = 800;

let status: LiveStatus = "off";
const statusListeners = new Set<() => void>();
const messageListeners = new Set<(message: RealtimeMessage) => void>();
const fallbackListeners = new Set<() => void>();

function setStatus(next: LiveStatus) {
  if (next === status) return;
  status = next;
  statusListeners.forEach((fn) => fn());
}

function subscribeStatus(fn: () => void) {
  statusListeners.add(fn);
  return () => {
    statusListeners.delete(fn);
  };
}

/** "live" while connected, "waiting" while not (polling then), "off" with the switch off. */
export function liveStatus(): LiveStatus {
  return status;
}

export function useLiveStatus(): LiveStatus {
  return useSyncExternalStore(subscribeStatus, liveStatus, () => "off" as LiveStatus);
}

export function subscribeLiveMessages(fn: (message: RealtimeMessage) => void) {
  messageListeners.add(fn);
  return () => {
    messageListeners.delete(fn);
  };
}

/** Opens the one connection while mounted, and ticks the fallback while it is down. */
export function useLiveConnection(): void {
  useEffect(() => {
    if (!REALTIME_ENABLED) return;
    const connection = connectRealtime({
      client: apiClient,
      baseUrl: apiBaseUrl,
      refreshProbe: () => apiClient.request("/auth/me"),
      onMessage: (message) => messageListeners.forEach((fn) => fn(message)),
      onStatus: setStatus,
      onReconnect: () => fallbackListeners.forEach((fn) => fn()),
    });
    setStatus(connection.status());
    const timer = window.setInterval(() => {
      if (status !== "live" && document.visibilityState === "visible") fallbackListeners.forEach((fn) => fn());
    }, FALLBACK_MS);
    return () => {
      window.clearInterval(timer);
      connection.close();
      setStatus("off");
    };
  }, []);
}

/**
 * Calls `refresh` once after a burst of `types` events of `workspaceId`; with
 * `fallback`, also every FALLBACK_MS while the connection is down. Does
 * nothing with the switch off.
 */
export function useLiveEvents(
  workspaceId: string | null | undefined,
  types: readonly string[],
  refresh: () => void,
  { fallback = true }: { fallback?: boolean } = {}
): void {
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  });
  const key = types.join(",");
  useEffect(() => {
    if (!REALTIME_ENABLED || !workspaceId) return;
    const wanted = new Set(key.split(","));
    let timer: number | undefined;
    const offMessages = subscribeLiveMessages((message) => {
      if (message.workspaceId !== workspaceId || !wanted.has(message.type)) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => latest.current(), SETTLE_MS);
    });
    const tick = () => latest.current();
    if (fallback) fallbackListeners.add(tick);
    return () => {
      offMessages();
      fallbackListeners.delete(tick);
      window.clearTimeout(timer);
    };
  }, [workspaceId, key, fallback]);
}
