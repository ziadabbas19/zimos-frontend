import { useState, type ReactNode } from "react";
import {
  IconArrowRight,
  IconCaretDown,
  IconClose,
  IconDelete,
  IconDraft,
  IconExperiment,
  IconFlow,
  IconPlus,
  IconWarning,
} from "@/components/icons";
import { Button, Input, Label, Spinner, cn } from "@store-builder/ui";
import { splitTestsList, type FunnelProblem, type SplitTest } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { formatMoney } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { CopyButton } from "@/components/CopyButton";
import { OfferPicker } from "@/components/OfferPicker";
import { Select } from "@/components/Select";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { tempId, type UiEdge, type UiEdgeCondition, type UiFunnel, type UiStep, type UiStepType } from "../funnelAdapter";
import { STEP_TYPE_LABELS } from "../FunnelEditorPage.strings";
import { nextCondition } from "../funnelFlow";
import { pageElementCount } from "../funnelPages";
import { PageThumb } from "../panes/PageThumb";
import { CONDITION_WORDS, PANE_STRINGS, SENSIBLE_CONDITIONS } from "../panes/paneStrings";
import { StepTypePicker, StepTypeTile } from "../panes/StepTypePicker";
import { CONDITION_ORDER, STEP_TYPES, type CatalogEntry } from "./funnelMeta";

// ------------------------------------------------------------- inspector --

export interface StepInspectorProps {
  /** The funnel as it is being edited: the step's paths out and the steps they can lead to. */
  funnel: UiFunnel;
  /** The selected step. Null draws the "pick a step" state instead (the same as `StepInspectorEmpty`). */
  step: UiStep | null;
  /** What stops this step from publishing, client pre-check and last server answer merged. */
  problems: FunnelProblem[];
  /** Products with their active offers; null until loaded. */
  catalog: CatalogEntry[] | null;
  /** True while the offer catalog is loading. */
  catalogLoading: boolean;
  /** Set when the offer catalog failed to load. */
  catalogError: unknown;
  /** Change fields of this step (name, type, offer, order bump). */
  onChange: (changes: Partial<UiStep>) => void;
  /** Replace the funnel's whole list of edges (a path added, changed or removed). */
  onEdgesChange: (edges: UiEdge[]) => void;
  /** "Edit page": open this step in the page editor. */
  onEditPage: () => void;
  /** A type picked from "Add next step": add that step after this one. */
  onAddNext: (type: UiStepType) => void;
  /** "Delete step" was pressed (the page asks to confirm). */
  onDelete: () => void;
  /** The inspector's close button: clear the selection. */
  onClose: () => void;
  /**
   * The split test running on this step, if any: its line shows only then.
   * Pass `null` for "none". Left out, the inspector looks it up itself
   * (the funnel's tests, read once per funnel and kept for the session).
   */
  runningTest?: { name: string } | null;
  /** Opens the tests sheet from the running-test line. Left out, the line has no button. */
  onOpenTests?: () => void;
  /** True drops the inspector's own title strip and close button (inside a sheet that has both). Default false. */
  hideHeader?: boolean;
}

/**
 * The selected step, as short stacked groups: what to fix, its name and key,
 * its type, its offer, where the shopper goes next, its page, and — at the
 * bottom — the next step and delete. It fills the box it is given and scrolls
 * inside it.
 */
export function StepInspector({ step, ...rest }: StepInspectorProps) {
  if (!step) return <StepInspectorEmpty />;
  return <StepInspectorBody step={step} {...rest} />;
}

/** Nothing selected: what this pane is for, in two lines. */
export function StepInspectorEmpty({ className }: { className?: string }) {
  const t = useT(PANE_STRINGS);
  return (
    <div data-slot="funnel-inspector-empty" className={cn("flex flex-col items-center gap-2 px-6 py-10 text-center", className)}>
      <IconFlow className="size-10 text-ink-soft rtl:-scale-x-100" aria-hidden />
      <p className="text-sm font-semibold text-ink">{t.emptyTitle}</p>
      <p className="max-w-64 text-sm leading-6 text-ink-soft">{t.emptyBody}</p>
    </div>
  );
}

/** One titled group of the inspector. */
function Group({ title, hint, action, children }: { title: string; hint?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="zimos-funnel-group space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {hint && <p className="text-xs leading-5 text-ink-soft">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** The fields of the panes: 44px and 16px type under a thumb, the dashboard's 36px on a desktop. */
const FIELD = "h-11 text-base md:h-9 md:text-sm";

/** A way out carries its arrow's colour from the flow map on its leading edge. */
const WAY_TONE: Record<UiEdgeCondition, string> = {
  always: "border-s-line-strong",
  completed_checkout: "border-s-primary",
  accepted_offer: "border-s-success",
  declined_offer: "border-s-danger",
  clicked_through: "border-s-ink",
};

/** The label a page button carries, for "when they press «…»". */
function buttonLabelOf(step: UiStep, elementId: string): string | null {
  for (const section of step.tree.sections) {
    for (const row of section.rows ?? []) {
      for (const column of row.columns ?? []) {
        for (const element of column.elements ?? []) {
          if (element.id !== elementId) continue;
          const label = ((element.props ?? {}) as Record<string, unknown>).label;
          return typeof label === "string" && label.trim() ? label.trim() : null;
        }
      }
    }
  }
  return null;
}

function StepInspectorBody({
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
  runningTest,
  onOpenTests,
  hideHeader = false,
}: Omit<StepInspectorProps, "step"> & { step: UiStep }) {
  const t = useT(PANE_STRINGS);
  const workspaceId = useWorkspaceId();
  const { locale } = useLocale();
  const sectionCount = step.tree.sections.length;
  const elementCount = pageElementCount(step.tree);
  const needsOffer = STEP_TYPES[step.type].needsOffer;
  const offerStep = step.type === "upsell" || step.type === "downsell";
  const outgoing = funnel.edges.filter((e) => e.fromStepKey === step.key).sort((a, b) => b.priority - a.priority);
  const others = funnel.steps.filter((s) => s.key !== step.key);

  const entries = catalog ?? [];
  const owner = step.offerId ? entries.find((e) => e.offers.some((o) => o.id === step.offerId)) ?? null : null;
  const [productId, setProductId] = useState<string>(owner?.product.id ?? "");
  const chosen = entries.find((e) => e.product.id === (owner?.product.id ?? productId)) ?? null;
  const currentOffer = owner?.offers.find((o) => o.id === step.offerId) ?? null;
  const offerMissing = Boolean(step.offerId) && catalog !== null && !catalogLoading && !catalogError && !owner;

  // The running test on this step: the page's word when it gives one, else the funnel's own list (quietly: no test, no line).
  const lookUpTests = runningTest === undefined;
  const tests = useCachedAsync<SplitTest[]>(
    lookUpTests ? `funnel-split-tests:${workspaceId}:${funnel.id}` : null,
    () => (lookUpTests ? splitTestsList(apiClient, workspaceId, funnel.id) : Promise.resolve([])),
    [workspaceId, funnel.id, lookUpTests]
  );
  const found = lookUpTests ? (tests.data ?? []).find((x) => x.stepKey === step.key && x.status === "running") : null;
  const test = lookUpTests ? (found ? { name: found.name } : null) : runningTest;

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

  function changeType(type: UiStepType) {
    if (type === step.type) return;
    // Only a checkout step has a form to offer a bump on.
    onChange(type === "checkout" ? { type } : { type, bumpOfferId: null });
  }

  // The conditions that mean something on this type first; the rest stay one group away.
  const sensible = SENSIBLE_CONDITIONS[step.type];
  const otherConditions = CONDITION_ORDER.filter((c) => !sensible.includes(c));
  const conditionWords = (edge: UiEdge, condition: UiEdgeCondition) => {
    if (condition === "clicked_through" && edge.condition === "clicked_through" && edge.sourceElementId) {
      const label = buttonLabelOf(step, edge.sourceElementId);
      if (label) return fmt(t.whenButton, { label });
    }
    return CONDITION_WORDS[locale][condition];
  };

  const sameCondition = outgoing.some((a, i) =>
    outgoing.some((b, j) => j > i && a.condition === b.condition && (a.sourceElementId ?? null) === (b.sourceElementId ?? null))
  );
  const catchesAll = outgoing.some((e) => e.condition === "always");
  const noAccept = offerStep && outgoing.length > 0 && !catchesAll && !outgoing.some((e) => e.condition === "accepted_offer");
  const noDecline = offerStep && outgoing.length > 0 && !catchesAll && !outgoing.some((e) => e.condition === "declined_offer");

  return (
    <div data-slot="funnel-inspector" className="zimos-funnel-pane flex h-full min-h-0 w-full min-w-0 flex-col">
      {!hideHeader && (
        <div className="flex shrink-0 items-center gap-2.5 border-b border-line py-2 ps-4 pe-2">
          <StepTypeTile type={step.type} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{t.stepSettings}</p>
            <p className="truncate text-xs text-ink-soft">{STEP_TYPE_LABELS[locale][step.type]}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            title={t.close}
            className="zimos-funnel-icon-button flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[background-color,color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none"
          >
            <IconClose className="size-4" aria-hidden />
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-4">
        {problems.length > 0 && (
          <div role="alert" data-slot="funnel-fix-box" className="zimos-funnel-fix rounded-[1rem] border border-accent/40 bg-accent-soft p-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <IconWarning className="size-4 shrink-0 text-accent-dark" aria-hidden /> {t.problems}
            </p>
            <ul className="mt-1.5 list-disc space-y-1 ps-5 text-sm leading-5 text-ink">
              {problems.map((p, i) => (
                <li key={i} dir="auto">
                  {p.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Name and key */}
        <section className="zimos-funnel-group space-y-1.5">
          <Label htmlFor="step-name">{t.name}</Label>
          <Input
            id="step-name"
            dir="auto"
            maxLength={200}
            value={step.name}
            aria-invalid={step.name.trim() === "" ? true : undefined}
            aria-describedby={step.name.trim() === "" ? "step-name-error" : undefined}
            onChange={(e) => onChange({ name: e.target.value })}
            className={cn("zimos-funnel-name font-medium", FIELD)}
          />
          {step.name.trim() === "" && (
            <p id="step-name-error" className="text-xs leading-5 text-danger">
              {t.nameEmpty}
            </p>
          )}
          <div className="flex min-h-9 items-center gap-1 text-xs text-ink-soft">
            <span className="shrink-0">{t.key}:</span>
            <bdi dir="ltr" className="min-w-0 truncate font-mono text-ink">
              {step.key}
            </bdi>
            <CopyButton value={step.key} label={t.copyKey} iconOnly className="ms-auto" />
          </div>
        </section>

        {/* Type */}
        <section className="zimos-funnel-group space-y-1.5">
          <Label htmlFor="step-type">{t.type}</Label>
          <StepTypePicker
            title={t.typeTitle}
            description={t.typeHint}
            current={step.type}
            align="start"
            onPick={changeType}
            trigger={
              <button
                type="button"
                id="step-type"
                className="zimos-funnel-select flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-[0.875rem] border border-line-strong bg-paper-raised py-1 ps-1.5 pe-3 text-start text-base text-ink transition-[scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100 md:text-sm"
              >
                <StepTypeTile type={step.type} size="sm" />
                <span className="min-w-0 flex-1 truncate font-medium">{STEP_TYPE_LABELS[locale][step.type]}</span>
                <IconCaretDown className="size-3.5 shrink-0 text-ink-soft" aria-hidden />
              </button>
            }
          />
        </section>

        {/* Offer */}
        {(needsOffer || step.offerId) && (
          <Group title={t.offer}>
            {catalogLoading ? (
              <p className="flex items-center gap-2 text-xs text-ink-soft">
                <Spinner className="size-4" /> {t.offersLoading}
              </p>
            ) : catalogError ? (
              <p className="text-xs leading-5 text-danger">{t.offersError}</p>
            ) : entries.length === 0 ? (
              <p className="text-xs leading-5 text-ink-soft">{t.noProducts}</p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="step-product">{t.product}</Label>
                  <Select id="step-product" className={FIELD} value={chosen?.product.id ?? ""} onChange={(e) => pickProduct(e.target.value)}>
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
                      <p className="text-xs leading-5 text-ink-soft">{t.noOffers}</p>
                    ) : (
                      <Select
                        id="step-offer"
                        className={FIELD}
                        value={step.offerId ?? ""}
                        aria-invalid={needsOffer && !step.offerId ? true : undefined}
                        onChange={(e) => onChange({ offerId: e.target.value || null })}
                      >
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
                  <p className="text-xs leading-5 text-ink-soft">
                    {t.offerPrice}:{" "}
                    {currentOffer.priceAmount !== null ? (
                      <bdi dir="ltr" className="font-medium text-ink tabular-nums">
                        {formatMoney(currentOffer.priceAmount, currentOffer.currency)}
                      </bdi>
                    ) : (
                      t.offerPriceNone
                    )}
                  </p>
                )}
              </>
            )}
            {offerMissing && <p className="text-xs leading-5 text-danger">{t.offerMissing}</p>}
            {needsOffer && !step.offerId && <p className="text-xs leading-5 text-danger">{t.required}</p>}
          </Group>
        )}

        {/* Checkout add-on offer */}
        {step.type === "checkout" && (
          <Group title={t.bump} hint={t.bumpHint}>
            <OfferPicker workspaceId={workspaceId} value={step.bumpOfferId} onChange={(bumpOfferId) => onChange({ bumpOfferId })} label={t.bumpLabel} />
          </Group>
        )}

        {/* The ways out */}
        <Group title={t.after} hint={t.afterHint}>
          {outgoing.length === 0 ? (
            <p className="text-xs leading-5 text-ink-soft">{step.type === "thank_you" ? t.thankYouEnds : t.noWays}</p>
          ) : (
            <ul className="space-y-2">
              {outgoing.map((e) => {
                const targetGone = !funnel.steps.some((s) => s.key === e.toStepKey);
                return (
                  <li key={e.id} data-slot="funnel-way" data-condition={e.condition} className={cn("zimos-funnel-way space-y-2 rounded-[1rem] border border-s-[3px] border-line bg-paper p-2.5", WAY_TONE[e.condition])}>
                    <div className="flex items-center gap-1">
                      <Select
                        value={e.condition}
                        onChange={(ev) => updateEdge(e.id, { condition: ev.target.value as UiEdgeCondition })}
                        className={cn(FIELD, "min-w-0 flex-1 font-medium")}
                        aria-label={t.wayWhen}
                      >
                        {sensible.map((cond) => (
                          <option key={cond} value={cond}>
                            {conditionWords(e, cond)}
                          </option>
                        ))}
                        <optgroup label={t.otherConditions}>
                          {otherConditions.map((cond) => (
                            <option key={cond} value={cond}>
                              {conditionWords(e, cond)}
                            </option>
                          ))}
                        </optgroup>
                      </Select>
                      <button
                        type="button"
                        onClick={() => removeEdge(e.id)}
                        aria-label={t.removeWay}
                        title={t.removeWay}
                        className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none md:size-9"
                      >
                        <IconDelete className="size-4" aria-hidden />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <IconArrowRight className="size-4 shrink-0 text-ink-soft rtl:rotate-180" aria-hidden />
                      <Select
                        value={targetGone ? "" : e.toStepKey}
                        onChange={(ev) => {
                          if (ev.target.value) updateEdge(e.id, { toStepKey: ev.target.value });
                        }}
                        className={cn(FIELD, "min-w-0 flex-1")}
                        aria-label={t.wayTo}
                        aria-invalid={targetGone ? true : undefined}
                      >
                        {targetGone && <option value="">{t.pickStep}</option>}
                        {others.map((s) => (
                          <option key={s.key} value={s.key}>
                            {fmt(t.wayToOption, { name: s.name })}
                          </option>
                        ))}
                      </Select>
                    </div>
                    {targetGone && <p className="text-xs leading-5 text-danger">{t.wayGone}</p>}
                    {outgoing.length > 1 && (
                      <label className="flex items-center gap-2 text-xs text-ink-soft" title={t.priorityHint}>
                        <span className="min-w-0 flex-1">{t.priority}</span>
                        <Input
                          type="number"
                          inputMode="numeric"
                          dir="ltr"
                          min={0}
                          value={e.priority}
                          onChange={(ev) => updateEdge(e.id, { priority: Math.max(0, Math.floor(Number(ev.target.value)) || 0) })}
                          className={cn(FIELD, "w-20 text-center tabular-nums")}
                        />
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {outgoing.length > 1 && <p className="text-xs leading-5 text-ink-soft">{t.priorityHint}</p>}
          {sameCondition && <p className="text-xs leading-5 text-accent-dark">{t.sameCondition}</p>}
          {noAccept && <p className="text-xs leading-5 text-accent-dark">{t.noAccept}</p>}
          {noDecline && <p className="text-xs leading-5 text-accent-dark">{t.noDecline}</p>}
          <Button type="button" variant="outline" className="min-h-11 w-full md:min-h-9" onClick={addEdge} disabled={others.length === 0}>
            <IconPlus className="size-4" aria-hidden /> {t.addWay}
          </Button>
          {others.length === 0 && <p className="text-xs leading-5 text-ink-soft">{t.needOtherStep}</p>}
        </Group>

        {/* The page */}
        <Group title={t.page}>
          <div className="zimos-funnel-way space-y-2.5 rounded-[1rem] border border-line bg-paper p-2.5">
            <PageThumb tree={step.tree} />
            <p className={cn("text-xs leading-5", elementCount === 0 ? "text-danger" : "text-ink-soft")}>
              {elementCount === 0
                ? t.pageEmpty
                : fmt(t.pageCount, { sections: pluralOf(t, "section", sectionCount), elements: pluralOf(t, "element", elementCount) })}
            </p>
            <Button type="button" className="min-h-11 w-full md:min-h-9" onClick={onEditPage}>
              <IconDraft className="size-4" aria-hidden /> {t.openPage}
            </Button>
          </div>
        </Group>

        {/* A running split test */}
        {test && (
          <div data-slot="funnel-test-line" className="zimos-funnel-way flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[1rem] border border-line bg-paper p-3">
            <IconExperiment className="size-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{t.testRunning}</p>
              {test.name && (
                <p className="text-xs leading-5 text-ink-soft" dir="auto">
                  {fmt(t.testNamed, { name: test.name })}
                </p>
              )}
            </div>
            {onOpenTests && (
              <Button type="button" variant="outline" size="sm" className="min-h-11 md:min-h-8" onClick={onOpenTests}>
                {t.openTests}
              </Button>
            )}
          </div>
        )}

        {/* The next step, and delete */}
        <div className="space-y-2 border-t border-line pt-4">
          <StepTypePicker
            title={t.addNextTitle}
            align="center"
            onPick={onAddNext}
            trigger={
              <Button type="button" variant="outline" className="min-h-11 w-full md:min-h-9">
                <IconPlus className="size-4" aria-hidden /> {t.addNext}
              </Button>
            }
          />
          <Button type="button" variant="ghost" className="min-h-11 w-full text-danger hover:bg-danger-soft hover:text-danger md:min-h-9" onClick={onDelete}>
            <IconDelete className="size-4" aria-hidden /> {t.deleteStep}
          </Button>
        </div>
      </div>
    </div>
  );
}
