import type { ReactNode } from "react";
import { Card, cn } from "@store-builder/ui";

interface SectionProps {
  title: string;
  description?: string;
  /** Rendered on the title line, at the end — a link, a button, a filter. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Drops the card's own padding, for a section whose body is a table. */
  flush?: boolean;
  /** Marks the block for the dashboard's search: brought into view and marked when a search result opens it (lib/search/reveal.ts). */
  searchAnchor?: string;
}

/**
 * A titled panel on the dashboard's white card. Every screen's sections use
 * this so headings, spacing and the surface stay identical across the app.
 */
export function Section({ title, description, actions, children, className, flush, searchAnchor }: SectionProps) {
  return (
    <Card data-search-anchor={searchAnchor} className={cn("min-w-0 gap-0", flush ? "p-0" : "p-4", className)}>
      <div className={cn("flex flex-wrap items-start justify-between gap-2", flush && "px-4 pt-4", !description && "items-center")}>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-ink-soft">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className={cn(flush ? "mt-3" : "mt-3")}>{children}</div>
    </Card>
  );
}
