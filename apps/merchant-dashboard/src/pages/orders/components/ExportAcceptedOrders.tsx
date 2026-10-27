import { useEffect, useState } from "react";
import { Alert, Button, ZLoader } from "@store-builder/ui";
import { exportFileStartOrders, type OrderExportParams, type OrderStage } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { useOrderLabels } from "../orderLabels";

const STRINGS = {
  en: {
    title: "Export accepted orders",
    description:
      "Accepted orders: cash-on-delivery orders once confirmed, online orders once paid. Cancelled orders are left out. The columns are always the same, ready for your accountant or a sheet.",
    columns:
      "Order number, date, customer, phone, address, products with quantities, options and prices, delivery, discount, total, currency, payment method, payment state.",
    from: "From",
    to: "To",
    stage: "Stage",
    allStages: "All stages",
    format: "File format",
    masked: "Phone numbers are partly hidden in the file unless your role may see customers' full numbers.",
    direct: "Up to {days} days and {orders} orders download now; anything larger is prepared in the background and the link reaches your notifications.",
    datesNeeded: "Pick a start and an end date.",
    datesOrder: "The start date must come before the end date.",
    cancel: "Cancel",
    download: "Export",
    working: "Preparing…",
    done: "Your file was downloaded.",
    queued: "The file is large, so we're preparing it in the background. You'll get a notification with the link.",
    unavailable: "This export is not available yet. Try again later.",
  },
  ar: {
    title: "تصدير الطلبات المؤكدة",
    description:
      "الطلبات المؤكدة: طلبات الدفع عند الاستلام بعد تأكيدها، والطلبات المدفوعة أونلاين بعد الدفع. الطلبات الملغاة لا تدخل. الأعمدة ثابتة دائمًا، جاهزة للمحاسب أو لجدول بيانات.",
    columns:
      "رقم الطلب، التاريخ، العميل، الموبايل، العنوان، المنتجات بالكميات والإضافات والأسعار، الشحن، الخصم، الإجمالي، العملة، طريقة الدفع، حالة الدفع.",
    from: "من",
    to: "إلى",
    stage: "المرحلة",
    allStages: "كل المراحل",
    format: "صيغة الملف",
    masked: "أرقام الموبايل تظهر مخفية جزئيًا في الملف إلا إذا كان دورك يسمح برؤية أرقام العملاء كاملة.",
    direct: "حتى {days} يومًا و{orders} طلب يُنزَّل الملف فورًا، وما هو أكبر يُجهَّز في الخلفية ويصلك رابطه في الإشعارات.",
    datesNeeded: "اختر تاريخ البداية والنهاية.",
    datesOrder: "تاريخ البداية يجب أن يسبق تاريخ النهاية.",
    cancel: "إلغاء",
    download: "تصدير",
    working: "جارٍ التجهيز…",
    done: "تم تنزيل الملف.",
    queued: "الملف كبير، لذلك يُجهَّز في الخلفية. سيصلك إشعار بالرابط.",
    unavailable: "هذا التصدير غير متاح بعد. حاول لاحقًا.",
  },
} satisfies Messages;

// The stages an accepted order can be in (cancelled ones are never in the file).
const STAGES: OrderStage[] = ["ready_to_ship", "shipped", "out_for_delivery", "delivery_failed", "delivered", "returned"];

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const errorCode = (err: unknown) => (err && typeof err === "object" && "code" in err ? String((err as { code?: unknown }).code) : "");

/**
 * The accepted orders as a CSV or Excel file with fixed columns (the API's
 * `preset=accepted`), for a date range and a stage. A short range downloads
 * now; the API answers 413 EXPORT_TOO_LARGE past its limits, and the same
 * file is then prepared in the background.
 */
export function ExportAcceptedOrdersDialog({
  initial,
  onClose,
}: {
  /** The orders list's dates and stage, when it has them. */
  initial?: { from?: string; to?: string; stage?: OrderStage };
  onClose: () => void;
}) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const labels = useOrderLabels();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const weekAgo = isoDay(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
  const [from, setFrom] = useState(initial?.from?.slice(0, 10) || weekAgo);
  const [to, setTo] = useState(initial?.to?.slice(0, 10) || isoDay(new Date()));
  const [stage, setStage] = useState<OrderStage | "">(initial?.stage && STAGES.includes(initial.stage) ? initial.stage : "");
  const [format, setFormat] = useState<"csv" | "xlsx">("csv");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The server says it has the preset (an older API would ignore `preset` and export every order) and its limits.
  const [direct, setDirect] = useState<{ maxDays: number; maxOrders: number } | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getOrderExportColumns(workspaceId)
      .then((catalogue) => {
        if (cancelled) return;
        setSupported(Boolean(catalogue.presets?.accepted));
        setDirect(catalogue.direct ?? null);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
    // errorMessage is stable per locale; loaded once per open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  async function submit() {
    if (!supported) return;
    if (!from || !to) return setError(t.datesNeeded);
    if (from > to) return setError(t.datesOrder);
    setBusy(true);
    setError(null);
    const params: OrderExportParams = { preset: "accepted", from, to, ...(stage ? { stage } : {}), lang: locale === "ar" ? "ar" : "en", format };
    try {
      const blob = await apiClient.exportOrdersCsv(workspaceId, params);
      saveBlob(blob, `orders-accepted-${isoDay(new Date())}.${format}`);
      toast.success(t.done);
      onClose();
    } catch (err) {
      if (errorCode(err) !== "EXPORT_TOO_LARGE") {
        setError(errorMessage(err));
        setBusy(false);
        return;
      }
      try {
        await exportFileStartOrders(apiClient, workspaceId, params);
        toast.success(t.queued);
        onClose();
      } catch (second) {
        setError(errorMessage(second));
      }
    } finally {
      setBusy(false);
    }
  }

  const field = "min-h-11 w-full rounded-md border border-line bg-paper-raised px-3 text-sm text-ink";

  return (
    <Modal
      open
      onClose={busy ? () => undefined : onClose}
      title={t.title}
      description={t.description}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t.cancel}
          </Button>
          <Button onClick={() => void submit()} disabled={busy || !supported}>
            {busy ? t.working : t.download}
          </Button>
        </>
      }
    >
      {supported === null && !error ? (
        <div className="flex justify-center py-8">
          <ZLoader size="sm" />
        </div>
      ) : supported === false ? (
        <Alert variant="destructive">{t.unavailable}</Alert>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">{t.columns}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-ink">
              <span className="mb-1 block font-medium">{t.from}</span>
              <input type="date" dir="ltr" className={field} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="block text-sm text-ink">
              <span className="mb-1 block font-medium">{t.to}</span>
              <input type="date" dir="ltr" className={field} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
          <label className="block text-sm text-ink">
            <span className="mb-1 block font-medium">{t.stage}</span>
            <select className={field} value={stage} onChange={(e) => setStage(e.target.value as OrderStage | "")}>
              <option value="">{t.allStages}</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {labels.stage(s)}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">{t.format}</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {(["csv", "xlsx"] as const).map((kind) => (
                <label key={kind} className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                  <input type="radio" name="accepted-export-format" checked={format === kind} onChange={() => setFormat(kind)} />
                  {kind === "csv" ? "CSV" : "Excel (.xlsx)"}
                </label>
              ))}
            </div>
          </fieldset>
          {direct && <p className="text-xs text-ink-soft">{fmt(t.direct, { days: direct.maxDays, orders: direct.maxOrders.toLocaleString() })}</p>}
          <p className="text-xs text-ink-soft">{t.masked}</p>
          {error && <Alert variant="destructive">{error}</Alert>}
        </div>
      )}
    </Modal>
  );
}
