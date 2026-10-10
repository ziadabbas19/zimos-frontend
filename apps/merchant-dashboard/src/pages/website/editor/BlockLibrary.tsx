import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { IconClose, IconSearch } from "@/components/icons";
import { Button, Input, cn } from "@store-builder/ui";
import type { PageSection } from "@store-builder/api-client";
import { Select } from "@/components/Select";
import { SheetBody, SheetFrame, SheetHeader } from "@/components/Sheet";
import { ChipRow, ListToolbar, type ChipItem } from "@/components/list";
import { BLOCK_GROUPS, BLOCK_PRESETS, type BlockPreset } from "./blocks";
import { PresetThumbnail } from "./BlockThumbnail";
import { SavedSectionsGrid, useSavedSections, type SavedSectionsState } from "./SavedSections";
import { editorUi, groupLabel, presetText, useEditorLocale, type EditorLocale } from "./editorLocale";
import {
  POPULAR_KEY_SET,
  POPULAR_PRESETS,
  PRESETS_BY_PRIMARY,
  PRESETS_BY_PURPOSE,
  PURPOSES,
  purposeLabel,
  searchPresets,
  type Purpose,
} from "./library/purposes";
import { leftUi } from "./library/strings";

/**
 * The library of sections. Every preset is a card with a schematic of the
 * section it creates (BlockThumbnail), searchable in either language.
 *
 * Two shapes:
 *  - `variant="panel"` (the default — the funnel step editor's side pane): a
 *    compact gallery filtered by the presets' own groups. Every card is also
 *    a native HTML5 drag source, so a block can be dropped at an exact spot
 *    on the live preview canvas (see StorefrontPreview's drop overlay).
 *  - `variant="sheet"` / `BlockLibrarySheet` (the website editor): the same
 *    presets sorted by what a section is FOR — chips for hero, products,
 *    offers, trust, reviews, FAQ, content, forms, footer — with bigger
 *    drawings, a name and one line each, and the store's saved sections as
 *    their own chip. One tap adds the section and closes the sheet.
 *
 * Every entry maps onto element types the backend actually allows
 * (pageTree.ALLOWED_ELEMENT_TYPES) — adding one that isn't on that allowlist
 * would make the page unsaveable, so the list is derived from BLOCK_PRESETS
 * rather than hand-written here.
 *
 * About dragging: `dataTransfer` carries a plain type marker so a drop target
 * that isn't this editor's own can tell what's being dragged — the actual
 * preset is tracked as plain component state instead of read out of
 * `dataTransfer`, since `getData` during `dragover` is unreliable in most
 * browsers and the drop target needs the preset well before `drop` fires.
 */

/** The `dataTransfer` type marker for a block dragged out of this library. */
export const BLOCK_DRAG_TYPE = "application/x-zimos-block";

type GroupFilter = "all" | BlockPreset["group"];

export interface BlockLibraryProps {
  onAdd: (preset: BlockPreset) => void;
  /** Off when a surrounding dialog already titles the list. */
  showHeader?: boolean;
  /**
   * 1-based place the next block will land, when the merchant picked one with
   * "add a section here"; null appends to the bottom as before.
   */
  insertPosition?: number | null;
  onCancelInsert?: () => void;
  /** A card's drag just started, or just ended (dropped, or cancelled). Panel only. */
  onDragStart?: (preset: BlockPreset) => void;
  onDragEnd?: () => void;
  /** `sheet`: the library by purpose, with big drawings — what `BlockLibrarySheet` shows. */
  variant?: "panel" | "sheet";
  /** Sheet only: shows the «محفوظاتي» chip; a saved section picked there arrives here, ready to insert. */
  onInsertSaved?: (section: PageSection) => void;
  /** Sheet only, inside a funnel: that funnel's own saved sections too. */
  funnelId?: string;
}

export function BlockLibrary(props: BlockLibraryProps) {
  return props.variant === "sheet" ? <BlockLibraryBody {...props} /> : <BlockLibraryPanel {...props} />;
}

// ---------------------------------------------------------------------------
// The panel
// ---------------------------------------------------------------------------

function BlockLibraryPanel({
  onAdd,
  showHeader = true,
  insertPosition = null,
  onCancelInsert,
  onDragStart,
  onDragEnd,
}: BlockLibraryProps) {
  const locale = useEditorLocale();
  const ui = editorUi(locale);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<GroupFilter>("all");

  const searching = query.trim() !== "";
  // The popular row only makes sense as a first read of the full, unfiltered
  // gallery — once the merchant has narrowed by group or search, showing it
  // again (now possibly missing entries the filter excludes) would just be
  // confusing, so it drops out and the grid below is the complete answer.
  const showPopular = group === "all" && !searching;

  const presets = useMemo(() => {
    const within = BLOCK_PRESETS.filter((preset) => {
      if (group !== "all" && preset.group !== group) return false;
      return !(showPopular && POPULAR_KEY_SET.has(preset.key));
    });
    return searchPresets(query, within);
  }, [query, group, showPopular]);

  const tabs: Array<{ value: GroupFilter; label: string }> = [
    { value: "all", label: ui.allGroups },
    ...BLOCK_GROUPS.map((g) => ({ value: g, label: groupLabel(g, locale) })),
  ];

  const grid = "grid grid-cols-2 gap-1.5 @[28rem]:grid-cols-3 @[40rem]:grid-cols-4";

  return (
    <div className="@container flex h-full min-h-0 flex-col">
      {showHeader && (
        <div className="border-b border-line px-4 py-3">
          <h2 className="font-display text-sm font-medium text-ink">{ui.addBlock}</h2>
          {insertPosition === null ? (
            <p className="text-xs text-ink-soft">{ui.addBlockHint}</p>
          ) : (
            <p className="mt-1 flex items-center justify-between gap-2 rounded-[0.5rem] bg-primary-soft px-2 py-1 text-xs font-medium text-primary-dark dark:text-primary">
              <span>{ui.insertingAt(insertPosition)}</span>
              {onCancelInsert && (
                <button
                  type="button"
                  onClick={onCancelInsert}
                  className="flex min-h-7 cursor-pointer items-center gap-0.5 rounded-full px-1.5 hover:underline focus-visible:outline-2 focus-visible:outline-primary pointer-coarse:min-h-11"
                >
                  <IconClose className="size-3" aria-hidden />
                  {ui.cancelInsert}
                </button>
              )}
            </p>
          )}
        </div>
      )}

      <div className="space-y-2 border-b border-line px-3 py-2.5">
        <div className="relative">
          <IconSearch
            className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-soft"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={ui.searchBlocks}
            aria-label={ui.searchBlocks}
            className="h-9 ps-8 text-sm pointer-coarse:h-11"
          />
        </div>
        {/* One line, whatever the number of groups: a native select shows every group and costs one row. */}
        <Select
          value={group}
          onChange={(e) => setGroup(e.target.value as GroupFilter)}
          aria-label={ui.addBlock}
          className="h-9 py-0 text-sm pointer-coarse:h-11"
        >
          {tabs.map((tab) => (
            <option key={tab.value} value={tab.value}>
              {tab.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5">
        {showPopular && POPULAR_PRESETS.length > 0 && (
          <div className="mb-3">
            <p className="mb-1.5 px-0.5 text-[11px] font-semibold text-ink-soft">{ui.popularBlocks}</p>
            <ul className={grid}>
              {POPULAR_PRESETS.map((preset) => (
                <PanelCard key={preset.key} preset={preset} locale={locale} onAdd={onAdd} onDragStart={onDragStart} onDragEnd={onDragEnd} />
              ))}
            </ul>
          </div>
        )}

        {presets.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-1 py-6 text-center">
            <p className="text-sm text-ink-soft">{ui.noBlocksFound}</p>
            {searching && (
              <Button type="button" size="sm" variant="outline" className="rounded-full pointer-coarse:min-h-11" onClick={() => setQuery("")}>
                {leftUi(locale).clearSearch}
              </Button>
            )}
          </div>
        ) : (
          <ul className={grid}>
            {presets.map((preset) => (
              <PanelCard key={preset.key} preset={preset} locale={locale} onAdd={onAdd} onDragStart={onDragStart} onDragEnd={onDragEnd} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** One card of the panel: a drawing and a name; pressed it adds, dragged it drops on the canvas. */
function PanelCard({
  preset,
  locale,
  onAdd,
  onDragStart,
  onDragEnd,
}: {
  preset: BlockPreset;
  locale: EditorLocale;
  onAdd: (preset: BlockPreset) => void;
  onDragStart?: (preset: BlockPreset) => void;
  onDragEnd?: () => void;
}) {
  const text = presetText(preset.key, preset, locale);
  return (
    <li>
      <button
        type="button"
        draggable
        onClick={() => onAdd(preset)}
        onDragStart={(e) => {
          // The default drag image (a snapshot of this button) is already the
          // thumbnail plus its label. `effectAllowed`/`setData` are what make
          // Firefox and Safari start the drag at all; the preset itself
          // travels as component state (see the file doc).
          e.dataTransfer.effectAllowed = "copy";
          e.dataTransfer.setData(BLOCK_DRAG_TYPE, preset.key);
          onDragStart?.(preset);
        }}
        onDragEnd={() => onDragEnd?.()}
        title={text.description}
        data-slot="library-card"
        className="zimos-library-card group flex h-full w-full cursor-grab flex-col gap-1.5 rounded-[0.875rem] bg-paper-raised p-1.5 text-start ring-1 ring-line transition-[box-shadow,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:ring-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:cursor-grabbing motion-reduce:transition-none"
      >
        <PresetThumbnail preset={preset} />
        <span className="px-0.5 pb-0.5 text-[11px] leading-snug font-medium text-ink">{text.label}</span>
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// The library by purpose (the sheet's content)
// ---------------------------------------------------------------------------

type View = "all" | Purpose | "saved";

function BlockLibraryBody({
  onAdd,
  onInsertSaved,
  funnelId,
}: BlockLibraryProps) {
  const saved = useSavedSections(funnelId, onInsertSaved !== undefined);
  return <LibraryBrowser onPick={onAdd} onInsertSaved={onInsertSaved} saved={saved} className="flex h-full min-h-0 flex-col" />;
}

const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3";

function LibraryBrowser({
  onPick,
  onInsertSaved,
  saved,
  searchRef,
  className,
  bodyClassName,
  inSheet = false,
}: {
  onPick: (preset: BlockPreset) => void;
  onInsertSaved?: (section: PageSection) => void;
  saved: SavedSectionsState;
  /** Where the search field's wrapper is, so a sheet can start the caret in it. */
  searchRef?: RefObject<HTMLDivElement | null>;
  className?: string;
  bodyClassName?: string;
  /** Inside a sheet the scrolling part is the sheet's own body. */
  inSheet?: boolean;
}) {
  const locale = useEditorLocale();
  const t = leftUi(locale);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("all");
  // The first screenful straight away; the rest of the hundred-odd cards a frame later, so the sheet opens at once.
  const [everything, setEverything] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEverything(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const searching = query.trim() !== "";
  const savedCount = saved.list.length;

  const chips = useMemo(() => {
    const items: ChipItem<View>[] = [{ value: "all", label: t.all }];
    const savedChip: ChipItem<View> = { value: "saved", label: t.saved, count: savedCount > 0 ? savedCount : undefined };
    // With something saved, «محفوظاتي» sits right after «الكل»; with nothing, it waits at the end.
    if (onInsertSaved && savedCount > 0) items.push(savedChip);
    for (const purpose of PURPOSES) items.push({ value: purpose, label: purposeLabel(purpose, t) });
    if (onInsertSaved && savedCount === 0) items.push(savedChip);
    return items;
  }, [t, onInsertSaved, savedCount]);

  const results = useMemo(() => {
    if (!searching || view === "saved") return [];
    return searchPresets(query, view === "all" ? BLOCK_PRESETS : PRESETS_BY_PURPOSE[view]);
  }, [query, searching, view]);

  function changeQuery(next: string) {
    // A search looks everywhere: typing leaves the saved view, and a chip narrows it again if pressed.
    if (next.trim() !== "" && view === "saved") setView("all");
    setQuery(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Enter in the search field adds the first match, like a launcher.
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    if (!(event.target instanceof HTMLInputElement) || event.target.type !== "search") return;
    const first = results[0];
    if (!searching || !first) return;
    event.preventDefault();
    onPick(first);
  }

  const card = (preset: BlockPreset) => <LibraryCard key={preset.key} preset={preset} locale={locale} onPick={onPick} addLabel={t.addPreset} />;

  let body: ReactNode = null;
  if (view === "saved" && onInsertSaved) {
    body = <SavedSectionsGrid library={saved} onInsert={onInsertSaved} />;
  } else if (searching) {
    body =
      results.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
          <p className="text-sm text-ink-soft">{t.noResults}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" variant="outline" className="min-h-11 rounded-full px-5" onClick={() => setQuery("")}>
              {t.clearSearch}
            </Button>
            {view !== "all" && (
              <Button type="button" variant="ghost" className="min-h-11 rounded-full px-5" onClick={() => setView("all")}>
                {t.searchEverything}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <section>
          <h3 className="mb-2 text-xs font-medium text-ink-soft" aria-live="polite">
            {t.results(results.length)}
          </h3>
          <ul className={GRID}>{results.map(card)}</ul>
        </section>
      );
  } else if (view === "all") {
    body = (
      <div className="space-y-6">
        {POPULAR_PRESETS.length > 0 && (
          <section>
            <h3 className="mb-2 font-display text-sm font-semibold text-ink">{t.popular}</h3>
            <ul className={GRID}>{POPULAR_PRESETS.map(card)}</ul>
          </section>
        )}
        {(everything ? PURPOSES : PURPOSES.slice(0, 1)).map((purpose) => {
          const presets = PRESETS_BY_PRIMARY[purpose].filter((preset) => !POPULAR_KEY_SET.has(preset.key));
          if (presets.length === 0) return null;
          return (
            <section key={purpose}>
              <h3 className="mb-2 font-display text-sm font-semibold text-ink">{purposeLabel(purpose, t)}</h3>
              <ul className={GRID}>{presets.map(card)}</ul>
            </section>
          );
        })}
      </div>
    );
  } else if (view !== "saved") {
    body = <ul className={GRID}>{PRESETS_BY_PURPOSE[view].map(card)}</ul>;
  }

  const toolbar = (
    <div ref={searchRef} data-slot="library-toolbar" className="shrink-0 space-y-3 px-4 pb-3 sm:px-5" onKeyDown={onKeyDown}>
      <ListToolbar search={{ value: query, onChange: changeQuery, placeholder: t.searchPlaceholder, label: t.search }} />
      <ChipRow items={chips} value={view} onChange={setView} label={t.kinds} collapseEmpty={false} />
    </div>
  );

  if (inSheet) {
    return (
      <>
        {toolbar}
        <SheetBody className={cn("max-sm:px-4", bodyClassName)}>{body}</SheetBody>
      </>
    );
  }
  return (
    <div data-slot="block-library" className={className}>
      <div className="pt-3">{toolbar}</div>
      <div className={cn("min-h-0 flex-1 overflow-y-auto border-t border-line px-4 py-4 sm:px-5", bodyClassName)}>{body}</div>
    </div>
  );
}

/** One card of the sheet: the drawing, the section's name, and one line of what it is for. */
function LibraryCard({
  preset,
  locale,
  onPick,
  addLabel,
}: {
  preset: BlockPreset;
  locale: EditorLocale;
  onPick: (preset: BlockPreset) => void;
  addLabel: (label: string) => string;
}) {
  const text = presetText(preset.key, preset, locale);
  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={() => onPick(preset)}
        title={addLabel(text.label)}
        data-slot="library-card"
        className="zimos-library-card flex h-full w-full cursor-pointer flex-col gap-2 rounded-[1.25rem] bg-paper-raised p-2 text-start ring-1 ring-line transition-[translate,scale,box-shadow] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-raised)] hover:ring-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
      >
        <PresetThumbnail preset={preset} />
        <span className="block min-w-0 px-1 pb-1">
          <span className="block truncate text-sm font-medium text-ink">{text.label}</span>
          <span className="mt-0.5 line-clamp-2 text-xs leading-[1.125rem] text-ink-soft">{text.description}</span>
        </span>
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// The sheet
// ---------------------------------------------------------------------------

export interface BlockLibrarySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The section the merchant chose. The sheet closes itself after calling this. */
  onPick: (preset: BlockPreset) => void;
  /** 0-based place the section will land (from a "+" between sections); null or left out: the end of the page. */
  insertIndex?: number | null;
  /** Shows «محفوظاتي»; a saved section (a copy, or linked) arrives here ready to insert. The sheet closes after. */
  onInsertSaved?: (section: PageSection) => void;
  /** Inside a funnel: that funnel's own saved sections too. */
  funnelId?: string;
  title?: string;
}

/**
 * «ضيف قسم»: the library in a sheet — a bottom sheet at 92dvh on a phone, a
 * centred pane from 640px. Search, chips by purpose, drawings in two columns
 * on a phone and three on a desktop; one tap adds the section where the "+"
 * pointed (or at the end) and closes the sheet.
 */
export function BlockLibrarySheet({ open, onOpenChange, onPick, insertIndex = null, onInsertSaved, funnelId, title }: BlockLibrarySheetProps) {
  const t = leftUi(useEditorLocale());
  // Read while the sheet is closed too, so «محفوظاتي» is in its place the moment it opens.
  const saved = useSavedSections(funnelId, onInsertSaved !== undefined);
  const searchRef = useRef<HTMLDivElement>(null);
  const { refresh } = saved;
  const canShowSaved = onInsertSaved !== undefined;

  // A section saved since the last look is there on the next one.
  useEffect(() => {
    if (open && canShowSaved) void refresh();
  }, [open, canShowSaved, refresh]);

  return (
    <SheetFrame
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      // One height whatever is listed, so a search does not make the sheet jump.
      className="h-[92dvh] sm:h-[min(85dvh,46rem)]"
      popupProps={{
        // With a mouse or a keyboard the caret starts in the search; by touch it would only raise the keyboard.
        initialFocus: (openType) => (openType === "touch" ? true : (searchRef.current?.querySelector("input") ?? true)),
      }}
    >
      <SheetHeader
        title={title ?? t.libraryTitle}
        description={insertIndex === null ? t.insertEnd : t.insertAt(insertIndex + 1)}
        className="max-sm:ps-4"
      />
      <LibraryBrowser
        inSheet
        searchRef={searchRef}
        saved={saved}
        onPick={(preset) => {
          onPick(preset);
          onOpenChange(false);
        }}
        onInsertSaved={
          onInsertSaved
            ? (section) => {
                onInsertSaved(section);
                onOpenChange(false);
              }
            : undefined
        }
      />
    </SheetFrame>
  );
}
