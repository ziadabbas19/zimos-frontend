import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Globe } from "lucide-react";
import { Button } from "@store-builder/ui";
import type { WebAnalyticsMetricRow, WebAnalyticsRangeParams, WebAnalyticsSeriesPoint } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatDuration, webRangeWindow, type WebRange } from "@/lib/webAnalytics";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { Section } from "@/components/Section";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { FilterTabs } from "@/components/FilterTabs";

const STRINGS = {
  en: {
    title: "Website analytics",
    description: "Who visited your store, what they opened and where they came from.",
    range: "Period",
    r7: "7 days",
    r30: "30 days",
    full: "Full report",
    online: "Online now",
    visitors: "Visitors",
    pageviews: "Page views",
    visits: "Visits",
    bounce: "Bounce rate",
    time: "Time per visit",
    vsBefore: "vs the period before",
    chart: "Visitors by day",
    pages: "Most visited pages",
    sources: "Where visitors come from",
    direct: "Direct or unknown",
    none: "Nothing yet",
    emptyTitle: "No visits in this period",
    emptyBody: "Share your store link. Visits show up here as soon as someone opens it.",
  },
  ar: {
    title: "تحليلات الموقع",
    description: "من زار متجرك، وماذا فتح، ومن أين جاء.",
    range: "الفترة",
    r7: "7 أيام",
    r30: "30 يومًا",
    full: "التقرير الكامل",
    online: "متصل الآن",
    visitors: "الزوار",
    pageviews: "مشاهدات الصفحات",
    visits: "الزيارات",
    bounce: "معدل الارتداد",
    time: "مدة الزيارة",
    vsBefore: "عن الفترة السابقة",
    chart: "الزوار باليوم",
    pages: "أكثر الصفحات زيارة",
    sources: "من أين يأتي الزوار",
    direct: "مباشر أو غير معروف",
    none: "لا يوجد بعد",
    emptyTitle: "لا توجد زيارات في هذه الفترة",
    emptyBody: "شارك رابط متجرك. الزيارات تظهر هنا فور أن يفتحه أحد.",
  },
} satisfies Messages;

type Range = Extract<WebRange, "7d" | "30d">;

/** Change against the period before, as a signed whole percentage. Null when there is nothing to compare. */
function change(now: number | null | undefined, before: number | null | undefined): number | null {
  if (now === null || now === undefined || !before) return null;
  return Math.round(((now - before) / before) * 100);
}

/**
 * The store's own traffic on the home page: the headline numbers, a bar per
 * day, the top pages and the top sources. Reads the same endpoints as the
 * full web analytics page and links there.
 */
export function SiteAnalytics() {
  const t = useT(STRINGS);
  const { intlLocale } = useLocale();
  const workspaceId = useWorkspaceId();
  const [range, setRange] = useState<Range>("7d");
  const params = useMemo<WebAnalyticsRangeParams>(() => ({ ...webRangeWindow(range), compare: "prev", unit: "day" }), [range]);

  const data = useAsync(
    () =>
      Promise.all([
        apiClient.getWebAnalyticsStats(workspaceId, params),
        apiClient.getWebAnalyticsSeries(workspaceId, params),
        apiClient.getWebAnalyticsMetrics(workspaceId, "path", { ...params, limit: 5 }),
        apiClient.getWebAnalyticsMetrics(workspaceId, "referrer", { ...params, limit: 5 }),
        // Live visitors are a nicety: the section still shows if this one call fails.
        apiClient.getWebAnalyticsRealtime(workspaceId).catch(() => null),
      ]).then(([stats, series, pages, sources, live]) => ({ stats, series: series.series, pages: pages.rows, sources: sources.rows, live })),
    [workspaceId, params]
  );

  const number = (value: number) => new Intl.NumberFormat(intlLocale).format(value);
  const stats = data.data?.stats;
  const empty = Boolean(stats) && stats!.pageviews === 0 && stats!.visitors === 0;

  return (
    <Section
      title={t.title}
      description={t.description}
      actions={
        <>
          <FilterTabs
            label={t.range}
            value={range}
            onChange={setRange}
            tabs={[
              { value: "7d", label: t.r7 },
              { value: "30d", label: t.r30 },
            ]}
          />
          <Button asChild size="sm" variant="outline">
            <Link to="/analytics/web">
              {t.full}
              <ArrowUpRight className="size-4 rtl:-scale-x-100" aria-hidden />
            </Link>
          </Button>
        </>
      }
    >
      <div className="mt-4">
        <DataState loading={data.loading} error={data.error} onRetry={() => void data.refresh()}>
          {stats && empty ? (
            <EmptyState icon={<Globe className="size-6" aria-hidden />} title={t.emptyTitle} description={t.emptyBody} />
          ) : stats && data.data ? (
            <div className="space-y-5">
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <Figure label={t.online} value={number(data.data.live?.activeVisitors ?? 0)} live />
                <Figure label={t.visitors} value={number(stats.visitors)} delta={change(stats.visitors, stats.comparison?.visitors)} hint={t.vsBefore} />
                <Figure label={t.pageviews} value={number(stats.pageviews)} delta={change(stats.pageviews, stats.comparison?.pageviews)} hint={t.vsBefore} />
                <Figure label={t.visits} value={number(stats.visits)} delta={change(stats.visits, stats.comparison?.visits)} hint={t.vsBefore} />
                <Figure label={t.bounce} value={stats.bounceRate === null ? "—" : `${number(stats.bounceRate)}%`} />
                <Figure label={t.time} value={formatDuration(stats.avgVisitTime)} />
              </dl>

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <div className="min-w-0">
                  <h3 className="text-xs font-semibold text-ink-soft">{t.chart}</h3>
                  <DailyBars points={data.data.series} locale={intlLocale} format={number} />
                </div>
                <TopList title={t.pages} rows={data.data.pages} none={t.none} format={number} ltr />
                <TopList title={t.sources} rows={data.data.sources} none={t.none} format={number} fallback={t.direct} ltr />
              </div>
            </div>
          ) : null}
        </DataState>
      </div>
    </Section>
  );
}

function Figure({ label, value, delta, hint, live }: { label: string; value: string; delta?: number | null; hint?: string; live?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg border border-line p-3">
      <dt className="flex items-center gap-1.5 text-xs text-ink-soft">
        {live && <span className="size-1.5 rounded-full bg-success" aria-hidden />}
        <span className="truncate">{label}</span>
      </dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums text-ink">
        <bdi>{value}</bdi>
      </dd>
      {delta !== null && delta !== undefined && (
        <p className={delta >= 0 ? "text-xs font-medium text-success" : "text-xs font-medium text-danger"} title={hint}>
          <bdi dir="ltr">
            {delta > 0 ? "+" : ""}
            {delta}%
          </bdi>
        </p>
      )}
    </div>
  );
}

/** One bar per day. The tallest day fills the height; a day with no visitors keeps a hairline. */
function DailyBars({ points, locale, format }: { points: WebAnalyticsSeriesPoint[]; locale: string; format: (value: number) => string }) {
  const max = Math.max(1, ...points.map((p) => p.visitors));
  const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  return (
    <div className="mt-3 flex h-36 items-end gap-1" dir="ltr">
      {points.map((point) => (
        <div
          key={point.t}
          className="group relative flex h-full min-w-0 flex-1 items-end"
          title={`${day.format(new Date(point.t))} · ${format(point.visitors)}`}
        >
          <span className="w-full rounded-t-sm bg-primary/70 transition-colors group-hover:bg-primary" style={{ height: `${Math.max(2, (point.visitors / max) * 100)}%` }} />
        </div>
      ))}
    </div>
  );
}

function TopList({
  title,
  rows,
  none,
  format,
  fallback,
  ltr,
}: {
  title: string;
  rows: WebAnalyticsMetricRow[];
  none: string;
  format: (value: number) => string;
  /** Shown for a row with no name, such as a visit with no referrer. */
  fallback?: string;
  ltr?: boolean;
}) {
  const max = Math.max(1, ...rows.map((row) => row.y));
  return (
    <div className="min-w-0">
      <h3 className="text-xs font-semibold text-ink-soft">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">{none}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <li key={row.x || "-"} className="relative overflow-hidden rounded-md">
              <span className="absolute inset-y-0 start-0 rounded-md bg-primary-soft" style={{ width: `${(row.y / max) * 100}%` }} aria-hidden />
              <span className="relative flex items-center justify-between gap-3 px-2.5 py-1.5 text-sm">
                {row.x ? (
                  <bdi dir={ltr ? "ltr" : undefined} className="min-w-0 truncate text-ink">
                    {row.x}
                  </bdi>
                ) : (
                  <span className="min-w-0 truncate text-ink-soft">{fallback ?? "—"}</span>
                )}
                <span className="shrink-0 font-medium tabular-nums text-ink">{format(row.y)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
