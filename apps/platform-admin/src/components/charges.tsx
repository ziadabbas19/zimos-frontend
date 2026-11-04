import { useState, type FormEvent } from "react";
import { Ban, Banknote, Check, Gift, Receipt, Undo2 } from "lucide-react";
import { Alert, Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import type { AdminCharge, AdminOnlinePayment, AdminWorkspaceCharges } from "@store-builder/api-client";
import { DataState, EmptyBlock } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { Mono, Panel, Td, Th } from "@/components/Panel";
import { TextAreaField, TextField } from "@/components/forms";
import { Status, StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { CanLink } from "@/components/Can";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import * as adminApi from "@/lib/adminApi";
import { formatDate, formatDateTime, formatMinorMoneyExact, minorUnitDigits } from "@/lib/format";
import { P } from "@/lib/permissions";
import { describeDiscount } from "@/lib/referrals";
import { planMoveLabel, voidLabel } from "@/lib/planMove";

/**
 * A workspace's subscription charges, on its Subscription tab.
 *
 * A merchant may pay a charge online through Fawaterak, when the platform has
 * that switched on (ONLINE_BILLING_ENABLED); each attempt is listed under
 * "Online payments". A payment that arrived some other way (a bank transfer,
 * cash) is recorded here by hand, dated when it arrived. That runs the same
 * charge-paid path as an online payment: the referral code is re-checked at
 * that moment, and the commission ledger row is written from the amount
 * actually received. A payment recorded here — never an online one — can be
 * reversed: the charge goes back to pending and its ledger row is voided.
 * A pending charge the server marks `voidable` (PLAN_SWITCH_ENABLED, no
 * transfer for it waiting for review) can be voided with a reason.
 */
export function SubscriptionCharges({ workspaceId }: { workspaceId: string }) {
  const toast = useToast();
  const { can } = useAuth();
  const canRecord = can(P.PAYMENTS_RECORD);
  const canManage = can(P.SUBSCRIPTIONS_MANAGE);
  const { data, loading, error, refresh, setData } = useAsync(() => adminApi.listCharges(workspaceId), [workspaceId]);
  const [granting, setGranting] = useState(false);
  const [switching, setSwitching] = useState(false);

  async function switchCycle(cycle: "monthly" | "yearly") {
    setSwitching(true);
    try {
      setData(await adminApi.setBillingCycle(workspaceId, cycle));
      toast.success(`Switched to ${cycle === "yearly" ? "annual" : "monthly"} billing from the next charge.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSwitching(false);
    }
  }
  const [pricing, setPricing] = useState(false);
  const [recording, setRecording] = useState<AdminCharge | null>(null);
  const [reversing, setReversing] = useState<AdminCharge | null>(null);
  const [voiding, setVoiding] = useState<AdminCharge | null>(null);

  async function priceNextCharge() {
    setPricing(true);
    try {
      const { created } = await adminApi.createCharge(workspaceId);
      toast.success(created ? "Next charge created. Record the payment once it arrives." : "A charge is already open.");
      await refresh({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPricing(false);
    }
  }

  return (
    <section className="mt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Charges</h2>
        {canRecord && data?.nextCharge && (
          <Button onClick={() => void priceNextCharge()} disabled={pricing}>
            <Receipt /> {pricing ? "Creating…" : "Create next charge"}
          </Button>
        )}
      </div>

      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {data && (
          <div className="space-y-4">
            <BillingSummary
              data={data}
              onSwitchCycle={canManage ? (cycle) => void switchCycle(cycle) : undefined}
              switching={switching}
            />
            <SpecialTermsPanel data={data} onGrant={canManage ? () => setGranting(true) : undefined} />
            {data.charges.length === 0 ? (
              <EmptyBlock message="No charges yet. A charge is created here, or when the merchant pays online." />
            ) : (
              <ChargesTable
                charges={data.charges}
                onRecord={canRecord ? setRecording : undefined}
                onReverse={canRecord ? setReversing : undefined}
                onVoid={canRecord ? setVoiding : undefined}
              />
            )}
            <OnlinePaymentsPanel charges={data.charges} />
          </div>
        )}
      </DataState>

      {recording && (
        <RecordPaymentModal
          charge={recording}
          onClose={() => setRecording(null)}
          onRecorded={(charge, codeLapsed) => {
            const commission = charge.commission
              ? ` Commission of ${formatMinorMoneyExact(charge.commission.suggestedCommission, charge.currency)} suggested.`
              : "";
            toast.success(
              codeLapsed
                ? "Payment recorded. The referral code is no longer active, so no discount or commission applied."
                : `Payment recorded; the charge is ${charge.status}.${commission}`
            );
            setRecording(null);
            void refresh({ silent: true });
          }}
        />
      )}
      {granting && data && (
        <SpecialTermsModal
          data={data}
          workspaceId={workspaceId}
          onClose={() => setGranting(false)}
          onGranted={(next) => {
            setData(next);
            toast.success(
              next.term.kind === "free_months"
                ? `${next.term.months} free month(s) granted. The period now ends ${formatDate(next.term.endsAt)}.`
                : `Special price granted for the next ${next.term.chargesTotal} charge(s).`
            );
            setGranting(false);
          }}
        />
      )}
      {voiding && (
        <VoidChargeModal
          charge={voiding}
          onClose={() => setVoiding(null)}
          onVoided={() => {
            toast.success("Charge voided. Nothing is owed for it.");
            setVoiding(null);
            void refresh({ silent: true });
          }}
        />
      )}
      {reversing && (
        <ReversePaymentModal
          charge={reversing}
          onClose={() => setReversing(null)}
          onReversed={(result) => {
            const paidOut = result.voidedCommission?.payoutStatus === "marked_paid";
            toast.success(
              `Payment reversed; the charge is ${result.charge.status} again.` +
                (result.subscriptionStatus.to !== result.subscriptionStatus.from ? " The subscription is past due." : "") +
                (result.voidedCommission
                  ? paidOut
                    ? " Its commission was voided — it had already been paid to the agent."
                    : " Its commission was voided."
                  : "")
            );
            setReversing(null);
            void refresh({ silent: true });
          }}
        />
      )}
    </section>
  );
}

function BillingSummary({
  data,
  onSwitchCycle,
  switching,
}: {
  data: AdminWorkspaceCharges;
  onSwitchCycle?: (cycle: "monthly" | "yearly") => void;
  switching: boolean;
}) {
  const code = data.subscription.referralCode;
  const prices = data.subscription.planPrices;
  const openCharge = data.charges.some((c) => c.status === "pending");
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Panel title="Billing cycle">
        {prices ? (
          <div className="space-y-2 text-sm">
            {(["monthly", "yearly"] as const).map((cycle) => (
              <label key={cycle} className="flex items-center gap-2">
                {/* Without the permission to switch, the current cycle is marked and nothing is offered. */}
                {onSwitchCycle ? (
                  <input
                    type="radio"
                    name="billing-cycle"
                    checked={data.subscription.billingCycle === cycle}
                    disabled={switching || openCharge}
                    onChange={() => onSwitchCycle(cycle)}
                  />
                ) : (
                  data.subscription.billingCycle === cycle && <Check className="size-4 text-primary" aria-label="Current" />
                )}
                <span>
                  {cycle === "monthly" ? "Monthly" : "Annual"} —{" "}
                  <span className="font-medium tabular">
                    {formatMinorMoneyExact(cycle === "monthly" ? prices.monthly : prices.yearly, prices.currency)}
                  </span>
                  {cycle === "yearly" && <span className="text-ink-soft"> (10 × monthly)</span>}
                </span>
              </label>
            ))}
            {onSwitchCycle && (
              <p className="text-xs text-ink-soft">
                {openCharge
                  ? "A charge is open: settle it before switching."
                  : "Applies from the next charge; the current period is not changed."}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-ink-soft">No plan.</p>
        )}
      </Panel>
      <Panel title="Referral code">
        {code ? (
          <div className="space-y-1 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Mono>{code.code}</Mono>
              {!code.active && <StatusBadge tone="neutral">Inactive</StatusBadge>}
            </div>
            <p className="text-ink-soft">{describeDiscount(code)}</p>
            {code.agent && (
              <p className="text-ink-soft">
                Agent:{" "}
                <CanLink permission={P.AGENTS_VIEW} to={`/agents/${code.agent.id}`} className="text-ink hover:text-primary hover:underline">
                  {code.agent.fullName}
                </CanLink>
              </p>
            )}
            <p className="text-xs text-ink-soft">Entered {formatDate(code.attachedAt)}</p>
          </div>
        ) : (
          <p className="text-sm text-ink-soft">None — the merchant hasn&rsquo;t entered an agent&rsquo;s code.</p>
        )}
      </Panel>
      <Panel title="Next charge">
        {data.nextCharge ? (
          <div className="space-y-1 text-sm">
            <p className="text-lg font-semibold tabular">
              {formatMinorMoneyExact(data.nextCharge.amount, data.nextCharge.currency)}
            </p>
            {data.nextCharge.discountAmount > 0 && (
              <p className="text-ink-soft">
                {formatMinorMoneyExact(data.nextCharge.grossAmount, data.nextCharge.currency)} plan price, less{" "}
                {formatMinorMoneyExact(data.nextCharge.discountAmount, data.nextCharge.currency)} referral discount
              </p>
            )}
            <p className="text-xs text-ink-soft">
              {data.subscription.planName} · {data.subscription.billingCycle}. The code is checked again when the
              payment is recorded.
            </p>
          </div>
        ) : (
          <p className="text-sm text-ink-soft">
            {data.charges.some((c) => c.status === "pending")
              ? "A charge is open — record its payment below."
              : "Nothing to charge: the plan is free, or there is no plan."}
          </p>
        )}
      </Panel>
    </div>
  );
}

/** Special terms on the subscription: what is in effect, and every past grant. */
function SpecialTermsPanel({ data, onGrant }: { data: AdminWorkspaceCharges; onGrant?: () => void }) {
  const terms = data.specialTerms;
  const active = terms.filter((t) => t.active);
  return (
    <Panel title="Special terms">
      <div className="space-y-3 text-sm">
        {terms.length === 0 ? (
          <p className="text-ink-soft">None — normal plan pricing.</p>
        ) : (
          <ul className="space-y-2">
            {terms.map((t) => (
              <li key={t.id} className="flex flex-wrap items-start gap-2">
                <StatusBadge tone={t.active ? "primary" : "neutral"} dot>
                  {t.active ? "Active" : "Used up"}
                </StatusBadge>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">
                    {t.kind === "free_months"
                      ? `${t.months} free month(s), ${formatDate(t.startsAt)} – ${formatDate(t.endsAt)}`
                      : `${formatMinorMoneyExact(t.priceAmount ?? 0, t.currency ?? "USD")} for ${t.chargesTotal} charge(s) — ${t.chargesLeft} left`}
                  </span>
                  <span className="block text-xs text-ink-soft">
                    {t.note} · {formatDate(t.createdAt)}
                    {t.createdBy ? ` · ${t.createdBy.fullName}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {active.length > 0 && (
          <p className="text-xs text-ink-soft">
            Active terms replace normal pricing: comped months are never charged, and a special price is used for its
            charges instead of the plan price (a referral discount still comes off it).
          </p>
        )}
        {onGrant && (
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={onGrant}>
              <Gift /> Grant special terms
            </Button>
          </div>
        )}
      </div>
    </Panel>
  );
}

function SpecialTermsModal({
  data,
  workspaceId,
  onClose,
  onGranted,
}: {
  data: AdminWorkspaceCharges;
  workspaceId: string;
  onClose: () => void;
  onGranted: (next: Awaited<ReturnType<typeof adminApi.grantSpecialTerms>>) => void;
}) {
  const currency = data.subscription.planPrices?.currency ?? "USD";
  const [kind, setKind] = useState<"free_months" | "price_override">("free_months");
  const [months, setMonths] = useState("1");
  const [price, setPrice] = useState("");
  const [charges, setCharges] = useState("1");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!note.trim()) {
      setError("A note is required: what was agreed and why.");
      return;
    }
    let payload: Parameters<typeof adminApi.grantSpecialTerms>[1];
    if (kind === "free_months") {
      const n = Number(months);
      if (!Number.isInteger(n) || n < 1 || n > 36) {
        setError("Free months is a whole number from 1 to 36.");
        return;
      }
      payload = { kind, months: n, note: note.trim() };
    } else {
      const amount = Number(price);
      const n = Number(charges);
      if (!price.trim() || !Number.isFinite(amount) || amount < 0) {
        setError("Enter the special price, zero or more.");
        return;
      }
      if (!Number.isInteger(n) || n < 1 || n > 36) {
        setError("The number of charges is a whole number from 1 to 36.");
        return;
      }
      payload = {
        kind,
        priceAmount: Math.round(amount * 10 ** minorUnitDigits(currency)),
        charges: n,
        note: note.trim(),
      };
    }
    setBusy(true);
    try {
      onGranted(await adminApi.grantSpecialTerms(workspaceId, payload));
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title="Grant special terms"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="special-terms-form" disabled={busy || !note.trim()}>
            {busy ? "Granting…" : "Grant"}
          </Button>
        </>
      }
    >
      <form id="special-terms-form" onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="terms-kind" checked={kind === "free_months"} onChange={() => setKind("free_months")} />
            Free months
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="terms-kind" checked={kind === "price_override"} onChange={() => setKind("price_override")} />
            Special price
          </label>
        </div>
        {kind === "free_months" ? (
          <>
            <TextField
              label="Months"
              type="number"
              min={1}
              max={36}
              required
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              hint="Added after the period already paid or comped (from today if that has lapsed). No charge is created for them, and an open charge moves past them."
            />
          </>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={`Price per charge (${currency})`}
              inputMode="decimal"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              hint="Replaces the plan price; a referral discount still comes off it."
            />
            <TextField
              label="For how many charges"
              type="number"
              min={1}
              max={36}
              required
              value={charges}
              onChange={(e) => setCharges(e.target.value)}
              hint="An open charge is re-priced now and counts as the first."
            />
          </div>
        )}
        <TextAreaField
          label="Note"
          required
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="e.g. Launch promo agreed with the merchant on the phone"
          hint="What was agreed and why. Shown here and kept in the audit log."
        />
      </form>
    </Modal>
  );
}

/** "Paid 20 Sep" plus who recorded it and when, or "gateway". */
function PaymentLine({ charge }: { charge: AdminCharge }) {
  if (charge.status !== "paid" || !charge.paidAt) return null;
  const recordedLater =
    charge.paymentRecordedAt && formatDate(charge.paymentRecordedAt) !== formatDate(charge.paidAt);
  return (
    <span className="mt-1 block text-xs text-ink-soft">
      <span title={formatDateTime(charge.paidAt)}>Paid {formatDate(charge.paidAt)}</span>
      {charge.paymentSource === "manual" ? (
        <>
          {" · "}
          <span title={charge.paymentRecordedAt ? formatDateTime(charge.paymentRecordedAt) : undefined}>
            recorded{recordedLater ? ` ${formatDate(charge.paymentRecordedAt)}` : ""}
            {charge.recordedBy ? ` by ${charge.recordedBy.fullName}` : ""}
          </span>
        </>
      ) : (
        " · online"
      )}
    </span>
  );
}

const ONLINE_STATUS_LABELS: Partial<Record<AdminOnlinePayment["status"], string>> = {
  created: "Starting",
  pending: "Awaiting payment",
  paid_duplicate: "Paid twice",
  mismatch: "Amount mismatch",
  superseded: "Replaced",
  error: "Not started",
};

/** What to do about an online payment, when anything. */
function onlinePaymentNote(p: AdminOnlinePayment): string | null {
  if (p.status === "paid_duplicate") {
    return "Paid on a charge that was already paid, so it settled nothing. Refund it in Fawaterak.";
  }
  if (p.status === "mismatch") {
    return `Fawaterak reports it paid, but ${p.failureReason ?? "not as expected"}. It settled nothing: check in Fawaterak, then record or refund by hand.`;
  }
  return p.failureReason;
}

/**
 * Every online checkout (Fawaterak) the merchant started, newest first. Only
 * a payment Fawaterak confirmed, for exactly the price frozen when they
 * pressed Pay, settles a charge.
 */
function OnlinePaymentsPanel({ charges }: { charges: AdminCharge[] }) {
  const rows = charges
    .flatMap((charge) => (charge.onlinePayments ?? []).map((payment) => ({ charge, payment })))
    .sort((a, b) => new Date(b.payment.createdAt).getTime() - new Date(a.payment.createdAt).getTime());
  if (rows.length === 0) return null;
  return (
    <Panel flush title="Online payments">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <Th>Started</Th>
            <Th>Charge</Th>
            <Th className="text-end">Amount</Th>
            <Th>Status</Th>
            <Th>Fawaterak</Th>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ charge, payment: p }) => {
            const note = onlinePaymentNote(p);
            const differs = p.verifiedAmount != null && (p.verifiedAmount !== p.amount || p.verifiedCurrency !== p.currency);
            return (
              <TableRow key={p.id}>
                <Td className="whitespace-nowrap text-sm">
                  <span title={formatDateTime(p.createdAt)}>{formatDate(p.createdAt)}</span>
                </Td>
                <Td className="whitespace-nowrap text-sm">
                  {formatDate(charge.periodStart)} – {formatDate(charge.periodEnd)}
                </Td>
                <Td className="text-end whitespace-nowrap text-sm tabular">
                  {formatMinorMoneyExact(p.amount, p.currency)}
                  {differs && (
                    <span className="block text-xs text-danger">
                      Paid {formatMinorMoneyExact(p.verifiedAmount!, p.verifiedCurrency ?? p.currency)}
                    </span>
                  )}
                </Td>
                <Td>
                  <Status value={p.status} label={ONLINE_STATUS_LABELS[p.status]} />
                  {p.paidAt && <span className="mt-1 block text-xs text-ink-soft">Paid {formatDate(p.paidAt)}</span>}
                  {note && <span className="mt-1 block max-w-80 text-xs text-ink-soft">{note}</span>}
                  {p.refundsReported.map((r) => (
                    <span key={r.reportedAt} className="mt-1 block text-xs text-accent-dark">
                      Refund of {r.amount} {r.currency} reported {formatDate(r.approvedAt ?? r.reportedAt)} — nothing was
                      changed in Zimos.
                    </span>
                  ))}
                </Td>
                <Td className="text-xs text-ink-soft">
                  {p.paymentMethod && <span className="block">{p.paymentMethod}</span>}
                  {p.referenceNumber && <span className="block">Ref <Mono>{p.referenceNumber}</Mono></span>}
                  {p.providerTransactionId != null && (
                    <span className="block">
                      Transaction <Mono>{p.providerTransactionId}</Mono>
                    </span>
                  )}
                </Td>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Panel>
  );
}

function ChargesTable({
  charges,
  onRecord,
  onReverse,
  onVoid,
}: {
  charges: AdminCharge[];
  onRecord?: (charge: AdminCharge) => void;
  onReverse?: (charge: AdminCharge) => void;
  onVoid?: (charge: AdminCharge) => void;
}) {
  const actions = Boolean(onRecord || onReverse || onVoid);
  return (
    <Panel flush>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <Th>Period</Th>
            <Th className="text-end">Due</Th>
            <Th className="text-end">Received</Th>
            <Th>Status</Th>
            <Th>Commission</Th>
            {actions && (
              <Th className="text-end">
                <span className="sr-only">Actions</span>
              </Th>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {charges.map((c) => {
            const unpaid = c.status !== "paid";
            const due = unpaid && c.payableNow ? c.payableNow.amountDue : c.amountDue;
            const discount = unpaid && c.payableNow ? c.payableNow.discountAmount : c.discountAmount;
            return (
              <TableRow key={c.id}>
                <Td className="whitespace-nowrap text-sm">
                  {formatDate(c.periodStart)} – {formatDate(c.periodEnd)}
                  {planMoveLabel(c) && <span className="block text-xs font-medium text-primary">{planMoveLabel(c)}</span>}
                </Td>
                <Td className="text-end whitespace-nowrap">
                  <span className="font-medium tabular">{formatMinorMoneyExact(due, c.currency)}</span>
                  {discount > 0 && (
                    <span className="block text-xs text-ink-soft">
                      {formatMinorMoneyExact(discount, c.currency)} off{c.referralCode ? ` · ${c.referralCode.code}` : ""}
                    </span>
                  )}
                  {c.specialTermsId && (
                    <span className="block text-xs text-primary">Special price</span>
                  )}
                  {unpaid && c.payableNow?.codeLapsed && (
                    <span className="block text-xs text-accent-dark">Code no longer active — full price</span>
                  )}
                </Td>
                <Td className="text-end whitespace-nowrap text-sm tabular">
                  {c.amountPaid == null ? <span className="text-ink-soft">—</span> : formatMinorMoneyExact(c.amountPaid, c.currency)}
                </Td>
                <Td>
                  <Status value={c.status} />
                  <PaymentLine charge={c} />
                  {c.onlinePaymentInProgress && (
                    <span className="mt-1 block text-xs text-primary">Online payment in progress</span>
                  )}
                  {c.status === "failed" && c.failureReason && (
                    <span className="mt-1 block text-xs text-ink-soft">{c.failureReason}</span>
                  )}
                  {c.paymentNote && <span className="block text-xs text-ink-soft">{c.paymentNote}</span>}
                  {voidLabel(c) && <span className="mt-1 block text-xs text-ink-soft">{voidLabel(c)}</span>}
                  {c.status === "void" && c.voidNote && <span className="block text-xs text-ink-soft">Reason: {c.voidNote}</span>}
                </Td>
                <Td className="text-sm whitespace-nowrap">
                  {c.commission ? (
                    <>
                      {formatMinorMoneyExact(c.commission.suggestedCommission, c.currency)}
                      <span className="block text-xs text-ink-soft">
                        {c.commission.payoutStatus === "marked_paid" ? "Paid to agent" : "Pending payout"}
                      </span>
                    </>
                  ) : (
                    <span className="text-ink-soft">—</span>
                  )}
                </Td>
                {actions && (
                  <Td className="text-end whitespace-nowrap">
                    {unpaid && onRecord && (
                      <Button size="sm" variant="outline" onClick={() => onRecord(c)}>
                        <Banknote /> Record payment
                      </Button>
                    )}
                    {/* Only a payment recorded here can be undone: gateway money really moved. */}
                    {c.status === "paid" && c.paymentSource === "manual" && onReverse && (
                      <Button size="sm" variant="ghost" onClick={() => onReverse(c)}>
                        <Undo2 className="text-danger" /> Reverse payment
                      </Button>
                    )}
                    {/* The server says when: pending, and no transfer for it waiting for review. */}
                    {c.status === "pending" && c.voidable === true && onVoid && (
                      <Button size="sm" variant="ghost" onClick={() => onVoid(c)}>
                        <Ban className="text-danger" /> Void
                      </Button>
                    )}
                  </Td>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Panel>
  );
}

function toMajorInput(minor: number, currency: string): string {
  return (minor / 10 ** minorUnitDigits(currency)).toFixed(minorUnitDigits(currency));
}

/** Today as YYYY-MM-DD in the browser's time zone, for a date input. */
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * A picked date → the `paidAt` to send. Blank or today sends nothing (the API
 * then uses "now"); an earlier day is sent as local midday, so the same
 * calendar date comes back whatever the viewer's time zone.
 */
function paidAtFromDate(date: string): string | undefined {
  if (!date || date >= localToday()) return undefined;
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}

function RecordPaymentModal({
  charge,
  onClose,
  onRecorded,
}: {
  charge: AdminCharge;
  onClose: () => void;
  onRecorded: (charge: AdminCharge, codeLapsed: boolean) => void;
}) {
  const due = charge.payableNow ? charge.payableNow.amountDue : charge.amountDue;
  const [amount, setAmount] = useState(() => toMajorInput(due, charge.currency));
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = localToday();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const n = Number(amount);
    if (!amount.trim() || !Number.isFinite(n) || n < 0) {
      setError("Enter the amount received, zero or more.");
      return;
    }
    if (date && date > today) {
      setError("The payment date can't be in the future.");
      return;
    }
    setBusy(true);
    try {
      const { charge: paid, referralCodeLapsed } = await adminApi.recordPayment(charge.id, {
        amountReceived: Math.round(n * 10 ** minorUnitDigits(charge.currency)),
        note: note.trim() || undefined,
        paidAt: paidAtFromDate(date),
      });
      onRecorded(paid, referralCodeLapsed);
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title="Record payment"
      description={`Charge for ${formatDate(charge.periodStart)} – ${formatDate(charge.periodEnd)}: ${formatMinorMoneyExact(due, charge.currency)} due.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="record-payment-form" disabled={busy}>
            {busy ? "Recording…" : "Record payment"}
          </Button>
        </>
      }
    >
      <form id="record-payment-form" onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <Alert>
          This marks the charge paid exactly as an online payment would: the subscription becomes active for this
          period, the referral code is checked again now, and any agent commission is worked out on the amount you
          enter. Zimos moves no money. A mistake can be undone with Reverse payment.
        </Alert>
        {charge.onlinePaymentInProgress && (
          <Alert variant="danger">
            The merchant has an online payment in progress for this charge. Recording a payment here closes it in
            Zimos, but Fawaterak's payment link can't be cancelled: if they pay it anyway, that payment settles nothing
            and shows as "Paid twice", to refund in Fawaterak.
          </Alert>
        )}
        {charge.payableNow?.codeLapsed && (
          <Alert variant="danger">
            This charge was priced with a referral code that is no longer active, so the full price is due and no
            commission will be recorded.
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={`Amount received (${charge.currency})`}
            required
            autoFocus
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            hint="What actually arrived, if it differs from the amount due."
          />
          <TextField
            label="Payment date"
            type="date"
            max={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            hint="When the money arrived. Leave blank for today."
          />
        </div>
        <TextAreaField
          label="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="e.g. Bank transfer, ref 1234"
          hint="Optional. Kept on the charge and in the audit log."
        />
      </form>
    </Modal>
  );
}

function VoidChargeModal({
  charge,
  onClose,
  onVoided,
}: {
  charge: AdminCharge;
  onClose: () => void;
  onVoided: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const due = charge.payableNow ? charge.payableNow.amountDue : charge.amountDue;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Enter why this charge is voided.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await adminApi.voidCharge(charge.id, reason.trim());
      onVoided();
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title="Void charge"
      description={`${formatMinorMoneyExact(due, charge.currency)} due for ${formatDate(charge.periodStart)} – ${formatDate(charge.periodEnd)}.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="void-charge-form" variant="destructive" disabled={busy}>
            {busy ? "Voiding…" : "Void charge"}
          </Button>
        </>
      }
    >
      <form id="void-charge-form" onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <Alert>
          The charge stops asking for money: it is marked void, with your reason kept on it and in the audit log, and
          nothing is owed for it. The subscription itself does not change.
          {charge.targetPlanId ? " The plan change it was for is dropped: the store keeps its plan." : ""}
          {charge.specialTermsId ? " The special-terms charge it used is given back." : ""}
        </Alert>
        {charge.onlinePaymentInProgress && (
          <Alert variant="danger">
            The merchant has an online payment in progress for this charge. Voiding closes it in Zimos, but
            Fawaterak&rsquo;s payment link can&rsquo;t be cancelled: if they pay it anyway, the money is applied or credited
            to their balance, never lost.
          </Alert>
        )}
        <TextAreaField
          label="Reason"
          required
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="e.g. Agreed with the merchant by phone"
          hint="Required. Kept on the charge and in the audit log."
        />
      </form>
    </Modal>
  );
}

function ReversePaymentModal({
  charge,
  onClose,
  onReversed,
}: {
  charge: AdminCharge;
  onClose: () => void;
  onReversed: (result: Awaited<ReturnType<typeof adminApi.reversePayment>>) => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paidOut = charge.commission?.payoutStatus === "marked_paid";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onReversed(await adminApi.reversePayment(charge.id, reason.trim() || undefined));
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title="Reverse payment"
      description={`${charge.amountPaid == null ? "" : formatMinorMoneyExact(charge.amountPaid, charge.currency)} recorded for ${formatDate(charge.periodStart)} – ${formatDate(charge.periodEnd)}.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="reverse-payment-form" variant="destructive" disabled={busy}>
            {busy ? "Reversing…" : "Reverse payment"}
          </Button>
        </>
      }
    >
      <form id="reverse-payment-form" onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <Alert>
          The charge goes back to pending, as if this payment had never been recorded, and its amount, date and note
          are cleared. If this payment is what made the subscription active, it goes back to past due until the
          charge is paid again.
          {charge.commission ? " Its agent commission is voided: kept on record, but no longer counted." : ""}
        </Alert>
        {paidOut && (
          <Alert variant="danger">
            The agent has already been paid this charge&rsquo;s commission. The ledger row stays on record as voided,
            showing money to recover.
          </Alert>
        )}
        <TextAreaField
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="e.g. The transfer bounced"
          hint="Optional. Kept in the audit log, and on the voided commission."
        />
      </form>
    </Modal>
  );
}
