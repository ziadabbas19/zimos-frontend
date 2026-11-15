import { STORE_REPORTS_ENABLED } from "@/lib/features";
import { StoreReportsMenu } from "@/pages/analytics/storeReports/StoreReportsMenu";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, Info, Lightbulb, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { reportsGetInsights, type ReportsInsight } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { FilterTabs } from "@/components/FilterTabs";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { apiClient } from "@/lib/apiClient";
import { formatCount, formatWindow } from "@/lib/analytics";
import { formatMinorMoney } from "@/lib/format";
import { useReport, useReportRange, type ReportRange } from "@/lib/reportRange";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { CustomersTab, DeliveryTab, ProductsTab } from "./DetailTabs";
import { OverviewTab } from "./OverviewTab";
import { DateRangeControl, ExportButton, formatRate } from "./parts";

const STRINGS = {
  en: {
    title: "Analytics",
    description: "Sales, products, delivery and customers — for {window}.",
    tabs: "Report",
    overview: "Overview",
    products: "Products",
    delivery: "Delivery",
    customers: "Customers",
    insights: "What the numbers say",
    days: "Sunday,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday",
    step_product: "product page",
    step_cart: "add to cart",
    step_checkout: "checkout",
    step_purchase: "order",
    sales_up: "Sales are up {percent}% on the comparison period: {value} against {previous}.",
    sales_down: "Sales are down {percent}% on the comparison period: {value} against {previous}.",
    conversion_up: "Conversion rose {percent}% — {rate} of sessions now order.",
    conversion_down: "Conversion fell {percent}% — only {rate} of sessions order now.",
    funnel_leak: "The biggest drop is at the {step} step: only {rate} of the sessions before it continue.",
    low_confirmation: "Only {rate} of {orders} cash-on-delivery orders were confirmed. Call sooner or ask for a deposit.",
    weak_governorate: "{name} delivers {rate} of its orders, against {average} overall ({orders} shipped). Consider prepayment there.",
    strong_governorate: "{name} is your most reliable area: {rate} delivered, against {average} overall.",
    carrier_gap: "{best} delivers {bestRate}; {worst} only {worstRate}. Move more orders to {best}.",
    low_converting_product: "{name} was viewed {views} times but converts at {rate} (average {average}). Check its price, photos and offer.",
    high_return_product: "{name} comes back {rate} of the time. Check the description and the packaging.",
    abandoned_uncontacted: "{count} lost orders worth {value} have not been contacted yet.",
    peak_time: "Orders peak on {day} around {hour}:00 — schedule campaigns and confirmation calls for then.",
    returning_share: "{rate} of buyers were returning customers, and they brought {sales}.",
    openLost: "Open lost orders",
    openProduct: "Open the product",
  },
  ar: {
    title: "التحليلات",
    description: "المبيعات والمنتجات والتوصيل والعملاء — عن {window}.",
    tabs: "التقرير",
    overview: "نظرة عامة",
    products: "المنتجات",
    delivery: "التوصيل",
    customers: "العملاء",
    insights: "ماذا تقول الأرقام",
    days: "الأحد,الإثنين,الثلاثاء,الأربعاء,الخميس,الجمعة,السبت",
    step_product: "صفحة المنتج",
    step_cart: "الإضافة للسلة",
    step_checkout: "إتمام الطلب",
    step_purchase: "الطلب",
    sales_up: "المبيعات زادت {percent}% عن فترة المقارنة: {value} مقابل {previous}.",
    sales_down: "المبيعات قلّت {percent}% عن فترة المقارنة: {value} مقابل {previous}.",
    conversion_up: "معدل التحويل زاد {percent}% — {rate} من الزيارات تطلب الآن.",
    conversion_down: "معدل التحويل قلّ {percent}% — {rate} فقط من الزيارات تطلب الآن.",
    funnel_leak: "أكبر تسرّب عند خطوة {step}: {rate} فقط من الزيارات السابقة لها تكمل.",
    low_confirmation: "{rate} فقط من {orders} طلب دفع عند الاستلام تم تأكيدها. اتصل أسرع أو اطلب عربونًا.",
    weak_governorate: "{name} يُسلَّم فيها {rate} من الطلبات مقابل {average} في المتوسط ({orders} طلب مشحون). فكّر في الدفع المسبق هناك.",
    strong_governorate: "{name} أكثر منطقة موثوقة عندك: {rate} تسليم مقابل {average} في المتوسط.",
    carrier_gap: "{best} تسلّم {bestRate}، و{worst} {worstRate} فقط. حوّل طلبات أكثر إلى {best}.",
    low_converting_product: "{name} شوهد {views} مرة لكن تحويله {rate} (المتوسط {average}). راجع السعر والصور والعرض.",
    high_return_product: "{name} يرجع بنسبة {rate}. راجع الوصف والتغليف.",
    abandoned_uncontacted: "{count} طلب مفقود بقيمة {value} لم يتم التواصل معهم بعد.",
    peak_time: "ذروة الطلبات يوم {day} حوالي الساعة {hour}:00 — جدول الحملات ومكالمات التأكيد في هذا الوقت.",
    returning_share: "{rate} من المشترين عملاء عائدون، وجلبوا {sales}.",
    openLost: "افتح الطلبات المفقودة",
    openProduct: "افتح المنتج",
  },
} satisfies Messages;

type Tab = "overview" | "products" | "delivery" | "customers";
const TABS: Tab[] = ["overview", "products", "delivery", "customers"];

const TONE: Record<ReportsInsight["tone"], { icon: LucideIcon; className: string }> = {
  good: { icon: TrendingUp, className: "bg-success-soft text-success" },
  bad: { icon: TrendingDown, className: "bg-danger-soft text-danger" },
  warn: { icon: AlertTriangle, className: "bg-accent-soft text-accent-dark" },
  info: { icon: Info, className: "bg-primary-soft text-primary" },
};

/** Plain sentences drawn from the reports: what moved, where it leaks, what to do. */
function Insights({ workspaceId, range }: { workspaceId: string; range: ReportRange }) {
  const t = useT(STRINGS);
  const { data } = useReport(
    () => reportsGetInsights(apiClient, workspaceId, { from: range.from, to: range.to }),
    [workspaceId, range.from, range.to]
  );
  if (!data || data.insights.length === 0) return null;
  const money = (value: unknown) => formatMinorMoney(Number(value ?? 0), data.currency);
  const rate = (value: unknown) => formatRate(value === null || value === undefined ? null : Number(value));

  function sentence(insight: ReportsInsight): string {
    const p = insight.params;
    const values: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(p)) {
      if (value === null) continue;
      if (/rate|average/i.test(key)) values[key] = rate(value);
      else if (key === "value" || key === "previous" || key === "sales") values[key] = money(value);
      else if (typeof value === "number") values[key] = formatCount(value);
      else values[key] = value;
    }
    if (insight.key === "funnel_leak") values.step = t[`step_${String(p.step)}` as keyof typeof t] ?? String(p.step);
    if (insight.key === "peak_time") {
      values.day = t.days.split(",")[Number(p.dow)] ?? "";
      values.hour = String(p.hour);
    }
    if (insight.key === "sales_up" || insight.key === "sales_down" || insight.key.startsWith("conversion")) {
      values.percent = String(p.percent);
    }
    return fmt(t[insight.key], values);
  }

  return (
    <section aria-label={t.insights} className="mb-5 rounded-xl border border-line bg-paper-raised p-4 shadow-[var(--shadow-card)]">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Lightbulb className="size-4 text-accent-dark" aria-hidden />
        {t.insights}
      </h2>
      <ul className="mt-3 grid gap-2.5 lg:grid-cols-2">
        {data.insights.map((insight) => {
          const tone = TONE[insight.tone];
          const link =
            insight.key === "abandoned_uncontacted"
              ? { to: "/abandoned-carts", label: t.openLost }
              : insight.params.productId
                ? { to: `/catalog/${insight.params.productId}`, label: t.openProduct }
                : null;
          return (
            <li key={insight.key} className="flex items-start gap-3 text-sm">
              <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg", tone.className)}>
                <tone.icon className="size-4" aria-hidden />
              </span>
              <p className="min-w-0 leading-relaxed text-ink">
                {sentence(insight)}
                {link && (
                  <Link to={link.to} className="ms-1.5 font-medium whitespace-nowrap text-primary hover:underline">
                    {link.label}
                  </Link>
                )}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ReportsPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { range, setPreset, setDays, setCompare } = useReportRange();
  const requested = params.get("tab") as Tab | null;
  const tab: Tab = requested && TABS.includes(requested) ? requested : "overview";

  function selectTab(next: Tab) {
    setParams(
      (prev) => {
        const copy = new URLSearchParams(prev);
        if (next === "overview") copy.delete("tab");
        else copy.set("tab", next);
        return copy;
      },
      { replace: true }
    );
  }

  return (
    <div>
      <PageHeader
        title={t.title}
        description={fmt(t.description, { window: formatWindow(range.from, range.to) })}
        actions={
          tab === "overview" ? (
            <ExportButton workspaceId={workspaceId} report="sales" range={range} onError={toast.error} />
          ) : undefined
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          label={t.tabs}
          value={tab}
          onChange={selectTab}
          tabs={TABS.map((value) => ({ value, label: t[value] }))}
        />
        <DateRangeControl
          range={range}
          onPreset={setPreset}
          onDays={setDays}
          onCompare={setCompare}
          showCompare={tab === "overview"}
        />
      </div>

      {tab === "overview" && (
        <>
          <Insights workspaceId={workspaceId} range={range} />
          <OverviewTab workspaceId={workspaceId} range={range} />
        </>
      )}
      {tab === "products" && <ProductsTab workspaceId={workspaceId} range={range} onError={toast.error} />}
      {tab === "delivery" && <DeliveryTab workspaceId={workspaceId} range={range} onError={toast.error} />}
      {tab === "customers" && <CustomersTab workspaceId={workspaceId} range={range} onError={toast.error} />}

      {/* The accounting and stock reports that have their own pages (lib/features). */}
      {STORE_REPORTS_ENABLED && <StoreReportsMenu />}
    </div>
  );
}
