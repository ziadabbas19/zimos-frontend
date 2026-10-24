import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Table, TableBody, TableHeader, TableRow, cn } from "@store-builder/ui";
import type { WalletLedgerEntry, WalletRefundBreakdown } from "@store-builder/api-client";
import { Panel, Td, Th } from "@/components/Panel";
import { DataState } from "@/components/DataState";
import { Status } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/forms";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/lib/useAsync";
import * as adminApi from "@/lib/adminApi";
import { getErrorMessage } from "@/lib/errors";
import { P } from "@/lib/permissions";
import { formatDateTime, formatMinorMoneyExact } from "@/lib/format";

const PAGE_SIZE = 10;

const TYPE_LABEL: Record<string, string> = {
  topup: "Top-up",
  order_fee: "Order fee",
  order_fee_reversal: "Fee given back",
  order_fee_recharge: "Fee charged again",
  free_orders_grant: "Free orders granted",
  adjustment: "Correction by hand",
  gift: "Gift (not refundable)",
  refund_hold: "Refund requested (held)",
  refund_release: "Refund released",
  refund_paid: "Refund paid out",
  move_payment_credit: "Late payment of a void plan move (not refundable)",
  order_confirm_fee: "Order fee (at confirmation)",
};

function entryLabel(e: WalletLedgerEntry): string {
  const free = e.freeOrders ?? 0;
  if (free < 0 && e.type !== "free_orders_grant") return "Free order";
  if (free > 0 && e.type === "order_fee_reversal") return "Free order given back";
  return TYPE_LABEL[e.type] ?? e.type;
}

const PHASE: Record<string, { value: string; label: string }> = {
  ok: { value: "active", label: "OK" },
  low: { value: "pending", label: "Low" },
  overdraft: { value: "past_due", label: "In overdraft" },
  exhausted: { value: "failed", label: "Exhausted: not selling" },
};

/**
 * A store's prepaid balance (pay-per-order) and its ledger. The balance moves
 * through orders, approved top-ups (Transfer proofs) and, with a reason, the
 * console: free orders granted (subscriptions.manage) and a correction by
 * hand (payments.record), each written once per dialog.
 */
export function StoreWalletPanel({ workspaceId }: { workspaceId: string }) {
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<"grant" | "adjust" | null>(null);
  const { data, loading, error, refresh } = useAsync(() => adminApi.getWorkspaceWallet(workspaceId, { page, pageSize: PAGE_SIZE }), [workspaceId, page]);
  const w = data?.wallet;
  const entries = data?.ledger.entries ?? [];
  const pages = data ? Math.max(1, Math.ceil(data.ledger.total / PAGE_SIZE)) : 1;

  return (
    <Panel
      title="Prepaid balance"
      description={w && !w.enabled ? "WALLET_ENABLED is off: no fee is charged and no top-up is taken." : "Pay per order: fees come from this balance."}
      className="mt-4"
      flush
      actions={
        w && w.enabled ? (
          <div className="flex flex-wrap gap-2">
            {can(P.SUBSCRIPTIONS_MANAGE) && (
              <Button size="sm" variant="outline" onClick={() => setDialog("grant")}>
                Grant free orders
              </Button>
            )}
            {can(P.PAYMENTS_RECORD) && (
              <Button size="sm" variant="outline" onClick={() => setDialog("adjust")}>
                Add credit or correct
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {w && (
          <>
            <dl className="grid gap-4 px-4 py-4 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-ink-soft">Balance</dt>
                <dd className={cn("tabular text-lg font-semibold", w.balance < 0 ? "text-danger" : "text-ink")}>{formatMinorMoneyExact(w.balance, w.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-soft">Fee per order</dt>
                <dd className="tabular text-ink">{w.onFeePlan && w.fee !== null ? formatMinorMoneyExact(w.fee, w.currency) : "Not on pay per order"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-soft">Orders left</dt>
                <dd className="tabular text-ink">{w.onFeePlan ? `${w.ordersLeft ?? 0} (${w.ordersBeforeOverdraft ?? 0} before overdraft)` : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-soft">State</dt>
                <dd>{w.onFeePlan ? <Status value={PHASE[w.phase].value} label={PHASE[w.phase].label} /> : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-soft">Free orders</dt>
                <dd className="tabular text-ink">
                  {w.freeOrders
                    ? `${w.freeOrders.left} left · ${w.freeOrders.used} used of ${w.freeOrders.allowance} + ${w.freeOrders.granted} granted`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-soft">Owed</dt>
                <dd className={cn("tabular", (w.debt ?? 0) > 0 ? "text-danger" : "text-ink")}>
                  {formatMinorMoneyExact(w.debt ?? Math.max(0, -w.balance), w.currency)}
                  {w.policy === "debt_limit" ? ` (limit ${formatMinorMoneyExact(w.overdraft, w.currency)})` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-soft">Topped up in total</dt>
                <dd className="tabular text-ink">{formatMinorMoneyExact(w.totalToppedUp, w.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-soft">This month (Cairo)</dt>
                <dd className="tabular text-ink">
                  {formatMinorMoneyExact(w.month.fees, w.currency)} · {w.month.orders} orders
                </dd>
              </div>
            </dl>
            {data?.refunds && <RefundRoom refunds={data.refunds} currency={w.currency} />}
            {entries.length === 0 ? (
              <p className="border-t border-line px-4 py-4 text-sm text-ink-soft">No movements yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <Th>When</Th>
                    <Th>What</Th>
                    <Th>Order / proof</Th>
                    <Th className="text-end">Amount</Th>
                    <Th className="text-end">Balance after</Th>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => (
                    <TableRow key={e.id}>
                      <Td className="whitespace-nowrap text-sm">{formatDateTime(e.createdAt)}</Td>
                      <Td className="text-sm">
                        {entryLabel(e)}
                        {e.note && ["adjustment", "free_orders_grant", "gift", "refund_paid"].includes(e.type) && (
                          <span className="block text-xs text-ink-soft">{e.note}</span>
                        )}
                      </Td>
                      <Td className="text-sm">
                        {e.orderNumber ? (
                          <span className="font-mono">{e.orderNumber}</span>
                        ) : e.paymentProofId ? (
                          <Link to={`/payment-proofs/${e.paymentProofId}`} className="hover:text-primary">
                            Transfer proof
                          </Link>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td className={cn("tabular text-end text-sm", e.amount > 0 ? "text-success" : "text-ink")}>
                        {e.amount === 0 && (e.freeOrders ?? 0) !== 0 ? (
                          <span dir="ltr">
                            {(e.freeOrders ?? 0) > 0 ? "+" : ""}
                            {e.freeOrders} free
                          </span>
                        ) : (
                          <span dir="ltr">
                            {e.amount > 0 ? "+" : ""}
                            {formatMinorMoneyExact(e.amount, e.currency)}
                          </span>
                        )}
                      </Td>
                      <Td className="tabular text-end text-sm">{formatMinorMoneyExact(e.balanceAfter, e.currency)}</Td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {pages > 1 && (
              <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-ink-soft">
                <span>
                  Page {page} of {pages}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </DataState>
      <WalletEntryDialog
        kind={dialog}
        workspaceId={workspaceId}
        currency={w?.currency ?? "EGP"}
        onClose={() => setDialog(null)}
        onDone={() => {
          setDialog(null);
          void refresh();
        }}
      />
    </Panel>
  );
}

/**
 * What can still come back as a refund: each paid top-up with its ceiling
 * (75% by default), what was refunded or is held, and what is left; and the
 * store's totals. Gifts and corrections are not top-ups, so not here.
 */
function RefundRoom({ refunds, currency }: { refunds: WalletRefundBreakdown; currency: string }) {
  const money = (minor: number) => formatMinorMoneyExact(minor, currency);
  const share = `${refunds.ceilingBp / 100}%`;
  return (
    <div className="border-t border-line">
      <dl className="grid gap-4 px-4 py-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-ink-soft">Paid top-ups (lifetime)</dt>
          <dd className="tabular text-ink">{money(refunds.lifetimeToppedUp)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-soft">Still refundable ({share} of each)</dt>
          <dd className="tabular text-ink">{money(refunds.refundable)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-soft">Refunded so far</dt>
          <dd className="tabular text-ink">{money(refunds.refunded)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-soft">Refund pending</dt>
          <dd className="tabular text-ink">{money(refunds.pending)}</dd>
        </div>
      </dl>
      {refunds.topups.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <Th>Top-up</Th>
              <Th className="text-end">Amount</Th>
              <Th className="text-end">Ceiling ({share})</Th>
              <Th className="text-end">Refunded</Th>
              <Th className="text-end">Held</Th>
              <Th className="text-end">Remaining</Th>
            </TableRow>
          </TableHeader>
          <TableBody>
            {refunds.topups.map((t) => (
              <TableRow key={t.entryId}>
                <Td className="whitespace-nowrap text-sm">
                  {formatDateTime(t.createdAt)}
                  <span className="block text-xs text-ink-soft">{t.source === "card" ? "Card" : "Transfer"}</span>
                </Td>
                <Td className="tabular text-end text-sm">{money(t.amount)}</Td>
                <Td className="tabular text-end text-sm">{money(t.ceiling)}</Td>
                <Td className="tabular text-end text-sm">{money(t.refunded)}</Td>
                <Td className="tabular text-end text-sm">{money(t.held)}</Td>
                <Td className="tabular text-end text-sm font-medium">{money(t.remaining)}</Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

/** EGP as typed (pounds, a minus sign allowed) → piastres, or null. */
function toMinorSigned(text: string): number | null {
  const t = text.trim().replace(/,/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(t)) return null;
  const negative = t.startsWith("-");
  const [whole, fraction = ""] = t.replace("-", "").split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return negative ? -minor : minor;
}

/**
 * Grant free orders, or correct the balance, with a reason. The dialog keeps
 * one requestId while it's open, so a double click or a retry after a
 * network error writes nothing twice.
 */
function WalletEntryDialog({
  kind,
  workspaceId,
  currency,
  onClose,
  onDone,
}: {
  kind: "grant" | "adjust" | null;
  workspaceId: string;
  currency: string;
  onClose: () => void;
  onDone: () => void;
}) {
  return (
    <Modal
      open={kind !== null}
      onClose={onClose}
      title={kind === "grant" ? "Grant free orders" : "Add credit or correct the balance"}
      description={
        kind === "grant"
          ? "Used before the balance, after the plan's own free orders. Audited with the reason."
          : "A gift only adds; a correction adds or takes (a minus sign takes). Neither is a top-up, so neither can be refunded. Audited with the reason."
      }
    >
      {kind && <WalletEntryForm key={kind} kind={kind} workspaceId={workspaceId} currency={currency} onClose={onClose} onDone={onDone} />}
    </Modal>
  );
}

function WalletEntryForm({
  kind,
  workspaceId,
  currency,
  onClose,
  onDone,
}: {
  kind: "grant" | "adjust";
  workspaceId: string;
  currency: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [requestId] = useState(() => crypto.randomUUID());
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [creditKind, setCreditKind] = useState<"gift" | "correction">("gift");
  const [notify, setNotify] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 3) {
      setError("Write the reason (at least 3 characters).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (kind === "grant") {
        const count = /^\d+$/.test(value.trim()) ? Number(value.trim()) : 0;
        if (count < 1 || count > 1000) {
          setError("Enter a whole number of orders, 1 to 1,000.");
          setBusy(false);
          return;
        }
        await adminApi.grantWalletFreeOrders(workspaceId, { count, reason: reason.trim(), requestId });
        toast.success(`${count} free orders granted.`);
      } else {
        const amount = toMinorSigned(value);
        if (amount === null || amount === 0 || Math.abs(amount) > 2000000 || (creditKind === "gift" && amount < 0)) {
          setError(
            creditKind === "gift"
              ? `Enter the gift in ${currency}, more than 0, at most 20,000.`
              : `Enter an amount in ${currency}, not 0, at most 20,000 either way.`
          );
          setBusy(false);
          return;
        }
        await adminApi.adjustWallet(workspaceId, { amount, reason: reason.trim(), requestId, kind: creditKind, notifyMerchant: notify });
        toast.success(creditKind === "gift" ? "The gift was added." : "The balance was corrected.");
      }
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error && <Alert variant="danger">{error}</Alert>}
      {kind === "adjust" && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink">What is it?</legend>
          {(["gift", "correction"] as const).map((k) => (
            <label key={k} className="flex items-center gap-2 text-sm text-ink">
              <input type="radio" name="credit-kind" value={k} checked={creditKind === k} onChange={() => setCreditKind(k)} />
              {k === "gift" ? "Gift: adds credit, never refundable" : "Correction: adds or takes, never refundable"}
            </label>
          ))}
        </fieldset>
      )}
      <TextField
        label={kind === "grant" ? "Free orders" : `Amount (${currency})`}
        inputMode={kind === "grant" ? "numeric" : "decimal"}
        dir="ltr"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        required
      />
      <TextField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required />
      {kind === "adjust" && (
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          Tell the store in its notifications
        </label>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : kind === "grant" ? "Grant" : "Save"}
        </Button>
      </div>
    </form>
  );
}
