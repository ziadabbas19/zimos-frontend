import { useCallback, useId, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { IconCalendar, IconDownload, IconMoreReports, IconWarning } from "@/components/icons";
import { Button, Card, cn, ZLoader } from "@store-builder/ui";
import { storeReportCsv, storeReportRangeRefused, type StoreReportName, type StoreReportQuery } from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { ReportLinks, ReportTab, ReportTabState } from "@/components/report";
import { PHONE_QUERY, useMediaQuery } from "@/components/report/useMediaQuery";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { useWorkspace } from "@/context/WorkspaceContext";
import { apiClient } from "@/lib/apiClient";
import { isPermissionError } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatMinorMoney, formatOptions, formatPercentValue } from "@/lib/format";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { fmt, getIntlLocale, useT } from "@/i18n/LocaleContext";
import { REPORT_TAB_LABELS, REPORT_TAB_PATHS, type ReportTabKey } from "@/pages/reports/reportTabs";
import { STORE_REPORT_STRINGS, STORE_REPORTS_INDEX, type StoreReportSlug } from "./storeReportStrings";

// ------------------------------------------------------------ date range --

export type StoreReportPreset = "today" | "yesterday" | "7d" | "30d" | "90d" | "month" | "lastMonth" | "12m" | "custom";

const PRESETS: StoreReportPreset[] = ["today", "yesterday", "7d", "30d", "90d", "month", "lastMonth", "12m", "custom"];
/** The reports' own default window when no dates are sent. */
const DEFAULT_PRESET: StoreReportPreset = "90d";
const DAY_MS = 86_400_000;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Days are moved as UTC midnights, so a daylight-saving change never shifts a date.
const dayToUtc = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  if (y >= 100) return Date.UTC(y, m - 1, d);
  // Date.UTC reads a year below 100 as 19xx — and a year being typed passes through 0002 and 0020.
  const date = new Date(Date.UTC(2000, m - 1, d));
  date.setUTCFullYear(y);
  return date.getTime();
};
const utcToDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const shiftDay = (day: string, days: number) => utcToDay(dayToUtc(day) + days * DAY_MS);

/** A real calendar day written "YYYY-MM-DD". */
function isDay(text: string | null): text is string {
  return !!text && DAY_PATTERN.test(text) && utcToDay(dayToUtc(text)) === text;
}

/** Today on the store's own calendar (the reports count days in its time zone), or the browser's when unknown. */
function storeToday(timeZone: string | undefined): string {
  const now = new Date();
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
    const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    const day = `${pick("year")}-${pick("month")}-${pick("day")}`;
    if (isDay(day)) return day;
  } catch {
    /* a zone this browser doesn't know: fall through to its own day */
  }
  return utcToDay(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/** First and last day of a preset, both included. */
function presetDays(preset: StoreReportPreset, today: string): [string, string] {
  const [year, month] = today.split("-").map(Number);
  switch (preset) {
    case "today":
      return [today, today];
    case "yesterday":
      return [shiftDay(today, -1), shiftDay(today, -1)];
    case "7d":
      return [shiftDay(today, -6), today];
    case "30d":
      return [shiftDay(today, -29), today];
    case "month":
      return [utcToDay(Date.UTC(year, month - 1, 1)), today];
    case "lastMonth":
      return [utcToDay(Date.UTC(year, month - 2, 1)), utcToDay(Date.UTC(year, month - 1, 0))];
    case "12m":
      return [shiftDay(today, -364), today];
    default:
      return [shiftDay(today, -89), today];
  }
}

export interface StoreReportRangeState {
  preset: StoreReportPreset;
  /** What the date inputs show. */
  fromDay: string;
  toDay: string;
  /** Picked dates with the start after the end: nothing new is asked for until that is put right. */
  invalid: boolean;
  /** The window the reports are asked for — the last one that made sense. Days, "YYYY-MM-DD", both included. */
  days: { from: string; to: string };
  setPreset: (preset: StoreReportPreset) => void;
  setDays: (fromDay: string, toDay: string) => void;
}

/**
 * The window of a store report: a preset or two picked days. It is sent as
 * days of the store's calendar and kept in the address
 * (`?range=30d`, `?from=2026-09-01&to=2026-09-30`) so a report can be
 * bookmarked and shared, like the analytics reports beside it.
 */
export function useStoreReportRange(): StoreReportRangeState {
  const { currentWorkspace } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const timeZone = currentWorkspace?.timezone;
  // One "today" per store and page: the window must not move (and refetch) while the page is open.
  const today = useMemo(() => storeToday(timeZone), [timeZone]);

  const rangeParam = params.get("range");
  const fromParam = params.get("from");
  const toParam = params.get("to");
  const shown = useMemo(() => {
    if (isDay(fromParam) && isDay(toParam)) return { preset: "custom" as StoreReportPreset, fromDay: fromParam, toDay: toParam };
    const known = PRESETS.find((preset) => preset === rangeParam && preset !== "custom");
    const preset = known ?? DEFAULT_PRESET;
    const [fromDay, toDay] = presetDays(preset, today);
    return { preset, fromDay, toDay };
  }, [rangeParam, fromParam, toParam, today]);

  // "YYYY-MM-DD" sorts as text.
  const invalid = shown.fromDay > shown.toDay;
  // The last window that made sense, kept for while the picked one does not.
  const [lastValid, setLastValid] = useState<{ from: string; to: string } | null>(null);
  if (!invalid && (lastValid?.from !== shown.fromDay || lastValid.to !== shown.toDay)) {
    setLastValid({ from: shown.fromDay, to: shown.toDay });
  }
  const askedFrom = invalid ? (lastValid?.from ?? presetDays(DEFAULT_PRESET, today)[0]) : shown.fromDay;
  const askedTo = invalid ? (lastValid?.to ?? today) : shown.toDay;
  const days = useMemo(() => ({ from: askedFrom, to: askedTo }), [askedFrom, askedTo]);

  const update = useCallback(
    (change: (next: URLSearchParams) => void) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          change(next);
          return next;
        },
        { replace: true }
      );
    },
    [setParams]
  );

  const setPreset = useCallback(
    (preset: StoreReportPreset) =>
      update((next) => {
        next.delete("from");
        next.delete("to");
        next.delete("range");
        if (preset === "custom") {
          // The picker starts from what is on screen.
          next.set("from", days.from);
          next.set("to", days.to);
        } else if (preset !== DEFAULT_PRESET) next.set("range", preset);
      }),
    [update, days.from, days.to]
  );

  const setDays = useCallback(
    (fromDay: string, toDay: string) =>
      update((next) => {
        next.delete("range");
        next.set("from", fromDay);
        next.set("to", toDay);
      }),
    [update]
  );

  return { preset: shown.preset, fromDay: shown.fromDay, toDay: shown.toDay, invalid, days, setPreset, setDays };
}

/**
 * A control whose value lives in the address. The router writes the address
 * behind a transition, so a control bound straight to it snaps back to its old
 * value for a moment after every change (and a date being typed loses its
 * place). This keeps what was just picked on screen, writes it to the address,
 * and follows the address when it changes from somewhere else.
 */
export function useAddressValue<T>(inAddress: T, write: (next: T) => void): [T, (next: T) => void] {
  const [value, setValue] = useState(inAddress);
  const [seen, setSeen] = useState(inAddress);
  if (seen !== inAddress) {
    setSeen(inAddress);
    setValue(inAddress);
  }
  return [
    value,
    (next) => {
      setValue(next);
      write(next);
    },
  ];
}

const DATE_INPUT =
  "h-11 rounded-[0.5rem] border border-line-strong bg-paper-raised px-2.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-primary md:h-9";

/**
 * A day typed to the end. A date field hands over a value as soon as its three
 * parts are filled, so a year typed digit by digit arrives as 0002, 0020, 0202
 * before 2026: those wait in the field and ask for nothing.
 */
const wholeDay = (day: string) => day >= "2000-01-01" && day <= "2100-12-31";

/**
 * The presets, and two date inputs once "custom" is picked. A start after the
 * end is said under the inputs and the report keeps the window
 * it had; `refused` shows the same line when the server said so itself.
 */
export function StoreReportRangeBar({ range, refused = false, className }: { range: StoreReportRangeState; refused?: boolean; className?: string }) {
  const t = useT(STORE_REPORT_STRINGS);
  const errorId = useId();
  const wrong = range.invalid || refused;
  const [preset, setPreset] = useAddressValue(range.preset, range.setPreset);
  // The two days as typed. A date being retyped is empty for a moment: the window waits for a whole day.
  const [typed, setTyped] = useState({ from: range.fromDay, to: range.toDay });
  const [seen, setSeen] = useState({ from: range.fromDay, to: range.toDay });
  if (seen.from !== range.fromDay || seen.to !== range.toDay) {
    setSeen({ from: range.fromDay, to: range.toDay });
    setTyped({ from: range.fromDay, to: range.toDay });
  }
  function type(part: "from" | "to", day: string) {
    const next = { ...typed, [part]: day };
    setTyped(next);
    if (wholeDay(next.from) && wholeDay(next.to)) range.setDays(next.from, next.to);
  }
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <IconCalendar className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
          <Select
            aria-label={t.rangeLabel}
            value={preset}
            onChange={(e) => setPreset(e.target.value as StoreReportPreset)}
            className="h-11 w-auto ps-9 font-medium md:h-9"
          >
            {PRESETS.map((option) => (
              <option key={option} value={option}>
                {t[option]}
              </option>
            ))}
          </Select>
        </div>
        {range.preset === "custom" && (
          <>
            <input
              type="date"
              aria-label={t.from}
              aria-invalid={wrong || undefined}
              aria-describedby={wrong ? errorId : undefined}
              value={typed.from}
              onChange={(e) => type("from", e.target.value)}
              className={cn(DATE_INPUT, wrong && "border-danger")}
            />
            <span className="text-sm text-ink-soft" aria-hidden>
              –
            </span>
            <input type="date" aria-label={t.to} value={typed.to} onChange={(e) => type("to", e.target.value)} className={DATE_INPUT} />
          </>
        )}
      </div>
      {wrong && (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {t.rangeInvalid}
        </p>
      )}
    </div>
  );
}

// --------------------------------------------------------------------- CSV --

/** Hands a fetched file to the browser's download. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * «تنزيل CSV»: the report under the same query as the screen. The file needs
 * the sign-in header, so it comes through the API client and is then saved.
 */
export function StoreReportCsvButton({
  report,
  params,
  fileName,
  disabled,
  className,
}: {
  report: StoreReportName;
  params: StoreReportQuery;
  /** Without ".csv": the report's name, then its window or filter. */
  fileName: string;
  disabled?: boolean;
  className?: string;
}) {
  const t = useT(STORE_REPORT_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);

  async function download() {
    if (busy) return;
    setBusy(true);
    try {
      saveBlob(await storeReportCsv(apiClient, workspaceId, report, params), `${fileName}.csv`);
    } catch (err) {
      // "Not part of your role" is worth saying as it is; anything else is "try again".
      toast.error(isPermissionError(err) ? errorMessage(err) : t.csvFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="outline" className={cn("min-h-11 gap-2 rounded-full px-4 md:min-h-10", className)} onClick={download} disabled={disabled || busy}>
      {busy ? <ZLoader size="sm" label={t.downloading} /> : <IconDownload className="size-4" aria-hidden />}
      {t.downloadCsv}
    </Button>
  );
}

// -------------------------------------------------------------- page frame --

/** The tab of the reports hub each side report is reached from: where its back link leads. */
const HUB_TAB: Record<StoreReportSlug, ReportTabKey> = {
  tax: "sales",
  "order-times": "journey",
  returns: "journey",
  "sales-by-collection": "products",
  "sales-by-option": "products",
  "inventory-value": "products",
  "slow-stock": "products",
};

/**
 * The way back from a side report: the hub tab that links to it, with the
 * window the report's address names (the hub reads the same `range` / `from`
 * and `to`), so the merchant lands on the days they were looking at.
 */
export function useHubBack(slug: StoreReportSlug): { to: string; label: string } {
  const labels = useT(REPORT_TAB_LABELS);
  const [params] = useSearchParams();
  const tab = HUB_TAB[slug];
  const keep = new URLSearchParams();
  const from = params.get("from");
  const to = params.get("to");
  const range = params.get("range");
  if (isDay(from) && isDay(to)) {
    keep.set("from", from);
    keep.set("to", to);
  } else if (range && PRESETS.some((preset) => preset === range && preset !== "custom")) {
    keep.set("range", range);
  }
  const query = keep.toString();
  return { to: `${REPORT_TAB_PATHS[tab]}${query ? `?${query}` : ""}`, label: labels[tab] };
}

/** A report's heading: its name, one line on what it counts, and the way back to the list. Kept for pages outside the shell. */
export function StoreReportHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  const t = useT(STORE_REPORT_STRINGS);
  return <PageHeader title={title} description={description} back={{ to: STORE_REPORTS_INDEX, label: t.moreReports }} actions={actions} />;
}

interface ReportState<T> {
  data: T | null;
  loading: boolean;
  error: unknown;
  reload: () => void;
}

/** The parts of a report share one column and one gap, like a tab of the reports hub. */
const COLUMN = "flex min-w-0 flex-col gap-[var(--bento-gap)]";

/**
 * A report's body under the shared loading / error / no-permission states.
 * When the window changes, the numbers on screen stay, dimmed, until the new
 * ones arrive — no jump back to a skeleton.
 */
export function StoreReportBody<T>({
  state,
  children,
}: {
  state: ReportState<T>;
  /** Kept for callers of the old frame; the skeleton is the report kit's own. */
  skeleton?: "card" | "table" | "tiles";
  children: (data: T) => ReactNode;
}) {
  return (
    <ReportTabState loading={state.loading && !state.data} error={state.error} onRetry={state.reload}>
      {state.data && (
        <div
          aria-busy={state.loading || undefined}
          className={cn(COLUMN, "transition-opacity duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none", state.loading && "opacity-60")}
        >
          {children(state.data)}
        </div>
      )}
    </ReportTabState>
  );
}

/**
 * The page of one side report, on the report kit: the shared header (name, one
 * line on a wide screen, the way back to the hub tab that links here, at most
 * one action), the report's own controls, then the question it answers as the
 * heading of a column of parts — stat cards, a chart, the ONE table — and the
 * way to the other side reports at its foot. A role that may not read the
 * report sees who can grant it, and no controls.
 */
export function StoreReportShell<T>({
  slug,
  title,
  description,
  question,
  note,
  actions,
  controls,
  state,
  children,
}: {
  slug: StoreReportSlug;
  title: string;
  /** One line on what the report counts: in the header from md up. */
  description?: string;
  question: string;
  note?: ReactNode;
  actions?: ReactNode;
  /** The period, a switch, a filter: one row over the report. */
  controls?: ReactNode;
  state: ReportState<T>;
  children: (data: T) => ReactNode;
}) {
  const c = useT(STORE_REPORT_STRINGS);
  const back = useHubBack(slug);
  const phone = useMediaQuery(PHONE_QUERY);
  const denied = isPermissionError(state.error);
  return (
    <div className="min-w-0 max-w-6xl">
      <PageHeader title={title} description={phone ? undefined : description} back={back} actions={denied ? undefined : actions} />
      {!denied && controls && <div className="mb-4 flex min-w-0 flex-wrap items-start gap-x-3 gap-y-2">{controls}</div>}
      <ReportTab question={question} note={denied ? undefined : note}>
        <StoreReportBody state={state}>{children}</StoreReportBody>
        <ReportLinks
          title={c.moreReports}
          items={[{ to: STORE_REPORTS_INDEX, title: c.allReports, description: c.moreReportsHint, icon: IconMoreReports }]}
        />
      </ReportTab>
    </div>
  );
}

/**
 * A card for a part that is as tall as its content — a list of bars, the
 * heatmap — with the title line of the kit's chart card (which is for charts
 * of a fixed height).
 */
export function StoreReportCard({
  title,
  note,
  aside,
  children,
  className,
}: {
  title: string;
  note?: ReactNode;
  /** At the end of the title line: a figure, a small switch. */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card data-report-chart="" className={cn("min-w-0 gap-0 p-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-[15px] leading-6 font-semibold text-ink">{title}</h3>
          {note && <p className="mt-0.5 text-[13px] leading-5 text-pretty text-ink-soft">{note}</p>}
        </div>
        {aside && <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2">{aside}</div>}
      </div>
      <div className="mt-3 min-w-0">{children}</div>
    </Card>
  );
}

/** A strip that says something the numbers leave out (products without a cost): amber, with its icon, read with the page. */
export function StoreReportNote({ children }: { children: ReactNode }) {
  return (
    <div
      role="note"
      data-slot="store-report-note"
      className="flex min-w-0 items-start gap-3 rounded-(--radius-card) bg-accent-soft px-4 py-3.5 text-sm leading-6 text-ink ring-1 ring-accent/30"
    >
      <IconWarning className="mt-0.5 size-5 shrink-0 text-accent-dark" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/**
 * The export of a report's table, for `ReportTable`'s `onExport`: the server's
 * own CSV under the same query as the screen (the file the old button gave).
 * It throws when the file could not be prepared; the table says so.
 */
export function useStoreReportCsv(report: StoreReportName, params: StoreReportQuery, fileName: string): () => Promise<void> {
  const workspaceId = useWorkspaceId();
  return async () => {
    saveBlob(await storeReportCsv(apiClient, workspaceId, report, params), `${fileName}.csv`);
  };
}

/** «اعرض آخر ١٢ شهر»: the one action of a report with nothing in its window. Nothing once the widest window is on. */
export function LongerPeriodButton({ range }: { range: StoreReportRangeState }) {
  const c = useT(STORE_REPORT_STRINGS);
  if (range.preset === "12m") return null;
  return (
    <Button type="button" className="min-h-11 rounded-full px-5" onClick={() => range.setPreset("12m")}>
      {fmt(c.showPeriod, { period: c["12m"] })}
    </Button>
  );
}

/** True when a report was refused for the signed-in role: the page then offers no CSV either. */
export function reportDenied(error: unknown): boolean {
  return isPermissionError(error);
}

/** True when the server itself said the window is upside down (422 on `from`). */
export function reportRangeRefused(error: unknown): boolean {
  return storeReportRangeRefused(error);
}

/** The row of headline figures above a report's table. */
export function StatTiles({ columns = 4, children }: { columns?: 2 | 3 | 4; children: ReactNode }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3", columns === 4 ? "lg:grid-cols-4" : columns === 3 ? "lg:grid-cols-3" : "")}>{children}</div>
  );
}

/** A line of text where a table would be, when the window has nothing in it. */
export function ReportEmptyLine({ children }: { children: ReactNode }) {
  return <p className="px-4 pb-4 text-sm text-ink-soft">{children}</p>;
}

// -------------------------------------------------------------- formatting --

/** Minor units of the store currency, for display. */
export function reportMoney(amountMinor: string | number | null | undefined, currency: string): string {
  return formatMinorMoney(amountMinor, currency);
}

/** A share of a whole, as the API sends it (83.3): "83%", and one decimal only below 10%. */
export function formatShare(percent: number): string {
  return formatPercentValue(percent / 100, percent > 0 && percent < 10 ? 1 : 0);
}

/** A day of the window, "2026-09-01" → "Sep 1, 2026" / «١ سبتمبر ٢٠٢٦» (the day as written, whatever the browser's zone). */
export function formatReportDay(day: string): string {
  if (!isDay(day)) return day;
  return new Intl.DateTimeFormat(getIntlLocale(), { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(dayToUtc(day))
  );
}

/** "2026-10" → "October 2026" / «أكتوبر ٢٠٢٦». */
export function monthLabel(month: string): string {
  const [year, index] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, (index || 1) - 1, 1));
  if (Number.isNaN(date.getTime())) return month;
  return new Intl.DateTimeFormat(getIntlLocale(), { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

/** A variant in a report table: the product (a link to it), then its options and SKU. */
export function ProductCell({
  productId,
  name,
  options,
  sku,
  children,
}: {
  productId?: string | null;
  name: string | null;
  options?: Record<string, string> | null;
  sku?: string | null;
  /** A further line under the name. */
  children?: ReactNode;
}) {
  const detail = formatOptions(options);
  return (
    // items-start: each line hugs the cell's own start edge, so an English name in the Arabic table is not thrown to the far side.
    <span className="flex min-w-0 flex-col items-start gap-0.5">
      {productId ? (
        <Link to={`/catalog/${productId}`} className="font-medium text-ink hover:text-primary">
          <bdi>{name || "—"}</bdi>
        </Link>
      ) : (
        <span className="font-medium text-ink">
          <bdi>{name || "—"}</bdi>
        </span>
      )}
      {(detail || sku) && (
        <span className="text-xs font-normal text-ink-soft">
          {detail && <bdi>{detail}</bdi>}
          {detail && sku && " · "}
          {sku && <bdi dir="ltr">{sku}</bdi>}
        </span>
      )}
      {children}
    </span>
  );
}
