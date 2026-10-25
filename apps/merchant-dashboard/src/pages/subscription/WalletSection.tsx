import { useId, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Button, Input, Label, cn } from "@store-builder/ui";
import type { BillingPaymentMethod, BillingPaymentProof, OnlinePayment, WalletLedgerEntry, WalletSummary } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatDate, formatDateTime, formatMinorMoney } from "@/lib/format";
import { useLocale, useT, fmt } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { useErrorMessage } from "@/lib/errorMessages";
import { TransferPay } from "./PayDialog";
import { PAY_STRINGS } from "./payStrings";
import { SUBSCRIPTION_STRINGS } from "./subscriptionStrings";
import { WALLET_STRINGS, type WalletText } from "./walletStrings";
import { WalletRefunds } from "./WalletRefunds";

const PAGE_SIZE = 10;

/**
 * The prepaid balance on the Usage tab (WALLET_ENABLED): the balance, the fee
 * per order and how many orders it still pays for, this month's fees in
 * Cairo time, the history a page at a time, and topping up by a transfer
 * with its proof. Nothing at all while the balance is switched off.
 */
export function WalletSection() {
  const t = useT(WALLET_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [page, setPage] = useState(1);
  // Back from a card top-up's payment page: ask the API (the redirect proves nothing).
  const [params] = useSearchParams();
  // ?wallet=topup (the toolbar's balance, the locked-orders banner) opens the top-up dialog.
  const [topping, setTopping] = useState(() => params.get("wallet") === "topup");
  const summary = useAsync(() => apiClient.getWallet(workspaceId), [workspaceId]);
  const ledger = useAsync(() => apiClient.getWalletLedger(workspaceId, { page, pageSize: PAGE_SIZE }), [workspaceId, page]);
  const proofs = useAsync(() => apiClient.listBillingPaymentProofs(workspaceId), [workspaceId]);
  const returned = params.get("topup");
  const cardResult = useAsync(
    () => (returned ? apiClient.getOnlinePayment(workspaceId, returned).catch(() => null) : Promise.resolve(null)),
    [workspaceId, returned]
  );
  const w = summary.data;
  if (!w || !w.enabled) return null;
  // Only a store on the pay-per-order plan, or one that has a balance from
  // before (an API without hasEntries keeps showing it, as it did).
  if (!w.onFeePlan && w.hasEntries === false) return null;
  const free = w.freeOrders;
  const freeTotal = free ? free.allowance + free.granted : 0;

  const topups = (proofs.data?.proofs ?? []).filter((p) => p.purpose === "topup").slice(0, 5);
  const pages = ledger.data ? Math.max(1, Math.ceil(ledger.data.total / PAGE_SIZE)) : 1;

  return (
    <section aria-labelledby="wallet-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="wallet-title" className="font-display text-lg font-medium text-ink">
            {t.walletTitle}
          </h2>
          <p className="text-sm text-ink-soft">{w.onFeePlan ? t.walletBody : t.notOnFeePlan}</p>
        </div>
        {(w.onFeePlan || w.balance < 0) && (
          <Button type="button" onClick={() => setTopping(true)} className="min-h-11">
            {t.topUp}
          </Button>
        )}
      </div>

      {cardResult.data && <CardResult payment={cardResult.data.payment} t={t} />}
      <PhaseNotice wallet={w} t={t} />

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t.balance} value={formatMinorMoney(w.balance, w.currency)} danger={w.balance < 0} />
        {w.policy === "debt_limit" && (w.debt ?? 0) > 0 && (
          <Stat
            label={t.debt}
            value={formatMinorMoney(w.debt ?? 0, w.currency)}
            note={fmt(t.debtNote, { limit: formatMinorMoney(w.overdraft, w.currency) })}
            danger
          />
        )}
        {w.onFeePlan && free && freeTotal > 0 && (
          <Stat label={t.freeOrdersLeft} value={fmt(t.freeOrdersLeftValue, { left: free.left, total: freeTotal })} />
        )}
        {w.onFeePlan && w.fee !== null && (
          <>
            <Stat label={t.feePerOrder} value={formatMinorMoney(w.fee, w.currency)} />
            <Stat
              label={t.ordersLeft}
              value={fmt(t.ordersLeftValue, { left: w.ordersLeft ?? 0, before: w.ordersBeforeOverdraft ?? 0 })}
            />
          </>
        )}
        <Stat
          label={t.thisMonth}
          value={fmt(t.thisMonthValue, { amount: formatMinorMoney(w.month.fees, w.currency), orders: w.month.orders })}
          note={t.cairoNote}
        />
      </dl>

      {topups.length > 0 && <TopupList proofs={topups} />}
      {(w.onlineTopups ?? []).length > 0 && <CardTopupList payments={w.onlineTopups ?? []} t={t} />}

      <WalletRefunds
        onChanged={() => {
          void summary.refresh({ silent: true });
          void ledger.refresh({ silent: true });
        }}
      />

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-ink">{t.ledgerTitle}</h3>
        {ledger.data && ledger.data.entries.length === 0 ? (
          <p className="text-sm text-ink-soft">{t.ledgerEmpty}</p>
        ) : (
          <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-paper-raised">
            {(ledger.data?.entries ?? []).map((entry) => (
              <EntryRow key={entry.id} entry={entry} t={t} />
            ))}
          </ul>
        )}
        {pages > 1 && <Pages page={page} pages={pages} onPage={setPage} />}
      </div>

      <TopupDialog
        open={topping}
        wallet={w}
        onClose={() => setTopping(false)}
        onSent={() => {
          toast.success(t.topupSent);
          void proofs.refresh({ silent: true });
        }}
      />
    </section>
  );
}

type CardState = "paid" | "open" | "failed" | "problem";

function cardState(payment: OnlinePayment): CardState {
  if (payment.status === "paid") return "paid";
  if (payment.status === "mismatch" || payment.status === "paid_duplicate") return "problem";
  if (["created", "open", "pending", "superseded"].includes(payment.status)) return "open";
  return "failed";
}

function CardResult({ payment, t }: { payment: OnlinePayment; t: WalletText }) {
  if (payment.purpose && payment.purpose !== "topup") return null;
  const state = cardState(payment);
  if (state === "paid") return <Alert role="status">{t.cardPaid}</Alert>;
  if (state === "open") return <Alert role="status">{t.cardPending}</Alert>;
  if (state === "problem") return <Alert variant="danger">{t.cardProblem}</Alert>;
  return <Alert variant="danger">{t.cardFailed}</Alert>;
}

function CardTopupList({ payments, t }: { payments: OnlinePayment[]; t: WalletText }) {
  const label: Record<CardState, string> = {
    paid: t.cardStatusPaid,
    open: t.cardStatusOpen,
    failed: t.cardStatusFailed,
    problem: t.cardStatusProblem,
  };
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-ink">{t.cardTopupsTitle}</h3>
      <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-paper-raised">
        {payments.map((payment) => {
          const state = cardState(payment);
          return (
            <li key={payment.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-3">
              <p className="tabular text-sm text-ink">
                {formatMinorMoney(payment.amount, payment.currency)} · {formatDate(payment.createdAt)}
              </p>
              <span
                className={cn(
                  "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                  state === "paid" ? "bg-success-soft text-success" : state === "open" ? "bg-accent-soft text-ink" : "bg-danger-soft text-danger"
                )}
              >
                {label[state]}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PhaseNotice({ wallet, t }: { wallet: WalletSummary; t: WalletText }) {
  if (!wallet.onFeePlan || wallet.phase === "ok") return null;
  if (wallet.policy === "debt_limit") {
    // The plan's own limit: the store stays open, only new orders stop.
    if (wallet.phase === "exhausted") return <Alert variant="danger">{t.phaseLimitReached}</Alert>;
    if (wallet.phase === "overdraft") {
      return <Alert role="status">{fmt(t.phaseDebt, { limit: formatMinorMoney(wallet.overdraft, wallet.currency) })}</Alert>;
    }
  }
  if (wallet.phase === "exhausted") return <Alert variant="danger">{t.phaseExhausted}</Alert>;
  if (wallet.phase === "overdraft") {
    return <Alert role="status">{fmt(t.phaseOverdraft, { overdraft: formatMinorMoney(wallet.overdraft, wallet.currency) })}</Alert>;
  }
  return <Alert role="status">{fmt(t.phaseLow, { count: wallet.limits.lowOrders })}</Alert>;
}

function Stat({ label, value, note, danger = false }: { label: string; value: string; note?: string; danger?: boolean }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-paper-raised p-4">
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className={cn("tabular mt-1 text-lg font-semibold", danger ? "text-danger" : "text-ink")}>{value}</dd>
      {note && <dd className="mt-0.5 text-xs text-ink-soft">{note}</dd>}
    </div>
  );
}

function entryLabel(entry: WalletLedgerEntry, t: WalletText): string {
  const free = entry.freeOrders ?? 0;
  if (free < 0 && entry.type !== "free_orders_grant") return t.freeOrder;
  if (free > 0 && entry.type === "order_fee_reversal") return t.freeOrderReturned;
  return t[`type_${entry.type}` as keyof WalletText] ?? entry.type;
}

function EntryRow({ entry, t }: { entry: WalletLedgerEntry; t: WalletText }) {
  const label = entryLabel(entry, t);
  const free = entry.freeOrders ?? 0;
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-ink-soft">
          {formatDateTime(entry.createdAt)}
          {entry.orderNumber ? ` · ${fmt(t.orderRef, { number: entry.orderNumber })}` : ""}
        </p>
        {entry.type === "adjustment" && entry.note && <p className="text-xs text-ink-soft">{entry.note}</p>}
      </div>
      <div className="text-end">
        {entry.amount === 0 && free !== 0 ? (
          <p className="tabular text-sm font-medium text-ink">{fmt(t.freeOrdersValue, { count: Math.abs(free) })}</p>
        ) : (
          <p className={cn("tabular text-sm font-medium", entry.amount < 0 ? "text-ink" : "text-success")} dir="ltr">
            {entry.amount > 0 ? "+" : ""}
            {formatMinorMoney(entry.amount, entry.currency)}
          </p>
        )}
        <p className="tabular text-xs text-ink-soft">{formatMinorMoney(entry.balanceAfter, entry.currency)}</p>
      </div>
    </li>
  );
}

function TopupList({ proofs }: { proofs: BillingPaymentProof[] }) {
  const t = useT(WALLET_STRINGS);
  const p = useT(PAY_STRINGS);
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-ink">{t.topupsTitle}</h3>
      <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-paper-raised">
        {proofs.map((proof) => (
          <li key={proof.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-3">
            <div className="min-w-0">
              <p className="tabular text-sm text-ink">
                {formatMinorMoney(proof.amount, proof.currency)} · {formatDate(proof.createdAt)}
              </p>
              {proof.status === "rejected" && proof.reviewNote && (
                <p className="text-xs text-danger">{fmt(p.proofReason, { note: proof.reviewNote })}</p>
              )}
            </div>
            <span
              className={cn(
                "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                proof.status === "approved"
                  ? "bg-success-soft text-success"
                  : proof.status === "rejected"
                    ? "bg-danger-soft text-danger"
                    : "bg-accent-soft text-ink"
              )}
            >
              {proof.status === "approved" ? p.proofApproved : proof.status === "rejected" ? p.proofRejected : p.proofPending}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Pages({ page, pages, onPage }: { page: number; pages: number; onPage: (next: number) => void }) {
  const s = useT(SUBSCRIPTION_STRINGS);
  return (
    <nav className="flex items-center justify-between gap-3" aria-label={s.pageOf}>
      <Button type="button" variant="outline" className="min-h-10" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        {s.previous}
      </Button>
      <span className="text-sm text-ink-soft">{fmt(s.pageOf, { page, pages })}</span>
      <Button type="button" variant="outline" className="min-h-10" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        {s.next}
      </Button>
    </nav>
  );
}

/** EGP pounds as typed → piastres, or null when it isn't an amount. */
export function toMinor(text: string): number | null {
  const normalised = text.trim().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalised)) return null;
  const [whole, fraction = ""] = normalised.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

function TopupDialog({
  open,
  wallet,
  onClose,
  onSent,
}: {
  open: boolean;
  wallet: WalletSummary;
  onClose: () => void;
  onSent: (proof: BillingPaymentProof) => void;
}) {
  const t = useT(WALLET_STRINGS);
  return (
    <Modal open={open} onClose={onClose} title={t.topupTitle}>
      {open && <TopupBody wallet={wallet} onClose={onClose} onSent={onSent} />}
    </Modal>
  );
}

function TopupBody({ wallet, onClose, onSent }: { wallet: WalletSummary; onClose: () => void; onSent: (proof: BillingPaymentProof) => void }) {
  const t = useT(WALLET_STRINGS);
  const p = useT(PAY_STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const amountId = useId();
  const methods = useAsync(() => apiClient.getPaymentMethods(workspaceId), [workspaceId]);
  const manual: BillingPaymentMethod[] = (methods.data?.methods ?? []).filter((m) => m.kind === "manual");
  // A card through a gateway of Zimos's own, for a store on the pay-per-order plan.
  const cards: BillingPaymentMethod[] = wallet.onFeePlan ? (methods.data?.methods ?? []).filter((m) => m.kind === "gateway") : [];
  const offered = [...cards, ...manual];
  const [text, setText] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const min = formatMinorMoney(wallet.limits.minTopup, wallet.currency);
  const max = formatMinorMoney(wallet.limits.maxTopup, wallet.currency);

  function next(e: FormEvent) {
    e.preventDefault();
    const minor = toMinor(text);
    if (minor === null || minor < wallet.limits.minTopup || minor > wallet.limits.maxTopup) {
      setProblem(fmt(t.topupAmountInvalid, { min, max }));
      return;
    }
    setProblem(null);
    setAmount(minor);
  }

  if (methods.data && offered.length === 0) return <Alert variant="danger">{t.noManualMethod}</Alert>;

  if (amount === null) {
    return (
      <form onSubmit={next} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor={amountId}>{t.topupAmount}</Label>
          <Input
            id={amountId}
            inputMode="decimal"
            dir="ltr"
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-invalid={problem ? true : undefined}
            aria-describedby={`${amountId}-hint`}
            className="min-h-11"
          />
          <p id={`${amountId}-hint`} className={cn("text-xs", problem ? "font-medium text-danger" : "text-ink-soft")}>
            {problem ?? fmt(t.topupAmountHint, { min, max })}
          </p>
        </div>
        <div className="flex justify-end">
          <Button type="submit" className="min-h-11">
            {t.topupNext}
          </Button>
        </div>
      </form>
    );
  }

  const chosen = offered.find((m) => m.code === code) ?? offered[0] ?? null;
  const formatted = formatMinorMoney(amount, wallet.currency);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-line bg-paper px-4 py-3">
        <div>
          <p className="text-xs text-ink-soft">{t.topupAmount}</p>
          <p className="tabular text-lg font-medium text-ink">{formatted}</p>
        </div>
        <Button type="button" variant="outline" onClick={() => setAmount(null)} className="min-h-10">
          {t.changeAmount}
        </Button>
      </div>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium text-ink">{p.chooseMethod}</legend>
        <div role="radiogroup" className="grid gap-2">
          {offered.map((m) => (
            <label
              key={m.code}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] border px-3 py-2 text-sm",
                chosen?.code === m.code ? "border-primary bg-primary-soft text-ink" : "border-line text-ink-soft"
              )}
            >
              <input type="radio" name="topup-method" value={m.code} checked={chosen?.code === m.code} onChange={() => setCode(m.code)} />
              {m.label[locale] || m.label.en}
            </label>
          ))}
        </div>
      </fieldset>
      {chosen && chosen.kind === "gateway" && <CardTopup key={chosen.code} method={chosen} amount={amount} formatted={formatted} />}
      {chosen && chosen.kind === "manual" && (
        <TransferPay
          key={chosen.code}
          method={chosen}
          amount={formatted}
          submit={(fields) => apiClient.submitWalletTopup(workspaceId, { requestedAmount: amount, ...fields })}
          onCancel={onClose}
          onSent={(proof) => {
            onSent(proof);
            onClose();
          }}
          errorOverrides={{
            TOO_MANY_OPEN_TOPUPS: fmt(t.topupTooMany, { count: wallet.limits.maxOpenTopups }),
            TOO_MANY_OPEN_PROOFS: fmt(t.topupTooMany, { count: wallet.limits.maxOpenTopups }),
            TOPUP_AMOUNT_OUT_OF_RANGE: fmt(t.topupAmountInvalid, { min, max }),
            WALLET_DISABLED: t.topupDisabled,
          }}
        />
      )}
    </div>
  );
}

/** A card top-up: the gateway's hosted page for `amount`; the balance moves once the API confirms it. */
function CardTopup({ method, amount, formatted }: { method: BillingPaymentMethod; amount: number; formatted: string }) {
  const t = useT(WALLET_STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const { payment } = await apiClient.startWalletTopupOnline(workspaceId, { amount, lang: locale === "en" ? "en" : "ar", method: method.code });
      if (!payment.checkoutUrl) throw new Error("no checkout");
      window.location.assign(payment.checkoutUrl);
    } catch (err) {
      setError(
        errorMessage(err, {
          WALLET_NOT_ON_PLAN: t.cardNotOnPlan,
          WALLET_DISABLED: t.topupDisabled,
          PAYMENT_METHOD_NOT_AVAILABLE: t.cardStartFailed,
          ONLINE_BILLING_DISABLED: t.cardStartFailed,
          ONLINE_BILLING_UNAVAILABLE: t.cardStartFailed,
          ONLINE_PAYMENT_START_FAILED: t.cardStartFailed,
          PAYMENT_STARTING: t.cardPending,
        })
      );
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-soft">{fmt(t.cardHint, { amount: formatted, name: method.label[locale] || method.label.en })}</p>
      <Button type="button" onClick={() => void go()} disabled={busy} className="min-h-11 w-full sm:w-auto">
        {busy ? t.cardOpening : t.cardPay}
      </Button>
      {error && <Alert variant="danger">{error}</Alert>}
    </div>
  );
}
