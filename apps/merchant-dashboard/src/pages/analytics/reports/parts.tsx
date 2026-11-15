import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarDays, Download } from "lucide-react";
import { Button, cn } from "@store-builder/ui";
import type { ReportsCompare, ReportsExportName, ReportsFunnelStep } from "@store-builder/api-client";
import { reportsExportCsv } from "@store-builder/api-client";
import { Select } from "@/components/Select";
import { Sparkline } from "@/components/charts";
import { apiClient } from "@/lib/apiClient";
import { formatCount } from "@/lib/analytics";
import { formatPercentValue } from "@/lib/format";
import { REPORT_COMPARES, REPORT_PRESETS, type ReportPreset, type ReportRange } from "@/lib/reportRange";
import { useT, type Messages } from "@/i18n/LocaleContext";

/** The API's rates are percentages (12.5); "—" when there is no denominator. */
export function formatRate(percent: number | null | undefined): string {
  return percent === null || percent === undefined ? "—" : formatPercentValue(percent / 100);
}

// ------------------------------------------------------------ date range --

const RANGE_STRINGS = {
  en: {
    label: "Date range",
    today: "Today",
    yesterday: "Yesterday",
    "7d": "Last 7 days",
    "30d": "Last 30 days",
    "90d": "Last 90 days",
    month: "This month",
    lastMonth: "Last month",
    "12m": "Last 12 months",
    custom: "Custom dates",
    from: "From",
    to: "To",
    compareLabel: "Compare with",
    previous: "Previous period",
    year: "Same days last year",
    none: "No comparison",
  },
  ar: {
    label: "الفترة",
    today: "اليوم",
    yesterday: "أمس",
    "7d": "آخر 7 أيام",
    "30d": "آخر 30 يومًا",
    "90d": "آخر 90 يومًا",
    month: "هذا الشهر",
    lastMonth: "الشهر الماضي",
    "12m": "آخر 12 شهرًا",
    custom: "تواريخ محددة",
    from: "من",
    to: "إلى",
    compareLabel: "المقارنة مع",
    previous: "الفترة السابقة",
    year: "نفس الأيام العام الماضي",
    none: "بدون مقارنة",
  },
} satisfies Messages;

const DATE_INPUT =
  "h-9 rounded-[0.5rem] border border-line-strong bg-paper-raised px-2.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-primary";

/** Presets, two date inputs when "custom" is picked, and what to compare with. */
export function DateRangeControl({
  range,
  onPreset,
  onDays,
  onCompare,
  showCompare = true,
}: {
  range: ReportRange;
  onPreset: (preset: ReportPreset) => void;
  onDays: (fromDay: string, toDay: string) => void;
  onCompare: (compare: ReportsCompare) => void;
  showCompare?: boolean;
}) {
  const t = useT(RANGE_STRINGS);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <CalendarDays
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft"
          aria-hidden
        />
        <Select
          aria-label={t.label}
          value={range.preset}
          onChange={(e) => onPreset(e.target.value as ReportPreset)}
          className="h-9 w-auto ps-9 font-medium"
        >
          {REPORT_PRESETS.map((preset) => (
            <option key={preset} value={preset}>
              {t[preset]}
            </option>
          ))}
        </Select>
      </div>
      {range.preset === "custom" && (
        <>
          <input
            type="date"
            aria-label={t.from}
            value={range.fromDay}
            max={range.toDay}
            onChange={(e) => e.target.value && onDays(e.target.value, range.toDay)}
            className={DATE_INPUT}
          />
          <span className="text-sm text-ink-soft" aria-hidden>
            –
          </span>
          <input
            type="date"
            aria-label={t.to}
            value={range.toDay}
            min={range.fromDay}
            onChange={(e) => e.target.value && onDays(range.fromDay, e.target.value)}
            className={DATE_INPUT}
          />
        </>
      )}
      {showCompare && (
        <Select
          aria-label={t.compareLabel}
          value={range.compare}
          onChange={(e) => onCompare(e.target.value as ReportsCompare)}
          className="h-9 w-auto font-medium"
        >
          {REPORT_COMPARES.map((compare) => (
            <option key={compare} value={compare}>
              {t[compare]}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ export --

const EXPORT_STRINGS = {
  en: { export: "Export CSV", failed: "The file could not be prepared. Try again." },
  ar: { export: "تصدير CSV", failed: "تعذّر تجهيز الملف. حاول مرة أخرى." },
} satisfies Messages;

export function ExportButton({
  workspaceId,
  report,
  range,
  onError,
}: {
  workspaceId: string;
  report: ReportsExportName;
  range: ReportRange;
  onError: (message: string) => void;
}) {
  const t = useT(EXPORT_STRINGS);
  async function download() {
    try {
      const blob = await reportsExportCsv(apiClient, workspaceId, report, { from: range.from, to: range.to });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `zimos-${report}-${range.fromDay}-${range.toDay}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      onError(t.failed);
    }
  }
  return (
    <Button variant="outline" size="sm" onClick={download}>
      <Download className="size-4" aria-hidden />
      {t.export}
    </Button>
  );
}

// --------------------------------------------------------------------- KPI --

/** Change against the comparison window, as a signed percentage; null without a baseline. */
export function changePercent(value: number | null | undefined, previous: number | null | undefined): number | null {
  if (value === null || value === undefined || previous === null || previous === undefined || previous === 0) return null;
  return ((value - previous) / Math.abs(previous)) * 100;
}

export function Delta({ percent, inverted, className }: { percent: number | null; inverted?: boolean; className?: string }) {
  if (percent === null) return <span className={cn("text-xs text-ink-soft", className)}>—</span>;
  const up = percent > 0.05;
  const down = percent < -0.05;
  // A rising return rate is bad news: `inverted` flips the colour, not the arrow.
  const good = inverted ? down : up;
  const bad = inverted ? up : down;
  const Icon = down ? ArrowDownRight : ArrowUpRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
        good && "text-success",
        bad && "text-danger",
        !good && !bad && "text-ink-soft",
        className
      )}
    >
      {(up || down) && <Icon className="size-3" aria-hidden />}
      <bdi dir="ltr">{formatPercentValue(Math.abs(percent) / 100)}</bdi>
    </span>
  );
}

export interface KpiCell {
  key: string;
  label: string;
  value: ReactNode;
  /** Signed change against the comparison window, in percent. */
  change?: number | null;
  /** Down is good (return rate, refunds). */
  inverted?: boolean;
  hint?: string;
  spark?: number[];
  sparkPrevious?: number[] | null;
}

/**
 * The headline numbers as one joined panel with hairline dividers — each cell
 * a small label, the value, its trend and its change. A cell can be picked
 * (`onSelect`) to put its metric on the chart below.
 */
export function KpiGrid({
  cells,
  selected,
  onSelect,
  columns = 3,
}: {
  cells: KpiCell[];
  selected?: string;
  onSelect?: (key: string) => void;
  columns?: 3 | 4;
}) {
  return (
    <div
      className={cn(
        "grid gap-px overflow-hidden rounded-xl border border-line bg-line shadow-[var(--shadow-card)] sm:grid-cols-2",
        columns === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"
      )}
    >
      {cells.map((cell) => {
        const active = selected === cell.key;
        const body = (
          <>
            <p className="text-[11px] font-medium tracking-[0.06em] text-ink-soft uppercase rtl:text-xs rtl:tracking-normal">
              {cell.label}
            </p>
            <div className="mt-1.5 flex items-end justify-between gap-3">
              <p className="text-xl font-semibold tracking-tight text-ink tabular-nums">{cell.value}</p>
              {cell.spark && cell.spark.length > 1 && (
                <Sparkline current={cell.spark} previous={cell.sparkPrevious} height={24} className="w-16 shrink-0" />
              )}
            </div>
            <div className="mt-1 flex min-h-4 items-center gap-1.5">
              {cell.change !== undefined && <Delta percent={cell.change} inverted={cell.inverted} />}
              {cell.hint && <span className="truncate text-xs text-ink-soft">{cell.hint}</span>}
            </div>
          </>
        );
        return onSelect ? (
          <button
            key={cell.key}
            type="button"
            onClick={() => onSelect(cell.key)}
            aria-pressed={active}
            className={cn(
              "relative cursor-pointer bg-paper-raised p-4 text-start transition-colors hover:bg-primary-soft/40",
              active && "bg-primary-soft/50"
            )}
          >
            {active && <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-primary" />}
            {body}
          </button>
        ) : (
          <div key={cell.key} className="bg-paper-raised p-4">
            {body}
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ funnel --

/** The conversion funnel: one bar per step, and what share of the step before it kept. */
export function FunnelChart({ steps, labels, keptLabel }: { steps: ReportsFunnelStep[]; labels: Record<string, string>; keptLabel: string }) {
  const top = Math.max(1, steps[0]?.sessions ?? 0);
  return (
    <ol className="space-y-3">
      {steps.map((step, index) => (
        <li key={step.step}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium text-ink">{labels[step.step] ?? step.step}</span>
            <span className="flex items-baseline gap-2 tabular-nums">
              <span className="font-semibold text-ink">{formatCount(step.sessions)}</span>
              <span className="w-14 text-end text-xs text-ink-soft">{formatRate(step.rateOfSessions)}</span>
            </span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-primary-soft">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.max((step.sessions / top) * 100, step.sessions > 0 ? 1.5 : 0)}%`, opacity: 1 - index * 0.13 }}
            />
          </div>
          {index > 0 && (
            <p className="mt-1 text-xs text-ink-soft">
              {keptLabel} <bdi dir="ltr">{formatRate(step.rateOfPrevious)}</bdi>
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

// ----------------------------------------------------------------- heatmap --

/** Orders by weekday and hour: darker = busier. */
export function OrdersHeatmap({
  cells,
  dayLabels,
  summary,
}: {
  cells: Array<{ dow: number; hour: number; orders: number }>;
  dayLabels: string[];
  summary: string;
}) {
  const max = Math.max(1, ...cells.map((c) => c.orders));
  const at = new Map(cells.map((c) => [`${c.dow}:${c.hour}`, c.orders]));
  const hours = Array.from({ length: 24 }, (_, h) => h);
  // The week starts on Saturday here.
  const days = [6, 0, 1, 2, 3, 4, 5];
  return (
    <div className="overflow-x-auto" role="img" aria-label={summary}>
      <div className="min-w-[34rem]">
        {days.map((dow) => (
          <div key={dow} className="flex items-center gap-1">
            <span className="w-14 shrink-0 truncate text-xs text-ink-soft">{dayLabels[dow]}</span>
            <div className="grid flex-1 gap-[3px] py-[1.5px]" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
              {hours.map((hour) => {
                const orders = at.get(`${dow}:${hour}`) ?? 0;
                return (
                  <div
                    key={hour}
                    title={`${dayLabels[dow]} ${hour}:00 — ${orders}`}
                    className="h-5 rounded-[3px] bg-primary"
                    style={{ opacity: orders === 0 ? 0.07 : 0.18 + (orders / max) * 0.82 }}
                  />
                );
              })}
            </div>
          </div>
        ))}
        <div className="mt-1 flex items-center gap-1" dir="ltr">
          <span className="w-14 shrink-0" />
          <div className="grid flex-1 text-[10px] text-ink-soft" style={{ gridTemplateColumns: "repeat(8, minmax(0, 1fr))" }}>
            {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
              <span key={h}>{h}:00</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- rate bar --

/** A rate with a thin track behind it; the tone follows how healthy the rate is. */
export function RateBar({ percent, good = 70, bad = 50, inverted }: { percent: number | null; good?: number; bad?: number; inverted?: boolean }) {
  if (percent === null) return <span className="text-ink-soft">—</span>;
  const healthy = inverted ? percent <= good : percent >= good;
  const poor = inverted ? percent >= bad : percent < bad;
  return (
    <span className="inline-flex w-28 items-center gap-2">
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
        <span
          className={cn("block h-full rounded-full", healthy ? "bg-success" : poor ? "bg-danger" : "bg-accent")}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </span>
      <span className="w-11 text-end text-xs font-medium tabular-nums text-ink">
        <bdi dir="ltr">{formatRate(percent)}</bdi>
      </span>
    </span>
  );
}

/** Two or more parts of one total as a single stacked bar with a legend. */
export function SplitBar({ parts }: { parts: Array<{ label: string; value: number; display: string; className: string }> }) {
  const total = parts.reduce((sum, p) => sum + p.value, 0);
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-line">
        {total > 0 &&
          parts.map((p) => (
            <div key={p.label} className={p.className} style={{ width: `${(p.value / total) * 100}%` }} />
          ))}
      </div>
      <ul className="mt-3 space-y-1.5">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-ink-soft">
              <span aria-hidden className={cn("size-2.5 shrink-0 rounded-sm", p.className)} />
              <span className="truncate">{p.label}</span>
            </span>
            <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
              <span className="font-medium text-ink">{p.display}</span>
              <span className="w-12 text-end text-xs text-ink-soft">
                {total > 0 ? formatPercentValue(p.value / total) : "—"}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
