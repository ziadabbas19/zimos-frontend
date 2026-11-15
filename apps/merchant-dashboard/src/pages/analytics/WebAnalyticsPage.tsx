import { useMemo, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, Globe, X } from "lucide-react";
import { Card, cn } from "@store-builder/ui";
import type { WebAnalyticsCompare, WebAnalyticsFilterKey, WebAnalyticsRangeParams, WebAnalyticsUnit } from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { Select } from "@/components/Select";
import { StackedBarsChart } from "@/components/charts";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatCount, formatAxisDate, deltaBasisPoints } from "@/lib/analytics";
import { formatPercentValue } from "@/lib/format";
import { WEB_RANGES, countryName, defaultUnit, filtersFromSearch, flagOf, formatDuration, webRangeWindow, type WebRange } from "@/lib/webAnalytics";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { MetricsPanel, type MetricTab } from "./web/MetricsPanel";

const STRINGS = {
  en: {
    title: "Web analytics",
    description: "Who visits your store and what they do there, from the store's own tracker.",
    realtime: "Realtime",
    range: "Period",
    rToday: "Today",
    r24h: "Last 24 hours",
    rWeek: "This week",
    r7d: "Last 7 days",
    rMonth: "This month",
    r30d: "Last 30 days",
    r90d: "Last 90 days",
    rYear: "This year",
    r6m: "Last 6 months",
    r12m: "Last 12 months",
    rAll: "All time",
    compare: "Compare",
    cNone: "No comparison",
    cPrev: "Previous period",
    cYoy: "Same period last year",
    unit: "Group by",
    uMinute: "Minute",
    uHour: "Hour",
    uDay: "Day",
    uMonth: "Month",
    visitors: "Visitors",
    visits: "Visits",
    views: "Views",
    bounceRate: "Bounce rate",
    visitDuration: "Visit duration",
    chartTitle: "Views and visitors",
    chartDesc: "Views as the light bar, visitors in front; the comparison period dashed.",
    pages: "Pages",
    path: "Path",
    entry: "Entry",
    exit: "Exit",
    pageTitle: "Title",
    sources: "Sources",
    referrers: "Referrers",
    channels: "Channels",
    utmSource: "UTM source",
    utmCampaign: "UTM campaign",
    environment: "Environment",
    browsers: "Browsers",
    os: "OS",
    devices: "Devices",
    screens: "Screens",
    languages: "Languages",
    location: "Location",
    countries: "Countries",
    regions: "Regions",
    cities: "Cities",
    events: "Events",
    weekly: "Weekly traffic",
    weeklyDesc: "Visitors by day of week and hour, across the period.",
    filters: "Filters",
    clear: "Clear all",
    noData: "No visits in this period",
    noDataDesc: "The store reports every visit by itself — nothing to set up. Numbers appear with the first visitor.",
    direct: "Direct / none",
    fUrl: "Page",
    fReferrer: "Referrer",
    fTitle: "Title",
    fBrowser: "Browser",
    fOs: "OS",
    fDevice: "Device",
    fCountry: "Country",
    fRegion: "Region",
    fCity: "City",
    fLanguage: "Language",
    fScreen: "Screen",
    fEvent: "Event",
    fHostname: "Host",
    fTag: "Tag",
    fUtm: "UTM",
    days: ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"] as unknown as string,
  },
  ar: {
    title: "زيارات الموقع",
    description: "من يزور متجرك وماذا يفعل فيه، من تتبّع المتجر نفسه.",
    realtime: "مباشر الآن",
    range: "الفترة",
    rToday: "اليوم",
    r24h: "آخر 24 ساعة",
    rWeek: "هذا الأسبوع",
    r7d: "آخر 7 أيام",
    rMonth: "هذا الشهر",
    r30d: "آخر 30 يومًا",
    r90d: "آخر 90 يومًا",
    rYear: "هذا العام",
    r6m: "آخر 6 أشهر",
    r12m: "آخر 12 شهرًا",
    rAll: "كل الوقت",
    compare: "المقارنة",
    cNone: "بدون مقارنة",
    cPrev: "الفترة السابقة",
    cYoy: "الفترة نفسها من العام الماضي",
    unit: "التجميع",
    uMinute: "دقيقة",
    uHour: "ساعة",
    uDay: "يوم",
    uMonth: "شهر",
    visitors: "الزوار",
    visits: "الزيارات",
    views: "المشاهدات",
    bounceRate: "معدل الارتداد",
    visitDuration: "مدة الزيارة",
    chartTitle: "المشاهدات والزوار",
    chartDesc: "المشاهدات في العمود الفاتح والزوار أمامه؛ وفترة المقارنة بخط متقطع.",
    pages: "الصفحات",
    path: "المسار",
    entry: "صفحة الدخول",
    exit: "صفحة الخروج",
    pageTitle: "العنوان",
    sources: "المصادر",
    referrers: "المواقع المُحيلة",
    channels: "القنوات",
    utmSource: "UTM source",
    utmCampaign: "UTM campaign",
    environment: "البيئة",
    browsers: "المتصفحات",
    os: "نظام التشغيل",
    devices: "الأجهزة",
    screens: "الشاشات",
    languages: "اللغات",
    location: "الموقع الجغرافي",
    countries: "الدول",
    regions: "المناطق",
    cities: "المدن",
    events: "الأحداث",
    weekly: "الزيارات الأسبوعية",
    weeklyDesc: "الزوار حسب يوم الأسبوع والساعة، على مدار الفترة.",
    filters: "عوامل التصفية",
    clear: "مسح الكل",
    noData: "لا توجد زيارات في هذه الفترة",
    noDataDesc: "يُبلغ المتجر عن كل زيارة بنفسه ولا يحتاج إلى أي إعداد. ستظهر الأرقام مع أول زائر.",
    direct: "مباشر / بدون مصدر",
    fUrl: "الصفحة",
    fReferrer: "الموقع المُحيل",
    fTitle: "العنوان",
    fBrowser: "المتصفح",
    fOs: "النظام",
    fDevice: "الجهاز",
    fCountry: "الدولة",
    fRegion: "المنطقة",
    fCity: "المدينة",
    fLanguage: "اللغة",
    fScreen: "الشاشة",
    fEvent: "الحدث",
    fHostname: "اسم النطاق",
    fTag: "الوسم",
    fUtm: "UTM",
    days: ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"] as unknown as string,
  },
} satisfies Messages;

function Delta({ now, before }: { now: number | null; before: number | null | undefined }) {
  if (now === null || before === null || before === undefined) return null;
  const bp = deltaBasisPoints(now, before);
  if (bp === null) return null;
  const up = bp > 0;
  const down = bp < 0;
  return (
    <span className={cn("ms-2 inline-flex items-center gap-0.5 text-xs font-medium", up && "text-success", down && "text-danger", !up && !down && "text-ink-soft")}>
      {up && <ArrowUpRight className="size-3.5" aria-hidden />}
      {down && <ArrowDownRight className="size-3.5" aria-hidden />}
      <bdi dir="ltr">{formatPercentValue(Math.abs(bp) / 10000)}</bdi>
    </span>
  );
}

function Metric({ label, value, delta }: { label: string; value: ReactNode; delta?: ReactNode }) {
  return (
    <div className="min-w-32">
      <p className="text-xs font-medium text-ink-soft">{label}</p>
      <p className="tabular-nums mt-0.5 text-2xl font-semibold text-ink">
        {value}
        {delta}
      </p>
    </div>
  );
}

export function WebAnalyticsPage() {
  const t = useT(STRINGS);
  const { intlLocale } = useLocale();
  const workspaceId = useWorkspaceId();
  const [search, setSearch] = useSearchParams();

  const range = (WEB_RANGES.includes(search.get("range") as WebRange) ? search.get("range") : "24h") as WebRange;
  const compare = (search.get("compare") || undefined) as WebAnalyticsCompare | undefined;
  const unit = (search.get("unit") || defaultUnit(range)) as WebAnalyticsUnit;
  const filters = useMemo(() => filtersFromSearch(search), [search]);
  const filterEntries = Object.entries(filters) as Array<[WebAnalyticsFilterKey, string]>;

  const params = useMemo<WebAnalyticsRangeParams>(
    () => ({ ...webRangeWindow(range), compare, unit, ...filters }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [range, compare, unit, JSON.stringify(filters)]
  );
  const key = JSON.stringify(params);

  const stats = useAsync(() => apiClient.getWebAnalyticsStats(workspaceId, params), [workspaceId, key]);
  const series = useAsync(() => apiClient.getWebAnalyticsSeries(workspaceId, params), [workspaceId, key]);
  const weekly = useAsync(() => apiClient.getWebAnalyticsWeekly(workspaceId, params), [workspaceId, key]);

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(search);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    setSearch(next, { replace: true });
  };
  const addFilter = (k: WebAnalyticsFilterKey, v: string) => set({ [k]: v });

  const rangeLabel: Record<WebRange, string> = {
    today: t.rToday,
    "24h": t.r24h,
    week: t.rWeek,
    "7d": t.r7d,
    month: t.rMonth,
    "30d": t.r30d,
    "90d": t.r90d,
    year: t.rYear,
    "6m": t.r6m,
    "12m": t.r12m,
    all: t.rAll,
  };
  const filterLabel: Record<WebAnalyticsFilterKey, string> = {
    url: t.fUrl,
    referrer: t.fReferrer,
    title: t.fTitle,
    browser: t.fBrowser,
    os: t.fOs,
    device: t.fDevice,
    country: t.fCountry,
    region: t.fRegion,
    city: t.fCity,
    language: t.fLanguage,
    screen: t.fScreen,
    event: t.fEvent,
    hostname: t.fHostname,
    tag: t.fTag,
    utm_source: `${t.fUtm} source`,
    utm_medium: `${t.fUtm} medium`,
    utm_campaign: `${t.fUtm} campaign`,
    utm_content: `${t.fUtm} content`,
    utm_term: `${t.fUtm} term`,
  };

  const s = stats.data ?? null;
  const c = s?.comparison;
  const visitors = s?.visitors ?? 0;
  const country = (x: string) => (
    <span>
      <span className="me-1.5" aria-hidden>
        {flagOf(x)}
      </span>
      {countryName(x, intlLocale)}
    </span>
  );
  const referrer = (x: string) => (x === "" || x === "direct" ? t.direct : x);

  const bucketLabel = (iso: string) => {
    const d = new Date(iso);
    if (unit === "minute" || unit === "hour") {
      return new Intl.DateTimeFormat(intlLocale, { hour: "numeric", minute: unit === "minute" ? "2-digit" : undefined }).format(d);
    }
    if (unit === "month") return new Intl.DateTimeFormat(intlLocale, { month: "short", year: "2-digit" }).format(d);
    return formatAxisDate(iso.slice(0, 10));
  };

  const pagesTabs: MetricTab[] = [
    { type: "path", label: t.path, filterKey: "url" },
    { type: "entry", label: t.entry, filterKey: "url" },
    { type: "exit", label: t.exit, filterKey: "url" },
    { type: "title", label: t.pageTitle, filterKey: "title" },
  ];
  const sourcesTabs: MetricTab[] = [
    { type: "referrer", label: t.referrers, filterKey: "referrer", render: referrer },
    { type: "channel", label: t.channels },
    { type: "utm_source", label: t.utmSource, filterKey: "utm_source" },
    { type: "utm_campaign", label: t.utmCampaign, filterKey: "utm_campaign" },
  ];
  const envTabs: MetricTab[] = [
    { type: "browser", label: t.browsers, filterKey: "browser" },
    { type: "os", label: t.os, filterKey: "os" },
    { type: "device", label: t.devices, filterKey: "device" },
    { type: "screen", label: t.screens, filterKey: "screen" },
    { type: "language", label: t.languages, filterKey: "language" },
  ];
  const locationTabs: MetricTab[] = [
    { type: "country", label: t.countries, filterKey: "country", render: country },
    { type: "region", label: t.regions, filterKey: "region" },
    { type: "city", label: t.cities, filterKey: "city" },
  ];
  const eventTabs: MetricTab[] = [{ type: "event", label: t.events, filterKey: "event" }];

  const days = t.days as unknown as string[];
  // The rows run Saturday first (the Egyptian week, like `days`), but the API's
  // `dow` is Postgres's: 0 = Sunday … 6 = Saturday.
  const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5];
  const weeklyMax = Math.max(1, ...(weekly.data?.rows.map((r) => r.visitors) ?? [1]));
  const weeklyGrid = new Map((weekly.data?.rows ?? []).map((r) => [`${r.dow}:${r.hour}`, r.visitors]));

  return (
    <div className="min-w-0 max-w-7xl">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Link to="/analytics/realtime" className="inline-flex h-9 items-center gap-2 rounded-[0.5rem] border border-line bg-paper-raised px-3 text-sm font-medium text-ink hover:bg-paper">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            {t.realtime}
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select aria-label={t.range} value={range} onChange={(e) => set({ range: e.target.value, unit: null })} className="h-9 w-auto">
          {WEB_RANGES.map((r) => (
            <option key={r} value={r}>
              {rangeLabel[r]}
            </option>
          ))}
        </Select>
        <Select aria-label={t.compare} value={compare ?? ""} onChange={(e) => set({ compare: e.target.value || null })} className="h-9 w-auto">
          <option value="">{t.cNone}</option>
          <option value="prev">{t.cPrev}</option>
          <option value="yoy">{t.cYoy}</option>
        </Select>
        <Select aria-label={t.unit} value={unit} onChange={(e) => set({ unit: e.target.value })} className="h-9 w-auto">
          {(["minute", "hour", "day", "month"] as WebAnalyticsUnit[]).map((u) => (
            <option key={u} value={u}>
              {{ minute: t.uMinute, hour: t.uHour, day: t.uDay, month: t.uMonth }[u]}
            </option>
          ))}
        </Select>
        {filterEntries.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5" aria-label={t.filters}>
            {filterEntries.map(([k, v]) => (
              <button key={k} type="button" onClick={() => set({ [k]: null })} className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-primary-soft px-3 text-xs font-medium text-primary-dark hover:bg-primary/20 dark:text-primary">
                <span className="text-ink-soft">{filterLabel[k]}:</span> <bdi dir="ltr">{v}</bdi>
                <X className="size-3" aria-hidden />
              </button>
            ))}
            <button type="button" onClick={() => set(Object.fromEntries(filterEntries.map(([k]) => [k, null])))} className="cursor-pointer text-xs text-ink-soft hover:text-ink">
              {t.clear}
            </button>
          </div>
        )}
      </div>

      <DataState loading={stats.loading && !s} error={stats.error} onRetry={() => stats.refresh()}>
        {s && (
          <div className="space-y-4">
            <Card className="gap-0 p-4">
              <div className="flex flex-wrap gap-x-8 gap-y-3">
                <Metric label={t.visitors} value={<bdi dir="ltr">{formatCount(s.visitors)}</bdi>} delta={<Delta now={s.visitors} before={c?.visitors} />} />
                <Metric label={t.visits} value={<bdi dir="ltr">{formatCount(s.visits)}</bdi>} delta={<Delta now={s.visits} before={c?.visits} />} />
                <Metric label={t.views} value={<bdi dir="ltr">{formatCount(s.pageviews)}</bdi>} delta={<Delta now={s.pageviews} before={c?.pageviews} />} />
                <Metric label={t.bounceRate} value={<bdi dir="ltr">{s.bounceRate === null ? "—" : `${s.bounceRate}%`}</bdi>} delta={<Delta now={s.bounceRate} before={c?.bounceRate} />} />
                <Metric label={t.visitDuration} value={<bdi dir="ltr">{formatDuration(s.avgVisitTime)}</bdi>} delta={<Delta now={s.avgVisitTime} before={c?.avgVisitTime} />} />
              </div>
              <div className="mt-4" dir="ltr">
                <StackedBarsChart
                  summary={t.chartDesc}
                  points={(series.data?.series ?? []).map((p, i) => ({
                    label: bucketLabel(p.t),
                    primary: p.pageviews,
                    secondary: p.visitors,
                    comparisonPrimary: series.data?.comparison?.[i]?.pageviews ?? null,
                    comparisonSecondary: series.data?.comparison?.[i]?.visitors ?? null,
                  }))}
                  primaryLabel={t.views}
                  secondaryLabel={t.visitors}
                  comparisonLabel={compare ? (compare === "prev" ? t.cPrev : t.cYoy) : undefined}
                  format={(v) => formatCount(v)}
                />
              </div>
            </Card>

            {s.pageviews === 0 ? (
              <EmptyState icon={<Globe />} title={t.noData} description={t.noDataDesc} />
            ) : (
              <>
                <div className="grid gap-4 lg:grid-cols-2">
                  <MetricsPanel workspaceId={workspaceId} params={params} tabs={pagesTabs} total={visitors} onFilter={addFilter} />
                  <MetricsPanel workspaceId={workspaceId} params={params} tabs={sourcesTabs} total={visitors} onFilter={addFilter} />
                  <MetricsPanel workspaceId={workspaceId} params={params} tabs={envTabs} total={visitors} onFilter={addFilter} />
                  <MetricsPanel workspaceId={workspaceId} params={params} tabs={locationTabs} total={visitors} onFilter={addFilter} />
                  <MetricsPanel workspaceId={workspaceId} params={params} tabs={eventTabs} total={visitors} onFilter={addFilter} />
                  <Card className="gap-0 p-4">
                    <h2 className="text-sm font-semibold text-ink">{t.weekly}</h2>
                    <p className="mb-3 text-xs text-ink-soft">{t.weeklyDesc}</p>
                    <div className="grid gap-px" style={{ gridTemplateColumns: "2.5rem repeat(24, minmax(0, 1fr))" }} dir="ltr">
                      {days.map((day, row) => {
                        const dow = WEEK_ORDER[row];
                        return (
                        <div key={day} className="contents">
                          <span className="pe-1 text-[10px] leading-4 text-ink-soft">{day}</span>
                          {Array.from({ length: 24 }, (_, hour) => {
                            const v = weeklyGrid.get(`${dow}:${hour}`) ?? 0;
                            return (
                              <span
                                key={hour}
                                title={`${day} ${hour}:00 — ${formatCount(v)}`}
                                className="h-4 rounded-[2px] bg-primary"
                                style={{ opacity: v === 0 ? 0.06 : 0.2 + (v / weeklyMax) * 0.8 }}
                              />
                            );
                          })}
                        </div>
                        );
                      })}
                    </div>
                  </Card>
                </div>
              </>
            )}
          </div>
        )}
      </DataState>
    </div>
  );
}
