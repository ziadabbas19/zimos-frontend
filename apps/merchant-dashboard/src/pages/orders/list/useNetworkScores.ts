import { useEffect, useMemo, useState } from "react";
import { protectionNetworkScores, type NetworkScore, type Order } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";

/**
 * The delivery rate of every customer on the page of orders, by customer id —
 * one call for the whole page (the same call, with the same payload, that
 * pages/fraud/NetworkRate.tsx's provider makes). Held here rather than in that
 * provider's context so a row knows whether it has a rate to show: the phone
 * card counts it among its chips. While the feature is off for the store, or
 * the call fails, there are simply no rates.
 */
export function useNetworkScores(orders: readonly Order[]): Record<string, NetworkScore> {
  const workspaceId = useWorkspaceId();
  const [scores, setScores] = useState<Record<string, NetworkScore>>({});
  const ids = useMemo(() => [...new Set(orders.map((o) => o.customerId).filter(Boolean))].sort(), [orders]);
  const key = ids.join(",");

  useEffect(() => {
    if (ids.length === 0) return;
    let cancelled = false;
    protectionNetworkScores(apiClient, workspaceId, ids.slice(0, 200))
      .then((result) => {
        if (!cancelled && result.enabled) setScores((prev) => ({ ...prev, ...result.scores }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, key]);

  return scores;
}
