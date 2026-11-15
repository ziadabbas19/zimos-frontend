import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Alert, cn } from "@store-builder/ui";
import { yearlyBreakdown } from "@store-builder/ui/plan-pricing";
import type { OnlinePaymentResult, OnlinePaymentStatus, WorkspaceBilling } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate, formatMoney } from "@/lib/format";
import { useT, fmt } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { IconCard, IconClock, IconCoins, type IconComponent } from "@/components/icons";
import { PLACE_COLOR } from "@/lib/places";
import { BILLING_STRINGS, type ReturnHint } from "./billingText";

/**
 * The parts of the Subscription section that came from Settings' old "Plan
 * and referral code" card: the subscription's summary, the monthly/annual
 * switch of a paid plan, the Pay button and the page Fawaterak sends the
 * merchant back to.
 */

// The payment is still being made or awaits the customer.
const IN_PROGRESS: ReadonlySet<OnlinePaymentStatus> = new Set(["created", "open", "pending"]);
// How often, and how many times, the return page asks about a payment in
// progress: once when Fawaterak sent the merchant back from a decline or the
// back link, a few times otherwise.
const RETURN_POLL_MS = 3000;
const RETURN_POLL_TRIES = 8;
/**
 * The page Fawaterak sends the merchant back to. The redirect itself proves
 * nothing: the server is asked (it asks Fawaterak) a few times while the
 * payment is still in progress.
 */
export function PaymentReturn({
  paymentId,
  hint,
  onSettled,
  onDone,
}: {
  paymentId: string;
  hint: ReturnHint;
  onSettled: () => void;
  onDone: () => void;
}) {
  const t = useT(BILLING_STRINGS);
  const workspaceId = useWorkspaceId();
  const [payment, setPayment] = useState<OnlinePaymentResult["payment"] | null>(null);
  const [asking, setAsking] = useState(true);
  const callbacks = useRef({ onSettled, onDone });
  useEffect(() => {
    callbacks.current = { onSettled, onDone };
  });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function ask(tries: number) {
      try {
        const next = await apiClient.getOnlinePayment(workspaceId, paymentId);
        if (cancelled) return;
        setPayment(next.payment);
        const maxTries = hint === "fail" || hint === "back" ? 1 : RETURN_POLL_TRIES;
        if (IN_PROGRESS.has(next.payment.status) && tries < maxTries) {
          timer = setTimeout(() => void ask(tries + 1), RETURN_POLL_MS);
          return;
        }
        if (next.payment.status === "paid") callbacks.current.onSettled();
      } catch {
        if (cancelled) return;
      }
      setAsking(false);
      callbacks.current.onDone();
    }
    void ask(1);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [workspaceId, paymentId, hint]);

  const { message, variant } = returnMessage(t, payment, asking, hint);
  return (
    <Alert variant={variant} className="mt-4" role="status">
      {message}
    </Alert>
  );
}

function returnMessage(
  t: Record<keyof (typeof BILLING_STRINGS)["en"], string>,
  payment: OnlinePaymentResult["payment"] | null,
  asking: boolean,
  hint: ReturnHint
): { message: string; variant: "default" | "success" | "danger" } {
  if (!payment) return { message: asking ? t.checking : t.notConfirmedYet, variant: "default" };
  switch (payment.status) {
    case "paid":
      return { message: t.paid, variant: "success" };
    case "mismatch":
      return { message: t.review, variant: "default" };
    case "paid_duplicate":
      return { message: t.duplicate, variant: "default" };
    case "created":
    case "open":
    case "pending":
      if (payment.referenceNumber) {
        const reference = fmt(t.awaitingReference, { method: payment.paymentMethod ?? "", reference: payment.referenceNumber });
        return { message: reference, variant: "default" };
      }
      if (asking) return { message: t.checking, variant: "default" };
      if (hint === "fail") return { message: t.notCompleted, variant: "default" };
      if (hint === "back") return { message: t.leftPayment, variant: "default" };
      return { message: t.stillPending, variant: "default" };
    default:
      return { message: t.notCompleted, variant: "danger" };
  }
}

/** A status's colour: green running, blue on trial, amber to pay, red stopped. */
const STATUS_TONE: Record<string, string> = {
  active: "bg-success-soft text-success",
  trialing: "bg-primary-soft text-primary-dark dark:text-primary",
  past_due: "bg-accent-soft text-accent-dark",
  suspended: "bg-danger-soft text-danger",
  cancelled: "bg-danger-soft text-danger",
  ended: "bg-accent-soft text-accent-dark",
};

/** One fact of the summary as a card: its picture in a tint, a small label, then the value large. */
function SummaryTile({ icon: Icon, tint, label, children }: { icon: IconComponent; tint: string; label: string; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-paper-raised p-4">
      <dt className="flex items-center gap-2 text-sm font-medium text-ink-soft">
        <span aria-hidden className="grid size-9 place-items-center rounded-xl [&>svg]:size-[18px]" style={{ backgroundColor: `color-mix(in srgb, ${tint} 14%, transparent)`, color: tint }}>
          <Icon strokeWidth={2} />
        </span>
        {label}
      </dt>
      <dd className="mt-3 flex flex-1 flex-col">{children}</dd>
    </div>
  );
}

/**
 * The subscription in three cards, to be seen at a glance: the plan and its
 * cycle; the status as a coloured word with its date (a trial or a period
 * whose date has passed says it ended, not that it ends); and the next charge,
 * large, with the plan's price struck out when the store's code takes some
 * off, and the way to pay it — or, when nothing is left to pay, the way to
 * the invoices.
 */
export function SubscriptionSummary({ billing }: { billing: WorkspaceBilling }) {
  const t = useT(BILLING_STRINGS);
  const { subscription, nextCharge } = billing;
  const plan = subscription.plan;
  const trialEnd = subscription.status === "trialing" ? subscription.trialEndsAt : null;
  const dateShown = trialEnd ?? subscription.currentPeriodEnd;
  // The moment the page was opened: a date before it has passed.
  const [now] = useState(() => Date.now());
  const passed = Boolean(dateShown && new Date(dateShown).getTime() < now);
  const trialOver = Boolean(trialEnd) && passed;
  const statusLabel = billing.draft ? t.draft : trialOver ? t.trialEnded : (t[subscription.status as keyof typeof t] ?? subscription.status);
  const tone = billing.draft ? "bg-paper-sunken text-ink-soft" : trialOver ? STATUS_TONE.ended : (STATUS_TONE[subscription.status] ?? "bg-paper-sunken text-ink-soft");
  const toPay = nextCharge ? nextCharge.amount > 0 : false;

  return (
    <dl className="grid gap-3 sm:grid-cols-3">
      <SummaryTile icon={IconCard} tint={PLACE_COLOR.main} label={t.plan}>
        <p className="text-2xl font-bold tracking-tight text-ink">{plan ? plan.name : t.noPlan}</p>
        {plan && (
          <span className="mt-1.5 w-fit rounded-full bg-paper-sunken px-2.5 py-0.5 text-xs font-medium text-ink-soft">{t[subscription.billingCycle]}</span>
        )}
      </SummaryTile>

      <SummaryTile icon={IconClock} tint={PLACE_COLOR.orders} label={t.status}>
        <span className={cn("w-fit rounded-full px-3 py-1 text-sm font-semibold", tone)}>{statusLabel}</span>
        {!billing.draft && dateShown && (
          <span className="mt-2 block text-xs text-ink-soft">
            {passed ? fmt(t.endedOn, { date: formatDate(dateShown) }) : fmt(trialEnd ? t.trialEnds : t.renews, { date: formatDate(dateShown) })}
          </span>
        )}
      </SummaryTile>

      {nextCharge && (
        <SummaryTile icon={IconCoins} tint={PLACE_COLOR.money} label={t.nextCharge}>
          <p className="tabular text-2xl font-bold tracking-tight text-ink">
            <bdi>{formatMoney(nextCharge.amount, nextCharge.currency)}</bdi>
          </p>
          {nextCharge.discountAmount > 0 && (
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
              <s className="tabular text-ink-soft">
                <bdi>{formatMoney(nextCharge.grossAmount, nextCharge.currency)}</bdi>
              </s>
              <span className="rounded-full bg-success-soft px-2 py-0.5 font-semibold text-success">
                {fmt(t.codeDiscount, { discount: formatMoney(nextCharge.discountAmount, nextCharge.currency) })}
              </span>
            </p>
          )}
          {!toPay && <p className="mt-1.5 text-xs text-ink-soft">{nextCharge.discountAmount > 0 ? t.codeCovers : t.nothingToPay}</p>}
          <Link
            to="/subscription?tab=invoices"
            className="mt-auto flex min-h-11 w-fit items-center pt-1 text-sm font-semibold text-primary underline-offset-2 hover:underline"
          >
            {toPay ? t.paymentLink : t.seeInvoices}
          </Link>
        </SummaryTile>
      )}
    </dl>
  );
}

/** Monthly or annual, from the next charge; annual says "save" only while it is less than twelve months. */
export function BillingCycleChoice({ billing, onChange }: { billing: WorkspaceBilling; onChange: (next: WorkspaceBilling) => void }) {
  const t = useT(BILLING_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const plan = billing.subscription.plan!;
  const current = billing.subscription.billingCycle;

  async function choose(cycle: "monthly" | "yearly") {
    if (cycle === current || busy) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await apiClient.setWorkspaceBillingCycle(workspaceId, cycle));
      toast.success(t.cycleSaved);
    } catch (err) {
      setError(errorMessage(err, { OPEN_CHARGE_EXISTS: t.cycleOpenCharge }));
    } finally {
      setBusy(false);
    }
  }

  const options: Array<{ value: "monthly" | "yearly"; label: string }> = [
    { value: "monthly", label: fmt(t.cycleMonthly, { price: formatMoney(plan.monthlyPrice, plan.currency) }) },
    {
      value: "yearly",
      label: fmt(yearlyBreakdown(plan)?.fullYear != null ? t.cycleYearlySaves : t.cycleYearly, {
        price: formatMoney(plan.yearlyPrice, plan.currency),
      }),
    },
  ];

  return (
    <fieldset className="space-y-2" disabled={busy}>
      <legend className="text-xs text-ink-soft">{t.cycle}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] border px-3 py-2 text-sm",
              current === o.value ? "border-primary bg-primary-soft text-ink" : "border-line text-ink-soft"
            )}
          >
            <input
              type="radio"
              name="billing-cycle"
              value={o.value}
              checked={current === o.value}
              onChange={() => void choose(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
      <p className="text-xs text-ink-soft">{t.cycleHint}</p>
      {error && <Alert variant="danger">{error}</Alert>}
    </fieldset>
  );
}
