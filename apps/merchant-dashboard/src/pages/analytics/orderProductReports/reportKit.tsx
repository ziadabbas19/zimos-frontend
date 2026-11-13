import { useState, type ReactNode } from "react";
import { Download } from "lucide-react";
import { Button, cn } from "@store-builder/ui";
import type { ReportsCompare } from "@store-builder/api-client";
import { CardSkeleton, SkeletonBar, TableSkeleton } from "@/components/DataState";
import type { ReportPreset, ReportRange } from "@/lib/reportRange";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { DateRangeControl } from "../reports/parts";

/**
 * What the orders report and the products report share: the date range bar
 * (the Analytics page's presets and comparison, 44px under a finger), the
 * CSV button, and the loading placeholder in the shape of the page.
 */

const STRINGS = {
  en: { export: "Export CSV", exporting: "Preparing…", failed: "The file could not be prepared. Try again.", loading: "Loading the report…" },
  ar: { export: "تصدير CSV", exporting: "جارٍ التجهيز…", failed: "تعذّر تجهيز الملف. حاول مرة أخرى.", loading: "جارٍ تحميل التقرير…" },
} satisfies Messages;

/** The presets this page offers: today, 7 and 30 days, this month, custom dates (the URL keeps the rest working). */
export function RangeBar({
  range,
  onPreset,
  onDays,
  onCompare,
  showCompare = true,
  children,
}: {
  range: ReportRange;
  onPreset: (preset: ReportPreset) => void;
  onDays: (fromDay: string, toDay: string) => void;
  onCompare: (compare: ReportsCompare) => void;
  showCompare?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="pointer-coarse:[&_input]:min-h-11 pointer-coarse:[&_select]:min-h-11 max-sm:w-full max-sm:[&_select]:flex-1">
        <DateRangeControl range={range} onPreset={onPreset} onDays={onDays} onCompare={onCompare} showCompare={showCompare} />
      </div>
      {children}
    </div>
  );
}

/** Saves a Blob as a file, the way the other report exports do. */
export function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function CsvButton({ load, filename, onError }: { load: () => Promise<Blob>; filename: string; onError: (message: string) => void }) {
  const t = useT(STRINGS);
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    try {
      saveFile(await load(), filename);
    } catch {
      onError(t.failed);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant="outline" size="sm" onClick={download} disabled={busy} aria-busy={busy || undefined}>
      <Download className="size-4" aria-hidden />
      {busy ? t.exporting : t.export}
    </Button>
  );
}

/** The page on its way: the KPI strip, a chart and two panels, then a table. */
export function ReportSkeleton({ kpis = 6 }: { kpis?: number }) {
  const t = useT(STRINGS);
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-5">
      <span className="sr-only">{t.loading}</span>
      <div aria-hidden className={cn("grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2", kpis > 4 ? "lg:grid-cols-3" : "lg:grid-cols-4")}>
        {Array.from({ length: kpis }, (_, i) => (
          <div key={i} className="bg-paper-raised p-4">
            <SkeletonBar className="h-2.5 w-1/3" />
            <SkeletonBar className="mt-3 h-6 w-1/2" />
            <SkeletonBar className="mt-2 h-2.5 w-1/4" />
          </div>
        ))}
      </div>
      <div aria-hidden>
        <CardSkeleton lines={1} className="h-64" />
      </div>
      <div aria-hidden className="grid gap-5 lg:grid-cols-2">
        <CardSkeleton lines={5} />
        <CardSkeleton lines={5} />
      </div>
      <div aria-hidden>
        <TableSkeleton />
      </div>
    </div>
  );
}

/** A row of a breakdown that filters the orders table: a full-width button, pressed while it is the filter. */
export function FilterRow({
  active,
  onClick,
  label,
  value,
  caption,
  share,
}: {
  active: boolean;
  onClick: () => void;
  label: ReactNode;
  value: ReactNode;
  caption?: ReactNode;
  /** 0–1, the proportional track behind the row. */
  share: number;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={cn(
          "group w-full min-h-11 cursor-pointer rounded-lg px-2 py-1.5 text-start transition-colors hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none",
          active && "bg-primary-soft/60 hover:bg-primary-soft/70"
        )}
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-sm text-ink" dir="auto">
            {label}
          </span>
          <span className="shrink-0 text-sm font-medium text-ink tabular-nums">{value}</span>
        </span>
        <span aria-hidden className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-paper">
          <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.round(Math.max(0, Math.min(1, share)) * 100)}%` }} />
        </span>
        {caption && <span className="mt-0.5 block text-xs text-ink-soft">{caption}</span>}
      </button>
    </li>
  );
}
