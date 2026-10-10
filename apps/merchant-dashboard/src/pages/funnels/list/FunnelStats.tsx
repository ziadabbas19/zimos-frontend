import type { ReactNode } from "react";
import { cn } from "@store-builder/ui";
import type { IconComponent } from "@/components/icons";
import { SkeletonBar } from "@/components/DataState";

export interface FunnelStat {
  id: string;
  label: string;
  icon: IconComponent;
  /** The figure, already formatted; null while it is not known (loading, failed, not this role's to see). */
  value: ReactNode | null;
  /** A few words under the figure: what it counts. */
  hint?: string;
}

/**
 * The numbers over the funnels list, as four compact cards: two by two on a
 * phone, one row from md. Each is a label, a figure and at most a few words —
 * no trend and no comparison, because the API returns neither here.
 *
 * A figure that is not known is a dash, never a zero; `reason` then says why
 * once, under the strip, instead of on every card.
 */
export function FunnelStats({
  stats,
  label,
  loading,
  reason,
  className,
}: {
  stats: ReadonlyArray<FunnelStat>;
  /** Names the group for a screen reader. */
  label: string;
  loading: boolean;
  /** Why there are no figures (no permission, a failed load). */
  reason?: string;
  className?: string;
}) {
  return (
    <section aria-label={label} className={cn("min-w-0", className)}>
      <dl className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
        {stats.map((stat) => {
          const StatIcon = stat.icon;
          return (
            <div
              key={stat.id}
              data-slot="funnel-stat"
              className="zimos-funnel-stat flex min-w-0 flex-col gap-0.5 rounded-[1.25rem] bg-paper-raised px-3.5 py-3 shadow-[var(--shadow-card)] ring-1 ring-line"
            >
              <dt className="flex items-center gap-1.5 text-xs leading-5 font-medium text-ink-soft">
                <StatIcon className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{stat.label}</span>
              </dt>
              <dd className="min-w-0">
                {loading ? (
                  <SkeletonBar className="my-1.5 h-4 w-16" />
                ) : (
                  <span className="block truncate text-xl leading-7 font-semibold text-ink tabular-nums">
                    {stat.value ?? <span aria-hidden>—</span>}
                  </span>
                )}
                {stat.hint && <span className="block truncate text-[11px] leading-4 text-ink-soft max-md:hidden">{stat.hint}</span>}
              </dd>
            </div>
          );
        })}
      </dl>
      {reason && !loading && (
        <p role="status" className="mt-2 px-1 text-xs leading-5 text-ink-soft">
          {reason}
        </p>
      )}
    </section>
  );
}
