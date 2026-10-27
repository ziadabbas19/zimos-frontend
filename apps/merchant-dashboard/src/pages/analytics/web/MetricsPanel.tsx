import { useState, type ReactNode } from "react";
import type { WebAnalyticsFilterKey, WebAnalyticsMetricRow, WebAnalyticsMetricType, WebAnalyticsRangeParams } from "@store-builder/api-client";
import { Card, cn, ZLoader } from "@store-builder/ui";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { formatCount } from "@/lib/analytics";
import { Modal } from "@/components/Modal";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { more: "More", empty: "No data for this period", loadFailed: "Couldn't load", of: "{n} of visitors" },
  ar: { more: "المزيد", empty: "لا توجد بيانات في هذه الفترة", loadFailed: "تعذّر التحميل", of: "{n} من الزوار" },
} satisfies Messages;

export interface MetricTab {
  type: WebAnalyticsMetricType;
  label: string;
  /** The filter the row's value applies when clicked; omit for non-filterable types. */
  filterKey?: WebAnalyticsFilterKey;
  /** Turns the raw value into what is shown. */
  render?: (x: string) => ReactNode;
}

function Rows({
  rows,
  loading,
  error,
  total,
  render,
  onPick,
  limit,
  emptyLabel,
  failedLabel,
}: {
  rows: WebAnalyticsMetricRow[];
  loading: boolean;
  error: unknown;
  total: number;
  render?: (x: string) => ReactNode;
  onPick?: (x: string) => void;
  limit?: number;
  emptyLabel: string;
  failedLabel: string;
}) {
  if (loading && rows.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-ink-soft">
        <ZLoader />
      </div>
    );
  }
  if (error) return <p className="py-6 text-center text-sm text-ink-soft">{failedLabel}</p>;
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-ink-soft">{emptyLabel}</p>;
  const max = Math.max(1, ...rows.map((r) => r.y));
  const shown = limit ? rows.slice(0, limit) : rows;
  return (
    <ul className="space-y-0.5">
      {shown.map((row) => {
        const share = total > 0 ? row.y / total : 0;
        const body = (
          <>
            <div className="absolute inset-y-0.5 start-0 rounded bg-primary/10" style={{ width: `${Math.round((row.y / max) * 100)}%` }} aria-hidden />
            <span className="relative min-w-0 flex-1 truncate text-sm text-ink" dir="auto">
              {render ? render(row.x) : row.x || "—"}
            </span>
            <span className="tabular-nums relative shrink-0 text-sm font-medium text-ink">
              <bdi dir="ltr">{formatCount(row.y)}</bdi>
            </span>
            <span className="tabular-nums relative w-12 shrink-0 text-end text-xs text-ink-soft">
              <bdi dir="ltr">{Math.round(share * 100)}%</bdi>
            </span>
          </>
        );
        return (
          <li key={row.x}>
            {onPick ? (
              <button type="button" onClick={() => onPick(row.x)} className="relative flex w-full cursor-pointer items-center gap-3 rounded px-2 py-1.5 text-start hover:bg-paper">
                {body}
              </button>
            ) : (
              <div className="relative flex items-center gap-3 rounded px-2 py-1.5">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * One of Umami's overview panels: tabs over related metrics, the top rows
 * with share bars, and a "More" link opening the full list. Clicking a row
 * narrows the whole page to that value.
 */
export function MetricsPanel({
  workspaceId,
  params,
  tabs,
  total,
  onFilter,
  className,
}: {
  workspaceId: string;
  params: WebAnalyticsRangeParams;
  tabs: MetricTab[];
  /** Visitors in the period — the denominator for each row's share. */
  total: number;
  onFilter: (key: WebAnalyticsFilterKey, value: string) => void;
  className?: string;
}) {
  const t = useT(STRINGS);
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const tab = tabs[active];
  const key = JSON.stringify(params);
  const top = useAsync(() => apiClient.getWebAnalyticsMetrics(workspaceId, tab.type, { ...params, limit: 10 }), [workspaceId, key, tab.type]);
  const full = useAsync(
    () => (expanded ? apiClient.getWebAnalyticsMetrics(workspaceId, tab.type, { ...params, limit: 500 }) : Promise.resolve(null)),
    [workspaceId, key, tab.type, expanded]
  );
  const pick = tab.filterKey ? (x: string) => onFilter(tab.filterKey!, x) : undefined;

  return (
    <Card className={cn("min-h-[22rem] gap-0 p-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {tabs.map((item, i) => (
            <button
              key={item.type}
              type="button"
              onClick={() => setActive(i)}
              aria-pressed={i === active}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 text-sm font-medium transition-colors",
                i === active ? "bg-paper text-ink" : "text-ink-soft hover:text-ink"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        {(top.data?.rows.length ?? 0) >= 10 && (
          <button type="button" onClick={() => setExpanded(true)} className="cursor-pointer text-sm font-medium text-primary hover:underline">
            {t.more}
          </button>
        )}
      </div>
      <Rows rows={top.data?.rows ?? []} loading={top.loading} error={top.error} total={total} render={tab.render} onPick={pick} limit={10} emptyLabel={t.empty} failedLabel={t.loadFailed} />

      <Modal open={expanded} onClose={() => setExpanded(false)} title={tab.label}>
        <div className="max-h-[70vh] overflow-y-auto">
          <Rows rows={full.data?.rows ?? []} loading={full.loading} error={full.error} total={total} render={tab.render} onPick={pick ? (x) => { setExpanded(false); pick(x); } : undefined} emptyLabel={t.empty} failedLabel={t.loadFailed} />
        </div>
      </Modal>
    </Card>
  );
}
