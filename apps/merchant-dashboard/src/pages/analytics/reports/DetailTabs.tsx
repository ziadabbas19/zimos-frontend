import { Link } from "react-router-dom";
import {
  reportsGetCustomers,
  reportsGetDelivery,
  reportsGetProducts,
  type ReportsCustomers,
  type ReportsDelivery,
  type ReportsProducts,
} from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { Section } from "@/components/Section";
import { apiClient } from "@/lib/apiClient";
import { formatCount } from "@/lib/analytics";
import { formatMinorMoney } from "@/lib/format";
import { useReport, type ReportRange } from "@/lib/reportRange";
import { getIntlLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { ExportButton, formatRate, KpiGrid, RateBar, SplitBar } from "./parts";

interface TabProps {
  workspaceId: string;
  range: ReportRange;
  onError: (message: string) => void;
}

const span = (range: ReportRange) => ({ from: range.from, to: range.to });

// --------------------------------------------------------------- products --

const PRODUCT_STRINGS = {
  en: {
    products: "Products",
    productsHint: "What people look at, what they buy, and what reaches them.",
    product: "Product",
    views: "Viewed",
    addToCart: "Add to cart",
    orders: "Orders",
    units: "Units",
    sales: "Sales",
    conversion: "Conversion",
    delivery: "Delivered",
    returns: "Returned",
    landing: "Landing pages",
    landingHint: "The first page of each session, and what those sessions went on to buy.",
    page: "Page",
    sessions: "Sessions",
    empty: "Nothing in this period yet.",
  },
  ar: {
    products: "المنتجات",
    productsHint: "ما الذي يشاهده الناس، وما الذي يشترونه، وما الذي يصلهم.",
    product: "المنتج",
    views: "المشاهدات",
    addToCart: "الإضافة للسلة",
    orders: "الطلبات",
    units: "القطع",
    sales: "المبيعات",
    conversion: "التحويل",
    delivery: "تم التسليم",
    returns: "المرتجع",
    landing: "صفحات الهبوط",
    landingHint: "أول صفحة في كل زيارة، وما اشترته هذه الزيارات.",
    page: "الصفحة",
    sessions: "الزيارات",
    empty: "لا يوجد شيء في هذه الفترة بعد.",
  },
} satisfies Messages;

type ProductRow = ReportsProducts["products"][number];
type LandingRow = ReportsProducts["landingPages"][number];

export function ProductsTab({ workspaceId, range, onError }: TabProps) {
  const t = useT(PRODUCT_STRINGS);
  const { data, loading, error, reload } = useReport(
    () => reportsGetProducts(apiClient, workspaceId, { ...span(range), limit: 50 }),
    [workspaceId, range.from, range.to]
  );
  const money = (minor: number) => formatMinorMoney(minor, data?.currency ?? "EGP");
  const empty = <p className="px-4 pb-4 text-sm text-ink-soft">{t.empty}</p>;

  const productColumns: Column<ProductRow>[] = [
    {
      key: "name",
      header: t.product,
      cell: (row) => (
        <Link to={`/catalog/${row.productId}`} className="font-medium text-ink hover:text-primary">
          {row.name}
        </Link>
      ),
    },
    { key: "views", header: t.views, align: "end", cell: (row) => formatCount(row.views) },
    { key: "cart", header: t.addToCart, align: "end", cell: (row) => formatRate(row.addToCartRate) },
    { key: "orders", header: t.orders, align: "end", cell: (row) => formatCount(row.orders) },
    { key: "units", header: t.units, align: "end", cell: (row) => formatCount(row.units) },
    { key: "conversion", header: t.conversion, align: "end", cell: (row) => formatRate(row.conversionRate) },
    { key: "delivery", header: t.delivery, cell: (row) => <RateBar percent={row.deliveryRate} /> },
    { key: "returns", header: t.returns, cell: (row) => <RateBar percent={row.returnRate} good={15} bad={30} inverted /> },
    {
      key: "sales",
      header: t.sales,
      align: "end",
      cell: (row) => <span className="font-medium text-ink">{money(row.sales)}</span>,
    },
  ];
  const landingColumns: Column<LandingRow>[] = [
    {
      key: "path",
      header: t.page,
      cell: (row) => (
        <bdi dir="auto" className="font-medium text-ink">
          {decodeURI(row.path)}
        </bdi>
      ),
    },
    { key: "sessions", header: t.sessions, align: "end", cell: (row) => formatCount(row.sessions) },
    { key: "orders", header: t.orders, align: "end", cell: (row) => formatCount(row.orders) },
    { key: "conversion", header: t.conversion, align: "end", cell: (row) => formatRate(row.conversionRate) },
    {
      key: "sales",
      header: t.sales,
      align: "end",
      cell: (row) => <span className="font-medium text-ink">{money(row.sales)}</span>,
    },
  ];

  return (
    <DataState loading={loading && !data} error={error} onRetry={reload}>
      {data && (
        <div className="space-y-5">
          <Section
            title={t.products}
            description={t.productsHint}
            flush
            actions={<ExportButton workspaceId={workspaceId} report="products" range={range} onError={onError} />}
          >
            <DataTable phoneCards={false} columns={productColumns} rows={data.products} rowKey={(row) => row.productId} minWidth="62rem" empty={empty} />
          </Section>
          <Section
            title={t.landing}
            description={t.landingHint}
            flush
            actions={<ExportButton workspaceId={workspaceId} report="landing_pages" range={range} onError={onError} />}
          >
            <DataTable phoneCards={false} columns={landingColumns} rows={data.landingPages} rowKey={(row) => row.path} minWidth="38rem" empty={empty} />
          </Section>
        </div>
      )}
    </DataState>
  );
}

// --------------------------------------------------------------- delivery --

const DELIVERY_STRINGS = {
  en: {
    confirmationRate: "Confirmation rate",
    confirmationHint: "confirmed ÷ cash-on-delivery orders",
    deliveryRate: "Delivery rate",
    deliveryHint: "delivered ÷ handed to a courier",
    returnRate: "Return rate",
    returnHint: "returned or failed ÷ handed to a courier",
    deliveredSales: "Delivered sales",
    deliveredHint: "of {total} ordered",
    confirmTime: "Time to confirm",
    hours: "{n} h",
    deliveryTime: "Time to deliver",
    days: "{n} days",
    pipeline: "Where the orders are now",
    pipelineHint: "Every order of the period, by its current stage.",
    governorates: "By governorate",
    governoratesHint: "Where orders get confirmed and delivered, and where they come back.",
    carriers: "By courier",
    carriersHint: "The same orders, by the courier that carried them.",
    place: "Governorate",
    courier: "Courier",
    orders: "Orders",
    shipped: "Shipped",
    confirmation: "Confirmed",
    delivery: "Delivered",
    returns: "Returned",
    speed: "Avg. days",
    sales: "Delivered sales",
    empty: "No orders in this period yet.",
    awaiting_payment: "Awaiting payment",
    pending_confirmation: "Waiting for confirmation",
    needs_follow_up: "Needs follow-up",
    ready_to_ship: "Ready to ship",
    shipped_stage: "With the courier",
    out_for_delivery: "Out for delivery",
    delivery_failed: "Delivery failed",
    delivered: "Delivered",
    returned: "Returned",
    cancelled: "Cancelled",
  },
  ar: {
    confirmationRate: "معدل التأكيد",
    confirmationHint: "المؤكَّد ÷ طلبات الدفع عند الاستلام",
    deliveryRate: "معدل التسليم",
    deliveryHint: "المُسلَّم ÷ ما خرج مع شركة الشحن",
    returnRate: "معدل المرتجع",
    returnHint: "المرتجع أو الفاشل ÷ ما خرج مع شركة الشحن",
    deliveredSales: "المبيعات المُسلَّمة",
    deliveredHint: "من {total} تم طلبها",
    confirmTime: "وقت التأكيد",
    hours: "{n} ساعة",
    deliveryTime: "وقت التسليم",
    days: "{n} يوم",
    pipeline: "أين الطلبات الآن",
    pipelineHint: "كل طلبات الفترة حسب مرحلتها الحالية.",
    governorates: "حسب المحافظة",
    governoratesHint: "أين تتأكد الطلبات وتُسلَّم، وأين ترجع.",
    carriers: "حسب شركة الشحن",
    carriersHint: "نفس الطلبات، حسب الشركة التي حملتها.",
    place: "المحافظة",
    courier: "شركة الشحن",
    orders: "الطلبات",
    shipped: "تم شحنها",
    confirmation: "التأكيد",
    delivery: "التسليم",
    returns: "المرتجع",
    speed: "متوسط الأيام",
    sales: "المبيعات المُسلَّمة",
    empty: "لا توجد طلبات في هذه الفترة بعد.",
    awaiting_payment: "بانتظار الدفع",
    pending_confirmation: "بانتظار التأكيد",
    needs_follow_up: "تحتاج متابعة",
    ready_to_ship: "جاهزة للشحن",
    shipped_stage: "مع شركة الشحن",
    out_for_delivery: "خرجت للتسليم",
    delivery_failed: "فشل التسليم",
    delivered: "تم التسليم",
    returned: "مرتجع",
    cancelled: "ملغي",
  },
} satisfies Messages;

const STAGE_ORDER = [
  "pending_confirmation",
  "needs_follow_up",
  "awaiting_payment",
  "ready_to_ship",
  "shipped",
  "out_for_delivery",
  "delivered",
  "delivery_failed",
  "returned",
  "cancelled",
];
const STAGE_TONE: Record<string, string> = {
  pending_confirmation: "bg-accent",
  needs_follow_up: "bg-accent-dark",
  awaiting_payment: "bg-line-strong",
  ready_to_ship: "bg-primary/50",
  shipped: "bg-primary/75",
  out_for_delivery: "bg-primary",
  delivered: "bg-success",
  delivery_failed: "bg-danger/70",
  returned: "bg-danger",
  cancelled: "bg-ink-soft/50",
};

type PlaceRow = ReportsDelivery["governorates"][number];
type CarrierRow = ReportsDelivery["carriers"][number];

export function DeliveryTab({ workspaceId, range, onError }: TabProps) {
  const t = useT(DELIVERY_STRINGS);
  const { data, loading, error, reload } = useReport(
    () => reportsGetDelivery(apiClient, workspaceId, span(range)),
    [workspaceId, range.from, range.to]
  );
  const money = (minor: number) => formatMinorMoney(minor, data?.currency ?? "EGP");
  const empty = <p className="px-4 pb-4 text-sm text-ink-soft">{t.empty}</p>;
  const number = (n: number) => new Intl.NumberFormat(getIntlLocale(), { maximumFractionDigits: 1 }).format(n);

  const shared = <T extends PlaceRow | CarrierRow>(): Column<T>[] => [
    { key: "orders", header: t.orders, align: "end", cell: (row) => formatCount(row.orders) },
    { key: "shipped", header: t.shipped, align: "end", cell: (row) => formatCount(row.shipped) },
    { key: "delivery", header: t.delivery, cell: (row) => <RateBar percent={row.deliveryRate} /> },
    { key: "returns", header: t.returns, cell: (row) => <RateBar percent={row.returnRate} good={15} bad={30} inverted /> },
  ];
  const placeColumns: Column<PlaceRow>[] = [
    { key: "name", header: t.place, cell: (row) => <span className="font-medium text-ink">{row.name}</span> },
    ...shared<PlaceRow>().slice(0, 2),
    { key: "confirmation", header: t.confirmation, cell: (row) => <RateBar percent={row.confirmationRate} good={75} bad={55} /> },
    ...shared<PlaceRow>().slice(2),
    { key: "sales", header: t.sales, align: "end", cell: (row) => <span className="font-medium text-ink">{money(row.deliveredSales)}</span> },
  ];
  const carrierColumns: Column<CarrierRow>[] = [
    { key: "name", header: t.courier, cell: (row) => <span className="font-medium text-ink capitalize">{row.name}</span> },
    ...shared<CarrierRow>(),
    {
      key: "speed",
      header: t.speed,
      align: "end",
      cell: (row) => (row.averageDeliveryDays === null ? "—" : number(row.averageDeliveryDays)),
    },
    { key: "sales", header: t.sales, align: "end", cell: (row) => <span className="font-medium text-ink">{money(row.deliveredSales)}</span> },
  ];

  return (
    <DataState loading={loading && !data} error={error} onRetry={reload}>
      {data && (
        <div className="space-y-5">
          <KpiGrid
            cells={[
              { key: "confirm", label: t.confirmationRate, value: formatRate(data.totals.confirmationRate), hint: t.confirmationHint },
              { key: "deliver", label: t.deliveryRate, value: formatRate(data.totals.deliveryRate), hint: t.deliveryHint },
              { key: "return", label: t.returnRate, value: formatRate(data.totals.returnRate), hint: t.returnHint },
              {
                key: "sales",
                label: t.deliveredSales,
                value: <bdi dir="ltr">{money(data.totals.deliveredSales)}</bdi>,
                hint: t.deliveredHint.replace("{total}", money(data.totals.sales)),
              },
              {
                key: "confirmTime",
                label: t.confirmTime,
                value: data.averageConfirmationHours === null ? "—" : t.hours.replace("{n}", number(data.averageConfirmationHours)),
              },
              {
                key: "deliveryTime",
                label: t.deliveryTime,
                value: data.averageDeliveryDays === null ? "—" : t.days.replace("{n}", number(data.averageDeliveryDays)),
              },
            ]}
          />

          <Section title={t.pipeline} description={t.pipelineHint}>
            <SplitBar
              parts={STAGE_ORDER.flatMap((stage) => {
                const row = data.stages.find((s) => s.stage === stage);
                if (!row || row.orders === 0) return [];
                const key = (stage === "shipped" ? "shipped_stage" : stage) as keyof typeof t;
                return [{ label: t[key] ?? stage, value: row.orders, display: formatCount(row.orders), className: STAGE_TONE[stage] ?? "bg-primary" }];
              })}
            />
          </Section>

          <Section
            title={t.governorates}
            description={t.governoratesHint}
            flush
            actions={<ExportButton workspaceId={workspaceId} report="governorates" range={range} onError={onError} />}
          >
            <DataTable phoneCards={false} columns={placeColumns} rows={data.governorates} rowKey={(row) => row.name} minWidth="58rem" empty={empty} />
          </Section>

          <Section
            title={t.carriers}
            description={t.carriersHint}
            flush
            actions={<ExportButton workspaceId={workspaceId} report="carriers" range={range} onError={onError} />}
          >
            <DataTable phoneCards={false} columns={carrierColumns} rows={data.carriers} rowKey={(row) => row.name} minWidth="50rem" empty={empty} />
          </Section>
        </div>
      )}
    </DataState>
  );
}

// -------------------------------------------------------------- customers --

const CUSTOMER_STRINGS = {
  en: {
    newCustomers: "New customers",
    returningCustomers: "Returning customers",
    returningRate: "Returning customer rate",
    inPeriod: "in this period",
    repeatRate: "Repeat purchase rate",
    repeatHint: "of all customers ordered more than once",
    lifetimeValue: "Average lifetime value",
    lifetimeHint: "{n} orders per customer",
    secondOrder: "Time to second order",
    days: "{n} days",
    split: "Sales: new against returning",
    splitHint: "Who the period's sales came from.",
    cohorts: "Do customers come back?",
    cohortsHint: "Customers grouped by the month of their first order, and the share that ordered again in each later month.",
    cohort: "First order",
    size: "Customers",
    month: "Month {n}",
    top: "Top customers",
    topHint: "By sales in this period.",
    customer: "Customer",
    orders: "Orders",
    delivered: "Delivered",
    sales: "Sales",
    unnamed: "No name",
    empty: "No customers in this period yet.",
  },
  ar: {
    newCustomers: "عملاء جدد",
    returningCustomers: "عملاء عائدون",
    returningRate: "نسبة العملاء العائدين",
    inPeriod: "في هذه الفترة",
    repeatRate: "معدل تكرار الشراء",
    repeatHint: "من كل العملاء طلبوا أكثر من مرة",
    lifetimeValue: "متوسط قيمة العميل",
    lifetimeHint: "{n} طلب لكل عميل",
    secondOrder: "الوقت حتى الطلب الثاني",
    days: "{n} يوم",
    split: "المبيعات: الجدد مقابل العائدين",
    splitHint: "من أين جاءت مبيعات الفترة.",
    cohorts: "هل يرجع العملاء؟",
    cohortsHint: "العملاء حسب شهر أول طلب، ونسبة من طلبوا مرة أخرى في كل شهر تالٍ.",
    cohort: "أول طلب",
    size: "العملاء",
    month: "الشهر {n}",
    top: "أفضل العملاء",
    topHint: "حسب المبيعات في هذه الفترة.",
    customer: "العميل",
    orders: "الطلبات",
    delivered: "تم التسليم",
    sales: "المبيعات",
    unnamed: "بدون اسم",
    empty: "لا يوجد عملاء في هذه الفترة بعد.",
  },
} satisfies Messages;

type TopRow = ReportsCustomers["topCustomers"][number];

function cohortLabel(cohort: string): string {
  const date = new Date(`${cohort}-01T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? cohort
    : new Intl.DateTimeFormat(getIntlLocale(), { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

export function CustomersTab({ workspaceId, range, onError }: TabProps) {
  const t = useT(CUSTOMER_STRINGS);
  const { data, loading, error, reload } = useReport(
    () => reportsGetCustomers(apiClient, workspaceId, span(range)),
    [workspaceId, range.from, range.to]
  );
  const money = (minor: number) => formatMinorMoney(minor, data?.currency ?? "EGP");
  const months = data ? Math.max(0, ...data.cohorts.map((c) => c.retention.length)) : 0;

  const topColumns: Column<TopRow>[] = [
    {
      key: "name",
      header: t.customer,
      cell: (row) => (
        <Link to={`/customers/${row.customerId}`} className="font-medium text-ink hover:text-primary">
          {row.name || t.unnamed}
        </Link>
      ),
    },
    { key: "orders", header: t.orders, align: "end", cell: (row) => formatCount(row.orders) },
    { key: "delivered", header: t.delivered, align: "end", cell: (row) => formatCount(row.delivered) },
    { key: "sales", header: t.sales, align: "end", cell: (row) => <span className="font-medium text-ink">{money(row.sales)}</span> },
  ];

  return (
    <DataState loading={loading && !data} error={error} onRetry={reload}>
      {data && (
        <div className="space-y-5">
          <KpiGrid
            cells={[
              { key: "new", label: t.newCustomers, value: formatCount(data.window.newCustomers), hint: t.inPeriod },
              { key: "returning", label: t.returningCustomers, value: formatCount(data.window.returningCustomers), hint: t.inPeriod },
              { key: "rate", label: t.returningRate, value: formatRate(data.window.returningCustomerRate), hint: t.inPeriod },
              { key: "repeat", label: t.repeatRate, value: formatRate(data.lifetime.repeatRate), hint: t.repeatHint },
              {
                key: "ltv",
                label: t.lifetimeValue,
                value: <bdi dir="ltr">{money(data.lifetime.averageLifetimeValue)}</bdi>,
                hint: t.lifetimeHint.replace("{n}", String(data.lifetime.averageOrders)),
              },
              {
                key: "second",
                label: t.secondOrder,
                value:
                  data.lifetime.averageDaysToSecondOrder === null
                    ? "—"
                    : t.days.replace("{n}", formatCount(data.lifetime.averageDaysToSecondOrder)),
              },
            ]}
          />

          <div className="grid gap-5 lg:grid-cols-3">
            <Section title={t.split} description={t.splitHint}>
              <SplitBar
                parts={[
                  { label: t.newCustomers, value: data.window.newSales, display: money(data.window.newSales), className: "bg-primary" },
                  {
                    label: t.returningCustomers,
                    value: data.window.returningSales,
                    display: money(data.window.returningSales),
                    className: "bg-accent",
                  },
                ]}
              />
            </Section>

            <Section title={t.cohorts} description={t.cohortsHint} className="lg:col-span-2">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[30rem] border-separate border-spacing-1 text-sm">
                  <thead>
                    <tr className="text-xs text-ink-soft">
                      <th className="px-2 py-1 text-start font-medium">{t.cohort}</th>
                      <th className="px-2 py-1 text-end font-medium">{t.size}</th>
                      {Array.from({ length: months }, (_, i) => (
                        <th key={i} className="px-2 py-1 text-center font-medium">
                          {t.month.replace("{n}", String(i + 1))}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.cohorts.map((row) => (
                      <tr key={row.cohort}>
                        <td className="px-2 py-1.5 font-medium whitespace-nowrap text-ink">{cohortLabel(row.cohort)}</td>
                        <td className="px-2 py-1.5 text-end tabular-nums text-ink">{formatCount(row.size)}</td>
                        {Array.from({ length: months }, (_, i) => {
                          const value = row.retention[i];
                          const known = value !== undefined && value !== null;
                          return (
                            <td
                              key={i}
                              className={cn("rounded-md px-2 py-1.5 text-center tabular-nums", known ? "text-ink" : "text-ink-soft/40")}
                              style={known ? { backgroundColor: `color-mix(in srgb, var(--color-primary) ${Math.min(70, 6 + value * 0.9)}%, transparent)` } : undefined}
                            >
                              {known ? formatRate(value) : "·"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.cohorts.length === 0 && <p className="mt-2 text-sm text-ink-soft">{t.empty}</p>}
              </div>
            </Section>
          </div>

          <Section
            title={t.top}
            description={t.topHint}
            flush
            actions={<ExportButton workspaceId={workspaceId} report="customers" range={range} onError={onError} />}
          >
            <DataTable
              phoneCards={false}
              columns={topColumns}
              rows={data.topCustomers}
              rowKey={(row) => row.customerId}
              minWidth="34rem"
              empty={<p className="px-4 pb-4 text-sm text-ink-soft">{t.empty}</p>}
            />
          </Section>
        </div>
      )}
    </DataState>
  );
}
