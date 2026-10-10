import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Target } from "lucide-react";
import { Button, Input, cn } from "@store-builder/ui";
import {
  funnelsList,
  insightsGetAttribution,
  type InsightsAttribution,
  type InsightsAttributionGroup,
  type InsightsAttributionRow,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatMoney, formatPercentValue } from "@/lib/format";
import { formatAxisDate, formatCount, formatWindow, percentToRatio, rangeWindows, type AnalyticsRange } from "@/lib/analytics";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { FilterTabs } from "@/components/FilterTabs";
import { RangeSwitch } from "@/components/RangeSwitch";
import { Section } from "@/components/Section";
import { Select } from "@/components/Select";
import { BarChart, LineAreaChart } from "@/components/charts";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Sales attribution",
    description: "Which sources, campaigns and ads bring visitors that actually buy — and whose orders actually get delivered.",
    allStore: "Whole store",
    funnelFilter: "Store or funnel",
    source: "Source",
    medium: "Medium",
    campaign: "Campaign",
    content: "Ad content",
    filterSource: "utm_source",
    filterCampaign: "utm_campaign",
    apply: "Apply",
    clear: "Clear",
    visitorsChart: "Visitors per day",
    salesChart: "Sales per day",
    chartSummary: "{what} for {window}",
    tableTitle: "By {dimension}",
    tableDesc: "Each order counts once, for the touch you pick: the last ad or link before buying, or the first that brought the shopper.",
    touchLabel: "Credit the sale to",
    touchLast: "Last touch",
    touchFirst: "First touch",
    visitors: "Visitors",
    orders: "Orders",
    sales: "Sales",
    conversion: "Conversion",
    aov: "AOV",
    delivered: "Delivered",
    deliveredSales: "Delivered sales",
    spend: "Ad spend",
    roas: "Real ROAS",
    cpa: "Cost per delivered",
    total: "Total",
    untracked: "No UTM (direct, phone, manual)",
    emptyTitle: "No visits or orders in this period",
    emptyDesc: "Add UTM parameters to your ad links — the link builder in Marketing writes them for you — and the sources show up here.",
    openMarketing: "Open the link builder",
    spendHint: "Record ad spend on the Ad spend page to see spend and real ROAS here.",
    addSpend: "Add ad spend",
  },
  ar: {
    title: "مصادر المبيعات",
    description: "أي المصادر والحملات والإعلانات تجلب زوارًا يشترون فعلًا — وأي الطلبات تُسلَّم فعلًا.",
    allStore: "المتجر كله",
    funnelFilter: "المتجر أو مسار البيع",
    source: "المصدر",
    medium: "الوسيط",
    campaign: "الحملة",
    content: "محتوى الإعلان",
    filterSource: "utm_source",
    filterCampaign: "utm_campaign",
    apply: "تطبيق",
    clear: "مسح",
    visitorsChart: "الزوار يوميًا",
    salesChart: "المبيعات يوميًا",
    chartSummary: "{what} خلال {window}",
    tableTitle: "حسب {dimension}",
    tableDesc: "يُحتسب كل طلب مرة واحدة حسب ما تختاره: آخر إعلان أو رابط قبل الشراء، أو أول ما جاء بالعميل.",
    touchLabel: "نسب البيع إلى",
    touchLast: "آخر نقطة تواصل",
    touchFirst: "أول نقطة تواصل",
    visitors: "الزوار",
    orders: "الطلبات",
    sales: "المبيعات",
    conversion: "التحويل",
    aov: "متوسط الطلب",
    delivered: "المسلَّم",
    deliveredSales: "مبيعات مسلَّمة",
    spend: "الإنفاق الإعلاني",
    roas: "العائد الحقيقي",
    cpa: "تكلفة الطلب المسلَّم",
    total: "الإجمالي",
    untracked: "بدون UTM (مباشر، هاتف، يدوي)",
    emptyTitle: "لا توجد زيارات أو طلبات في هذه الفترة",
    emptyDesc: "أضف معاملات UTM إلى روابط إعلاناتك — منشئ الروابط في صفحة التسويق يكتبها لك — وستظهر المصادر هنا.",
    openMarketing: "افتح منشئ الروابط",
    spendHint: "سجّل الإنفاق الإعلاني من صفحة الإنفاق الإعلاني ليظهر هنا الإنفاق والعائد الحقيقي.",
    addSpend: "أضف إنفاقًا إعلانيًا",
  },
} satisfies Messages;

const GROUPS: InsightsAttributionGroup[] = ["source", "medium", "campaign", "content"];

/**
 * Sales attribution (SPEC §15.3): visitors and sales per day, and a table per
 * UTM value with the delivered column a COD merchant needs, plus spend and
 * real ROAS once ad spend is recorded.
 */
export function AttributionPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const [groupBy, setGroupBy] = useState<InsightsAttributionGroup>("source");
  const [funnelId, setFunnelId] = useState("");
  const [touch, setTouch] = useState<"last" | "first">("last");
  const [draft, setDraft] = useState({ source: "", campaign: "" });
  const [filters, setFilters] = useState({ source: "", campaign: "" });

  const funnels = useAsync(() => funnelsList(apiClient, workspaceId).catch(() => []), [workspaceId]);
  const report = useAsync<InsightsAttribution>(
    () =>
      insightsGetAttribution(apiClient, workspaceId, {
        ...rangeWindows(range).current,
        groupBy,
        touch,
        funnelId: funnelId || undefined,
        utm_source: filters.source || undefined,
        utm_campaign: filters.campaign || undefined,
      }),
    [workspaceId, range, groupBy, touch, funnelId, filters.source, filters.campaign]
  );
  const data = report.data;
  const currency = data?.currency ?? "EGP";
  const money = (v: number | null) => (v === null ? "—" : formatMoney(v, currency));
  const hasSpend = Boolean(data && data.totals.spend !== null);
  const filtered = Boolean(filters.source || filters.campaign);

  const columns = useMemo<Column<InsightsAttributionRow>[]>(() => {
    const num = (v: number) => <bdi dir="ltr">{formatCount(v)}</bdi>;
    const cols: Column<InsightsAttributionRow>[] = [
      {
        key: "key",
        header: t[groupBy],
        cell: (r) => (
          <span className={cn("font-medium text-ink", !r.key && "font-normal text-ink-soft")} dir="auto">
            {r.key || t.untracked}
          </span>
        ),
      },
      { key: "visitors", header: t.visitors, align: "end", cell: (r) => num(r.visitors) },
      { key: "orders", header: t.orders, align: "end", cell: (r) => num(r.orders) },
      { key: "sales", header: t.sales, align: "end", cell: (r) => <bdi dir="ltr">{money(r.sales)}</bdi> },
      {
        key: "conversion",
        header: t.conversion,
        align: "end",
        cell: (r) => <bdi dir="ltr">{formatPercentValue(percentToRatio(r.conversionRate))}</bdi>,
      },
      { key: "aov", header: t.aov, align: "end", cell: (r) => <bdi dir="ltr">{money(r.averageOrderValue)}</bdi> },
      { key: "delivered", header: t.delivered, align: "end", cell: (r) => num(r.delivered) },
      {
        key: "deliveredSales",
        header: t.deliveredSales,
        align: "end",
        cell: (r) => <bdi dir="ltr" className="font-medium text-ink">{money(r.deliveredSales)}</bdi>,
      },
    ];
    if (hasSpend) {
      cols.push(
        { key: "spend", header: t.spend, align: "end", cell: (r) => <bdi dir="ltr">{money(r.spend)}</bdi> },
        {
          key: "roas",
          header: t.roas,
          align: "end",
          cell: (r) => (
            <bdi dir="ltr" className={cn(r.roas !== null && (r.roas >= 1 ? "text-success" : "text-danger"))}>
              {r.roas === null ? "—" : `${r.roas.toFixed(2)}×`}
            </bdi>
          ),
        },
        { key: "cpa", header: t.cpa, align: "end", cell: (r) => <bdi dir="ltr">{money(r.costPerDelivered)}</bdi> }
      );
    }
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, groupBy, hasSpend, currency]);

  const window = data ? formatWindow(data.range.from, data.range.to) : "";
  const isEmpty = Boolean(data && data.totals.visitors === 0 && data.totals.orders === 0);

  return (
    <div className="min-w-0">
      <PageHeader title={t.title} description={t.description} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <RangeSwitch value={range} onChange={setRange} />
        <Select
          aria-label={t.touchLabel}
          value={touch}
          onChange={(e) => setTouch(e.target.value === "first" ? "first" : "last")}
          className="h-9 w-auto max-w-[14rem] font-medium"
        >
          <option value="last">{t.touchLast}</option>
          <option value="first">{t.touchFirst}</option>
        </Select>
        {(funnels.data?.length ?? 0) > 0 && (
          <Select
            aria-label={t.funnelFilter}
            value={funnelId}
            onChange={(e) => setFunnelId(e.target.value)}
            className="h-9 w-auto max-w-[14rem] font-medium"
          >
            <option value="">{t.allStore}</option>
            {funnels.data?.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        )}
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setFilters({ source: draft.source.trim(), campaign: draft.campaign.trim() });
          }}
        >
          <Input
            aria-label={t.filterSource}
            placeholder={t.filterSource}
            dir="ltr"
            value={draft.source}
            onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))}
            className="h-9 w-36"
          />
          <Input
            aria-label={t.filterCampaign}
            placeholder={t.filterCampaign}
            dir="ltr"
            value={draft.campaign}
            onChange={(e) => setDraft((d) => ({ ...d, campaign: e.target.value }))}
            className="h-9 w-40"
          />
          <Button type="submit" size="sm" variant="outline">
            {t.apply}
          </Button>
          {filtered && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft({ source: "", campaign: "" });
                setFilters({ source: "", campaign: "" });
              }}
            >
              {t.clear}
            </Button>
          )}
        </form>
      </div>

      <DataState loading={report.loading && !data} error={report.error} onRetry={() => void report.refresh()}>
        {data && isEmpty && !filtered ? (
          <EmptyState
            icon={<Target />}
            title={t.emptyTitle}
            description={t.emptyDesc}
            action={
              <Button asChild variant="outline">
                <Link to="/marketing">{t.openMarketing}</Link>
              </Button>
            }
          />
        ) : data ? (
          <div className={cn("space-y-4 transition-opacity", report.loading && "opacity-60")}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Section title={t.visitorsChart} description={formatCount(data.totals.visitors)}>
                <div dir="ltr">
                  <BarChart
                    points={data.series.map((d) => ({ label: formatAxisDate(d.date), value: d.visitors }))}
                    format={formatCount}
                    summary={fmt(t.chartSummary, { what: t.visitorsChart, window })}
                  />
                </div>
              </Section>
              <Section title={t.salesChart} description={money(data.totals.sales)}>
                <div dir="ltr">
                  <LineAreaChart
                    points={data.series.map((d) => ({ label: formatAxisDate(d.date), value: d.sales }))}
                    format={(v) => money(v)}
                    summary={fmt(t.chartSummary, { what: t.salesChart, window })}
                  />
                </div>
              </Section>
            </div>

            <Section
              title={fmt(t.tableTitle, { dimension: t[groupBy] })}
              description={t.tableDesc}
              flush
              actions={
                <FilterTabs
                  value={groupBy}
                  onChange={setGroupBy}
                  label={t.title}
                  tabs={GROUPS.map((g) => ({ value: g, label: t[g] }))}
                />
              }
            >
              <DataTable
                phoneCards={false}
                columns={columns}
                rows={data.rows}
                rowKey={(r) => r.key || "__none"}
                minWidth={hasSpend ? "72rem" : "56rem"}
                footer={
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm">
                    <span className="text-ink-soft">
                      {t.total}:{" "}
                      <bdi dir="ltr" className="font-medium text-ink">
                        {formatCount(data.totals.orders)}
                      </bdi>{" "}
                      {t.orders} · <bdi dir="ltr" className="font-medium text-ink">{money(data.totals.sales)}</bdi> ·{" "}
                      {t.deliveredSales}{" "}
                      <bdi dir="ltr" className="font-medium text-ink">{money(data.totals.deliveredSales)}</bdi>
                      {data.totals.roas !== null && (
                        <>
                          {" "}
                          · {t.roas} <bdi dir="ltr" className="font-medium text-ink">{data.totals.roas.toFixed(2)}×</bdi>
                        </>
                      )}
                    </span>
                    {!hasSpend && (
                      <span className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                        {t.spendHint}
                        <Link to="/ads" className="font-medium text-primary hover:underline">
                          {t.addSpend}
                        </Link>
                      </span>
                    )}
                  </div>
                }
              />
            </Section>
          </div>
        ) : null}
      </DataState>
    </div>
  );
}
