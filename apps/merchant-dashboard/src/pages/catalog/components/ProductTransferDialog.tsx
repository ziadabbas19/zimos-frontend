import { useEffect, useRef, useState } from "react";
import { Download, FileUp, Link2 } from "lucide-react";
import { Alert, Button, Input, Label, ZLoader } from "@store-builder/ui";
import {
  catalogExportProducts,
  catalogGetImport,
  catalogImportFile,
  catalogImportFromLink,
  catalogImportTemplate,
  type CatalogImport,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import {
  FOLLOW,
  isFinished,
  nextDelay,
  processed,
  progressKey,
  readFailure,
  RequestTimeout,
  stalled,
  withTimeout,
  type FollowStop,
} from "./importFollow";

/**
 * Import and export of products (SPEC §7.5): a JSON file to move products
 * between stores, an Excel/CSV sheet from the template, or one product from a
 * Shopify link. An import runs in the background; the dialog follows it
 * (importFollow.ts) and shows how it ended, with the rows that could not be
 * imported. It never waits for good: a request that takes too long, an error,
 * or an import that does not move stops the following with the reason.
 */

const STRINGS = {
  en: {
    title: "Import and export products",
    description: "Move products in and out of your store.",
    tab_file: "From a file",
    tab_link: "From a product link",
    tab_export: "Export",
    fileHint:
      "An Excel or CSV sheet built from the template, or a JSON file exported from a ZIMOS store. Rows with the same name become the variants of one product.",
    chooseFile: "Choose a file",
    template: "Download the template",
    linkLabel: "Shopify product link",
    linkPlaceholder: "https://store.com/products/product-name",
    linkHint:
      "Copies the name, description, images, options and prices of one product from a Shopify store. It is created as a draft with no stock. Only import products you have the right to sell.",
    importLink: "Import product",
    exportHint:
      "Downloads every product that is not archived — with variants, offers, collections and page content — as one JSON file. Import it in another ZIMOS store to copy your catalog.",
    exportButton: "Download JSON",
    exporting: "Preparing…",
    uploading: "Uploading…",
    working: "Importing {total} products…",
    waiting: "Waiting for the import to start…",
    progress: "{done} of {total} done",
    closeHint: "You can close this window: the import keeps running, and its products appear in your list.",
    allDone: "All {total} products were imported.",
    done: "{created} of {total} products imported.",
    partial: "{created} of {total} products imported. {failed} could not be imported.",
    stopped: "The import stopped before finishing: {created} of {total} products imported.",
    failedTitle: "{count} could not be imported:",
    row: "Row {row}",
    uploadTimeout:
      "The upload took too long. Check your connection, then look at your product list before trying again: the import may have started anyway.",
    readTimeout: "The server took too long to answer.",
    sessionEnded:
      "Your session ended, so this window stopped following the import. Sign in again: the import keeps running on the server and its products will be in your list.",
    notStarted:
      "The import hasn't started after a minute. It is waiting on the server and starts on its own: you can close this window and check your product list later. If nothing appears within a few minutes, contact support.",
    stalledText:
      "The import hasn't moved for 3 minutes and may have stopped. Products imported so far are kept: check your product list before importing the same file again.",
    followError: "This window stopped following the import: {error}",
    checkAgain: "Check again",
    another: "Import something else",
    close: "Close",
  },
  ar: {
    title: "استيراد وتصدير المنتجات",
    description: "انقل المنتجات من وإلى متجرك.",
    tab_file: "من ملف",
    tab_link: "من رابط منتج",
    tab_export: "تصدير",
    fileHint:
      "ملف Excel أو CSV من القالب، أو ملف JSON مُصدَّر من متجر ZIMOS. الصفوف التي لها نفس الاسم تصبح متغيرات لمنتج واحد.",
    chooseFile: "اختر ملفًا",
    template: "تحميل القالب",
    linkLabel: "رابط منتج Shopify",
    linkPlaceholder: "https://store.com/products/product-name",
    linkHint:
      "ينسخ اسم ووصف وصور وخيارات وأسعار منتج واحد من متجر Shopify. يُنشأ كمسودة بدون مخزون. استورد فقط المنتجات التي يحق لك بيعها.",
    importLink: "استيراد المنتج",
    exportHint:
      "يحمّل كل المنتجات غير المؤرشفة — بالمتغيرات والعروض والمجموعات ومحتوى الصفحة — في ملف JSON واحد. استورده في متجر ZIMOS آخر لنسخ منتجاتك.",
    exportButton: "تحميل JSON",
    exporting: "جارٍ التجهيز…",
    uploading: "جارٍ الرفع…",
    working: "جارٍ استيراد {total} منتج…",
    waiting: "في انتظار بدء الاستيراد…",
    progress: "تمت معالجة {done} من {total}",
    closeHint: "يمكنك إغلاق هذه النافذة: يستمر الاستيراد، وتظهر منتجاته في قائمتك.",
    allDone: "تم استيراد كل المنتجات ({total}).",
    done: "تم استيراد {created} من {total} منتج.",
    partial: "تم استيراد {created} من {total} منتج. تعذّر استيراد {failed}.",
    stopped: "توقف الاستيراد قبل أن يكتمل: تم استيراد {created} من {total} منتج.",
    failedTitle: "تعذّر استيراد {count}:",
    row: "صف {row}",
    uploadTimeout:
      "استغرق رفع الملف وقتًا طويلًا. تحقق من اتصالك، ثم راجع قائمة المنتجات قبل المحاولة مرة أخرى: ربما بدأ الاستيراد بالفعل.",
    readTimeout: "استغرق الخادم وقتًا طويلًا في الرد.",
    sessionEnded:
      "انتهت جلستك، لذلك توقفت هذه النافذة عن متابعة الاستيراد. سجّل الدخول مرة أخرى: يستمر الاستيراد على الخادم وستجد منتجاته في قائمتك.",
    notStarted:
      "لم يبدأ الاستيراد بعد دقيقة. إنه في الانتظار على الخادم وسيبدأ تلقائيًا: يمكنك إغلاق هذه النافذة ومراجعة قائمة المنتجات لاحقًا. إن لم يظهر شيء خلال دقائق، تواصل مع الدعم.",
    stalledText:
      "لم يتقدم الاستيراد منذ 3 دقائق وربما توقف. المنتجات التي تم استيرادها محفوظة: راجع قائمة المنتجات قبل استيراد الملف نفسه مرة أخرى.",
    followError: "توقفت هذه النافذة عن متابعة الاستيراد: {error}",
    checkAgain: "تحقق مرة أخرى",
    another: "استيراد شيء آخر",
    close: "إغلاق",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];
type Tab = "file" | "link" | "export";
const TABS: Tab[] = ["file", "link", "export"];

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ProductTransferDialog({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const fileInput = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>("file");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<CatalogImport | null>(null);
  const [stop, setStop] = useState<FollowStop | null>(null);

  // The caller's callback may be a new function every render; the poll must not restart for that.
  const imported = useRef(onImported);
  imported.current = onImported;
  // Tells the list once per import that products may have come in.
  const reported = useRef<string | null>(null);
  const report = (id: string) => {
    if (reported.current === id) return;
    reported.current = id;
    imported.current();
  };
  // The upload or download in flight, given up when the dialog closes.
  const request = useRef<AbortController | null>(null);
  const jobRef = useRef(job);
  jobRef.current = job;

  // Follow the import while it runs and nothing has stopped the following.
  // Keyed by its id only, so each answer does not restart the clocks below.
  const followId = job && !isFinished(job) && !stop ? job.id : null;
  useEffect(() => {
    if (!followId) return;
    const outer = new AbortController();
    const startedAt = Date.now();
    let mark = { key: jobRef.current ? progressKey(jobRef.current) : "", at: Date.now() };
    let failures = 0;
    let timer = 0;

    async function read() {
      try {
        const next = await withTimeout(FOLLOW.requestTimeoutMs, outer.signal, (signal) =>
          catalogGetImport(apiClient, workspaceId, followId as string, { signal })
        );
        if (outer.signal.aborted) return;
        failures = 0;
        if (progressKey(next) !== mark.key) mark = { key: progressKey(next), at: Date.now() };
        setJob(next);
        if (isFinished(next)) {
          report(next.id);
          return;
        }
        const why = stalled(next, Date.now() - mark.at);
        if (why) {
          setStop({ kind: why });
          return;
        }
      } catch (err) {
        if (outer.signal.aborted) return;
        const failure = readFailure(err);
        if (failure === "session") {
          setStop({ kind: "session" });
          return;
        }
        failures += 1;
        if (failure === "stop" || failures >= FOLLOW.maxFailures) {
          setStop({ kind: "error", error: err });
          return;
        }
      }
      timer = window.setTimeout(read, nextDelay(Date.now() - startedAt, failures));
    }

    timer = window.setTimeout(read, nextDelay(0, 0));
    return () => {
      outer.abort();
      window.clearTimeout(timer);
    };
    // `report` reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followId, workspaceId]);

  // Closing gives up the request in flight and stops the following; the
  // import itself keeps running on the server, so the list is refreshed.
  useEffect(() => () => request.current?.abort(), []);
  function close() {
    request.current?.abort();
    if (job) report(job.id);
    onClose();
  }

  function failureText(err: unknown) {
    if (err instanceof RequestTimeout) return t.readTimeout;
    if (readFailure(err) === "session") return t.sessionEnded;
    return errorMessage(err);
  }

  async function run<T>(timeoutMs: number, send: (signal: AbortSignal) => Promise<T>, done: (value: T) => void, timeoutText: string) {
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError(null);
    try {
      const value = await withTimeout(timeoutMs, controller.signal, send);
      if (!controller.signal.aborted) done(value);
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof RequestTimeout ? timeoutText : failureText(err));
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  function start(send: (signal: AbortSignal) => Promise<CatalogImport>) {
    void run(
      FOLLOW.uploadTimeoutMs,
      send,
      (created) => {
        setStop(null);
        setJob(created);
        if (isFinished(created)) report(created.id);
      },
      t.uploadTimeout
    );
  }

  function download(send: (signal: AbortSignal) => Promise<Blob>, filename: string) {
    void run(FOLLOW.uploadTimeoutMs, send, (blob) => save(blob, filename), t.readTimeout);
  }

  return (
    <Modal
      open
      onClose={close}
      title={t.title}
      description={t.description}
      footer={
        <Button type="button" variant="outline" onClick={close}>
          {t.close}
        </Button>
      }
    >
      {job ? (
        <ImportStatus
          job={job}
          stop={stop}
          t={t}
          failureText={failureText}
          onCheckAgain={() => setStop(null)}
          onAnother={() => {
            setJob(null);
            setStop(null);
          }}
        />
      ) : (
        <div className="space-y-4">
          <div role="tablist" className="flex flex-wrap gap-1 border-b border-line">
            {TABS.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                disabled={busy}
                onClick={() => {
                  setTab(key);
                  setError(null);
                }}
                className={`-mb-px min-h-11 cursor-pointer border-b-2 px-3 text-sm font-medium transition-colors ${
                  tab === key ? "border-primary text-primary" : "border-transparent text-ink-soft hover:text-ink"
                }`}
              >
                {t[`tab_${key}`]}
              </button>
            ))}
          </div>

          {tab === "file" && (
            <div className="space-y-3">
              <p className="text-sm text-ink-soft">{t.fileHint}</p>
              <input
                ref={fileInput}
                type="file"
                accept=".csv,.xlsx,.json,application/json,text/csv"
                className="hidden"
                data-testid="import-file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) start((signal) => catalogImportFile(apiClient, workspaceId, file, { signal }));
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={busy} onClick={() => fileInput.current?.click()}>
                  {busy ? <ZLoader size="sm" /> : <FileUp className="size-4" aria-hidden />}
                  {busy ? t.uploading : t.chooseFile}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => download(() => catalogImportTemplate(apiClient, workspaceId), "products-template.csv")}
                >
                  <Download className="size-4" aria-hidden />
                  {t.template}
                </Button>
              </div>
            </div>
          )}

          {tab === "link" && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const url = link.trim();
                if (url) start((signal) => catalogImportFromLink(apiClient, workspaceId, url, { signal }));
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="import-link">{t.linkLabel}</Label>
                <Input
                  id="import-link"
                  type="url"
                  dir="ltr"
                  placeholder={t.linkPlaceholder}
                  value={link}
                  disabled={busy}
                  onChange={(e) => setLink(e.target.value)}
                />
                <p className="text-xs text-ink-soft">{t.linkHint}</p>
              </div>
              <Button type="submit" disabled={busy || !link.trim()}>
                {busy ? <ZLoader size="sm" /> : <Link2 className="size-4" aria-hidden />}
                {t.importLink}
              </Button>
            </form>
          )}

          {tab === "export" && (
            <div className="space-y-3">
              <p className="text-sm text-ink-soft">{t.exportHint}</p>
              <Button
                type="button"
                disabled={busy}
                onClick={() =>
                  download(
                    () => catalogExportProducts(apiClient, workspaceId),
                    `products-${new Date().toISOString().slice(0, 10)}.json`
                  )
                }
              >
                {busy ? <ZLoader size="sm" /> : <Download className="size-4" aria-hidden />}
                {busy ? t.exporting : t.exportButton}
              </Button>
            </div>
          )}

          {error && <Alert variant="danger">{error}</Alert>}
        </div>
      )}
    </Modal>
  );
}

/** A running import's progress, why the dialog stopped following it, or how it ended. */
function ImportStatus({
  job,
  stop,
  t,
  failureText,
  onCheckAgain,
  onAnother,
}: {
  job: CatalogImport;
  stop: FollowStop | null;
  t: Strings;
  failureText: (err: unknown) => string;
  onCheckAgain: () => void;
  onAnother: () => void;
}) {
  const done = processed(job);

  if (!isFinished(job)) {
    if (stop) {
      const text =
        stop.kind === "session"
          ? t.sessionEnded
          : stop.kind === "notStarted"
            ? t.notStarted
            : stop.kind === "stalled"
              ? t.stalledText
              : fmt(t.followError, { error: failureText(stop.error) });
      return (
        <div className="space-y-4">
          <Alert variant={stop.kind === "notStarted" ? "info" : "danger"}>{text}</Alert>
          {done > 0 && <p className="text-sm text-ink-soft">{fmt(t.progress, { done, total: job.total })}</p>}
          {stop.kind !== "session" && (
            <Button type="button" variant="outline" onClick={onCheckAgain}>
              {t.checkAgain}
            </Button>
          )}
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <p role="status" className="flex items-center gap-3 text-sm text-ink">
          <ZLoader size="sm" aria-hidden />
          {job.status === "queued" ? t.waiting : fmt(t.working, { total: job.total })}
        </p>
        {done > 0 && <p className="text-sm text-ink-soft">{fmt(t.progress, { done, total: job.total })}</p>}
        <p className="text-xs text-ink-soft">{t.closeHint}</p>
      </div>
    );
  }

  const counts = { created: job.createdCount, total: job.total, failed: job.failedCount };
  const summary =
    job.status === "failed"
      ? fmt(t.stopped, counts)
      : job.failedCount > 0
        ? fmt(t.partial, counts)
        : job.createdCount === job.total
          ? fmt(t.allDone, counts)
          : fmt(t.done, counts);

  return (
    <div className="space-y-4">
      <Alert variant={job.status === "failed" ? "danger" : job.failedCount > 0 ? "info" : "success"}>{summary}</Alert>
      {job.errors.length > 0 && (
        <div className="space-y-2">
          {job.failedCount > 0 && (
            <p className="text-sm font-semibold text-ink">{fmt(t.failedTitle, { count: job.failedCount })}</p>
          )}
          <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-[0.5rem] border border-line text-sm">
            {job.errors.map((item, index) => (
              <li key={index} className="px-3 py-2">
                {(item.row !== null || item.name) && (
                  <p className="font-medium text-ink">
                    {item.row !== null && <span className="text-ink-soft">{fmt(t.row, { row: item.row })} · </span>}
                    {item.name}
                  </p>
                )}
                <p className="text-ink-soft" dir="auto">
                  {item.message}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Button type="button" variant="outline" onClick={onAnother}>
        {t.another}
      </Button>
    </div>
  );
}
