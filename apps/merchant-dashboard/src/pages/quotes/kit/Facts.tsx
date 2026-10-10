import type { ReactNode } from "react";
import { cn } from "@store-builder/ui";

/** A small quiet label over a block of a preview or a sheet. */
export function BlockLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn("mb-2 text-xs leading-4 font-medium text-ink-soft", className)}>{children}</h3>;
}

export interface FactRow {
  label: string;
  value: ReactNode;
}

function shown(node: ReactNode): boolean {
  return node !== null && node !== undefined && node !== false && node !== "";
}

/**
 * Label and value lines, the way a preview lists what it knows: the label in
 * quiet ink at the start, the value at the end, a hairline between lines.
 * A row with nothing to say (`false`, `null`, an empty value) is left out.
 */
export function FactList({ rows, className }: { rows: ReadonlyArray<FactRow | false | null | undefined>; className?: string }) {
  const lines = rows.filter((row): row is FactRow => Boolean(row) && shown((row as FactRow).value));
  if (lines.length === 0) return null;
  return (
    <dl data-slot="kinds-facts" className={cn("flex flex-col", className)}>
      {lines.map((row) => (
        <div key={row.label} className="flex min-h-10 items-center justify-between gap-4 border-b border-line py-1.5 last:border-b-0">
          <dt className="shrink-0 text-[13px] leading-5 text-ink-soft">{row.label}</dt>
          <dd className="min-w-0 text-end text-sm leading-5 font-medium text-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A sunken block for somebody's own words (a shopper's message, a note to them). */
export function Well({ caption, children, className }: { caption?: string; children: ReactNode; className?: string }) {
  return (
    <figure data-slot="kinds-well" className={cn("rounded-2xl bg-paper-sunken px-4 py-3", className)}>
      {caption && <figcaption className="text-xs leading-4 font-medium text-ink-soft">{caption}</figcaption>}
      {/* dir="auto": the words are their writer's, in whatever language they were typed. */}
      <blockquote dir="auto" className={cn("text-sm leading-6 wrap-anywhere whitespace-pre-wrap text-ink", caption && "mt-1")}>
        {children}
      </blockquote>
    </figure>
  );
}

/** A small quiet pill for a fact of a row: how many lessons, a file's size. */
export function FactChip({ children, tone, className }: { children: ReactNode; tone?: "attention" | "danger" | "success"; className?: string }) {
  return (
    <span
      data-slot="kinds-fact"
      data-tone={tone}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        tone === "attention"
          ? "bg-accent-soft text-accent-dark"
          : tone === "danger"
            ? "bg-danger-soft text-danger"
            : tone === "success"
              ? "bg-success-soft text-success"
              : "bg-paper-sunken text-ink-soft",
        className
      )}
    >
      {children}
    </span>
  );
}

/** Lower case, and Arabic-Indic digits as Latin ones: «١٠٢٤» finds 1024. */
export function fold(text: string): string {
  return text.toLowerCase().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/** Whether any of the parts holds the (already folded) query. */
export function matches(query: string, parts: ReadonlyArray<string | null | undefined>): boolean {
  if (!query) return true;
  return parts.some((part) => Boolean(part) && fold(part as string).includes(query));
}
