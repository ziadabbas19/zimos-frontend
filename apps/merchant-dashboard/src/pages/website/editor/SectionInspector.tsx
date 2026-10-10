import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  IconArrowDown,
  IconArrowUp,
  IconBookmark,
  IconCaretRight,
  IconClose,
  IconColumns,
  IconCopy,
  IconData,
  IconDelete,
  IconEyeOff,
  IconMoreActions,
  IconTheme,
  type IconComponent,
} from "@/components/icons";
import { Button, cn } from "@store-builder/ui";
import type { PageColumn, PageElement, PageSection } from "@store-builder/api-client";
import { TriggerPopover as Popover, PopoverClose } from "@/components/TriggerPopover";
import { Segmented } from "@/components/Segmented";
import {
  COLUMN_SETTING_SPECS,
  ELEMENT_SPECS,
  ROW_SETTING_SPECS,
  SECTION_SETTING_SPECS,
  columnSetting,
  columnTitle,
  elementPosition,
  moveElement,
  replaceElement,
  rowSetting,
  sectionColumnCount,
  sectionElements,
  sectionIcon,
  sectionLabel,
  sectionSetting,
  setColumnSetting,
  setElementProp,
  setRowSetting,
  setSectionSetting,
  type SectionSettingSpec,
} from "./blocks";
import { MoveButtons } from "./MoveButtons";
import { parentOf, useParentFocus } from "./selectParent";
import { duplicateElement } from "./canvasTools";
import { ElementStylePanel, ElementTabs, type ElementTab, type NamedStyle } from "./ElementStylePanel";
import { SaveSectionPanel } from "./SavedSections";
import { BindingFields, boundCount, canBind } from "./DataBinding";
import {
  editorUi,
  elementLabel,
  sectionSettingLabel,
  sectionSettingOption,
  useEditorLocale,
  type EditorLocale,
  type EditorUi,
} from "./editorLocale";
import { MAX_SECTION_HEIGHT_PX } from "@/lib/canvasDrag";
import { sectionMinHeight, setSectionMinHeight } from "./canvasEdits";
import { ChoiceField, Group, NumberField } from "./inspector/controls";
import { ElementField, ElementFields } from "./inspector/ElementFields";
import { elementSummary } from "./inspector/elementSummary";
import {
  COMPACT_BELOW_PX,
  InspectorEnvProvider,
  PAIR_IMAGES_FROM_PX,
  SHEET_QUERY,
  useElementWidth,
  useMediaQuery,
  type ContentLanguage,
  type InspectorEnv,
  type RequestImage,
} from "./inspector/env";
import { HideOnDevices, hiddenScreenNames } from "./inspector/HideOnDevices";
import { inspectorNumber, inspectorUi } from "./inspector/strings";

/**
 * The end panel: what is selected, and three pages for it — Content, Style,
 * Visibility.
 *
 * It shows ONE thing at a time. With only a section selected: its elements as
 * a short list to tap (Content), its own look and its rows and columns
 * (Style), and who sees what (Visibility). With an element selected — from
 * the preview (`focusElementId`) or from that list — the element alone: its
 * fields, its look per screen, its display rules. A breadcrumb in the header
 * steps back up to the section.
 *
 * Every change still leaves through the one `onChange(section)` it always
 * had, so undo / redo and the funnel builder work as before.
 *
 * It lives in two containers: the editor's end panel (20rem) and a bottom
 * sheet on the phone. It never sets a height of its own; given one, its body
 * scrolls under a tab bar that stays put.
 */

export type InspectorTab = "content" | "style" | "visibility";

const TABS: readonly InspectorTab[] = ["content", "style", "visibility"];

/**
 * Reorder controls for one element within its column. Renders nothing when the
 * element has no neighbour to swap with.
 */
export function ElementMoveButtons({
  section,
  elementId,
  label,
  ui,
  onChange,
}: {
  section: PageSection;
  elementId: string;
  label: string;
  ui: EditorUi;
  onChange: (next: PageSection) => void;
}) {
  const position = elementPosition(section, elementId);
  if (!position || position.count < 2) return null;
  return (
    <MoveButtons
      canMoveUp={position.index > 0}
      canMoveDown={position.index < position.count - 1}
      onMoveUp={() => onChange(moveElement(section, elementId, -1))}
      onMoveDown={() => onChange(moveElement(section, elementId, 1))}
      upLabel={ui.moveElementUp(label)}
      downLabel={ui.moveElementDown(label)}
    />
  );
}

/**
 * The fields of one element with its own Content / Style / Layout / Display
 * tabs — for a view that lays several elements out inline (the funnel
 * builder's form view) instead of in the inspector; `actions` puts extra
 * controls (e.g. reordering) on the element's caption row.
 */
export function ElementFieldset({
  element,
  onPropChange,
  actions,
  onSettingsChange,
  namedStyles = [],
  onNamedStylesChange,
}: {
  element: PageElement;
  onPropChange: (element: PageElement, key: string, value: unknown) => void;
  actions?: ReactNode;
  /** With it the element gets Style and Layout tabs (ElementStylePanel). */
  onSettingsChange?: (element: PageElement, settings: Record<string, unknown> | undefined) => void;
  namedStyles?: NamedStyle[];
  onNamedStylesChange?: (next: NamedStyle[]) => void;
}) {
  const [tab, setTab] = useState<ElementTab>("content");
  const locale = useEditorLocale();
  const spec = ELEMENT_SPECS[element.type];
  const Icon = spec.icon;
  const props = (element.props ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-3 border-b border-line px-4 py-4 last:border-b-0">
      <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-ink-soft uppercase">
        <Icon className="size-3.5" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{elementLabel(element.type, spec.label, locale)}</span>
        {actions}
      </div>
      {onSettingsChange && <ElementTabs value={tab} onChange={setTab} />}
      {(tab === "content" || !onSettingsChange) &&
        spec.fields.map((field) => (
          <ElementField key={field.key} elementType={element.type} spec={field} props={props} onChange={(key, value) => onPropChange(element, key, value)} />
        ))}
      {(tab === "content" || !onSettingsChange) && (
        <BindingFields element={element} onChange={(bindings) => onPropChange(element, "bindings", bindings)} />
      )}
      {onSettingsChange && (tab === "style" || tab === "layout") && (
        <div className="-mx-4">
          <ElementStylePanel
            element={element}
            tab={tab}
            named={namedStyles}
            onSettingsChange={(settings) => onSettingsChange(element, settings)}
            onNamedChange={onNamedStylesChange}
          />
        </div>
      )}
    </div>
  );
}

/** One setting of a section, row or column, bilingual through the same maps whichever node it belongs to. */
function SettingChoice({
  spec,
  value,
  hint,
  locale,
  onChange,
}: {
  spec: SectionSettingSpec;
  value: string;
  hint?: string;
  locale: EditorLocale;
  onChange: (value: string) => void;
}) {
  return (
    <ChoiceField
      label={sectionSettingLabel(spec.key, spec.label, locale)}
      hint={hint}
      value={value || spec.defaultValue}
      options={spec.options.map((o) => ({ value: o.value, label: sectionSettingOption(spec.key, o.value, o.label, locale) }))}
      onChange={onChange}
    />
  );
}

function NodeGlyph({ icon: Glyph, className }: { icon: IconComponent; className?: string }) {
  return <Glyph className={className} aria-hidden />;
}

/** A row of a list that opens an element: its icon (or its picture), its name, one line about it, and what is set on it. */
function ElementRow({
  element,
  named,
  status,
  locale,
  onOpen,
}: {
  element: PageElement;
  named: NamedStyle[];
  /** Replaces the one-line summary (the Visibility list says who sees the element instead). */
  status?: string;
  locale: EditorLocale;
  onOpen: () => void;
}) {
  const t = inspectorUi(locale);
  const spec = ELEMENT_SPECS[element.type];
  const name = elementLabel(element.type, spec.label, locale);
  const line = status ?? elementSummary(element, locale);
  const src = element.type === "image" ? (element.props as Record<string, unknown> | undefined)?.src : null;
  const [broken, setBroken] = useState(false);
  const picture = typeof src === "string" && src !== "" && !broken ? src : null;
  const marks: Array<[IconComponent, string]> = [];
  if (hiddenScreenNames(element, named, t).length > 0) marks.push([IconEyeOff, t.markHidden]);
  if (boundCount(element) > 0) marks.push([IconData, t.markBound]);

  return (
    <li>
      <button
        type="button"
        data-slot="inspector-row"
        aria-label={t.editElement(line ? `${name}: ${line}` : name)}
        onClick={onOpen}
        className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-[0.875rem] px-2 py-1.5 text-start transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken/70 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary active:scale-[0.98] motion-reduce:transition-none"
      >
        {picture ? (
          <img
            src={picture}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-9 shrink-0 rounded-[0.625rem] bg-paper-sunken object-cover"
            onError={() => setBroken(true)}
          />
        ) : (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[0.625rem] bg-paper-sunken text-ink-soft">
            <NodeGlyph icon={spec.icon} className="size-[18px]" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{name}</span>
          {line && (
            <span className="block truncate text-xs leading-5 text-ink-soft" dir="auto">
              {line}
            </span>
          )}
        </span>
        {marks.map(([Mark, words]) => (
          <span key={words} title={words} className="shrink-0 text-ink-soft">
            <Mark className="size-3.5" aria-hidden />
            <span className="sr-only">{words}</span>
          </span>
        ))}
        <IconCaretRight className="size-4 shrink-0 text-ink-soft rtl:-scale-x-100" aria-hidden />
      </button>
    </li>
  );
}

const MENU_ITEM =
  "flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-[0.625rem] px-2.5 text-start text-sm text-ink hover:bg-paper-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40";

function MenuItem({ icon: Glyph, danger = false, disabled, onSelect, children }: { icon: IconComponent; danger?: boolean; disabled?: boolean; onSelect: () => void; children: ReactNode }) {
  return (
    <PopoverClose data-slot="inspector-menu-item" disabled={disabled} onClick={onSelect} className={cn(MENU_ITEM, danger && "text-danger hover:bg-danger-soft")}>
      <Glyph className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">{children}</span>
    </PopoverClose>
  );
}

export function SectionInspector({
  section,
  onChange,
  onDelete,
  onClose,
  namedStyles,
  onNamedStylesChange,
  onDuplicate,
  funnelId,
  focusElementId,
  tab: tabProp,
  onTabChange,
  onRequestImage,
  onFocusElementChange,
  variant,
}: {
  section: PageSection;
  onChange: (next: PageSection) => void;
  onDelete: () => void;
  onClose: () => void;
  /** Puts a copy of the section right after it (editor/canvasTools.ts). */
  onDuplicate?: () => void;
  /** The page's named styles (tree.globalStyles.named) and how to change them. */
  namedStyles?: NamedStyle[];
  onNamedStylesChange?: (next: NamedStyle[]) => void;
  /** In a funnel's editor: a saved section may be kept for that funnel only. */
  funnelId?: string;
  /** The element picked in the preview: the panel shows it (its Content first). Null or absent: the section. */
  focusElementId?: string | null;
  /** The page shown. Left out, the panel keeps its own. */
  tab?: InspectorTab;
  onTabChange?: (tab: InspectorTab) => void;
  /** Fields that take a picture ask the shell for its media picker. Absent: they only upload, as before. */
  onRequestImage?: RequestImage;
  /** Told when the panel itself moves to an element (tapped in the list) or back to the section (null). */
  onFocusElementChange?: (elementId: string | null) => void;
  /** Says outright where the panel sits. Left out, it is a sheet under 1024px and a panel above. */
  variant?: "panel" | "sheet";
}) {
  const locale = useEditorLocale();
  const ui = editorUi(locale);
  const t = inspectorUi(locale);
  const named = namedStyles ?? [];
  const elements = sectionElements(section);
  const columnCount = sectionColumnCount(section);
  const multiColumn = columnCount > 1;
  const parentFocus = useParentFocus();

  // --- where it sits: how much room the fields have --------------------------
  const rootRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(rootRef);
  const belowLg = useMediaQuery(SHEET_QUERY);
  const sheet = variant === "sheet" || (variant === undefined && belowLg);
  const compact = sheet || (width !== null && width > 0 && width < COMPACT_BELOW_PX);
  const pairImages = !compact && width !== null && width >= PAIR_IMAGES_FROM_PX;
  const [contentLanguage, setContentLanguage] = useState<ContentLanguage>("ar");
  const env = useMemo<InspectorEnv>(
    () => ({ compact, pairImages, requestImage: onRequestImage ?? null, contentLanguage, setContentLanguage }),
    [compact, pairImages, onRequestImage, contentLanguage]
  );

  // --- which page ------------------------------------------------------------
  const [ownTab, setOwnTab] = useState<InspectorTab>("content");
  const tab = tabProp ?? ownTab;
  function setTab(next: InspectorTab) {
    setOwnTab(next);
    onTabChange?.(next);
  }

  // --- what is shown: the section, or one element of it ----------------------
  const wanted = focusElementId ?? null;
  const [activeId, setActiveId] = useState<string | null>(wanted);
  const [seen, setSeen] = useState({ wanted, sectionId: section.id });
  if (seen.wanted !== wanted || seen.sectionId !== section.id) {
    // The preview picked something else: follow it, and open an element on its Content.
    setSeen({ wanted, sectionId: section.id });
    setActiveId(wanted);
    if (wanted !== null && seen.wanted !== wanted) setOwnTab("content");
  }
  const active = activeId ? (elements.find((el) => el.id === activeId) ?? null) : null;

  const scrollRef = parentFocus.containerRef;
  const pendingNode = useRef<string | null>(null);
  const viewKey = `${section.id}:${active?.id ?? ""}:${tab}`;
  useEffect(() => {
    const id = pendingNode.current;
    pendingNode.current = null;
    if (id) parentFocus.focusNode(id);
    else scrollRef.current?.scrollTo({ top: 0 });
    // Runs when the view changes, not when the helpers are re-made.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey]);

  function open(elementId: string | null, nextTab?: InspectorTab) {
    setActiveId(elementId);
    if (nextTab && nextTab !== tab) setTab(nextTab);
    onFocusElementChange?.(elementId);
  }

  /** "Select parent": back to the section, with the element's column (or the section) outlined for a moment. */
  function stepUp() {
    if (!active) return;
    pendingNode.current = parentOf(section, active.id, locale)?.id ?? section.id;
    open(null);
  }

  const changeSettings = (el: PageElement, settings: Record<string, unknown> | undefined) => {
    const { settings: _old, ...bare } = el;
    void _old;
    onChange(replaceElement(section, el.id, settings ? { ...bare, settings } : bare));
  };

  // --- header ----------------------------------------------------------------
  const sectionName = sectionLabel(section, locale);
  const activeSpec = active ? ELEMENT_SPECS[active.type] : null;
  const activeName = active && activeSpec ? elementLabel(active.type, activeSpec.label, locale) : "";
  const position = active ? elementPosition(section, active.id) : null;

  const menu = (
    <Popover
      label={active ? t.elementActions : t.sectionActions}
      align="end"
      className="min-w-52 p-1.5"
      trigger={
        <Button type="button" size="icon" variant="ghost" aria-label={active ? t.elementActions : t.sectionActions} title={active ? t.elementActions : t.sectionActions}>
          <IconMoreActions className="size-5" aria-hidden />
        </Button>
      }
    >
      {active ? (
        <>
          <MenuItem icon={IconCopy} onSelect={() => onChange(duplicateElement(section, active.id))}>
            {t.duplicateElement}
          </MenuItem>
          <MenuItem icon={IconArrowUp} disabled={!position || position.index === 0} onSelect={() => onChange(moveElement(section, active.id, -1))}>
            {t.moveUp}
          </MenuItem>
          <MenuItem
            icon={IconArrowDown}
            disabled={!position || position.index >= position.count - 1}
            onSelect={() => onChange(moveElement(section, active.id, 1))}
          >
            {t.moveDown}
          </MenuItem>
        </>
      ) : (
        <>
          {onDuplicate && (
            <MenuItem icon={IconCopy} onSelect={onDuplicate}>
              {t.duplicateSection}
            </MenuItem>
          )}
          <MenuItem
            icon={IconBookmark}
            onSelect={() => {
              if (tab === "visibility") {
                parentFocus.focusNode(`${section.id}:saved`);
                return;
              }
              pendingNode.current = `${section.id}:saved`;
              setTab("visibility");
            }}
          >
            {t.saveSection}
          </MenuItem>
          <MenuItem icon={IconDelete} danger onSelect={onDelete}>
            {t.deleteSection}
          </MenuItem>
        </>
      )}
    </Popover>
  );

  // --- the section's pages ---------------------------------------------------
  let columnIndex = 0;
  const rows = section.rows ?? [];

  const rowOf = (element: PageElement, status?: string, nextTab: InspectorTab = "content") => (
    <ElementRow key={element.id} element={element} named={named} status={status} locale={locale} onOpen={() => open(element.id, nextTab)} />
  );

  const sectionContent = (
    <Group title={t.elementsTitle} hint={elements.length > 0 ? t.elementsHint : undefined} nodeId={section.id} flash={parentFocus.flashId === section.id}>
      {elements.length === 0 ? (
        <p className="text-sm leading-6 text-ink-soft">{ui.noElements}</p>
      ) : !multiColumn ? (
        <ul className="-mx-2 space-y-0.5">{elements.map((el) => rowOf(el))}</ul>
      ) : (
        rows.map((row, r) => (
          <div key={row.id} className="space-y-2">
            {rows.length > 1 && <p className="text-xs font-medium text-ink-soft">{t.row(inspectorNumber(r + 1, locale))}</p>}
            {(row.columns ?? []).map((column) => {
              const index = columnIndex++;
              const inside = column.elements ?? [];
              return (
                <div
                  key={column.id}
                  data-node-id={column.id}
                  data-slot="inspector-column"
                  tabIndex={-1}
                  className={cn(
                    "scroll-mt-16 rounded-[1rem] p-1.5 ring-1 ring-line focus:outline-none",
                    parentFocus.flashId === column.id && "ring-2 ring-primary"
                  )}
                >
                  <p className="flex items-center gap-1.5 px-2 pt-1 pb-0.5 text-xs font-medium text-ink-soft">
                    <IconColumns className="size-3.5 shrink-0" aria-hidden />
                    <span className="min-w-0 truncate" dir="auto">
                      {columnTitle(column) ?? ui.column(index + 1)}
                    </span>
                  </p>
                  {inside.length === 0 ? <p className="px-2 py-2 text-xs text-ink-soft">{t.emptyColumn}</p> : <ul className="space-y-0.5">{inside.map((el) => rowOf(el))}</ul>}
                </div>
              );
            })}
          </div>
        ))
      )}
    </Group>
  );

  const columns: PageColumn[] = rows.flatMap((row) => row.columns ?? []);
  const sectionStyle = (
    <>
      <Group title={ui.sectionStyle} hint={ui.sectionStyleHint} icon={IconTheme} nodeId={section.id} flash={parentFocus.flashId === section.id}>
        {SECTION_SETTING_SPECS.map((spec) => (
          <SettingChoice
            key={spec.key}
            spec={spec}
            locale={locale}
            value={sectionSetting(section, spec.key)}
            onChange={(value) => onChange(setSectionSetting(section, spec.key, value))}
          />
        ))}
        <NumberField
          label={ui.minHeight}
          hint={ui.minHeightHint}
          strict
          integer
          min={0}
          max={MAX_SECTION_HEIGHT_PX}
          step={8}
          placeholder={ui.canvasAuto}
          value={sectionMinHeight(section) ?? ""}
          onChange={(px) => onChange(setSectionMinHeight(section, px !== "" && px > 0 ? px : null))}
        />
      </Group>
      {multiColumn &&
        rows.map((row, r) =>
          (row.columns ?? []).length > 1 ? (
            <Group key={row.id} title={t.rowSpace(inspectorNumber(r + 1, locale))}>
              {ROW_SETTING_SPECS.map((spec) => (
                <SettingChoice
                  key={spec.key}
                  spec={spec}
                  locale={locale}
                  value={rowSetting(row, spec.key)}
                  onChange={(value) => onChange(setRowSetting(section, row.id, spec.key, value))}
                />
              ))}
            </Group>
          ) : null
        )}
      {multiColumn &&
        columns.map((column, index) => (
          <Group
            key={column.id}
            title={columnTitle(column) ?? ui.column(index + 1)}
            hint={ui.columnHint}
            icon={IconColumns}
            collapsible
            // Two columns side by side are readable open; a row of six tiles is not.
            defaultOpen={columnCount <= 2}
            nodeId={column.id}
            flash={parentFocus.flashId === column.id}
          >
            {COLUMN_SETTING_SPECS.map((spec) => (
              <SettingChoice
                key={spec.key}
                spec={spec}
                locale={locale}
                value={columnSetting(column, spec.key)}
                onChange={(value) => onChange(setColumnSetting(section, column.id, spec.key, value))}
              />
            ))}
          </Group>
        ))}
    </>
  );

  const whoSees = (element: PageElement): string => {
    const parts: string[] = [];
    const hiddenOn = hiddenScreenNames(element, named, t);
    if (hiddenOn.length > 0) parts.push(t.hiddenOn(hiddenOn.join(t.joiner)));
    return parts.filter(Boolean).join(" · ") || t.showsToAll;
  };

  const sectionVisibility = (
    <>
      <Group title={t.whoSees} hint={t.whoSeesHint}>
        {elements.length === 0 ? (
          <p className="text-sm leading-6 text-ink-soft">{ui.noElements}</p>
        ) : (
          <ul className="-mx-2 space-y-0.5">{elements.map((el) => rowOf(el, whoSees(el), "visibility"))}</ul>
        )}
      </Group>
      <Group title={t.savedTitle} icon={IconBookmark} nodeId={`${section.id}:saved`} flash={parentFocus.flashId === `${section.id}:saved`}>
        {/* The panel brings its own frame for the old footer; inside a group it sits flush. */}
        <div className="-mx-4 [&>div]:border-t-0 [&>div]:pt-0 [&>div]:pb-0">
          <SaveSectionPanel section={section} onChange={onChange} funnelId={funnelId} />
        </div>
      </Group>
    </>
  );

  // --- the element's pages ---------------------------------------------------
  const elementPages = active && activeSpec && (
    <div key={active.id}>
      {tab === "content" && (
        <div className="space-y-4 px-4 py-4">
          {activeSpec.fields.length === 0 ? (
            <p className="text-sm leading-6 text-ink-soft">{t.noFields}</p>
          ) : (
            <ElementFields element={active} onPropChange={(key, value) => onChange(setElementProp(section, active, key, value))} />
          )}
        </div>
      )}
      {tab === "style" && (
        <ElementStylePanel
          element={active}
          tab="all"
          showHide={false}
          named={named}
          onSettingsChange={(settings) => changeSettings(active, settings)}
          onNamedChange={onNamedStylesChange}
        />
      )}
      {tab === "visibility" && (
        <>
          <Group title={t.showOnTitle} hint={t.showOnHint}>
            <HideOnDevices element={active} named={named} onSettingsChange={(settings) => changeSettings(active, settings)} />
          </Group>
          {canBind(active.type) && (
            <Group title={t.bindTitle} icon={IconData} mark={boundCount(active)}>
              <BindingFields element={active} onChange={(bindings) => onChange(setElementProp(section, active, "bindings", bindings))} />
            </Group>
          )}
        </>
      )}
    </div>
  );

  const HeaderIcon = activeSpec ? activeSpec.icon : sectionIcon(section);

  return (
    <InspectorEnvProvider value={env}>
      <div
        ref={rootRef}
        data-slot="inspector"
        data-compact={compact ? "" : undefined}
        data-sheet={sheet ? "" : undefined}
        className="zimos-inspector flex h-full min-h-0 min-w-0 flex-col text-ink"
      >
        <div data-slot="inspector-header" className="flex shrink-0 items-center gap-2.5 border-b border-line py-2 ps-4 pe-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[0.75rem] bg-primary-soft text-primary">
            <NodeGlyph icon={HeaderIcon} className="size-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            {active ? (
              <nav aria-label={t.path} className="flex min-w-0 items-center gap-1 text-xs text-ink-soft">
                <button
                  type="button"
                  onClick={stepUp}
                  aria-label={t.backToSection(sectionName)}
                  className="relative min-w-0 cursor-pointer truncate rounded-[0.375rem] font-medium text-primary before:absolute before:-inset-x-2 before:-inset-y-3.5 before:content-[''] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {sectionName}
                </button>
                <IconCaretRight className="size-3 shrink-0 rtl:-scale-x-100" aria-hidden />
                <span aria-current="true" className="shrink-0">
                  {activeName}
                </span>
              </nav>
            ) : null}
            <h2 className="truncate font-display text-sm leading-5 font-semibold text-ink">{active ? activeName : sectionName}</h2>
            {!active && <p className="truncate text-xs leading-4 text-ink-soft">{ui.elementCount(elements.length)}</p>}
          </div>
          {menu}
          <Button type="button" size="icon" variant="ghost" aria-label={ui.closePanel} title={ui.closePanel} onClick={onClose}>
            <IconClose className="size-4" aria-hidden />
          </Button>
        </div>

        <div ref={scrollRef} data-slot="inspector-body" className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
          <div data-slot="inspector-tabs" className="sticky top-0 z-10 border-b border-line bg-paper-raised px-4 py-2">
            <Segmented
              value={tab}
              onChange={setTab}
              label={t.tabsLabel}
              size="sm"
              className="w-full"
              options={TABS.map((value) => ({ value, label: t[value] }))}
            />
          </div>
          {active ? (
            elementPages
          ) : (
            <div key={section.id}>
              {tab === "content" && sectionContent}
              {tab === "style" && sectionStyle}
              {tab === "visibility" && sectionVisibility}
            </div>
          )}
        </div>
      </div>
    </InspectorEnvProvider>
  );
}

