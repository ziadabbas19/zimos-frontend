import { useMemo, useState } from "react";
import { splitTestsList, type FunnelAnalyticsStep, type SplitTest } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";

/**
 * The numbers the flow map shows, loaded by the map itself (keyed by the
 * funnel's id): each step's visits for a period, and the split tests running
 * on its steps. Both fail quietly — a role without `analytics.view` simply
 * sees a map without numbers, as before.
 */

export type StatsPeriod = "7" | "30" | "90";

/**
 * A step of GET /analytics/funnels/:id as the backend really sends it. The
 * fields after `reachRate` are missing from the api-client's type
 * (analytics/funnelStepMetrics.js spreads them in); they are declared here
 * and read defensively.
 */
interface StepRow extends FunnelAnalyticsStep {
  visits?: number | null;
  views?: number | null;
  movedOn?: number | null;
  ctr?: number | null;
  conversions?: number | null;
  cr?: number | null;
  optIns?: number | null;
}

/** One step's numbers for the chosen period. They describe the PUBLISHED funnel. */
export interface StepNumbers {
  /** Sessions that got to this step. */
  visits: number;
  /** Sessions still sitting on this step that never moved on. */
  dropped: number;
  /** visits ÷ the funnel's sessions, 0–1; null when there were no sessions. */
  reach: number | null;
  /** dropped ÷ visits, 0–1; null without visits. */
  dropRate: number | null;
  /** Orders placed on this step — checkout and sales pages only; null elsewhere. */
  orders: number | null;
  /** Sign-ups stored on an opt-in step; null elsewhere. */
  signups: number | null;
  /** Kept for the old stats line: visitors who did not stop here, and their share in percent. */
  clicks: number;
  ctr: number | null;
}

const count = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);

/** Step types whose `conversions` is a real count of orders (an offer step's is always 0 today). */
const ORDER_STEPS = new Set(["checkout", "sales"]);

export function toStepNumbers(row: StepRow): StepNumbers {
  const visits = count(row.reached) ?? 0;
  const dropped = Math.min(visits, count(row.dropped) ?? 0);
  const clicks = Math.max(0, visits - dropped);
  const conversions = count(row.conversions);
  return {
    visits,
    dropped,
    // The API sends a percentage with one decimal.
    reach: typeof row.reachRate === "number" ? Math.min(1, Math.max(0, row.reachRate / 100)) : null,
    dropRate: visits > 0 ? dropped / visits : null,
    orders: ORDER_STEPS.has(row.stepType) ? conversions : null,
    signups: row.stepType === "opt_in" ? (count(row.optIns) ?? conversions) : null,
    clicks,
    ctr: visits > 0 ? Math.round((clicks / visits) * 100) : null,
  };
}

/** Each step's numbers for 7, 30 or 90 days, by step key. Empty while loading, on an error and on a 403. */
export function useFunnelNumbers(funnelId: string | null) {
  const workspaceId = useWorkspaceId();
  const [period, setPeriod] = useState<StatsPeriod>("30");
  const detail = useAsync(
    () =>
      funnelId
        ? apiClient
            .getFunnelAnalyticsDetail(workspaceId, funnelId, { from: new Date(Date.now() - Number(period) * 864e5).toISOString() })
            .catch(() => null)
        : Promise.resolve(null),
    [workspaceId, funnelId, period]
  );
  const byKey = useMemo(() => {
    const out = new Map<string, StepNumbers>();
    for (const row of (detail.data?.steps ?? []) as StepRow[]) out.set(row.key, toStepNumbers(row));
    return out;
  }, [detail.data]);
  // False on an error or a 403: the map then shows no numbers and no period to pick.
  return { byKey, period, setPeriod, available: detail.data !== null && detail.data !== undefined };
}

/** The split test on each step (the newest one that is not finished wins the slot), by step key. */
export function useStepSplitTests(funnelId: string | null): Map<string, SplitTest> {
  const workspaceId = useWorkspaceId();
  const list = useAsync(
    () => (funnelId ? splitTestsList(apiClient, workspaceId, funnelId).catch(() => [] as SplitTest[]) : Promise.resolve([] as SplitTest[])),
    [workspaceId, funnelId]
  );
  return useMemo(() => {
    const rank: Record<SplitTest["status"], number> = { running: 2, paused: 1, completed: 0 };
    const out = new Map<string, SplitTest>();
    for (const test of Array.isArray(list.data) ? list.data : []) {
      const held = out.get(test.stepKey);
      if (!held || rank[test.status] > rank[held.status]) out.set(test.stepKey, test);
    }
    return out;
  }, [list.data]);
}
