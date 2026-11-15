import type { ReactNode } from "react";
import { Card, cn } from "@store-builder/ui";
import { useExplain } from "@/components/ExplainToggle";

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
 * Its explanation, if any, opens from a «؟» beside the title.
 */
export function Section({ title, description, actions, children, className, flush, searchAnchor }: SectionProps) {
  // The section's explanation behind a «؟» beside its title, as a page's is (PageHeader).
  const explain = useExplain(description, { size: "sm" });
  return (
    <Card data-search-anchor={searchAnchor} className={cn("min-w-0 gap-0", flush ? "p-0" : "p-4 sm:p-5", className)}>
      <div className={cn("flex flex-wrap items-start justify-between gap-2", flush && "px-4 pt-4 sm:px-5 sm:pt-5")}>
        <div className="min-w-0">
          <h2 className="flex items-center gap-1 text-[15px] font-semibold text-ink">
            {title}
            {explain.button}
          </h2>
          {explain.text}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className={cn(flush ? "mt-3" : "mt-3")}>{children}</div>
    </Card>
  );
}
