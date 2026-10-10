import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  CircleCheck,
  CirclePause,
  CreditCard,
  ExternalLink,
  FilePlus2,
  Newspaper,
  FileText,
  FlaskConical,
  Copy,
  GripVertical,
  History,
  LayoutTemplate,
  Megaphone,
  MousePointerClick,
  PartyPopper,
  Pause,
  PencilRuler,
  Play,
  Plus,
  Radio,
  Rocket,
  Save,
  Tag,
  Trash2,
  TriangleAlert,
  UserPlus,
  WandSparkles,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import { Alert, Button, Input, Label, Spinner, cn } from "@store-builder/ui";
import { PaneCollapseToggle, PaneRail } from "@/components/CollapsiblePane";
import { useSessionBool } from "@/lib/useSessionState";
import {
  FUNNEL_OFFER_STEP_TYPES,
  funnelsListRevisions,
  funnelsPause,
  funnelsProblemsOf,
  funnelsPublish,
  funnelsResume,
  funnelsRollback,
  type FunnelProblem,
  type FunnelRevisionDto,
  type FunnelStatus,
  type Offer,
  type PageTree,
  type Product,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatDate, formatMoney } from "@/lib/format";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { FunnelDraftBanner, useFunnelDraft } from "./FunnelDraft";
import { FunnelIssuesButton } from "./FunnelIssues";
import { FunnelGrowthButton } from "./FunnelGrowthPanel";
import { FunnelPublicLink, funnelPreviewUrl, useStoreBaseUrl } from "./FunnelPublicLink";
import { Popover } from "@/components/Popover";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { OfferPicker } from "@/components/OfferPicker";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { fmt, useCommon, useLocale, useT, type Locale } from "@/i18n/LocaleContext";
import {
  CARD_GAP_X,
  STARTER_TEMPLATE_IDS,
  loadUiFunnel,
  saveFunnelDiff,
  starterPlan,
  tempId,
  uniqueStepKey,
  useFunnelErrorMessage,
  type SaveProgress,
  type StarterTemplateId,
  type UiEdge,
  type UiEdgeCondition,
  type UiFunnel,
  type UiStep,
  type UiStepType,
} from "./funnelAdapter";
import {
  CANVAS_STRINGS,
  CONDITION_LABELS,
  CONNECTOR_LABELS,
  EDITOR_STRINGS,
  INSPECTOR_STRINGS,
  LIST_STRINGS,
  PAGE_STRINGS,
  STARTER_TEMPLATE_TEXT,
  STATUS_LABELS,
  STATUS_STRINGS,
  STEP_TYPE_LABELS,
} from "./FunnelEditorPage.strings";
import {
  FLOW_CARD_H,
  FLOW_CARD_W,
  addStepAfter,
  applyStarterPlan,
  collectFunnelProblems,
  duplicateStep,
  groupProblems,
  insertStepOnEdge,
  newStep,
  nextCondition,
  removeStep,
  tidyFunnel,
} from "./funnelFlow";
import { pageElementCount } from "./funnelPages";
import { FunnelStepPageEditor } from "./FunnelStepPageEditor";
import { GenericPagesPanel } from "./GenericPagesPanel";
import { flowSteps, genericPageTree, isGenericStep, type GenericPreset } from "./genericPageRules";
import { StepChain } from "./StepChain";
import { StepStatsLine, StepThumbnail, useFlowZoom, useStepStats } from "./FlowMapTools";
import { LinkPoints, linkPoint, linkPointsOf, pointOfEdge, pointY, useLinkLabels, type LinkDrag, type LinkPoint } from "./FlowLinkPoints";

// ------------------------------------------------------------------ meta --

interface StepTypeMeta {
  icon: LucideIcon;
  /** Whether an offer is mandatory (backend OFFER_STEP_TYPES). */
  needsOffer: boolean;
}

export const STEP_TYPES: Record<UiStepType, StepTypeMeta> = {
  landing: { icon: LayoutTemplate, needsOffer: false },
  sales: { icon: Megaphone, needsOffer: false },
  opt_in: { icon: UserPlus, needsOffer: false },
  checkout: { icon: CreditCard, needsOffer: false },
  upsell: { icon: ArrowUpRight, needsOffer: FUNNEL_OFFER_STEP_TYPES.includes("upsell") },
  downsell: { icon: ArrowDownRight, needsOffer: FUNNEL_OFFER_STEP_TYPES.includes("downsell") },
  thank_you: { icon: PartyPopper, needsOffer: false },
  custom: { icon: FilePlus2, needsOffer: false },
  article: { icon: Newspaper, needsOffer: false },
};

const STEP_TYPE_ORDER: UiStepType[] = ["article", "landing", "sales", "opt_in", "checkout", "upsell", "downsell", "thank_you", "custom"];

const CONDITION_ORDER: UiEdgeCondition[] = ["always", "completed_checkout", "accepted_offer", "declined_offer", "clicked_through"];

const STATUS_TONE: Record<FunnelStatus, "neutral" | "success" | "warning"> = {
  draft: "neutral",
  published: "success",
  paused: "warning",
};

const CARD_W = FLOW_CARD_W;
const CARD_H = FLOW_CARD_H;

/** Type chip colours on the flow map: pages in brand blue, checkout amber, offers green/amber, thank-you neutral. */
const STEP_TONE: Record<UiStepType, string> = {
  landing: "bg-primary-soft text-primary-dark dark:text-primary",
  sales: "bg-primary-soft text-primary-dark dark:text-primary",
  opt_in: "bg-primary-soft text-primary-dark dark:text-primary",
  custom: "bg-primary-soft text-primary-dark dark:text-primary",
  checkout: "bg-accent-soft text-accent-dark",
  upsell: "bg-success-soft text-success",
  downsell: "bg-accent-soft text-accent-dark",
  thank_you: "bg-paper text-ink-soft ring-1 ring-line",
  article: "bg-primary-soft text-primary-dark dark:text-primary",
};

/**
 * Connector look per condition. "Yes" (accepted) is a solid green line, "no"
 * (declined) a dashed red one, checkout-completed brand blue, "always" grey —
 * so the two answers out of an offer step never look alike.
 */
const EDGE_TONE: Record<UiEdgeCondition, { stroke: string; dash?: string; pill: string; icon: LucideIcon | null }> = {
  always: { stroke: "var(--color-ink-soft)", pill: "border-line bg-paper-raised text-ink-soft", icon: null },
  completed_checkout: { stroke: "var(--color-primary)", pill: "border-primary/40 bg-primary-soft text-primary-dark dark:text-primary", icon: CreditCard },
  accepted_offer: { stroke: "var(--color-success)", pill: "border-success/40 bg-success-soft text-success", icon: Check },
  declined_offer: { stroke: "var(--color-danger)", dash: "6 5", pill: "border-danger/40 bg-danger-soft text-danger", icon: X },
  // One button's own path (a link point on the card).
  clicked_through: { stroke: "var(--color-ink)", pill: "border-line-strong bg-paper-raised text-ink", icon: MousePointerClick },
};

function StepIcon({ type, className }: { type: UiStepType; className?: string }) {
  const Glyph = STEP_TYPES[type].icon;
  return <Glyph className={className} aria-hidden />;
}

/** Entry = the only step with no incoming edge (backend resolveEntry). */
function entryKeysOf(funnel: UiFunnel): string[] {
  const targeted = new Set(funnel.edges.map((e) => e.toStepKey));
  // Generic pages (genericPageRules.ts) are off the path: never the start.
  return flowSteps(funnel.steps, funnel.edges).filter((s) => !targeted.has(s.key)).map((s) => s.key);
}

// ------------------------------------------------------------ validation --

/**
 * Pre-check mirroring backend funnelGraph.validateGraph (with the publish-time
 * content check). The step-keyed version lives in funnelFlow.collectFunnelProblems
 * so problems can sit next to their step; server problems are authoritative on publish.
 */
export function validateFunnel(funnel: UiFunnel, locale: Locale = "en"): string[] {
  return collectFunnelProblems(funnel, locale).map((p) => p.message);
}

/** Server and client problems, one entry per distinct message. */
function mergeProblems(a: FunnelProblem[], b: FunnelProblem[]): FunnelProblem[] {
  const seen = new Set(a.map((p) => p.message));
  return [...a, ...b.filter((p) => !seen.has(p.message))];
}

// ---------------------------------------------------------- offer catalog --

interface CatalogEntry {
  product: Product;
  /** Active offers only — the backend rejects inactive ones. */
  offers: Offer[];
}

async function loadOfferCatalog(workspaceId: string): Promise<CatalogEntry[]> {
  const products: Product[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 10; page++) {
    const res = await apiClient.listProducts(workspaceId, { limit: 100, cursor });
    products.push(...res.products);
    if (!res.nextCursor) break;
    cursor = res.nextCursor;
  }
  const out: CatalogEntry[] = [];
  for (const product of products) {
    const offers = product.offers ?? (await apiClient.listOffers(workspaceId, product.id));
    out.push({ product, offers: offers.filter((o) => o.status === "active") });
  }
  return out;
}

/** What the flow map shows for a step's offer: the offer's name and the product it sells. */
interface OfferInfo {
  offerName: string;
  productId: string;
  productName: string;
}

function indexOffers(catalog: CatalogEntry[] | null): Map<string, OfferInfo> {
  const index = new Map<string, OfferInfo>();
  for (const entry of catalog ?? []) {
    for (const o of entry.offers) index.set(o.id, { offerName: o.name, productId: entry.product.id, productName: entry.product.name });
  }
  return index;
}

// ----------------------------------------------------------------- page --

export function FunnelEditorPage() {
  const { funnelId = "" } = useParams();
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const toast = useToast();
  const t = useT(EDITOR_STRINGS);
  const listT = useT(LIST_STRINGS);
  const c = useCommon();
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

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const selected = funnel?.steps.find((s) => s.key === selectedKey) ?? null;
  const entryKeys = useMemo(() => (funnel ? entryKeysOf(funnel) : []), [funnel]);
  const storeBase = useStoreBaseUrl();
  // Preview opens the live funnel, so only once it is published.
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

  /** A copy of the step, right after it; it opens selected, and saves with the funnel like any new step. */
  function copyStep(step: UiStep) {
    if (!funnel) return;
    const result = duplicateStep(funnel, step.key, fmt(listT.copyName, { name: step.name }), takenKeys(funnel));
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
    setView("flow");
  }

  function openPage(key: string) {
    setSelectedKey(key);
    setView("page");
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onSortEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      patch((f) => {
        const from = f.steps.findIndex((s) => s.key === active.id);
        const to = f.steps.findIndex((s) => s.key === over.id);
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

  const busy = saving || statusBusy;
  // The page view edits the selected step, or the first one when none is selected.
  const pageStep = selected ?? funnel?.steps[0] ?? null;
  const pageOffer = pageStep?.offerId ? offerIndex.get(pageStep.offerId) : undefined;

  return (
    // A full-viewport page (mounted in EditorLayout, not DashboardLayout — see
    // App.tsx), so this is the page's only chrome apart from the access banner.
    <div className="flex h-full flex-col">
      <div className="border-b border-line bg-paper-raised px-4 py-3 md:px-6">
        <DataState loading={loaded.loading} error={loaded.error} empty={!loaded.loading && !loaded.data} emptyMessage={t.notFound} onRetry={() => loaded.refresh()}>
          {funnel && (
            <>
              {draft.offered && (
                <FunnelDraftBanner
                  at={draft.offered.at}
                  onLoad={() => {
                    setFunnel(draft.offered!.ui);
                    draft.dismiss();
                  }}
                  onDiscard={draft.discard}
                />
              )}
              <Link to="/funnels" className="mb-1 inline-flex items-center gap-1 text-sm text-ink-soft transition-colors hover:text-primary">
                <span aria-hidden className="inline-block rtl:rotate-180">
                  ←
                </span>
                {t.backToFunnels}
              </Link>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {editingName ? (
                    <Input
                      autoFocus
                      dir="auto"
                      maxLength={200}
                      value={funnel.name}
                      onChange={(e) => patch((f) => ({ ...f, name: e.target.value }))}
                      onBlur={() => setEditingName(false)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "Escape") setEditingName(false);
                      }}
                      className="h-9 w-80 max-w-full font-display text-lg"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingName(true)}
                      title={t.clickToRename}
                      dir="auto"
                      className="cursor-pointer truncate rounded px-1 font-display text-xl font-semibold text-ink hover:bg-paper"
                    >
                      {funnel.name}
                    </button>
                  )}
                  <StatusBadge value={funnel.status} text={STATUS_LABELS[locale][funnel.status]} tone={STATUS_TONE[funnel.status]} />
                  {funnel.publishedRevisionNumber !== null && (
                    <span className="text-xs text-ink-soft">{fmt(t.publishedRevision, { n: funnel.publishedRevisionNumber })}</span>
                  )}
                  {dirty && <span className="text-xs text-ink-soft">{t.unsavedChanges}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {publicUrl && (
                    <Button variant="outline" onClick={preview}>
                      <ExternalLink className="size-4 rtl:-scale-x-100" aria-hidden /> {t.preview}
                    </Button>
                  )}
                  <Button onClick={() => void save()} disabled={!dirty || busy}>
                    {saving ? <Spinner className="size-4" /> : <Save className="size-4" aria-hidden />}
                    {saving ? (progress && progress.total > 0 ? fmt(t.savingProgress, { done: progress.done, total: progress.total }) : c.saving) : c.save}
                  </Button>
                  <Button variant="outline" onClick={() => void publish()} disabled={busy}>
                    {statusBusy ? <Spinner className="size-4" /> : <Rocket className="size-4" aria-hidden />}
                    {funnel.status === "draft" ? t.publish : t.republish}
                  </Button>
                </div>
              </div>
              <FunnelPublicLink funnel={funnel} className="mt-1 px-1" />
              {/* Tools on their own, quieter row: how you look at the funnel and what is wrong
                  with it at the start, the less frequent actions at the end. */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div role="group" aria-label={t.views} className="inline-flex rounded-xl border border-line bg-paper p-0.5">
                    {(["flow", "page"] as const).map((v) => {
                      const Glyph = v === "flow" ? Workflow : PencilRuler;
                      return (
                        <button
                          key={v}
                          type="button"
                          aria-pressed={view === v}
                          onClick={() => (v === "page" ? openPage(selectedKey ?? funnel.steps[0]?.key ?? "") : setView("flow"))}
                          className={cn(
                            "inline-flex cursor-pointer items-center gap-1.5 rounded-[0.55rem] px-2.5 py-1.5 text-sm font-medium transition-colors",
                            view === v ? "bg-paper-raised text-ink shadow-xs" : "text-ink-soft hover:text-ink"
                          )}
                        >
                          <Glyph className="size-4" aria-hidden /> {v === "flow" ? t.viewFlow : t.viewPage}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowProblems((o) => !o)}
                    aria-expanded={showProblems}
                    disabled={allProblems.length === 0}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                      allProblems.length === 0 ? "border-success/30 bg-success-soft text-success" : "cursor-pointer border-danger/30 bg-danger-soft text-danger hover:border-danger/60"
                    )}
                  >
                    {allProblems.length === 0 ? <CircleCheck className="size-3.5" aria-hidden /> : <TriangleAlert className="size-3.5" aria-hidden />}
                    {allProblems.length === 0 ? t.readyToPublish : allProblems.length === 1 ? t.oneToFix : fmt(t.toFix, { n: allProblems.length })}
                  </button>
                  <FunnelIssuesButton
                    funnelId={funnelId}
                    version={Number(!dirty)}
                    stepNames={Object.fromEntries(funnel.steps.map((s) => [s.key, s.name]))}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <FunnelGrowthButton
                    funnelId={funnelId}
                    steps={funnel.steps}
                    onLinkChanged={(subdomain) => {
                      // Saved straight to the server (not part of the map's Save), so the baseline moves with it.
                      setFunnel((f) => (f ? { ...f, subdomain } : f));
                      setBaseline((b) => (b ? { ...b, subdomain } : b));
                    }}
                  />
                  <HistoryMenu
                    workspaceId={workspaceId}
                    funnel={funnel}
                    version={historyVersion}
                    onRolledBack={() => {
                      void reloadFromServer().catch((err) => toast.error(describeError(err)));
                    }}
                  />
                  {funnel.status === "published" ? (
                    <Button variant="outline" onClick={() => void setStatus("paused")} disabled={busy}>
                      <Pause className="size-4" aria-hidden /> {t.pause}
                    </Button>
                  ) : funnel.status === "paused" ? (
                    <Button variant="outline" onClick={() => void setStatus("published")} disabled={busy}>
                      <Play className="size-4" aria-hidden /> {t.resume}
                    </Button>
                  ) : null}
                </div>
              </div>
              {saveError && (
                <Alert variant="danger" className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span>{saveError}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSaveError(null);
                      void reloadFromServer().catch((err) => toast.error(describeError(err)));
                    }}
                  >
                    {t.reload}
                  </Button>
                </Alert>
              )}
              <StatusStrip status={funnel.status} revision={funnel.publishedRevisionNumber} dirty={dirty} />
              {showProblems && allProblems.length > 0 && (
                <div role="alert" className="mt-3 rounded-2xl border border-danger/30 bg-danger-soft/50 px-4 py-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-danger">{t.cantPublish}</p>
                    <button type="button" onClick={() => setShowProblems(false)} aria-label={c.close} className="cursor-pointer rounded p-0.5 text-ink-soft hover:text-ink">
                      <X className="size-4" aria-hidden />
                    </button>
                  </div>
                  {serverProblems.length > 0 && <p className="mt-0.5 text-xs text-ink-soft">{t.serverSaid}</p>}
                  <ul className="mt-2 space-y-2">
                    {funnel.steps
                      .filter((s) => grouped.byStep.has(s.key))
                      .map((s) => (
                        <li key={s.key} className="rounded-xl border border-line bg-paper-raised p-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="inline-flex min-w-0 items-center gap-2 font-medium text-ink">
                              <StepIcon type={s.type} className="size-4 shrink-0 text-ink-soft" />
                              <span className="truncate" dir="auto">
                                {s.name}
                              </span>
                            </span>
                            <Button size="xs" variant="outline" onClick={() => showStep(s.key)}>
                              {t.showStep}
                            </Button>
                          </div>
                          <ul className="mt-1 list-disc space-y-0.5 ps-5 text-danger">
                            {(grouped.byStep.get(s.key) ?? []).map((p, i) => (
                              <li key={i} dir="auto">
                                {p.message}
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    {grouped.general.length > 0 && (
                      <li>
                        <ul className="list-disc space-y-0.5 ps-5 text-danger">
                          {grouped.general.map((p, i) => (
                            <li key={i} dir="auto">
                              {p.message}
                            </li>
                          ))}
                        </ul>
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </>
          )}
        </DataState>
      </div>

      {funnel &&
        view === "page" &&
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
          />
        ) : (
          <p className="px-6 py-10 text-center text-sm text-ink-soft">{PAGE_STRINGS[locale].noSteps}</p>
        ))}

      {funnel && view === "flow" && (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          {/* The rail is a desktop-only stand-in for a collapsed pane — below
              `lg` the pane below always shows in full, same as before. */}
          <PaneRail side="start" expandLabel={t.expandPanel} onExpand={() => setStepsCollapsed(false)} className={stepsCollapsed ? "hidden lg:flex" : "hidden"} />
          <aside
            className={cn(
              "flex max-h-60 w-full shrink-0 flex-col border-b border-line bg-paper-raised",
              stepsCollapsed ? "lg:hidden" : "lg:max-h-none lg:w-64 lg:border-b-0 lg:border-e lg:flex"
            )}
          >
            <div className="hidden lg:block">
              <PaneCollapseToggle side="start" collapseLabel={t.collapsePanel} onCollapse={() => setStepsCollapsed(true)} />
            </div>
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.steps}</span>
              <AddStepMenu onAdd={addStep} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis, restrictToParentElement]} onDragEnd={onSortEnd}>
                <SortableContext items={flowSteps(funnel.steps, funnel.edges).map((s) => s.key)} strategy={verticalListSortingStrategy}>
                  <ul className="space-y-1">
                    {flowSteps(funnel.steps, funnel.edges).map((s) => (
                      <SortableStepRow
                        key={s.key}
                        step={s}
                        selected={s.key === selectedKey}
                        problemCount={grouped.byStep.get(s.key)?.length ?? 0}
                        onSelect={() => selectStep(s.key)}
                        onDuplicate={() => copyStep(s)}
                        onDelete={() => setPendingDelete(s)}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            </div>
            <GenericPagesPanel funnel={funnel} selectedKey={selectedKey} onAdd={addGenericPage} onOpen={openPage} onDelete={setPendingDelete} />
          </aside>

          <FlowCanvas
            funnel={{ ...funnel, steps: flowSteps(funnel.steps, funnel.edges) }}
            entryKey={entryKeys.length === 1 ? entryKeys[0] : null}
            selectedKey={selectedKey}
            problemsByStep={grouped.byStep}
            offerIndex={offerIndex}
            catalogLoaded={catalog.data !== null}
            onSelect={selectStep}
            onMove={(key, x, y) => updateStep(key, { x, y })}
            onAddAfter={addAfter}
            onInsert={insertOnEdge}
            onOpenPage={openPage}
            onTidy={() => patch(tidyFunnel)}
            onApplyTemplate={applyTemplate}
            onLink={(fromKey, toKey, point) => patch((f) => linkPoint(f, fromKey, toKey, point))}
            onLinkNew={(fromKey, point, type) => {
              if (!funnel) return;
              const { funnel: next, key } = addStepAfter(funnel, fromKey, type, locale, takenKeys(funnel));
              // addStepAfter's own path out is replaced by the point's.
              patch(() => linkPoint({ ...next, edges: next.edges.slice(0, -1) }, fromKey, key, point));
              setSelectedKey(key);
            }}
          />

          <aside
            className={cn(
              "w-full shrink-0 border-t border-line bg-paper-raised",
              inspectorCollapsed ? "lg:hidden" : "lg:block lg:w-80 lg:overflow-y-auto lg:border-t-0 lg:border-s"
            )}
          >
            <div className="hidden lg:block">
              <PaneCollapseToggle side="end" collapseLabel={t.collapsePanel} onCollapse={() => setInspectorCollapsed(true)} />
            </div>
            {selected ? (
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
                onEditPage={() => openPage(selected.key)}
                onAddNext={(type) => addAfter(selected.key, type)}
                onDelete={() => setPendingDelete(selected)}
                onClose={() => setSelectedKey(null)}
              />
            ) : (
              <p className="px-4 py-6 text-sm text-ink-soft">{t.selectHint}</p>
            )}
          </aside>
          <PaneRail side="end" expandLabel={t.expandPanel} onExpand={() => setInspectorCollapsed(false)} className={inspectorCollapsed ? "hidden lg:flex" : "hidden"} />
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t.deleteStepTitle}
        description={pendingDelete ? fmt(t.deleteStepDescription, { name: pendingDelete.name }) : undefined}
        confirmLabel={t.deleteStep}
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteStep(pendingDelete)}
      />

      {loaded.error === null && !loaded.loading && !loaded.data && (
        <div className="p-6">
          <Button variant="outline" onClick={() => navigate("/funnels")}>
            {t.backToFunnels}
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- status --

/**
 * One line that says what visitors get right now. Draft/live/paused decide
 * what the public runtime serves (backend loadPublishedSnapshot: paused is a
 * 410 "not available", draft is not found), so each gets its own colour,
 * icon and sentence rather than only the small badge.
 */
function StatusStrip({ status, revision, dirty }: { status: FunnelStatus; revision: number | null; dirty: boolean }) {
  const t = useT(STATUS_STRINGS);
  const look = {
    draft: { icon: FileText, tone: "border-line bg-paper text-ink-soft", title: t.draftTitle, body: t.draftBody },
    published: {
      icon: Radio,
      tone: "border-success/30 bg-success-soft text-success",
      title: revision !== null ? fmt(t.liveTitleRevision, { n: revision }) : t.liveTitle,
      body: t.liveBody,
    },
    paused: { icon: CirclePause, tone: "border-accent/40 bg-accent-soft text-accent-dark", title: t.pausedTitle, body: t.pausedBody },
  }[status];
  const Glyph = look.icon;
  return (
    <div className={cn("mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border px-3 py-2 text-sm", look.tone)}>
      <span className="inline-flex items-center gap-1.5 font-semibold">
        <Glyph className="size-4 shrink-0" aria-hidden /> {look.title}
      </span>
      <span className="text-ink-soft">{look.body}</span>
      {dirty && <span className="ms-auto text-xs font-medium text-ink">{t.unsaved}</span>}
    </div>
  );
}

// --------------------------------------------------------------- history --

function HistoryMenu({ workspaceId, funnel, version, onRolledBack }: { workspaceId: string; funnel: UiFunnel; version: number; onRolledBack: () => void }) {
  const t = useT(EDITOR_STRINGS);
  const c = useCommon();
  const toast = useToast();
  const describeError = useFunnelErrorMessage();
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState<FunnelRevisionDto | null>(null);
  const revisions = useAsync<FunnelRevisionDto[] | null>(
    () => (open ? funnelsListRevisions(apiClient, workspaceId, funnel.id) : Promise.resolve(null)),
    [open, workspaceId, funnel.id, funnel.publishedRevisionId, version]
  );

  async function confirmRollback() {
    if (!target) return;
    try {
      await funnelsRollback(apiClient, workspaceId, funnel.id, target.id);
    } catch (err) {
      // ConfirmDialog shows the thrown message inline.
      throw new Error(describeError(err));
    }
    toast.success(fmt(t.toastRolledBack, { n: target.revisionNumber }));
    setTarget(null);
    setOpen(false);
    onRolledBack();
  }

  return (
    <div ref={anchor} className="relative">
      <Button variant="outline" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <History className="size-4" aria-hidden /> {t.history}
      </Button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchor} closeLabel={c.close} className="w-80">
            <p className="border-b border-line px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.historyTitle}</p>
            <div className="max-h-80 overflow-y-auto p-2">
              <DataState
                loading={revisions.loading}
                error={revisions.error}
                empty={!revisions.loading && (revisions.data?.length ?? 0) === 0}
                emptyMessage={t.historyEmpty}
                onRetry={() => revisions.refresh()}
              >
                <ul className="space-y-1">
                  {(revisions.data ?? []).map((r) => {
                    const live = r.id === funnel.publishedRevisionId;
                    return (
                      <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 hover:bg-paper">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink">
                            {fmt(t.revisionLabel, { n: r.revisionNumber })}
                            {live && <span className="ms-2 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">{t.revisionLive}</span>}
                          </p>
                          <p className="truncate text-xs text-ink-soft">
                            {formatDate(r.createdAt)} · {fmt(t.revisionSteps, { n: r.stepCount })}
                            {r.note ? ` · ${r.note}` : ""}
                          </p>
                        </div>
                        {!live && (
                          <Button size="xs" variant="outline" onClick={() => setTarget(r)}>
                            {t.rollback}
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </DataState>
            </div>
      </Popover>
      <ConfirmDialog
        open={target !== null}
        title={target ? fmt(t.rollbackTitle, { n: target.revisionNumber }) : t.history}
        description={target ? fmt(t.rollbackDescription, { n: target.revisionNumber }) : undefined}
        confirmLabel={t.rollback}
        onCancel={() => setTarget(null)}
        onConfirm={confirmRollback}
      />
    </div>
  );
}

// ------------------------------------------------------------- left pane --

function AddStepMenu({ onAdd }: { onAdd: (type: UiStepType) => void }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const t = useT(LIST_STRINGS);
  const c = useCommon();
  return (
    <div ref={anchor} className="relative">
      <Button size="xs" variant="outline" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Plus className="size-3" aria-hidden /> {t.addStep}
      </Button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchor} closeLabel={c.close} className="w-52">
        <StepTypeList
          onPick={(type) => {
            onAdd(type);
            setOpen(false);
          }}
        />
      </Popover>
    </div>
  );
}

function SortableStepRow({
  step,
  selected,
  problemCount,
  onSelect,
  onDuplicate,
  onDelete,
}: {
  step: UiStep;
  selected: boolean;
  problemCount: number;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const canvasT = useT(CANVAS_STRINGS);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: step.key });
  const t = useT(LIST_STRINGS);
  const { locale } = useLocale();
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "flex items-center gap-1 rounded-xl border bg-paper-raised pe-1 transition-colors",
        selected ? "border-primary ring-1 ring-primary/30" : "border-line hover:border-primary/50",
        isDragging && "z-10 opacity-80 shadow-lg"
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={fmt(t.reorder, { name: step.name })}
        className="cursor-grab rounded p-1.5 text-ink-soft hover:text-ink active:cursor-grabbing"
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1.5 text-start">
        <StepIcon type={step.type} className="size-4 shrink-0 text-primary" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-ink" dir="auto">
            {step.name}
          </span>
          <span className="block text-[11px] text-ink-soft">{STEP_TYPE_LABELS[locale][step.type]}</span>
        </span>
        {problemCount > 0 && (
          <span title={fmt(canvasT.toFix, { n: problemCount })} className="ms-auto inline-flex shrink-0 items-center gap-0.5 rounded-full bg-danger-soft px-1.5 py-0.5 text-[11px] font-medium text-danger">
            <TriangleAlert className="size-3" aria-hidden />
            <bdi>{problemCount}</bdi>
            <span className="sr-only">{fmt(canvasT.toFix, { n: problemCount })}</span>
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={onDuplicate}
        aria-label={fmt(t.duplicateNamed, { name: step.name })}
        title={fmt(t.duplicateNamed, { name: step.name })}
        className="cursor-pointer rounded p-1.5 text-ink-soft hover:bg-primary-soft hover:text-primary"
      >
        <Copy className="size-3.5" aria-hidden />
      </button>
      <button type="button" onClick={onDelete} aria-label={fmt(t.deleteNamed, { name: step.name })} className="cursor-pointer rounded p-1.5 text-ink-soft hover:bg-danger-soft hover:text-danger">
        <Trash2 className="size-3.5" aria-hidden />
      </button>
    </li>
  );
}

// ---------------------------------------------------------------- canvas --

/** The step types as a menu list — shared by "Add step", add-after and insert-between. */
function StepTypeList({ onPick }: { onPick: (type: UiStepType) => void }) {
  const { locale } = useLocale();
  return (
    <ul className="py-1">
      {STEP_TYPE_ORDER.map((type) => (
        <li key={type}>
          <button
            type="button"
            onClick={() => onPick(type)}
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-start text-sm text-ink hover:bg-primary-soft focus-visible:bg-primary-soft focus-visible:outline-none"
          >
            <StepIcon type={type} className="size-4 text-primary" />
            {STEP_TYPE_LABELS[locale][type]}
          </button>
        </li>
      ))}
    </ul>
  );
}

type CanvasMenu =
  | { kind: "after"; key: string; x: number; y: number }
  | { kind: "edge"; id: string; x: number; y: number }
  // A link point dropped on empty map, or "A new step…": the new step it leads to.
  | { kind: "link"; fromKey: string; point: LinkPoint; x: number; y: number };

/** A short sample of each connector style, so "yes" and "no" read without a tooltip. */
function LegendLine({ condition }: { condition: UiEdgeCondition }) {
  const tone = EDGE_TONE[condition];
  return (
    <svg width="22" height="8" aria-hidden className="shrink-0">
      <line x1="1" y1="4" x2="21" y2="4" stroke={tone.stroke} strokeWidth="2" strokeDasharray={tone.dash} />
    </svg>
  );
}

function TemplatePicker({ onApply }: { onApply: (id: StarterTemplateId) => void }) {
  const t = useT(CANVAS_STRINGS);
  const { locale, dir } = useLocale();
  const chains = useMemo(() => new Map(STARTER_TEMPLATE_IDS.map((id) => [id, starterPlan(id, locale).steps.map((s) => s.type)])), [locale]);
  return (
    <div dir={dir} className="mx-auto max-w-3xl px-4 py-10">
      <h2 className="font-display text-lg font-semibold text-ink">{t.emptyTitle}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t.emptyBody}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {STARTER_TEMPLATE_IDS.map((id) => {
          const text = STARTER_TEMPLATE_TEXT[locale][id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => onApply(id)}
              className="cursor-pointer rounded-2xl border border-line bg-paper-raised p-4 text-start transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <p className="text-sm font-semibold text-ink">{text.name}</p>
              <p className="mt-0.5 text-xs text-ink-soft">{text.description}</p>
              <StepChain types={chains.get(id) ?? []} className="mt-3" />
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-ink-soft">{t.orBlank}</p>
    </div>
  );
}

function FlowCanvas({
  funnel,
  entryKey,
  selectedKey,
  problemsByStep,
  offerIndex,
  catalogLoaded,
  onSelect,
  onMove,
  onAddAfter,
  onInsert,
  onOpenPage,
  onTidy,
  onApplyTemplate,
  onLink,
  onLinkNew,
}: {
  funnel: UiFunnel;
  entryKey: string | null;
  selectedKey: string | null;
  problemsByStep: Map<string, FunnelProblem[]>;
  offerIndex: Map<string, OfferInfo>;
  catalogLoaded: boolean;
  onSelect: (key: string) => void;
  onMove: (key: string, x: number, y: number) => void;
  onAddAfter: (fromKey: string, type: UiStepType) => void;
  onInsert: (edgeId: string, type: UiStepType) => void;
  onOpenPage: (key: string) => void;
  onTidy: () => void;
  onApplyTemplate: (id: StarterTemplateId) => void;
  onLink: (fromKey: string, toKey: string, point: LinkPoint) => void;
  onLinkNew: (fromKey: string, point: LinkPoint, type: UiStepType) => void;
}) {
  const drag = useRef<{ key: string; dx: number; dy: number; moved: boolean } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const t = useT(CANVAS_STRINGS);
  const c = useCommon();
  const { locale, dir } = useLocale();
  const [menu, setMenu] = useState<CanvasMenu | null>(null);
  // A point on the map where the step-type menu opens; the menu itself is a
  // Popover, so the zoom transform neither scales nor traps it.
  const menuAnchor = useRef<HTMLSpanElement>(null);
  const [linkDrag, setLinkDrag] = useState<LinkDrag | null>(null);
  const pointLabels = useLinkLabels();

  const byKey = useMemo(() => new Map(funnel.steps.map((s) => [s.key, s])), [funnel.steps]);
  const width = Math.max(900, ...funnel.steps.map((s) => s.x + CARD_W + 120));
  const height = Math.max(520, ...funnel.steps.map((s) => s.y + CARD_H + 120));
  // Zoom, pan and each step's numbers (FlowMapTools).
  const map = useFlowZoom(containerRef, { width, height });
  const stats = useStepStats(funnel.id || null);

  // Connectors between the same two steps (an offer's "yes" and "no" both
  // going to thank-you) fan out, so neither line nor label hides the other.
  const connectors = useMemo(() => {
    const groups = new Map<string, UiEdge[]>();
    for (const e of funnel.edges) {
      const k = `${e.fromStepKey}>${e.toStepKey}`;
      groups.set(k, [...(groups.get(k) ?? []), e]);
    }
    return funnel.edges.flatMap((e) => {
      const from = byKey.get(e.fromStepKey);
      const to = byKey.get(e.toStepKey);
      if (!from || !to) return [];
      const group = groups.get(`${e.fromStepKey}>${e.toStepKey}`) ?? [e];
      const off = (group.indexOf(e) - (group.length - 1) / 2) * 56;
      // From the link point it belongs to, when the card has one for it.
      const points = linkPointsOf(from, pointLabels);
      const at = pointOfEdge(points, e);
      const x1 = from.x + CARD_W;
      const y1 = at >= 0 ? from.y + pointY(at) : from.y + CARD_H / 2;
      const x2 = to.x;
      const y2 = to.y + CARD_H / 2;
      const bend = Math.max(48, Math.abs(x2 - x1) / 2);
      return [
        {
          edge: e,
          from,
          to,
          d: `M ${x1} ${y1} C ${x1 + bend} ${y1 + off}, ${x2 - bend} ${y2 + off}, ${x2} ${y2}`,
          pointLabel: at >= 0 && e.condition === "clicked_through" ? points[at].label : null,
          // Midpoint of the cubic at t = 0.5.
          mx: (x1 + x2) / 2,
          my: (y1 + y2) / 2 + 0.75 * off,
        },
      ];
    });
  }, [funnel.edges, byKey, pointLabels]);

  // A link point let go of: on a card, that step; on the empty map, a new one.
  function dropLink(drag: LinkDrag) {
    const target = funnel.steps.find(
      (s) => s.key !== drag.fromKey && drag.x2 >= s.x && drag.x2 <= s.x + CARD_W && drag.y2 >= s.y && drag.y2 <= s.y + CARD_H
    );
    if (target) onLink(drag.fromKey, target.key, drag.point);
    else setMenu({ kind: "link", fromKey: drag.fromKey, point: drag.point, x: drag.x2, y: drag.y2 });
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>, step: UiStep) {
    if (e.button !== 0) return;
    const { x: px, y: py } = map.toMap(e);
    drag.current = { key: step.key, dx: px - step.x, dy: py - step.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
    onSelect(step.key);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const { x: px, y: py } = map.toMap(e);
    d.moved = true;
    onMove(d.key, Math.max(0, Math.round(px - d.dx)), Math.max(0, Math.round(py - d.dy)));
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (drag.current) e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current = null;
  }

  function pick(type: UiStepType) {
    if (!menu) return;
    if (menu.kind === "after") onAddAfter(menu.key, type);
    else if (menu.kind === "link") onLinkNew(menu.fromKey, menu.point, type);
    else onInsert(menu.id, type);
    setMenu(null);
  }

  return (
    <main aria-label={EDITOR_STRINGS[locale].canvasLabel} className="relative flex min-h-[420px] min-w-0 flex-1 shrink-0 flex-col bg-paper lg:min-h-0 lg:shrink">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-paper-raised px-3 py-2">
        <Button size="xs" variant="outline" onClick={onTidy} disabled={funnel.steps.length < 2} title={t.tidyHint}>
          <WandSparkles className="size-3" aria-hidden /> {t.tidy}
        </Button>
        {map.controls}
        {stats.picker}
        <ul className="ms-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-soft">
          <li className="inline-flex items-center gap-1.5">
            <LegendLine condition="accepted_offer" /> {t.legendYes}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <LegendLine condition="declined_offer" /> {t.legendNo}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <LegendLine condition="completed_checkout" /> {CONDITION_LABELS[locale].completed_checkout}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <LegendLine condition="always" /> {t.legendNext}
          </li>
        </ul>
      </div>

      <div
        ref={containerRef}
        dir="ltr"
        className="relative min-h-0 flex-1 overflow-auto"
        style={{ backgroundImage: "radial-gradient(var(--color-line) 1px, transparent 1px)", backgroundSize: "20px 20px" }}
      >
        {funnel.steps.length === 0 ? (
          <TemplatePicker onApply={onApplyTemplate} />
        ) : (
          <div style={{ width: width * map.zoom, height: height * map.zoom }}>
          <div
            className={cn("relative", map.panning ? "cursor-grabbing" : "cursor-grab")}
            style={{ width, height, transform: `scale(${map.zoom})`, transformOrigin: "0 0" }}
            {...map.panHandlers}
          >
            <svg className="pointer-events-none absolute inset-0" width={width} height={height}>
              <defs>
                {CONDITION_ORDER.map((cond) => (
                  <marker key={cond} id={`funnel-arrow-${cond}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill={EDGE_TONE[cond].stroke} />
                  </marker>
                ))}
              </defs>
              {connectors.map(({ edge: e, d }) => {
                const active = e.fromStepKey === selectedKey || e.toStepKey === selectedKey;
                const tone = EDGE_TONE[e.condition];
                return (
                  <path
                    key={e.id}
                    d={d}
                    fill="none"
                    stroke={tone.stroke}
                    strokeDasharray={tone.dash}
                    strokeOpacity={active ? 1 : 0.7}
                    strokeWidth={active ? 2.5 : 1.75}
                    markerEnd={`url(#funnel-arrow-${e.condition})`}
                  />
                );
              })}
              {linkDrag && (
                <path
                  d={`M ${linkDrag.x1} ${linkDrag.y1} C ${linkDrag.x1 + 60} ${linkDrag.y1}, ${linkDrag.x2 - 60} ${linkDrag.y2}, ${linkDrag.x2} ${linkDrag.y2}`}
                  fill="none"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                />
              )}
            </svg>

            {connectors.map(({ edge: e, from, to, mx, my, pointLabel }) => {
              const tone = EDGE_TONE[e.condition];
              const Glyph = tone.icon;
              const active = e.fromStepKey === selectedKey || e.toStepKey === selectedKey;
              const insertLabel = fmt(t.insertHere, { from: from.name, to: to.name });
              return (
                <div key={`label-${e.id}`} className="absolute z-[1] -translate-x-1/2 -translate-y-1/2" style={{ left: mx, top: my }}>
                  <div dir={dir} className={cn("flex items-center gap-1 rounded-full border py-0.5 ps-2 pe-0.5 text-[11px] font-medium shadow-xs", tone.pill, active && "ring-2 ring-primary/30")}>
                    {Glyph && <Glyph className="size-3 shrink-0" aria-hidden />}
                    <span className="max-w-28 truncate whitespace-nowrap" title={CONDITION_LABELS[locale][e.condition]} dir="auto">
                      {pointLabel ?? CONNECTOR_LABELS[locale][e.condition]}
                    </span>
                    <button
                      type="button"
                      onClick={() => setMenu({ kind: "edge", id: e.id, x: mx - 104, y: my + 14 })}
                      aria-label={insertLabel}
                      title={insertLabel}
                      className="flex size-5 cursor-pointer items-center justify-center rounded-full bg-paper-raised text-ink-soft hover:bg-primary-soft hover:text-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:hover:text-primary"
                    >
                      <Plus className="size-3" aria-hidden />
                    </button>
                  </div>
                </div>
              );
            })}

            {funnel.steps.map((s) => {
              const isSelected = s.key === selectedKey;
              const isEntry = s.key === entryKey;
              const problems = problemsByStep.get(s.key)?.length ?? 0;
              const info = s.offerId ? offerIndex.get(s.offerId) : undefined;
              const showsOffer = STEP_TYPES[s.type].needsOffer || s.offerId !== null;
              const empty = pageElementCount(s.tree) === 0;
              const sectionCount = s.tree.sections.length;
              return (
                <div
                  key={s.key}
                  role="button"
                  tabIndex={0}
                  aria-label={s.name}
                  title={t.openPageHint}
                  onPointerDown={(e) => onPointerDown(e, s)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  onDoubleClick={() => onOpenPage(s.key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onSelect(s.key);
                  }}
                  style={{ left: s.x, top: s.y, width: CARD_W, height: CARD_H }}
                  className={cn(
                    "absolute z-[2] cursor-grab select-none rounded-2xl border bg-paper-raised p-3 shadow-sm transition-shadow active:cursor-grabbing",
                    isSelected ? "border-primary ring-2 ring-primary/30 shadow-md" : problems > 0 ? "border-danger/50 hover:border-danger" : "border-line hover:border-primary/50"
                  )}
                >
                  <div dir={dir} className="flex h-full flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", isSelected ? "bg-primary text-white" : STEP_TONE[s.type])}>
                        <StepIcon type={s.type} className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink" dir="auto">
                          {s.name}
                        </span>
                        <span className="block truncate text-[11px] text-ink-soft">
                          {STEP_TYPE_LABELS[locale][s.type]}
                          {isEntry && ` · ${t.entry}`}
                        </span>
                      </span>
                      {s.experimentId && <FlaskConical className="size-3.5 shrink-0 text-accent-dark" aria-label={t.abRunning} />}
                      {problems > 0 && (
                        <span title={fmt(t.toFix, { n: problems })} className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-danger-soft px-1.5 py-0.5 text-[11px] font-medium text-danger">
                          <TriangleAlert className="size-3" aria-hidden />
                          <bdi>{problems}</bdi>
                          <span className="sr-only">{fmt(t.toFix, { n: problems })}</span>
                        </span>
                      )}
                    </div>
                    {showsOffer && (
                      <p className={cn("flex min-w-0 items-center gap-1.5 text-xs", s.offerId && (info || !catalogLoaded) ? "text-ink-soft" : "text-danger")}>
                        <Tag className="size-3.5 shrink-0" aria-hidden />
                        <span className="truncate" dir="auto">
                          {!s.offerId ? t.noOffer : info ? fmt(t.offerOf, { offer: info.offerName, product: info.productName }) : catalogLoaded ? t.offerUnknown : "…"}
                        </span>
                      </p>
                    )}
                    {empty ? (
                      <p className="flex items-center gap-1.5 text-xs text-danger">
                        <FileText className="size-3.5 shrink-0" aria-hidden />
                        {t.emptyPage}
                      </p>
                    ) : (
                      <div title={sectionCount === 1 ? t.oneSection : fmt(t.sections, { n: sectionCount })}>
                        <StepThumbnail tree={s.tree} />
                      </div>
                    )}
                    <div className="mt-auto">
                      <StepStatsLine stats={stats.byKey.get(s.key)} />
                    </div>
                  </div>
                </div>
              );
            })}

            {funnel.steps.map((s) => {
              const label = fmt(t.addAfter, { name: s.name });
              return (
                <button
                  key={`add-${s.key}`}
                  type="button"
                  onClick={() => setMenu({ kind: "after", key: s.key, x: s.x + CARD_W + 16, y: s.y + CARD_H - 32 })}
                  aria-label={label}
                  title={label}
                  style={{ left: s.x + CARD_W - 11, top: s.y + CARD_H - 30 }}
                  className="absolute z-[3] flex size-[22px] cursor-pointer items-center justify-center rounded-full border border-line bg-paper-raised text-ink-soft shadow-xs hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <Plus className="size-3.5" aria-hidden />
                </button>
              );
            })}

            {funnel.steps.map((s) => (
              <LinkPoints
                key={`points-${s.key}`}
                step={s}
                steps={funnel.steps}
                edges={funnel.edges}
                cardWidth={CARD_W}
                toMap={map.toMap}
                onDrag={setLinkDrag}
                onDrop={dropLink}
                onPick={(point, toKey) =>
                  toKey ? onLink(s.key, toKey, point) : setMenu({ kind: "link", fromKey: s.key, point, x: s.x + CARD_W + 24, y: s.y + 40 })
                }
              />
            ))}

            {menu && (
              <span
                ref={menuAnchor}
                aria-hidden
                data-testid="canvas-menu-anchor"
                className="pointer-events-none absolute size-px"
                style={{ left: Math.max(4, menu.x), top: menu.y }}
              />
            )}
            <Popover
              key={menu ? `${menu.x},${menu.y}` : "closed"}
              open={menu !== null}
              onClose={() => setMenu(null)}
              anchorRef={menuAnchor}
              closeLabel={c.close}
              align="start"
              className="w-52"
            >
              <div dir={dir}>
                <p className="border-b border-line px-3 py-2 text-xs font-semibold text-ink-soft">{t.pickType}</p>
                <StepTypeList onPick={pick} />
              </div>
            </Popover>
          </div>
          </div>
        )}
      </div>
    </main>
  );
}

// ------------------------------------------------------------- inspector --

function StepInspector({
  funnel,
  step,
  problems,
  catalog,
  catalogLoading,
  catalogError,
  onChange,
  onEdgesChange,
  onEditPage,
  onAddNext,
  onDelete,
  onClose,
}: {
  funnel: UiFunnel;
  step: UiStep;
  /** What stops this step from publishing, client pre-check and last server answer merged. */
  problems: FunnelProblem[];
  catalog: CatalogEntry[] | null;
  catalogLoading: boolean;
  catalogError: unknown;
  onChange: (changes: Partial<UiStep>) => void;
  onEdgesChange: (edges: UiEdge[]) => void;
  onEditPage: () => void;
  onAddNext: (type: UiStepType) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const t = useT(INSPECTOR_STRINGS);
  const workspaceId = useWorkspaceId();
  const canvasT = useT(CANVAS_STRINGS);
  const c = useCommon();
  const { locale } = useLocale();
  const [addingNext, setAddingNext] = useState(false);
  const sectionCount = step.tree.sections.length;
  const emptyPage = pageElementCount(step.tree) === 0;
  const needsOffer = STEP_TYPES[step.type].needsOffer;
  const outgoing = funnel.edges.filter((e) => e.fromStepKey === step.key).sort((a, b) => b.priority - a.priority);
  const others = funnel.steps.filter((s) => s.key !== step.key);

  const entries = catalog ?? [];
  const owner = step.offerId ? entries.find((e) => e.offers.some((o) => o.id === step.offerId)) ?? null : null;
  const [productId, setProductId] = useState<string>(owner?.product.id ?? "");
  const chosen = entries.find((e) => e.product.id === (owner?.product.id ?? productId)) ?? null;
  const currentOffer = owner?.offers.find((o) => o.id === step.offerId) ?? null;

  function pickProduct(id: string) {
    setProductId(id);
    if (step.offerId && owner?.product.id !== id) onChange({ offerId: null });
  }

  function updateEdge(id: string, changes: Partial<UiEdge>) {
    onEdgesChange(funnel.edges.map((e) => (e.id === id ? { ...e, ...changes } : e)));
  }

  function addEdge() {
    const target = others[0];
    if (!target) return;
    onEdgesChange([...funnel.edges, { id: tempId(), serverId: null, fromStepKey: step.key, toStepKey: target.key, condition: nextCondition(step, funnel.edges), priority: 0 }]);
  }

  function removeEdge(id: string) {
    onEdgesChange(funnel.edges.filter((e) => e.id !== id));
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <StepIcon type={step.type} className="size-4 text-primary" />
          <span className="text-sm font-semibold text-ink">{t.stepSettings}</span>
        </div>
        <button type="button" onClick={onClose} aria-label={t.closeInspector} title={c.close} className="cursor-pointer rounded p-1 text-ink-soft hover:text-ink">
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="space-y-5 px-4 py-4">
        {problems.length > 0 && (
          <div role="alert" className="rounded-2xl border border-danger/30 bg-danger-soft p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-danger">
              <TriangleAlert className="size-3.5" aria-hidden /> {t.problems}
            </p>
            <ul className="mt-1 list-disc space-y-0.5 ps-5 text-xs text-danger">
              {problems.map((p, i) => (
                <li key={i} dir="auto">
                  {p.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="step-name">{t.name}</Label>
          <Input id="step-name" dir="auto" maxLength={200} value={step.name} onChange={(e) => onChange({ name: e.target.value })} />
          <p className="text-xs text-ink-soft">
            {t.key}: <bdi dir="ltr">{step.key}</bdi>
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="step-type">{t.type}</Label>
          <Select
            id="step-type"
            value={step.type}
            onChange={(e) => {
              const type = e.target.value as UiStepType;
              // Only a checkout step has a form to offer a bump on.
              onChange(type === "checkout" ? { type } : { type, bumpOfferId: null });
            }}
          >
            {STEP_TYPE_ORDER.map((type) => (
              <option key={type} value={type}>
                {STEP_TYPE_LABELS[locale][type]}
              </option>
            ))}
          </Select>
        </div>

        {(needsOffer || step.offerId) && (
          <div className="space-y-3 rounded-2xl border border-line bg-paper p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.offer}</p>
            {catalogLoading ? (
              <Spinner className="size-4" />
            ) : catalogError ? (
              <p className="text-xs text-danger">{t.offersError}</p>
            ) : entries.length === 0 ? (
              <p className="text-xs text-ink-soft">{t.noProducts}</p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="step-product">{t.product}</Label>
                  <Select id="step-product" value={chosen?.product.id ?? ""} onChange={(e) => pickProduct(e.target.value)}>
                    <option value="">{t.pickProduct}</option>
                    {entries.map((e) => (
                      <option key={e.product.id} value={e.product.id}>
                        {e.product.name}
                      </option>
                    ))}
                  </Select>
                </div>
                {chosen && (
                  <div className="space-y-1.5">
                    <Label htmlFor="step-offer">{t.offerLabel}</Label>
                    {chosen.offers.length === 0 ? (
                      <p className="text-xs text-ink-soft">{t.noOffers}</p>
                    ) : (
                      <Select id="step-offer" value={step.offerId ?? ""} onChange={(e) => onChange({ offerId: e.target.value || null })}>
                        <option value="">{t.pickOffer}</option>
                        {chosen.offers.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </Select>
                    )}
                  </div>
                )}
                {currentOffer && (
                  <p className="text-xs text-ink-soft">
                    {t.offerPrice}:{" "}
                    {currentOffer.priceAmount !== null ? <bdi dir="ltr">{formatMoney(currentOffer.priceAmount, currentOffer.currency)}</bdi> : t.offerPriceNone}
                  </p>
                )}
              </>
            )}
            {needsOffer && !step.offerId && <p className="text-xs text-danger">{t.required}</p>}
          </div>
        )}

        {step.type === "checkout" && (
          <div className="space-y-2 rounded-2xl border border-line bg-paper p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.bump}</p>
            <p className="text-xs text-ink-soft">{t.bumpHint}</p>
            <OfferPicker
              workspaceId={workspaceId}
              value={step.bumpOfferId}
              onChange={(bumpOfferId) => onChange({ bumpOfferId })}
              label={t.bumpLabel}
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-paper p-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.page}</p>
            <p className={cn("mt-0.5 flex items-center gap-1.5 text-xs", emptyPage ? "text-danger" : "text-ink-soft")}>
              <FileText className="size-3.5 shrink-0" aria-hidden />
              {emptyPage ? t.pageEmpty : sectionCount === 1 ? canvasT.oneSection : fmt(canvasT.sections, { n: sectionCount })}
            </p>
          </div>
          <Button size="sm" onClick={onEditPage}>
            <PencilRuler className="size-4" aria-hidden /> {t.editPage}
          </Button>
        </div>

        {step.experimentId && (
          <div className="rounded-2xl border border-line bg-paper p-3">
            <p className="text-xs text-ink-soft">{t.abRunning}</p>
            <Link to="/experiments" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              <FlaskConical className="size-3.5" aria-hidden /> {t.manageExperiments}
            </Link>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.edges}</p>
            <Button size="xs" variant="outline" onClick={addEdge} disabled={others.length === 0}>
              <Plus className="size-3" aria-hidden /> {c.add}
            </Button>
          </div>
          {outgoing.length === 0 ? (
            <p className="text-xs text-ink-soft">{step.type === "thank_you" ? t.thankYouEnds : t.noEdges}</p>
          ) : (
            <ul className="space-y-2">
              {outgoing.map((e) => (
                <li key={e.id} className="space-y-2 rounded-xl border border-line bg-paper p-2">
                  <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                    <Select value={e.toStepKey} onChange={(ev) => updateEdge(e.id, { toStepKey: ev.target.value })} className="h-8 text-xs" aria-label={t.toStep}>
                      {others.map((s) => (
                        <option key={s.key} value={s.key}>
                          {fmt(t.toStepOption, { name: s.name })}
                        </option>
                      ))}
                    </Select>
                    <button type="button" onClick={() => removeEdge(e.id)} aria-label={t.removeEdge} className="cursor-pointer rounded p-1 text-ink-soft hover:bg-danger-soft hover:text-danger">
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </div>
                  <div className="grid grid-cols-[1fr_64px] gap-2">
                    <Select value={e.condition} onChange={(ev) => updateEdge(e.id, { condition: ev.target.value as UiEdgeCondition })} className="h-8 text-xs" aria-label={t.condition}>
                      {CONDITION_ORDER.map((cond) => (
                        <option key={cond} value={cond}>
                          {CONDITION_LABELS[locale][cond]}
                        </option>
                      ))}
                    </Select>
                    <Input type="number" dir="ltr" min={0} value={e.priority} onChange={(ev) => updateEdge(e.id, { priority: Math.max(0, Math.floor(Number(ev.target.value)) || 0) })} className="h-8 text-xs" aria-label={t.priority} title={t.priority} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="relative">
            <Button size="sm" variant="outline" className="w-full" onClick={() => setAddingNext((o) => !o)} aria-expanded={addingNext}>
              <Plus className="size-4" aria-hidden /> {t.addNext}
            </Button>
            {addingNext && (
              <>
                <button type="button" aria-label={c.close} className="fixed inset-0 z-10 cursor-default" onClick={() => setAddingNext(false)} />
                <div className="absolute inset-x-0 z-20 mt-1 overflow-hidden rounded-2xl border border-line bg-paper-raised shadow-lg">
                  <StepTypeList
                    onPick={(type) => {
                      setAddingNext(false);
                      onAddNext(type);
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <div className="border-t border-line pt-4">
          <Button variant="ghost" className="text-danger hover:bg-danger-soft" onClick={onDelete}>
            <Trash2 className="size-4" aria-hidden /> {EDITOR_STRINGS[locale].deleteStep}
          </Button>
        </div>
      </div>
    </div>
  );
}
