import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Card, cn } from "@store-builder/ui";
import { useT } from "@/i18n/LocaleContext";
import { formatPercentValue } from "@/lib/format";

const STRINGS = {
  en: { vsPrevious: "vs previous period", loading: "Loading…" },
  ar: { vsPrevious: "مقارنة بالفترة السابقة", loading: "جارٍ التحميل…" },
};

interface KpiCardProps {
  label: string;
  value: ReactNode;
  /** Change vs previous period, in basis points (250 = +2.5%). */
  deltaBasisPoints?: number | null;
  deltaLabel?: string;
  hint?: string;
  to?: string;
  icon?: ReactNode;
  className?: string;
  /** The card as a skeleton of its own shape while the figure loads, so nothing moves when the number arrives. */
  loading?: boolean;
  /** The period's values in order. Taken so a screen can pass them; the small chart is not drawn yet. */
  trend?: number[];
  /** Which direction is the good news. "down" for a return rate: a fall is green and a rise is red. */
  goodWhen?: "up" | "down";
}

/** One grey shape of the skeleton. */
function Bone({ className }: { className?: string }) {
  return <span aria-hidden data-slot="kpi-bone" className={cn("block max-w-full animate-pulse rounded-full bg-paper-sunken motion-reduce:animate-none", className)} />;
}

export function KpiCard({ label, value, deltaBasisPoints, deltaLabel, hint, to, icon, className, loading = false, goodWhen = "up" }: KpiCardProps) {
  const t = useT(STRINGS);
  const delta = deltaBasisPoints ?? null;
  const up = delta !== null && delta > 0;
  const down = delta !== null && delta < 0;
  const good = goodWhen === "down" ? down : up;
  const bad = goodWhen === "down" ? up : down;
  const body = (
    <Card aria-busy={loading || undefined} className={cn("h-full gap-0 p-4", to && "transition-colors hover:border-primary/40", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-ink-soft">{label}</p>
        {icon && (
          <span className="flex size-8 items-center justify-center rounded-[10px] bg-primary-soft text-primary [&>svg]:size-4">
            {icon}
          </span>
        )}
      </div>
      {loading ? (
        <>
          <div className="mt-1 flex h-8 items-center">
            <Bone className="h-6 w-24" />
          </div>
          <Bone className="mt-2 h-3 w-28" />
          <span className="sr-only">{t.loading}</span>
        </>
      ) : (
        <p className="tabular-nums mt-1 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      )}
      {loading ? null : delta !== null ? (
        <p className="mt-1 flex flex-wrap items-center gap-1 text-xs">
          <span className={cn("font-medium", good && "text-success", bad && "text-danger", !up && !down && "text-ink-soft")}>
            {up ? "▲" : down ? "▼" : "•"} {formatPercentValue(Math.abs(delta) / 10000)}
          </span>
          <span className="text-ink-soft">{deltaLabel ?? t.vsPrevious}</span>
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-soft">{hint}</p>
      ) : null}
    </Card>
  );
  return to ? (
    <Link to={to} className="block rounded-2xl">
      {body}
    </Link>
  ) : (
    body
  );
}
