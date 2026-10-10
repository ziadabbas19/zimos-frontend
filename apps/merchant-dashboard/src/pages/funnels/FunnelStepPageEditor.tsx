import { useCallback, useMemo, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Eye, PackageCheck, Redo2, Undo2 } from "lucide-react";
import { Button } from "@store-builder/ui";
import type { PageSection, PageTree } from "@store-builder/api-client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MediaPicker } from "@/components/MediaPicker";
import { Select } from "@/components/Select";
import { StorefrontPreview } from "@/components/StorefrontPreview";
import { CollapsiblePane } from "@/components/CollapsiblePane";
import { useSessionBool } from "@/lib/useSessionState";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { BlockLibrary } from "../website/editor/BlockLibrary";
import { SectionCard } from "../website/editor/SectionCard";
import { SectionInspector } from "../website/editor/SectionInspector";
import { createSection, insertSection, moveSection, sectionLabel, type BlockPreset } from "../website/editor/blocks";
import { EditorLocaleContext, editorUi } from "../website/editor/editorLocale";
import { LayerList } from "../website/editor/LayerList";
import { ResizableSplit } from "../website/editor/ResizableSplit";
import { SavedSectionsLibrary } from "../website/editor/SavedSections";
import { PageProductField } from "../website/editor/DataBinding";
import { namedStylesOf } from "../website/editor/ElementStylePanel";
import { useStepHistory } from "./useStepHistory";
import { duplicateSection, inlineTextIds, setElementText } from "../website/editor/canvasTools";
import { applyCanvasEdit, nudgeElement } from "../website/editor/canvasEdits";
import { stepEdit } from "@/lib/canvasDrag";
import { PageSettingsButton } from "../website/editor/PageSettingsDialog";
import { InspectorEnvProvider, type InspectorEnv } from "../website/editor/inspector/env";
import { PAGE_STRINGS, STEP_TYPE_LABELS } from "./FunnelEditorPage.strings";
import type { UiStep } from "./funnelAdapter";

/**
 * The page view of one funnel step: the website editor's block library,
 * section cards and inspector (imported, not copied — a section edits the same
 * here as on a website page), plus the storefront's own rendering of the step.
 *
 * Edits go into `step.tree` in the funnel draft, so they are saved by the
 * editor's one Save button along with the flow, and count towards "unsaved
 * changes" like any other edit. The shared editor pieces speak the merchant's
 * language through EditorLocaleContext.
 *
 * The website editor's tools work here too (item 94): undo / redo
 * (useStepHistory), the layer list with its "add a section here" slots, the
 * page's product, named styles and the saved sections library. Its preview
 * is the website editor's canvas too (item 95): sections are picked, added,
 * dragged and resized on the page, text is edited with a double-click, and
 * X-ray outlines every box.
 */

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

export function FunnelStepPageEditor({
  workspaceId,
  steps,
  step,
  offerProduct,
  onSelectStep,
  onTreeChange,
  onSeoChange,
  onBack,
  funnelId,
}: {
  workspaceId: string;
  steps: UiStep[];
  step: UiStep;
  /** The product behind the step's offer, when it has one. */
  offerProduct: { id: string; name: string } | null;
  onSelectStep: (key: string) => void;
  onTreeChange: (tree: PageTree) => void;
  /** The step's SEO from its page settings, into the funnel draft. Without it (a split-test variant) there are no page settings. */
  onSeoChange?: (seo: Record<string, unknown>) => void;
  onBack: () => void;
  /** The funnel: its own saved sections in the library, and saving one for it only. */
  funnelId?: string;
}) {
  const t = useT(PAGE_STRINGS);
  const { locale } = useLocale();
  const ui = editorUi(locale);
  const history = useStepHistory(step.key, step.tree, onTreeChange);
  const [insertIndex, setInsertIndex] = useState<number | null>(null);
  const [layersOpen, setLayersOpen] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PageSection | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [libraryCollapsed, setLibraryCollapsed] = useSessionBool("zimos:funnel-page-editor:library-collapsed", false);
  const [inspectorCollapsed, setInspectorCollapsed] = useSessionBool("zimos:funnel-page-editor:inspector-collapsed", false);

  // A different step is a different page: drop the section selection with it.
  const [seededKey, setSeededKey] = useState(step.key);
  if (seededKey !== step.key) {
    setSeededKey(step.key);
    setSelectedId(null);
    setInsertIndex(null);
  }

  const sections = step.tree.sections;
  const selected = sections.find((s) => s.id === selectedId) ?? null;

  const { change } = history;
  const setSections = useCallback(
    (next: PageSection[], key?: string) => {
      // An edit that changes nothing (a drop in place) records no undo step.
      if (next !== step.tree.sections) change({ ...step.tree, sections: next }, key);
    },
    [change, step.tree]
  );
  const pageProductId = typeof (step.tree as { productId?: unknown }).productId === "string" ? ((step.tree as { productId?: string }).productId ?? "") : "";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = sections.findIndex((s) => s.id === active.id);
    const to = sections.findIndex((s) => s.id === over.id);
    setSections(moveSection(sections, from, to));
  }

  function selectSection(id: string | null) {
    setSelectedId(id);
    setInspectorCollapsed(false);
  }

  function addBlock(preset: BlockPreset) {
    insert(createSection(preset, locale));
  }

  /** Into the slot picked in the layer list, else at the end. */
  function insert(section: PageSection) {
    setSections(insertSection(sections, section, insertIndex ?? sections.length));
    setInsertIndex(null);
    selectSection(section.id);
  }

  function setPageProduct(productId: string) {
    const { productId: _old, ...rest } = step.tree as PageTree & { productId?: string };
    void _old;
    change((productId ? { ...rest, productId } : rest) as PageTree);
  }

  function updateSection(next: PageSection) {
    // One undo step per burst of typing in a section, as in the website editor.
    setSections(sections.map((s) => (s.id === next.id ? next : s)), `section:${next.id}`);
  }

  function deleteSection(section: PageSection) {
    setSections(sections.filter((s) => s.id !== section.id));
    setSelectedId((prev) => (prev === section.id ? null : prev));
    setPendingDelete(null);
  }

  // One media library sheet for every picture field of the inspector.
  const [imageOpen, setImageOpen] = useState(false);
  const imageRequest = useRef<((url: string) => void) | null>(null);
  const inspectorEnv = useMemo<InspectorEnv>(
    () => ({
      compact: false,
      pairImages: false,
      requestImage: (apply) => {
        imageRequest.current = apply;
        setImageOpen(true);
      },
    }),
    []
  );

  const inspector = selected && (
    // The section's picture fields offer "choose from the library" through this.
    <InspectorEnvProvider value={inspectorEnv}>
      <SectionInspector
        section={selected}
        onChange={updateSection}
        funnelId={funnelId}
        namedStyles={namedStylesOf(step.tree.globalStyles)}
        onNamedStylesChange={(named) => change({ ...step.tree, globalStyles: { ...(step.tree.globalStyles ?? {}), named } })}
        onDelete={() => setPendingDelete(selected)}
        onDuplicate={() => {
          const copy = duplicateSection(selected);
          setSections(insertSection(sections, copy, sections.findIndex((s) => s.id === selected.id) + 1));
          selectSection(copy.id);
        }}
        onClose={() => setSelectedId(null)}
      />
    </InspectorEnvProvider>
  );

  return (
    <EditorLocaleContext.Provider value={locale}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <CollapsiblePane
          side="start"
          collapsed={libraryCollapsed}
          onCollapsedChange={setLibraryCollapsed}
          visibleClassName="lg:flex lg:w-56"
          railClassName="lg:flex"
          collapseLabel={t.collapsePanel}
          expandLabel={t.expandPanel}
        >
          {/* The outline and the libraries share the pane on an adjustable split, as in the website editor. */}
          <ResizableSplit
            storageKey="zimos:funnel-page-editor:layer-split"
            label={ui.resizeSplit}
            hint={ui.resizeSplitHint}
            topCollapsed={!layersOpen}
            top={
              <LayerList
                sections={sections}
                selectedId={selectedId}
                insertIndex={insertIndex}
                onSelect={(id) => selectSection(id)}
                onDelete={setPendingDelete}
                onMove={(from, to) => setSections(moveSection(sections, from, to))}
                onInsertAt={setInsertIndex}
                open={layersOpen}
                onOpenChange={setLayersOpen}
              />
            }
            bottom={
              <>
                <PageProductField value={pageProductId} onChange={setPageProduct} />
                <SavedSectionsLibrary onInsert={insert} funnelId={funnelId} />
                <BlockLibrary onAdd={addBlock} insertPosition={insertIndex === null ? null : insertIndex + 1} onCancelInsert={() => setInsertIndex(null)} />
              </>
            }
          />
        </CollapsiblePane>

        <main className="min-w-0 flex-1 bg-paper p-4 md:p-6 lg:overflow-y-auto">
          <div className="mx-auto max-w-2xl">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <label htmlFor="page-step" className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  {t.step}
                </label>
                <Select id="page-step" value={step.key} onChange={(e) => onSelectStep(e.target.value)} className="h-9 max-w-sm" dir="auto">
                  {steps.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.name} · {STEP_TYPE_LABELS[locale][s.type]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="ghost" aria-label={ui.undo} title={`${ui.undo} (Ctrl+Z)`} disabled={!history.canUndo} onClick={history.undo}>
                  <Undo2 className="size-4 rtl:-scale-x-100" aria-hidden />
                </Button>
                <Button size="icon" variant="ghost" aria-label={ui.redo} title={`${ui.redo} (Ctrl+Shift+Z)`} disabled={!history.canRedo} onClick={history.redo}>
                  <Redo2 className="size-4 rtl:-scale-x-100" aria-hidden />
                </Button>
                <Button variant="outline" onClick={onBack}>
                  <span aria-hidden className="inline-block rtl:rotate-180">
                    ←
                  </span>
                  {t.backToFlow}
                </Button>
                {onSeoChange && (
                  <PageSettingsButton key={step.key} name={step.name} seo={step.seo} scripts={{ kind: "step", id: step.id }} onSaveSeo={onSeoChange} />
                )}
                <Button variant={previewOpen ? "secondary" : "outline"} aria-pressed={previewOpen} onClick={() => setPreviewOpen((o) => !o)}>
                  <Eye className="size-4" aria-hidden /> {t.preview}
                </Button>
              </div>
            </div>

            <h2 className="font-display text-lg font-semibold text-ink" dir="auto">
              {fmt(t.pageOf, { name: step.name })}
            </h2>
            <p className="mb-4 text-sm text-ink-soft">{t.pageHint}</p>

            {offerProduct && hasUnsetProductCard(step.tree) && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary-soft px-4 py-3">
                <p className="min-w-0 flex-1 text-sm text-primary-dark dark:text-primary" dir="auto">
                  {fmt(t.useProductHint, { product: offerProduct.name })}
                </p>
                <Button size="sm" variant="outline" onClick={() => change(fillProductCards(step.tree, offerProduct.id))}>
                  <PackageCheck className="size-4" aria-hidden /> <span dir="auto">{fmt(t.useProduct, { product: offerProduct.name })}</span>
                </Button>
              </div>
            )}

            {sections.length === 0 ? (
              <div className="rounded-[var(--radius-card)] border border-dashed border-danger/40 bg-danger-soft/40 px-6 py-12 text-center text-sm text-ink-soft">{t.empty}</div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis, restrictToParentElement]} onDragEnd={handleDragEnd}>
                <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {sections.map((section) => (
                      <SectionCard
                        key={section.id}
                        section={section}
                        selected={section.id === selectedId}
                        onSelect={() => selectSection(section.id)}
                        onDelete={() => setPendingDelete(section)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {/* The library sits in the sidebar on desktop and below the page on small screens. */}
            <div className="mt-6 rounded-[var(--radius-card)] border border-line bg-paper-raised lg:hidden">
              <BlockLibrary onAdd={addBlock} />
            </div>
          </div>
        </main>

        <CollapsiblePane
          side="end"
          collapsed={inspectorCollapsed}
          onCollapsedChange={setInspectorCollapsed}
          visibleClassName="xl:flex xl:w-80"
          railClassName="xl:flex"
          collapseLabel={t.collapsePanel}
          expandLabel={t.expandPanel}
        >
          {inspector || <p className="px-4 py-6 text-sm text-ink-soft">{t.selectSection}</p>}
        </CollapsiblePane>
      </div>

      {/* Below xl the inspector can't sit beside the page, so it overlays. */}
      {selected && <div className="fixed inset-y-0 end-0 z-30 w-80 max-w-full border-s border-line bg-paper-raised shadow-xl xl:hidden">{inspector}</div>}

      {previewOpen && (
        <div className="fixed inset-y-0 end-0 z-40 w-full border-s border-line shadow-xl lg:w-1/2">
          <StorefrontPreview
            workspaceId={workspaceId}
            tree={step.tree}
            labels={{
              title: fmt(t.previewTitle, { name: step.name }),
              hint: t.previewHint,
              refresh: t.refresh,
              desktop: t.desktop,
              mobile: t.mobile,
              close: t.close,
              frameTitle: t.frameTitle,
              xray: ui.previewXray,
            }}
            // The website editor's canvas (item 95): pick, insert, drag and resize, double-click text, X-ray.
            canvas={{
              selectedId,
              labels: Object.fromEntries(sections.map((s) => [s.id, sectionLabel(s, locale)])),
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
              onSelect: (id) => selectSection(id),
              onInsert: setInsertIndex,
              onMoveSection: (id, direction) => {
                const from = sections.findIndex((s) => s.id === id);
                const to = direction === "up" ? from - 1 : from + 1;
                if (from >= 0 && to >= 0 && to < sections.length) setSections(moveSection(sections, from, to));
              },
              onCanvasEdit: (edit) => setSections(applyCanvasEdit(sections, edit)),
              onCanvasStep: (canvasStep) => {
                if (canvasStep.kind === "element") {
                  setSections(nudgeElement(sections, canvasStep.sectionId, canvasStep.elementId, canvasStep.delta));
                  return;
                }
                const edit = stepEdit(canvasStep);
                if (edit) setSections(applyCanvasEdit(sections, edit), `canvas:${canvasStep.kind}:${canvasStep.sectionId}`);
              },
              inlineText: inlineTextIds(sections),
              onTextEdit: (elementId, text) => setSections(setElementText(sections, elementId, text)),
            }}
            onClose={() => setPreviewOpen(false)}
          />
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t.deleteSectionTitle}
        description={pendingDelete ? fmt(t.deleteSectionDescription, { name: sectionLabel(pendingDelete, locale) }) : undefined}
        confirmLabel={t.deleteSection}
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteSection(pendingDelete)}
      />

      <MediaPicker
        open={imageOpen}
        onOpenChange={(open) => {
          if (!open) setImageOpen(false);
        }}
        onPick={(file) => {
          const apply = imageRequest.current;
          imageRequest.current = null;
          setImageOpen(false);
          apply?.(file.url);
        }}
        accept="image"
      />
    </EditorLocaleContext.Provider>
  );
}
