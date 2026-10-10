import { useState } from "react";
import { splitTestsGet, type SplitTest, type SplitTestResults } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { IconExperiment, IconTrophy } from "@/components/icons";
import { TriggerPopover as Popover } from "@/components/TriggerPopover";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatPercentValue } from "@/lib/format";
import { fmt, useT } from "@/i18n/LocaleContext";
import { MAP_STRINGS, num, pct } from "./strings";

const CHIP_TONE: Record<SplitTest["status"], string> = {
  running: "bg-accent-soft text-accent-dark ring-accent/40",
  paused: "bg-paper-raised text-ink-soft ring-line-strong",
  completed: "bg-success-soft text-success ring-success/40",
};

/**
 * The «اختبار A/B» chip on a step that has a split test. Pressing it opens a
 * small pane with the versions and their share of the visitors; the visits,
 * orders and the leader are fetched when the pane opens (the list of tests
 * carries no numbers), and when they cannot be read the pane says where they
 * are instead of guessing.
 */
export function SplitTestChip({ test, stepName }: { test: SplitTest; stepName: string }) {
  const t = useT(MAP_STRINGS);
  const workspaceId = useWorkspaceId();
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SplitTestResults | "loading" | "failed" | null>(null);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next || (results !== null && results !== "failed")) return;
    setResults("loading");
    splitTestsGet(apiClient, workspaceId, test.id)
      .then((detail) => setResults(detail?.results && Array.isArray(detail.results.variants) ? detail.results : "failed"))
      .catch(() => setResults("failed"));
  }

  const numbers = results !== null && typeof results === "object" ? results : null;
  const label = test.status === "running" ? t.abRunning : test.status === "paused" ? t.abPaused : t.abDone;
  const leaderKey = test.status === "completed" ? test.winnerVariantKey : (numbers?.leaderKey ?? null);

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      label={fmt(t.abOpen, { name: stepName })}
      side="bottom"
      align="end"
      className="w-72"
      trigger={
        <button
          type="button"
          data-flow-item=""
          data-status={test.status}
          aria-label={fmt(t.abOpen, { name: stepName })}
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          className={cn(
            "zimos-flow-ab pointer-events-auto relative inline-flex h-[22px] cursor-pointer items-center gap-1 rounded-full px-2 text-[11px] font-semibold ring-1 before:absolute before:-inset-x-2 before:-inset-y-[11px] before:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            CHIP_TONE[test.status]
          )}
        >
          <IconExperiment className="size-3 shrink-0" aria-hidden />
          {label}
        </button>
      }
    >
      <div className="space-y-2.5">
        <div>
          <p className="text-sm font-semibold text-ink">
            <bdi>{test.name}</bdi>
          </p>
          {test.status !== "running" && <p className="mt-0.5 text-xs text-ink-soft">{test.status === "paused" ? t.abPausedNote : t.abDoneNote}</p>}
        </div>
        <ul className="space-y-1.5">
          {test.variants.map((variant) => {
            const row = numbers?.variants.find((v) => v.key === variant.key);
            const leads = leaderKey !== null && leaderKey === variant.key;
            return (
              <li key={variant.key} data-leader={leads ? "" : undefined} className={cn("rounded-xl p-2 ring-1", leads ? "bg-success-soft/60 ring-success/40" : "bg-paper ring-line")}>
                <div className="flex items-center gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-paper-raised text-xs font-semibold text-ink ring-1 ring-line">
                    <bdi>{variant.key}</bdi>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      <bdi>{variant.name || (variant.key === "A" ? t.abOriginal : variant.key)}</bdi>
                    </span>
                    <span className="block text-xs text-ink-soft">{fmt(t.abShare, { pct: pct(variant.weight / 100) })}</span>
                  </span>
                  {leads && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">
                      <IconTrophy className="size-3" aria-hidden />
                      {test.status === "completed" ? t.abWinner : t.abLeader}
                    </span>
                  )}
                </div>
                {row && (
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    {[
                      { id: "visits", label: t.abVisits, value: num(row.visits) },
                      { id: "orders", label: t.abOrders, value: num(row.orders) },
                      { id: "rate", label: t.abRate, value: formatPercentValue(row.conversionRateBp / 10000, 1) },
                    ].map((cell) => (
                      <div key={cell.id}>
                        <p className="text-sm font-semibold tabular-nums text-ink">
                          <bdi>{cell.value}</bdi>
                        </p>
                        <p className="text-[11px] text-ink-soft">{cell.label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="text-xs leading-5 text-ink-soft" aria-live="polite">
          {results === "loading" ? t.abLoading : results === "failed" ? t.abNoNumbers : t.abManage}
        </p>
      </div>
    </Popover>
  );
}
