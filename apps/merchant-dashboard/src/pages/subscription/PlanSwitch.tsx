import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, cn, ZLoader } from "@store-builder/ui";
import type {
  BillingCycle,
  PlanSwitch,
  PlanSwitchPreview,
  PlanSwitchStartResult,
  PlanSwitchTiming,
  SubscriptionPlan,
  SubscriptionPlans,
} from "@store-builder/api-client";
import { apiErrorCode, apiErrorDetails } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate, formatDateTime, formatMinorMoney } from "@/lib/format";
import { formatDays } from "@/lib/planDisplay";
import { formatHours, renewalLine, timingChoices, toPayPerOrder, withTiming } from "./planSwitchMode";
import { useLocale, useT, fmt } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { PLAN_SWITCH_STRINGS, type PlanSwitchText } from "./planSwitchStrings";
import { SUBSCRIPTION_STRINGS } from "./subscriptionStrings";

/**
 * Changing plan by itself (the backend's /billing/plan-switch,
 * PLAN_SWITCH_ENABLED): a confirmation that shows the server's preview before
 * anything is written, and the banner of the switch waiting. Paying is the
 * Invoices tab's Pay dialog, as for every charge (`PAY_NOW_LINK`).
 */

/** The Invoices tab with its Pay dialog open (SubscriptionPage). */
export const PAY_NOW_LINK = "/subscription?tab=invoices&pay=1";

/** The error codes of a preview or a start, worded for this screen. */
function useSwitchErrors() {
  const s = useT(PLAN_SWITCH_STRINGS);
  const t = useT(SUBSCRIPTION_STRINGS);
  const errorMessage = useErrorMessage();
  return useCallback(
    (err: unknown) => {
      const currency = apiErrorDetails<{ currency?: string }>(err)?.currency ?? "";
      return errorMessage(err, {
        PLAN_SWITCH_DISABLED: s.disabled,
        PLAN_NOT_AVAILABLE: t.planNotAvailable,
        PLAN_CHANGE_NEEDS_SUPPORT: s.reasonClosed,
        MANUAL_PRICING: s.reasonManual,
        SPECIAL_TERMS_ACTIVE: s.reasonSpecial,
        PROOF_UNDER_REVIEW: s.blockedProof,
        PLAN_SWITCH_ALREADY_BILLED: s.blockedBilled,
        NO_PAYMENT_METHOD: fmt(s.blockedNoMethod, { currency }),
        SWITCH_AMOUNT_CHANGED: s.amountChanged,
        SWITCH_TIMING_NOT_AVAILABLE: s.timingNotAvailable,
        PLAN_SWITCH_BUSY: s.busy,
        OPEN_CHARGE_EXISTS: t.moveOtherCharge,
        WALLET_DEBT_OUTSTANDING: t.moveDebtError,
      });
    },
    [s, t, errorMessage]
  );
}

/** The codes after which the merchant can only ask support: shown with the way to reach it. */
const SUPPORT_CODES = new Set(["PLAN_SWITCH_DISABLED", "PLAN_CHANGE_NEEDS_SUPPORT", "MANUAL_PRICING", "SPECIAL_TERMS_ACTIVE", "NO_PAYMENT_METHOD"]);

function SupportLink() {
  const s = useT(PLAN_SWITCH_STRINGS);
  return (
    <Link to="/support" className="font-medium underline">
      {s.contactSupport}
    </Link>
  );
}

// ------------------------------------------------------------ the dialog

/** A plan card's switch, or the pay-per-order card's (its plan from `payPerOrder.plan`). */
export interface SwitchTarget {
  plan: Pick<SubscriptionPlan, "id" | "name">;
  cycle: BillingCycle;
}

/**
 * The confirmation: asks the server what switching to `target` would do,
 * shows it, and only then starts it, with the amount shown as
 * `expectedAmount`. If that amount no longer holds the preview is read again.
 * An upgrade inside a paid period offers two timings (the days left first):
 * upgrade now at the full price, or wait for the end of the subscription;
 * the one chosen is sent as `timing`.
 */
export function PlanSwitchDialog({
  target,
  view,
  onClose,
  onDone,
}: {
  target: SwitchTarget | null;
  view: SubscriptionPlans;
  onClose: () => void;
  onDone: (result: PlanSwitchStartResult) => void;
}) {
  const s = useT(PLAN_SWITCH_STRINGS);
  return (
    <Modal open={Boolean(target)} onClose={onClose} title={target ? fmt(s.dialogTitle, { plan: target.plan.name }) : s.bannerTitle}>
      {target && <SwitchBody key={`${target.plan.id}:${target.cycle}`} target={target} view={view} onClose={onClose} onDone={onDone} />}
    </Modal>
  );
}

function SwitchBody({
  target,
  view,
  onClose,
  onDone,
}: {
  target: SwitchTarget;
  view: SubscriptionPlans;
  onClose: () => void;
  onDone: (result: PlanSwitchStartResult) => void;
}) {
  const s = useT(PLAN_SWITCH_STRINGS);
  const workspaceId = useWorkspaceId();
  const describeError = useSwitchErrors();
  const [preview, setPreview] = useState<PlanSwitchPreview | null>(null);
  const [loadError, setLoadError] = useState<{ message: string; support: boolean } | null>(null);
  // Bumped to read the preview again (the amount changed, or another change was made).
  const [asked, setAsked] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [timing, setTiming] = useState<PlanSwitchTiming>("now");

  useEffect(() => {
    let live = true;
    apiClient
      .previewPlanSwitch(workspaceId, { planId: target.plan.id, billingCycle: target.cycle })
      .then(({ preview: next }) => live && setPreview(next))
      .catch((err) => live && setLoadError({ message: describeError(err), support: SUPPORT_CODES.has(apiErrorCode(err) ?? "") }));
    return () => {
      live = false;
    };
  }, [workspaceId, target.plan.id, target.cycle, asked, describeError]);

  // The timings to choose between (an upgrade), and the preview as it reads for the one chosen.
  const choices = preview ? timingChoices(preview) : null;
  const shown = preview && choices ? withTiming(preview, choices.includes(timing) ? timing : choices[0]) : preview;

  async function confirm() {
    if (!preview || !shown) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await apiClient.startPlanSwitch(workspaceId, {
        planId: target.plan.id,
        billingCycle: target.cycle,
        // Sent only when there was a choice: any other switch has one timing.
        ...(choices && shown.timing ? { timing: shown.timing } : {}),
        expectedAmount: shown.amountDue,
      });
      onDone(result);
    } catch (err) {
      const code = apiErrorCode(err);
      if (code === "SWITCH_AMOUNT_CHANGED" || code === "PLAN_SWITCH_BUSY" || code === "SWITCH_TIMING_NOT_AVAILABLE") {
        // Read again: the merchant confirms what is true now.
        setNotice(code === "SWITCH_AMOUNT_CHANGED" ? s.amountChanged : code === "PLAN_SWITCH_BUSY" ? s.busy : s.timingNotAvailable);
        setPreview(null);
        setAsked((n) => n + 1);
      } else {
        setError(describeError(err));
      }
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <Alert variant="danger" role="alert">
          {loadError.message} {loadError.support && <SupportLink />}
        </Alert>
        <div className="flex justify-end">
          <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>
            {s.close}
          </Button>
        </div>
      </div>
    );
  }
  if (!preview || !shown) {
    return (
      <div className="space-y-3">
        {notice && <Alert role="status">{notice}</Alert>}
        <div className="flex min-h-11 items-center">
          <ZLoader label={s.loading} />
        </div>
      </div>
    );
  }

  const confirmLabel = confirmLabelOf(shown, s);
  return (
    <div className="space-y-4">
      {notice && <Alert role="status">{notice}</Alert>}
      {preview.currentPeriod && (choices || toPayPerOrder(preview)) && <DaysLeft period={preview.currentPeriod} />}
      {choices && shown.timing && (
        <TimingChoice preview={preview} choices={choices} value={shown.timing} disabled={busy} onChange={setTiming} />
      )}
      <PreviewDetails preview={shown} view={view} />
      {shown.blockedBy && (
        <Alert variant="danger" role="alert">
          {blockedText(shown, s)} {shown.blockedBy === "NO_PAYMENT_METHOD" && <SupportLink />}
        </Alert>
      )}
      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" className="min-h-11" onClick={onClose} disabled={busy}>
          {s.close}
        </Button>
        {confirmLabel && (
          <Button type="button" className="min-h-11" onClick={() => void confirm()} disabled={busy || Boolean(shown.blockedBy)}>
            {busy ? s.confirming : confirmLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

/** "15 days left in your current subscription (ends on …)": the paid period running now. */
function DaysLeft({ period }: { period: NonNullable<PlanSwitchPreview["currentPeriod"]> }) {
  const s = useT(PLAN_SWITCH_STRINGS);
  const { locale } = useLocale();
  return (
    <p className="text-sm font-medium text-ink">{fmt(s.daysLeftLine, { days: formatDays(period.remainingDays, locale), date: formatDate(period.endsAt) })}</p>
  );
}

/** An upgrade's two timings: now at the full price, or at the end of the subscription with its renewal then. */
function TimingChoice({
  preview,
  choices,
  value,
  disabled,
  onChange,
}: {
  preview: PlanSwitchPreview;
  choices: PlanSwitchTiming[];
  value: PlanSwitchTiming;
  disabled: boolean;
  onChange: (next: PlanSwitchTiming) => void;
}) {
  const s = useT(PLAN_SWITCH_STRINGS);
  const groupId = useId();
  const plan = preview.to.planName;
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend id={groupId} className="mb-1 text-sm font-medium text-ink">
        {fmt(s.timingLegend, { plan })}
      </legend>
      <div role="radiogroup" aria-labelledby={groupId} className="grid gap-2">
        {choices.map((choice) => {
          const option = preview.options![choice]!;
          const renewal = option.nextRenewal ? formatMinorMoney(option.nextRenewal.amount, option.nextRenewal.currency) : "";
          const hint =
            choice === "now"
              ? fmt(s.timingNowHint, { amount: formatMinorMoney(option.amountDue, option.currency), plan })
              : fmt(s.timingLaterHint, { plan, date: formatDate(option.effectiveAt), amount: renewal });
          return (
            <label
              key={choice}
              className={cn(
                "flex min-h-11 cursor-pointer items-start gap-3 rounded-[10px] border px-3 py-2.5 text-sm",
                value === choice ? "border-primary bg-primary-soft text-ink" : "border-line text-ink-soft"
              )}
            >
              <input type="radio" name={`switch-timing-${groupId}`} value={choice} checked={value === choice} onChange={() => onChange(choice)} className="mt-1" />
              <span className="min-w-0">
                <span className="block font-medium text-ink">{choice === "now" ? s.timingNow : s.timingLater}</span>
                <span className="block text-xs text-ink-soft">{hint}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function blockedText(preview: PlanSwitchPreview, s: PlanSwitchText): string {
  if (preview.blockedBy === "PROOF_UNDER_REVIEW") return s.blockedProof;
  if (preview.blockedBy === "PLAN_SWITCH_ALREADY_BILLED") return s.blockedBilled;
  return fmt(s.blockedNoMethod, { currency: preview.currency });
}

/** The confirm button's words; null when there is nothing to confirm. */
function confirmLabelOf(preview: PlanSwitchPreview, s: PlanSwitchText): string | null {
  if (preview.kind === "none") return preview.replaces ? s.confirmKeep : null;
  if (preview.amountDue > 0) return fmt(s.confirmPay, { amount: formatMinorMoney(preview.amountDue, preview.currency) });
  if (preview.kind === "scheduled") {
    const date = formatDate(preview.effectiveAt);
    if (preview.reason === "upgrade") return fmt(s.confirmLater, { date });
    if (preview.reason === "to_pay_per_order") return fmt(s.confirmPayPerOrder, { date });
    return s.confirmSchedule;
  }
  return s.confirmNow;
}

/** What the switch is, in a sentence, then its figures: due now, the days left, when it starts, the next renewal. */
function PreviewDetails({ preview, view }: { preview: PlanSwitchPreview; view: SubscriptionPlans }) {
  const s = useT(PLAN_SWITCH_STRINGS);
  const { locale } = useLocale();
  const plan = preview.to.planName;
  const from = preview.from?.planName ?? "";
  const date = formatDate(preview.effectiveAt);
  const proration = preview.proration;

  let body: string;
  switch (preview.kind) {
    case "upgrade":
      // The full price for a full period; an older API priced the days left.
      body = proration
        ? fmt(s.upgradeProratedBody, { plan, from, days: formatDays(proration.remainingDays, locale) })
        : fmt(s.upgradeBody, { plan, from });
      break;
    case "move":
      body = fmt(s.moveBody, { plan });
      break;
    case "scheduled":
      if (preview.reason === "cycle_change") body = fmt(preview.to.billingCycle === "yearly" ? s.toYearlyBody : s.toMonthlyBody, { date });
      else if (preview.reason === "currency") body = fmt(s.currencyBody, { plan, currency: preview.to.currency, date });
      else if (preview.reason === "upgrade") {
        const amount = preview.nextRenewal ? formatMinorMoney(preview.nextRenewal.amount, preview.nextRenewal.currency) : "";
        body = fmt(s.upgradeLaterBody, { plan, from, date, amount });
      } else if (preview.reason === "to_pay_per_order") body = fmt(s.toPayPerOrderBody, { from, date });
      else body = fmt(s.downgradeBody, { plan, from, date });
      break;
    case "immediate":
      body =
        preview.reason === "to_pay_per_order"
          ? s.toPayPerOrderNowBody
          : preview.reason === "period_ended"
          ? fmt(s.endedBody, { plan })
          : preview.reason === "free_plan" || preview.nextRenewal === null
            ? fmt(s.freeBody, { plan })
            : preview.reason === "same_price" || preview.reason === "nothing_due"
              ? fmt(s.samePriceBody, { plan })
              : fmt(s.nowBody, { plan });
      break;
    case "trial_change":
      body = fmt(s.nowBody, { plan });
      break;
    default:
      body = preview.replaces ? s.noneCancelBody : s.noneBody;
  }

  const rows: Array<{ label: string; value: ReactNode }> = [];
  if (preview.amountDue > 0) {
    rows.push({ label: s.dueNow, value: <span className="tabular font-medium">{formatMinorMoney(preview.amountDue, preview.currency)}</span> });
  }
  if (proration && preview.kind === "upgrade") {
    rows.push({
      label: s.daysLeft,
      value: fmt(s.daysLeftValue, { days: formatDays(proration.remainingDays, locale), total: formatDays(proration.cycleDays, locale) }),
    });
    rows.push({
      label: s.prices,
      value: fmt(s.pricesValue, {
        from: formatMinorMoney(proration.fromPrice, proration.currency),
        to: formatMinorMoney(proration.toPrice, proration.currency),
      }),
    });
  }
  if (preview.kind !== "none") {
    rows.push({
      label: s.starts,
      value: preview.effective === "on_payment" ? s.startsOnPayment : preview.effective === "period_end" ? date : s.startsNow,
    });
  }
  // A free plan has no renewal: no row. A move's follows its payment (see renewalLine).
  const renewal = renewalLine(preview);
  if (renewal && preview.nextRenewal) {
    const amount = formatMinorMoney(preview.nextRenewal.amount, preview.nextRenewal.currency);
    rows.push({
      label: s.nextRenewal,
      value:
        renewal === "date"
          ? fmt(s.nextRenewalValue, { amount, date: formatDate(preview.nextRenewal.at) })
          : renewal === "after_payment"
            ? fmt(s.nextRenewalAfterPayment, { amount })
            : amount,
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink">{body}</p>
      {rows.length > 0 && (
        <dl className="divide-y divide-line rounded-[10px] border border-line bg-paper">
          {rows.map((row) => (
            <div key={row.label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
              <dt className="text-ink-soft">{row.label}</dt>
              <dd className="text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {preview.chargeExpiry ? (
        // The server says how long the charge would live (an upgrade or a move).
        <p className="text-xs text-ink-soft">
          {fmt(s.notPaidBy, { date: formatDateTime(preview.chargeExpiry.expiresAt), hours: formatHours(preview.chargeExpiry.hours, locale) })}
        </p>
      ) : (
        // An older API, or null: the words without a date.
        preview.amountDue > 0 && <p className="text-xs text-ink-soft">{s.notPaidNote}</p>
      )}
      {preview.replaces && preview.kind !== "none" && <p className="text-xs text-ink-soft">{replacesText(preview, view, s)}</p>}
    </div>
  );
}

function replacesText(preview: PlanSwitchPreview, view: SubscriptionPlans, s: PlanSwitchText): string {
  const replaces = preview.replaces!;
  if (replaces.kind === "renewal") return s.replacesRenewal;
  const open = view.planSwitch?.open;
  const name = open && open.id === replaces.switchId ? open.to.planName : null;
  return name ? fmt(s.replacesSwitch, { plan: name }) : s.replacesSwitchGeneric;
}

// ------------------------------------------------------------ the banner

/**
 * The switch waiting, above the cards: an upgrade (or a move) with its
 * amount, Pay now (the Invoices tab's Pay dialog) and Cancel; a scheduled
 * change with its date and Cancel ("Deferred change" for an upgrade left for
 * the end of the subscription and the move to pay per order). Shown whenever
 * the server lists one, also with PLAN_SWITCH_ENABLED off (cancelling still
 * works then).
 */
export function PlanSwitchBanner({
  open,
  onPlansChange,
  onChanged,
}: {
  open: PlanSwitch;
  onPlansChange: (next: SubscriptionPlans) => void;
  onChanged: () => void;
}) {
  const s = useT(PLAN_SWITCH_STRINGS);
  const t = useT(SUBSCRIPTION_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cycle = open.to.billingCycle === "yearly" ? t.cycleYearly : t.cycleMonthly;
  const names = { plan: open.to.planName ?? "", from: open.from.planName ?? "", cycle };

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      const { plans } = await apiClient.cancelPlanSwitch(workspaceId);
      onPlansChange(plans);
      toast.success(s.cancelled);
      onChanged();
    } catch (err) {
      setError(errorMessage(err, { PROOF_UNDER_REVIEW: s.cancelProof, PLAN_SWITCH_ALREADY_BILLED: s.blockedBilled }));
      setBusy(false);
    }
  }

  // A transfer for its charge is with the console (absent from an older API: then
  // Cancel stays, and its 409 PROOF_UNDER_REVIEW is worded above).
  const underReview = open.status === "pending" && open.proofUnderReview === true;
  const sameCycleChange = open.status === "scheduled" && open.from.planId === open.to.planId;
  // Left for the end of the paid period by the merchant's choice: an upgrade, or the move to pay per order.
  const deferredUpgrade = open.status === "scheduled" && open.reason === "upgrade";
  const deferredPayPerOrder = open.status === "scheduled" && toPayPerOrder(open);
  const date = formatDate(open.effectiveAt);
  let body: string;
  if (open.status === "pending") {
    body = fmt(s.pendingBody, { ...names, amount: open.amountDue != null && open.currency ? formatMinorMoney(open.amountDue, open.currency) : "" });
  } else if (deferredPayPerOrder) {
    body = fmt(s.scheduledPayPerOrderBody, { ...names, date });
  } else if (deferredUpgrade) {
    body = fmt(s.scheduledUpgradeBody, { ...names, date });
  } else if (sameCycleChange) {
    body = fmt(open.to.billingCycle === "yearly" ? s.toYearlyBody : s.toMonthlyBody, { date });
  } else {
    body = fmt(s.scheduledBody, { ...names, date });
  }

  return (
    <section aria-labelledby="plan-switch-title" className="space-y-2 rounded-[var(--radius-card)] border border-line bg-paper-raised p-4">
      <h2 id="plan-switch-title" className="font-display text-base font-medium text-ink">
        {deferredUpgrade || deferredPayPerOrder ? s.deferredTitle : s.bannerTitle}
      </h2>
      <Alert role="status">{body}</Alert>
      {underReview ? (
        // The console is checking a transfer: nothing to do but wait (it doesn't lapse meanwhile).
        <p className="text-sm font-medium text-ink">{s.underReview}</p>
      ) : (
        <>
          {open.status === "pending" && open.expiresAt && (
            <p className="text-xs text-ink-soft">{fmt(s.pendingExpires, { date: formatDateTime(open.expiresAt) })}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {open.status === "pending" && (
              <Button asChild className="min-h-11">
                <Link to={PAY_NOW_LINK}>{t.payNow}</Link>
              </Button>
            )}
            <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => void cancel()}>
              {busy ? s.cancelling : s.cancelSwitch}
            </Button>
          </div>
        </>
      )}
      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}
    </section>
  );
}
