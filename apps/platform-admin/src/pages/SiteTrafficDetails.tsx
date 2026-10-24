import { useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { Alert, Badge, Button, Segmented, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import { ApiError } from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { DetailRow, Drawer } from "@/components/Drawer";
import { KpiCard } from "@/components/KpiCard";
import { BarChart, ChartAxis, HBarList } from "@/components/charts";
import { NativeSelect, SearchInput } from "@/components/forms";
import { Mono, Panel, Td, Th } from "@/components/Panel";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { useAsync } from "@/lib/useAsync";
import { SITE_LIVE_ENABLED } from "@/lib/features";
import * as api from "@/lib/siteTrafficApi";
import { SITE_DETAILS_RANGES, SITE_DEVICES, SITE_VISIT_SORTS, type SiteDetailsRange, type SiteFilters, type SiteVisitSort } from "@/lib/siteTrafficApi";
import { SITE_TRAFFIC_STRINGS, formatDuration } from "@/lib/siteTrafficStrings";
import { GOVERNORATE_CODES, countryName, formatRatePct, governorateName } from "@/lib/storeTrafficStrings";
import { formatChartLabel, formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import { Pager } from "@/pages/BlocklistPage";
import { ClickableList, SimpleTable } from "@/pages/StoreTrafficPage";

type Strings = Record<keyof (typeof SITE_TRAFFIC_STRINGS)["en"], string>;
type Locale = "en" | "ar";
const TABS = ["overview", "visits", "campaigns", "protection", "live"] as const;
type Tab = (typeof TABS)[number];
/** Live only with VITE_SITE_LIVE_ENABLED. */
const shownTabs = (): readonly Tab[] => TABS.filter((v) => v !== "live" || SITE_LIVE_ENABLED);
const PAGE_SIZE = 25;

/** The API answers 404 while SITE_TRAFFIC_DETAILS_ENABLED is off there. */
const isOff = (error: unknown) => error instanceof ApiError && error.status === 404;

const sourceLabel = (t: Strings, source: string | null | undefined) => (!source || source === "direct" ? t.direct : source);
const deviceLabel = (t: Strings, device: string | null | undefined) => (device ? (t[`device_${device}` as keyof Strings] ?? device) : "—");

/**
 * Site traffic in detail (VITE_SITE_TRAFFIC_DETAILS_ENABLED, overview.view):
 * zimos.co visits from /admin/site-traffic/*, laid out as Store traffic is.
 * The tab, period and filters live in the address, so a view can be shared
 * and survives a reload.
 */
export function SiteTrafficDetails() {
  const t = useT(SITE_TRAFFIC_STRINGS);
  const { locale } = useLocale();
  const [params, setParams] = useSearchParams();
  const tabs = shownTabs();
  const tab = (tabs as readonly string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as Tab) : "overview";
  const range = (SITE_DETAILS_RANGES as string[]).includes(params.get("range") ?? "") ? (params.get("range") as SiteDetailsRange) : "7d";
  const filters: SiteFilters = {
    range,
    country: params.get("country") || undefined,
    governorate: params.get("governorate") || undefined,
    device: params.get("device") || undefined,
    source: params.get("source") || undefined,
  };
  const set = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    // Any change of what is shown starts the visits list again at its first page.
    if (!("page" in patch)) next.delete("page");
    setParams(next, { replace: true });
  };
  const [visit, setVisit] = useState<string | null>(null);

  return (
    <div>
      <PageHeader title={t.title} description={t.description} />

      <div className="mb-4 space-y-3">
        <Segmented
          label={t.title}
          value={tab}
          onChange={(v) => set({ tab: v === "overview" ? undefined : v })}
          options={tabs.map((v) => ({ value: v, label: t[`tab${v[0].toUpperCase()}${v.slice(1)}` as keyof Strings] }))}
        />
        {/* Live is always the last five minutes: no period, no filters. */}
        {tab !== "live" && (
          <div className="flex flex-wrap items-end gap-2">
            <Segmented
              size="sm"
              label={t.title}
              value={range}
              onChange={(v) => set({ range: v === "7d" ? undefined : v })}
              options={SITE_DETAILS_RANGES.map((r) => ({ value: r, label: t[`range_${r}`] }))}
            />
            {tab !== "protection" && <VisitFilters t={t} locale={locale} filters={filters} onChange={set} />}
          </div>
        )}
      </div>

      {tab === "overview" && <OverviewTab t={t} locale={locale} filters={filters} onFilter={set} />}
      {tab === "visits" && (
        <VisitsTab
          t={t}
          locale={locale}
          filters={filters}
          sort={(SITE_VISIT_SORTS as string[]).includes(params.get("sort") ?? "") ? (params.get("sort") as SiteVisitSort) : "recent"}
          page={Math.max(1, Number(params.get("page")) || 1)}
          onSort={(sort) => set({ sort: sort === "recent" ? undefined : sort })}
          onPage={(page) => set({ page: page > 1 ? String(page) : undefined })}
          onOpen={setVisit}
        />
      )}
      {tab === "campaigns" && <CampaignsTab t={t} filters={filters} />}
      {tab === "protection" && <ProtectionTab t={t} locale={locale} range={range} />}
      {tab === "live" && <LiveTab t={t} locale={locale} onOpen={setVisit} />}

      <VisitDrawer t={t} locale={locale} sessionId={visit} onClose={() => setVisit(null)} />
    </div>
  );
}

/** DataState, except that the API's flag being off is said plainly instead of "Not found". */
function Loaded({ t, loading, error, onRetry, children }: { t: Strings; loading: boolean; error: unknown; onRetry: () => void; children: ReactNode }) {
  if (isOff(error)) return <Alert>{t.detailsOff}</Alert>;
  return (
    <DataState loading={loading} error={error} onRetry={onRetry}>
      {children}
    </DataState>
  );
}

function VisitFilters({
  t,
  locale,
  filters,
  onChange,
}: {
  t: Strings;
  locale: Locale;
  filters: SiteFilters;
  onChange: (patch: Record<string, string | undefined>) => void;
}) {
  const [source, setSource] = useState(filters.source ?? "");
  const any = Boolean(filters.country || filters.governorate || filters.device || filters.source);
  return (
    <>
      <NativeSelect aria-label={t.country} value={filters.country ?? ""} onChange={(e) => onChange({ country: e.target.value || undefined })} className="w-36">
        <option value="">{t.anyCountry}</option>
        {["EG", "SA", "AE", "KW", "QA", "JO", "LY", "US", "GB", "DE"].map((c) => (
          <option key={c} value={c}>
            {countryName(c, locale)}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect aria-label={t.governorate} value={filters.governorate ?? ""} onChange={(e) => onChange({ governorate: e.target.value || undefined })} className="w-40">
        <option value="">{t.anyGovernorate}</option>
        {GOVERNORATE_CODES.map((g) => (
          <option key={g} value={g}>
            {governorateName(g, locale)}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect aria-label={t.device} value={filters.device ?? ""} onChange={(e) => onChange({ device: e.target.value || undefined })} className="w-32">
        <option value="">{t.anyDevice}</option>
        {SITE_DEVICES.map((d) => (
          <option key={d} value={d}>
            {deviceLabel(t, d)}
          </option>
        ))}
      </NativeSelect>
      <form
        className="w-56"
        onSubmit={(e) => {
          e.preventDefault();
          onChange({ source: source.trim() || undefined });
        }}
      >
        <SearchInput
          value={source}
          onChange={(v) => {
            setSource(v);
            if (!v) onChange({ source: undefined });
          }}
          placeholder={t.sourcePlaceholder}
          aria-label={t.source}
        />
      </form>
      {any && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setSource("");
            onChange({ country: undefined, governorate: undefined, device: undefined, source: undefined });
          }}
        >
          {t.clear}
        </Button>
      )}
    </>
  );
}

function OverviewTab({ t, locale, filters, onFilter }: { t: Strings; locale: Locale; filters: SiteFilters; onFilter: (p: Record<string, string | undefined>) => void }) {
  const { data, loading, error, refresh } = useAsync(
    () => api.getDetailsSummary(filters),
    [filters.range, filters.country, filters.governorate, filters.device, filters.source]
  );
  const points = data ? data.daily.map((d) => ({ label: formatChartLabel(d.day), value: d.views })) : [];
  return (
    <Loaded t={t} loading={loading && !data} error={error} onRetry={() => void refresh()}>
      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <KpiCard label={t.sessionsKpi} value={formatNumber(data.sessions)} hint={t.sessionsHint} />
            <KpiCard label={t.uniqueVisitors} value={formatNumber(data.visitors)} hint={t.uniqueHint} />
            <KpiCard label={t.pageViews} value={formatNumber(data.views)} />
            <KpiCard label={t.avgTime} value={data.avgSecondsPerSession === null ? "—" : formatDuration(data.avgSecondsPerSession, locale)} hint={t.avgTimeHint} />
            <KpiCard label={t.conversion} value={formatRatePct(data.conversionRate)} hint={`${t.conversionHint} · ${t.signups}: ${formatNumber(data.signups)}`} />
          </div>
          {data.sessions === 0 ? (
            <EmptyBlock message={t.none} />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Panel title={t.funnel} description={t.funnelHint}>
                  <ol className="space-y-2">
                    {data.funnel.map((s) => (
                      <li key={s.key} className="text-sm">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-ink">{t[`step_${s.key}` as keyof Strings]}</span>
                          <span className="tabular-nums text-ink">
                            {formatNumber(s.sessions)}
                            {s.dropRate !== null && <span className="ms-2 text-xs text-ink-soft">{fmt(t.dropped, { rate: formatRatePct(s.dropRate) })}</span>}
                          </span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-paper-sunken">
                          <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.round((s.sessions / Math.max(1, data.sessions)) * 100)}%` }} />
                        </div>
                      </li>
                    ))}
                  </ol>
                </Panel>
                <Panel title={t.dailyViews} description={t.dailyHint}>
                  <BarChart points={points} height={140} format={(v) => formatNumber(v)} />
                  <ChartAxis points={points} />
                </Panel>
              </div>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <Panel title={t.topSources}>
                  <ClickableList
                    rows={data.sources.map((s) => ({
                      key: s.source,
                      label: sourceLabel(t, s.source),
                      value: s.sessions,
                      extra: `${formatNumber(s.signups)} ${t.signups}`,
                    }))}
                    onPick={(source) => onFilter({ source })}
                  />
                </Panel>
                <Panel title={t.governorates} description={t.governoratesHint}>
                  <ClickableList
                    rows={data.governorates.map((g) => ({ key: g.governorate, label: governorateName(g.governorate, locale), value: g.sessions }))}
                    onPick={(governorate) => onFilter({ governorate })}
                  />
                </Panel>
                <Panel title={t.countries}>
                  <ClickableList
                    rows={data.countries.map((c) => ({ key: c.country ?? "", label: countryName(c.country, locale), value: c.sessions }))}
                    onPick={(country) => country && onFilter({ country })}
                  />
                </Panel>
                <Panel title={t.devices}>
                  <ClickableList
                    rows={data.devices.map((d) => ({ key: d.device, label: deviceLabel(t, d.device), value: d.sessions }))}
                    onPick={(device) => onFilter({ device })}
                  />
                </Panel>
                <Panel title={t.browsers}>
                  <HBarList rows={data.browsers.map((b) => ({ label: b.browser === "unknown" ? t.device_unknown : b.browser, value: b.sessions }))} format={(v) => formatNumber(v)} color="var(--color-accent)" />
                </Panel>
              </div>
              <Panel title={t.pagesTime} flush>
                <SimpleTable
                  heads={[t.path, t.viewsCol, t.timeOnPage, t.totalTime]}
                  rows={data.pages.map((p) => [
                    <Mono key="p">{p.path}</Mono>,
                    formatNumber(p.views),
                    p.avgSecondsPerView === null ? "—" : formatDuration(p.avgSecondsPerView, locale),
                    formatDuration(p.seconds, locale),
                  ])}
                />
              </Panel>
            </>
          )}
        </div>
      )}
    </Loaded>
  );
}

function VisitsTab({
  t,
  locale,
  filters,
  sort,
  page,
  onSort,
  onPage,
  onOpen,
}: {
  t: Strings;
  locale: Locale;
  filters: SiteFilters;
  sort: SiteVisitSort;
  page: number;
  onSort: (sort: SiteVisitSort) => void;
  onPage: (page: number) => void;
  onOpen: (sessionId: string) => void;
}) {
  const { data, loading, error, refresh } = useAsync(
    () => api.getVisits({ ...filters, page, pageSize: PAGE_SIZE, sort }),
    [filters.range, filters.country, filters.governorate, filters.device, filters.source, sort, page]
  );
  return (
    <Panel
      flush
      actions={
        <>
          <NativeSelect aria-label={t.sortBy} value={sort} onChange={(e) => onSort(e.target.value as SiteVisitSort)} className="w-36">
            {SITE_VISIT_SORTS.map((s) => (
              <option key={s} value={s}>
                {t[`sort_${s}` as keyof Strings]}
              </option>
            ))}
          </NativeSelect>
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading} aria-label={t.tabVisits}>
            <RefreshCw className="size-4" aria-hidden />
          </Button>
        </>
      }
    >
      <Loaded t={t} loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {data &&
          (data.sessions.length === 0 ? (
            <div className="p-4">
              <EmptyBlock message={t.none} />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <Th>{t.when}</Th>
                      <Th>{t.source}</Th>
                      <Th>{t.landingPage}</Th>
                      <Th>{t.place}</Th>
                      <Th>{t.deviceCol}</Th>
                      <Th>{t.pages}</Th>
                      <Th>{t.time}</Th>
                      <Th>{t.signedUp}</Th>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.sessions.map((r) => (
                      <TableRow key={r.sessionId} className="cursor-pointer" onClick={() => onOpen(r.sessionId)}>
                        <Td>
                          <span title={formatDateTime(r.lastSeenAt)}>{formatRelative(r.lastSeenAt)}</span>
                        </Td>
                        <Td>
                          {sourceLabel(t, r.source)}
                          {r.utmCampaign && <span className="block text-xs text-ink-soft">{r.utmCampaign}</span>}
                        </Td>
                        <Td>{r.landingPath ? <Mono>{r.landingPath}</Mono> : "—"}</Td>
                        <Td>
                          <div className="flex flex-col">
                            <span>{countryName(r.country, locale)}</span>
                            {r.governorate && <span className="text-xs text-ink-soft">{governorateName(r.governorate, locale)}</span>}
                          </div>
                        </Td>
                        <Td>
                          {deviceLabel(t, r.device)}
                          {r.browser && <span className="block text-xs text-ink-soft">{r.browser}</span>}
                        </Td>
                        <Td className="tabular-nums">{formatNumber(r.pages)}</Td>
                        <Td className="tabular-nums">{formatDuration(r.seconds, locale)}</Td>
                        <Td>{r.signedUp ? <Badge variant="secondary">{t.signedUp}</Badge> : <span className="text-ink-soft">—</span>}</Td>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="px-4 pb-4">
                <Pager total={data.total} limit={data.pageSize} offset={(data.page - 1) * data.pageSize} onOffset={(o) => onPage(Math.floor(o / data.pageSize) + 1)} />
              </div>
            </>
          ))}
      </Loaded>
    </Panel>
  );
}

function VisitDrawer({ t, locale, sessionId, onClose }: { t: Strings; locale: Locale; sessionId: string | null; onClose: () => void }) {
  const { data, loading, error, refresh } = useAsync(() => (sessionId ? api.getVisit(sessionId) : Promise.resolve(null)), [sessionId]);
  const s = data?.session;
  const utm = s ? [s.utmSource, s.utmMedium, s.utmCampaign].filter(Boolean).join(" / ") : "";
  return (
    <Drawer
      open={Boolean(sessionId)}
      onClose={onClose}
      title={t.visitTitle}
      description={s ? formatDateTime(s.startedAt) : undefined}
      footer={
        s?.userId ? (
          <Link to={`/users/${s.userId}`} className="text-sm font-medium text-primary hover:underline">
            {t.openUser}
          </Link>
        ) : undefined
      }
    >
      <Loaded t={t} loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {s && data && (
          <div className="space-y-4">
            <dl>
              <DetailRow label={t.started}>{formatDateTime(s.startedAt)}</DetailRow>
              <DetailRow label={t.lastSeen}>{formatDateTime(s.lastSeenAt)}</DetailRow>
              <DetailRow label={t.place}>
                {countryName(s.country, locale)}
                {s.governorate ? ` · ${governorateName(s.governorate, locale)}` : ""}
              </DetailRow>
              <DetailRow label={t.deviceCol}>{[deviceLabel(t, s.device), s.browser].filter(Boolean).join(" · ")}</DetailRow>
              <DetailRow label={t.language}>{s.locale ?? "—"}</DetailRow>
              <DetailRow label={t.utm}>{utm || "—"}</DetailRow>
              <DetailRow label={t.referrer}>{s.referrerHost ?? t.direct}</DetailRow>
              <DetailRow label={t.landingPage}>{s.landingPath ? <Mono>{s.landingPath}</Mono> : "—"}</DetailRow>
              <DetailRow label={t.totalTime}>{formatDuration(s.seconds, locale)}</DetailRow>
            </dl>
            <section>
              <h3 className="mb-2 text-sm font-semibold text-ink">{t.timeline}</h3>
              <ol className="space-y-2">
                {data.events.map((e, i) => (
                  <li key={i} className="rounded-md bg-paper-sunken/60 px-3 py-2 text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium text-ink">{t[`ev_${e.type}` as keyof Strings] ?? e.type}</span>
                      <span className="text-xs text-ink-soft tabular-nums">{formatDateTime(e.at)}</span>
                    </div>
                    {e.path && (
                      <div className="truncate text-ink-soft">
                        <Mono>{e.path}</Mono>
                      </div>
                    )}
                    {e.type === "signup" && e.userId && (
                      <Link to={`/users/${e.userId}`} className="text-xs font-medium text-primary hover:underline">
                        {t.openUser}
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </Loaded>
    </Drawer>
  );
}

function CampaignsTab({ t, filters }: { t: Strings; filters: SiteFilters }) {
  const { data, loading, error, refresh } = useAsync(
    () => api.getCampaigns(filters),
    [filters.range, filters.country, filters.governorate, filters.device, filters.source]
  );
  return (
    <Panel flush>
      <Loaded t={t} loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {data &&
          (data.campaigns.length === 0 ? (
            <div className="p-4">
              <EmptyBlock message={t.noCampaigns} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <SimpleTable
                heads={[t.source, t.medium, t.campaign, t.sessionsCol, t.ctaClicks, t.signupsCol, t.conversion]}
                rows={data.campaigns.map((c) => [
                  c.source ?? "—",
                  c.medium ?? "—",
                  c.campaign ?? "—",
                  formatNumber(c.sessions),
                  formatNumber(c.ctaClicks),
                  formatNumber(c.signups),
                  formatRatePct(c.conversionRate),
                ])}
              />
            </div>
          ))}
      </Loaded>
    </Panel>
  );
}

function ProtectionTab({ t, locale, range }: { t: Strings; locale: Locale; range: SiteDetailsRange }) {
  const { data, loading, error, refresh } = useAsync(() => api.getProtection(range), [range]);
  const kinds = ["bot", "rejected"] as const;
  const reason = (r: string) => t[`reason_${r}` as keyof Strings] ?? r;
  return (
    <Loaded t={t} loading={loading && !data} error={error} onRetry={() => void refresh()}>
      {data && (
        <div className="space-y-4">
          {!data.enabled && <Alert>{t.protectionOff}</Alert>}
          {range === "90d" && <Alert>{t.protectionRange}</Alert>}
          <div className="grid grid-cols-2 gap-4">
            {kinds.map((k) => (
              <KpiCard key={k} label={t[`kept_${k}`]} value={formatNumber(data.totals[k])} />
            ))}
          </div>
          <p className="text-sm text-ink-soft">
            {t.originMode}: {t.originAllowlist}
          </p>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Panel title={t.byReason}>
              <HBarList rows={data.byReason.map((r) => ({ label: `${t[`kept_${r.kind}` as keyof Strings] ?? r.kind} · ${reason(r.reason)}`, value: r.count }))} format={(v) => formatNumber(v)} />
            </Panel>
            <Panel title={t.bySource} description={t.bySourceHint}>
              <HBarList rows={data.bySource.map((r) => ({ label: r.label, value: r.count }))} format={(v) => formatNumber(v)} color="var(--color-accent)" />
            </Panel>
            <Panel title={t.byCountry}>
              <HBarList rows={data.byCountry.map((c) => ({ label: countryName(c.country, locale), value: c.bot + c.rejected }))} format={(v) => formatNumber(v)} />
            </Panel>
          </div>
        </div>
      )}
    </Loaded>
  );
}

/**
 * Live: the sessions of the last five minutes (api.getLive), read again every
 * 15 seconds while the tab shows — by polling, not the live updates: a ping
 * every 15 seconds per visitor is too many events to send. A row opens the
 * visit, as on Visits.
 */
function LiveTab({ t, locale, onOpen }: { t: Strings; locale: Locale; onOpen: (sessionId: string) => void }) {
  const { data, loading, error, refresh } = useAsync(() => api.getLive(), []);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh({ silent: true });
    }, api.SITE_LIVE_POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);
  const ctaLabel = (kind: string) => t[`cta_${kind}` as keyof Strings] ?? kind;

  return (
    <Loaded t={t} loading={loading && !data} error={error} onRetry={() => void refresh()}>
      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <KpiCard label={t.activeNow} value={formatNumber(data.active)} hint={fmt(t.activeHint, { seconds: data.activeSeconds })} />
            <KpiCard label={t.inWindow} value={formatNumber(data.visitors.length)} hint={t.sessionsCol} />
          </div>
          <Panel title={t.liveTitle} description={t.liveHint} flush>
            {data.visitors.length === 0 ? (
              <div className="p-4">
                <EmptyBlock message={t.liveNone} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <Th>{t.lastSeen}</Th>
                      <Th>{t.place}</Th>
                      <Th>{t.source}</Th>
                      <Th>{t.systemCol}</Th>
                      <Th>{t.currentPage}</Th>
                      <Th>{t.lastCta}</Th>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.visitors.map((v) => (
                      <TableRow key={v.sessionId} className="cursor-pointer" onClick={() => onOpen(v.sessionId)}>
                        <Td>
                          <div className="flex flex-col items-start gap-1">
                            <Badge variant={v.active ? "default" : "secondary"}>{v.active ? t.activeBadge : t.idleBadge}</Badge>
                            <span className="text-xs text-ink-soft" title={formatDateTime(v.lastSeenAt)}>
                              {formatRelative(v.lastSeenAt)}
                            </span>
                          </div>
                        </Td>
                        <Td>
                          <div className="flex flex-col">
                            <span>{countryName(v.country, locale)}</span>
                            {v.governorate && <span className="text-xs text-ink-soft">{governorateName(v.governorate, locale)}</span>}
                          </div>
                        </Td>
                        <Td>
                          {sourceLabel(t, v.source)}
                          {(v.utmMedium || v.utmCampaign) && (
                            <span className="block text-xs text-ink-soft">{[v.utmMedium, v.utmCampaign].filter(Boolean).join(" / ")}</span>
                          )}
                        </Td>
                        <Td>
                          {deviceLabel(t, v.device)}
                          {(v.browser || v.os) && <span className="block text-xs text-ink-soft">{[v.browser, v.os].filter(Boolean).join(" · ")}</span>}
                        </Td>
                        <Td>{v.currentPath ? <Mono>{v.currentPath}</Mono> : "—"}</Td>
                        <Td>
                          {v.lastCta ? (
                            <div className="flex flex-col">
                              <span>{ctaLabel(v.lastCta.kind)}</span>
                              <span className="text-xs text-ink-soft">{formatRelative(v.lastCta.at)}</span>
                            </div>
                          ) : (
                            <span className="text-ink-soft">—</span>
                          )}
                        </Td>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Panel>
        </div>
      )}
    </Loaded>
  );
}
