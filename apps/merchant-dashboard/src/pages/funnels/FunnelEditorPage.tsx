import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { arrayMove } from "@dnd-kit/sortable";
import { Button, cn } from "@store-builder/ui";
import { IconArrowLeft, IconFunnels, IconPlus, IconSections, IconSliders, type IconComponent } from "@/components/icons";
import { useSessionBool } from "@/lib/useSessionState";
import { funnelsPause, funnelsProblemsOf, funnelsPublish, funnelsResume, type FunnelProblem, type PageTree } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { DataState, SkeletonBar } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { Sheet, SheetBody, SheetFrame, SheetHeader } from "@/components/Sheet";
import { useFunnelDraft } from "./FunnelDraft";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
// The store editor's shell (Phase 6): the same round tool button, the same breakpoint and the same leave guard.
import { TOOL_BUTTON } from "../website/editor/shell/EditorToolbar";
import { useLeaveGuard } from "../website/editor/shell/useEditorGuards";
import { WIDE_QUERY, useMediaQuery } from "../website/editor/shell/useEditorLayout";
import {
  CARD_GAP_X,
  loadUiFunnel,
  saveFunnelDiff,
  starterPlan,
  uniqueStepKey,
  useFunnelErrorMessage,
  type SaveProgress,
  type StarterTemplateId,
  type UiFunnel,
  type UiStep,
  type UiStepType,
} from "./funnelAdapter";
import { EDITOR_STRINGS, PAGE_STRINGS, STEP_TYPE_LABELS } from "./FunnelEditorPage.strings";
import { funnelPreviewUrl, useStoreBaseUrl } from "./FunnelPublicLink";
import { FUNNEL_LIST_STRINGS } from "./list/funnelListStrings";
import { addStepAfter, applyStarterPlan, collectFunnelProblems, duplicateStep, groupProblems, insertStepOnEdge, newStep, removeStep, tidyFunnel } from "./funnelFlow";
import { FunnelStepPageEditor } from "./FunnelStepPageEditor";
import { flowSteps, genericPagePath, genericPageTree, isGenericStep, type GenericPreset } from "./genericPageRules";
import { linkPoint } from "./FlowLinkPoints";
import { EditorHeader } from "./editor/EditorHeader";
import { FlowCanvas } from "./editor/FlowCanvas";
import { StepInspector } from "./editor/StepInspector";
import { StepsPane } from "./editor/StepsPane";
import { STEP_TONE, STEP_TYPE_ORDER, StepIcon, entryKeysOf, indexOffers, loadOfferCatalog, mergeProblems } from "./editor/funnelMeta";

// The editor's zones live in ./editor: funnelMeta (shared tables and helpers),
// EditorHeader, StepsPane, FlowCanvas and StepInspector. This file keeps the
// state, the handlers and the layout that places them: one bar, the map under
// it filling the window, the steps and the selected step's details in side
// panes on a wide screen and in bottom sheets on a phone.
export { STEP_TYPES, validateFunnel } from "./editor/funnelMeta";

/** A sheet, dialog, menu or popover is open: Escape is its own. */
const OVERLAY_OPEN = '[data-slot="sheet"]:not([data-peek]), [data-slot="popover"], [role="dialog"], [role="alertdialog"], [role="menu"]';

// ----------------------------------------------------------------- page --

export function FunnelEditorPage() {
  const { funnelId = "" } = useParams();
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const toast = useToast();
  const t = useT(EDITOR_STRINGS);
  const listT = useT(FUNNEL_LIST_STRINGS);
  const { locale } = useLocale();
  const describeError = useFunnelErrorMessage();

  const loaded = useAsync(() => loadUiFunnel(workspaceId, funnelId), [workspaceId, funnelId]);
  const catalog = useAsync(() => loadOfferCatalog(workspaceId), [workspaceId]);

  const [funnel, setFunnel] = useState<UiFunnel | null>(null);
  const [baseline, setBaseline] = useState<UiFunnel | null>(null);
  const [seeded, setSeeded] = useState<UiFunnel | null>(null);
  if (loaded.data && loaded.data !== seeded) {
    setSeeded(loaded.data);
    setFunnel(loaded.data);
    setBaseline(loaded.data);
  }

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<UiStep | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<SaveProgress | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  /** The 422 problem list from the last failed publish. Cleared by the next edit. */
  const [serverProblems, setServerProblems] = useState<FunnelProblem[]>([]);
  const [showProblems, setShowProblems] = useState(false);
  const [view, setView] = useState<"flow" | "page">("flow");
  const [editingName, setEditingName] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  /** Desktop only — collapses the step list / inspector to a slim rail so the flow canvas can use their width. */
  const [stepsCollapsed, setStepsCollapsed] = useSessionBool("zimos:funnel-editor:steps-collapsed", false);
  const [inspectorCollapsed, setInspectorCollapsed] = useSessionBool("zimos:funnel-editor:inspector-collapsed", false);
  /** From lg up the editor is three zones side by side; under it the map is the whole screen, with a bottom bar and sheets. */
  const wide = useMediaQuery(WIDE_QUERY, true);
  /** Below lg the side panes are sheets: the step list, the step types to add, the selected step's details. */
  const [stepsSheetOpen, setStepsSheetOpen] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);
  /** Where the merchant asked to go while there is unsaved work; the leave question is open while it is set. */
  const [pendingLeave, setPendingLeave] = useState<string | null>(null);

  const baselineJson = useMemo(() => (baseline ? JSON.stringify(baseline) : ""), [baseline]);
  const dirty = funnel !== null && JSON.stringify(funnel) !== baselineJson;

  // Unsaved map work is auto-saved to the server and offered back next time.
  const draft = useFunnelDraft<UiFunnel>({ workspaceId, funnelId, state: funnel, dirty, ready: !!loaded.data });
  const hadChanges = useRef(false);
  const discardDraft = draft.discard;
  useEffect(() => {
    if (dirty) hadChanges.current = true;
    // Saved or reverted: there is no pending work left to keep.
    else if (hadChanges.current && !saving) {
      hadChanges.current = false;
      discardDraft();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- discardDraft is recreated each render; dirty/saving are the triggers
  }, [dirty, saving]);

  // While there is unsaved work: the browser's own "leave?" on reload and close (as before), and a
  // click on any link that would leave the editor — the way back included — asks once first.
  useLeaveGuard(dirty, setPendingLeave);

  const selected = funnel?.steps.find((s) => s.key === selectedKey) ?? null;
  const entryKeys = useMemo(() => (funnel ? entryKeysOf(funnel) : []), [funnel]);
  const storeBase = useStoreBaseUrl();
  // The address shoppers open, on the store's own domain. Preview opens the live funnel, so only once it is published.
  const publicUrl = funnel && funnel.status === "published" ? funnelPreviewUrl(storeBase, funnel) : null;
  const offerIndex = useMemo(() => indexOffers(catalog.data), [catalog.data]);

  // What would stop a publish right now, re-checked on every edit, plus what
  // the server said on the last publish attempt — shown on the step they name.
  const liveProblems = useMemo(() => (funnel ? collectFunnelProblems(funnel, locale) : []), [funnel, locale]);
  const allProblems = useMemo(() => mergeProblems(serverProblems, liveProblems), [serverProblems, liveProblems]);
  const grouped = useMemo(() => groupProblems(allProblems, funnel?.steps.map((s) => s.key) ?? []), [allProblems, funnel?.steps]);

  const patch = useCallback((updater: (f: UiFunnel) => UiFunnel) => {
    setFunnel((prev) => (prev ? updater(prev) : prev));
    setServerProblems([]);
  }, []);

  /** Keys a new step must not reuse: keys are immutable server-side and deletes run last on save. */
  const takenKeys = useCallback((f: UiFunnel) => [...f.steps.map((s) => s.key), ...(baseline?.steps.map((s) => s.key) ?? [])], [baseline]);

  /** Picking a step (list or canvas) is the point of opening the inspector — bring it back if it was collapsed. */
  function selectStep(key: string) {
    setSelectedKey(key);
    setInspectorCollapsed(false);
  }

  const updateStep = useCallback(
    (key: string, changes: Partial<UiStep>) => {
      patch((f) => ({ ...f, steps: f.steps.map((s) => (s.key === key ? { ...s, ...changes } : s)) }));
    },
    [patch]
  );

  /** Replace draft + baseline with fresh server state. */
  const adopt = useCallback(
    (fresh: UiFunnel) => {
      setSeeded(fresh);
      setFunnel(fresh);
      setBaseline(fresh);
      loaded.setData(fresh);
    },
    [loaded]
  );

  /**
   * "Add step" from the list: after the selected step when there is one,
   * otherwise after the end of the flow (the last step with no way out), so a
   * new step arrives connected instead of as a second entry. Only an empty
   * funnel, or one with no open end, gets a free-standing step.
   */
  function addStep(type: UiStepType) {
    if (!funnel) return;
    const openEnd = [...funnel.steps].reverse().find((s) => !isGenericStep(s, funnel.edges) && !funnel.edges.some((e) => e.fromStepKey === s.key));
    const anchor = selected ?? openEnd ?? null;
    if (anchor) {
      addAfter(anchor.key, type);
      return;
    }
    const last = funnel.steps[funnel.steps.length - 1];
    const step = newStep(type, locale, takenKeys(funnel), { x: last ? last.x + CARD_GAP_X : 40, y: last ? last.y : 64 });
    patch((f) => ({ ...f, steps: [...f.steps, step] }));
    setSelectedKey(step.key);
  }

  /** A generic page (contact, about, policies): a custom step off the map, opened in the page editor. */
  function addGenericPage(preset: GenericPreset, name: string, body: string) {
    if (!funnel) return;
    // Its key is its address (/f/<funnel>/p/<key>): named after what it is.
    const key = uniqueStepKey(preset === "blank" ? "page" : preset, takenKeys(funnel));
    const step = { ...newStep("custom", locale, takenKeys(funnel), { x: 40, y: 64 }), key, name, tree: genericPageTree(preset, name, body) };
    patch((f) => ({ ...f, steps: [...f.steps, step] }));
    openPage(step.key);
  }

  function addAfter(fromKey: string, type: UiStepType) {
    if (!funnel) return;
    const { funnel: next, key } = addStepAfter(funnel, fromKey, type, locale, takenKeys(funnel));
    patch(() => next);
    setSelectedKey(key);
  }

  function insertOnEdge(edgeId: string, type: UiStepType) {
    if (!funnel) return;
    const result = insertStepOnEdge(funnel, edgeId, type, locale, takenKeys(funnel));
    if (!result) return;
    patch(() => result.funnel);
    setSelectedKey(result.key);
  }

  function applyTemplate(id: StarterTemplateId) {
    if (!funnel) return;
    patch((f) => applyStarterPlan(f, starterPlan(id, locale), takenKeys(f)));
    setSelectedKey(null);
  }

  /** A copy of the step, right after it and connected from it; it opens selected, and saves with the funnel like any new step. */
  function copyStep(step: UiStep) {
    if (!funnel) return;
    const result = duplicateStep(funnel, step.key, fmt(listT.copySuffix, { name: step.name }), takenKeys(funnel));
    if (!result) return;
    patch(() => result.funnel);
    setSelectedKey(result.key);
  }

  function deleteStep(step: UiStep) {
    patch((f) => removeStep(f, step.key));
    setSelectedKey((k) => (k === step.key ? null : k));
    setPendingDelete(null);
  }

  /** Jump to a step named by a problem: select it and show it on the flow map. */
  function showStep(key: string) {
    setSelectedKey(key);
    setInspectorCollapsed(false);
    setView("flow");
    // On a phone the step's details are a sheet: raise it, the problem is listed inside.
    if (!wide) setDetailsSheetOpen(true);
  }

  function openPage(key: string) {
    setSelectedKey(key);
    setView("page");
  }

  /** A row of the step list dragged onto another: it takes that one's place. */
  const reorderSteps = useCallback(
    (activeKey: string, overKey: string) => {
      patch((f) => {
        const from = f.steps.findIndex((s) => s.key === activeKey);
        const to = f.steps.findIndex((s) => s.key === overKey);
        return { ...f, steps: arrayMove(f.steps, from, to) };
      });
    },
    [patch]
  );

  async function reloadFromServer(): Promise<UiFunnel | null> {
    const fresh = await loadUiFunnel(workspaceId, funnelId);
    if (fresh) adopt(fresh);
    return fresh;
  }

  async function save(): Promise<UiFunnel | null> {
    if (!funnel || !baseline) return null;
    if (!dirty) return funnel;
    setSaving(true);
    setSaveError(null);
    try {
      await saveFunnelDiff(workspaceId, baseline, funnel, setProgress);
    } catch (err) {
      const message = describeError(err);
      setSaveError(fmt(t.saveFailed, { message }));
      toast.error(message);
      setSaving(false);
      setProgress(null);
      return null;
    }
    try {
      const fresh = await reloadFromServer();
      toast.success(t.toastSaved);
      return fresh;
    } catch (err) {
      toast.error(describeError(err));
      return null;
    } finally {
      setSaving(false);
      setProgress(null);
    }
  }

  async function publish() {
    if (!funnel) return;
    setServerProblems([]);
    if (collectFunnelProblems(funnel, locale).length > 0) {
      setShowProblems(true);
      toast.error(t.toastFixProblems);
      return;
    }
    const saved = await save();
    if (!saved) return;
    setStatusBusy(true);
    try {
      await funnelsPublish(apiClient, workspaceId, saved.id);
      await reloadFromServer();
      setHistoryVersion((n) => n + 1);
      toast.success(t.toastPublished);
    } catch (err) {
      const found = funnelsProblemsOf(err);
      if (found.length > 0) {
        setServerProblems(found);
        setShowProblems(true);
        toast.error(t.toastFixProblems);
      } else {
        toast.error(describeError(err));
      }
    } finally {
      setStatusBusy(false);
    }
  }

  async function setStatus(status: "paused" | "published") {
    if (!funnel) return;
    setStatusBusy(true);
    try {
      const next = status === "paused" ? await funnelsPause(apiClient, workspaceId, funnel.id) : await funnelsResume(apiClient, workspaceId, funnel.id);
      setFunnel((f) => (f ? { ...f, status: next.status } : f));
      setBaseline((b) => (b ? { ...b, status: next.status } : b));
      toast.success(status === "paused" ? t.toastPaused : t.toastResumed);
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setStatusBusy(false);
    }
  }

  function preview() {
    if (publicUrl) window.open(publicUrl, "_blank", "noopener");
  }


  /**
   * A press on a card of the map. On a wide screen it selects (the details
   * pane follows the selection). On a phone a first tap only selects; a second
   * tap on the same card raises its details.
   */
  function pressStep(key: string) {
    if (!wide && key === selectedKey) {
      setDetailsSheetOpen(true);
      return;
    }
    setDetailsSheetOpen(false);
    selectStep(key);
  }

  /** A card was double-clicked: its page on a wide screen; on a phone its details («تعديل الصفحة» is inside). */
  function openFromMap(key: string) {
    if (wide) {
      openPage(key);
      return;
    }
    selectStep(key);
    setDetailsSheetOpen(true);
  }

  /** Leave for another screen of the app: at once when everything is saved, after asking otherwise. */
  function requestLeave(to: string) {
    if (dirty) setPendingLeave(to);
    else navigate(to);
  }

  async function saveAndLeave() {
    const to = pendingLeave;
    const saved = await save();
    setPendingLeave(null);
    // A failed save stays on the page: the strip under the bar says what happened.
    if (saved && to) navigate(to);
  }

  // The editor's keys. Ctrl/⌘+S saves (when there is something to save), even from inside a field.
  // Escape lets go of the selected step, which closes its details pane — unless a field, a sheet,
  // a menu or a dialog has the key. Undo / redo belong to the step's page editor, which has its own.
  const keys = useRef<{ save: () => void; escape: () => boolean }>({ save: () => undefined, escape: () => false });
  useEffect(() => {
    keys.current = {
      save: () => {
        if (dirty && !saving && !statusBusy) void save();
      },
      escape: () => {
        if (view !== "flow" || selectedKey === null) return false;
        setSelectedKey(null);
        return true;
      },
    };
  });
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if ((event.ctrlKey || event.metaKey) && !event.altKey) {
        const key = event.key.toLowerCase();
        // The physical key when the layout types no Latin letter: on an Arabic keyboard S is «س».
        const isSave = /^[a-z]$/.test(key) ? key === "s" : event.code === "KeyS";
        if (isSave) {
          event.preventDefault();
          keys.current.save();
        }
        return;
      }
      if (event.key !== "Escape" || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.matches("input, textarea, select"))) return;
      if (document.querySelector(OVERLAY_OPEN) !== null) return;
      if (keys.current.escape()) event.preventDefault();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // The page view edits the selected step, or the first one when none is selected.
  const pageStep = selected ?? funnel?.steps[0] ?? null;
  const pageOffer = pageStep?.offerId ? offerIndex.get(pageStep.offerId) : undefined;

  // Not there (yet): the editor's own shape while it loads; afterwards what happened and the way back.
  if (!funnel) {
    if (loaded.loading) return <EditorSkeleton label={t.loadingEditor} />;
    return (
      <div data-slot="editor" data-editor="funnel" className="flex size-full flex-col">
        <header
          data-slot="editor-toolbar"
          data-editor="funnel"
          className="relative z-10 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-paper-raised px-1.5 md:px-3"
        >
          <Link to="/funnels" aria-label={t.backToFunnels} title={t.backToFunnels} className={TOOL_BUTTON}>
            <IconArrowLeft className="size-5 rtl:-scale-x-100" aria-hidden />
          </Link>
          <h1 className="min-w-0 truncate font-display text-[15px] font-semibold text-ink">{t.funnelWord}</h1>
        </header>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-4">
          <div className="w-full max-w-md">
            {loaded.error ? (
              // A 403 reads as "not part of your role" with who can grant it; anything else offers a retry.
              <DataState loading={false} error={loaded.error} onRetry={() => loaded.refresh()}>
                {null}
              </DataState>
            ) : (
              <EmptyState
                icon={<IconFunnels />}
                title={t.notFound}
                description={t.notFoundBody}
                action={
                  <Button type="button" className="rounded-full px-5" onClick={() => navigate("/funnels")}>
                    {t.backToFunnels}
                  </Button>
                }
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  const inFlow = view === "flow";
  // The details pane (wide) or sheet (phone) shows the selected step; it is the same StepInspector in both.
  const inspector = selected ? (
    <StepInspector
      key={selected.key}
      funnel={funnel}
      step={selected}
      problems={grouped.byStep.get(selected.key) ?? []}
      catalog={catalog.data}
      catalogLoading={catalog.loading}
      catalogError={catalog.error}
      onChange={(changes) => updateStep(selected.key, changes)}
      onEdgesChange={(edges) => patch((f) => ({ ...f, edges }))}
      onEditPage={() => {
        setDetailsSheetOpen(false);
        openPage(selected.key);
      }}
      onAddNext={(type) => addAfter(selected.key, type)}
      onDelete={() => setPendingDelete(selected)}
      onClose={() => {
        setDetailsSheetOpen(false);
        setSelectedKey(null);
      }}
    />
  ) : null;
  // The steps pane (wide) or sheet (phone). In the sheet a choice also puts the sheet away.
  const stepsPane = (inSheet: boolean) => (
    <StepsPane
      funnel={funnel}
      selectedKey={selectedKey}
      problemsByStep={grouped.byStep}
      collapsed={false}
      onCollapse={() => (inSheet ? setStepsSheetOpen(false) : setStepsCollapsed(true))}
      onAddStep={(type) => {
        addStep(type);
        if (inSheet) setStepsSheetOpen(false);
      }}
      onSelectStep={(key) => {
        selectStep(key);
        if (inSheet) setStepsSheetOpen(false);
      }}
      onDeleteStep={setPendingDelete}
      onDuplicateStep={copyStep}
      onReorder={reorderSteps}
      onAddGenericPage={(preset, name, body) => {
        addGenericPage(preset, name, body);
        if (inSheet) setStepsSheetOpen(false);
      }}
      onOpenPage={(key) => {
        if (inSheet) setStepsSheetOpen(false);
        openPage(key);
      }}
    />
  );

  return (
    // A full-viewport page (mounted in EditorLayout, not DashboardLayout — see App.tsx): a column of
    // the bar, the strips that come and go under it, the zones, and on a phone the bottom bar. Nothing
    // here scrolls the page; the map and each pane scroll inside their own box.
    // (`size-full`, not `h-full`: index.css keeps an old rule keyed on `.flex.h-full.flex-col > …:first-child`.)
    <div data-slot="editor" data-editor="funnel" className="flex size-full flex-col overflow-hidden">
      <EditorHeader
        workspaceId={workspaceId}
        funnelId={funnelId}
        funnel={funnel}
        draftAt={draft.offered ? draft.offered.at : null}
        onLoadDraft={() => {
          setFunnel(draft.offered!.ui);
          draft.dismiss();
        }}
        onDiscardDraft={draft.discard}
        editingName={editingName}
        onEditingNameChange={setEditingName}
        onRename={(name) => patch((f) => ({ ...f, name }))}
        dirty={dirty}
        saving={saving}
        statusBusy={statusBusy}
        progress={progress}
        saveError={saveError}
        publicUrl={publicUrl}
        onPreview={preview}
        onLinkChange={(subdomain) => {
          // Saved straight to the server (not part of the map's Save), so the baseline moves with it.
          setFunnel((f) => (f ? { ...f, subdomain } : f));
          setBaseline((b) => (b ? { ...b, subdomain } : b));
        }}
        onSave={() => void save()}
        onPublish={() => void publish()}
        onSetStatus={(status) => void setStatus(status)}
        onReloadAfterError={() => {
          setSaveError(null);
          void reloadFromServer().catch((err) => toast.error(describeError(err)));
        }}
        view={view}
        onViewChange={(v) => (v === "page" ? openPage(selectedKey ?? funnel.steps[0]?.key ?? "") : setView("flow"))}
        problems={allProblems}
        grouped={grouped}
        problemsFromServer={serverProblems.length > 0}
        showProblems={showProblems}
        onShowProblemsChange={setShowProblems}
        onShowStep={showStep}
        historyVersion={historyVersion}
        onRolledBack={() => {
          void reloadFromServer().catch((err) => toast.error(describeError(err)));
        }}
        pageStepName={!inFlow && pageStep ? pageStep.name : null}
        panels={
          wide
            ? {
                start: !stepsCollapsed,
                onStart: () => setStepsCollapsed(!stepsCollapsed),
                end: !inspectorCollapsed,
                onEnd: () => setInspectorCollapsed(!inspectorCollapsed),
              }
            : null
        }
        onNavigate={requestLeave}
      />

      {/* One step's page: the page editor takes the map's place under the same bar. */}
      {!inFlow &&
        (pageStep ? (
          <FunnelStepPageEditor
            workspaceId={workspaceId}
            steps={funnel.steps}
            step={pageStep}
            offerProduct={pageOffer ? { id: pageOffer.productId, name: pageOffer.productName } : null}
            onSelectStep={setSelectedKey}
            onTreeChange={(tree: PageTree) => updateStep(pageStep.key, { tree })}
            onSeoChange={(seo) => updateStep(pageStep.key, { seo })}
            onBack={() => setView("flow")}
            funnelId={funnelId}
            details={{
              // The API takes a step's key only when the step is created: a saved page keeps its address.
              generic: pageStep.id === null && isGenericStep(pageStep, funnel.edges),
              // The step may go back to the key it is saved under.
              taken: takenKeys(funnel).filter((k) => k !== baseline?.steps.find((s) => s.id && s.id === pageStep.id)?.key),
              pathOf: (key) => genericPagePath(funnel, key),
              onApply: ({ name, key }) => {
                updateStep(pageStep.key, { name, key });
                if (key !== pageStep.key) setSelectedKey(key);
              },
            }}
          />
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center p-6">
            <p className="max-w-sm rounded-[1.5rem] bg-paper-raised px-6 py-8 text-center text-sm leading-6 text-ink-soft ring-1 ring-line">
              {PAGE_STRINGS[locale].noSteps}
            </p>
          </div>
        ))}

      {/* The map, with the steps on the start side and the selected step's details on the end side. */}
      {inFlow && (
        <div className="flex min-h-0 flex-1">
          {wide &&
            (stepsCollapsed ? (
              <div
                data-slot="editor-panel"
                data-side="start"
                data-rail=""
                className="flex w-12 shrink-0 flex-col items-center border-e border-line bg-paper-raised py-2"
              >
                <button type="button" aria-label={t.showStepsPanel} title={t.showStepsPanel} onClick={() => setStepsCollapsed(false)} className={TOOL_BUTTON}>
                  <IconSections className="size-5" aria-hidden />
                </button>
              </div>
            ) : (
              <div data-slot="editor-panel" data-side="start" className={cn("w-64 border-e", PANE, PANE_FILL)}>
                {stepsPane(false)}
              </div>
            ))}

          {/* The map fills what is left and scrolls inside its own box, whatever height it asks for. */}
          <div data-slot="funnel-stage" className="flex min-h-0 min-w-0 flex-1 flex-col *:min-h-0! *:flex-1">
            <FlowCanvas
              funnel={{ ...funnel, steps: flowSteps(funnel.steps, funnel.edges) }}
              entryKey={entryKeys.length === 1 ? entryKeys[0] : null}
              selectedKey={selectedKey}
              problemsByStep={grouped.byStep}
              offerIndex={offerIndex}
              catalogLoaded={catalog.data !== null}
              onSelect={pressStep}
              onMove={(key, x, y) => updateStep(key, { x, y })}
              onAddAfter={addAfter}
              onInsert={insertOnEdge}
              onOpenPage={openFromMap}
              onTidy={() => patch(tidyFunnel)}
              onApplyTemplate={applyTemplate}
              onLink={(fromKey, toKey, point) => patch((f) => linkPoint(f, fromKey, toKey, point))}
              onLinkNew={(fromKey, point, type) => {
                const { funnel: next, key } = addStepAfter(funnel, fromKey, type, locale, takenKeys(funnel));
                // addStepAfter's own path out is replaced by the point's.
                patch(() => linkPoint({ ...next, edges: next.edges.slice(0, -1) }, fromKey, key, point));
                setSelectedKey(key);
              }}
            />
          </div>

          {wide && inspector && !inspectorCollapsed && (
            <aside
              data-slot="editor-panel"
              data-side="end"
              aria-label={t.detailsPanel}
              className={cn(
                "w-80 border-s [--pane-x:1rem] rtl:[--pane-x:-1rem]",
                "animate-[funnel-pane-in_var(--dur-move)_var(--ease-spring)_both] motion-reduce:animate-none",
                PANE
              )}
            >
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{inspector}</div>
            </aside>
          )}
        </div>
      )}

      {inFlow && !wide && (
        <EditorDock
          onSteps={() => setStepsSheetOpen(true)}
          onAdd={() => setAddSheetOpen(true)}
          details={selected ? { label: selected.name, onOpen: () => setDetailsSheetOpen(true) } : null}
        />
      )}

      {/* Below lg the side panes are sheets (the shared Sheet: a bottom sheet on a phone, a centred pane from 640px). */}
      {!wide && (
        <>
          <SheetFrame open={inFlow && stepsSheetOpen} onOpenChange={setStepsSheetOpen} size="md">
            <SheetHeader title={t.steps} />
            <SheetBody className={cn("p-0", PANE_BARE)}>{stepsPane(true)}</SheetBody>
          </SheetFrame>

          <Sheet open={inFlow && addSheetOpen} onOpenChange={setAddSheetOpen} title={t.addSheetTitle} description={t.addSheetHint} size="sm">
            <ul data-slot="funnel-add-list" className="-mx-2 space-y-1">
              {STEP_TYPE_ORDER.map((type) => (
                <li key={type}>
                  <button
                    type="button"
                    onClick={() => {
                      addStep(type);
                      setAddSheetOpen(false);
                    }}
                    className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-[0.875rem] px-2 text-start text-[15px] font-medium text-ink transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none"
                  >
                    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", STEP_TONE[type])}>
                      <StepIcon type={type} className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{STEP_TYPE_LABELS[locale][type]}</span>
                    <IconPlus className="size-4 shrink-0 text-ink-soft" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </Sheet>

          <SheetFrame open={inFlow && detailsSheetOpen && selected !== null} onOpenChange={setDetailsSheetOpen} side="bottom" size="md">
            <SheetHeader title={<span dir="auto">{selected?.name ?? t.detailsPanel}</span>} description={selected ? STEP_TYPE_LABELS[locale][selected.type] : undefined} />
            <SheetBody className="p-0">{inspector}</SheetBody>
          </SheetFrame>
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t.deleteStepTitle}
        description={pendingDelete ? fmt(t.deleteStepDescription, { name: pendingDelete.name }) : undefined}
        confirmLabel={t.deleteStep}
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          // Its details go with it: the next step picked starts with the sheet down.
          if (pendingDelete.key === selectedKey) setDetailsSheetOpen(false);
          deleteStep(pendingDelete);
        }}
      />

      {/* Leaving with unsaved work asks once: save and go, go without saving, or stay. */}
      <ConfirmDialog
        open={pendingLeave !== null}
        title={t.leaveTitle}
        description={t.leaveBody}
        confirmLabel={t.leaveConfirm}
        cancelLabel={t.leaveStay}
        destructive
        onCancel={() => setPendingLeave(null)}
        onConfirm={() => {
          const to = pendingLeave;
          setPendingLeave(null);
          if (to) navigate(to);
        }}
      >
        <Button type="button" variant="secondary" disabled={saving} onClick={() => void saveAndLeave()} className="zimos-editor-soft h-11 w-full rounded-full">
          {t.leaveSave}
        </Button>
      </ConfirmDialog>
    </div>
  );
}

// ---------------------------------------------------------------- layout --

/** A side pane of the editor: the store editor's panel slot, so glass/editor.css gives it the same material. */
const PANE = "flex shrink-0 flex-col overflow-hidden border-line bg-paper-raised";
/** Whatever a zone draws as its own box takes the box it is given: no width, cap, border or fill of its own. */
const PANE_BARE = "*:max-h-none! *:w-full! *:border-0! *:bg-transparent!";
/** …and in a side pane it also takes the pane’s whole height. */
const PANE_FILL = "*:min-h-0 *:flex-1 " + PANE_BARE;

/**
 * The phone's bottom bar (below lg), in the store editor's dock slot: «الخطوات»
 * (the step list, as a sheet), «ضيف خطوة» (the step types, as a sheet) and the
 * selected step — its name — which raises its details. With nothing selected
 * the third button waits, dimmed.
 */
function EditorDock({
  onSteps,
  onAdd,
  details,
}: {
  onSteps: () => void;
  onAdd: () => void;
  /** The selected step, or null. */
  details: { label: string; onOpen: () => void } | null;
}) {
  const t = useT(EDITOR_STRINGS);
  return (
    <nav
      data-slot="editor-dock"
      aria-label={t.dock}
      className="relative z-10 shrink-0 border-t border-line bg-paper-raised px-3 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto grid max-w-md grid-cols-3 items-stretch gap-2">
        <DockButton icon={IconSections} label={t.dockSteps} onClick={onSteps} />
        <DockButton icon={IconPlus} label={t.dockAdd} onClick={onAdd} lead />
        <DockButton
          icon={IconSliders}
          label={details ? details.label : t.dockDetails}
          hint={details ? t.dockDetails : undefined}
          onClick={details?.onOpen}
          active={details !== null}
        />
      </div>
    </nav>
  );
}

function DockButton({
  icon: Glyph,
  label,
  hint,
  onClick,
  lead = false,
  active = false,
}: {
  icon: IconComponent;
  label: string;
  /** What the button does, when its label is a name (for a screen reader and the tooltip). */
  hint?: string;
  /** Left out: the button is there but waits (nothing is selected). */
  onClick?: () => void;
  /** The middle one: its glyph sits in a tinted bead. */
  lead?: boolean;
  /** It stands for something selected: its glyph is filled. */
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={hint}
      aria-label={hint ? hint + ": " + label : undefined}
      data-lead={lead || undefined}
      data-active={active || undefined}
      className="group flex min-h-12 min-w-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[11px] leading-4 font-medium text-ink-soft transition-[scale,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:text-ink focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 data-[active]:text-ink motion-reduce:transition-none"
    >
      <span className={cn("flex h-7 items-center justify-center rounded-full", lead ? "w-12 bg-primary-soft text-primary-dark dark:text-primary" : "w-7")}>
        <Glyph className="size-[22px]" aria-hidden />
      </span>
      <span className="max-w-full truncate" dir="auto">
        {label}
      </span>
    </button>
  );
}

/**
 * The editor while the funnel is on its way: its own shape — the bar, the
 * steps pane, a few cards on the map, the phone's bottom bar — never a spinner
 * on a white page, and nothing jumps when the funnel arrives.
 */
function EditorSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" data-slot="editor" data-editor="funnel" className="flex size-full flex-col overflow-hidden">
      <span className="sr-only">{label}</span>
      <div aria-hidden data-slot="editor-toolbar" className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-paper-raised px-3">
        <SkeletonBar className="size-9 shrink-0" />
        <SkeletonBar className="h-4 w-32 md:w-44" />
        <SkeletonBar className="hidden h-6 w-24 lg:block" />
        <span className="flex-1" />
        <SkeletonBar className="hidden h-6 w-32 lg:block" />
        <SkeletonBar className="h-9 w-16 md:w-20" />
        <SkeletonBar className="h-9 w-16 md:w-28" />
      </div>
      <div aria-hidden className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-paper-raised px-3 lg:hidden">
        <SkeletonBar className="h-6 w-20" />
        <SkeletonBar className="w-16" />
        <SkeletonBar className="ms-auto h-6 w-28" />
      </div>
      <div aria-hidden className="flex min-h-0 flex-1">
        <div data-slot="editor-panel" data-side="start" className="hidden w-64 shrink-0 flex-col gap-4 border-e border-line bg-paper-raised p-4 lg:flex">
          <SkeletonBar className="w-20" />
          {["w-4/5", "w-3/5", "w-2/3", "w-1/2", "w-3/4"].map((width, i) => (
            <div key={i} className="flex items-center gap-3">
              <SkeletonBar className="size-8 shrink-0" />
              <SkeletonBar className={width} />
            </div>
          ))}
        </div>
        <div data-slot="funnel-stage" className="flex min-w-0 flex-1 items-center gap-8 overflow-hidden bg-paper px-6 lg:gap-12 lg:px-10">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} data-slot="funnel-ghost" className="h-40 w-52 shrink-0 rounded-[1.25rem] bg-paper-raised p-4 shadow-[var(--shadow-card)] ring-1 ring-line">
              <div className="flex items-center gap-2.5">
                <SkeletonBar className="size-8 shrink-0" />
                <SkeletonBar className="w-24" />
              </div>
              <SkeletonBar className="mt-4 h-14 w-full rounded-xl" />
              <SkeletonBar className="mt-3 w-2/3" />
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden data-slot="editor-dock" className="shrink-0 border-t border-line bg-paper-raised px-3 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] lg:hidden">
        <div className="mx-auto grid h-12 max-w-md grid-cols-3 items-center justify-items-center gap-2">
          <SkeletonBar className="h-7 w-12" />
          <SkeletonBar className="h-7 w-12" />
          <SkeletonBar className="h-7 w-12" />
        </div>
      </div>
    </div>
  );
}
