import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, Megaphone, Percent, PiggyBank, SlidersHorizontal, Target } from "lucide-react";
import { Alert, Button, cn } from "@store-builder/ui";
import { profitGetPnl, type ProfitGroupBy, type ProfitPnl, type ProfitRow, type ProfitStatement } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatMoney, formatPercentValue } from "@/lib/format";
import { formatAxisDate, formatCount, percentToRatio, rangeWindows, type AnalyticsRange } from "@/lib/analytics";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { FilterTabs } from "@/components/FilterTabs";
import { KpiCard } from "@/components/KpiCard";
import { RangeSwitch } from "@/components/RangeSwitch";
import { Section } from "@/components/Section";
import { BarChart } from "@/components/charts";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Real profit",
    description: "What is left after the product, both shipping legs, fees and ads — counted on delivered orders, not on placed ones.",
    costs: "Costs",
    adSpend: "Ad spend",
    actual: "Actual",
    projected: "Projected",
    versionLabel: "Profit version",
    actualHint: "Finished orders only: delivered or returned.",
    projectedHint: "Adds open orders, assuming {rate} of them get delivered (your delivery rate).",
    projectedNoHistory: "Adds open orders, assuming all of them get delivered — no delivery history yet.",
    netProfit: "Net profit",
    margin: "Profit margin",
    maxCpa: "Max affordable CPA",
    maxCpaHint: "Ad cost per placed order before you lose money",
    deliveryRate: "Delivery rate",
    deliveryHint: "{delivered} delivered · {returned} returned · {open} open",
    statement: "Profit statement",
    revenue: "Delivered revenue",
    costOfGoods: "Cost of goods (delivered)",
    shipping: "Outbound shipping (all shipped)",
    returnShipping: "Return shipping",
    fees: "Collection and gateway fees",
    adSpendLine: "Ad spend",
    zimosFees: "ZIMOS fees",
    perDay: "Net profit per day",
    chartSummary: "Net profit per day",
    byDay: "By day",
    byProduct: "By product",
    byCampaign: "By campaign",
    groupLabel: "Group the report",
    colDay: "Day",
    colProduct: "Product",
    colCampaign: "Campaign",
    colOrders: "Delivered / returned",
    colRevenue: "Revenue",
    colCosts: "Costs",
    colAds: "Ad spend",
    colNet: "Net profit",
    colMargin: "Margin",
    colMaxCpa: "Max CPA",
    noCampaign: "No campaign",
    noRows: "No finished orders in this period yet.",
    coverageNone: "None of the delivered items has a unit cost, so cost of goods is understated. Set costs on your product variants.",
    coveragePartial: "{rate} of delivered units have a unit cost; the rest count as zero cost.",
    noCostsSet: "Shipping, return and fee costs are all zero. Set them once on the Costs page to see your real profit.",
    setCosts: "Set costs",
    productAdsNote: "Ad spend can't be split per product, so it only appears in the total.",
  },
  ar: {
    title: "الأرباح الحقيقية",
    description: "ما يتبقى بعد المنتج والشحن ذهابًا وعودة والرسوم والإعلانات — محسوبًا على الطلبات المسلَّمة لا المسجَّلة.",
    costs: "التكاليف",
    adSpend: "الإنفاق الإعلاني",
    actual: "الفعلي",
    projected: "المتوقَّع",
    versionLabel: "نسخة الربح",
    actualHint: "الطلبات المنتهية فقط: المسلَّمة أو المرتجعة.",
    projectedHint: "يضيف الطلبات المفتوحة بافتراض تسليم {rate} منها (نسبة التسليم عندك).",
    projectedNoHistory: "يضيف الطلبات المفتوحة بافتراض تسليمها كلها — لا يوجد سجل تسليم بعد.",
    netProfit: "صافي الربح",
    margin: "هامش الربح",
    maxCpa: "أقصى تكلفة إعلان للطلب",
    maxCpaHint: "تكلفة الإعلان لكل طلب مسجَّل قبل أن تخسر",
    deliveryRate: "نسبة التسليم",
    deliveryHint: "{delivered} مسلَّم · {returned} مرتجع · {open} مفتوح",
    statement: "قائمة الأرباح",
    revenue: "إيراد الطلبات المسلَّمة",
    costOfGoods: "تكلفة البضاعة (المسلَّمة)",
    shipping: "شحن الذهاب (لكل ما شُحن)",
    returnShipping: "شحن المرتجعات",
    fees: "رسوم التحصيل وبوابات الدفع",
    adSpendLine: "الإنفاق الإعلاني",
    zimosFees: "رسوم ZIMOS",
    perDay: "صافي الربح يوميًا",
    chartSummary: "صافي الربح يوميًا",
    byDay: "حسب اليوم",
    byProduct: "حسب المنتج",
    byCampaign: "حسب الحملة",
    groupLabel: "تجميع التقرير",
    colDay: "اليوم",
    colProduct: "المنتج",
    colCampaign: "الحملة",
    colOrders: "مسلَّم / مرتجع",
    colRevenue: "الإيراد",
    colCosts: "التكاليف",
    colAds: "الإعلانات",
    colNet: "صافي الربح",
    colMargin: "الهامش",
    colMaxCpa: "أقصى تكلفة إعلان",
    noCampaign: "بدون حملة",
    noRows: "لا توجد طلبات منتهية في هذه الفترة بعد.",
    coverageNone: "لا توجد تكلفة وحدة لأي منتج مسلَّم، فتكلفة البضاعة أقل من الحقيقة. أضف التكلفة على أنواع منتجاتك.",
    coveragePartial: "{rate} من القطع المسلَّمة لها تكلفة وحدة؛ والباقي محسوب بتكلفة صفر.",
    noCostsSet: "تكاليف الشحن والمرتجعات والرسوم كلها صفر. حدّدها مرة واحدة من صفحة التكاليف لترى ربحك الحقيقي.",
    setCosts: "حدّد التكاليف",
    productAdsNote: "لا يمكن توزيع الإنفاق الإعلاني على المنتجات، فيظهر في الإجمالي فقط.",
  },
} satisfies Messages;

type Version = "actual" | "projected";
const GROUPS: ProfitGroupBy[] = ["day", "product", "campaign"];

/**
 * Real profit (SPEC §15.4): the statement from delivered revenue down to net
 * profit, actual or projected, and the same report per day, product or
 * campaign with the maximum affordable CPA.
 */
export function RealProfitPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const [groupBy, setGroupBy] = useState<ProfitGroupBy>("day");
  const [version, setVersion] = useState<Version>("actual");

  const report = useAsync<ProfitPnl>(
    () => profitGetPnl(apiClient, workspaceId, { ...rangeWindows(range).current, groupBy }),
    [workspaceId, range, groupBy]
  );
  const data = report.data;
  const currency = data?.currency ?? "EGP";
  const money = (v: number | null) => (v === null ? "—" : formatMoney(v, currency));
  const pct = (v: number | null) => formatPercentValue(percentToRatio(v));

  const columns = useMemo<Column<ProfitRow>[]>(() => {
    const s = (r: ProfitRow) => r[version];
    const costs = (x: ProfitStatement) => x.costOfGoods + x.shipping + x.returnShipping + x.fees + x.zimosFees;
    const label = groupBy === "day" ? t.colDay : groupBy === "product" ? t.colProduct : t.colCampaign;
    const cols: Column<ProfitRow>[] = [
      {
        key: "label",
        header: label,
        cell: (r) => (
          <span className={cn("font-medium text-ink", !r.key && "font-normal text-ink-soft")} dir="auto">
            {groupBy === "day" ? formatAxisDate(r.key) : r.label || r.key || t.noCampaign}
          </span>
        ),
      },
      {
        key: "orders",
        header: t.colOrders,
        align: "end",
        cell: (r) => (
          <bdi dir="ltr">
            {formatCount(Math.round(r.orders.delivered))} / {formatCount(Math.round(r.orders.returned))}
          </bdi>
        ),
      },
      { key: "revenue", header: t.colRevenue, align: "end", cell: (r) => <bdi dir="ltr">{money(s(r).revenue)}</bdi> },
      { key: "costs", header: t.colCosts, align: "end", cell: (r) => <bdi dir="ltr">{money(costs(s(r)))}</bdi> },
    ];
    if (groupBy !== "product") {
      cols.push({ key: "ads", header: t.colAds, align: "end", cell: (r) => <bdi dir="ltr">{money(s(r).adSpend)}</bdi> });
    }
    cols.push(
      {
        key: "net",
        header: t.colNet,
        align: "end",
        cell: (r) => (
          <bdi dir="ltr" className={cn("font-medium", s(r).netProfit < 0 ? "text-danger" : "text-ink")}>
            {money(s(r).netProfit)}
          </bdi>
        ),
      },
      { key: "margin", header: t.colMargin, align: "end", cell: (r) => <bdi dir="ltr">{pct(s(r).margin)}</bdi> }
    );
    if (groupBy !== "day") {
      cols.push({ key: "maxCpa", header: t.colMaxCpa, align: "end", cell: (r) => <bdi dir="ltr">{money(r.maxCpa)}</bdi> });
    }
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, groupBy, version, currency]);

  const totals = data?.totals;
  const statement = totals?.[version];
  const noCosts = Boolean(statement && statement.revenue > 0 && statement.shipping === 0 && statement.fees === 0);
  const finishedRows = data?.rows.filter((r) => groupBy === "day" || r.orders.delivered + r.orders.returned + r.orders.open > 0 || r.actual.adSpend > 0) ?? [];

  return (
    <div className="min-w-0 max-w-6xl">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/profit/costs">
                <SlidersHorizontal className="size-4" aria-hidden />
                {t.costs}
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/ads">
                <Megaphone className="size-4" aria-hidden />
                {t.adSpend}
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <RangeSwitch value={range} onChange={setRange} />
        <FilterTabs
          label={t.versionLabel}
          value={version}
          onChange={setVersion}
          tabs={[
            { value: "actual", label: t.actual },
            { value: "projected", label: t.projected },
          ]}
        />
      </div>

      <DataState loading={report.loading && !data} error={report.error} onRetry={() => void report.refresh()}>
        {data && totals && statement && (
          <div className={cn("space-y-4 transition-opacity", report.loading && "opacity-60")}>
            <p className="text-xs text-ink-soft">
              {version === "actual"
                ? t.actualHint
                : data.projectionDeliveryRate === null
                  ? t.projectedNoHistory
                  : fmt(t.projectedHint, { rate: pct(data.projectionDeliveryRate) })}
            </p>

            {noCosts && (
              <Alert variant="info" className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span>{t.noCostsSet}</span>
                <Button asChild size="sm" variant="outline">
                  <Link to="/profit/costs">{t.setCosts}</Link>
                </Button>
              </Alert>
            )}
            {totals.orders.delivered > 0 && data.costCoverage !== null && data.costCoverage < 100 && (
              <Alert variant="info" className="text-sm">
                {data.costCoverage === 0 ? t.coverageNone : fmt(t.coveragePartial, { rate: pct(data.costCoverage) })}
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard
                label={t.netProfit}
                value={
                  <bdi dir="ltr" className={statement.netProfit < 0 ? "text-danger" : undefined}>
                    {money(statement.netProfit)}
                  </bdi>
                }
                icon={<PiggyBank aria-hidden />}
              />
              <KpiCard label={t.margin} value={<bdi dir="ltr">{pct(statement.margin)}</bdi>} icon={<Percent aria-hidden />} />
              <KpiCard label={t.maxCpa} value={<bdi dir="ltr">{money(totals.maxCpa)}</bdi>} hint={t.maxCpaHint} icon={<Target aria-hidden />} />
              <KpiCard
                label={t.deliveryRate}
                value={<bdi dir="ltr">{pct(totals.deliveryRate)}</bdi>}
                hint={fmt(t.deliveryHint, {
                  delivered: formatCount(totals.orders.delivered),
                  returned: formatCount(totals.orders.returned),
                  open: formatCount(totals.orders.open),
                })}
                icon={<BadgeCheck aria-hidden />}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
              <Section title={t.statement} className="lg:col-span-2">
                <dl className="text-sm">
                  <StatementLine label={t.revenue} value={money(statement.revenue)} strong />
                  <StatementLine label={t.costOfGoods} value={money(-statement.costOfGoods)} />
                  <StatementLine label={t.shipping} value={money(-statement.shipping)} />
                  <StatementLine label={t.returnShipping} value={money(-statement.returnShipping)} />
                  <StatementLine label={t.fees} value={money(-statement.fees)} />
                  <StatementLine label={t.adSpendLine} value={money(-statement.adSpend)} />
                  <StatementLine label={t.zimosFees} value={money(-statement.zimosFees)} />
                  <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-line pt-3">
                    <dt className="font-semibold text-ink">{t.netProfit}</dt>
                    <dd
                      className={cn(
                        "tabular-nums text-lg font-semibold",
                        statement.netProfit < 0 ? "text-danger" : "text-success"
                      )}
                    >
                      <bdi dir="ltr">{money(statement.netProfit)}</bdi>
                    </dd>
                  </div>
                </dl>
              </Section>
              <Section title={t.perDay} className="lg:col-span-3">
                <ProfitByDay workspaceId={workspaceId} range={range} version={version} currency={currency} summary={t.chartSummary} />
              </Section>
            </div>

            <Section
              title={groupBy === "day" ? t.byDay : groupBy === "product" ? t.byProduct : t.byCampaign}
              description={groupBy === "product" ? t.productAdsNote : undefined}
              flush
              actions={
                <FilterTabs
                  label={t.groupLabel}
                  value={groupBy}
                  onChange={setGroupBy}
                  tabs={GROUPS.map((g) => ({
                    value: g,
                    label: g === "day" ? t.byDay : g === "product" ? t.byProduct : t.byCampaign,
                  }))}
                />
              }
            >
              <DataTable
                columns={columns}
                rows={groupBy === "day" ? [...finishedRows].reverse() : finishedRows}
                rowKey={(r) => r.key || "__none"}
                minWidth="52rem"
                empty={<p className="px-4 pb-4 text-sm text-ink-soft">{t.noRows}</p>}
              />
            </Section>
          </div>
        )}
      </DataState>
    </div>
  );
}

function StatementLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className={cn(strong ? "font-medium text-ink" : "text-ink-soft")}>{label}</dt>
      <dd className={cn("tabular-nums", strong ? "font-medium text-ink" : "text-ink")}>
        <bdi dir="ltr">{value}</bdi>
      </dd>
    </div>
  );
}

/** The per-day chart always needs the day grouping, whatever the table shows. */
function ProfitByDay({
  workspaceId,
  range,
  version,
  currency,
  summary,
}: {
  workspaceId: string;
  range: AnalyticsRange;
  version: Version;
  currency: string;
  summary: string;
}) {
  const days = useAsync(
    () => profitGetPnl(apiClient, workspaceId, { ...rangeWindows(range).current, groupBy: "day" }),
    [workspaceId, range]
  );
  if (!days.data) return <div className="h-[200px]" />;
  // Bars cannot go below the axis: losses are drawn as zero and named in the tooltip.
  return (
    <div dir="ltr">
      <BarChart
        points={days.data.rows.map((r) => ({ label: formatAxisDate(r.key), value: Math.max(0, r[version].netProfit) }))}
        format={(v) => formatMoney(v, currency)}
        summary={summary}
      />
    </div>
  );
}
