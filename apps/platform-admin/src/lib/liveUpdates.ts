import { useEffect, useRef, useState } from "react";
import { connectRealtime, type RealtimeMessage, type RealtimeStatus } from "@store-builder/api-client/realtime";
import { API_BASE_URL, apiClient } from "@/lib/apiClient";
import { CONSOLE_REALTIME_ENABLED } from "@/lib/features";

/**
 * The console's side of the API's live updates (VITE_CONSOLE_REALTIME_ENABLED):
 * a sign-up, a paid subscription, a new support ticket. The API sends each to
 * the accounts whose console permissions open its page; messages carry ids
 * only, and the bell reads its count through the API as before.
 */

export type ConsoleLiveStatus = RealtimeStatus | "off";

// referral.used: a store entered a referral code (migration 725).
export const CONSOLE_EVENTS = ["merchant.created", "subscription.paid", "ticket.created", "referral.used"];

/**
 * Opens the connection while mounted and calls `onEvent` for each console
 * event. "off" with the switch off (nothing is opened), else "live" or
 * "waiting" (not connected: the caller polls).
 */
export function useConsoleLive(onEvent: (message: RealtimeMessage) => void): ConsoleLiveStatus {
  const [status, setStatus] = useState<ConsoleLiveStatus>(CONSOLE_REALTIME_ENABLED ? "waiting" : "off");
  const latest = useRef(onEvent);
  useEffect(() => {
    latest.current = onEvent;
  });
  useEffect(() => {
    if (!CONSOLE_REALTIME_ENABLED) return;
    const connection = connectRealtime({
      client: apiClient,
      baseUrl: API_BASE_URL,
      refreshProbe: () => apiClient.request("/auth/me"),
      onMessage: (message) => {
        if (CONSOLE_EVENTS.includes(message.type)) latest.current(message);
      },
      onStatus: setStatus,
    });
    setStatus(connection.status());
    return () => {
      connection.close();
      setStatus("off");
    };
  }, []);
  return status;
}
