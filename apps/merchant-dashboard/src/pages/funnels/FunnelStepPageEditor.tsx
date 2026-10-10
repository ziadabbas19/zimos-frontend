import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@store-builder/ui";
import type { PageSection, PageTree } from "@store-builder/api-client";
import {
  IconEdit,
  IconInspect,
  IconLayout,
  IconMagic,
  IconMoon,
  IconPacked,
  IconPlus,
  IconRefresh,
  IconSliders,
  IconSun,
} from "@/components/icons";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { MediaPicker } from "@/components/MediaPicker";
import { Sheet } from "@/components/Sheet";
import { StorefrontPreview } from "@/components/StorefrontPreview";
import { useToast } from "@/components/Toast";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { BlockLibrarySheet } from "../website/editor/BlockLibrary";
import { PageProductField } from "../website/editor/DataBinding";
import { namedStylesOf } from "../website/editor/ElementStylePanel";
import { LayerList } from "../website/editor/LayerList";
import { PageSettingsDialog } from "../website/editor/PageSettingsDialog";
import { SectionInspector, type InspectorTab } from "../website/editor/SectionInspector";
import { sectionElements, sectionLabel, type BlockPreset } from "../website/editor/blocks";
import { inlineTextIds, sectionHidden } from "../website/editor/canvasTools";
import { EditorLocaleContext, editorUi, useEditorLocale } from "../website/editor/editorLocale";
import type { ColorMode } from "../website/editor/storeThemes";
import { EditorStage } from "../website/editor/shell/EditorStage";
import type { EditorMenuItem } from "../website/editor/shell/EditorToolbar";
import { EndPanel } from "../website/editor/shell/EndPanel";
import { PhoneInspectorSheet } from "../website/editor/shell/PhoneBars";
import { SHELL_STRINGS } from "../website/editor/shell/shellStrings";
import type { EditorDocument } from "../website/editor/shell/useEditorDocument";
import { useEditorShortcuts } from "../website/editor/shell/useEditorGuards";
import {
  EDITOR_DEVICES,
  useStoredChoice,
  useStoredFlag,
  type EditorDevice,
  type PreviewControls,
} from "../website/editor/shell/useEditorLayout";
import { useSectionEdits } from "../website/editor/shell/useSectionEdits";
import { PAGE_STRINGS } from "./FunnelEditorPage.strings";
import type { UiStep } from "./funnelAdapter";
import { stepPageTree } from "./funnelPages";
import { StepDetailsForm } from "./StepDetailsForm";
import { StepBar } from "./stepPage/StepBar";
import { StepDock } from "./stepPage/StepDock";
import { STEP_PAGE_STRINGS } from "./stepPage/strings";
import { ROOMY_BOX, WIDE_BOX, useBoxWidth } from "./stepPage/useBoxWidth";
import { useStepHistory } from "./useStepHistory";

/**
 * The page of one funnel step — the store editor (website/editor), with a
 * different page under it. One page editor in the product, not two:
 *
 *  - start: the page's sections (the store editor's LayerList), with «ضيف قسم»;
 *  - centre: the real storefront, live (StorefrontPreview as the editor's
 *    canvas, on the store editor's stage): a click selects — a section first,
 *    then an element inside it — a double-click types in place, a picture
 *    opens the media library, and the selected section carries its own bar
 *    (up, down, duplicate, hide, delete);
 *  - end: the store editor's inspector (SectionInspector) for what is selected.
 *
 * The library is the store editor's sheet (BlockLibrarySheet — every block a
 * website page may hold, plus the saved sections, this funnel's own included).
 * The edits are the store editor's (`useSectionEdits`), the keys too
 * (`useEditorShortcuts`), and undo / redo is `useStepHistory`.
 *
 * What differs is where the page lives and what is around it:
 *
 *  - the tree is `step.tree` in the funnel draft. Every edit goes out through
 *    `onTreeChange`; the funnel's Save and its draft autosave pick it up, and
 *    «اتغيّر» in the funnel's bar is the funnel's own. Nothing is saved here;
 *  - there is no top bar of its own (the funnel's bar is above): only the slim
 *    step bar (StepBar) — back to the map, which step, previous / next, the
 *    device, undo / redo and «…»;
 *  - a funnel step has no store look to edit, so with nothing selected the
 *    end panel is a one-line way in, and the phone's third dock button is the
 *    page's settings.
 *
 * It fills the box it is given and lays itself out by that box's width, not
 * the screen's: three zones from 1024px; under that the stage fills the box,
 * with a bottom bar and sheets (the section list, the library) and the
 * inspector as the store editor's bottom pane.
 */

export interface FunnelStepPageEditorProps {
  workspaceId: string;
  /** The funnel's pages in list order: what previous / next and the step picker walk. */
  steps: UiStep[];
  step: UiStep;
  /** The product behind the step's offer, when it has one. */
  offerProduct: { id: string; name: string } | null;
  onSelectStep: (key: string) => void;
  onTreeChange: (tree: PageTree) => void;
  /** The step's SEO from its page settings, into the funnel draft. Without it (a split-test variant) there are no page settings. */
  onSeoChange?: (seo: Record<string, unknown>) => void;
  /** «الخريطة»: back to the flow map. */
  onBack: () => void;
  /** The funnel: its own saved sections in the library, and saving one for it only. */
  funnelId?: string;
  /** Page settings → Details (StepDetailsForm): the title, and a generic page's address. */
  details?: {
    generic: boolean;
    taken: string[];
    pathOf: (key: string) => string;
    onApply: (changes: { name: string; key: string }) => void;
  };
  /** Ctrl/⌘+S while the page is open. Left out, the key does nothing (and the browser's own "save page" stays away). */
  onSaveNow?: () => void;
}

type ImageRequest =
  | { kind: "field"; sectionId: string; elementId: string; field: string }
  | { kind: "apply"; apply: (url: string) => void };

/** Sets `productId` on every product card that doesn't name a product yet. */
function fillProductCards(tree: PageTree, productId: string): PageTree {
  return {
    ...tree,
    sections: tree.sections.map((s) => ({
      ...s,
      rows: (s.rows ?? []).map((r) => ({
        ...r,
        columns: (r.columns ?? []).map((c) => ({
          ...c,
          elements: (c.elements ?? []).map((el) =>
            el.type === "product_card" && !(typeof el.props?.productId === "string" && el.props.productId.trim())
              ? { ...el, props: { ...el.props, productId } }
              : el
          ),
        })),
      })),
    })),
  };
}

function hasUnsetProductCard(tree: PageTree): boolean {
  return tree.sections.some((s) =>
    (s.rows ?? []).some((r) =>
      (r.columns ?? []).some((c) =>
        (c.elements ?? []).some((el) => el.type === "product_card" && !(typeof el.props?.productId === "string" && el.props.productId.trim()))
      )
    )
  );
}

export function FunnelStepPageEditor(props: FunnelStepPageEditorProps) {
  // The shared editor pieces (inspector, library, section list) speak the dashboard's language here too.
  const { locale } = useLocale();
  return (
    <EditorLocaleContext.Provider value={locale}>
      <StepPageEditor {...props} />
    </EditorLocaleContext.Provider>
  );
}

function StepPageEditor({
  workspaceId,
  steps,
  step,
  offerProduct,
  onSelectStep,
  onTreeChange,
  onSeoChange,
  onBack,
  funnelId,
  details,
  onSaveNow,
}: FunnelStepPageEditorProps) {
  const t = useT(STEP_PAGE_STRINGS);
  const shell = useT(SHELL_STRINGS);
  const page = useT(PAGE_STRINGS);
  const locale = useEditorLocale();
  const ui = editorUi(locale);
  const toast = useToast();

  const history = useStepHistory(step.key, step.tree, onTreeChange);
  const { update } = history;
  const tree = step.tree;
  const sections = tree.sections;

  // --- layout: by the box this editor was given ------------------------------
  const [boxRef, boxWidth] = useBoxWidth();
  // Until it is measured (one frame), the window's width is the best guess.
  const width = boxWidth ?? (typeof window === "undefined" ? WIDE_BOX : window.innerWidth);
  /** Three zones side by side. Under it: the stage, a bottom bar and sheets. */
  const wide = width >= WIDE_BOX;
  /** Room for the device switch; under it the box IS the phone. */
  const roomy = width >= ROOMY_BOX;
  // Remembered in this browser, apart from the store editor's own choices.
  const [device, setDevice] = useStoredChoice<EditorDevice>("zimos:funnel-page-editor:device", "phone", EDITOR_DEVICES);
  const [startShown, setStartShown] = useStoredFlag("zimos:funnel-page-editor:start-panel", true);
  const [endShown, setEndShown] = useStoredFlag("zimos:funnel-page-editor:end-panel", true);
  const shownDevice: EditorDevice = roomy ? device : "phone";

  // --- selection: a section, and one element inside it ------------------------
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("content");
  /** Where "add a section here" pointed; the next block from the library lands there. */
  const [insertIndex, setInsertIndex] = useState<number | null>(null);
  const [scrollRequest, setScrollRequest] = useState<{ sectionId: string; nonce: number } | null>(null);

  // --- the preview's own switches (driven from «…») ---------------------------
  const [previewMode, setPreviewMode] = useState<ColorMode | null>(null);
  const [xray, setXray] = useState(false);
  const controlsRef = useRef<PreviewControls | null>(null);

  // --- sheets and dialogs -------------------------------------------------------
  const [libraryOpen, setLibraryOpen] = useState(false);
  /** In a narrow box the section list and the inspector are sheets. */
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** Asked from the keyboard (Delete / Backspace): a stray key should not cost a section. */
  const [pendingDelete, setPendingDelete] = useState<PageSection | null>(null);
  const [imageOpen, setImageOpen] = useState(false);
  const imageRequest = useRef<ImageRequest | null>(null);

  // A different step is a different page: nothing of the last one stays selected or open.
  const [seededKey, setSeededKey] = useState(step.key);
  if (seededKey !== step.key) {
    setSeededKey(step.key);
    setSelectedSectionId(null);
    setSelectedElementId(null);
    setInsertIndex(null);
    setInspectorOpen(false);
    setSectionsOpen(false);
    setLibraryOpen(false);
    setSettingsOpen(false);
    setPendingDelete(null);
  }

  // --- what is selected, as things are now ------------------------------------
  const selected = sections.find((s) => s.id === selectedSectionId) ?? null;
  const elementId =
    selected && selectedElementId && sectionElements(selected).some((el) => el.id === selectedElementId) ? selectedElementId : null;
  const labels = useMemo(() => Object.fromEntries(sections.map((s) => [s.id, sectionLabel(s, locale)])), [sections, locale]);
  const inlineText = useMemo(() => inlineTextIds(sections), [sections]);
  const hasSettings = onSeoChange !== undefined;

  function revealInspector() {
    if (wide) setEndShown(true);
    else setInspectorOpen(true);
  }

  /** Selecting from the editor side also brings the section into view in the preview. */
  function selectSection(sectionId: string, { scroll, reveal = true }: { scroll: boolean; reveal?: boolean }) {
    setSelectedSectionId(sectionId);
    setSelectedElementId(null);
    setSectionsOpen(false);
    if (reveal) revealInspector();
    if (scroll) setScrollRequest((prev) => ({ sectionId, nonce: (prev?.nonce ?? 0) + 1 }));
  }

  /** A click on an element of the selected section — in the preview, or in the section list. */
  function selectElement(target: { sectionId: string; elementId: string }) {
    setSelectedSectionId(target.sectionId);
    setSelectedElementId(target.elementId);
    setSectionsOpen(false);
    revealInspector();
  }

  function clearSelection() {
    setSelectedSectionId(null);
    setSelectedElementId(null);
    setInspectorOpen(false);
  }

  /** Escape: the element, then its section, then nothing. True when there was something to let go of. */
  function stepSelectionUp(): boolean {
    if (elementId) {
      setSelectedElementId(null);
      return true;
    }
    if (selected) {
      clearSelection();
      return true;
    }
    return false;
  }

  // --- edits: the store editor's, written into the funnel draft ----------------

  /** One tree edit on the page as it is now; an edit that changes nothing records no undo step. */
  const setSections = useCallback(
    (edit: (prev: PageSection[]) => PageSection[], key?: string) => {
      update((current) => {
        const next = edit(current.sections);
        return next === current.sections ? current : { ...current, sections: next };
      }, key);
    },
    [update]
  );

  // useSectionEdits reads two things of the store editor's document: the open
  // page's sections and how to change them. Here they are the step's. (Its
  // parameter is typed as the whole document; narrowing it to these two is the
  // store editor's to do — until then this cast says what is really passed.)
  const doc = useMemo(() => ({ sections, setSections }) as unknown as EditorDocument, [sections, setSections]);

  const edits = useSectionEdits({
    doc,
    selectedSectionId,
    // A section an edit made or landed in. In a narrow box it is shown first;
    // its inspector stays one tap away on the bottom bar instead of covering it.
    onSelect: (sectionId, how) => selectSection(sectionId, { scroll: how.scroll, reveal: wide }),
    onDeselect: clearSelection,
  });

  /** "+" between two sections — in the preview or in the list: the library opens, and its pick lands there. */
  function requestInsert(index: number | null) {
    setInsertIndex(index);
    setSectionsOpen(false);
    setLibraryOpen(true);
  }

  function addBlock(preset: BlockPreset) {
    edits.addPreset(preset, insertIndex ?? sections.length);
    setInsertIndex(null);
    setLibraryOpen(false);
  }

  function insertSaved(section: PageSection) {
    edits.addSection(section, insertIndex);
    setInsertIndex(null);
    setLibraryOpen(false);
  }

  /** «ابدأ بصفحة جاهزة»: the page a new step of this type starts with. One undo step. */
  function startReady() {
    const ready = stepPageTree(step.type, locale);
    update((current) => ({ ...current, sections: ready.sections }));
    toast.success(t.readyApplied);
  }

  // --- the page's product (what bindings read when an element names none) -------
  const pageProductId =
    typeof (tree as { productId?: unknown }).productId === "string" ? ((tree as { productId?: string }).productId ?? "") : "";

  function setPageProduct(productId: string) {
    update((current) => {
      const { productId: _old, ...rest } = current as PageTree & { productId?: string };
      void _old;
      return (productId ? { ...rest, productId } : rest) as PageTree;
    });
  }

  const productField = <PageProductField value={pageProductId} onChange={setPageProduct} />;

  // --- pictures: one media picker for the canvas and the inspector ---------------
  function requestImage(request: ImageRequest) {
    imageRequest.current = request;
    setImageOpen(true);
  }

  function imagePicked(file: { url: string; id?: string }) {
    const request = imageRequest.current;
    imageRequest.current = null;
    setImageOpen(false);
    if (!request) return;
    if (request.kind === "apply") request.apply(file.url);
    else edits.setImage(request, file.url);
  }

  // --- the keys: the store editor's ---------------------------------------------
  useEditorShortcuts({
    // Saving is the funnel's (its bar is above this editor).
    save: () => onSaveNow?.(),
    undo: history.undo,
    redo: history.redo,
    escape: stepSelectionUp,
    // Delete / Backspace on a selected section asks first: a stray key should not cost a section.
    remove: () => {
      if (!selected || elementId) return false;
      setPendingDelete(selected);
      return true;
    },
  });

  // --- «…» ------------------------------------------------------------------------
  const dark = previewMode === "dark";
  function togglePreviewMode() {
    const next: ColorMode = dark ? "light" : "dark";
    setPreviewMode(next);
    controlsRef.current?.setColorMode(next);
  }
  function toggleXray() {
    const next = !xray;
    setXray(next);
    controlsRef.current?.setXray(next);
  }

  const menu: EditorMenuItem[][] = [
    hasSettings ? [{ id: "settings", label: t.menuPageSettings, icon: IconSliders, onSelect: () => setSettingsOpen(true) }] : [],
    [
      { id: "mode", label: dark ? shell.menuLight : shell.menuDark, icon: dark ? IconSun : IconMoon, onSelect: togglePreviewMode },
      { id: "xray", label: xray ? shell.menuXrayOff : shell.menuXrayOn, icon: IconInspect, onSelect: toggleXray },
      { id: "refresh", label: shell.menuRefresh, icon: IconRefresh, onSelect: () => controlsRef.current?.refresh() },
    ],
  ];

  // --- what the zones show --------------------------------------------------------

  const layerList = (variant: "panel" | "sheet") => (
    <LayerList
      variant={variant}
      sections={sections}
      selectedId={selectedSectionId}
      insertIndex={insertIndex}
      onSelect={(id) => selectSection(id, { scroll: true })}
      onDelete={edits.remove}
      onMove={edits.move}
      onInsertAt={requestInsert}
      onDuplicate={(section) => edits.duplicate(section.id)}
      onToggleHidden={(section) => edits.toggleHidden(section.id)}
      isHidden={sectionHidden}
      funnelId={funnelId}
      onSelectElement={(sectionId, id) => selectElement({ sectionId, elementId: id })}
      selectedElementId={elementId}
    />
  );

  // The inspector of whatever is selected; null when nothing is.
  const inspector = selected ? (
    <SectionInspector
      section={selected}
      onChange={edits.update}
      funnelId={funnelId}
      namedStyles={namedStylesOf(tree.globalStyles)}
      onNamedStylesChange={(named) =>
        // Saved with the page tree; the element that triggered it changes too.
        update((current) => ({ ...current, globalStyles: { ...(current.globalStyles ?? {}), named } }))
      }
      onDelete={() => edits.remove(selected)}
      onDuplicate={() => edits.duplicate(selected.id)}
      onClose={clearSelection}
      focusElementId={elementId}
      tab={inspectorTab}
      onTabChange={setInspectorTab}
      onRequestImage={(apply) => requestImage({ kind: "apply", apply })}
      onFocusElementChange={setSelectedElementId}
      variant={wide ? "panel" : "sheet"}
    />
  ) : null;
  const selectionLabel = selected ? labels[selected.id] : "";

  // The step's offer names a product the page's product blocks do not show yet.
  const productBar =
    offerProduct && hasUnsetProductCard(tree) ? (
      <div
        data-slot="editor-lookbar"
        role="region"
        aria-label={t.productBar}
        className="relative z-[1] flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line bg-accent-soft px-3 py-2"
      >
        <p className="min-w-0 flex-1 basis-48 text-sm font-medium text-ink" dir="auto">
          {fmt(t.productHint, { product: offerProduct.name })}
        </p>
        <Button
          type="button"
          variant="secondary"
          className="min-h-10 max-w-full shrink-0 rounded-full px-4 pointer-coarse:min-h-11"
          onClick={() => update((current) => fillProductCards(current, offerProduct.id))}
        >
          <IconPacked className="size-4 shrink-0" aria-hidden />
          <span className="truncate" dir="auto">
            {fmt(t.productUse, { product: offerProduct.name })}
          </span>
        </Button>
      </div>
    ) : null;

  return (
    // `size-full`, not `h-full`: index.css has an old rule keyed on
    // `.flex.h-full.flex-col > .border-b.bg-paper-raised:first-child` that would catch the step bar.
    <div ref={boxRef} data-slot="funnel-step-page" className="flex size-full min-h-0 min-w-0 flex-1 flex-col">
      {/* The zone’s name for a screen reader: the bar shows the step’s name as a button, not a heading. */}
      <h2 className="sr-only" dir="auto">
        {fmt(page.pageOf, { name: step.name })}
      </h2>
      <StepBar
        steps={steps}
        step={step}
        onSelectStep={onSelectStep}
        onBack={onBack}
        roomy={roomy}
        device={device}
        onDeviceChange={setDevice}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={history.undo}
        onRedo={history.redo}
        menu={menu}
        panels={
          wide
            ? {
                start: startShown,
                onStart: () => setStartShown(!startShown),
                end: endShown,
                onEnd: () => setEndShown(!endShown),
              }
            : null
        }
      />

      <div className="flex min-h-0 flex-1">
        {wide && startShown && (
          <aside
            data-slot="editor-panel"
            data-side="start"
            aria-label={shell.sectionsSheet}
            className="flex w-72 shrink-0 flex-col border-e border-line bg-paper-raised"
          >
            <h2 className="shrink-0 px-4 pt-3 pb-1 font-display text-sm font-semibold text-ink">{shell.sectionsSheet}</h2>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              {layerList("panel")}
              {/* Without page settings (a split-test version) the page's product has no other home. */}
              {!hasSettings && productField}
            </div>
            <div className="flex shrink-0 items-center gap-2 border-t border-line p-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => requestInsert(null)}
                className="zimos-editor-soft h-11 min-w-0 flex-1 rounded-full"
              >
                <IconPlus className="size-4" aria-hidden />
                <span className="truncate">{shell.addSection}</span>
              </Button>
            </div>
          </aside>
        )}

        <EditorStage device={shownDevice} onClear={clearSelection} bar={productBar}>
          {sections.length === 0 ? (
            // An empty page has nothing to tap: the two ways to start, instead of a blank store.
            <div className="flex h-full items-center justify-center overflow-y-auto p-4">
              <EmptyState
                className="w-full max-w-md border-solid"
                icon={<IconLayout aria-hidden />}
                title={t.emptyTitle}
                description={t.emptyBody}
                action={
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button type="button" className="h-11 rounded-full px-5" onClick={startReady}>
                      <IconMagic className="size-4" aria-hidden />
                      {t.startReady}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="zimos-editor-soft h-11 rounded-full px-5"
                      onClick={() => requestInsert(null)}
                    >
                      <IconPlus className="size-4" aria-hidden />
                      {shell.addSection}
                    </Button>
                  </div>
                }
              />
            </div>
          ) : (
            // The store editor's canvas. No `theme` and no header / footer overlay:
            // a funnel step is drawn in the store's saved look, which is not edited here.
            <StorefrontPreview
              className="bg-transparent"
              workspaceId={workspaceId}
              tree={tree}
              labels={{
                title: ui.previewTitle,
                hint: page.previewHint,
                refresh: ui.previewRefresh,
                desktop: ui.previewDesktop,
                tablet: ui.previewTablet,
                mobile: ui.previewMobile,
                close: ui.previewClose,
                frameTitle: page.frameTitle,
                lightMode: ui.previewLightMode,
                darkMode: ui.previewDarkMode,
                xray: ui.previewXray,
              }}
              colorMode={previewMode}
              onColorModeChange={setPreviewMode}
              chrome="none"
              controlsRef={controlsRef}
              device={shownDevice}
              onDeviceChange={setDevice}
              fit
              selectedElementId={elementId}
              onSelectElement={selectElement}
              onSectionAction={edits.act}
              onPickImage={(target) =>
                requestImage({ kind: "field", sectionId: target.sectionId, elementId: target.elementId, field: target.field })
              }
              canvas={{
                selectedId: selectedSectionId,
                labels,
                strings: {
                  addAbove: ui.addAbove,
                  addBelow: ui.addBelow,
                  moveUp: ui.moveSectionUp,
                  moveDown: ui.moveSectionDown,
                  dragSection: ui.canvasDragSection,
                  dragElement: ui.canvasDragElement,
                  resizeHeight: ui.canvasResizeHeight,
                  resizeColumns: ui.canvasResizeColumns,
                  resizeImage: ui.canvasResizeImage,
                  auto: ui.canvasAuto,
                  editText: ui.canvasEditText,
                },
                scrollRequest,
                // In a narrow box a tap selects and the bottom bar offers «عدّل»; the store stays in view.
                onSelect: (id) => selectSection(id, { scroll: false, reveal: wide }),
                onCanvasEdit: (edit) => edits.applyCanvas(edit),
                onCanvasStep: edits.stepCanvas,
                inlineText,
                onTextEdit: edits.editText,
                onInsert: requestInsert,
                onMoveSection: edits.moveBy,
              }}
            />
          )}
        </EditorStage>

        {wide && endShown && (
          <EndPanel>
            {inspector ?? (
              <div className="flex shrink-0 items-start gap-2.5 border-b border-line px-4 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-dark dark:text-primary">
                  <IconEdit className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2 className="font-display text-sm font-semibold text-ink">{t.idleTitle}</h2>
                  <p className="text-xs leading-5 text-ink-soft">{t.idleHint}</p>
                </div>
              </div>
            )}
          </EndPanel>
        )}
      </div>

      {!wide && (
        <StepDock
          onSections={() => setSectionsOpen(true)}
          onAdd={() => requestInsert(null)}
          onSettings={hasSettings ? () => setSettingsOpen(true) : undefined}
          edit={inspector && !inspectorOpen ? { label: selectionLabel, onOpen: () => setInspectorOpen(true) } : null}
        />
      )}

      {/* In a narrow box the side panels are sheets. */}
      {!wide && (
        <>
          <Sheet open={sectionsOpen} onOpenChange={setSectionsOpen} title={shell.sectionsSheet} size="md">
            {layerList("sheet")}
            {!hasSettings && productField}
          </Sheet>
          {/* Not a dialog: the page above it stays alive (see PhoneInspectorSheet). */}
          {inspectorOpen && inspector && (
            <PhoneInspectorSheet title={selectionLabel || shell.editSheet} onHide={() => setInspectorOpen(false)}>
              {inspector}
            </PhoneInspectorSheet>
          )}
        </>
      )}

      {/* The library: where every new section comes from, at the place that was pointed at. */}
      <BlockLibrarySheet
        open={libraryOpen}
        onOpenChange={(open) => {
          setLibraryOpen(open);
          if (!open) setInsertIndex(null);
        }}
        onPick={addBlock}
        // Saved sections live in the library too — the store's, and this funnel's own.
        onInsertSaved={insertSaved}
        funnelId={funnelId}
        insertIndex={insertIndex}
      />

      <MediaPicker
        open={imageOpen}
        onOpenChange={(open) => {
          if (!open) setImageOpen(false);
        }}
        onPick={imagePicked}
        accept="image"
        title={shell.pickImage}
      />

      {/* Page settings: the step's name and address (Details), its SEO into the funnel draft, its scripts. */}
      {settingsOpen && onSeoChange && (
        <PageSettingsDialog
          key={step.key}
          name={step.name}
          seo={step.seo}
          scripts={{ kind: "step", id: step.id }}
          onSaveSeo={onSeoChange}
          details={
            <div className="space-y-4">
              {details && (
                <StepDetailsForm
                  name={step.name}
                  stepKey={step.key}
                  type={step.type}
                  generic={details.generic}
                  taken={details.taken.filter((k) => k !== step.key)}
                  pathOf={details.pathOf}
                  onApply={details.onApply}
                />
              )}
              {productField}
            </div>
          }
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* Only the keyboard asks: a button deletes at once and offers Undo. */}
      <ConfirmDialog
        open={pendingDelete !== null}
        title={ui.deleteSectionTitle}
        description={pendingDelete ? ui.deleteSectionBody(sectionLabel(pendingDelete, locale)) : undefined}
        confirmLabel={ui.deleteSection}
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) edits.remove(pendingDelete);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
