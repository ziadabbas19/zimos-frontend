import { useId, useState } from "react";
import { Lock } from "lucide-react";
import { Alert, Button, Spinner, cn } from "@store-builder/ui";
import {
  ordersExportColumns,
  ordersExportCsv,
  ordersExportTooLarge,
  type OrderExportCatalogue,
  type OrderExportParams,
  type OrderExportRowPer,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { isPermissionError } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { fmt, useCommon, useLocale, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Export orders",
    description: "Download the orders on this screen as a CSV file, with the stage, search, dates and sort you picked.",
    rowsLabel: "One row per",
    rowPerOrder: "Order",
    rowPerItem: "Product line",
    langLabel: "File language",
    langAr: "Arabic",
    langEn: "English",
    columnsLabel: "Columns",
    resetColumns: "Back to the default columns",
    contactLocked: "Needs permission to see customers' contact details",
    maxRows: "Up to {n} rows per file. For more, narrow the dates.",
    download: "Download CSV",
    downloading: "Preparing…",
    downloaded: "Your file is downloading.",
    tooLarge: "This export has {rows} rows, and a file holds up to {max}. Narrow the dates or filters and try again.",
    noColumns: "Pick at least one column.",
    catalogueError: "Couldn't load the export options.",
    noPermission: "You don't have permission to export orders, or to some of these columns. Ask an owner to update your role.",
  },
  ar: {
    title: "تصدير الطلبات",
    description: "نزّل الطلبات المعروضة في ملف CSV، بالمرحلة والبحث والتواريخ والترتيب التي اخترتها.",
    rowsLabel: "صف لكل",
    rowPerOrder: "طلب",
    rowPerItem: "منتج في الطلب",
    langLabel: "لغة الملف",
    langAr: "العربية",
    langEn: "الإنجليزية",
    columnsLabel: "الأعمدة",
    resetColumns: "العودة إلى الأعمدة الافتراضية",
    contactLocked: "يتطلب صلاحية عرض بيانات تواصل العملاء",
    maxRows: "حتى {n} صف في الملف الواحد. لأكثر من ذلك، ضيّق نطاق التواريخ.",
    download: "تنزيل ملف CSV",
    downloading: "جارٍ التجهيز…",
    downloaded: "جارٍ تنزيل الملف.",
    tooLarge: "يحتوي هذا التصدير على {rows} صف، والحد الأقصى للملف {max}. ضيّق التواريخ أو التصفية ثم حاول مرة أخرى.",
    noColumns: "اختر عمودًا واحدًا على الأقل.",
    catalogueError: "تعذّر تحميل خيارات التصدير.",
    noPermission: "ليست لديك صلاحية تصدير الطلبات أو بعض هذه الأعمدة. اطلب من المالك تحديث دورك.",
  },
} satisfies Messages;

/** The orders list's filters, as the export takes them. */
export type OrderExportFilters = Pick<OrderExportParams, "stage" | "q" | "from" | "to" | "sort">;

/** Saves `blob` under `filename` through a temporary link. */
function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * The CSV export dialog: row shape, file language and columns, drawn from the
 * server's catalogue (GET /orders/export/columns) — which also says which
 * contact columns this caller may take. The file follows the list's filters.
 */
export function OrderExportDialog({
  open,
  onClose,
  filters,
}: {
  open: boolean;
  onClose: () => void;
  filters: OrderExportFilters;
}) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const common = useCommon();
  const { locale } = useLocale();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const rowsId = useId();
  const langId = useId();

  const catalogue = useAsync<OrderExportCatalogue | null>(
    () => (open ? ordersExportColumns(apiClient, workspaceId) : Promise.resolve(null)),
    [workspaceId, open]
  );
  const [rowPer, setRowPer] = useState<OrderExportRowPer>("order");
  const [lang, setLang] = useState<"en" | "ar">(locale);
  // Null: the catalogue's defaults for the row shape.
  const [picked, setPicked] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  const data = catalogue.data;
  const columns = data ? data.columns.filter((c) => rowPer === "item" || !c.perItem) : [];
  const chosen = picked ?? (data ? data.defaults[rowPer] : []);

  function close() {
    setFailure(null);
    onClose();
  }

  function toggle(key: string) {
    setFailure(null);
    setPicked(chosen.includes(key) ? chosen.filter((k) => k !== key) : [...chosen, key]);
  }

  async function download() {
    setBusy(true);
    setFailure(null);
    try {
      // In the catalogue's own order, whatever order they were ticked in.
      const ordered = columns.map((c) => c.key).filter((key) => chosen.includes(key));
      const blob = await ordersExportCsv(apiClient, workspaceId, { ...filters, rowPer, lang, columns: ordered });
      saveFile(blob, `orders-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success(t.downloaded);
      close();
    } catch (err) {
      setFailure(err);
    } finally {
      setBusy(false);
    }
  }

  const tooLarge = ordersExportTooLarge(failure);
  const failureText = failure
    ? tooLarge
      ? fmt(t.tooLarge, { rows: tooLarge.rows, max: tooLarge.maxRows })
      : isPermissionError(failure)
        ? t.noPermission
        : errorMessage(failure)
    : null;

  return (
    <Modal
      open={open}
      onClose={close}
      title={t.title}
      description={t.description}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" className="min-h-11" onClick={close}>
            {common.cancel}
          </Button>
          <Button className="min-h-11" onClick={download} disabled={!data || busy || chosen.length === 0}>
            {busy ? t.downloading : t.download}
          </Button>
        </>
      }
    >
      {catalogue.loading ? (
        <div role="status" className="flex min-h-[8rem] items-center justify-center text-ink-soft">
          <Spinner className="size-6" />
          <span className="sr-only">{common.loading}</span>
        </div>
      ) : catalogue.error ? (
        <Alert variant="danger" className="flex flex-col gap-3">
          <span>{isPermissionError(catalogue.error) ? t.noPermission : t.catalogueError}</span>
          {!isPermissionError(catalogue.error) && (
            <div>
              <Button size="sm" variant="outline" className="min-h-11" onClick={() => void catalogue.refresh()}>
                {common.retry}
              </Button>
            </div>
          )}
        </Alert>
      ) : data ? (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset>
              <legend id={rowsId} className="mb-2 text-sm font-medium text-ink">
                {t.rowsLabel}
              </legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby={rowsId}>
                {(["order", "item"] as const).map((value) => (
                  <label
                    key={value}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-2 rounded-[0.5rem] border px-3 text-sm",
                      rowPer === value ? "border-primary bg-primary-soft text-primary-dark dark:text-primary" : "border-line text-ink"
                    )}
                  >
                    <input
                      type="radio"
                      name={rowsId}
                      value={value}
                      checked={rowPer === value}
                      onChange={() => {
                        setRowPer(value);
                        setPicked(null);
                        setFailure(null);
                      }}
                      className="accent-[var(--color-primary)]"
                    />
                    {value === "order" ? t.rowPerOrder : t.rowPerItem}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend id={langId} className="mb-2 text-sm font-medium text-ink">
                {t.langLabel}
              </legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby={langId}>
                {(["ar", "en"] as const).map((value) => (
                  <label
                    key={value}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-2 rounded-[0.5rem] border px-3 text-sm",
                      lang === value ? "border-primary bg-primary-soft text-primary-dark dark:text-primary" : "border-line text-ink"
                    )}
                  >
                    <input
                      type="radio"
                      name={langId}
                      value={value}
                      checked={lang === value}
                      onChange={() => setLang(value)}
                      className="accent-[var(--color-primary)]"
                    />
                    {value === "ar" ? t.langAr : t.langEn}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">{t.columnsLabel}</legend>
            {picked !== null && (
              <div className="mb-1 flex justify-end">
                <button
                  type="button"
                  className="min-h-11 cursor-pointer text-sm font-medium text-primary hover:underline"
                  onClick={() => setPicked(null)}
                >
                  {t.resetColumns}
                </button>
              </div>
            )}
            <div className="grid max-h-72 grid-cols-1 gap-x-4 overflow-y-auto rounded-[0.5rem] border border-line p-2 sm:grid-cols-2">
              {columns.map((column) => (
                <label
                  key={column.key}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-md px-2 text-sm",
                    column.available ? "cursor-pointer text-ink hover:bg-paper" : "cursor-not-allowed text-ink-soft"
                  )}
                  title={column.available ? undefined : t.contactLocked}
                >
                  <input
                    type="checkbox"
                    checked={column.available && chosen.includes(column.key)}
                    disabled={!column.available}
                    onChange={() => toggle(column.key)}
                    className="size-4 accent-[var(--color-primary)]"
                  />
                  <span className="min-w-0 flex-1 truncate">{column.label[locale]}</span>
                  {!column.available && (
                    <>
                      <Lock className="size-3.5 shrink-0" aria-hidden />
                      <span className="sr-only">{t.contactLocked}</span>
                    </>
                  )}
                </label>
              ))}
            </div>
            {!data.canRevealSensitive && <p className="mt-2 text-xs text-ink-soft">{t.contactLocked}</p>}
          </fieldset>

          <p className="text-xs text-ink-soft">{fmt(t.maxRows, { n: data.maxRows.toLocaleString(locale === "ar" ? "ar-EG" : "en-US") })}</p>

          {chosen.length === 0 && <p className="text-sm text-danger">{t.noColumns}</p>}
          {failureText && <Alert variant="danger">{failureText}</Alert>}
        </div>
      ) : null}
    </Modal>
  );
}
