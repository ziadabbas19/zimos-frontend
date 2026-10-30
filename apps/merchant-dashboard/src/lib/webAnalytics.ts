import type { WebAnalyticsFilterKey, WebAnalyticsFilters, WebAnalyticsUnit } from "@store-builder/api-client";
import { rangeNow } from "@/lib/timeWindow";

/** The date presets Umami's date filter offers. */
export type WebRange =
  | "today"
  | "24h"
  | "week"
  | "7d"
  | "month"
  | "30d"
  | "90d"
  | "year"
  | "6m"
  | "12m"
  | "all";

export const WEB_RANGES: WebRange[] = ["today", "24h", "week", "7d", "month", "30d", "90d", "year", "6m", "12m", "all"];

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * `from`/`to` (ISO, `to` exclusive) for a preset; "all" leaves both open.
 * "Now" is the start of the next minute (lib/timeWindow): the same preset
 * asked twice within a minute is the same request.
 */
export function webRangeWindow(range: WebRange, at = Date.now()): { from?: string; to?: string } {
  const now = rangeNow(at);
  const iso = (ms: number) => new Date(ms).toISOString();
  const today = startOfDay(now);
  const d = new Date(now);
  switch (range) {
    case "today":
      return { from: iso(today), to: iso(now) };
    case "24h":
      return { from: iso(now - DAY_MS), to: iso(now) };
    case "week": {
      // Weeks start on Saturday here, the Egyptian working week.
      const dow = (d.getDay() + 1) % 7;
      return { from: iso(today - dow * DAY_MS), to: iso(now) };
    }
    case "7d":
      return { from: iso(now - 7 * DAY_MS), to: iso(now) };
    case "month":
      return { from: iso(new Date(d.getFullYear(), d.getMonth(), 1).getTime()), to: iso(now) };
    case "30d":
      return { from: iso(now - 30 * DAY_MS), to: iso(now) };
    case "90d":
      return { from: iso(now - 90 * DAY_MS), to: iso(now) };
    case "year":
      return { from: iso(new Date(d.getFullYear(), 0, 1).getTime()), to: iso(now) };
    case "6m":
      return { from: iso(new Date(d.getFullYear(), d.getMonth() - 6, d.getDate()).getTime()), to: iso(now) };
    case "12m":
      return { from: iso(new Date(d.getFullYear() - 1, d.getMonth(), d.getDate()).getTime()), to: iso(now) };
    case "all":
      return {};
  }
}

/** Umami's getMinimumUnit: the finest bucket that keeps the chart readable. */
export function defaultUnit(range: WebRange): WebAnalyticsUnit {
  switch (range) {
    case "today":
    case "24h":
      return "hour";
    case "week":
    case "7d":
    case "month":
    case "30d":
      return "day";
    case "90d":
      return "day";
    case "year":
    case "6m":
    case "12m":
    case "all":
      return "month";
  }
}

export const FILTER_KEYS: WebAnalyticsFilterKey[] = [
  "url",
  "referrer",
  "title",
  "browser",
  "os",
  "device",
  "country",
  "region",
  "city",
  "language",
  "screen",
  "event",
  "hostname",
  "tag",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
];

/** Reads the active filters out of the page's search params. */
export function filtersFromSearch(search: URLSearchParams): WebAnalyticsFilters {
  const out: WebAnalyticsFilters = {};
  for (const key of FILTER_KEYS) {
    const value = search.get(key);
    if (value) out[key] = value;
  }
  return out;
}

/** "1m 32s" / "45s" for a duration in seconds. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "—";
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

/** The ISO country code as a flag emoji, for the location panels. */
export function flagOf(code: string | null | undefined): string {
  if (!code || code.length !== 2) return "";
  const base = 0x1f1e6;
  const upper = code.toUpperCase();
  return String.fromCodePoint(base + upper.charCodeAt(0) - 65, base + upper.charCodeAt(1) - 65);
}

/** "EG" -> "Egypt" in the active language, via the browser's own names. */
export function countryName(code: string | null | undefined, locale: string): string {
  if (!code) return "—";
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}
