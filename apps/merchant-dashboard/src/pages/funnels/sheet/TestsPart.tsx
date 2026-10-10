import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { Alert, Button, Input, Label } from "@store-builder/ui";
import {
  splitTestsChooseWinner,
  splitTestsCreate,
  splitTestsDelete,
  splitTestsGet,
  splitTestsList,
  splitTestsUpdate,
  type PageTree,
  type SplitTest,
  type SplitTestMetric,
  type SplitTestResults,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatMoney, formatPercentValue } from "@/lib/format";
import { formatCount } from "@/lib/analytics";
import { fmt, useT } from "@/i18n/LocaleContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataState, SkeletonBar } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { Select } from "@/components/Select";
import { SheetBody } from "@/components/Sheet";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { IconCaretRight, IconDelete, IconEdit, IconExperiment, IconPause, IconPlay, IconPlus, IconTrophy } from "@/components/icons";
import { useFunnelErrorMessage, type UiStep } from "../funnelAdapter";
import { FunnelStepPageEditor } from "../FunnelStepPageEditor";
import { CONTROL_KEY, SharesBar, VersionSharesEditor, sharesTotal, toPayload, versionLabel, type VersionDraft } from "../SplitTestVersions";
import { BackRow, Fold, PartFooter, useSheetDirty, useSheetGuard } from "./sheetKit";
import { SHEET_STRINGS } from "./sheetStrings";

/**
 * Funnel settings sheet → «اختبارات A/B».
 *
 * Level one is the list: each test a row — its step, its state, the versions'
 * shares as one split bar, the numbers the server counts per version, and one
 * honest sentence about who is ahead. A row opens level two (the test: the
 * full numbers, pause / resume, pick the winner, versions and shares, delete);
 * «اختبار جديد» opens the other level two (start a test). Editing a version's
 * page is a third level, in the same page editor a funnel step uses.
 *
 * Every call and payload is the one the old dialog made.
 */

const DEFAULT_VERSIONS: VersionDraft[] = [
  { key: CONTROL_KEY, name: "", weight: 50 },
  { key: "B", name: "", weight: 50 },
];

/** Under these the numbers say nothing yet: «لسه بدري». */
const MIN_VISITS_TOTAL = 100;
const MIN_VISITS_PER_VERSION = 30;
/** From here the server's confidence is called a plain difference. */
const PLAIN_CONFIDENCE = 0.9;

const STATUS_TONE = { running: "success", paused: "warning", completed: "neutral" } as const;

type Strings = (typeof SHEET_STRINGS)["en"];

type Verdict =
  | { kind: "winner"; key: string }
  | { kind: "leader"; key: string; pct: number }
  | { kind: "early" }
  | { kind: "close" }
  | { kind: "none" };

/**
 * Who is ahead, said carefully. A winner is the one the test ended on. A
 * leader is marked only when the server names one AND is at least 90% sure on
 * a sample that is not tiny; a small sample is «لسه بدري», anything else is
 * «قريبين من بعض».
 */
function verdictOf(test: SplitTest, results: SplitTestResults | undefined): Verdict {
  if (test.winnerVariantKey) return { kind: "winner", key: test.winnerVariantKey };
  if (!results) return { kind: "none" };
  const shown = results.variants.filter((v) => v.weight > 0);
  const small =
    results.confidence === null ||
    results.totalVisits < MIN_VISITS_TOTAL ||
    shown.some((v) => v.visits < MIN_VISITS_PER_VERSION);
  if (small) return { kind: "early" };
  if (results.leaderKey && results.confidence !== null && results.confidence >= PLAIN_CONFIDENCE) {
    return { kind: "leader", key: results.leaderKey, pct: Math.round(results.confidence * 100) };
  }
  return { kind: "close" };
}

function verdictText(t: Strings, test: SplitTest, results: SplitTestResults | undefined, verdict: Verdict): string | null {
  const nameOf = (key: string) => {
    const v = test.variants.find((x) => x.key === key);
    return v ? versionLabel(v, t.control) : key;
  };
  switch (verdict.kind) {
    case "winner":
      return fmt(t.winnerLine, { winner: nameOf(verdict.key) });
    case "early":
      return t.early;
    case "close":
      return t.closeCall;
    case "leader": {
      const runnerUp = [...(results?.variants ?? [])]
        .sort((x, y) => y.conversionRateBp - x.conversionRateBp)
        .find((v) => v.key !== verdict.key);
      return test.variants.length > 2 && runnerUp
        ? fmt(t.leaderVsLine, { leader: nameOf(verdict.key), pct: verdict.pct, runnerUp: nameOf(runnerUp.key) })
        : fmt(t.leaderLine, { leader: nameOf(verdict.key), pct: verdict.pct });
    }
    default:
      return null;
  }
}

/** Basis points → "6.7%" in the viewer's digits. */
const rateText = (bp: number) => formatPercentValue(bp / 10000, 1);

/** What makes two lists of versions the same for "is there anything to save". */
const versionsSignature = (list: VersionDraft[]) => list.map((v) => `${v.key}|${v.name.trim()}|${v.weight}`).join(",");

type View =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "detail"; id: string }
  | { kind: "page"; test: SplitTest; key: string; tree: PageTree };

export function TestsPart({
  funnelId,
  steps,
  nav,
  focusStepKey,
}: {
  funnelId: string;
  steps: UiStep[];
  /** The sheet's part switch, drawn above the list (the other levels have a way back instead). */
  nav: ReactNode;
  /** Opened for one step: its test opens at once, or — when it has none — a new test on it. */
  focusStepKey?: string | null;
}) {
  const t = useT(SHEET_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const describeError = useFunnelErrorMessage();
  const { guard } = useSheetGuard();
  const list = useAsync(() => splitTestsList(apiClient, workspaceId, funnelId), [workspaceId, funnelId]);
  const [view, setView] = useState<View>({ kind: "list" });
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);

  const tests = list.data ?? [];
  const stepOf = (key: string) => steps.find((s) => s.key === key);

  // Asked to open on one step: go to its test, or to a new one on it, once the list is in.
  useEffect(() => {
    if (focused || !focusStepKey || !list.data) return;
    setFocused(true);
    if (!steps.some((s) => s.key === focusStepKey)) return;
    const onStep = list.data.filter((x) => x.stepKey === focusStepKey);
    const live = onStep.find((x) => x.status !== "completed") ?? onStep[0];
    setView(live ? { kind: "detail", id: live.id } : { kind: "create" });
  }, [focused, focusStepKey, list.data, steps]);

  async function run(action: () => Promise<unknown>): Promise<boolean> {
    setBusy(true);
    try {
      await action();
      await list.refresh({ silent: true });
      return true;
    } catch (err) {
      toast.error(describeError(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const toList = () => setView({ kind: "list" });

  // --- level three: a version's own page ---
  if (view.kind === "page") {
    const { test, key } = view;
    return (
      <VersionPage
        test={test}
        versionKey={key}
        initialTree={view.tree}
        step={stepOf(test.stepKey) ?? null}
        funnelId={funnelId}
        workspaceId={workspaceId}
        busy={busy}
        onBack={() => setView({ kind: "detail", id: test.id })}
        onSave={(tree) =>
          void run(async () => {
            await splitTestsUpdate(apiClient, workspaceId, test.id, {
              // Every version but A sends its page back, the edited one with its changes.
              variants: test.variants.map((v) =>
                v.key === CONTROL_KEY
                  ? { key: v.key, name: v.name, weight: v.weight }
                  : { key: v.key, name: v.name, weight: v.weight, builderData: v.key === key ? tree : v.builderData }
              ),
            });
            toast.success(fmt(t.savedPage, { key }));
            setView({ kind: "detail", id: test.id });
          })
        }
      />
    );
  }

  // --- level two: start a test ---
  if (view.kind === "create") {
    return (
      <TestCreate
        funnelId={funnelId}
        steps={steps}
        tests={tests}
        startStepKey={focusStepKey ?? null}
        onBack={toList}
        onCreated={async () => {
          toList();
          await list.refresh({ silent: true });
        }}
      />
    );
  }

  // --- level two: one test ---
  const current = view.kind === "detail" ? tests.find((x) => x.id === view.id) : undefined;
  if (current) {
    return (
      <TestDetail
        test={current}
        pageName={stepOf(current.stepKey)?.name ?? current.stepKey}
        newPage={stepOf(current.stepKey)?.tree}
        busy={busy}
        run={run}
        onBack={toList}
        onEditPage={(key) =>
          guard(
            () =>
              void run(async () => {
                const { experiment } = await splitTestsGet(apiClient, workspaceId, current.id);
                const version = experiment.variants.find((v) => v.key === key);
                const tree = (version?.builderData ?? { version: 1, sections: [] }) as PageTree;
                setView({ kind: "page", test: experiment, key, tree: { ...tree, sections: Array.isArray(tree.sections) ? tree.sections : [] } });
              })
          )
        }
      />
    );
  }

  // --- level one: the list ---
  return (
    <>
      {nav}
      <SheetBody>
        <DataState loading={list.loading} error={list.error} onRetry={() => void list.refresh()}>
          <div className="space-y-4">
            <p className="text-sm leading-6 text-ink-soft">{t.testsIntro}</p>
            {tests.length === 0 ? (
              <EmptyState
                className="px-4 py-8"
                icon={<IconExperiment />}
                title={t.noTests}
                description={steps.length === 0 ? t.noSteps : t.noTestsDesc}
                action={
                  <Button type="button" className="rounded-full px-5" disabled={steps.length === 0} onClick={() => setView({ kind: "create" })}>
                    <IconPlus className="size-4" aria-hidden />
                    {t.newTest}
                  </Button>
                }
              />
            ) : (
              <>
                <ul className="space-y-3">
                  {tests.map((test) => (
                    <TestRow
                      key={test.id}
                      test={test}
                      pageName={stepOf(test.stepKey)?.name ?? test.stepKey}
                      onOpen={() => setView({ kind: "detail", id: test.id })}
                    />
                  ))}
                </ul>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 w-full rounded-full"
                  disabled={steps.length === 0}
                  onClick={() => setView({ kind: "create" })}
                >
                  <IconPlus className="size-4" aria-hidden />
                  {t.newTest}
                </Button>
              </>
            )}
          </div>
        </DataState>
      </SheetBody>
    </>
  );
}

// --- a row of the list -------------------------------------------------------

function TestRow({ test, pageName, onOpen }: { test: SplitTest; pageName: string; onOpen: () => void }) {
  const t = useT(SHEET_STRINGS);
  const workspaceId = useWorkspaceId();
  // The list carries no numbers: each row reads its own, again whenever the list hands down a changed test.
  const detail = useAsync(() => splitTestsGet(apiClient, workspaceId, test.id), [workspaceId, test.id, test.updatedAt]);
  const results = detail.data?.results;
  const verdict = verdictOf(test, results);
  const sentence = verdictText(t, test, results, verdict);
  const markKey = verdict.kind === "winner" || verdict.kind === "leader" ? verdict.key : null;

  return (
    <li
      data-slot="funnel-test-row"
      className="relative rounded-2xl bg-paper-raised p-4 ring-1 ring-line transition-[scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] has-[button:active]:scale-[0.99] motion-reduce:transition-none"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onOpen}
            aria-label={fmt(t.openTest, { name: test.name })}
            className="block max-w-full cursor-pointer truncate text-start text-[15px] leading-6 font-semibold text-ink after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-primary"
          >
            <span dir="auto">{test.name}</span>
          </button>
          <p className="truncate text-xs leading-5 text-ink-soft">{fmt(t.onStep, { page: pageName })}</p>
        </div>
        <StatusBadge value={test.status} tone={STATUS_TONE[test.status]} text={t[test.status]} className="mt-0.5 shrink-0" />
        <IconCaretRight className="mt-1.5 size-4 shrink-0 text-ink-soft rtl:-scale-x-100" aria-hidden />
      </div>

      <SharesBar versions={test.variants} markKey={markKey} className="mt-3" />

      <ul className="mt-3 space-y-1.5">
        {test.variants.map((v) => {
          const r = results?.variants.find((x) => x.key === v.key);
          return (
            <li key={v.key} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
              <span className="flex min-w-0 flex-1 items-center gap-1.5 text-ink">
                <span className="min-w-0 truncate" dir="auto">
                  {versionLabel(v, t.control)}
                </span>
                {markKey === v.key && <MarkChip label={verdict.kind === "winner" ? t.winner : t.leader} />}
              </span>
              {r ? (
                <span className="shrink-0 text-xs tabular-nums text-ink-soft">
                  {t.visits} <bdi className="font-medium text-ink">{formatCount(r.visits)}</bdi>
                  {" · "}
                  {t.orders} <bdi className="font-medium text-ink">{formatCount(r.orders)}</bdi>
                  {" · "}
                  <bdi className="font-medium text-ink">{rateText(r.conversionRateBp)}</bdi>
                </span>
              ) : detail.loading ? (
                <SkeletonBar className="w-28" />
              ) : (
                <span className="text-xs text-ink-soft">—</span>
              )}
            </li>
          );
        })}
      </ul>

      {sentence && <p className="mt-2 text-xs leading-5 text-ink-soft">{sentence}</p>}
    </li>
  );
}

function MarkChip({ label }: { label: string }) {
  return (
    <span
      data-slot="funnel-test-mark"
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] leading-4 font-semibold text-success"
    >
      <IconTrophy className="size-3" aria-hidden />
      {label}
    </span>
  );
}

// --- one test ----------------------------------------------------------------

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[11px] leading-4 text-ink-soft">{label}</dt>
      <dd className="truncate text-sm leading-6 font-semibold tabular-nums text-ink">
        <bdi>{value}</bdi>
      </dd>
    </div>
  );
}

function TestDetail({
  test,
  pageName,
  newPage,
  busy,
  run,
  onBack,
  onEditPage,
}: {
  test: SplitTest;
  pageName: string;
  /** The page a version added now starts from. */
  newPage: unknown;
  busy: boolean;
  /** Runs a call, refreshes the list, toasts a failure. Resolves true when it went through. */
  run: (action: () => Promise<unknown>) => Promise<boolean>;
  onBack: () => void;
  onEditPage: (variantKey: string) => void;
}) {
  const t = useT(SHEET_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const { guard } = useSheetGuard();
  const idPrefix = useId();
  // Re-read whenever the list hands down a changed test.
  const detail = useAsync(() => splitTestsGet(apiClient, workspaceId, test.id), [workspaceId, test.id, test.updatedAt]);
  const results = detail.data?.results;
  const done = test.status === "completed";
  const verdict = verdictOf(test, results);
  const sentence = verdictText(t, test, results, verdict);
  const markKey = verdict.kind === "winner" || verdict.kind === "leader" ? verdict.key : null;

  // Versions a running test already has are locked: they stay, their share may go to 0.
  const saved = useMemo<VersionDraft[]>(
    () =>
      (detail.data?.experiment.variants ?? []).map((v) => ({
        key: v.key,
        name: v.name === v.key ? "" : v.name,
        weight: v.weight,
        builderData: v.builderData,
        locked: true,
      })),
    [detail.data]
  );
  const [draft, setDraft] = useState<VersionDraft[] | null>(null);
  const [foldOpen, setFoldOpen] = useState(false);
  const versionsDirty = draft !== null && versionsSignature(draft) !== versionsSignature(saved);
  useSheetDirty("funnel-test-versions", versionsDirty);

  const [winnerKey, setWinnerKey] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const labelOf = (key: string | null) => {
    const v = test.variants.find((x) => x.key === key);
    return v ? versionLabel(v, t.control) : (key ?? "");
  };

  return (
    <>
      <BackRow
        backLabel={t.backToTests}
        title={test.name}
        onBack={() => guard(onBack)}
        end={<StatusBadge value={test.status} tone={STATUS_TONE[test.status]} text={t[test.status]} />}
      />
      <SheetBody>
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm leading-6 text-ink">{fmt(t.onStep, { page: pageName })}</p>
            {!done && test.autoWinner.enabled && (
              <p className="text-xs leading-5 text-ink-soft">
                {fmt(t.autoLine, { n: test.autoWinner.afterVisits, metric: t[test.autoWinner.metric] })}
              </p>
            )}
          </div>

          <SharesBar versions={test.variants} markKey={markKey} />

          {sentence && (
            <p data-slot="funnel-test-verdict" data-kind={verdict.kind} className="rounded-2xl bg-paper-sunken px-4 py-3 text-sm leading-6 text-ink">
              {sentence}
            </p>
          )}
          {done && test.winnerVariantKey && <p className="text-xs leading-5 text-ink-soft">{fmt(t.doneNote, { winner: labelOf(test.winnerVariantKey) })}</p>}
          {Boolean(detail.error) && !detail.data && (
            <Alert variant="danger" className="flex flex-wrap items-center justify-between gap-2">
              <span>{t.numbersFailed}</span>
              <Button type="button" variant="outline" className="min-h-11 rounded-full px-4" onClick={() => void detail.refresh()}>
                {t.retry}
              </Button>
            </Alert>
          )}

          <ul className="space-y-2">
            {test.variants.map((v) => {
              const r = results?.variants.find((x) => x.key === v.key);
              const waiting = !r && detail.loading;
              const figure = (value: string | undefined) => (waiting ? "…" : (value ?? "—"));
              return (
                <li key={v.key} data-slot="funnel-test-version" data-mark={markKey === v.key ? "" : undefined} className="rounded-2xl bg-paper-raised p-3 ring-1 ring-line">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-dark dark:text-primary">
                      {v.key}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink" dir="auto">
                      {versionLabel(v, t.control)}
                    </span>
                    {markKey === v.key && <MarkChip label={verdict.kind === "winner" ? t.winner : t.leader} />}
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2">
                    <Stat label={t.share} value={formatPercentValue(v.weight / 100, 0)} />
                    <Stat label={t.visits} value={figure(r && formatCount(r.visits))} />
                    <Stat label={t.orders} value={figure(r && formatCount(r.orders))} />
                    <Stat label={t.rate} value={figure(r && rateText(r.conversionRateBp))} />
                    <Stat label={t.revenue} value={figure(r && formatMoney(r.revenueAmount))} />
                    <Stat label={t.epc} value={figure(r && formatMoney(r.revenuePerVisitAmount))} />
                  </dl>
                  {!done && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" variant="outline" className="min-h-11 rounded-full px-4" disabled={busy} onClick={() => setWinnerKey(v.key)}>
                        <IconTrophy className="size-4" aria-hidden />
                        {t.makeWinner}
                      </Button>
                      {v.key !== CONTROL_KEY && (
                        <Button type="button" variant="ghost" className="min-h-11 rounded-full px-4" disabled={busy} onClick={() => onEditPage(v.key)}>
                          <IconEdit className="size-4" aria-hidden />
                          {fmt(t.editPage, { key: v.key })}
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {!done && detail.data && (
            <Fold
              title={t.versionsFold}
              summary={t.versionsFoldSummary}
              open={foldOpen}
              onOpenChange={(next) => {
                setFoldOpen(next);
                if (next && draft === null) setDraft(saved);
              }}
            >
              <VersionSharesEditor versions={draft ?? saved} onChange={setDraft} newPage={newPage} idPrefix={`${idPrefix}st`} />
            </Fold>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {!done && (
              <Button
                type="button"
                variant="outline"
                className="min-h-11 rounded-full px-4"
                disabled={busy}
                onClick={() => {
                  const next = test.status === "running" ? "paused" : "running";
                  void run(() => splitTestsUpdate(apiClient, workspaceId, test.id, { status: next })).then((ok) => {
                    if (ok) toast.success(next === "paused" ? t.pausedToast : t.resumedToast);
                  });
                }}
              >
                {test.status === "running" ? <IconPause className="size-4" aria-hidden /> : <IconPlay className="size-4" aria-hidden />}
                {test.status === "running" ? t.pause : t.resume}
              </Button>
            )}
            <Button type="button" variant="ghost" className="min-h-11 rounded-full px-4 text-danger" disabled={busy} onClick={() => setDeleting(true)}>
              <IconDelete className="size-4" aria-hidden />
              {t.remove}
            </Button>
          </div>
        </div>
      </SheetBody>

      {versionsDirty && draft && (
        <PartFooter message={t.versionsUnsaved}>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setDraft(null);
              setFoldOpen(false);
            }}
          >
            {t.discard}
          </Button>
          <Button
            type="button"
            disabled={busy || sharesTotal(draft) !== 100}
            onClick={() =>
              void run(async () => {
                await splitTestsUpdate(apiClient, workspaceId, test.id, { variants: toPayload(draft) });
                toast.success(t.savedVersions);
              }).then((ok) => {
                if (ok) {
                  setDraft(null);
                  setFoldOpen(false);
                }
              })
            }
          >
            {busy ? t.saving : t.saveVersions}
          </Button>
        </PartFooter>
      )}

      <ConfirmDialog
        open={winnerKey !== null}
        title={fmt(t.winnerTitle, { version: labelOf(winnerKey) })}
        description={fmt(t.winnerBody, { version: labelOf(winnerKey) })}
        confirmLabel={t.winnerConfirm}
        onCancel={() => setWinnerKey(null)}
        onConfirm={async () => {
          const key = winnerKey;
          if (!key) return;
          const ok = await run(() => splitTestsChooseWinner(apiClient, workspaceId, test.id, key));
          if (ok) toast.success(fmt(t.winnerToast, { version: labelOf(key) }));
          setWinnerKey(null);
        }}
      />
      <ConfirmDialog
        open={deleting}
        destructive
        title={fmt(t.removeTitle, { name: test.name })}
        description={t.removeBody}
        confirmLabel={t.removeConfirm}
        onCancel={() => setDeleting(false)}
        onConfirm={async () => {
          const ok = await run(() => splitTestsDelete(apiClient, workspaceId, test.id));
          setDeleting(false);
          if (ok) {
            toast.success(t.removedToast);
            onBack();
          }
        }}
      />
    </>
  );
}

// --- start a test ------------------------------------------------------------

function TestCreate({
  funnelId,
  steps,
  tests,
  startStepKey,
  onBack,
  onCreated,
}: {
  funnelId: string;
  steps: UiStep[];
  /** The funnel's tests: a step with a running or paused one cannot take another. */
  tests: SplitTest[];
  startStepKey: string | null;
  onBack: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const t = useT(SHEET_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const describeError = useFunnelErrorMessage();
  const { guard } = useSheetGuard();
  const idPrefix = useId();
  const hasTest = (key: string) => tests.some((x) => x.stepKey === key && x.status !== "completed");
  const free = steps.filter((s) => !hasTest(s.key));

  const [stepKey, setStepKey] = useState(
    () => (startStepKey && free.some((s) => s.key === startStepKey) ? startStepKey : (free[0]?.key ?? steps[0]?.key ?? ""))
  );
  const [name, setName] = useState("");
  const [versions, setVersions] = useState<VersionDraft[]>(DEFAULT_VERSIONS);
  const [auto, setAuto] = useState(false);
  const [afterVisits, setAfterVisits] = useState(2000);
  const [metric, setMetric] = useState<SplitTestMetric>("conversion_rate");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const step = steps.find((s) => s.key === stepKey);
  const unsavedStep = Boolean(step && !step.id);
  const touched = name.trim() !== "" || auto || versionsSignature(versions) !== versionsSignature(DEFAULT_VERSIONS);
  useSheetDirty("funnel-test-create", touched);

  async function create() {
    if (!step || !name.trim()) return;
    if (!step.id) return setError(t.needsSaved);
    setError(null);
    setBusy(true);
    try {
      await splitTestsCreate(apiClient, workspaceId, {
        funnelId,
        stepKey,
        name: name.trim(),
        // Every version but A starts as a copy of the page as it is now.
        variants: toPayload(versions.map((v) => ({ ...v, builderData: step.tree }))),
        autoWinner: { enabled: auto, afterVisits, metric },
      });
      toast.success(t.created);
      await onCreated();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <BackRow backLabel={t.backToTests} title={t.createTitle} onBack={() => guard(onBack)} />
      <SheetBody>
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}page`}>{t.page}</Label>
            <Select
              id={`${idPrefix}page`}
              className="h-11"
              value={stepKey}
              disabled={busy}
              onChange={(e) => {
                setError(null);
                setStepKey(e.target.value);
              }}
            >
              {steps.map((s) => (
                <option key={s.key} value={s.key} disabled={hasTest(s.key)}>
                  {hasTest(s.key) ? fmt(t.stepHasTest, { name: s.name }) : s.name}
                </option>
              ))}
            </Select>
            {unsavedStep && <p className="text-xs leading-5 text-accent-dark">{t.needsSaved}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}name`}>{t.name}</Label>
            <Input
              id={`${idPrefix}name`}
              className="h-11"
              maxLength={200}
              value={name}
              placeholder={t.namePlaceholder}
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <VersionSharesEditor versions={versions} onChange={setVersions} newPage={step?.tree} idPrefix={`${idPrefix}new`} />

          <div className="space-y-3 rounded-2xl bg-paper-raised p-4 ring-1 ring-line">
            <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-ink">
              <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-primary" checked={auto} disabled={busy} onChange={(e) => setAuto(e.target.checked)} />
              <span>
                <span className="block font-medium">{t.auto}</span>
                <span className="block text-xs leading-5 text-ink-soft">{t.autoHint}</span>
              </span>
            </label>
            {auto && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`${idPrefix}visits`}>{t.afterVisits}</Label>
                  <Input
                    id={`${idPrefix}visits`}
                    type="number"
                    inputMode="numeric"
                    min={50}
                    className="h-11"
                    value={afterVisits}
                    disabled={busy}
                    onChange={(e) => setAfterVisits(Math.max(50, Math.round(Number(e.target.value) || 2000)))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${idPrefix}metric`}>{t.metric}</Label>
                  <Select id={`${idPrefix}metric`} className="h-11" value={metric} disabled={busy} onChange={(e) => setMetric(e.target.value as SplitTestMetric)}>
                    <option value="conversion_rate">{t.conversion_rate}</option>
                    <option value="revenue_per_visit">{t.revenue_per_visit}</option>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {error && <Alert variant="danger">{error}</Alert>}
        </div>
      </SheetBody>
      <PartFooter message={touched ? t.createUnsaved : undefined}>
        <Button type="button" variant="outline" disabled={busy} onClick={() => guard(onBack)}>
          {t.cancel}
        </Button>
        <Button
          type="button"
          disabled={busy || !name.trim() || !stepKey || unsavedStep || hasTest(stepKey) || sharesTotal(versions) !== 100}
          onClick={() => void create()}
        >
          {busy ? t.creating : t.create}
        </Button>
      </PartFooter>
    </>
  );
}

// --- a version's page --------------------------------------------------------

function VersionPage({
  test,
  versionKey,
  initialTree,
  step,
  funnelId,
  workspaceId,
  busy,
  onBack,
  onSave,
}: {
  test: SplitTest;
  versionKey: string;
  initialTree: PageTree;
  /** The funnel step the test runs on; null when it is no longer in the funnel. */
  step: UiStep | null;
  funnelId: string;
  workspaceId: string;
  busy: boolean;
  onBack: () => void;
  onSave: (tree: PageTree) => void;
}) {
  const t = useT(SHEET_STRINGS);
  const { guard, setWide } = useSheetGuard();
  const [tree, setTree] = useState(initialTree);
  const [changed, setChanged] = useState(false);
  useSheetDirty("funnel-test-page", changed);
  // The page editor needs the room: the sheet goes wide while this level shows.
  useEffect(() => {
    setWide(true);
    return () => setWide(false);
  }, [setWide]);

  // The same page editor a funnel step uses, on the version's own tree.
  const host: UiStep | null = step ? { ...step, tree } : null;

  return (
    <>
      <BackRow
        backLabel={t.backToTest}
        title={`${test.name} — ${fmt(t.pageTitle, { key: versionKey })}`}
        onBack={() => guard(onBack)}
        end={
          <Button type="button" className="min-h-11 rounded-full px-4" disabled={busy || !host} onClick={() => onSave(tree)}>
            {busy ? t.saving : fmt(t.savePage, { key: versionKey })}
          </Button>
        }
      />
      <SheetBody className="flex flex-col overflow-hidden p-0">
        {host ? (
          <div className="min-h-0 flex-1 overflow-hidden">
            <FunnelStepPageEditor
              workspaceId={workspaceId}
              steps={[host]}
              step={host}
              offerProduct={null}
              onSelectStep={() => undefined}
              onTreeChange={(next) => {
                setTree(next);
                setChanged(true);
              }}
              onBack={() => guard(onBack)}
              funnelId={funnelId}
            />
          </div>
        ) : (
          <p className="p-5 text-sm leading-6 text-ink-soft">{t.stepGone}</p>
        )}
      </SheetBody>
    </>
  );
}
