import { useId, type ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { SkeletonBar } from "@/components/DataState";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { loading: "Loading…" },
  ar: { loading: "جارٍ التحميل…" },
} satisfies Messages;

/** The same pane `SettingsGroup` draws its rows in, for content that is not rows: a form, a list, a table. */
const CARD =
  "zimos-settings-card min-w-0 rounded-[var(--radius-card)] bg-card text-card-foreground shadow-[var(--shadow-card)] ring-1 ring-line [--radius-card:1.25rem]";

export interface SettingsCardProps {
  /** A small heading inside the card, over its content. */
  title?: string;
  description?: string;
  /** At the end of the heading line: a button, a status chip. */
  actions?: ReactNode;
  /** `danger` draws a red rim: the card holds something that cannot be taken back. */
  tone?: "default" | "danger";
  /** Drops the padding, for a list or a table that runs edge to edge. */
  flush?: boolean;
  id?: string;
  children: ReactNode;
  className?: string;
  /** Marks the block for the dashboard's search: brought into view and marked when a search result opens it (lib/search/reveal.ts). */
  searchAnchor?: string;
}

/**
 * A card of a settings pane that holds free content. `SettingsGroup` is for
 * rows; a form with several fields, a table or a guide goes in this one, so
 * every block of every section sits on the same pane with the same corner.
 */
export function SettingsCard({ title, description, actions, tone = "default", flush = false, id, children, className, searchAnchor }: SettingsCardProps) {
  const headingId = useId();
  const headed = Boolean(title || description || actions);
  return (
    <section
      id={id}
      data-search-anchor={searchAnchor}
      data-slot="card"
      aria-labelledby={title ? headingId : undefined}
      className={cn(CARD, "scroll-mt-24", tone === "danger" && "ring-danger/40", !flush && "p-4 sm:p-5", className)}
    >
      {headed && (
        <div className={cn("flex flex-wrap items-start justify-between gap-x-3 gap-y-2", flush ? "px-4 pt-4 sm:px-5" : "", "mb-3")}>
          <div className="min-w-0 flex-[1_1_12rem]">
            {title && (
              <h3 id={headingId} className="text-[15px] leading-5 font-semibold text-ink">
                {title}
              </h3>
            )}
            {description && <p className="mt-1 text-[13px] leading-5 text-ink-soft">{description}</p>}
          </div>
          {actions && <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * A pane while its section loads: a card of rows in the shape of `SettingsGroup`
 * (a label and a hint at the start, a control at the end), as tall as the rows
 * that replace it, so nothing jumps when they arrive.
 */
export function PaneSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  const t = useT(STRINGS);
  const lines = Array.from({ length: Math.max(1, rows) }, (_, index) => index);
  const widths = ["w-2/5", "w-1/3", "w-1/2", "w-1/4"];
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{t.loading}</span>
      <div aria-hidden data-slot="card" className={cn(CARD, "flex flex-col")}>
        {lines.map((index) => (
          <div key={index} className="flex min-h-13 items-center gap-4 border-t border-line px-4 py-3 first:border-t-0">
            <div className="min-w-0 flex-1">
              <SkeletonBar className={cn("h-3.5", widths[index % widths.length])} />
              <SkeletonBar className="mt-2 h-3 w-3/5" />
            </div>
            <SkeletonBar className="h-7 w-12 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
