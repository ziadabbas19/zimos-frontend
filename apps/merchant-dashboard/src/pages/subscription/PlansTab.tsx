import { useId, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert, Button, Input, Label, cn } from "@store-builder/ui";
import type {
  BillingCycle,
  PlanPrice,
  PlanSwitchStartResult,
  ReferralSchedulePayment,
  SubscriptionPlan,
  SubscriptionPlans,
  WorkspaceBilling,
} from "@store-builder/api-client";
import { apiErrorDetails } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate, formatMinorMoney } from "@/lib/format";
import { noteWentLive } from "@/lib/goLive";
import { formatDays } from "@/lib/planDisplay";
import { useLocale, useT, fmt } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { CycleSwitch, PlanSummary } from "@/components/plans/PlanPicker";
import { BillingCycleChoice } from "./billingParts";
import { BILLING_STRINGS, codeDiscountLabel } from "./billingText";
import { PAY_STRINGS } from "./payStrings";
import { PAY_NOW_LINK, PlanSwitchBanner, PlanSwitchDialog, type SwitchTarget } from "./PlanSwitch";
import { selfServeSwitch, supportReasonText } from "./planSwitchMode";
import { PLAN_SWITCH_STRINGS } from "./planSwitchStrings";
import { REFERRAL_CODE_STRINGS, referralErrorMap, scheduleLabel } from "./referralCodeStrings";
import { ScheduleTable } from "./ReferralSchedule";
import { SUBSCRIPTION_STRINGS } from "./subscriptionStrings";
import { WALLET_STRINGS } from "./walletStrings";

/** The Usage tab, where the prepaid balance is topped up. */
const TOP_UP_LINK = "/subscription?tab=usage";

/**
 * What a card offers, from the subscription's state (see the backend's
 * merchantPlansService and planSwitchService). switch / switchPay /
 * switchScheduled only while the server says the store changes plan by itself
 * (`planSwitch.mode` "switch", PLAN_SWITCH_ENABLED).
 */
type CardAction = "trial" | "choose" | "move" | "movePay" | "switch" | "switchPay" | "switchScheduled" | "support" | "current" | "none";

function actionFor(plan: SubscriptionPlan, view: SubscriptionPlans, cycle: BillingCycle): CardAction {
  if (view.trial.available && plan.trialDays > 0 && (plan.isPublic || plan.isCurrent)) return "trial";
  if (selfServeSwitch(view)) {
    // The switch waiting is this card's (plan and cycle): it leads to paying it, or says when it starts.
    const open = view.planSwitch?.open;
    if (open && open.to.planId === plan.id && open.to.billingCycle === cycle) return open.status === "pending" ? "switchPay" : "switchScheduled";
    // The store's own plan on the other cycle: a change of billing at the end of the period.
    if (plan.isCurrent) return cycle === view.subscription.billingCycle ? "current" : "switch";
    return plan.isPublic ? "switch" : "none";
  }
  if (plan.isCurrent) return "current";
  if (!plan.isPublic) return "none";
  // A store on pay per order moves by itself; while a move waits, only its plan's card leads to paying it.
  const move = view.move;
  if (move?.available) {
    // Another plan replaces the waiting move (the server voids it).
    if (move.pending) return move.pending.planId === plan.id ? "movePay" : "move";
    return "move";
  }
  return view.planChange === "immediate" ? "choose" : "support";
}

const priceFor = (prices: { monthly: PlanPrice; yearly: PlanPrice }, cycle: BillingCycle) => (cycle === "yearly" ? prices.yearly : prices.monthly);

/**
 * The plan cards: features and limits, the store's own plan marked, prices
 * for the chosen cycle (with what annual saves), a code field on each, and
 * the one action the subscription allows — a free trial from a draft, the
 * plan itself while nothing is paid, or support once paid. Every price is
 * the server's. The current plan's card leads to paying ("Pay now") while
 * its next charge is due and no paid period runs — so right after a priced
 * plan is chosen, once the summary is read again.
 */
export function PlansTab({
  view,
  billing,
  onPlansChange,
  onBillingChange,
  onChanged,
}: {
  view: SubscriptionPlans;
  billing: WorkspaceBilling | null;
  onPlansChange: (next: SubscriptionPlans) => void;
  onBillingChange: (next: WorkspaceBilling) => void;
  /** Something changed that the summary and the banners show. */
  onChanged: () => void;
}) {
  const t = useT(SUBSCRIPTION_STRINGS);
  const bt = useT(BILLING_STRINGS);
  const s = useT(PLAN_SWITCH_STRINGS);
  const rt = useT(REFERRAL_CODE_STRINGS);
  const toast = useToast();
  const navigate = useNavigate();
  const [cycle, setCycle] = useState<BillingCycle>(view.subscription.billingCycle);
  const [switchTarget, setSwitchTarget] = useState<SwitchTarget | null>(null);
  const code = view.referralCode;
  const move = view.move?.available ? view.move : null;
  // Changing plan by itself (PLAN_SWITCH_ENABLED, a paid subscription): the
  // cycle picked here is the one switched to, and each card asks to switch.
  const selfServe = !move && selfServeSwitch(view);
  const supportReason = move ? null : supportReasonText(view, s);
  // The switch waiting, shown whenever the server lists one (also with the flag off).
  const openSwitch = move ? null : (view.planSwitch?.open ?? null);
  const paidPlan = billing?.subscription.plan;
  // The next charge, for the current plan's card — not while a paid period
  // runs (that renews from the Invoices tab). Read again after a plan change.
  const due =
    billing && billing.subscription.status !== "active" && billing.nextCharge
      ? { ...billing.nextCharge, planId: billing.subscription.plan?.id ?? null }
      : null;

  function switched(result: PlanSwitchStartResult) {
    setSwitchTarget(null);
    onPlansChange(result.plans);
    onChanged();
    const plan = result.switch?.to.planName ?? "";
    if (result.invoice && result.invoice.status === "pending" && (result.kind === "upgrade" || result.kind === "move")) {
      // The charge is written: the usual Pay dialog pays it.
      toast.success(fmt(s.startedPay, { amount: formatMinorMoney(result.invoice.amountDue, result.invoice.currency), plan }));
      navigate(PAY_NOW_LINK);
    } else if (result.kind === "scheduled") {
      toast.success(fmt(s.startedScheduled, { plan, date: formatDate(result.switch?.effectiveAt) }));
    } else if (result.kind === "none") {
      if (result.changed) toast.success(s.keptCurrent);
    } else if (result.changed || result.created) {
      toast.success(t.planChanged);
    }
  }

  return (
    <div className="space-y-5">
      {view.trial.available && (
        <Alert role="status">
          {t.trialNote} {t.trialEndNote}
        </Alert>
      )}
      {move ? (
        <MoveNotice move={move} onPlansChange={onPlansChange} onChanged={onChanged} />
      ) : selfServe ? (
        <p className="text-sm text-ink-soft">{s.selfServeNote}</p>
      ) : supportReason ? (
        <p className="text-sm text-ink-soft">{supportReason}</p>
      ) : (
        view.planChange === "support" && <p className="text-sm text-ink-soft">{t.paidNote}</p>
      )}
      {openSwitch && <PlanSwitchBanner open={openSwitch} onPlansChange={onPlansChange} onChanged={onChanged} />}

      {code && (
        <p className="text-sm text-ink" dir="auto">
          {code.active
            ? fmt(t.storeCode, { code: code.code, discount: scheduleLabel(code, cycle, rt) ?? codeDiscountLabel(code, bt) })
            : fmt(t.codeInactive, { code: code.code })}
        </p>
      )}

      {!move && !selfServe && view.planChange === "support" && billing && paidPlan && paidPlan.monthlyPrice > 0 ? (
        <BillingCycleChoice billing={billing} onChange={onBillingChange} />
      ) : (
        <CycleSwitch value={cycle} onChange={setCycle} />
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {view.plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            view={view}
            cycle={view.planChange === "support" && !move && !selfServe ? view.subscription.billingCycle : cycle}
            due={due}
            onPlansChange={onPlansChange}
            onChanged={onChanged}
            onSwitch={(target) => setSwitchTarget(target)}
          />
        ))}
        <PayPerOrderCard view={view} onPlansChange={onPlansChange} onChanged={onChanged} onSwitch={(target) => setSwitchTarget(target)} />
      </div>

      <PlanSwitchDialog target={switchTarget} view={view} onClose={() => setSwitchTarget(null)} onDone={switched} />
    </div>
  );
}

function PlanCard({
  plan,
  view,
  cycle,
  due,
  onPlansChange,
  onChanged,
  onSwitch,
}: {
  plan: SubscriptionPlan;
  view: SubscriptionPlans;
  cycle: BillingCycle;
  /** The store's next charge while it is due, and the plan it is for (see PlansTab). */
  due: (NonNullable<WorkspaceBilling["nextCharge"]> & { planId: string | null }) | null;
  onPlansChange: (next: SubscriptionPlans) => void;
  onChanged: () => void;
  /** Opens the switch's confirmation for this card (PlanSwitchDialog). */
  onSwitch: (target: SwitchTarget) => void;
}) {
  const t = useT(SUBSCRIPTION_STRINGS);
  const p = useT(PAY_STRINGS);
  const s = useT(PLAN_SWITCH_STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const navigate = useNavigate();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const action = actionFor(plan, view, cycle);
  const moveBlocked = action === "move" && ((view.move?.debt ?? 0) > 0 || Boolean(view.move?.otherChargeOpen));
  const price = priceFor(plan.prices, cycle);
  const yearlySaving = plan.prices.monthly.net * 12 - plan.prices.yearly.net;
  const titleId = useId();
  // Right after a change the summary may still hold the old plan's charge: shown once it is this plan's.
  const payAmount =
    plan.isCurrent && action === "current" && due && due.planId === plan.id && due.amount > 0
      ? formatMinorMoney(due.amount, due.currency)
      : null;

  async function act() {
    setBusy(true);
    setError(null);
    try {
      if (action === "trial") {
        await apiClient.startTrial(workspaceId, plan.id);
        noteWentLive();
        onPlansChange(await apiClient.getSubscriptionPlans(workspaceId));
        toast.success(t.trialStarted);
      } else if (action === "move") {
        // One charge for the new plan; the store switches once it is paid.
        const { plans } = await apiClient.requestPlanMove(workspaceId, { planId: plan.id, billingCycle: cycle });
        onPlansChange(plans);
        toast.success(t.moveRequested);
        onChanged();
        navigate(PAY_NOW_LINK);
        return;
      } else {
        const { plans } = await apiClient.changeSubscriptionPlan(workspaceId, { planId: plan.id, billingCycle: cycle });
        onPlansChange(plans);
        toast.success(t.planChanged);
      }
      onChanged();
    } catch (err) {
      const reason = apiErrorDetails<{ reason?: string }>(err)?.reason;
      setError(
        errorMessage(err, {
          TRIAL_NOT_AVAILABLE: reason === "no_trial" ? t.noTrial : t.trialUsed,
          PLAN_NOT_AVAILABLE: t.planNotAvailable,
          OPEN_CHARGE_EXISTS: action === "move" ? t.moveOtherCharge : t.openCharge,
          PLAN_CHANGE_NEEDS_SUPPORT: t.needsSupport,
          WALLET_DEBT_OUTSTANDING: t.moveDebtError,
        })
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "flex flex-col rounded-[var(--radius-card)] border bg-paper-raised p-5",
        plan.isCurrent ? "border-primary ring-1 ring-primary" : "border-line"
      )}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <h3 id={titleId} className="font-display text-lg font-medium text-ink">
          {plan.name}
        </h3>
        {plan.isCurrent && (
          <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">{t.currentPlan}</span>
        )}
        {!plan.isPublic && !plan.isCurrent && <span className="text-xs text-ink-soft">{t.notOffered}</span>}
      </div>

      <PlanSummary
        // A move off pay per order, or a switch, never starts a trial, so a plan's own isn't shown then.
        plan={{
          ...plan,
          monthlyPrice: plan.prices.monthly.net,
          yearlyPrice: plan.prices.yearly.net,
          trialDays: view.move?.available || selfServeSwitch(view) ? 0 : plan.trialDays,
        }}
        billingCycle={cycle}
      />
      {price.discount > 0 && (
        <p className="mt-1 text-xs text-ink-soft">
          <span className="line-through">{fmt(t.insteadOf, { price: formatMinorMoney(price.gross, plan.currency) })}</span>
        </p>
      )}
      {cycle === "yearly" && yearlySaving > 0 && (
        <p className="mt-1 text-sm font-medium text-success">{fmt(t.saveYearly, { amount: formatMinorMoney(yearlySaving, plan.currency) })}</p>
      )}

      {/* Before the first payment, as before; with REFERRAL_CODES_V2_ENABLED also a paid
          store on its current plan (a code for its next renewal; a plan change takes one in its dialog). */}
      {((!view.referralCode && (action === "trial" || action === "choose")) || (view.referralCodeEntry?.enabled && plan.isCurrent && action === "current")) && (
        <CodeField plan={plan} cycle={cycle} onApplied={onPlansChange} onChanged={onChanged} />
      )}

      <div className="mt-auto space-y-2 pt-4">
        {error && (
          <Alert variant="danger" role="alert">
            {error}
          </Alert>
        )}
        {(action === "trial" || action === "choose") && (
          <Button type="button" className="min-h-11 w-full" disabled={busy} onClick={() => void act()}>
            {action === "trial" ? fmt(t.startTrial, { days: formatDays(plan.trialDays, locale) }) : t.choosePlan}
          </Button>
        )}
        {action === "move" && (
          <Button type="button" className="min-h-11 w-full" disabled={busy || moveBlocked} onClick={() => void act()}>
            {view.move?.pending ? t.moveInstead : t.moveChoose}
          </Button>
        )}
        {action === "movePay" && (
          <Button asChild className="min-h-11 w-full">
            <Link to={PAY_NOW_LINK}>{t.movePay}</Link>
          </Button>
        )}
        {action === "switch" && (
          <Button type="button" className="min-h-11 w-full" onClick={() => onSwitch({ plan, cycle })}>
            {plan.isCurrent ? (cycle === "yearly" ? s.switchToYearly : s.switchToMonthly) : s.switchTo}
          </Button>
        )}
        {action === "switchPay" &&
          (view.planSwitch?.open?.proofUnderReview === true ? (
            // A transfer for it is with the console: nothing to pay meanwhile.
            <p className="rounded-[10px] border border-line bg-paper px-3 py-2 text-sm text-ink">{s.cardUnderReview}</p>
          ) : (
            <>
              <p className="text-sm text-ink-soft">{s.cardWaiting}</p>
              <Button asChild className="min-h-11 w-full">
                <Link to={PAY_NOW_LINK}>{s.payToSwitch}</Link>
              </Button>
            </>
          ))}
        {action === "switchScheduled" && (
          <p className="rounded-[10px] border border-line bg-paper px-3 py-2 text-sm text-ink">
            {fmt(s.cardScheduled, { date: formatDate(view.planSwitch?.open?.effectiveAt) })}
          </p>
        )}
        {action === "support" && (
          <Button asChild variant="outline" className="min-h-11 w-full">
            <Link to="/support">{t.contactSupport}</Link>
          </Button>
        )}
        {payAmount && (
          <>
            <p className="text-sm text-ink">{fmt(p.payPanelBody, { amount: payAmount })}</p>
            <Button asChild className="min-h-11 w-full">
              <Link to={PAY_NOW_LINK}>{t.payNow}</Link>
            </Button>
          </>
        )}
      </div>
    </article>
  );
}

/**
 * The move off pay per order, above the cards: no free trial, the balance
 * (it stays in the wallet), a debt to clear first, or the move waiting for
 * its payment.
 */
function MoveNotice({
  move,
  onPlansChange,
  onChanged,
}: {
  move: NonNullable<SubscriptionPlans["move"]>;
  onPlansChange: (next: SubscriptionPlans) => void;
  onChanged: () => void;
}) {
  const t = useT(SUBSCRIPTION_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = move.pending;

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      const { plans } = await apiClient.cancelPlanMove(workspaceId);
      onPlansChange(plans);
      toast.success(t.moveCancelled);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="move-title" className="space-y-2 rounded-[var(--radius-card)] border border-line bg-paper-raised p-4">
      <h2 id="move-title" className="font-display text-base font-medium text-ink">
        {t.moveTitle}
      </h2>
      {pending ? (
        <div className="space-y-2">
          <Alert role="status">
            {fmt(t.movePending, {
              plan: pending.planName ?? "",
              cycle: pending.billingCycle === "yearly" ? t.cycleYearly : t.cycleMonthly,
              amount: formatMinorMoney(pending.amountDue, pending.currency),
            })}
          </Alert>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild className="min-h-11">
              <Link to={PAY_NOW_LINK}>{t.movePay}</Link>
            </Button>
            <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => void cancel()}>
              {t.moveCancel}
            </Button>
          </div>
          <p className="text-xs text-ink-soft">{t.moveOrOther}</p>
          {error && (
            <Alert variant="danger" role="alert">
              {error}
            </Alert>
          )}
        </div>
      ) : (
        <p className="text-sm text-ink">{t.moveNote}</p>
      )}
      {move.debt > 0 ? (
        <Alert variant="danger" role="alert">
          {fmt(t.moveDebt, { debt: formatMinorMoney(move.debt, move.currency) })}{" "}
          <Link to={TOP_UP_LINK} className="font-medium underline">
            {t.moveTopUp}
          </Link>
        </Alert>
      ) : (
        <p className="text-sm text-ink-soft">{fmt(t.moveBalance, { balance: formatMinorMoney(move.balance, move.currency) })}</p>
      )}
    </section>
  );
}

/**
 * "Discount or voucher code" on a card: Check shows this card's price with the
 * code (nothing is attached); Apply attaches it to the store — once, for every
 * payment from then on — after which every card shows the discounted prices.
 */
function CodeField({
  plan,
  cycle,
  onApplied,
  onChanged,
}: {
  plan: SubscriptionPlan;
  cycle: BillingCycle;
  onApplied: (next: SubscriptionPlans) => void;
  onChanged: () => void;
}) {
  const t = useT(SUBSCRIPTION_STRINGS);
  const rt = useT(REFERRAL_CODE_STRINGS);
  const id = useId();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<{ code: string; price: PlanPrice; schedule: ReferralSchedulePayment[] | null } | null>(null);
  const [busy, setBusy] = useState<"check" | "apply" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const describe = (err: unknown) => errorMessage(err, referralErrorMap(rt));

  async function check(e: FormEvent) {
    e.preventDefault();
    setBusy("check");
    setError(null);
    setPreview(null);
    try {
      // Judged against this card's plan and cycle (its restrictions, migration 725).
      const result = await apiClient.previewReferralCode(workspaceId, code.trim(), { planId: plan.id, billingCycle: cycle });
      const mine = result.plans.find((p) => p.planId === plan.id);
      if (mine) setPreview({ code: result.code.code, price: priceFor(mine.prices, cycle), schedule: mine.schedule?.[cycle] ?? null });
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(null);
    }
  }

  async function apply() {
    if (!preview) return;
    setBusy("apply");
    setError(null);
    try {
      await apiClient.attachReferralCode(workspaceId, preview.code, { planId: plan.id, billingCycle: cycle });
      toast.success(t.codeApplied);
      onApplied(await apiClient.getSubscriptionPlans(workspaceId));
      onChanged();
    } catch (err) {
      setError(describe(err));
      setBusy(null);
    }
  }

  return (
    <form onSubmit={check} className="mt-4 space-y-2 border-t border-line pt-3">
      <Label htmlFor={id} className="text-xs text-ink-soft">
        {t.code}
      </Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setPreview(null);
          }}
          placeholder={t.codePlaceholder}
          maxLength={32}
          dir="ltr"
          className="min-w-0 flex-1 font-mono"
          disabled={busy !== null}
        />
        <Button type="submit" variant="outline" className="min-h-10 shrink-0" disabled={busy !== null || code.trim().length < 3}>
          {busy === "check" ? t.checking : t.check}
        </Button>
      </div>
      {preview && (
        <div className="space-y-2">
          <p className="text-sm text-ink" dir="auto">
            {fmt(t.withCode, { code: preview.code, price: formatMinorMoney(preview.price.net, plan.currency) })}
          </p>
          {preview.schedule && <ScheduleTable rows={preview.schedule} currency={plan.currency} />}
          <Button type="button" variant="outline" className="min-h-10 w-full" disabled={busy !== null} onClick={() => void apply()}>
            {busy === "apply" ? t.applying : t.applyCode}
          </Button>
        </div>
      )}
      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}
    </form>
  );
}

/**
 * The pay-per-order plan (the prepaid balance, WALLET_ENABLED). Offered:
 * chosen at once from a draft or a trial; once paid, switched to like any
 * plan while the store changes plan by itself (PLAN_SWITCH_ENABLED: the
 * confirmation, then at the end of the paid period), else through support.
 * Not offered (switched off, or no such plan): shown as coming soon.
 */
function PayPerOrderCard({
  view,
  onPlansChange,
  onChanged,
  onSwitch,
}: {
  view: SubscriptionPlans;
  onPlansChange: (next: SubscriptionPlans) => void;
  onChanged: () => void;
  /** Opens the switch's confirmation for pay per order (PlanSwitchDialog). */
  onSwitch: (target: SwitchTarget) => void;
}) {
  const t = useT(SUBSCRIPTION_STRINGS);
  const w = useT(WALLET_STRINGS);
  const s = useT(PLAN_SWITCH_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ppo = view.payPerOrder;
  const plan = ppo?.plan ?? null;
  // A paid subscription switching by itself; the move to it waiting, if any.
  const selfServe = !view.move?.available && selfServeSwitch(view);
  const open = view.planSwitch?.open ?? null;
  const waiting = Boolean(plan && open && open.status === "scheduled" && open.to.planId === plan.id);

  if (!ppo || (!ppo.available && !ppo.current) || !plan) {
    return (
      <article className="flex flex-col rounded-[var(--radius-card)] border border-dashed border-line bg-paper p-5" aria-disabled="true">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <h3 className="font-display text-lg font-medium text-ink">{t.payPerOrder}</h3>
          <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-ink">{t.comingSoon}</span>
        </div>
        <p className="text-sm text-ink-soft">{t.payPerOrderBody}</p>
      </article>
    );
  }

  async function choose() {
    setBusy(true);
    setError(null);
    try {
      await apiClient.choosePayPerOrder(workspaceId);
      onPlansChange(await apiClient.getSubscriptionPlans(workspaceId));
      onChanged();
      toast.success(w.ppoChosen);
    } catch (err) {
      setError(errorMessage(err, { OPEN_CHARGE_EXISTS: w.ppoOpenCharge, PLAN_CHANGE_NEEDS_SUPPORT: w.ppoNeedsSupport }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      className={cn(
        "flex flex-col rounded-[var(--radius-card)] border bg-paper-raised p-5",
        ppo.current ? "border-primary" : "border-line"
      )}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-display text-lg font-medium text-ink">{t.payPerOrder}</h3>
        {ppo.current && <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">{w.ppoCurrent}</span>}
      </div>
      <p className="tabular text-2xl font-semibold text-ink">{fmt(w.ppoFee, { fee: formatMinorMoney(plan.fee, plan.currency) })}</p>
      <p className="mt-2 flex-1 text-sm text-ink-soft">{w.ppoBalanceHint}</p>
      {!ppo.current &&
        (selfServe && ppo.available ? (
          waiting ? (
            <p className="mt-4 rounded-[10px] border border-line bg-paper px-3 py-2 text-sm text-ink">
              {fmt(s.cardScheduled, { date: formatDate(open?.effectiveAt) })}
            </p>
          ) : (
            <Button
              type="button"
              className="mt-4 min-h-11 w-full"
              onClick={() => onSwitch({ plan: { id: plan.id, name: plan.name }, cycle: view.subscription.billingCycle })}
            >
              {s.switchToPayPerOrder}
            </Button>
          )
        ) : view.planChange === "immediate" ? (
          <Button type="button" className="mt-4 min-h-11 w-full" disabled={busy} onClick={() => void choose()}>
            {busy ? w.ppoChoosing : w.ppoChoose}
          </Button>
        ) : (
          <Button asChild variant="outline" className="mt-4 min-h-11 w-full">
            <Link to="/support">{w.ppoSupport}</Link>
          </Button>
        ))}
      {error && (
        <Alert variant="danger" role="alert" className="mt-3">
          {error}
        </Alert>
      )}
    </article>
  );
}
