import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import {
  IconActivity,
  IconArrowLeft,
  IconCaretRight,
  IconCheck,
  IconDocument,
  IconDraft,
  IconExperiment,
  IconExternal,
  IconLaunch,
  IconLive,
  IconMoreActions,
  IconPause,
  IconPauseCircle,
  IconPlay,
  IconReports,
  IconSave,
  IconSections,
  IconSliders,
  IconSuccess,
  IconWarning,
  type IconComponent,
} from "@/components/icons";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Spinner,
  cn,
} from "@store-builder/ui";
import { funnelsListRevisions, funnelsRollback, type FunnelProblem, type FunnelRevisionDto, type FunnelStatus } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { canViewAnalytics } from "@/lib/analyticsAccess";
import { formatDate } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { useWorkspace } from "@/context/WorkspaceContext";
import { DataState } from "@/components/DataState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EditInPlace } from "@/components/EditInPlace";
import { TriggerPopover as Popover } from "@/components/TriggerPopover";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { fmt, useCommon, useLocale, useT } from "@/i18n/LocaleContext";
// The store editor's bar (Phase 6): its round tool button and its breakpoints, so both editors are one product.
import { TOOL_BUTTON } from "../../website/editor/shell/EditorToolbar";
import { WIDE_QUERY, useMediaQuery } from "../../website/editor/shell/useEditorLayout";
import { FunnelDraftBanner } from "../FunnelDraft";
import { FunnelIssuesList, useFunnelIssues, type FunnelIssuesState } from "../FunnelIssues";
import { FunnelGrowthButton } from "../FunnelGrowthPanel";
import { useFunnelErrorMessage, type SaveProgress, type UiFunnel } from "../funnelAdapter";
import { EDITOR_STRINGS, STATUS_STRINGS } from "../FunnelEditorPage.strings";
import { StepIcon, canPublishFunnels } from "./funnelMeta";

// ---------------------------------------------------------------- header --

export interface EditorHeaderProps {
  /** The workspace the funnel belongs to (the history menu reads its revisions). */
  workspaceId: string;
  /** The funnel's id from the route — what the issues, growth and share buttons work on. */
  funnelId: string;
  /** The funnel as it is being edited (unsaved changes included). */
  funnel: UiFunnel;
  /** When the auto-saved draft on offer was written; null when there is none to offer. */
  draftAt: string | null;
  /** "Load draft": replace the working funnel with the offered draft. */
  onLoadDraft: () => void;
  /** "Start over": forget the offered draft. */
  onDiscardDraft: () => void;
  /**
   * True while the funnel's name is an input instead of a heading. The name is
   * now edited in place in its own small pane (EditInPlace), which keeps its
   * own open state — the bar accepts these two and does not read them.
   */
  editingName: boolean;
  /** Open or close the name input (see `editingName`). */
  onEditingNameChange: (editing: boolean) => void;
  /** The name typed into the name input. */
  onRename: (name: string) => void;
  /** True when the working funnel differs from what is saved. */
  dirty: boolean;
  /** True while a save is running. */
  saving: boolean;
  /** True while publish, pause or resume is running. */
  statusBusy: boolean;
  /** How far the running save has got; null when none is running. */
  progress: SaveProgress | null;
  /** The message of the last failed save; null when there is none. */
  saveError: string | null;
  /** The funnel's public address; null when it has none yet (no Preview button). */
  publicUrl: string | null;
  /** The funnel's link was changed from the settings sheet (it saves on its own, at once). */
  onLinkChange?: (subdomain: string) => void;
  /** Open the public address in a new tab. */
  onPreview: () => void;
  /** Save the working funnel. */
  onSave: () => void;
  /** Check, save and publish (or publish again). */
  onPublish: () => void;
  /** Pause a live funnel ("paused") or resume a paused one ("published"). */
  onSetStatus: (status: "paused" | "published") => void;
  /** "Reload" on the save error: clear the error and fetch the saved funnel again. */
  onReloadAfterError: () => void;
  /** Which editor is showing: the flow map or one step's page. */
  view: "flow" | "page";
  /** Switch between the flow map and the page editor. */
  onViewChange: (view: "flow" | "page") => void;
  /** Everything that stops a publish right now (client pre-check and the server's last answer, merged). */
  problems: FunnelProblem[];
  /** The same problems split per step, plus the ones that name no step. */
  grouped: { byStep: Map<string, FunnelProblem[]>; general: FunnelProblem[] };
  /** True when some of the problems came from the server's last publish answer. */
  problemsFromServer: boolean;
  /** Whether the problems panel is open. */
  showProblems: boolean;
  /** Open or close the problems panel. */
  onShowProblemsChange: (open: boolean) => void;
  /** "Show step" on a problem: select that step on the flow map. */
  onShowStep: (key: string) => void;
  /** Bumped after each publish so the history menu reloads its list. */
  historyVersion: number;
  /** A rollback went through: fetch the saved funnel again. */
  onRolledBack: () => void;
  /** Optional. In the page view: the name of the step whose page is open, shown beside the way back to the map. Default: none. */
  pageStepName?: string | null;
  /** Optional. The two side panes' switches on a wide screen; null (the default) where the layout has no side panes. */
  panels?: EditorPanels | null;
  /** Optional. Leave for another screen of the app — the page asks first while there is unsaved work. Default: go there at once. */
  onNavigate?: (to: string) => void;
}

/** The side panes' switches in the bar: the steps on the start side, the selected step's details on the end side. */
export interface EditorPanels {
  start: boolean;
  onStart: () => void;
  end: boolean;
  onEnd: () => void;
}

interface MenuEntry {
  id: string;
  label: string;
  icon: IconComponent;
  onSelect: () => void;
  disabled?: boolean;
}

// The row of the list kit's menus: 36px under a mouse, 44px under a thumb (the store editor's «…» uses the same).
const MENU_ITEM = "min-h-9 cursor-pointer items-center gap-3 rounded-[0.625rem] px-2.5 py-2 pointer-coarse:min-h-11 pointer-coarse:py-3";

/** A chip of the bar: 28px to look at, 44px to press. */
const CHIP =
  "relative inline-flex h-7 max-w-full min-w-0 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap transition-[scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none";

const STATUS_CHIP: Record<FunnelStatus, string> = {
  draft: "bg-paper-sunken text-ink-soft",
  published: "bg-success-soft text-success",
  paused: "bg-accent-soft text-accent-dark",
};

/** The pills at the bar's end: 40px with a pointer, 44px under a thumb. */
const BAR_BUTTON = "h-10 shrink-0 rounded-full pointer-coarse:h-11";

/**
 * The editor's one bar and the strips that come and go under it — the same
 * anatomy as the store editor's (pages/website/editor/shell/EditorToolbar),
 * with the same slots, so glass/editor.css gives both the same material:
 *
 *  start   back (to the funnels; in the page view, to the map) · (lg) hide /
 *          show the steps · the funnel's name, edited in place · (lg) the
 *          status chip and the save state in words
 *  end     (lg) the readiness chip · (md) preview · «احفظ» · «انشر», the one
 *          main button · «…» · (lg) hide / show the step's details
 *
 * 56px, one row. Below lg the status, the save state and the readiness chip
 * drop to a second, 44px row — never a third. Under the bar, only while they
 * have something to say: the draft found on the server, and a failed save.
 */
export function EditorHeader({
  workspaceId,
  funnelId,
  funnel,
  draftAt,
  onLoadDraft,
  onDiscardDraft,
  onRename,
  dirty,
  saving,
  statusBusy,
  progress,
  saveError,
  publicUrl,
  onLinkChange,
  onPreview,
  onSave,
  onPublish,
  onSetStatus,
  onReloadAfterError,
  view,
  onViewChange,
  problems,
  grouped,
  problemsFromServer,
  showProblems,
  onShowProblemsChange,
  onShowStep,
  historyVersion,
  onRolledBack,
  pageStepName = null,
  panels = null,
  onNavigate,
}: EditorHeaderProps) {
  const t = useT(EDITOR_STRINGS);
  const c = useCommon();
  const { dir } = useLocale();
  const toast = useToast();
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const role = currentWorkspace?.role;
  // funnels.publish (publish, pause, resume, rollback) and analytics.view (the report): see funnelMeta / analyticsAccess.
  const mayPublish = canPublishFunnels(role);
  const mayReport = canViewAnalytics(role);
  const wide = useMediaQuery(WIDE_QUERY, true);
  const busy = saving || statusBusy;
  const inPage = view === "page";
  const go = onNavigate ?? ((to: string) => navigate(to));

  const [historyOpen, setHistoryOpen] = useState(false);
  // «الاختبارات والإعدادات» keeps its own button and its own sheet (FunnelGrowthPanel); the «…» row presses it.
  const growthHolder = useRef<HTMLSpanElement>(null);

  // The server's own check of the saved version: its fetch and its count stay in FunnelIssues.
  const issues = useFunnelIssues(funnelId, Number(!dirty));
  const refreshIssues = issues.refresh;
  useEffect(() => {
    if (showProblems) refreshIssues();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh is recreated each render; opening is the trigger
  }, [showProblems]);
  const stepNames = useMemo<Record<string, string>>(() => Object.fromEntries(funnel.steps.map((s) => [s.key, s.name])), [funnel.steps]);

  const publishLabel = funnel.status === "draft" ? t.publish : t.republish;

  const entries: Array<Array<MenuEntry | null>> = [
    [
      !inPage && funnel.steps.length > 0 ? { id: "page", label: t.menuEditPage, icon: IconDraft, onSelect: () => onViewChange("page") } : null,
      publicUrl ? { id: "preview", label: t.preview, icon: IconExternal, onSelect: onPreview } : null,
    ],
    [
      { id: "history", label: t.history, icon: IconActivity, onSelect: () => setHistoryOpen(true) },
      mayReport ? { id: "report", label: t.menuReport, icon: IconReports, onSelect: () => go("/analytics/funnels/" + funnelId) } : null,
      { id: "growth", label: t.menuGrowth, icon: IconExperiment, onSelect: () => growthHolder.current?.querySelector("button")?.click() },
    ],
    [
      funnel.status === "published"
        ? { id: "pause", label: t.pause, icon: IconPause, onSelect: () => onSetStatus("paused"), disabled: busy || !mayPublish }
        : funnel.status === "paused"
          ? { id: "resume", label: t.resume, icon: IconPlay, onSelect: () => onSetStatus("published"), disabled: busy || !mayPublish }
          : null,
    ],
  ];
  const groups = entries.map((group) => group.filter((entry): entry is MenuEntry => entry !== null)).filter((group) => group.length > 0);

  const statusChip = <StatusChip status={funnel.status} revision={funnel.publishedRevisionNumber} dirty={dirty} />;
  const saveWords = <SaveWords dirty={dirty} saving={saving} progress={progress} />;
  const readiness = (
    <Readiness
      funnel={funnel}
      problems={problems}
      grouped={grouped}
      problemsFromServer={problemsFromServer}
      open={showProblems}
      onOpenChange={onShowProblemsChange}
      onShowStep={(key) => {
        onShowProblemsChange(false);
        onShowStep(key);
      }}
      issues={issues}
      stepNames={stepNames}
    />
  );

  return (
    <>
      <header
        data-slot="editor-toolbar"
        data-editor="funnel"
        role="group"
        aria-label={t.toolbar}
        className="relative z-10 flex h-14 shrink-0 items-center gap-0.5 border-b border-line bg-paper-raised px-1.5 md:gap-2 md:px-3"
      >
        <div className="flex min-w-0 flex-1 items-center gap-0.5 md:gap-2">
          {inPage ? (
            <button type="button" aria-label={t.backToMap} title={t.backToMap} onClick={() => onViewChange("flow")} className={TOOL_BUTTON}>
              <IconArrowLeft className="size-5 rtl:-scale-x-100" aria-hidden />
            </button>
          ) : (
            // While there is unsaved work the page's leave guard takes this click and asks first.
            <Link to="/funnels" aria-label={t.backToFunnels} title={t.backToFunnels} className={TOOL_BUTTON}>
              <IconArrowLeft className="size-5 rtl:-scale-x-100" aria-hidden />
            </Link>
          )}
          {panels && !inPage && (
            <button
              type="button"
              aria-pressed={panels.start}
              aria-label={panels.start ? t.hideStepsPanel : t.showStepsPanel}
              title={panels.start ? t.hideStepsPanel : t.showStepsPanel}
              onClick={panels.onStart}
              className={cn(TOOL_BUTTON, panels.start && "bg-paper-sunken text-ink")}
            >
              <IconSections className="size-5" aria-hidden />
            </button>
          )}
          <h1 className="flex min-w-16 shrink items-center gap-1.5 ps-1.5 font-display text-[15px] font-semibold text-ink">
            {inPage && pageStepName !== null ? (
              <>
                <span className="hidden max-w-40 truncate font-normal text-ink-soft md:inline" dir="auto">
                  {funnel.name}
                </span>
                <IconCaretRight className="hidden size-3.5 shrink-0 text-ink-soft md:block rtl:-scale-x-100" aria-hidden />
                <span className="min-w-0 truncate" dir="auto">
                  {pageStepName}
                </span>
              </>
            ) : (
              <EditInPlace
                value={funnel.name}
                label={t.nameLabel}
                onSave={(next) => onRename(next)}
                validate={(next) => (next === "" ? t.nameRequired : next.length > 200 ? t.nameTooLong : null)}
                undoMessage={t.nameChanged}
                className="min-w-0"
              />
            )}
          </h1>
          {wide && statusChip}
          {wide && saveWords}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-0.5 md:gap-1.5">
          {wide && readiness}
          {publicUrl && (
            <button type="button" aria-label={t.preview} title={t.preview} onClick={onPreview} className={cn(TOOL_BUTTON, "hidden md:inline-flex")}>
              <IconExternal className="size-5 rtl:-scale-x-100" aria-hidden />
            </button>
          )}
          <Button type="button" variant="outline" onClick={onSave} disabled={!dirty || busy} className={cn(BAR_BUTTON, "zimos-editor-soft px-3 md:px-4")}>
            {saving ? <Spinner className="size-4" /> : <IconSave className="hidden size-4 md:block" aria-hidden />}
            {c.save}
          </Button>
          <Button
            type="button"
            onClick={mayPublish ? onPublish : () => toast.error(t.publishNotAllowed)}
            disabled={mayPublish && busy}
            aria-disabled={!mayPublish || undefined}
            aria-label={publishLabel}
            title={mayPublish ? undefined : t.publishNotAllowed}
            className={cn(BAR_BUTTON, "ms-1 px-3.5 md:ms-0 md:px-5", !mayPublish && "opacity-50")}
          >
            {statusBusy ? <Spinner className="size-4" /> : <IconLaunch className="hidden size-4 md:block" aria-hidden />}
            <span className="md:hidden">{t.publishShort}</span>
            <span className="hidden md:inline">{publishLabel}</span>
          </Button>

          <DirectionProvider direction={dir}>
            <DropdownMenu>
              <DropdownMenuTrigger render={<button type="button" aria-label={t.more} title={t.more} className={TOOL_BUTTON} />}>
                <IconMoreActions className="size-5" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="bottom"
                align="end"
                sideOffset={8}
                className="w-auto max-w-[min(21rem,calc(100vw_-_1.5rem))] min-w-60 rounded-[1.125rem] p-1.5"
              >
                {groups.map((group, index) => (
                  <Fragment key={group[0].id}>
                    {index > 0 && <DropdownMenuSeparator className="mx-1.5" />}
                    {group.map((item) => {
                      const ItemIcon = item.icon;
                      return (
                        <DropdownMenuItem
                          key={item.id}
                          disabled={item.disabled === true}
                          onClick={() => {
                            if (item.disabled !== true) item.onSelect();
                          }}
                          className={MENU_ITEM}
                        >
                          <ItemIcon className="size-[18px] text-ink-soft" aria-hidden />
                          <span className="min-w-0 flex-1">{item.label}</span>
                        </DropdownMenuItem>
                      );
                    })}
                  </Fragment>
                ))}
                {!mayPublish && <p className="px-2.5 pt-1.5 pb-1 text-xs leading-5 text-ink-soft">{t.publishRoleNote}</p>}
              </DropdownMenuContent>
            </DropdownMenu>
          </DirectionProvider>

          {panels && !inPage && (
            <button
              type="button"
              aria-pressed={panels.end}
              aria-label={panels.end ? t.hideDetailsPanel : t.showDetailsPanel}
              title={panels.end ? t.hideDetailsPanel : t.showDetailsPanel}
              onClick={panels.onEnd}
              className={cn(TOOL_BUTTON, panels.end && "bg-paper-sunken text-ink")}
            >
              <IconSliders className="size-5" aria-hidden />
            </button>
          )}
        </div>
      </header>

      {/* Below lg: what does not fit the bar, on one 44px row of its own. */}
      {!wide && (
        <div data-slot="funnel-subbar" className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-paper-raised px-3">
          {statusChip}
          {saveWords}
          <span className="ms-auto flex min-w-0 items-center">{readiness}</span>
        </div>
      )}

      {draftAt && <FunnelDraftBanner at={draftAt} onLoad={onLoadDraft} onDiscard={onDiscardDraft} />}

      {/* A failed save says so in words, with the way out. The changes stay in memory. */}
      {saveError && (
        <div
          role="alert"
          data-slot="editor-alert"
          className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-line bg-danger-soft px-3 py-2"
        >
          <p className="min-w-0 flex-1 basis-56 text-sm text-ink">{saveError}</p>
          <Button type="button" variant="outline" size="sm" className="h-9 rounded-full px-3 pointer-coarse:h-11" onClick={onReloadAfterError}>
            {t.reload}
          </Button>
        </div>
      )}

      {/* Out of sight: its button is pressed from the «…» menu; its sheet opens over the page. */}
      <span ref={growthHolder} hidden>
        <FunnelGrowthButton funnelId={funnelId} steps={funnel.steps} onLinkChange={onLinkChange} />
      </span>
      <HistoryMenu
        workspaceId={workspaceId}
        funnel={funnel}
        version={historyVersion}
        onRolledBack={onRolledBack}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </>
  );
}

// ---------------------------------------------------------------- status --

export interface StatusStripProps {
  /** Draft, live or paused — decides the colour, the icon and the sentence. */
  status: FunnelStatus;
  /** The number of the live revision; null when the funnel was never published. */
  revision: number | null;
  /** True when there are unsaved changes (adds the "unsaved" note at the end). */
  dirty: boolean;
}

/**
 * What visitors get right now, in words. Draft / live / paused decide what
 * the public runtime serves (backend loadPublishedSnapshot: paused is a 410
 * "not available", draft is not found), so each has its own icon, colour and
 * sentence. It used to be a coloured strip across the editor; it is now what
 * the bar's status chip opens.
 */
export function StatusStrip({ status, revision, dirty }: StatusStripProps) {
  const t = useT(STATUS_STRINGS);
  const look = {
    draft: { icon: IconDocument, tone: "text-ink", title: t.draftTitle, body: t.draftBody },
    published: {
      icon: IconLive,
      tone: "text-success",
      title: revision !== null ? fmt(t.liveTitleRevision, { n: revision }) : t.liveTitle,
      body: t.liveBody,
    },
    paused: { icon: IconPauseCircle, tone: "text-accent-dark", title: t.pausedTitle, body: t.pausedBody },
  }[status];
  const Glyph = look.icon;
  return (
    <div data-slot="funnel-status-note" data-status={status} className="space-y-1.5 text-sm">
      <p className={cn("flex items-center gap-1.5 font-semibold", look.tone)}>
        <Glyph className="size-4 shrink-0" aria-hidden /> {look.title}
      </p>
      <p className="leading-6 text-ink-soft">{look.body}</p>
      {dirty && <p className="text-xs font-medium text-ink">{t.unsaved}</p>}
    </div>
  );
}

/** The bar's status chip — «مسودة» / «شغّال · نسخة #n» / «متوقف» — opening the sentence that explains it. */
function StatusChip({ status, revision, dirty }: StatusStripProps) {
  const t = useT(EDITOR_STRINGS);
  const label =
    status === "draft" ? t.chipDraft : status === "paused" ? t.chipPaused : revision !== null ? fmt(t.chipLiveRevision, { n: revision }) : t.chipLive;
  return (
    <Popover
      label={t.statusLabel}
      align="start"
      className="w-80"
      trigger={
        <button type="button" data-slot="funnel-status" data-status={status} title={t.statusLabel} className={cn(CHIP, STATUS_CHIP[status])}>
          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
          <span className="truncate">{label}</span>
        </button>
      }
    >
      <StatusStrip status={status} revision={revision} dirty={dirty} />
    </Popover>
  );
}

/** The save state in words: «اتغيّر ومتحفظش» / «بيحفظ ٣/٧…» / «محفوظ». */
function SaveWords({ dirty, saving, progress }: { dirty: boolean; saving: boolean; progress: SaveProgress | null }) {
  const t = useT(EDITOR_STRINGS);
  const c = useCommon();
  const state = saving ? "saving" : dirty ? "dirty" : "saved";
  return (
    <span
      role="status"
      aria-live="polite"
      data-slot="funnel-save-state"
      data-state={state}
      className={cn("inline-flex min-w-0 items-center gap-1.5 text-xs whitespace-nowrap", state === "dirty" ? "font-medium text-ink" : "text-ink-soft")}
    >
      {state === "saving" ? (
        <Spinner className="size-3.5 shrink-0" />
      ) : state === "dirty" ? (
        <span aria-hidden className="size-2 shrink-0 rounded-full bg-accent" />
      ) : (
        <IconCheck className="size-3.5 shrink-0 text-success" aria-hidden />
      )}
      <span className="truncate">
        {state === "saving"
          ? progress && progress.total > 0
            ? fmt(t.savingProgress, { done: progress.done, total: progress.total })
            : c.saving
          : state === "dirty"
            ? t.unsavedChanges
            : t.stateSaved}
      </span>
    </span>
  );
}

// ------------------------------------------------------------- readiness --

interface ReadinessProps {
  funnel: UiFunnel;
  problems: FunnelProblem[];
  grouped: { byStep: Map<string, FunnelProblem[]>; general: FunnelProblem[] };
  problemsFromServer: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** «ورّيني الخطوة»: closes the list and selects the step. */
  onShowStep: (key: string) => void;
  issues: FunnelIssuesState;
  stepNames: Record<string, string>;
}

/**
 * One chip for "can this go live?": «جاهز للنشر» or «٣ حاجات قبل النشر». It
 * opens the list of what stops a publish — beside the chip on a wide screen,
 * as a bottom sheet on a phone — with the server's notes on the saved version
 * as a second group under it.
 */
function Readiness(props: ReadinessProps) {
  const { problems, open, onOpenChange, issues } = props;
  const t = useT(EDITOR_STRINGS);
  // The same line the shared Sheet draws between a bottom sheet and a centred pane.
  const roomy = useMediaQuery("(min-width: 40rem)", true);
  const ready = problems.length === 0;
  const chipClass = cn(CHIP, ready ? "bg-success-soft text-success" : "bg-danger-soft text-danger");
  const chipBody = (
    <>
      {ready ? <IconSuccess className="size-3.5 shrink-0" aria-hidden /> : <IconWarning className="size-3.5 shrink-0" aria-hidden />}
      <span className="truncate">{ready ? t.readyToPublish : pluralOf(t, "toFixCount", problems.length)}</span>
      {ready && issues.total > 0 && (
        <span data-slot="funnel-notes-count" className="rounded-full bg-paper-raised px-1.5 text-[11px] leading-4 text-ink-soft tabular-nums">
          <span aria-hidden>{fmt("{n}", { n: issues.total })}</span>
          <span className="sr-only">{pluralOf(t, "notesCount", issues.total)}</span>
        </span>
      )}
    </>
  );

  if (!roomy) {
    return (
      <>
        <button type="button" data-slot="funnel-readiness" data-ready={ready || undefined} aria-expanded={open} onClick={() => onOpenChange(true)} className={chipClass}>
          {chipBody}
        </button>
        <Sheet open={open} onOpenChange={onOpenChange} title={t.readinessTitle} size="md">
          <ReadinessList {...props} />
        </Sheet>
      </>
    );
  }
  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      label={t.readinessTitle}
      align="end"
      className="max-h-[min(70dvh,34rem)] w-[24rem] overflow-y-auto"
      trigger={
        <button type="button" data-slot="funnel-readiness" data-ready={ready || undefined} className={chipClass}>
          {chipBody}
        </button>
      }
    >
      <p className="mb-2 font-display text-[15px] font-semibold text-ink">{t.readinessTitle}</p>
      <ReadinessList {...props} />
    </Popover>
  );
}

/** Both groups: what the editor's own check found (it stops a publish), then what the server found in the saved version. */
function ReadinessList({ funnel, problems, grouped, problemsFromServer, onShowStep, issues, stepNames }: ReadinessProps) {
  const t = useT(EDITOR_STRINGS);
  const flagged = funnel.steps.filter((s) => grouped.byStep.has(s.key));
  return (
    <div className="space-y-4 text-sm">
      {problems.length === 0 ? (
        <p className="flex items-center gap-1.5 text-ink">
          <IconSuccess className="size-4 shrink-0 text-success" aria-hidden />
          {t.nothingBlocks}
        </p>
      ) : (
        <div role="alert" data-slot="funnel-problems">
          <p className="font-medium text-danger">{t.cantPublish}</p>
          {problemsFromServer && <p className="mt-0.5 text-xs text-ink-soft">{t.serverSaid}</p>}
          <ul className="mt-2 space-y-2">
            {flagged.map((s) => (
              <li key={s.key} data-slot="funnel-issue" data-severity="fatal" className="rounded-[0.875rem] bg-paper p-3 ring-1 ring-line">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex min-w-0 items-center gap-2 font-medium text-ink">
                    <StepIcon type={s.type} className="size-4 shrink-0 text-ink-soft" />
                    <span className="truncate" dir="auto">
                      {s.name}
                    </span>
                  </span>
                  <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 rounded-full px-3 pointer-coarse:h-11" onClick={() => onShowStep(s.key)}>
                    {t.showStep}
                  </Button>
                </div>
                <ul className="mt-1.5 list-disc space-y-0.5 ps-5 leading-6 text-danger">
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
                <ul className="list-disc space-y-0.5 ps-5 leading-6 text-danger">
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

      <section data-slot="funnel-server-issues" className="border-t border-line pt-3">
        <h3 className="flex items-center justify-between gap-2 text-xs font-semibold text-ink-soft">
          <span>{t.serverGroup}</span>
          {issues.total > 0 && <span className="shrink-0 tabular-nums">{pluralOf(t, "notesCount", issues.total)}</span>}
        </h3>
        <FunnelIssuesList
          state={issues}
          stepNames={stepNames}
          onShowStep={onShowStep}
          className="mt-2"
        />
      </section>
    </div>
  );
}

// --------------------------------------------------------------- history --

export interface HistoryMenuProps {
  /** The workspace the funnel belongs to. */
  workspaceId: string;
  /** The funnel whose published revisions are listed. */
  funnel: UiFunnel;
  /** Bumped after each publish so the list reloads. */
  version: number;
  /** Called after a rollback went through. */
  onRolledBack: () => void;
  /** Optional. Open or closed from outside (the bar's «…» menu); then no button of its own is drawn. Default: its own button and state. */
  open?: boolean;
  /** Optional. With `open`: asked to open or close. */
  onOpenChange?: (open: boolean) => void;
}

/** "History": the published revisions in a sheet, each with a rollback (for a role that may publish). */
export function HistoryMenu({ workspaceId, funnel, version, onRolledBack, open: openProp, onOpenChange }: HistoryMenuProps) {
  const t = useT(EDITOR_STRINGS);
  const toast = useToast();
  const describeError = useFunnelErrorMessage();
  const { currentWorkspace } = useWorkspace();
  const mayRestore = canPublishFunnels(currentWorkspace?.role);
  const [ownOpen, setOwnOpen] = useState(false);
  const controlled = openProp !== undefined;
  const open = openProp ?? ownOpen;
  const setOpen = (next: boolean) => {
    if (!controlled) setOwnOpen(next);
    onOpenChange?.(next);
  };
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
    <>
      {!controlled && (
        <Button type="button" variant="outline" onClick={() => setOpen(true)} aria-expanded={open} className={cn(BAR_BUTTON, "px-3.5")}>
          <IconActivity className="size-4" aria-hidden /> {t.history}
        </Button>
      )}
      <Sheet open={open} onOpenChange={setOpen} title={t.historyTitle} description={mayRestore ? undefined : t.publishRoleNote} size="sm">
        <DataState
          loading={revisions.loading}
          error={revisions.error}
          empty={!revisions.loading && (revisions.data?.length ?? 0) === 0}
          emptyMessage={t.historyEmpty}
          onRetry={() => revisions.refresh()}
        >
          <ul data-slot="funnel-revisions" className="space-y-1">
            {(revisions.data ?? []).map((r) => {
              const live = r.id === funnel.publishedRevisionId;
              return (
                <li key={r.id} data-live={live || undefined} className="flex min-h-14 items-center justify-between gap-2 rounded-[0.875rem] px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {fmt(t.revisionLabel, { n: r.revisionNumber })}
                      {live && <span className="ms-2 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">{t.revisionLive}</span>}
                    </p>
                    <p className="truncate text-xs text-ink-soft">
                      {formatDate(r.createdAt)} · {fmt(t.revisionSteps, { n: r.stepCount })}
                      {r.note ? " · " + r.note : ""}
                    </p>
                  </div>
                  {!live && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!mayRestore}
                      className="h-9 shrink-0 rounded-full px-3 pointer-coarse:h-11"
                      onClick={() => setTarget(r)}
                    >
                      {t.rollback}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </DataState>
      </Sheet>
      <ConfirmDialog
        open={target !== null}
        title={target ? fmt(t.rollbackTitle, { n: target.revisionNumber }) : t.history}
        description={target ? fmt(t.rollbackDescription, { n: target.revisionNumber }) : undefined}
        confirmLabel={t.rollback}
        onCancel={() => setTarget(null)}
        onConfirm={confirmRollback}
      />
    </>
  );
}
