import { Fragment, useEffect, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  IconAnnounce,
  IconArrowDown,
  IconArrowUp,
  IconBookmark,
  IconCaretDown,
  IconCopy,
  IconDelete,
  IconEye,
  IconEyeOff,
  IconPanelBottom,
  IconPanelTop,
  IconPin,
  IconPlus,
  type IconComponent,
} from "@/components/icons";
import { Button, cn } from "@store-builder/ui";
import type { PageSection } from "@store-builder/api-client";
import type { ContextMenuItem } from "@/components/ContextMenu";
import { SectionCard } from "./SectionCard";
import { SaveSectionSheet, linkedSavedSectionId } from "./SavedSections";
import { sectionLabel } from "./blocks";
import { useEditorLocale } from "./editorLocale";
import { leftUi } from "./library/strings";
import type { ShellPart } from "./storeShell";

/**
 * The page's sections as a list — the editor's sortable outline (SectionCard
 * + dnd-kit) beside the live preview. Each row is one 48px pill: drag its
 * handle to reorder (or pick it up with Space and move it with the arrows),
 * press it to select, «…» for what can be done to it. Between any two rows a
 * thin line grows a "+" to add a section exactly there.
 *
 * The selected row lists its elements under it; the rest stay one line so a
 * long page still fits the pane.
 *
 * The store's fixed parts bracket the list — the announcement bar and header
 * above it, the footer below — so the outline reads top to bottom like the
 * page does. They open their own panels, and can't be dragged or deleted:
 * they are the same on every page.
 *
 * `variant="sheet"` is the same list inside a sheet on a phone: 56px rows, no
 * header of its own (the sheet has the title), and nothing that waits for a
 * hover.
 */

/** A section the storefront does not show: `settings.hidden` is true. */
export function isSectionHidden(section: PageSection): boolean {
  return (section.settings as Record<string, unknown> | undefined)?.hidden === true;
}

export function LayerList({
  sections,
  selectedId,
  insertIndex,
  onSelect,
  onDelete,
  onMove,
  onInsertAt,
  open = true,
  onOpenChange,
  selectedShell = null,
  onSelectShell,
  announcementOn = false,
  variant = "panel",
  onDuplicate,
  onToggleHidden,
  isHidden = isSectionHidden,
  saveToLibrary = true,
  funnelId,
  onSelectElement,
  selectedElementId = null,
}: {
  sections: PageSection[];
  selectedId: string | null;
  /** The slot "add a section here" is pointing at, highlighted until a block is picked. */
  insertIndex: number | null;
  onSelect: (sectionId: string) => void;
  onDelete: (section: PageSection) => void;
  onMove: (from: number, to: number) => void;
  onInsertAt: (index: number) => void;
  /** Folded to its header or not — owned by the editor so the pane split can make way. */
  open?: boolean;
  /** Given, the list has a header that folds it. Left out (or in a sheet), there is no header and the list is always open. */
  onOpenChange?: (open: boolean) => void;
  /** Which fixed part is open in the inspector, if any. */
  selectedShell?: ShellPart | null;
  /** Shows the fixed rows when given. */
  onSelectShell?: (part: ShellPart) => void;
  /** Whether the announcement bar is switched on — its row says so. */
  announcementOn?: boolean;
  /** `sheet`: inside a sheet on a phone. */
  variant?: "panel" | "sheet";
  /** «كرّره» in a row's menu, when given. */
  onDuplicate?: (section: PageSection) => void;
  /** «اخفيه / اظهره» in a row's menu, when given. */
  onToggleHidden?: (section: PageSection) => void;
  /** Which sections are hidden from shoppers. Default: `settings.hidden === true`. */
  isHidden?: (section: PageSection) => boolean;
  /** «احفظه في مكتبتي» in a row's menu (the list saves it itself). Default on. */
  saveToLibrary?: boolean;
  /** Inside a funnel: saving a section offers to keep it for that funnel only. */
  funnelId?: string;
  /** Makes the selected section's elements pressable. */
  onSelectElement?: (sectionId: string, elementId: string) => void;
  selectedElementId?: string | null;
}) {
  const locale = useEditorLocale();
  const t = leftUi(locale);
  const rows = useRef(new Map<string, HTMLElement>());
  const [saving, setSaving] = useState<PageSection | null>(null);
  const sheet = variant === "sheet";
  const header = !sheet && onOpenChange !== undefined;
  const shown = sheet || !header || open;

  const sensors = useSensors(
    // A small distance threshold so a click on the handle still selects rather
    // than starting a phantom drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onMove(
      sections.findIndex((s) => s.id === active.id),
      sections.findIndex((s) => s.id === over.id)
    );
  }

  // What a screen reader hears while a section is carried with the keyboard.
  const nameOf = (id: UniqueIdentifier) => {
    const section = sections.find((s) => s.id === id);
    return section ? sectionLabel(section, locale) : String(id);
  };
  const placeOf = (id: UniqueIdentifier) => sections.findIndex((s) => s.id === id) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => t.dragPicked(nameOf(active.id)),
    onDragOver: ({ active, over }) => (over ? t.dragOver(nameOf(active.id), placeOf(over.id), sections.length) : undefined),
    onDragEnd: ({ active, over }) =>
      over ? t.dragDropped(nameOf(active.id), placeOf(over.id), sections.length) : t.dragCancelled(nameOf(active.id)),
    onDragCancel: ({ active }) => t.dragCancelled(nameOf(active.id)),
  };

  // A section picked in the preview may be far down the list: bring it into view.
  useEffect(() => {
    if (!selectedId || !shown) return;
    rows.current.get(selectedId)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId, shown]);

  const selectedIndex = selectedId ? sections.findIndex((s) => s.id === selectedId) : -1;

  function menuFor(section: PageSection, index: number): ContextMenuItem[] {
    const hidden = isHidden(section);
    const items: ContextMenuItem[] = [
      { id: "up", label: t.moveUp, icon: IconArrowUp, onSelect: () => onMove(index, index - 1), disabled: index === 0 },
      {
        id: "down",
        label: t.moveDown,
        icon: IconArrowDown,
        onSelect: () => onMove(index, index + 1),
        disabled: index === sections.length - 1,
      },
      { id: "add", label: t.addAfter, icon: IconPlus, onSelect: () => onInsertAt(index + 1), separatorBefore: true },
    ];
    if (onDuplicate) items.push({ id: "duplicate", label: t.duplicate, icon: IconCopy, onSelect: () => onDuplicate(section) });
    if (onToggleHidden) {
      items.push({
        id: "hide",
        label: hidden ? t.show : t.hide,
        icon: hidden ? IconEye : IconEyeOff,
        onSelect: () => onToggleHidden(section),
      });
    }
    // A section that already comes from the library is managed from the inspector (update / detach).
    if (saveToLibrary && !linkedSavedSectionId(section)) {
      items.push({ id: "save", label: t.saveToLibrary, icon: IconBookmark, onSelect: () => setSaving(section) });
    }
    items.push({
      id: "delete",
      label: t.remove,
      icon: IconDelete,
      onSelect: () => onDelete(section),
      destructive: true,
      separatorBefore: true,
    });
    return items;
  }

  const slot = (index: number) => {
    // The slot the library is about to fill stays open; so do the two around the selected row
    // where there is no hover to reveal them (a touch screen, the sheet).
    const active = insertIndex === index;
    const near = selectedIndex >= 0 && (index === selectedIndex || index === selectedIndex + 1);
    const pinned = active || (sheet && near);
    return (
      <button
        type="button"
        onClick={() => onInsertAt(index)}
        aria-label={t.addHere}
        title={t.addHere}
        data-slot="section-insert"
        data-active={active ? "" : undefined}
        className={cn(
          "zimos-insert-slot group/slot relative z-[1] flex w-full cursor-pointer items-center justify-center outline-none",
          // A little more to aim at than the gap itself, without moving the rows.
          "before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] pointer-coarse:before:hidden",
          pinned ? "h-11" : near ? "h-2 pointer-coarse:h-11" : "h-2"
        )}
      >
        <span
          aria-hidden
          className={cn(
            "pointer-events-none h-0.5 w-full rounded-full bg-primary transition-[opacity,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
            "group-hover/slot:scale-x-100 group-hover/slot:opacity-60 group-focus-visible/slot:scale-x-100 group-focus-visible/slot:opacity-60",
            pinned
              ? "opacity-60"
              : near
                ? "scale-x-75 opacity-0 pointer-coarse:scale-x-100 pointer-coarse:opacity-60"
                : "scale-x-75 opacity-0"
          )}
        />
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-card)]",
            "transition-[opacity,scale] duration-[var(--dur-pop)] ease-[var(--ease-pop)] motion-reduce:transition-none",
            "group-hover/slot:scale-100 group-hover/slot:opacity-100 group-focus-visible/slot:scale-100 group-focus-visible/slot:opacity-100 group-focus-visible/slot:ring-4 group-focus-visible/slot:ring-primary/25",
            pinned
              ? "scale-100 opacity-100"
              : near
                ? "scale-50 opacity-0 pointer-coarse:scale-100 pointer-coarse:opacity-100"
                : "scale-50 opacity-0"
          )}
        >
          <IconPlus className="size-4" aria-hidden />
        </span>
      </button>
    );
  };

  return (
    <div
      data-slot="layer-list"
      data-variant={variant}
      className={cn("zimos-layer-list flex min-h-0 flex-col", sheet ? "" : shown ? "flex-1" : "shrink-0 border-b border-line")}
    >
      {header && (
        <button
          type="button"
          onClick={() => onOpenChange?.(!open)}
          aria-expanded={open}
          aria-label={open ? t.hideList : t.showList}
          className="flex min-h-11 w-full shrink-0 cursor-pointer items-center gap-2 px-4 py-2 text-start outline-none transition-colors duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
        >
          <span className="min-w-0 flex-1 truncate font-display text-sm font-medium text-ink">{t.listTitle}</span>
          {sections.length > 0 && <span className="shrink-0 text-xs text-ink-soft tabular-nums">{t.items(sections.length)}</span>}
          <IconCaretDown
            className={cn(
              "size-4 shrink-0 text-ink-soft transition-[rotate] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
              !open && "-rotate-90 rtl:rotate-90"
            )}
            aria-hidden
          />
        </button>
      )}

      {shown && (
        <div className={cn("@container", sheet ? "" : "min-h-0 flex-1 overflow-y-auto px-2 pb-3", !sheet && !header && "pt-2")}>
          {onSelectShell && (
            <div className="space-y-2">
              <FixedRow
                icon={IconAnnounce}
                label={t.announcement}
                hint={announcementOn ? t.onEveryPage : t.announcementOff}
                muted={!announcementOn}
                tall={sheet}
                selected={selectedShell === "announcement"}
                onSelect={() => onSelectShell("announcement")}
              />
              <FixedRow
                icon={IconPanelTop}
                label={t.header}
                hint={t.onEveryPage}
                tall={sheet}
                selected={selectedShell === "header"}
                onSelect={() => onSelectShell("header")}
              />
            </div>
          )}
          {sections.length === 0 ? (
            <div className="my-2 flex flex-col items-center gap-3 rounded-[1.25rem] border border-dashed border-line-strong/60 px-4 py-6 text-center">
              <p className="text-sm leading-6 text-ink-soft">{t.emptyPage}</p>
              <Button type="button" className="min-h-11 rounded-full px-5" onClick={() => onInsertAt(0)}>
                <IconPlus className="size-4" aria-hidden />
                {t.addSection}
              </Button>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
              accessibility={{ announcements, screenReaderInstructions: { draggable: t.dragHelp } }}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <div>
                  {slot(0)}
                  {sections.map((section, index) => (
                    <Fragment key={section.id}>
                      <div
                        ref={(el) => {
                          if (el) rows.current.set(section.id, el);
                          else rows.current.delete(section.id);
                        }}
                      >
                        <SectionCard
                          section={section}
                          selected={section.id === selectedId}
                          showSummary={false}
                          outline={section.id === selectedId}
                          variant={variant}
                          hidden={isHidden(section)}
                          menuItems={menuFor(section, index)}
                          onSelect={() => onSelect(section.id)}
                          onDelete={() => onDelete(section)}
                          onSelectElement={onSelectElement ? (elementId) => onSelectElement(section.id, elementId) : undefined}
                          selectedElementId={selectedElementId}
                        />
                      </div>
                      {slot(index + 1)}
                    </Fragment>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
          {onSelectShell && (
            <FixedRow
              icon={IconPanelBottom}
              label={t.footer}
              hint={t.onEveryPage}
              tall={sheet}
              selected={selectedShell === "footer"}
              onSelect={() => onSelectShell("footer")}
            />
          )}
        </div>
      )}

      <SaveSectionSheet section={saving} onClose={() => setSaving(null)} funnelId={funnelId} />
    </div>
  );
}

/**
 * One of the store's fixed parts in the outline: selectable like a section,
 * with a pin where a section has its drag handle and nothing where it has its
 * menu — the shape says it stays put.
 */
function FixedRow({
  icon: Glyph,
  label,
  hint,
  selected,
  muted = false,
  tall = false,
  onSelect,
}: {
  icon: IconComponent;
  label: string;
  hint: string;
  selected: boolean;
  muted?: boolean;
  tall?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      data-slot="section-pill"
      data-selected={selected ? "" : undefined}
      data-fixed=""
      className={cn(
        "zimos-section-pill flex w-full cursor-pointer items-center rounded-full pe-4 text-start outline-none",
        "transition-[background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        tall ? "h-14" : "h-12",
        selected
          ? "bg-primary text-primary-foreground forced-colors:bg-[color:Highlight] forced-colors:text-[color:HighlightText]"
          : "text-ink hover:bg-paper-sunken"
      )}
    >
      <span className="flex w-11 shrink-0 items-center justify-center">
        <IconPin className={cn("size-4", selected ? "opacity-80" : "text-ink-soft")} aria-hidden />
      </span>
      <span
        className={cn(
          "me-2 flex size-7 shrink-0 items-center justify-center rounded-[0.5rem]",
          selected ? "bg-current/15" : muted ? "bg-paper-sunken text-ink-soft" : "bg-primary-soft text-primary-dark dark:text-primary"
        )}
      >
        <Glyph className="size-4" aria-hidden />
      </span>
      <span className={cn("min-w-0 flex-1 truncate text-sm font-medium", muted && !selected && "text-ink-soft")}>{label}</span>
      <span className={cn("ms-2 hidden shrink-0 text-xs @[15rem]:inline", selected ? "opacity-80" : "text-ink-soft")}>{hint}</span>
    </button>
  );
}
