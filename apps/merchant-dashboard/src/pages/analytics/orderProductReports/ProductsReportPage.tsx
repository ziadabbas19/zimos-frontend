import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PackageSearch } from "lucide-react";
import { Button, cn } from "@store-builder/ui";
import {
  productsReportExportCsv,
  productsReportGet,
  productsReportTrend,
  type ProductsReportRow,
} from "@store-builder/api-client";
import { BarChart, HBarList } from "@/components/charts";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/Section";
import { Segmented } from "@/components/Segmented";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { apiClient } from "@/lib/apiClient";
import { formatCount, formatWindow } from "@/lib/analytics";
import { formatMinorMoney } from "@/lib/format";
import { formatBucket, useReport, useReportRange } from "@/lib/reportRange";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { formatRate, KpiGrid, type KpiCell } from "../reports/parts";
import { CsvButton, RangeBar, ReportSkeleton } from "./reportKit";

const STRINGS = {
  en: {
    title: "Products report",
    description: "What sold, what didn't and what is running out — {window}.",
    back: "Analytics",
    revenue: "Product revenue",
    units: "Units sold",
    productsSold: "Products sold",
    productsUnsold: "Products with no sales",
    revenueHint: "line totals, before order discounts",
    topRevenue: "Top by revenue",
    topUnits: "Top by units",
    lowest: "Lowest sellers",
    lowestHint: "Products that sold, fewest units first.",
    noSales: "No sales in these dates",
    noSalesHint: "Active products nobody ordered.",
    stock: "Stock running out",
    stockHint: "Active physical products. Low = at or below the variant's alert level ({fallback} when none is set).",
    out: "Out of stock",
    low: "Low",
    available: "{count} left",
    all: "Every product that sold",
    allHint: "Variants count for their product. Pick a product to see its trend.",
    product: "Product",
    share: "Share",
    orders: "Orders",
    returned: "Returned",
    inStock: "In stock",
    unitsOf: "{units} units · {revenue}",
    open: "Open",
    trendTitle: "{name} — trend",
    trendUnits: "Units",
    trendRevenue: "Revenue",
    show: "Show",
    close: "Close",
    noProductsTitle: "No products sold in these dates",
    noProductsBody: "Pick a wider range. Products that didn't sell and the stock running out are below.",
    nothing: "Nothing here.",
    stockOk: "Nothing is running out.",
  },
  ar: {
    title: "تقرير المنتجات",
    description: "ما الذي بِيع، وما الذي لم يُبَع، وما الذي سينفد — {window}.",
    back: "التحليلات",
    revenue: "إيرادات المنتجات",
    units: "القطع المبيعة",
    productsSold: "منتجات بِيعت",
    productsUnsold: "منتجات بلا مبيعات",
    revenueHint: "إجمالي السطور قبل خصومات الطلب",
    topRevenue: "الأعلى إيرادًا",
    topUnits: "الأكثر قطعًا",
    lowest: "الأقل مبيعًا",
    lowestHint: "المنتجات التي بِيعت، الأقل قطعًا أولًا.",
    noSales: "بلا مبيعات في هذه التواريخ",
    noSalesHint: "منتجات نشطة لم يطلبها أحد.",
    stock: "مخزون على وشك النفاد",
    stockHint: "المنتجات المادية النشطة. منخفض = عند حد التنبيه للمتغير أو أقل ({fallback} لو لم يُحدَّد).",
    out: "نفد",
    low: "منخفض",
    available: "متبقٍ {count}",
    all: "كل المنتجات التي بِيعت",
    allHint: "المتغيرات تُحسب لمنتجها. اختر منتجًا لترى اتجاهه.",
    product: "المنتج",
    share: "الحصة",
    orders: "الطلبات",
    returned: "مرتجع",
    inStock: "المخزون",
    unitsOf: "{units} قطعة · {revenue}",
    open: "فتح",
    trendTitle: "{name} — الاتجاه",
    trendUnits: "القطع",
    trendRevenue: "الإيرادات",
    show: "اعرض",
    close: "إغلاق",
    noProductsTitle: "لم يُبَع أي منتج في هذه التواريخ",
    noProductsBody: "اختر فترة أطول. المنتجات بلا مبيعات والمخزون الذي ينفد بالأسفل.",
    nothing: "لا شيء هنا.",
    stockOk: "لا شيء على وشك النفاد.",
  },
} satisfies Messages;

/** One product's trend over the range, in a dialog. */
function ProductTrend({ product, range, currency, onClose }: { product: ProductsReportRow; range: { from: string; to: string }; currency: string; onClose: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const [metric, setMetric] = useState<"units" | "revenue">("units");
  const trend = useReport(() => productsReportTrend(apiClient, workspaceId, product.productId, range), [workspaceId, product.productId, range.from, range.to]);
  const points = (trend.data?.series ?? []).map((p) => ({ label: formatBucket(p.bucket, trend.data!.unit), value: p[metric] }));
  const title = fmt(t.trendTitle, { name: product.name });
  return (
    <Modal open onClose={onClose} title={title} description={fmt(t.unitsOf, { units: formatCount(product.units), revenue: formatMinorMoney(product.revenue, currency) })}>
      <div className="space-y-4">
        <Segmented
          label={t.show}
          size="sm"
          value={metric}
          onChange={(v) => setMetric(v)}
          options={[
            { value: "units", label: t.trendUnits },
            { value: "revenue", label: t.trendRevenue },
          ]}
        />
        <DataState loading={trend.loading && !trend.data} error={trend.error} onRetry={trend.reload}>
          <BarChart points={points} format={(v) => (metric === "revenue" ? formatMinorMoney(v, currency) : formatCount(v))} summary={title} height={200} />
        </DataState>
        <div className="flex justify-end">
          <Button variant="outline" className="min-h-11" onClick={onClose}>
            {t.close}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** /analytics/products — ORDER_PRODUCT_REPORTS_ENABLED. */
export function ProductsReportPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const { range, setPreset, setDays, setCompare } = useReportRange();
  const [trendOf, setTrendOf] = useState<ProductsReportRow | null>(null);
  const report = useReport(() => productsReportGet(apiClient, workspaceId, { from: range.from, to: range.to }), [workspaceId, range.from, range.to]);
  const data = report.data;
  const money = (minor: number) => formatMinorMoney(minor, data?.currency ?? "EGP");

  const cells = useMemo<KpiCell[]>(() => {
    if (!data) return [];
    return [
      { key: "revenue", label: t.revenue, value: <bdi dir="ltr">{formatMinorMoney(data.totals.revenue, data.currency)}</bdi>, hint: t.revenueHint },
      { key: "units", label: t.units, value: <bdi dir="ltr">{formatCount(data.totals.units)}</bdi> },
      { key: "productsSold", label: t.productsSold, value: <bdi dir="ltr">{formatCount(data.totals.productsSold)}</bdi> },
      { key: "productsUnsold", label: t.productsUnsold, value: <bdi dir="ltr">{formatCount(data.totals.productsUnsold)}</bdi> },
    ];
  }, [data, t]);

  const productLink = (id: string, name: string) => (
    <Link to={`/catalog/${id}`} className="font-medium text-primary hover:underline" dir="auto">
      {name}
    </Link>
  );

  const columns: Column<ProductsReportRow>[] = [
    {
      key: "product",
      header: t.product,
      cell: (p) => (
        <button
          type="button"
          onClick={() => setTrendOf(p)}
          className="min-h-11 cursor-pointer text-start font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
          dir="auto"
        >
          {p.name}
        </button>
      ),
    },
    { key: "units", header: t.units, align: "end", cell: (p) => formatCount(p.units) },
    { key: "revenue", header: t.revenue, align: "end", cell: (p) => <bdi dir="ltr" className="font-medium text-ink">{money(p.revenue)}</bdi> },
    {
      key: "share",
      header: t.share,
      align: "end",
      cell: (p) => (
        <span className="inline-flex w-28 items-center gap-2">
          <span aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, p.share ?? 0)}%` }} />
          </span>
          <bdi dir="ltr" className="w-11 text-end text-xs tabular-nums">
            {formatRate(p.share)}
          </bdi>
        </span>
      ),
    },
    { key: "orders", header: t.orders, align: "end", cell: (p) => formatCount(p.orders) },
    { key: "returned", header: t.returned, align: "end", phoneSkip: (p) => p.returnedUnits === 0, cell: (p) => formatCount(p.returnedUnits) },
    { key: "stock", header: t.inStock, align: "end", phoneSkip: (p) => p.stock === null, cell: (p) => (p.stock === null ? "—" : formatCount(p.stock)) },
  ];

  const ranked = (rows: ProductsReportRow[], by: "revenue" | "units") =>
    rows.map((p) => ({
      label: p.name,
      value: p[by],
      caption: by === "revenue" ? fmt(t.unitsOf, { units: formatCount(p.units), revenue: money(p.revenue) }) : money(p.revenue),
    }));

  const nothingSold = data && data.totals.productsSold === 0;

  return (
    <div className="min-w-0">
      <PageHeader
        title={t.title}
        description={fmt(t.description, { window: formatWindow(range.from, range.to) })}
        back={{ to: "/analytics", label: t.back }}
        actions={
          <CsvButton
            load={() => productsReportExportCsv(apiClient, workspaceId, { from: range.from, to: range.to })}
            filename={`zimos-products-${range.fromDay}-${range.toDay}.csv`}
            onError={toast.error}
          />
        }
      />
      <RangeBar range={range} onPreset={setPreset} onDays={setDays} onCompare={setCompare} showCompare={false} />

      <DataState loading={report.loading && !data} error={report.error} onRetry={report.reload} skeleton={<ReportSkeleton kpis={4} />}>
        {data && (
          <div className="space-y-5" aria-busy={report.loading || undefined}>
            <KpiGrid cells={cells} columns={4} />

            {nothingSold ? (
              <EmptyState icon={<PackageSearch aria-hidden />} title={t.noProductsTitle} description={t.noProductsBody} />
            ) : (
              <>
                <div className="grid gap-5 lg:grid-cols-2">
                  <Section title={t.topRevenue}>
                    <HBarList rows={ranked(data.topByRevenue, "revenue")} format={money} />
                  </Section>
                  <Section title={t.topUnits}>
                    <HBarList rows={ranked(data.topByUnits, "units")} format={formatCount} />
                  </Section>
                </div>
              </>
            )}

            <div className="grid gap-5 lg:grid-cols-2">
              {!nothingSold && (
                <Section title={t.lowest} description={t.lowestHint}>
                  <ul className="divide-y divide-line text-sm">
                    {data.lowestSellers.map((p) => (
                      <li key={p.productId} className="flex min-h-11 items-center justify-between gap-3 py-2">
                        {productLink(p.productId, p.name)}
                        <span className="shrink-0 text-ink-soft tabular-nums">{fmt(t.unitsOf, { units: formatCount(p.units), revenue: money(p.revenue) })}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
              <Section title={t.noSales} description={t.noSalesHint} className={cn(nothingSold && "lg:col-span-2")}>
                {data.noSales.length === 0 ? (
                  <p className="text-sm text-ink-soft">{t.nothing}</p>
                ) : (
                  <ul className="max-h-[22rem] divide-y divide-line overflow-y-auto pe-1 text-sm">
                    {data.noSales.map((p) => (
                      <li key={p.productId} className="flex min-h-11 items-center justify-between gap-3 py-2">
                        {productLink(p.productId, p.name)}
                        {p.stock !== null && <span className="shrink-0 text-ink-soft tabular-nums">{fmt(t.available, { count: formatCount(p.stock) })}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>

            <Section title={t.stock} description={fmt(t.stockHint, { fallback: String(data.lowStockFallback) })}>
              {data.stock.length === 0 ? (
                <p className="text-sm text-ink-soft">{t.stockOk}</p>
              ) : (
                <ul className="grid gap-x-6 divide-y divide-line text-sm md:grid-cols-2 md:divide-y-0">
                  {data.stock.map((p) => (
                    <li key={p.productId} className="flex min-h-11 items-center justify-between gap-3 border-line py-2 md:border-b">
                      {productLink(p.productId, p.name)}
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="tabular-nums text-ink-soft">{fmt(t.available, { count: formatCount(p.available) })}</span>
                        <StatusBadge value={p.state} tone={p.state === "out" ? "danger" : "warning"} text={p.state === "out" ? t.out : t.low} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {!nothingSold && (
              <Section title={t.all} description={t.allHint} flush>
                <div className="px-4 pb-4">
                  <DataTable columns={columns} rows={data.rows} rowKey={(p) => p.productId} minWidth="44rem" />
                </div>
              </Section>
            )}
          </div>
        )}
      </DataState>
      {trendOf && data && <ProductTrend product={trendOf} range={{ from: range.from, to: range.to }} currency={data.currency} onClose={() => setTrendOf(null)} />}
    </div>
  );
}
