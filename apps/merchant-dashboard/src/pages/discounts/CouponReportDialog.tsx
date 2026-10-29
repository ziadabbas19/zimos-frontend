import { useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, ZLoader } from "@store-builder/ui";
import { couponsReport, couponsReportCsv, type CouponReport, type Discount } from "@store-builder/api-client";
import { IconDownload, IconLock } from "@/components/icons";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { apiClient } from "@/lib/apiClient";
import { formatCount } from "@/lib/analytics";
import { useErrorMessage } from "@/lib/errorMessages";
import { isPermissionError } from "@/lib/errors";
import { formatDateTime, formatMinorMoney } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { saveBlob } from "@/pages/analytics/storeReports/storeReportParts";
import { useIsDesktop } from "@/pages/orders/list/useIsDesktop";

/**
 * One coupon's report (GET /discounts/:id/report): how many orders used it,
 * the discount it gave, the revenue of those orders, how many customers and
 * how many were cancelled — then who used it, newest first, each order a
 * link to its page. «تنزيل CSV» saves the server's own file (up to 1000 uses).
 *
 * The customer's phone comes only to someone who may see customers, and a
 * locked order's contact comes masked; both are shown as the server sends them.
 */

const STRINGS = {
  en: {
    title: "Report: {code}",
    titleAutomatic: "Report: automatic discount",
    uses: "Uses",
    discountGiven: "Discount given",
    revenue: "Revenue",
    customers: "Customers",
    cancelled: "Cancelled",
    summary: "Summary",
    usesTitle: "Who used it",
    order: "Order",
    date: "Date",
    customer: "Customer",
    phone: "Phone",
    discount: "Discount",
    total: "Order total",
    state: "State",
    state_open: "Open",
    state_delivered: "Delivered",
    state_returned: "Returned",
    state_cancelled: "Cancelled",
    none: "No order has used it yet.",
    latest: "The latest {n} uses are shown; the file holds up to 1,000.",
    locked: "Contact hidden while the order is locked",
    denied: "Your role can't see this report.",
    download: "Download CSV",
    downloading: "Preparing…",
    close: "Close",
    loading: "Loading the report",
  },
  ar: {
    title: "تقرير «{code}»",
    titleAutomatic: "تقرير الخصم التلقائي",
    uses: "الاستخدامات",
    discountGiven: "قيمة الخصم",
    revenue: "المبيعات",
    customers: "العملاء",
    cancelled: "الملغاة",
    summary: "الملخص",
    usesTitle: "من استخدمه",
    order: "الطلب",
    date: "التاريخ",
    customer: "العميل",
    phone: "الهاتف",
    discount: "الخصم",
    total: "إجمالي الطلب",
    state: "الحالة",
    state_open: "مفتوح",
    state_delivered: "تم التسليم",
    state_returned: "مرتجع",
    state_cancelled: "ملغى",
    none: "لم يستخدمه أي طلب بعد.",
    latest: "تظهر أحدث الاستخدامات ({n})، ويضم الملف حتى 1000 استخدام.",
    locked: "بيانات التواصل مخفية ما دام الطلب مقفلًا",
    denied: "صلاحياتك لا تسمح بعرض هذا التقرير.",
    download: "تنزيل CSV",
    downloading: "جارٍ التجهيز…",
    close: "إغلاق",
    loading: "جارٍ تحميل التقرير",
  },
} satisfies Messages;

type Use = CouponReport["uses"][number];

const STATE_TONE: Record<Use["orderState"], "info" | "success" | "danger" | "neutral"> = {
  open: "info",
  delivered: "success",
  returned: "danger",
  cancelled: "neutral",
};

/** The server's own size of a report page: a full one means there may be more in the file. */
const PAGE = 200;

/** The file's name: the code, kept to what any file system takes. */
export function reportFileName(discount: Pick<Discount, "code">): string {
  const code = (discount.code ?? "").replace(/[^A-Za-z0-9_-]/g, "");
  return `coupon-${code || "automatic"}.csv`;
}

export function CouponReportDialog({ discount, onClose }: { discount: Discount; onClose: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const desktop = useIsDesktop();
  const report = useAsync(() => couponsReport(apiClient, workspaceId, discount.id), [workspaceId, discount.id]);
  const [downloading, setDownloading] = useState(false);

  async function download() {
    setDownloading(true);
    try {
      saveBlob(await couponsReportCsv(apiClient, workspaceId, discount.id), reportFileName(discount));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDownloading(false);
    }
  }

  const data = report.data;
  const denied = report.error != null && isPermissionError(report.error);

  return (
    <Modal
      open
      onClose={onClose}
      title={discount.code ? fmt(t.title, { code: discount.code }) : t.titleAutomatic}
      className="sm:max-w-[46rem] md:max-w-[56rem]"
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" onClick={onClose}>
            {t.close}
          </Button>
          <Button type="button" className="rounded-full px-5" disabled={downloading || denied} onClick={() => void download()}>
            <IconDownload className="size-4" aria-hidden />
            {downloading ? t.downloading : t.download}
          </Button>
        </>
      }
    >
      {report.loading ? (
        <div className="flex justify-center py-8">
          <ZLoader size="sm" label={t.loading} />
        </div>
      ) : report.error != null || !data ? (
        <Alert variant="danger">{denied ? t.denied : errorMessage(report.error)}</Alert>
      ) : (
        <div className="space-y-5">
          <Summary report={data} />
          <section aria-label={t.usesTitle} className="space-y-2">
            <h3 className="text-[13px] leading-5 font-semibold text-ink">{t.usesTitle}</h3>
            {data.uses.length === 0 ? (
              <p className="text-sm text-ink-soft">{t.none}</p>
            ) : desktop ? (
              <UsesTable uses={data.uses} />
            ) : (
              <UsesList uses={data.uses} />
            )}
            {data.uses.length >= PAGE && <p className="text-xs text-ink-soft">{fmt(t.latest, { n: formatCount(data.uses.length) })}</p>}
          </section>
        </div>
      )}
    </Modal>
  );
}

/** The five figures; money in the currency of the coupon's orders. */
function Summary({ report }: { report: CouponReport }) {
  const t = useT(STRINGS);
  const currency = report.uses[0]?.currency ?? "EGP";
  const figures = [
    { key: "uses", label: t.uses, value: formatCount(report.summary.uses) },
    { key: "discountGiven", label: t.discountGiven, value: formatMinorMoney(report.summary.discountGiven, currency) },
    { key: "revenue", label: t.revenue, value: formatMinorMoney(report.summary.revenue, currency) },
    { key: "customers", label: t.customers, value: formatCount(report.summary.customers) },
    { key: "cancelled", label: t.cancelled, value: formatCount(report.summary.cancelled) },
  ];
  return (
    <dl aria-label={t.summary} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {figures.map((figure) => (
        <div key={figure.key} className="min-w-0 rounded-[1rem] bg-paper-sunken px-3 py-2.5">
          <dt className="truncate text-xs text-ink-soft">{figure.label}</dt>
          <dd className="mt-0.5 truncate text-base font-semibold text-ink tabular-nums">
            <bdi>{figure.value}</bdi>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function OrderLink({ use }: { use: Use }) {
  return (
    <Link to={`/orders/${use.orderId}`} className="font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
      <bdi dir="ltr">{use.orderNumber}</bdi>
    </Link>
  );
}

function Customer({ use }: { use: Use }) {
  const t = useT(STRINGS);
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      {use.contactLocked && (
        <>
          <IconLock className="size-3.5 shrink-0 text-ink-soft" aria-hidden />
          <span className="sr-only">{t.locked}</span>
        </>
      )}
      <bdi className="truncate">{use.customerName || "—"}</bdi>
    </span>
  );
}

function StateBadge({ use }: { use: Use }) {
  const t = useT(STRINGS);
  return <StatusBadge value={use.orderState} tone={STATE_TONE[use.orderState]} text={t[`state_${use.orderState}`]} />;
}

/** From md up: one row per use. */
function UsesTable({ uses }: { uses: Use[] }) {
  const t = useT(STRINGS);
  const head = "px-3 py-2.5 text-start font-medium whitespace-nowrap";
  return (
    <div className="overflow-x-auto rounded-[1rem] ring-1 ring-line">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-paper-sunken/60 text-xs text-ink-soft">
            <th scope="col" className={head}>{t.order}</th>
            <th scope="col" className={head}>{t.date}</th>
            <th scope="col" className={head}>{t.customer}</th>
            <th scope="col" className={head}>{t.phone}</th>
            <th scope="col" className={`${head} text-end`}>{t.discount}</th>
            <th scope="col" className={`${head} text-end`}>{t.total}</th>
            <th scope="col" className={head}>{t.state}</th>
          </tr>
        </thead>
        <tbody>
          {uses.map((use) => (
            <tr key={`${use.orderId}-${use.usedAt}`} className="border-b border-line last:border-b-0">
              <td className="px-3 py-2">
                <OrderLink use={use} />
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-ink-soft">{formatDateTime(use.usedAt)}</td>
              <td className="max-w-48 px-3 py-2 text-ink">
                <Customer use={use} />
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-ink-soft">
                <bdi dir="ltr">{use.customerPhone || "—"}</bdi>
              </td>
              <td className="px-3 py-2 text-end whitespace-nowrap text-ink tabular-nums">
                <bdi>{formatMinorMoney(use.discountAmount, use.currency)}</bdi>
              </td>
              <td className="px-3 py-2 text-end whitespace-nowrap text-ink tabular-nums">
                <bdi>{formatMinorMoney(use.orderTotal, use.currency)}</bdi>
              </td>
              <td className="px-3 py-2">
                <StateBadge use={use} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** On a phone: one card per use, the order and its state first. */
function UsesList({ uses }: { uses: Use[] }) {
  const t = useT(STRINGS);
  return (
    <ul className="space-y-2">
      {uses.map((use) => (
        <li key={`${use.orderId}-${use.usedAt}`} className="space-y-1 rounded-[1rem] px-3 py-2.5 ring-1 ring-line">
          <div className="flex items-center justify-between gap-2">
            <OrderLink use={use} />
            <StateBadge use={use} />
          </div>
          <div className="flex min-w-0 items-center justify-between gap-2 text-sm text-ink">
            <Customer use={use} />
            <bdi dir="ltr" className="shrink-0 text-xs text-ink-soft">
              {use.customerPhone || "—"}
            </bdi>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 text-xs text-ink-soft">
            <span>{formatDateTime(use.usedAt)}</span>
            <span className="tabular-nums">
              <bdi>
                {t.discount} {formatMinorMoney(use.discountAmount, use.currency)} · {t.total} {formatMinorMoney(use.orderTotal, use.currency)}
              </bdi>
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
