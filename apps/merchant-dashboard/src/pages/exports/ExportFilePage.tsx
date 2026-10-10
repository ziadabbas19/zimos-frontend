import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { Alert, Button } from "@store-builder/ui";
import { exportFileDownload, exportFileGet, type ExportFile } from "@store-builder/api-client";
import { DataState, SkeletonBar } from "@/components/DataState";
import { IconClock, IconDownload, IconFileDown, IconSpinner, IconWarning } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";

const STRINGS = {
  en: {
    title: "Orders export",
    back: "Orders",
    fileFallback: "Exported file",
    s_queued: "Waiting",
    s_running: "Being prepared",
    s_done: "Ready",
    s_failed: "Failed",
    s_expired: "Removed",
    queuedTitle: "Waiting for its turn…",
    runningTitle: "Preparing your file…",
    working: "This page updates on its own, and you'll get a notification when the file is ready.",
    ready: "{size} · kept until {date}",
    readyNoSize: "Kept until {date}",
    failedTitle: "The file couldn't be prepared",
    failed: "Export again from the orders list, or narrow the filters.",
    expiredTitle: "This file was removed",
    expired: "Files are kept for {days}. Export again from the orders list.",
    download: "Download the file",
    downloading: "Downloading…",
    downloaded: "The download has started.",
    goOrders: "Go to orders",
    sizeB: "{n} B",
    sizeKB: "{n} KB",
    sizeMB: "{n} MB",
  },
  ar: {
    title: "تصدير الطلبات",
    back: "الطلبات",
    fileFallback: "ملف مُصدَّر",
    s_queued: "في الانتظار",
    s_running: "جارٍ التجهيز",
    s_done: "جاهز",
    s_failed: "تعذّر",
    s_expired: "حُذف",
    queuedTitle: "في انتظار دوره…",
    runningTitle: "جارٍ تجهيز ملفك…",
    working: "تتحدّث هذه الصفحة تلقائيًا، وسيصلك إشعار عندما يجهز الملف.",
    ready: "{size} · متاح حتى {date}",
    readyNoSize: "متاح حتى {date}",
    failedTitle: "تعذّر تجهيز الملف",
    failed: "صدّر مرة أخرى من قائمة الطلبات، أو ضيّق الفلاتر.",
    expiredTitle: "حُذف هذا الملف",
    expired: "تُحفظ الملفات {days}. صدّر مرة أخرى من قائمة الطلبات.",
    download: "تنزيل الملف",
    downloading: "جارٍ التنزيل…",
    downloaded: "بدأ التنزيل.",
    goOrders: "الانتقال إلى الطلبات",
    sizeB: "{n} بايت",
    sizeKB: "{n} ك.ب",
    sizeMB: "{n} م.ب",
  },
} satisfies Messages;

type Strings = Record<keyof (typeof STRINGS)["en"], string>;

const TONE = {
  queued: "neutral",
  running: "info",
  done: "success",
  failed: "danger",
  expired: "neutral",
} as const;

/** How long the server keeps a built file (exportFiles.js). */
const KEPT_DAYS = 7;

/** The file's size in the unit a person reads it in, with the screen's digits. */
function sizeLabel(bytes: number | null, t: Strings): string | null {
  if (bytes === null) return null;
  if (bytes < 1024) return fmt(t.sizeB, { n: bytes });
  if (bytes < 1024 * 1024) return fmt(t.sizeKB, { n: Math.round((bytes / 1024) * 10) / 10 });
  return fmt(t.sizeMB, { n: Math.round((bytes / 1024 / 1024) * 10) / 10 });
}

type TileTone = "default" | "success" | "attention";

// The tile on its own (glass off): the soft token fills. glass/states.css lays its tint over `[data-slot="empty-state-tile"]`.
const TILE_TONE: Record<TileTone, string> = {
  default: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  attention: "bg-accent-soft text-accent-dark",
};

/**
 * The file as one pane: a tile with its icon, what state it is in, a sentence,
 * and the one thing to do about it. The same shape as the dashboard's empty
 * states, on a solid sheet.
 */
function FilePane({
  icon,
  tone = "default",
  title,
  badge,
  description,
  action,
  live = false,
  children,
}: {
  icon: ReactNode;
  tone?: TileTone;
  title: ReactNode;
  badge: ReactNode;
  description: string;
  action?: ReactNode;
  /** The state changes on its own (the file is being built): said to a screen reader when it does. */
  live?: boolean;
  children?: ReactNode;
}) {
  return (
    <section
      role={live ? "status" : undefined}
      aria-live={live ? "polite" : undefined}
      className="zimos-export-pane flex flex-col items-center rounded-[var(--radius-card)] bg-paper-raised px-5 py-10 text-center shadow-[var(--shadow-card)] ring-1 ring-line sm:px-8"
    >
      <div
        data-slot="empty-state-tile"
        data-tone={tone}
        className={`mb-5 flex size-18 shrink-0 items-center justify-center rounded-[1.5rem] [&_svg]:size-10 ${TILE_TONE[tone]}`}
      >
        {icon}
      </div>
      <h2 className="max-w-full text-[17px] leading-7 font-semibold wrap-anywhere text-ink">{title}</h2>
      <div className="mt-2">{badge}</div>
      <p className="mt-3 max-w-md text-sm leading-6 text-ink-soft">{description}</p>
      {children}
      {action && <div className="mt-6 flex w-full justify-center max-sm:[&>*]:w-full">{action}</div>}
    </section>
  );
}

/** Where an `export.ready` notification leads: the file's state and its download. */
export function ExportFilePage() {
  const t = useT(STRINGS);
  const { exportId = "" } = useParams();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const file = useAsync(() => exportFileGet(apiClient, workspaceId, exportId), [workspaceId, exportId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = file.data;
  const working = data ? data.status === "queued" || data.status === "running" : false;
  const { refresh } = file;
  // Live while the queue builds it.
  useEffect(() => {
    if (!working) return;
    const id = window.setInterval(() => void refresh({ silent: true }), 2000);
    return () => window.clearInterval(id);
  }, [working, refresh]);

  async function download() {
    if (!data || busy) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await exportFileDownload(apiClient, workspaceId, data.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = data.fileName ?? `export.${data.format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(t.downloaded);
    } catch (err) {
      setError(errorMessage(err));
      void refresh({ silent: true });
    } finally {
      setBusy(false);
    }
  }

  const pill = "h-12 gap-2 rounded-full px-6 text-[15px]";
  const backToOrders = (
    <Button asChild variant="outline" className={pill}>
      <Link to="/orders">{t.goOrders}</Link>
    </Button>
  );

  function pane(item: ExportFile) {
    const badge = <StatusBadge value={item.status} tone={TONE[item.status]} text={t[`s_${item.status}`]} />;
    const name = <bdi dir="ltr">{item.fileName ?? t.fileFallback}</bdi>;
    switch (item.status) {
      case "queued":
      case "running":
        return (
          <FilePane
            live
            icon={<IconSpinner className="animate-spin motion-reduce:animate-none" aria-hidden />}
            title={item.status === "queued" ? t.queuedTitle : t.runningTitle}
            badge={badge}
            description={t.working}
          />
        );
      case "done": {
        const size = sizeLabel(item.sizeBytes, t);
        const date = formatDateTime(item.expiresAt);
        return (
          <FilePane
            tone="success"
            icon={<IconFileDown aria-hidden />}
            title={name}
            badge={badge}
            description={size ? fmt(t.ready, { size, date }) : fmt(t.readyNoSize, { date })}
            action={
              <Button className={pill} onClick={() => void download()} disabled={busy} aria-busy={busy || undefined}>
                {busy ? (
                  <IconSpinner className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />
                ) : (
                  <IconDownload className="size-5" aria-hidden />
                )}
                {busy ? t.downloading : t.download}
              </Button>
            }
          >
            {error && (
              <Alert variant="danger" role="alert" className="mt-4 max-w-md text-start">
                {error}
              </Alert>
            )}
          </FilePane>
        );
      }
      case "failed":
        return (
          <FilePane tone="attention" icon={<IconWarning aria-hidden />} title={t.failedTitle} badge={badge} description={t.failed} action={backToOrders} />
        );
      case "expired":
        return (
          <FilePane
            icon={<IconClock aria-hidden />}
            title={t.expiredTitle}
            badge={badge}
            description={fmt(t.expired, { days: countOf("day", KEPT_DAYS) })}
            action={backToOrders}
          />
        );
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title={t.title} back={{ to: "/orders", label: t.back }} />
      <DataState
        loading={file.loading && !data}
        // A refresh that failed behind a file already on screen leaves it there.
        error={data ? null : file.error}
        onRetry={() => void file.refresh()}
        skeleton={
          <div className="flex flex-col items-center rounded-[var(--radius-card)] bg-paper-raised px-5 py-10 shadow-[var(--shadow-card)] ring-1 ring-line">
            <SkeletonBar className="size-18 rounded-[1.5rem]" />
            <SkeletonBar className="mt-6 h-4 w-48" />
            <SkeletonBar className="mt-4 h-5 w-20" />
            <SkeletonBar className="mt-4 w-64 max-w-full" />
            <SkeletonBar className="mt-7 h-12 w-44" />
          </div>
        }
      >
        {data && pane(data)}
      </DataState>
    </div>
  );
}
