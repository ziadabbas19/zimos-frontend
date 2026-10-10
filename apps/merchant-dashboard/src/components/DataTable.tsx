import { isValidElement, useEffect, useState, type ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { SkeletonBar } from "@/components/DataState";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { loading: "Loading…", selectAll: "Select all" },
  ar: { loading: "جارٍ التحميل…", selectAll: "تحديد الكل" },
} satisfies Messages;

export interface Column<T> {
  /** Stable key; also the React key for the cell. */
  key: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  /** Right-aligns in LTR, left in RTL — for money and counts. */
  align?: "start" | "end";
  className?: string;
  headerClassName?: string;
  /** Left out of the phone card (a detail the card doesn't need; the table still shows it). */
  phoneHidden?: boolean;
  /** Left out of this row's phone card when it says nothing (0 orders on a lead, the default type). */
  phoneSkip?: (row: T) => boolean;
}

interface DataTableProps<T> {
  columns: ReadonlyArray<Column<T>>;
  rows: readonly T[];
  rowKey: (row: T, index: number) => string;
  /** Makes the whole row clickable; cells that stop propagation still work. */
  onRowClick?: (row: T) => void;
  /** Minimum width before the table scrolls horizontally, e.g. "48rem". */
  minWidth?: string;
  className?: string;
  /** Rendered instead of the table body when there are no rows. */
  empty?: ReactNode;
  /** While true and there are no rows yet, grey placeholder rows stand in for the body. */
  loading?: boolean;
  footer?: ReactNode;
  /**
   * On a phone each row becomes a card: the first column as its title and
   * the others as label / value lines. Pass false for a dense numeric report
   * that reads better as a table.
   */
  phoneCards?: boolean;
}

const PHONE_QUERY = "(max-width: 47.99rem)";

// Placeholder rows while loading; the cell widths rotate so no two rows match.
const SKELETON_ROWS = [0, 1, 2, 3, 4] as const;
const SKELETON_WIDTHS = ["w-3/4", "w-1/2", "w-2/3", "w-2/5", "w-5/6"] as const;

/** A cell with nothing to say: null, empty, or the "—" placeholder. */
function isBlank(value: ReactNode): boolean {
  return value === null || value === undefined || value === false || (typeof value === "string" && (value.trim() === "" || value.trim() === "—"));
}

/** Whether the screen is phone-narrow (below Tailwind's md), kept current on resize. */
function useIsPhone(): boolean {
  const [phone, setPhone] = useState(() => typeof window !== "undefined" && window.matchMedia?.(PHONE_QUERY).matches === true);
  useEffect(() => {
    const query = window.matchMedia?.(PHONE_QUERY);
    if (!query) return;
    const onChange = () => setPhone(query.matches);
    onChange();
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return phone;
}

/**
 * The dashboard's one table. Pages describe their columns and rows; the
 * header style, row separators, hover and horizontal scrolling live here so
 * every list looks the same and only has to be fixed once.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  minWidth = "48rem",
  className,
  empty,
  loading = false,
  footer,
  phoneCards = true,
}: DataTableProps<T>) {
  const t = useT(STRINGS);
  const isPhone = useIsPhone();
  // Only the first load gets a skeleton; a refresh keeps the rows it already has.
  const skeleton = loading && rows.length === 0;
  if (rows.length === 0 && empty && !skeleton) return <>{empty}</>;

  if (phoneCards && isPhone) {
    if (skeleton) {
      return (
        <div role="status" aria-live="polite" aria-busy="true" className={cn("min-w-0", className)}>
          <span className="sr-only">{t.loading}</span>
          <ul aria-hidden className="space-y-[var(--bento-gap)]">
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-24 rounded-[var(--radius-card)] bg-paper-raised p-4 shadow-[var(--shadow-card)] ring-1 ring-line">
                <SkeletonBar className="h-4 w-1/2" />
                <SkeletonBar className="mt-3 w-3/4" />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <SkeletonBar className="w-1/4" />
                  <SkeletonBar className="w-1/5" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    const hasText = (col: Column<T>) => typeof col.header === "string" && col.header.trim() !== "";
    const shown = columns.filter((col) => !col.phoneHidden);
    // A leading column without a text header (a tick box) sits beside the title.
    const lead = shown[0] && !hasText(shown[0]) ? shown[0] : null;
    // Its header is the table's "tick every row" box: with no header row on a phone, it stands over the cards.
    const tickAll = lead && isValidElement(lead.header) && lead.header.type === "input" ? lead.header : null;
    const titleIndex = shown.findIndex(hasText);
    const first = titleIndex >= 0 ? shown[titleIndex] : shown[0];
    const rest = shown.filter((col) => col !== lead && col !== first);
    const labelled = rest.filter(hasText);
    // Columns without a text header (actions): their content alone, at the end, outside the label list.
    const bare = rest.filter((col) => !hasText(col));
    return (
      <div className={cn("min-w-0", className)}>
        {tickAll && rows.length > 0 && (
          <label className="mb-2 flex min-h-11 w-fit cursor-pointer items-center gap-2 px-1 text-xs text-ink-soft">
            {tickAll}
            <span>{t.selectAll}</span>
          </label>
        )}
        <ul className="space-y-[var(--bento-gap)]">
          {rows.map((row, i) => {
            // Empty values would add a line of "—" to every card: leave them out.
            const lines = labelled
              .filter((col) => !col.phoneSkip?.(row))
              .map((col) => ({ col, value: col.cell(row, i) }))
              .filter(({ value }) => !isBlank(value));
            // Same for the action columns: a row whose actions are all null gets no empty strip.
            const actions = bare.map((col) => ({ col, value: col.cell(row, i) })).filter(({ value }) => !isBlank(value));
            return (
              <li
                key={rowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "relative rounded-[var(--radius-card)] bg-paper-raised p-4 text-sm shadow-[var(--shadow-card)] ring-1 ring-line",
                  // The title's link covers the whole card (a "stretched link"), so the card is one big
                  // target; other links, buttons and tick boxes sit above it and keep working.
                  "[&_.card-title_a]:after:absolute [&_.card-title_a]:after:inset-0 [&_.card-title_a]:after:rounded-[var(--radius-card)] [&_.card-title_a]:after:content-['']",
                  onRowClick && "cursor-pointer"
                )}
              >
                <div className="flex items-start gap-2">
                  {lead && (
                    // A 44 px target around the tick box; a tap anywhere in it ticks.
                    <div
                      className="relative z-10 -ms-2 -mt-2.5 flex size-11 shrink-0 cursor-pointer items-center justify-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        const input = e.currentTarget.querySelector("input");
                        if (input && e.target !== input && !(e.target as Element).closest("label")) input.click();
                      }}
                    >
                      {lead.cell(row, i)}
                    </div>
                  )}
                  {first && <div className="card-title min-w-0 flex-1 text-[15px] font-medium text-ink">{first.cell(row, i)}</div>}
                </div>
                {lines.length > 0 && (
                  <dl className="mt-2 space-y-1.5 [&_a]:relative [&_a]:z-10 [&_button]:relative [&_button]:z-10 [&_input]:relative [&_input]:z-10">
                    {lines.map(({ col, value }) => (
                      <div key={col.key} className="flex items-start justify-between gap-3">
                        <dt className="shrink-0 text-xs text-ink-soft">{col.header}</dt>
                        <dd className="min-w-0 text-end text-ink">{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {actions.length > 0 && (
                  <div className="relative z-10 mt-2 flex flex-wrap items-center justify-end gap-2">
                    {actions.map(({ col, value }) => (
                      <div key={col.key}>{value}</div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {footer}
      </div>
    );
  }

  return (
    <div
      className={cn("min-w-0", className)}
      role={skeleton ? "status" : undefined}
      aria-live={skeleton ? "polite" : undefined}
      aria-busy={skeleton || undefined}
    >
      {skeleton && <span className="sr-only">{t.loading}</span>}
      {/* relative: a visually hidden header inside the table is positioned against
          this box, so it is clipped with the table instead of widening the page. */}
      <div className="relative overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth }} aria-hidden={skeleton || undefined}>
          <thead>
            <tr className="border-b border-line bg-paper-sunken/60 text-xs text-ink-soft">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    "px-3 py-2.5 font-medium",
                    col.align === "end" ? "text-end" : "text-start",
                    col.headerClassName
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {skeleton
              ? SKELETON_ROWS.map((r) => (
                  <tr key={r} className="border-b border-line last:border-0">
                    {columns.map((col, c) => (
                      // py-3.5 around an h-3 bar matches the 40 px of a real row (text-sm + py-2.5).
                      <td key={col.key} className={cn("px-3 py-3.5", col.className)}>
                        <SkeletonBar
                          className={cn(SKELETON_WIDTHS[(r + c) % SKELETON_WIDTHS.length], col.align === "end" && "ms-auto")}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row, i) => (
                  <tr
                    key={rowKey(row, i)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      "border-b border-line last:border-0",
                      onRowClick && "cursor-pointer hover:bg-paper-sunken"
                    )}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn("px-3 py-2.5", col.align === "end" && "text-end", col.className)}
                      >
                        {col.cell(row, i)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {!skeleton && footer}
    </div>
  );
}
