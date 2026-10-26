import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, cn } from "@store-builder/ui";
import { ordersInvoicePdf, ordersMeta, ordersNeighbors, ordersUpdateMeta, type Order } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { CopyButton } from "@/components/CopyButton";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useOrderErrorMessage } from "../orderErrors";
import { lastOrdersListQuery } from "../orderListQuery";
import { KitchenTicketButton } from "./KitchenTicket";

const STRINGS = {
  en: {
    previous: "Previous order",
    next: "Next order",
    copyLink: "Copy customer link",
    invoice: "Invoice",
    invoicePreparing: "Preparing…",
    invoiceNone: "This order has no invoice yet: it is issued once the order is paid or placed as cash on delivery.",
    archive: "Archive",
    unarchive: "Restore from archive",
    archiveTitle: "Archive this order?",
    archiveDescription:
      "The order leaves the orders list and its counts. Nothing is deleted: you can find it under “Archived” and restore it.",
    archiveConfirm: "Archive order",
    keep: "Keep it",
    working: "Working…",
    archived: "Order archived.",
    unarchived: "Order restored.",
    markTest: "Mark as test",
    unmarkTest: "Not a test",
    testOn: "Marked as a test order. It no longer counts as a sale.",
    testOff: "No longer a test order.",
    badgeTest: "Test order",
    badgePickup: "Pickup from the store",
    badgeArchived: "Archived",
    source: "Source",
    source_store: "Store",
    source_funnel: "Funnel",
    source_manual: "Manual",
    source_api: "API",
    source_import: "Import",
    source_upsell: "Upsell",
  },
  ar: {
    previous: "الأوردر السابق",
    next: "الأوردر التالي",
    copyLink: "نسخ رابط العميل",
    invoice: "الفاتورة",
    invoicePreparing: "جارٍ التجهيز…",
    invoiceNone: "لا توجد فاتورة لهذا الأوردر بعد: تصدر عند الدفع أو عند طلبه بالدفع عند الاستلام.",
    archive: "أرشفة",
    unarchive: "استرجاع من الأرشيف",
    archiveTitle: "أرشفة هذا الأوردر؟",
    archiveDescription:
      "الأوردر يختفي من قائمة الأوردرات وأعدادها. لا يُحذف شيء: تجده تحت «المؤرشفة» ويمكنك استرجاعه.",
    archiveConfirm: "أرشفة الأوردر",
    keep: "إبقاء",
    working: "جارٍ التنفيذ…",
    archived: "تمت أرشفة الأوردر.",
    unarchived: "تم استرجاع الأوردر.",
    markTest: "تعليم كأوردر تجريبي",
    unmarkTest: "ليس تجريبيًا",
    testOn: "تم تعليمه كأوردر تجريبي ولن يُحسب ضمن المبيعات.",
    testOff: "لم يعد أوردرًا تجريبيًا.",
    badgeTest: "أوردر تجريبي",
    badgePickup: "استلام من المتجر",
    badgeArchived: "مؤرشف",
    source: "المصدر",
    source_store: "المتجر",
    source_funnel: "فانل",
    source_manual: "يدوي",
    source_api: "API",
    source_import: "استيراد",
    source_upsell: "عرض إضافي",
  },
} satisfies Messages;

/** Opening an order marks it seen, once. Failures are silent: it is bookkeeping. */
export function useMarkSeen(order: Order | null, onMarked: () => void) {
  const workspaceId = useWorkspaceId();
  const id = order?.id;
  const unseen = order ? !ordersMeta(order).isSeen : false;
  useEffect(() => {
    if (!id || !unseen) return;
    ordersUpdateMeta(apiClient, workspaceId, id, { isSeen: true }).then(onMarked, () => undefined);
    // Once per order opened; `onMarked` is not part of the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, id, unseen]);
}

/** Source, test and archived badges for the line under the page title. */
export function OrderMetaBadges({ order }: { order: Order }) {
  const t = useT(STRINGS);
  const meta = ordersMeta(order);
  return (
    <>
      <StatusBadge label={t.source} value={meta.source} tone="neutral" text={t[`source_${meta.source}`]} />
      {meta.isTest && <StatusBadge value="test" tone="warning" text={t.badgeTest} />}
      {order.deliveryMethod === "pickup" && <StatusBadge value="pickup" tone="info" text={t.badgePickup} />}
      {meta.archivedAt && <StatusBadge value="archived" tone="neutral" text={t.badgeArchived} />}
    </>
  );
}

/** Previous / next arrows, following the list the merchant came from. */
export function OrderNeighborArrows({ order }: { order: Order }) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const neighbors = useAsync(
    () => ordersNeighbors(apiClient, workspaceId, order.id, lastOrdersListQuery()),
    [workspaceId, order.id]
  );
  const arrow =
    "inline-flex size-11 items-center justify-center rounded-md border border-line bg-paper-raised text-ink-soft transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-primary";
  const link = (id: string | null | undefined, label: string, icon: React.ReactNode) =>
    id ? (
      <Link to={`/orders/${id}`} aria-label={label} title={label} className={arrow}>
        {icon}
      </Link>
    ) : (
      <span aria-hidden className={cn(arrow, "opacity-40")}>
        {icon}
      </span>
    );
  return (
    <div className="flex items-center gap-1">
      {link(neighbors.data?.prevId, t.previous, <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />)}
      {link(neighbors.data?.nextId, t.next, <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />)}
    </div>
  );
}

/** Copy the customer's tracking link, mark as test, archive / restore. */
export function OrderMetaActions({ order, onChanged }: { order: Order; onChanged: () => void }) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useOrderErrorMessage();
  const meta = ordersMeta(order);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [busy, setBusy] = useState(false);

  const trackingLink = `${STOREFRONT_URL}/store/${workspaceId}/track?number=${encodeURIComponent(order.orderNumber)}`;

  async function setArchived(archived: boolean) {
    await ordersUpdateMeta(apiClient, workspaceId, order.id, { archived });
    toast.success(archived ? t.archived : t.unarchived);
    setConfirmArchive(false);
    onChanged();
  }

  const [invoiceBusy, setInvoiceBusy] = useState(false);
  async function openInvoice() {
    setInvoiceBusy(true);
    try {
      const blob = await ordersInvoicePdf(apiClient, workspaceId, order.id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String((err as { code?: string }).code) : "";
      toast.error(code === "INVOICE_NOT_ISSUED" ? t.invoiceNone : errorMessage(err));
    } finally {
      setInvoiceBusy(false);
    }
  }

  async function toggleTest() {
    setBusy(true);
    try {
      await ordersUpdateMeta(apiClient, workspaceId, order.id, { isTest: !meta.isTest });
      toast.success(meta.isTest ? t.testOff : t.testOn);
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <CopyButton
        value={trackingLink}
        label={t.copyLink}
        className="min-h-11 rounded-md border border-line bg-paper-raised px-3 text-sm"
      />
      <Button variant="outline" size="sm" className="min-h-11" onClick={openInvoice} disabled={invoiceBusy}>
        {invoiceBusy ? t.invoicePreparing : t.invoice}
      </Button>
      <KitchenTicketButton order={order} />
      <Button variant="outline" size="sm" className="min-h-11" onClick={toggleTest} disabled={busy}>
        {meta.isTest ? t.unmarkTest : t.markTest}
      </Button>
      {meta.archivedAt ? (
        <Button
          variant="outline"
          size="sm"
          className="min-h-11"
          onClick={() => setArchived(false).catch((err) => toast.error(errorMessage(err)))}
        >
          {t.unarchive}
        </Button>
      ) : (
        <Button variant="outline" size="sm" className="min-h-11" onClick={() => setConfirmArchive(true)}>
          {t.archive}
        </Button>
      )}
      <ConfirmDialog
        open={confirmArchive}
        title={t.archiveTitle}
        description={t.archiveDescription}
        confirmLabel={t.archiveConfirm}
        cancelLabel={t.keep}
        busyLabel={t.working}
        onCancel={() => setConfirmArchive(false)}
        onConfirm={async () => {
          try {
            await setArchived(true);
          } catch (err) {
            throw new Error(errorMessage(err));
          }
        }}
      />
    </>
  );
}
