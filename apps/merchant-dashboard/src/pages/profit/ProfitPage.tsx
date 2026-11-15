import { useState } from "react";
import { Link } from "react-router-dom";
import { Coins, Receipt, TrendingUp } from "lucide-react";
import { Alert } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/Section";
import { KpiCard } from "@/components/KpiCard";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { BarChart } from "@/components/charts";
import { RangeSwitch } from "@/components/RangeSwitch";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatMoney, formatPercentValue } from "@/lib/format";
import {
  deltaBasisPoints,
  formatAxisDate,
  formatCount,
  percentToRatio,
  useAnalyticsSummary,
  type AnalyticsRange,
} from "@/lib/analytics";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Profit",
    description:
      "What's left on the orders that actually reached the customer: item revenue, minus discounts, product cost and refunds. Orders still in transit aren't counted.",
    grossProfit: "Gross profit",
    margin: "Gross margin",
    marginHint: "Gross profit ÷ delivered item revenue",
    itemsRevenue: "Delivered item revenue",
    itemsRevenueHint: "What customers paid for the items themselves",
    discounts: "Discounts given",
    productCost: "Product cost",
    productCostHint: "From the cost price stored on each product",
    refunds: "Refunds",
    shippingCharged: "Shipping charged",
    shippingHint: "What customers paid for delivery — the courier's own bill isn't known here",
    coverageWarning:
      "Only {pct} of the delivered units have a cost price, so the product cost and the profit below are incomplete.",
    coverageUnknown:
      "None of the delivered units have a cost price yet, so the profit below is really just revenue minus discounts and refunds.",
    goToCatalog: "Add cost prices",
    breakdownTitle: "How the profit is worked out",
    breakdownDesc: "Every line comes from the delivered orders in this range.",
    dailyTitle: "Orders delivered per day",
    dailyDesc: "Profit is counted on the day an order was placed, so this is the volume behind it.",
    ordersCount: "{n} orders",
    noDelivered: "Nothing delivered in this range yet",
    noDeliveredDesc:
      "Profit is only counted once an order reaches the customer, so this fills in as deliveries land.",
    seeAnalytics: "Revenue, orders and delivery rates are on the Analytics screen.",
    analyticsLink: "Open Analytics",
  },
  ar: {
    title: "الأرباح",
    description:
      "اللي بيفضل من الطلبات اللي وصلت للعميل فعلاً: تمن المنتجات ناقص الخصومات وتكلفة المنتجات والمرتجع. الطلبات اللي لسه في الطريق مش محسوبة.",
    grossProfit: "إجمالي الربح",
    margin: "هامش الربح",
    marginHint: "إجمالي الربح ÷ تمن المنتجات اللي اتسلّمت",
    itemsRevenue: "تمن المنتجات اللي اتسلّمت",
    itemsRevenueHint: "اللي العملاء دفعوه في المنتجات نفسها",
    discounts: "الخصومات",
    productCost: "تكلفة المنتجات",
    productCostHint: "من سعر التكلفة المسجّل على كل منتج",
    refunds: "المرتجع",
    shippingCharged: "الشحن المحصّل",
    shippingHint: "اللي العملاء دفعوه شحن — فاتورة شركة الشحن نفسها مش معروفة هنا",
    coverageWarning:
      "{pct} بس من القطع اللي اتسلّمت ليها سعر تكلفة، يعني تكلفة المنتجات والربح تحت ناقصين.",
    coverageUnknown:
      "مفيش ولا قطعة من اللي اتسلّمت ليها سعر تكلفة، يعني الربح تحت ده في الحقيقة مبيعات ناقص خصومات ومرتجع بس.",
    goToCatalog: "ضيف أسعار التكلفة",
    breakdownTitle: "إزاي بنحسب الربح",
    breakdownDesc: "كل سطر جاي من الطلبات اللي اتسلّمت في الفترة دي.",
    dailyTitle: "الطلبات اللي اتسلّمت كل يوم",
    dailyDesc: "الربح بيتحسب على يوم الطلب، فده حجم الشغل اللي وراه.",
    ordersCount: "{n} طلب",
    noDelivered: "مفيش حاجة اتسلّمت في الفترة دي",
    noDeliveredDesc: "الربح بيتحسب بس أول ما الطلب يوصل للعميل، فهيتملى مع كل تسليم.",
    seeAnalytics: "المبيعات والطلبات ونسب التوصيل موجودة في صفحة التحليلات.",
    analyticsLink: "افتح التحليلات",
  },
} satisfies Messages;

export function ProfitPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const summary = useAnalyticsSummary(workspaceId, range);

  const current = summary.data?.current ?? null;
  const previous = summary.data?.previous ?? null;
  const currency = current?.currency ?? "EGP";
  const money = (value: number) => <bdi dir="ltr">{formatMoney(value, currency)}</bdi>;

  const profit = current?.profit;
  const margin =
    profit && profit.deliveredItemsRevenue > 0
      ? profit.grossProfit / profit.deliveredItemsRevenue
      : null;
  const hasDelivered = Boolean(current && current.orders.delivered > 0);
  const partialCost = profit && (profit.costCoverage === null || profit.costCoverage < 100);

  return (
    <div className="min-w-0 max-w-6xl">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={<RangeSwitch value={range} onChange={setRange} />}
      />

      <DataState
        loading={summary.loading && !current}
        error={summary.error}
        onRetry={() => summary.refresh()}
      >
        {current && profit && (
          <div className="space-y-6">
            {/* `packages/ui` has no warning variant; amber is the accent token. */}
            {hasDelivered && partialCost && (
              <Alert
                variant="info"
                className="border-accent/40 bg-accent-soft text-sm text-accent-dark dark:text-accent"
              >
                <p>
                  {profit.costCoverage === null || profit.costCoverage === 0
                    ? t.coverageUnknown
                    : fmt(t.coverageWarning, {
                        pct: formatPercentValue(percentToRatio(profit.costCoverage)),
                      })}{" "}
                  <Link to="/catalog" className="font-medium underline">
                    {t.goToCatalog}
                  </Link>
                </p>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <KpiCard
                label={t.grossProfit}
                value={money(profit.grossProfit)}
                deltaBasisPoints={deltaBasisPoints(
                  profit.grossProfit,
                  previous?.profit.grossProfit
                )}
                icon={<TrendingUp />}
              />
              <KpiCard
                label={t.margin}
                value={<bdi dir="ltr">{formatPercentValue(margin)}</bdi>}
                hint={t.marginHint}
              />
              <KpiCard
                label={t.productCost}
                value={money(profit.productCost)}
                hint={t.productCostHint}
                icon={<Coins />}
              />
              <KpiCard
                label={t.itemsRevenue}
                value={money(profit.deliveredItemsRevenue)}
                hint={t.itemsRevenueHint}
                deltaBasisPoints={deltaBasisPoints(
                  profit.deliveredItemsRevenue,
                  previous?.profit.deliveredItemsRevenue
                )}
              />
              <KpiCard label={t.discounts} value={money(profit.discounts)} />
              <KpiCard
                label={t.shippingCharged}
                value={money(current.revenue.shippingCharged)}
                hint={t.shippingHint}
                icon={<Receipt />}
              />
            </div>

            {hasDelivered ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <Section title={t.breakdownTitle} description={t.breakdownDesc}>
                  <dl className="divide-y divide-line text-sm">
                    {[
                      { label: t.itemsRevenue, value: profit.deliveredItemsRevenue, sign: "" },
                      { label: t.discounts, value: profit.discounts, sign: "−" },
                      { label: t.productCost, value: profit.productCost, sign: "−" },
                      { label: t.refunds, value: profit.refunded, sign: "−" },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between gap-3 py-2">
                        <dt className="text-ink-soft">{row.label}</dt>
                        <dd className="tabular-nums text-ink">
                          <bdi dir="ltr">
                            {row.sign}
                            {formatMoney(row.value, currency)}
                          </bdi>
                        </dd>
                      </div>
                    ))}
                    <div className="flex items-center justify-between gap-3 py-2 font-semibold">
                      <dt className="text-ink">{t.grossProfit}</dt>
                      <dd
                        className={
                          profit.grossProfit < 0
                            ? "tabular-nums text-danger"
                            : "tabular-nums text-success"
                        }
                      >
                        {money(profit.grossProfit)}
                      </dd>
                    </div>
                  </dl>
                </Section>

                <Section title={t.dailyTitle} description={t.dailyDesc}>
                  <div dir="ltr">
                    <BarChart
                      summary={t.dailyDesc}
                      color="var(--color-success)"
                      points={current.series.map((day) => ({
                        label: formatAxisDate(day.date),
                        value: day.delivered,
                      }))}
                      format={(value) => fmt(t.ordersCount, { n: formatCount(value) })}
                    />
                  </div>
                </Section>
              </div>
            ) : (
              <EmptyState
                icon={<TrendingUp />}
                title={t.noDelivered}
                description={t.noDeliveredDesc}
              />
            )}

            <p className="text-xs text-ink-soft">
              {t.seeAnalytics}{" "}
              <Link to="/analytics" className="font-medium text-primary hover:underline">
                {t.analyticsLink}
              </Link>
            </p>
          </div>
        )}
      </DataState>
    </div>
  );
}
