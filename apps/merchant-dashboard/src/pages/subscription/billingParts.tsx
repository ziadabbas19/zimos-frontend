import { useEffect, useRef, useState } from "react";
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

/** The plan, its status and period, and the next charge priced with the store's code, with the way to pay it. */
export function SubscriptionSummary({ billing }: { billing: WorkspaceBilling }) {
  const t = useT(BILLING_STRINGS);
  const { subscription, nextCharge } = billing;
  const plan = subscription.plan;

  return (
    <dl className="grid gap-4 sm:grid-cols-3">
      <div>
        <dt className="text-xs text-ink-soft">{t.plan}</dt>
        <dd className="mt-0.5 text-sm font-medium text-ink">{plan ? `${plan.name} · ${t[subscription.billingCycle]}` : t.noPlan}</dd>
      </div>
      <div>
        <dt className="text-xs text-ink-soft">{t.status}</dt>
        <dd className="mt-0.5 text-sm font-medium text-ink">
          {billing.draft ? t.draft : (t[subscription.status as keyof typeof t] ?? subscription.status)}
          {!billing.draft && (
            <span className="block text-xs font-normal text-ink-soft">
              {subscription.status === "trialing" && subscription.trialEndsAt
                ? fmt(t.trialEnds, { date: formatDate(subscription.trialEndsAt) })
                : fmt(t.renews, { date: formatDate(subscription.currentPeriodEnd) })}
            </span>
          )}
        </dd>
      </div>
      {nextCharge && (
        <div>
          <dt className="text-xs text-ink-soft">{t.nextCharge}</dt>
          <dd className="mt-0.5 text-sm font-medium text-ink">
            {nextCharge.discountAmount > 0
              ? fmt(t.nextChargeDiscount, {
                  amount: formatMoney(nextCharge.amount, nextCharge.currency),
                  gross: formatMoney(nextCharge.grossAmount, nextCharge.currency),
                  discount: formatMoney(nextCharge.discountAmount, nextCharge.currency),
                })
              : formatMoney(nextCharge.amount, nextCharge.currency)}
            <Link
              to="/subscription?tab=invoices"
              className="flex min-h-11 w-fit items-center text-sm font-medium text-primary underline-offset-2 hover:underline"
            >
              {t.paymentLink}
            </Link>
          </dd>
        </div>
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
