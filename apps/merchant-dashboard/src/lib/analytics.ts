import type { AnalyticsSummary } from "@store-builder/api-client";
import { useAsync } from "@/lib/useAsync";
import { getIntlLocale } from "@/i18n/LocaleContext";
import { fetchAnalyticsPair, takePrefetchedAnalyticsSummary } from "@/lib/analyticsPrefetch";
import { rangeNow } from "@/lib/timeWindow";

/** The ranges the analytics and profit screens offer. */
export type AnalyticsRange = "today" | "yesterday" | "7d" | "30d" | "90d" | "365d";

export const ANALYTICS_RANGES: AnalyticsRange[] = ["today", "yesterday", "7d", "30d", "90d", "365d"];

const DAYS: Record<Exclude<AnalyticsRange, "today" | "yesterday">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * `from`/`to` for a range, and the same-length window immediately before it.
 * `to` is exclusive server-side, so "now" is a valid end. "Today" runs from
 * local midnight to now and compares against the same hours of yesterday;
 * "yesterday" is a whole day against the day before it. "Now" is the start
 * of the next minute (lib/timeWindow): the same range asked twice within a
 * minute is the same request.
 */
export function rangeWindows(range: AnalyticsRange, at = Date.now()) {
  const now = rangeNow(at);
  let from: number;
  let to: number;
  if (range === "today") {
    from = startOfDay(now);
    to = now;
  } else if (range === "yesterday") {
    to = startOfDay(now);
    from = to - DAY_MS;
  } else {
    to = now;
    from = now - DAYS[range] * DAY_MS;
  }
  const span = to - from;
  return {
    current: { from: new Date(from).toISOString(), to: new Date(to).toISOString() },
    previous: { from: new Date(from - span).toISOString(), to: new Date(from).toISOString() },
  };
}

export interface AnalyticsPair {
  current: AnalyticsSummary;
  /**
   * The window before it, for the "vs previous period" deltas. Null when that
   * request failed — a missing comparison hides the deltas rather than
   * failing the whole screen.
   */
  previous: AnalyticsSummary | null;
}

/**
 * Both windows in one hook. They are fetched together so a KPI and its delta
 * always describe the same range, and the previous window is allowed to fail
 * on its own.
 */
export function useAnalyticsSummary(workspaceId: string, range: AnalyticsRange) {
  return useAsync<AnalyticsPair>(
    () => takePrefetchedAnalyticsSummary(workspaceId, range) ?? fetchAnalyticsPair(workspaceId, range),
    [workspaceId, range]
  );
}

/**
 * Change from `previous` to `current`, in basis points, for `<KpiCard>`.
 * Returns null when there is no usable baseline — a jump from zero is not a
 * percentage, and showing one would be an invented number.
 */
export function deltaBasisPoints(
  current: number | null | undefined,
  previous: number | null | undefined
): number | null {
  if (current === null || current === undefined) return null;
  if (previous === null || previous === undefined || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 10000);
}

/**
 * The API reports rates as percentages (12.5 = 12.5%); `formatPercentValue`
 * takes a ratio. Null stays null so "—" is rendered instead of "0.0%".
 */
export function percentToRatio(percent: number | null | undefined): number | null {
  if (percent === null || percent === undefined || !Number.isFinite(percent)) return null;
  return percent / 100;
}

/** Thousands separators in the active dashboard language. */
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(getIntlLocale()).format(value);
}

/**
 * "Aug 28 – Sep 26" for a window. `to` is exclusive, so the last shown day is
 * the one just before it; a window inside one day shows that day once.
 */
export function formatWindow(from: string, to: string): string {
  const start = new Date(from);
  const end = new Date(new Date(to).getTime() - 1);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "—";
  const f = new Intl.DateTimeFormat(getIntlLocale(), { day: "numeric", month: "short" });
  const a = f.format(start);
  const b = f.format(end);
  return a === b ? a : `${a} – ${b}`;
}

/** "2026-09-14" -> "14 Sep". Day and month only: the axis is already dated. */
export function formatAxisDate(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return new Intl.DateTimeFormat(getIntlLocale(), {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}
