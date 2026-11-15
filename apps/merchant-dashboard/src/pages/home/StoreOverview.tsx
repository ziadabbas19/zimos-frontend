import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Card, cn } from "@store-builder/ui";
import {
  funnelsList,
  insightsGetOverview,
  type InsightsDay,
  type InsightsMetricKey,
  type InsightsOverview,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatMoney, formatPercentValue } from "@/lib/format";
import { deltaBasisPoints, formatCount, formatWindow, percentToRatio, rangeWindows, type AnalyticsRange } from "@/lib/analytics";
import { DataState } from "@/components/DataState";
import { RangeSwitch } from "@/components/RangeSwitch";
import { Section } from "@/components/Section";
import { Select } from "@/components/Select";
import { HBarList, Sparkline } from "@/components/charts";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    allStore: "Whole store",
    funnelFilter: "Store or funnel",
    currencyFilter: "Currency",
    vsPrevious: "vs previous period",
    visits: "Visits",
    orders: "Orders",
    sales: "Total sales",
    averageOrderValue: "Average order value",
    addToCart: "Added to cart",
    checkouts: "Checkout starts",
    crossSellAdds: "Cross-sell additions",
    newOrders: "New orders",
    lostOrders: "Lost orders",
    conversionRate: "Conversion rate",
    lostRate: "Lost rate",
    netProfit: "Net profit",
    newCustomers: "New customers",
    returningCustomers: "Returning customers",
    leads: "Leads",
    confirmationRate: "Confirmation rate",
    deliveryRate: "Delivery rate",
    hintOrders: "Test and unpaid online orders are left out",
    hintNewOrders: "Still waiting for someone to open them",
    hintLost: "Checkouts started and never finished",
    hintProfit: "Delivered orders, after product cost and refunds",
    hintConfirmation: "Confirmed ÷ cash-on-delivery orders",
    hintDelivery: "Delivered ÷ handed to the courier",
    hintLeads: "From sign-up and newsletter forms",
    funnelTitle: "Conversion funnel",
    funnelDesc: "Sessions that reached each step in {window}.",
    stepVisits: "Visits",
    stepCart: "Added to cart",
    stepCheckout: "Started checkout",
    stepPurchase: "Purchased",
    ofVisits: "{rate} of visits",
    noVisits: "No store visits in this period yet.",
    offersTitle: "Upsells and offers",
    offersDesc: "What your offers added to orders.",
    offerType: "Offer",
    offerOrders: "Orders",
    offerQuantity: "Units",
    offerTotal: "Total",
    bundle: "Bundles and offers",
    bump: "Order bumps",
    upsell: "Upsells",
    sourcesTitle: "Top traffic sources",
    governoratesTitle: "Top governorates",
    devicesTitle: "Devices",
    productsTitle: "Top products",
    funnelsTitle: "Top funnels",
    nothing: "Nothing in this period yet.",
    ordersCaption: "{orders} orders · {sales}",
    visitsCaption: "{visits} visits · {orders} orders",
    unitsCaption: "{n} sold",
    direct: "Direct",
    mobile: "Mobile",
    desktop: "Desktop",
    tablet: "Tablet",
    unknown: "Unknown",
  },
  ar: {
    allStore: "المتجر كله",
    funnelFilter: "المتجر أو مسار البيع",
    currencyFilter: "العملة",
    vsPrevious: "مقارنة بالفترة السابقة",
    visits: "الزيارات",
    orders: "الطلبات",
    sales: "إجمالي المبيعات",
    averageOrderValue: "متوسط قيمة الطلب",
    addToCart: "إضافات للسلة",
    checkouts: "بدء إتمام الطلب",
    crossSellAdds: "إضافات البيع المتقاطع",
    newOrders: "طلبات جديدة",
    lostOrders: "طلبات ضائعة",
    conversionRate: "معدل التحويل",
    lostRate: "نسبة الضياع",
    netProfit: "صافي الربح",
    newCustomers: "عملاء جدد",
    returningCustomers: "عملاء عائدون",
    leads: "عملاء محتملون",
    confirmationRate: "نسبة التأكيد",
    deliveryRate: "نسبة التسليم",
    hintOrders: "بدون الطلبات التجريبية وطلبات الدفع الإلكتروني غير المدفوعة",
    hintNewOrders: "لم يفتحها أحد بعد",
    hintLost: "بدأ العميل إتمام الطلب ولم يكمله",
    hintProfit: "الطلبات المسلَّمة بعد تكلفة المنتج والمرتجعات المالية",
    hintConfirmation: "المؤكَّد ÷ طلبات الدفع عند الاستلام",
    hintDelivery: "المسلَّم ÷ ما خرج مع شركة الشحن",
    hintLeads: "من نماذج الاشتراك والنشرة البريدية",
    funnelTitle: "قمع التحويل",
    funnelDesc: "الجلسات التي وصلت لكل خطوة خلال {window}.",
    stepVisits: "الزيارات",
    stepCart: "أضاف للسلة",
    stepCheckout: "بدأ إتمام الطلب",
    stepPurchase: "اشترى",
    ofVisits: "{rate} من الزيارات",
    noVisits: "لا توجد زيارات للمتجر في هذه الفترة بعد.",
    offersTitle: "العروض والبيع الإضافي",
    offersDesc: "ما أضافته عروضك إلى الطلبات.",
    offerType: "العرض",
    offerOrders: "الطلبات",
    offerQuantity: "القطع",
    offerTotal: "الإجمالي",
    bundle: "الباقات والعروض",
    bump: "إضافات الطلب",
    upsell: "عروض ما بعد الشراء",
    sourcesTitle: "أهم مصادر الزيارات",
    governoratesTitle: "أكثر المحافظات شراءً",
    devicesTitle: "الأجهزة",
    productsTitle: "المنتجات الأكثر مبيعًا",
    funnelsTitle: "أفضل مسارات البيع",
    nothing: "لا يوجد شيء في هذه الفترة بعد.",
    ordersCaption: "{orders} طلب · {sales}",
    visitsCaption: "{visits} زيارة · {orders} طلب",
    unitsCaption: "بيع منه {n}",
    direct: "مباشر",
    mobile: "موبايل",
    desktop: "كمبيوتر",
    tablet: "تابلت",
    unknown: "غير معروف",
  },
} satisfies Messages;

type Kind = "count" | "money" | "rate";

interface Tile {
  key: InsightsMetricKey;
  kind: Kind;
  hint?: "hintOrders" | "hintNewOrders" | "hintLost" | "hintProfit" | "hintConfirmation" | "hintDelivery" | "hintLeads";
  spark?: keyof Omit<InsightsDay, "date">;
  to?: string;
  /** Lower is better: a rise is shown in red. */
  inverse?: boolean;
}

const TILES: Tile[] = [
  { key: "sales", kind: "money", spark: "sales", to: "/analytics" },
  { key: "orders", kind: "count", spark: "orders", hint: "hintOrders", to: "/orders" },
  { key: "netProfit", kind: "money", hint: "hintProfit", to: "/profit" },
  { key: "averageOrderValue", kind: "money" },
  { key: "confirmationRate", kind: "rate", hint: "hintConfirmation", to: "/confirmation-queue" },
  { key: "deliveryRate", kind: "rate", hint: "hintDelivery" },
  { key: "visits", kind: "count", spark: "visits", to: "/analytics/web" },
  { key: "conversionRate", kind: "rate" },
  { key: "addToCart", kind: "count", spark: "addToCart" },
  { key: "checkouts", kind: "count", spark: "checkouts" },
  { key: "crossSellAdds", kind: "count", spark: "crossSell" },
  { key: "newOrders", kind: "count", hint: "hintNewOrders", to: "/orders" },
  { key: "lostOrders", kind: "count", spark: "lost", hint: "hintLost", to: "/abandoned", inverse: true },
  { key: "lostRate", kind: "rate", inverse: true },
  { key: "newCustomers", kind: "count", to: "/customers" },
  { key: "returningCustomers", kind: "count", to: "/customers" },
  { key: "leads", kind: "count", spark: "leads", hint: "hintLeads" },
];

/**
 * The store at a glance (SPEC §15.1): every KPI for the chosen period against
 * the one before, the conversion funnel, what the offers added, and the top
 * sources, governorates, devices, products and funnels — one request.
 */
export function StoreOverview({ actions }: { actions?: ReactNode }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const [range, setRange] = useState<AnalyticsRange>("7d");
  const [funnelId, setFunnelId] = useState("");

  const funnels = useAsync(() => funnelsList(apiClient, workspaceId).catch(() => []), [workspaceId]);
  const overview = useAsync<InsightsOverview>(
    () =>
      insightsGetOverview(apiClient, workspaceId, {
        ...rangeWindows(range).current,
        compare: "previous",
        funnelId: funnelId || undefined,
      }),
    [workspaceId, range, funnelId]
  );
  const data = overview.data;

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <RangeSwitch value={range} onChange={setRange} />
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
        {actions && <div className="ms-auto flex items-center gap-2">{actions}</div>}
      </div>

      <DataState loading={overview.loading && !data} error={overview.error} onRetry={() => void overview.refresh()}>
        {data && <OverviewBody data={data} busy={overview.loading} />}
      </DataState>
    </div>
  );
}

function OverviewBody({ data, busy }: { data: InsightsOverview; busy: boolean }) {
  const t = useT(STRINGS);
  const money = (v: number | null) => (v === null ? "—" : formatMoney(v, data.currency));
  const show = (kind: Kind, v: number | null) =>
    kind === "money" ? money(v) : kind === "rate" ? formatPercentValue(percentToRatio(v)) : formatCount(v);
  const window = formatWindow(data.range.from, data.range.to);
  const visits = data.metrics.visits.value ?? 0;
  const stepLabel = { visits: t.stepVisits, cart: t.stepCart, checkout: t.stepCheckout, purchase: t.stepPurchase };
  const deviceLabel: Record<string, string> = { mobile: t.mobile, desktop: t.desktop, tablet: t.tablet, unknown: t.unknown };
  const empty = <p className="text-sm text-ink-soft">{t.nothing}</p>;

  return (
    <div className={cn("space-y-6 transition-opacity", busy && "opacity-60")}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
        {TILES.map((tile) => {
          const metric = data.metrics[tile.key];
          const delta = deltaBasisPoints(metric.value, metric.previous);
          return (
            <MetricTile
              key={tile.key}
              label={t[tile.key]}
              hint={tile.hint ? t[tile.hint] : undefined}
              value={show(tile.kind, metric.value)}
              delta={delta}
              inverse={tile.inverse}
              vsLabel={t.vsPrevious}
              spark={tile.spark ? data.series.map((d) => d[tile.spark!]) : undefined}
              to={tile.to}
            />
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title={t.funnelTitle} description={fmt(t.funnelDesc, { window })}>
          {visits === 0 ? (
            <p className="text-sm text-ink-soft">{t.noVisits}</p>
          ) : (
            <ol className="space-y-3">
              {data.funnel.map((step) => (
                <li key={step.step}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-ink">{stepLabel[step.step]}</span>
                    <span className="text-sm text-ink-soft">
                      <bdi dir="ltr" className="tabular-nums font-medium text-ink">
                        {formatCount(step.sessions)}
                      </bdi>
                      {step.step !== "visits" && (
                        <span className="ms-2 text-xs">
                          {fmt(t.ofVisits, { rate: formatPercentValue(percentToRatio(step.rateOfVisits)) })}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-paper">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(100, Math.max(0, step.rateOfVisits ?? 0))}%` }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Section>

        <Section title={t.offersTitle} description={t.offersDesc} flush>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-line text-xs text-ink-soft">
                <th className="px-4 py-2 text-start font-medium">{t.offerType}</th>
                <th className="px-4 py-2 text-end font-medium">{t.offerOrders}</th>
                <th className="px-4 py-2 text-end font-medium">{t.offerQuantity}</th>
                <th className="px-4 py-2 text-end font-medium">{t.offerTotal}</th>
              </tr>
            </thead>
            <tbody>
              {data.offers.map((row) => (
                <tr key={row.type} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-2.5 text-ink">{t[row.type]}</td>
                  <td className="tabular-nums px-4 py-2.5 text-end text-ink">{formatCount(row.orders)}</td>
                  <td className="tabular-nums px-4 py-2.5 text-end text-ink">{formatCount(row.quantity)}</td>
                  <td className="tabular-nums px-4 py-2.5 text-end font-medium text-ink">
                    <bdi dir="ltr">{money(row.total)}</bdi>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Section title={t.sourcesTitle}>
          <HBarList
            rows={data.topSources.map((s) => ({
              label: (s.source === "direct" ? t.direct : s.source) + (s.medium ? ` / ${s.medium}` : ""),
              value: s.visits,
              caption: fmt(t.visitsCaption, { visits: formatCount(s.visits), orders: formatCount(s.orders) }),
            }))}
            format={formatCount}
            emptyLabel={empty}
          />
        </Section>
        <Section title={t.governoratesTitle}>
          <HBarList
            rows={data.topGovernorates.map((g) => ({
              label: g.name,
              value: g.orders,
              caption: fmt(t.ordersCaption, { orders: formatCount(g.orders), sales: money(g.sales) }),
            }))}
            format={formatCount}
            emptyLabel={empty}
          />
        </Section>
        <Section title={t.devicesTitle}>
          <HBarList
            rows={data.devices.map((d) => ({ label: deviceLabel[d.device] ?? d.device, value: d.visits }))}
            format={formatCount}
            emptyLabel={empty}
          />
        </Section>
        <Section title={t.productsTitle}>
          <HBarList
            rows={data.topProducts.map((p, i) => ({
              label: p.name ?? `#${i + 1}`,
              value: p.sales,
              caption: fmt(t.unitsCaption, { n: formatCount(p.quantity) }),
            }))}
            format={(v) => money(v)}
            emptyLabel={empty}
          />
        </Section>
        <Section title={t.funnelsTitle}>
          <HBarList
            rows={data.topFunnels.map((f) => ({
              label: f.name,
              value: f.sales,
              caption: fmt(t.ordersCaption, { orders: formatCount(f.orders), sales: money(f.sales) }),
            }))}
            format={(v) => money(v)}
            emptyLabel={empty}
          />
        </Section>
      </div>
    </div>
  );
}

function MetricTile({
  label,
  hint,
  value,
  delta,
  inverse,
  vsLabel,
  spark,
  to,
}: {
  label: string;
  hint?: string;
  value: string;
  delta: number | null;
  inverse?: boolean;
  vsLabel: string;
  spark?: number[];
  to?: string;
}) {
  const up = delta !== null && delta > 0;
  const down = delta !== null && delta < 0;
  const good = inverse ? down : up;
  const bad = inverse ? up : down;
  const body = (
    <Card className={cn("h-full gap-0 p-4", to && "transition-colors hover:border-primary/40")} title={hint}>
      <p className="text-xs font-medium text-ink-soft">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <p className="tabular-nums text-2xl font-semibold tracking-tight text-ink">
          <bdi dir="ltr">{value}</bdi>
        </p>
        {spark && spark.length > 1 && (
          <div className="w-20 shrink-0" dir="ltr">
            <Sparkline current={spark} />
          </div>
        )}
      </div>
      {delta !== null ? (
        <p className="mt-1 flex flex-wrap items-center gap-1 text-xs">
          <span className={cn("font-medium", good && "text-success", bad && "text-danger", !up && !down && "text-ink-soft")}>
            <bdi dir="ltr">
              {up ? "▲" : down ? "▼" : "•"} {formatPercentValue(Math.abs(delta) / 10000)}
            </bdi>
          </span>
          <span className="text-ink-soft">{vsLabel}</span>
        </p>
      ) : hint ? (
        <p className="mt-1 truncate text-xs text-ink-soft">{hint}</p>
      ) : null}
    </Card>
  );
  return to ? (
    <Link to={to} className="block rounded-2xl">
      {body}
    </Link>
  ) : (
    body
  );
}
