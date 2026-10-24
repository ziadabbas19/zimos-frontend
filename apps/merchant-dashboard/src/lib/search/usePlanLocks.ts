import { useCallback, useEffect, useRef, useState } from "react";
import { planFeatureGated, planFeatureHeld, workspacePlanFeatures, type WorkspacePlanFeatures } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import type { SearchEntry } from "./siteIndex";

/**
 * Whether the store's plan holds an entry back (its `plan` rule). The plan is
 * asked of the server (GET /workspaces/:id/plan-features) only once a search
 * is in use (`active`), once per store while the search is mounted. Until the
 * answer is in — and if it never comes — nothing is locked, as with
 * lib/usePlanFeatures: the page itself still says what the plan does not hold.
 */
export function usePlanLocks(workspaceId: string | undefined, active: boolean): (entry: SearchEntry) => boolean {
  const [answer, setAnswer] = useState<{ workspaceId: string; plan: WorkspacePlanFeatures } | null>(null);
  const asked = useRef<string | null>(null);

  useEffect(() => {
    if (!active || !workspaceId || asked.current === workspaceId) return;
    asked.current = workspaceId;
    workspacePlanFeatures(apiClient, workspaceId).then(
      (plan) => setAnswer({ workspaceId, plan }),
      () => {
        // Asked again the next time the search is used.
        if (asked.current === workspaceId) asked.current = null;
      }
    );
  }, [active, workspaceId]);

  const plan = answer && answer.workspaceId === workspaceId ? answer.plan : null;
  return useCallback(
    (entry: SearchEntry) => {
      const rule = entry.plan;
      if (!plan || !rule) return false;
      return rule.benefit ? !planFeatureHeld(plan, rule.feature) : planFeatureGated(plan, rule.feature);
    },
    [plan]
  );
}
