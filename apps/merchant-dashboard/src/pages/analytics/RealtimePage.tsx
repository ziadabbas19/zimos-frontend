import { useState, type ReactNode, useRef } from "react";
import { Link } from "react-router-dom";
import { Activity, Eye, Globe, MousePointerClick, Users } from "lucide-react";
import { Card, cn } from "@store-builder/ui";
import type { WebAnalyticsRealtimeActivity } from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { BarChart } from "@/components/charts";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useVisibleInterval } from "@/lib/useVisibleInterval";
import { LivePanel, useLiveView } from "./LiveView";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatCount } from "@/lib/analytics";
import { countryName, flagOf } from "@/lib/webAnalytics";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Realtime",
    description: "The last 30 minutes, refreshed every 10 seconds.",
    back: "Web analytics",
    active: "Active now",
    activeHint: "Visitors in the last 5 minutes",
    views: "Views",
    visitors: "Visitors",
    events: "Events",
    countries: "Countries",
    minute: "Views per minute",
    activity: "Activity",
    all: "All",
    onlyViews: "Views",
    onlyEvents: "Events",
    searchPlaceholder: "Filter by page, event or referrer",
    paths: "Pages",
    referrers: "Referrers",
    countriesTitle: "Countries",
    empty: "Nothing yet — the log fills as visitors arrive.",
    direct: "Direct",
    viewed: "viewed {path}",
    fired: "fired {event}",
    ago: "{s}s ago",
    agoMin: "{m}m ago",
  },
  ar: {
    title: "مباشر الآن",
    description: "آخر 30 دقيقة، ويُحدَّث كل 10 ثوانٍ.",
    back: "زيارات الموقع",
    active: "المتصفحون الآن",
    activeHint: "الزوار خلال آخر 5 دقائق",
    views: "المشاهدات",
    visitors: "الزوار",
    events: "الأحداث",
    countries: "الدول",
    minute: "المشاهدات في الدقيقة",
    activity: "النشاط",
    all: "الكل",
    onlyViews: "المشاهدات",
    onlyEvents: "الأحداث",
    searchPlaceholder: "تصفية حسب الصفحة أو الحدث أو الموقع المُحيل",
    paths: "الصفحات",
    referrers: "المواقع المُحيلة",
    countriesTitle: "الدول",
    empty: "لا يوجد نشاط بعد — يمتلئ السجل مع وصول الزوار.",
    direct: "مباشر",
    viewed: "شاهد {path}",
    fired: "نفّذ {event}",
    ago: "قبل {s} ث",
    agoMin: "قبل {m} د",
  },
} satisfies Messages;

function Tile({ icon, label, value, hint }: { icon: ReactNode; label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="gap-0 p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-ink-soft">
        <span className="[&>svg]:size-4">{icon}</span>
        {label}
      </div>
      <p className="tabular-nums mt-1 text-2xl font-semibold text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-soft">{hint}</p>}
    </Card>
  );
}

function List({ title, rows, render }: { title: string; rows: Array<{ x: string; y: number }>; render?: (x: string) => ReactNode }) {
  const max = Math.max(1, ...rows.map((r) => r.y));
  return (
    <Card className="gap-0 p-4">
      <h2 className="mb-3 text-sm font-semibold text-ink">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-soft">—</p>
      ) : (
        <ul className="space-y-0.5">
          {rows.slice(0, 10).map((r) => (
            <li key={r.x} className="relative flex items-center gap-3 rounded px-2 py-1.5">
              <div className="absolute inset-y-0.5 start-0 rounded bg-primary/10" style={{ width: `${Math.round((r.y / max) * 100)}%` }} aria-hidden />
              <span className="relative min-w-0 flex-1 truncate text-sm text-ink" dir="auto">
                {render ? render(r.x) : r.x || "—"}
              </span>
              <span className="tabular-nums relative text-sm font-medium text-ink">{formatCount(r.y)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function RealtimePage() {
  const t = useT(STRINGS);
  const { intlLocale } = useLocale();
  const workspaceId = useWorkspaceId();
  const [tick, setTick] = useState(0);
  const [kind, setKind] = useState<"all" | "pageview" | "event">("all");
  const [query, setQuery] = useState("");

  // The server pushes a snapshot whenever something changes (LiveView.tsx);
  // the ten-second poll below only runs while that stream is not connected.
  const [funnelId, setFunnelId] = useState("");
  const live = useLiveView(workspaceId, funnelId);
  const frame = useRef<HTMLDivElement>(null);

  // Not while the tab is hidden; once on coming back.
  useVisibleInterval(() => setTick((n) => n + 1), 10_000, !live.connected);

  const data = useAsync(() => apiClient.getWebAnalyticsRealtime(workspaceId), [workspaceId, tick]);
  const d = live.snapshot?.realtime ?? data.data;

  const q = query.trim().toLowerCase();
  const activity = (d?.activity ?? []).filter(
    (a) =>
      (kind === "all" || a.type === kind) &&
      (!q || [a.urlPath, a.eventName, a.referrerDomain, a.browser, a.country].some((v) => v?.toLowerCase().includes(q)))
  );

  // Measured from the moment the server took this snapshot (it refreshes
  // every 10 seconds), not from the clock at render time.
  const snapshotAt = d?.timestamp ? new Date(d.timestamp).getTime() : null;
  const ago = (iso: string) => {
    const at = new Date(iso).getTime();
    const s = Math.max(0, Math.round(((snapshotAt ?? at) - at) / 1000));
    return s < 60 ? fmt(t.ago, { s }) : fmt(t.agoMin, { m: Math.floor(s / 60) });
  };
  const describe = (a: WebAnalyticsRealtimeActivity) =>
    a.type === "event" ? fmt(t.fired, { event: a.eventName ?? "" }) : fmt(t.viewed, { path: a.urlPath ?? "/" });

  return (
    <div ref={frame} className="min-w-0 max-w-7xl bg-paper [&:fullscreen]:max-w-none [&:fullscreen]:overflow-y-auto [&:fullscreen]:p-6">
      <PageHeader back={{ to: "/analytics/web", label: t.back }} title={t.title} description={t.description} />

      <div className="mb-4">
        <LivePanel
          workspaceId={workspaceId}
          live={live.snapshot?.live ?? null}
          connected={live.connected}
          funnelId={funnelId}
          onFunnelChange={setFunnelId}
          fullscreenTarget={frame}
        />
      </div>

      <DataState loading={data.loading && !d} error={data.error} onRetry={() => data.refresh()}>
        {d && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <Tile icon={<Activity />} label={t.active} value={<bdi dir="ltr">{formatCount(d.activeVisitors)}</bdi>} hint={t.activeHint} />
              <Tile icon={<Eye />} label={t.views} value={<bdi dir="ltr">{formatCount(d.totals.views)}</bdi>} />
              <Tile icon={<Users />} label={t.visitors} value={<bdi dir="ltr">{formatCount(d.totals.visitors)}</bdi>} />
              <Tile icon={<MousePointerClick />} label={t.events} value={<bdi dir="ltr">{formatCount(d.totals.events)}</bdi>} />
              <Tile icon={<Globe />} label={t.countries} value={<bdi dir="ltr">{formatCount(d.totals.countries)}</bdi>} />
            </div>

            <Card className="gap-0 p-4">
              <h2 className="mb-3 text-sm font-semibold text-ink">{t.minute}</h2>
              <div dir="ltr">
                <BarChart
                  summary={t.minute}
                  height={140}
                  points={d.series.map((p) => ({
                    label: new Intl.DateTimeFormat(intlLocale, { hour: "numeric", minute: "2-digit" }).format(new Date(p.t)),
                    value: p.pageviews,
                  }))}
                  format={(v) => formatCount(v)}
                />
              </div>
            </Card>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="gap-0 p-4 lg:col-span-2">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h2 className="me-auto text-sm font-semibold text-ink">{t.activity}</h2>
                  {(["all", "pageview", "event"] as const).map((k) => (
                    <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k} className={cn("cursor-pointer rounded-md px-2 py-1 text-xs font-medium", kind === k ? "bg-paper text-ink" : "text-ink-soft hover:text-ink")}>
                      {{ all: t.all, pageview: t.onlyViews, event: t.onlyEvents }[k]}
                    </button>
                  ))}
                  <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.searchPlaceholder} className="h-8 w-56 rounded-md border border-line bg-paper-raised px-2 text-xs text-ink placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                {activity.length === 0 ? (
                  <p className="py-6 text-center text-sm text-ink-soft">{t.empty}</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {activity.map((a, i) => (
                      <li key={`${a.sessionId}-${a.createdAt}-${i}`} className="flex items-center gap-3 py-2 text-sm">
                        <span className={cn("rounded-md p-1.5 [&>svg]:size-3.5", a.type === "event" ? "bg-accent-soft text-accent-dark" : "bg-primary-soft text-primary-dark dark:text-primary")}>
                          {a.type === "event" ? <MousePointerClick /> : <Eye />}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-ink" dir="auto">
                          {describe(a)}
                        </span>
                        <span className="hidden shrink-0 text-xs text-ink-soft sm:inline" dir="ltr">
                          {[a.browser, a.os, a.device].filter(Boolean).join(" · ")}
                        </span>
                        {a.country && (
                          <span className="shrink-0 text-xs" title={countryName(a.country, intlLocale)} aria-label={countryName(a.country, intlLocale)}>
                            {flagOf(a.country)}
                          </span>
                        )}
                        <span className="tabular-nums shrink-0 text-xs text-ink-soft">{ago(a.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <div className="space-y-4">
                <List title={t.paths} rows={d.urls} />
                <List title={t.referrers} rows={d.referrers} render={(x) => (x ? x : t.direct)} />
                <List title={t.countriesTitle} rows={d.countries} render={(x) => `${flagOf(x)} ${countryName(x, intlLocale)}`} />
              </div>
            </div>
            <p className="text-xs text-ink-soft">
              <Link to="/analytics/web" className="text-primary hover:underline">
                {t.back}
              </Link>
            </p>
          </div>
        )}
      </DataState>
    </div>
  );
}
