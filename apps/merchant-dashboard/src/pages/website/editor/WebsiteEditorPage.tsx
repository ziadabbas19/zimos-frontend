import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@store-builder/ui";
import type { CreateWebsitePagePayload, PageSection, WebsitePage } from "@store-builder/api-client";
import {
  IconClock,
  IconExternal,
  IconInspect,
  IconMoon,
  IconPlus,
  IconRefresh,
  IconSliders,
  IconSun,
  IconTheme,
} from "@/components/icons";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useLocale, useT } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MediaPicker } from "@/components/MediaPicker";
import { useToast } from "@/components/Toast";
import { BlockLibrarySheet } from "./BlockLibrary";
import { LayerList } from "./LayerList";
import { SectionInspector, type InspectorTab } from "./SectionInspector";
import { namedStylesOf } from "./ElementStylePanel";
import { StoreLookPanel, ThemePresetRow } from "./StoreLookPanel";
import { NewPageDialog } from "./NewPageDialog";
import { PageTabs } from "./PageTabs";
import { inlineTextIds, sectionHidden } from "./canvasTools";
import { ShellPanel } from "./ShellPanels";
import { sectionElements, sectionLabel, type BlockPreset } from "./blocks";
import { EditorLocaleContext, editorUi, useEditorLocale } from "./editorLocale";
import { shellPartLabel, type ShellPart } from "./storeShell";
import type { ColorMode } from "./storeThemes";
import { EditorCanvas } from "./shell/EditorCanvas";
import { EditorPageSettings } from "./shell/EditorPageSettings";
import { EditorStage, GuideStrip, LookBar } from "./shell/EditorStage";
import { EditorToolbar, type EditorMenuItem, type SiteStatus } from "./shell/EditorToolbar";
import { EndPanel, LookIntro } from "./shell/EndPanel";
import { PageSwitcher } from "./shell/PageSwitcher";
import { PhoneDock, PhoneInspectorSheet, PhoneSheets } from "./shell/PhoneBars";
import { PublishSheet } from "./shell/PublishSheet";
import { StartPanel, type StartTab } from "./shell/StartPanel";
import { VersionHistorySheet } from "./shell/VersionHistorySheet";
import { SHELL_STRINGS } from "./shell/shellStrings";
import { pageChange } from "./shell/treeTools";
import { useEditorDocument } from "./shell/useEditorDocument";
import { useEditorShortcuts, useLeaveGuard } from "./shell/useEditorGuards";
import {
  EDITOR_DEVICES,
  ROOMY_QUERY,
  WIDE_QUERY,
  useMediaQuery,
  useStoredChoice,
  useStoredFlag,
  type EditorDevice,
  type PreviewControls,
} from "./shell/useEditorLayout";
import { usePublishFlow } from "./shell/usePublishFlow";
import { useSectionEdits } from "./shell/useSectionEdits";

/**
 * The website editor — the real storefront, live, with the tools around it.
 *
 * This file is the shell: it holds what is selected and which sheet is open,
 * and joins the zones, each in ./shell:
 *
 *  - the toolbar (EditorToolbar): back, the site and its status, the page
 *    switcher, the device switch, undo / redo, the save state in words, «…»
 *    and «انشر»;
 *  - start (StartPanel): the open page's sections and the site's pages;
 *  - centre (EditorStage + EditorCanvas): the storefront itself, where a click
 *    selects, a double-click types, an image opens the media library and a
 *    selected section carries its own small bar;
 *  - end (EndPanel): the inspector of whatever is selected — or, with nothing
 *    selected, the store look.
 *
 * Below lg the stage fills the screen: the side panels become sheets opened
 * from a bottom bar (PhoneDock), and the inspector rises as a bottom sheet
 * over the lower part of the store (PhoneInspectorSheet).
 *
 * What is edited and how it is saved is useEditorDocument's (the page draft
 * saves by itself, the look only when asked); the edits themselves are
 * useSectionEdits'; the keys and the leave guard are useEditorGuards'.
 * Selection has two levels — a section, and one element inside it — and
 * Escape steps up through them.
 */

type ImageRequest =
  | { kind: "field"; sectionId: string; elementId: string; field: string }
  | { kind: "apply"; apply: (url: string) => void };

export function WebsiteEditorPage() {
  // The shared editor pieces (inspector, library, image pickers) speak the
  // dashboard's language here; the funnel builder sets its own.
  const { locale } = useLocale();
  return (
    <EditorLocaleContext.Provider value={locale}>
      <WebsiteEditor />
    </EditorLocaleContext.Provider>
  );
}

function WebsiteEditor() {
  const { websiteId = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const toast = useToast();
  const locale = useEditorLocale();
  const ui = editorUi(locale);
  const t = useT(SHELL_STRINGS);

  const doc = useEditorDocument(workspaceId, websiteId);
  const { site, website, pages, page, sections, look, treeMeta } = doc;

  // --- layout ---------------------------------------------------------------
  /** From lg: three zones side by side. Under it: the stage, a bottom bar and sheets. */
  const wide = useMediaQuery(WIDE_QUERY, true);
  /** From md the toolbar has the device switch; under it the phone IS the device. */
  const roomy = useMediaQuery(ROOMY_QUERY, true);
  // Remembered in this browser: the device the stage shows (phone first), and each side panel shown or hidden.
  const [device, setDevice] = useStoredChoice<EditorDevice>("zimos:website-editor:device", "phone", EDITOR_DEVICES);
  const [startShown, setStartShown] = useStoredFlag("zimos:website-editor:start-panel", true);
  const [endShown, setEndShown] = useStoredFlag("zimos:website-editor:end-panel", true);
  const [startTab, setStartTab] = useState<StartTab>("sections");

  // --- selection: a section, and one element inside it ----------------------
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  /** The announcement bar, header or footer, when one of those is open instead of a section. */
  const [selectedShell, setSelectedShell] = useState<ShellPart | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("content");
  /** Where "add a section here" pointed; the next block from the library lands there. */
  const [insertIndex, setInsertIndex] = useState<number | null>(null);
  const [scrollRequest, setScrollRequest] = useState<{ sectionId: string; nonce: number } | null>(null);
  const [shellScrollRequest, setShellScrollRequest] = useState<{ part: ShellPart; nonce: number } | null>(null);

  // A freshly opened page starts with nothing selected (adjusted during render, like the seeding it follows).
  const [selectionFor, setSelectionFor] = useState<string | null>(null);
  if (doc.seededPageId !== selectionFor) {
    setSelectionFor(doc.seededPageId);
    setSelectedSectionId(null);
    setSelectedElementId(null);
    setInsertIndex(null);
  }

  // --- the preview's own switches (driven from «…») --------------------------
  // Its light/dark mode (null: whatever the page opens in). The look panel
  // switches it to the mode whose accent is being edited.
  const [previewMode, setPreviewMode] = useState<ColorMode | null>(null);
  const [xray, setXray] = useState(false);
  const controlsRef = useRef<PreviewControls | null>(null);

  // --- sheets and dialogs -----------------------------------------------------
  const [libraryOpen, setLibraryOpen] = useState(false);
  /** Below lg: the section list, the store look and the inspector are sheets. */
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [lookOpen, setLookOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  /** Below lg, the first-run «لوّنه بهويتك»: the ready styles alone, in a short sheet under the store. */
  const [brandOpen, setBrandOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showNewPage, setShowNewPage] = useState(false);
  /** Asked from the keyboard (Delete / Backspace): a stray key should not cost a section. */
  const [pendingDelete, setPendingDelete] = useState<PageSection | null>(null);
  const [pendingPageDelete, setPendingPageDelete] = useState<WebsitePage | null>(null);
  /** Page the merchant asked to switch to while this page's last changes could not be saved. */
  const [pendingSwitchId, setPendingSwitchId] = useState<string | null>(null);
  /** In-app address the merchant tried to leave for with something unsaved, and what it was. */
  const [pendingLeave, setPendingLeave] = useState<{ to: string; reason: "page" | "look" } | null>(null);
  const [imageOpen, setImageOpen] = useState(false);
  const imageRequest = useRef<ImageRequest | null>(null);

  // --- what is selected, as things are now -----------------------------------
  const selected = sections.find((s) => s.id === selectedSectionId) ?? null;
  const elementId =
    selected && selectedElementId && sectionElements(selected).some((el) => el.id === selectedElementId)
      ? selectedElementId
      : null;
  const labels = useMemo(
    () => Object.fromEntries(sections.map((s) => [s.id, sectionLabel(s, locale)])),
    [sections, locale]
  );
  const tree = useMemo(() => ({ ...treeMeta, sections }), [treeMeta, sections]);
  const inlineText = useMemo(() => inlineTextIds(sections), [sections]);
  const hasUnpublished = useMemo(() => pages.some((p) => pageChange(p) !== "same"), [pages]);
  const slug = currentWorkspace?.slug ?? "";

  function revealInspector() {
    if (wide) setEndShown(true);
    else setInspectorOpen(true);
  }

  /** Selecting from the editor side also brings the section into view in the preview. */
  function selectSection(sectionId: string, { scroll, reveal = true }: { scroll: boolean; reveal?: boolean }) {
    setSelectedSectionId(sectionId);
    setSelectedElementId(null);
    setSelectedShell(null);
    setSectionsOpen(false);
    if (reveal) revealInspector();
    if (scroll) setScrollRequest((prev) => ({ sectionId, nonce: (prev?.nonce ?? 0) + 1 }));
  }

  /** A click on an element of the selected section — in the preview, or in the section list. */
  function selectElement(target: { sectionId: string; elementId: string }) {
    setSelectedSectionId(target.sectionId);
    setSelectedElementId(target.elementId);
    setSelectedShell(null);
    setSectionsOpen(false);
    revealInspector();
  }

  /** Opens the announcement bar's, header's or footer's panel — and, from the editor side, scrolls the preview to it. */
  function selectShell(part: ShellPart, { scroll }: { scroll: boolean }) {
    setSelectedShell(part);
    setSelectedSectionId(null);
    setSelectedElementId(null);
    setSectionsOpen(false);
    setLookOpen(false);
    revealInspector();
    if (scroll) setShellScrollRequest((prev) => ({ part, nonce: (prev?.nonce ?? 0) + 1 }));
  }

  function clearSelection() {
    setSelectedSectionId(null);
    setSelectedElementId(null);
    setSelectedShell(null);
    setInspectorOpen(false);
  }

  /** Escape: the element, then its section, then nothing. True when there was something to let go of. */
  function stepSelectionUp(): boolean {
    if (elementId) {
      setSelectedElementId(null);
      return true;
    }
    if (selected || selectedShell) {
      clearSelection();
      return true;
    }
    return false;
  }

  /** The store look: the end panel shows it when nothing is selected; on a phone it is a sheet. */
  function showStoreLook() {
    clearSelection();
    if (wide) setEndShown(true);
    else setLookOpen(true);
  }

  // --- edits ----------------------------------------------------------------
  const edits = useSectionEdits({
    doc,
    selectedSectionId,
    // A section an edit made or landed in. On a phone it is shown first; its
    // inspector stays one tap away on the bottom bar instead of covering it.
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

  // --- saving -------------------------------------------------------------------

  /** Ctrl/⌘+S: everything now — the page draft, and the look if it has changes (what the old Save did). */
  async function saveNow() {
    const hadPage = doc.pageDirty;
    const hadLook = doc.lookDirty;
    if (!hadPage && !hadLook) return;
    const pageOk = await doc.flush();
    const lookOk = hadLook ? await doc.saveLook() : true;
    if (!pageOk) toast.error(ui.saveFailed);
    else if (!lookOk) toast.error(ui.lookSaveFailed);
    else toast.success(hadPage && hadLook ? ui.savedBoth : hadLook ? ui.lookSaved : ui.pageSaved);
  }

  /** "Try again" after a failed save of the draft. */
  async function retrySave() {
    const stored = await doc.flush();
    if (!stored) toast.error(ui.saveFailed);
  }

  async function saveLookNow() {
    const stored = await doc.saveLook();
    if (stored) toast.success(ui.lookSaved);
    else toast.error(ui.lookSaveFailed);
  }

  // --- pages --------------------------------------------------------------------

  /**
   * Switching pages replaces what is on the canvas, so the open page's last
   * changes are stored first. Only if that fails is the merchant asked.
   * (An unsaved store look is workspace-wide and survives the switch.)
   */
  async function requestPageSwitch(pageId: string) {
    if (pageId === doc.selectedPageId) return;
    const stored = await doc.flush();
    if (!stored) {
      setPendingSwitchId(pageId);
      return;
    }
    doc.openPage(pageId);
  }

  async function createPage(payload: CreateWebsitePagePayload) {
    // The new page opens at once; what is on the canvas now is stored before it goes.
    const stored = await doc.flush();
    if (!stored) throw new Error(t.switchBody);
    const created = await doc.createPage(payload);
    setShowNewPage(false);
    toast.success(ui.pageCreated(created.title));
  }

  async function deletePage(target: WebsitePage) {
    const deleted = await doc.deletePage(target);
    setPendingPageDelete(null);
    if (deleted) toast.success(ui.pageDeleted(target.title));
  }

  // --- publish: the sheet that says what will change, then the one button ----------
  const publish = usePublishFlow(doc, slug);

  // --- first run ----------------------------------------------------------------
  // The template gallery sends a new site here with ?start=1. The steps show
  // until the site is published once, or the merchant puts them away.
  const firstRun = searchParams.get("start") === "1" && website !== null && website.publishedRevisionId === null;

  /** Step two. On a wide screen the look panel (ready styles first) beside the store; on a phone a short sheet under it. */
  function openBrand() {
    if (wide) {
      showStoreLook();
      return;
    }
    clearSelection();
    setBrandOpen(true);
  }

  function dismissGuide() {
    const next = new URLSearchParams(searchParams);
    next.delete("start");
    setSearchParams(next, { replace: true });
  }

  // --- never lose work: leaving, and the keys ------------------------------------

  /** Leaving for another screen: the draft is stored on the way; only what can't be is asked about. */
  async function leaveTo(to: string) {
    const stored = await doc.flush();
    if (!stored) setPendingLeave({ to, reason: "page" });
    else if (doc.lookDirty) setPendingLeave({ to, reason: "look" });
    else navigate(to);
  }
  useLeaveGuard(doc.pageDirty || doc.lookDirty, (to) => void leaveTo(to));

  useEditorShortcuts({
    save: () => void saveNow(),
    undo: doc.undo,
    redo: doc.redo,
    escape: stepSelectionUp,
    // Delete / Backspace on a selected section asks first: a stray key should not cost a section.
    remove: () => {
      if (!selected || elementId) return false;
      setPendingDelete(selected);
      return true;
    },
  });

  // --- what the zones show ------------------------------------------------------

  // «منشور» / «مسودة» / «فيه تغييرات ما اتنشرتش»: a published site whose drafts moved on says so.
  const status: SiteStatus | null = !website
    ? null
    : website.status === "suspended"
      ? "suspended"
      : website.status !== "published"
        ? "draft"
        : hasUnpublished || doc.pageDirty
          ? "changed"
          : "published";

  // The save state in a word or two, under the page's name on a phone (the toolbar says it in full from lg).
  const saveWords =
    doc.saveState === "failed"
      ? t.saveShortFailed
      : doc.saveState === "saving"
        ? t.saveShortSaving
        : doc.saveState === "saved"
          ? t.saveShortSaved
          : t.saveShortIdle;

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

  // «…»: what used to be buttons on two bars. A shareable link to the DRAFT is
  // not here: the API has none.
  const menu: EditorMenuItem[][] = [
    [
      ...(page ? [{ id: "settings", label: t.menuPageSettings, icon: IconSliders, onSelect: () => setSettingsOpen(true) }] : []),
      { id: "history", label: t.menuHistory, icon: IconClock, onSelect: () => setHistoryOpen(true) },
      ...(website?.status === "published" && slug
        ? [{ id: "live", label: t.menuLiveStore, icon: IconExternal, onSelect: publish.openStore }]
        : []),
    ],
    [
      { id: "look", label: t.menuStoreLook, icon: IconTheme, onSelect: showStoreLook },
    ],
    [
      { id: "mode", label: dark ? t.menuLight : t.menuDark, icon: dark ? IconSun : IconMoon, onSelect: togglePreviewMode },
      { id: "xray", label: xray ? t.menuXrayOff : t.menuXrayOn, icon: IconInspect, onSelect: toggleXray },
      { id: "refresh", label: t.menuRefresh, icon: IconRefresh, onSelect: () => controlsRef.current?.refresh() },
    ],
  ];

  const announcementOn = look.announcement.enabled && look.announcement.messages.some((m) => m.trim() !== "");

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
      onSelectElement={(sectionId, id) => selectElement({ sectionId, elementId: id })}
      selectedElementId={elementId}
      selectedShell={selectedShell}
      onSelectShell={(part) => selectShell(part, { scroll: true })}
      announcementOn={announcementOn}
    />
  );

  const pageList = (
    <PageTabs
      variant="list"
      pages={pages}
      selectedId={doc.selectedPageId}
      onSelect={(pageId) => void requestPageSwitch(pageId)}
      onDelete={setPendingPageDelete}
      onAdd={() => setShowNewPage(true)}
    />
  );

  const lookPanel = (variant: "panel" | "sheet") => (
    <StoreLookPanel
      variant={variant}
      look={look}
      onChange={doc.updateLook}
      onEditShell={(part) => selectShell(part, { scroll: true })}
      storeName={currentWorkspace?.name ?? ""}
      previewMode={previewMode ?? "light"}
      onPreviewMode={setPreviewMode}
    />
  );

  // The inspector of whatever is selected; null when nothing is.
  const inspector = selectedShell ? (
    <ShellPanel
      part={selectedShell}
      look={look}
      onChange={doc.updateLook}
      pages={pages}
      usage={doc.settingsUsage}
      onClose={clearSelection}
    />
  ) : selected ? (
    <SectionInspector
      section={selected}
      onChange={edits.update}
      namedStyles={namedStylesOf(treeMeta.globalStyles)}
      onNamedStylesChange={(named) =>
        // Saved with the page tree; the element that triggered it changes too.
        doc.setTreeMeta((prev) => ({ ...prev, globalStyles: { ...(prev.globalStyles ?? {}), named } }))
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
  const selectionLabel = selectedShell ? shellPartLabel(selectedShell, ui) : selected ? labels[selected.id] : "";

  return (
    // A full-viewport page (mounted in EditorLayout, not DashboardLayout — see
    // App.tsx): a column of the toolbar, the strips that come and go, the three
    // zones, and on a phone the bottom bar. Only the zones scroll, each on its own.
    // (`size-full`, not `h-full`: index.css has an old rule for the previous editor's bar keyed on
    // `.flex.h-full.flex-col > .border-b.bg-paper-raised:first-child`, which would outrank the toolbar's glass.)
    <div data-slot="editor" className="flex size-full flex-col">
      <EditorToolbar
        siteName={website ? website.name : ui.editorTitle}
        status={status}
        switcher={
          site.data && (
            <PageSwitcher
              pages={pages}
              page={page}
              onSelect={(pageId) => void requestPageSwitch(pageId)}
              onDelete={setPendingPageDelete}
              onAdd={() => setShowNewPage(true)}
              asSheet={!roomy}
              caption={saveWords}
              captionTone={doc.saveState === "failed" ? "alert" : "quiet"}
            />
          )
        }
        device={device}
        onDeviceChange={setDevice}
        canUndo={doc.canUndo}
        canRedo={doc.canRedo}
        onUndo={doc.undo}
        onRedo={doc.redo}
        saveState={doc.saveState}
        onSaveNow={() => void retrySave()}
        menu={menu}
        onPublish={publish.start}
        publishDisabled={!website}
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

      {firstRun && (
        <GuideStrip brandDone={doc.lookSaves > 0} onBrand={openBrand} onPublish={publish.start} onDismiss={dismissGuide} />
      )}

      {/* A failed save says so in words, with the reason and the way out. The changes stay in memory. */}
      {doc.saveState === "failed" && (
        <div
          role="alert"
          data-slot="editor-alert"
          className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-line bg-danger-soft px-3 py-2"
        >
          <p className="min-w-0 flex-1 basis-56 text-sm text-ink">
            <span className="font-medium text-danger">{t.saveErrorTitle}</span> {doc.saveError}
          </p>
          <Button type="button" variant="outline" size="sm" className="rounded-full px-3" onClick={() => void retrySave()}>
            {t.retry}
          </Button>
        </div>
      )}

      <div className="min-h-0 flex-1">
        <DataState
          loading={site.loading}
          error={site.error}
          empty={!site.data}
          emptyMessage={ui.noPagesToEdit}
          onRetry={() => void site.refresh()}
        >
          <div className="flex h-full min-h-0">
            {wide && startShown && (
              <StartPanel
                tab={startTab}
                onTabChange={setStartTab}
                sections={layerList("panel")}
                pages={pageList}
                onAddSection={() => requestInsert(null)}
              />
            )}

            <EditorStage
              device={roomy ? device : "phone"}
              onClear={clearSelection}
              bar={
                doc.lookDirty ? (
                  <LookBar
                    saving={doc.savingLook}
                    error={doc.lookError}
                    onSave={() => void saveLookNow()}
                    onRevert={doc.revertLook}
                  />
                ) : null
              }
            >
              {!page ? (
                <div className="flex h-full items-center justify-center p-6">
                  <div className="max-w-sm rounded-[1.5rem] bg-paper-raised px-6 py-8 text-center ring-1 ring-line">
                    <p className="text-sm leading-6 text-ink-soft">{ui.noPages}</p>
                    <Button type="button" variant="secondary" className="zimos-editor-soft mt-4 h-11 rounded-full px-5" onClick={() => setShowNewPage(true)}>
                      <IconPlus className="size-4" aria-hidden />
                      {t.newPage}
                    </Button>
                  </div>
                </div>
              ) : (
                <EditorCanvas
                  workspaceId={workspaceId}
                  tree={tree}
                  look={look}
                  savedThemeSettings={currentWorkspace?.themeSettings}
                  shellDirty={doc.shellDirty}
                  device={roomy ? device : "phone"}
                  onDeviceChange={setDevice}
                  controlsRef={controlsRef}
                  colorMode={previewMode}
                  onColorModeChange={setPreviewMode}
                  selectedSectionId={selectedSectionId}
                  selectedElementId={elementId}
                  selectedShell={selectedShell}
                  labels={labels}
                  inlineText={inlineText}
                  scrollRequest={scrollRequest}
                  shellScrollRequest={shellScrollRequest}
                  onSelectSection={(id) => selectSection(id, { scroll: false })}
                  onSelectElement={selectElement}
                  onSelectShell={(part) => selectShell(part, { scroll: false })}
                  onInsert={requestInsert}
                  onMoveSection={edits.moveBy}
                  onSectionAction={edits.act}
                  onPickImage={(target) =>
                    requestImage({ kind: "field", sectionId: target.sectionId, elementId: target.elementId, field: target.field })
                  }
                  onCanvasEdit={(edit) => edits.applyCanvas(edit)}
                  onCanvasStep={edits.stepCanvas}
                  onTextEdit={edits.editText}
                />
              )}
            </EditorStage>

            {wide && endShown && (
              <EndPanel>
                {inspector ?? (
                  <>
                    <LookIntro />
                    {lookPanel("panel")}
                  </>
                )}
              </EndPanel>
            )}
          </div>
        </DataState>
      </div>

      {!wide && site.data && (
        <PhoneDock
          onSections={() => setSectionsOpen(true)}
          onAdd={() => requestInsert(null)}
          onLook={showStoreLook}
          edit={inspector && !inspectorOpen ? { label: selectionLabel, onOpen: () => setInspectorOpen(true) } : null}
        />
      )}

      {/* Below lg the side panels are sheets. */}
      {!wide && (
        <>
          <PhoneSheets
            sectionsOpen={sectionsOpen}
            onSectionsOpenChange={setSectionsOpen}
            sectionList={layerList("sheet")}
            lookOpen={lookOpen}
            onLookOpenChange={setLookOpen}
            lookPanel={lookPanel("sheet")}
            brandOpen={brandOpen}
            onBrandOpenChange={setBrandOpen}
            presets={
              <ThemePresetRow
                look={look}
                onChange={doc.updateLook}
                storeName={currentWorkspace?.name ?? ""}
                previewMode={previewMode ?? "light"}
                variant="sheet"
                className="[--look-bleed:1.25rem]"
              />
            }
            lookDirty={doc.lookDirty}
            savingLook={doc.savingLook}
            onSaveLook={() => void saveLookNow()}
            onRevertLook={doc.revertLook}
          />
          {/* Not a dialog: the store above it stays alive (see PhoneInspectorSheet). */}
          {inspectorOpen && inspector && (
            <PhoneInspectorSheet title={selectionLabel || t.editSheet} onHide={() => setInspectorOpen(false)}>
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
        // Saved sections live in the library too, under their own chip.
        onInsertSaved={insertSaved}
        insertIndex={insertIndex}
      />

      <MediaPicker
        open={imageOpen}
        onOpenChange={(open) => {
          if (!open) setImageOpen(false);
        }}
        onPick={imagePicked}
        accept="image"
        title={t.pickImage}
      />

      <PublishSheet
        open={publish.open}
        onOpenChange={publish.setOpen}
        workspaceId={workspaceId}
        website={website}
        pages={pages}
        checking={publish.checking}
        publishing={publish.publishing}
        error={publish.error}
        problems={publish.problems}
        lookDirty={doc.lookDirty}
        savingLook={doc.savingLook}
        onSaveLook={() => void saveLookNow()}
        onPublish={() => void publish.publishNow()}
        onOpenPage={(pageId) => {
          publish.setOpen(false);
          void requestPageSwitch(pageId);
        }}
      />

      <VersionHistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        workspaceId={workspaceId}
        websiteId={websiteId}
        liveRevisionId={website?.publishedRevisionId ?? null}
        onRestored={doc.reloadSite}
      />

      {settingsOpen && page && (
        <EditorPageSettings
          key={page.id}
          page={page}
          treeMeta={treeMeta}
          onTreeMetaChange={doc.setTreeMeta}
          onSaveSeo={(seo) => doc.saveSeo(page.id, seo)}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <NewPageDialog open={showNewPage} onClose={() => setShowNewPage(false)} onCreate={createPage} />

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

      <ConfirmDialog
        open={pendingPageDelete !== null}
        title={ui.deletePageTitle}
        description={pendingPageDelete ? ui.deletePageBody(pendingPageDelete.title, pendingPageDelete.path) : undefined}
        confirmLabel={ui.deletePage}
        destructive
        onCancel={() => setPendingPageDelete(null)}
        onConfirm={() => pendingPageDelete && deletePage(pendingPageDelete)}
      />

      {/* Reached only when the page's last changes could not be stored. */}
      <ConfirmDialog
        open={pendingSwitchId !== null}
        title={t.leaveTitle}
        description={t.switchBody}
        confirmLabel={t.switchConfirm}
        destructive
        onCancel={() => setPendingSwitchId(null)}
        onConfirm={() => {
          if (pendingSwitchId) doc.openPage(pendingSwitchId);
          setPendingSwitchId(null);
        }}
      />

      <ConfirmDialog
        open={pendingLeave !== null}
        title={t.leaveTitle}
        description={pendingLeave?.reason === "look" ? t.leaveLookBody : t.leavePageBody}
        confirmLabel={t.leaveConfirm}
        destructive
        onCancel={() => setPendingLeave(null)}
        onConfirm={() => {
          const to = pendingLeave?.to;
          setPendingLeave(null);
          if (to) navigate(to);
        }}
      />
    </div>
  );
}
