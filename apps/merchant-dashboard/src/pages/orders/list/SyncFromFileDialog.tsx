import { useEffect, useId, useRef, useState } from "react";
import { Alert, Button } from "@store-builder/ui";
import { ordersImportTracking, type OrderTrackingImportResult } from "@store-builder/api-client";
import { IconFileUp } from "@/components/icons";
import { Modal } from "@/components/Modal";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useDocumentError } from "./orderDocuments";

const STRINGS = {
  en: {
    title: "Update tracking from a file",
    description:
      "Upload the CSV file your courier sent. Columns: order_number (required), tracking_number, tracking_url, carrier, status.",
    statuses: "Status can be: shipped, out_for_delivery, delivered, failed, returned.",
    choose: "Choose a CSV file",
    template: "Download a sample file",
    uploading: "Reading the file…",
    resultOk: "{count} rows applied.",
    resultFailed: "{count} rows could not be applied:",
    line: "Line {line}",
    close: "Close",
  },
  ar: {
    title: "تحديث التتبع من ملف",
    description:
      "ارفع ملف CSV الذي أرسلته شركة الشحن. الأعمدة: order_number (مطلوب)، tracking_number، tracking_url، carrier، status.",
    statuses: "الحالة يمكن أن تكون: shipped، out_for_delivery، delivered، failed، returned.",
    choose: "اختر ملف CSV",
    template: "تحميل ملف نموذجي",
    uploading: "جارٍ قراءة الملف…",
    resultOk: "تم تطبيق {count} صف.",
    resultFailed: "تعذّر تطبيق {count} صف:",
    line: "السطر {line}",
    close: "إغلاق",
  },
} satisfies Messages;

const SAMPLE =
  "order_number,tracking_number,tracking_url,carrier,status\nORD-XXXX-XXXX,AWB-1001,https://courier.example/track/AWB-1001,Courier name,shipped\n";

/**
 * "Sync from file": the courier's sheet, as CSV, updates the tracking and the
 * status of the orders it names. Says how many rows were applied and, for
 * each row that was not, its line, its order number and why. Opened from the
 * list's "Tools" menu. The file's text goes to the API as it is.
 */
export function SyncFromFileDialog({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const errorMessage = useDocumentError();
  const fileId = useId();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OrderTrackingImportResult | null>(null);

  // Every opening starts clean: the last file's result is not this one's.
  useEffect(() => {
    if (open) {
      setError(null);
      setResult(null);
    }
  }, [open]);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const answer = await ordersImportTracking(apiClient, workspaceId, await file.text());
      setResult(answer);
      if (answer.succeeded > 0) onImported();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const failures = result ? result.results.filter((r) => !r.ok) : [];

  return (
    <Modal
      open={open}
      onClose={() => (busy ? undefined : onClose())}
      title={t.title}
      description={t.description}
      footer={
        <Button className="min-h-11 rounded-full px-5" variant="outline" onClick={onClose} disabled={busy}>
          {t.close}
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">{t.statuses}</p>
        {error && (
          <Alert variant="danger" role="alert">
            {error}
          </Alert>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            id={fileId}
            // Choosing a file is not typing in the dialog: closing it afterwards should not ask "leave without saving?".
            onInput={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <Button className="min-h-11 rounded-full px-5" disabled={busy} onClick={() => fileRef.current?.click()}>
            <IconFileUp className="size-4" aria-hidden />
            {busy ? t.uploading : t.choose}
          </Button>
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE)}`}
            download="tracking-sample.csv"
            className="inline-flex min-h-11 items-center text-sm font-medium text-primary-dark underline underline-offset-2 dark:text-primary"
          >
            {t.template}
          </a>
        </div>

        {result && (
          <div className="space-y-2 border-t border-line pt-3">
            <p className="text-sm text-ink">{fmt(t.resultOk, { count: result.succeeded })}</p>
            {failures.length > 0 && (
              <>
                <p className="text-sm font-medium text-danger">{fmt(t.resultFailed, { count: failures.length })}</p>
                <ul className="max-h-56 space-y-1 overflow-y-auto text-sm">
                  {failures.map((f) => (
                    <li key={f.line} className="flex flex-wrap gap-2">
                      <span className="text-ink-soft">{fmt(t.line, { line: f.line })}</span>
                      {f.orderNumber && (
                        <bdi dir="ltr" className="font-medium text-ink">
                          {f.orderNumber}
                        </bdi>
                      )}
                      <span className="text-ink-soft">{errorMessage({ code: f.code, message: f.message })}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
