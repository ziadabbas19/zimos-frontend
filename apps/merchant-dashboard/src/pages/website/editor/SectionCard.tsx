import type { CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconDelete, IconDragHandle, IconEyeOff, type IconComponent } from "@/components/icons";
import { cn } from "@store-builder/ui";
import type { PageElement, PageSection } from "@store-builder/api-client";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { ELEMENT_SPECS, sectionElements, sectionIcon, sectionLabel } from "./blocks";
import { editorUi, elementLabel, useEditorLocale, type EditorLocale } from "./editorLocale";
import { RowMenu } from "./library/RowMenu";
import { leftUi } from "./library/strings";
import { elementSummary } from "./library/summary";

/**
 * A section as it appears in the outline. This is deliberately NOT a
 * storefront preview — it is a structural view. In the website editor the real
 * storefront is the canvas beside it, and these are its layer list (drag to
 * reorder).
 *
 * Two shapes:
 *  - a ROW (`showSummary={false}`, the section list): one 48px pill — the drag
 *    handle, the section's icon and name, how many elements it holds, a mark
 *    when it is hidden, and «…» for what can be done to it. The selected row
 *    is the brand-fill pill; with `outline` its elements are listed under it.
 *  - a CARD (the default, the funnel step editor's page column): the same
 *    header over a summary of every element inside.
 */

/** How the rows that make room move: the house's fade curve, a little longer than a fade. */
const MAKE_ROOM = { duration: 240, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" };

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Renders an icon passed as a value. Aliasing `spec.icon` to a capitalised
 * local inside a `.map` callback trips oxlint's static-components rule; taking
 * it as a prop keeps the alias at module scope.
 */
function NodeIcon({ icon: Glyph, className }: { icon: IconComponent; className?: string }) {
  return <Glyph className={className} aria-hidden />;
}

/** One element of a section, as a line: its kind, then its own words. */
function ElementLine({ element, locale }: { element: PageElement; locale: EditorLocale }) {
  const spec = ELEMENT_SPECS[element.type];
  const summary = elementSummary(element, locale);
  return (
    <>
      {spec && <NodeIcon icon={spec.icon} className="mt-0.5 size-3.5 shrink-0 text-ink-soft" />}
      <span className="min-w-0 flex-1">
        <span className="text-ink-soft">{elementLabel(element.type, spec?.label ?? element.type, locale)}</span>
        {summary && (
          <span className="ms-2 text-ink" dir="auto">
            {summary}
          </span>
        )}
      </span>
    </>
  );
}

export function SectionCard({
  section,
  selected,
  onSelect,
  onDelete,
  showSummary = true,
  variant = "panel",
  hidden = false,
  menuItems,
  outline = false,
  onSelectElement,
  selectedElementId = null,
}: {
  section: PageSection;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  /** Off for a compact one-line row (the website editor's layer list). */
  showSummary?: boolean;
  /** `sheet`: the row inside a sheet on a phone — 56px tall, everything a thumb needs in view. */
  variant?: "panel" | "sheet";
  /** The section is hidden from shoppers: its row says so. */
  hidden?: boolean;
  /**
   * What «…» (and a right-click or long press on the row) offers. Given, it
   * takes the place of the bare delete button; left out, the delete button
   * stays as it always was.
   */
  menuItems?: readonly ContextMenuItem[];
  /** Row only: list the section's elements under it. */
  outline?: boolean;
  /** Makes the lines of that list buttons. */
  onSelectElement?: (elementId: string) => void;
  selectedElementId?: string | null;
}) {
  const locale = useEditorLocale();
  const t = leftUi(locale);
  const label = sectionLabel(section, locale);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    attributes: { roleDescription: t.sortableRole },
    // Nothing slides for people who asked for less motion.
    transition: prefersReducedMotion() ? null : MAKE_ROOM,
  });

  const elements = sectionElements(section);
  const icon = sectionIcon(section);
  const touch = variant === "sheet";
  /** The row is drawn on the brand fill: what sits on it takes the fill's own text colour. */
  const onBrand = selected && !showSummary;

  // The others make room on transform; the one being carried also lifts (scale and shadow).
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: [transition, "scale var(--dur-fade) var(--ease-out)"].filter(Boolean).join(", "),
  };

  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={t.reorder(label)}
      data-slot="section-row-handle"
      className={cn(
        // touch-none: a finger on the handle drags the section, it does not scroll the list.
        "flex w-11 shrink-0 cursor-grab touch-none items-center justify-center self-stretch rounded-full outline-none active:cursor-grabbing",
        "transition-colors duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
        "focus-visible:outline-2 focus-visible:-outline-offset-4",
        onBrand ? "focus-visible:outline-current" : "text-ink-soft hover:text-ink focus-visible:outline-primary"
      )}
    >
      <IconDragHandle className={cn("size-[18px]", onBrand && "opacity-80")} aria-hidden />
    </button>
  );

  if (!showSummary) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        data-slot="section-row"
        className={cn("zimos-section-row relative", isDragging && "z-10 scale-[1.02] motion-reduce:scale-100")}
      >
        <div
          data-slot="section-pill"
          data-selected={selected ? "" : undefined}
          data-dragging={isDragging ? "" : undefined}
          data-hidden={hidden ? "" : undefined}
          className={cn(
            "zimos-section-pill flex items-center rounded-full",
            "transition-[background-color,color,box-shadow] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
            touch ? "h-14" : "h-12",
            selected
              ? "bg-primary text-primary-foreground forced-colors:bg-[color:Highlight] forced-colors:text-[color:HighlightText]"
              : cn("text-ink", isDragging ? "bg-paper-raised ring-1 ring-line" : "hover:bg-paper-sunken"),
            isDragging && "shadow-[var(--shadow-raised)]"
          )}
        >
          {handle}
          {/* A right-click or a long press on the name opens the same menu as «…». The handle stays out of it:
              a finger resting on the handle is about to drag, not asking for a menu. */}
          <ContextMenu items={menuItems ?? []} label={t.rowMenu(label)}>
            <button
              type="button"
              onClick={onSelect}
              aria-current={selected ? "true" : undefined}
              className={cn(
                "flex min-w-0 flex-1 cursor-pointer items-center gap-2 self-stretch rounded-full pe-1 text-start outline-none",
                "focus-visible:outline-2 focus-visible:-outline-offset-2",
                selected ? "focus-visible:outline-current" : "focus-visible:outline-primary"
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-[0.5rem]",
                  selected ? "bg-current/15" : "bg-primary-soft text-primary-dark dark:text-primary"
                )}
              >
                <NodeIcon icon={icon} className="size-4" />
              </span>
              <span className={cn("min-w-0 flex-1 truncate text-sm font-medium", hidden && "opacity-60")}>{label}</span>
              {hidden && (
                <span className="flex shrink-0 items-center" title={t.hidden}>
                  <IconEyeOff className="size-4 opacity-80" aria-hidden />
                  <span className="sr-only">{t.hidden}</span>
                </span>
              )}
              {elements.length > 0 && (
                <span className={cn("hidden shrink-0 text-xs tabular-nums @[15rem]:inline", selected ? "opacity-80" : "text-ink-soft")}>
                  {t.elements(elements.length)}
                </span>
              )}
            </button>
          </ContextMenu>
          {menuItems ? (
            <RowMenu items={menuItems} label={t.rowMenu(label)} onBrand={selected} />
          ) : (
            <button
              type="button"
              onClick={onDelete}
              aria-label={t.removeAria(label)}
              title={t.removeAria(label)}
              className={cn(
                "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none",
                "transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
                "focus-visible:outline-2 focus-visible:-outline-offset-4 active:scale-[0.97] motion-reduce:active:scale-100",
                selected
                  ? "text-current hover:bg-current/15 focus-visible:outline-current"
                  : "text-ink-soft hover:bg-danger-soft hover:text-danger focus-visible:outline-danger"
              )}
            >
              <IconDelete className="size-[18px]" aria-hidden />
            </button>
          )}
        </div>

        {outline && elements.length > 0 && (
          <ul aria-label={t.outlineOf(label)} className="ms-[1.375rem] mt-1 space-y-0.5 border-s border-line ps-2 pb-1">
            {elements.map((element) => {
              const current = element.id === selectedElementId;
              const lineClass = cn(
                "flex w-full items-start gap-2 rounded-[0.625rem] px-2 py-1.5 text-start text-[0.8125rem] leading-5",
                touch ? "min-h-11 items-center" : "pointer-coarse:min-h-11 pointer-coarse:items-center"
              );
              return (
                <li key={element.id}>
                  {onSelectElement ? (
                    <button
                      type="button"
                      onClick={() => onSelectElement(element.id)}
                      aria-current={current ? "true" : undefined}
                      className={cn(
                        lineClass,
                        "cursor-pointer outline-none transition-colors duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
                        "hover:bg-paper-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
                        current && "bg-primary-soft"
                      )}
                    >
                      <ElementLine element={element} locale={locale} />
                    </button>
                  ) : (
                    <span className={lineClass}>
                      <ElementLine element={element} locale={locale} />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-slot="section-card"
      data-selected={selected ? "" : undefined}
      className={cn(
        "zimos-section-card rounded-[var(--radius-card)] bg-paper-raised ring-1 transition-[box-shadow] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
        selected ? "ring-2 ring-primary" : "ring-line hover:ring-primary/50",
        isDragging && "z-10 scale-[1.02] shadow-[var(--shadow-raised)] motion-reduce:scale-100"
      )}
    >
      <div className="flex min-h-12 items-center border-b border-line pe-1">
        {handle}
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 self-stretch rounded-[0.5rem] px-1 text-start outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        >
          <NodeIcon icon={icon} className="size-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-medium text-ink">{label}</span>
        </button>
        {menuItems ? (
          <RowMenu items={menuItems} label={t.rowMenu(label)} />
        ) : (
          <button
            type="button"
            onClick={onDelete}
            aria-label={t.removeAria(label)}
            title={t.removeAria(label)}
            className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft outline-none transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-danger active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 pointer-coarse:size-11"
          >
            <IconDelete className="size-4" aria-hidden />
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onSelect}
        className="block w-full cursor-pointer space-y-1.5 rounded-b-[var(--radius-card)] px-4 py-3 text-start outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
      >
        {elements.length === 0 ? (
          <span className="text-sm text-ink-soft">{editorUi(locale).emptySection}</span>
        ) : (
          elements.map((element) => (
            <span key={element.id} className="flex items-start gap-2 text-sm">
              <ElementLine element={element} locale={locale} />
            </span>
          ))
        )}
      </button>
    </div>
  );
}
