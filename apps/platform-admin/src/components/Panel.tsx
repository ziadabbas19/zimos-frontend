import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableCell, TableHead, cn } from "@store-builder/ui";

/**
 * A titled sheet of the page, drawn as the merchant dashboard draws its
 * sections (its components/Section.tsx): the raised surface with a card-sized
 * corner, a hairline ring and the card shadow — which the theme turns into a
 * glass pane — the title and its one line at the top, no rule under them.
 */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  flush = false,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** No body padding (tables, lists). */
  flush?: boolean;
}) {
  const headed = Boolean(title || actions);
  return (
    <section
      className={cn(
        "min-w-0 overflow-hidden rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line",
        className
      )}
    >
      {headed && (
        <header className={cn("flex flex-wrap items-start justify-between gap-2 px-4 pt-4", !description && "items-center")}>
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-ink-soft">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(flush ? headed && "mt-3" : headed ? "px-4 pt-3 pb-4" : "p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export type SortDir = "asc" | "desc";
export interface SortState<K extends string> {
  key: K;
  dir: SortDir;
}

/* A column head as the dashboard's one table draws it (its components/DataTable.tsx):
   small quiet words on the tinted band, no capitals. */
const HEAD = "h-auto bg-paper-sunken/60 px-3 py-2.5 text-start text-xs font-medium text-ink-soft";

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <TableHead className={cn(HEAD, className)}>{children}</TableHead>;
}

export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return (
    <TableCell colSpan={colSpan} className={cn("px-3 py-2.5 text-ink", className)}>
      {children}
    </TableCell>
  );
}

export function SortHead<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: K;
  sort: SortState<K>;
  onSort: (next: SortState<K>) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={cn(HEAD, className)}>
      <button
        type="button"
        onClick={() => onSort({ key: sortKey, dir: active && sort.dir === "desc" ? "asc" : "desc" })}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1 rounded-full text-xs font-medium hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          active ? "text-ink" : "text-ink-soft"
        )}
      >
        {label}
        <Icon className="size-3" aria-hidden />
      </button>
    </TableHead>
  );
}

export function compareValues(a: string | number, b: string | number, dir: SortDir): number {
  const r = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
  return dir === "asc" ? r : -r;
}

export function JsonBlock({ value, className }: { value: unknown; className?: string }) {
  return (
    <pre
      className={cn(
        "scroll-thin max-h-80 overflow-auto rounded-[0.875rem] border border-line bg-paper-sunken p-3 font-mono text-xs leading-relaxed text-ink",
        className
      )}
    >
      {value === null || value === undefined ? "null" : JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  // A code keeps its own reading order inside Arabic text ("CAIRO-10").
  return <code dir="ltr" className={cn("rounded-[0.375rem] bg-primary-soft px-1.5 py-0.5 font-mono text-xs text-ink", className)}>{children}</code>;
}
