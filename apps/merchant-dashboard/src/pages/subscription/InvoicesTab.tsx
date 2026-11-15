import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, cn } from "@store-builder/ui";
import type { MerchantInvoice, BillingPaymentProof, WorkspaceBilling } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { Modal } from "@/components/Modal";
import { formatDate, formatMinorMoney } from "@/lib/format";
import { useLocale, useT, fmt } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { useToast } from "@/components/Toast";
import { PaymentReturn } from "./billingParts";
import { PayDialog } from "./PayDialog";
import { PAY_STRINGS } from "./payStrings";
import { BILLING_STRINGS, type ReturnHint } from "./billingText";
import { SUBSCRIPTION_STRINGS, type SubscriptionText } from "./subscriptionStrings";

const PAGE_SIZE = 10;

type PayText = Record<keyof (typeof PAY_STRINGS)["en"], string>;

/**
 * The store's charges, newest first, a page at a time; above them the Pay
 * button (while something is due and a way to pay is offered: a gateway's
 * page or a transfer with its proof), the store's transfers and how they
 * were reviewed, and, back from a gateway, what became of the payment.
 * `payRequested` (the Plans tab's "Pay now") opens the Pay dialog once it is
 * known that something is due and can be paid, then `onPayRequestDone`.
 * A pending invoice the server marks `cancellable` (PLAN_SWITCH_ENABLED, no
 * transfer for it being checked) can be cancelled, after a confirmation.
 */
export function InvoicesTab({
  billing,
  returned,
  onReturnDone,
  onPaid,
  payRequested = false,
  onPayRequestDone,
}: {
  billing: WorkspaceBilling | null;
  returned: { paymentId: string; hint: ReturnHint } | null;
  onReturnDone: () => void;
  onPaid: () => void;
  payRequested?: boolean;
  onPayRequestDone?: () => void;
}) {
  const t = useT(SUBSCRIPTION_STRINGS);
  const p = useT(PAY_STRINGS);
  const toast = useToast();
  const workspaceId = useWorkspaceId();
  const [page, setPage] = useState(1);
  const [paying, setPaying] = useState(false);
  const [cancelling, setCancelling] = useState<MerchantInvoice | null>(null);
  const invoices = useAsync(() => apiClient.listBillingInvoices(workspaceId, { page, pageSize: PAGE_SIZE }), [workspaceId, page]);
  const methods = useAsync(() => apiClient.getPaymentMethods(workspaceId), [workspaceId]);
  const proofs = useAsync(() => apiClient.listBillingPaymentProofs(workspaceId), [workspaceId]);
  const pages = invoices.data ? Math.max(1, Math.ceil(invoices.data.total / PAGE_SIZE)) : 1;

  const offered = methods.data?.methods ?? [];
  const openInvoice = invoices.data?.invoices.find((i) => i.status === "pending") ?? null;
  const due = Boolean(openInvoice || billing?.nextCharge);
  const allProofs = proofs.data?.proofs ?? [];
  const waiting = allProofs.find((x) => x.status === "pending" && x.purpose === "invoice") ?? null;
  const latestFor = (invoiceId: string) => allProofs.find((x) => x.invoiceId === invoiceId) ?? null;
  const canPay = offered.length > 0 && !waiting;
  const known = Boolean(billing && invoices.data && methods.data && proofs.data);

  useEffect(() => {
    if (!payRequested || !known) return;
    // Nothing due, no method, or a transfer under review: the panel says so instead.
    if (due && canPay) setPaying(true);
    onPayRequestDone?.();
  }, [payRequested, known, due, canPay, onPayRequestDone]);

  return (
    <div className="space-y-5">
      {returned && (
        <PaymentReturn
          key={returned.paymentId}
          paymentId={returned.paymentId}
          hint={returned.hint}
          onSettled={() => {
            onPaid();
            void invoices.refresh({ silent: true });
          }}
          onDone={onReturnDone}
        />
      )}

      {due && methods.data && (
        <PayPanel
          p={p}
          billing={billing}
          openInvoice={openInvoice}
          contactSupport={methods.data.contactSupport}
          waiting={waiting}
          canPay={canPay}
          onPay={() => setPaying(true)}
        />
      )}

      {allProofs.length > 0 && <ProofList proofs={allProofs.slice(0, 5)} p={p} />}

      <DataState
        loading={invoices.loading && !invoices.data}
        error={invoices.error}
        empty={invoices.data?.invoices.length === 0}
        emptyMessage={t.noInvoices}
        onRetry={() => void invoices.refresh()}
      >
        <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-paper-raised">
          {invoices.data?.invoices.map((invoice) => (
            <InvoiceRow
              key={invoice.id}
              invoice={invoice}
              t={t}
              p={p}
              proof={latestFor(invoice.id)}
              onPay={invoice.status === "pending" && canPay ? () => setPaying(true) : null}
              onCancel={invoice.status === "pending" && invoice.cancellable === true ? () => setCancelling(invoice) : null}
            />
          ))}
        </ul>
        {pages > 1 && (
          <nav className="mt-3 flex items-center justify-between gap-3" aria-label={t.invoicesTab}>
            <Button type="button" variant="outline" className="min-h-10" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>
              {t.previous}
            </Button>
            <span className="text-sm text-ink-soft">{fmt(t.pageOf, { page, pages })}</span>
            <Button type="button" variant="outline" className="min-h-10" disabled={page >= pages} onClick={() => setPage((n) => n + 1)}>
              {t.next}
            </Button>
          </nav>
        )}
      </DataState>

      <CancelInvoiceDialog
        invoice={cancelling}
        onClose={() => setCancelling(null)}
        onCancelled={() => {
          setCancelling(null);
          toast.success(t.invoiceCancelled);
          void invoices.refresh({ silent: true });
          // The summary, the plans and any change waiting follow.
          onPaid();
        }}
      />

      <PayDialog
        open={paying}
        methods={offered}
        onClose={() => setPaying(false)}
        onProofSent={() => {
          toast.success(p.sent);
          void proofs.refresh({ silent: true });
          void invoices.refresh({ silent: true });
        }}
      />
    </div>
  );
}

function PayPanel({
  p,
  billing,
  openInvoice,
  contactSupport,
  waiting,
  canPay,
  onPay,
}: {
  p: PayText;
  billing: WorkspaceBilling | null;
  openInvoice: MerchantInvoice | null;
  contactSupport: boolean;
  waiting: BillingPaymentProof | null;
  canPay: boolean;
  onPay: () => void;
}) {
  const amount = openInvoice
    ? formatMinorMoney(openInvoice.amountDue, openInvoice.currency)
    : billing?.nextCharge
      ? formatMinorMoney(billing.nextCharge.amount, billing.nextCharge.currency)
      : "";
  const bt = useT(BILLING_STRINGS);
  // A Fawry-style reference from a gateway payment still awaiting the customer.
  const latest = billing?.onlinePayment?.latest ?? null;
  const awaiting = latest && latest.status === "pending" && latest.referenceNumber ? latest : null;

  return (
    <section aria-label={p.payPanelTitle} className="space-y-2 rounded-[10px] border border-line bg-paper px-4 py-3">
      <p className="text-sm text-ink">{fmt(p.payPanelBody, { amount })}</p>
      {awaiting && (
        <p className="text-sm text-ink-soft">
          {fmt(bt.awaitingReference, { method: awaiting.paymentMethod ?? "", reference: awaiting.referenceNumber ?? "" })}
        </p>
      )}
      {contactSupport ? (
        <p className="text-sm text-ink-soft">
          {p.contactSupport}{" "}
          <Link to="/support" className="font-medium text-primary hover:underline">
            {p.contactLink}
          </Link>
        </p>
      ) : waiting ? (
        <p className="text-sm font-medium text-ink">{p.transferUnderReview}</p>
      ) : (
        canPay && (
          <Button type="button" onClick={onPay} className="min-h-11">
            {p.payButton}
          </Button>
        )
      )}
    </section>
  );
}

function ProofList({ proofs, p }: { proofs: BillingPaymentProof[]; p: PayText }) {
  const { locale } = useLocale();
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-ink">{p.proofsTitle}</h2>
      <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-paper-raised">
        {proofs.map((proof) => (
          <li key={proof.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm text-ink">
                {fmt(p.proofLine, {
                  method: proof.method.label ? proof.method.label[locale] || proof.method.label.en : proof.method.code,
                  amount: formatMinorMoney(proof.amount, proof.currency),
                  date: formatDate(proof.createdAt),
                })}
              </p>
              {proof.status === "rejected" && proof.reviewNote && (
                <p className="text-xs text-danger">{fmt(p.proofReason, { note: proof.reviewNote })}</p>
              )}
            </div>
            <ProofBadge status={proof.status} p={p} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProofBadge({ status, p }: { status: BillingPaymentProof["status"]; p: PayText }) {
  const label = status === "approved" ? p.proofApproved : status === "rejected" ? p.proofRejected : p.proofPending;
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
        status === "approved" ? "bg-success-soft text-success" : status === "rejected" ? "bg-danger-soft text-danger" : "bg-accent-soft text-ink"
      )}
    >
      {label}
    </span>
  );
}

/** "Cancel this invoice?": what cancelling it means, then the server voids it. */
function CancelInvoiceDialog({
  invoice,
  onClose,
  onCancelled,
}: {
  invoice: MerchantInvoice | null;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const t = useT(SUBSCRIPTION_STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (busy) return;
    setError(null);
    onClose();
  }

  async function confirm() {
    if (!invoice) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.cancelBillingCharge(workspaceId, invoice.id);
      onCancelled();
    } catch (err) {
      setError(
        errorMessage(err, {
          PROOF_UNDER_REVIEW: t.cancelInvoiceProof,
          CHARGE_ALREADY_PAID: t.cancelInvoicePaid,
          CHARGE_NOT_PENDING: t.cancelInvoiceNotPending,
          PLAN_SWITCH_DISABLED: t.cancelInvoiceDisabled,
        })
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={Boolean(invoice)}
      onClose={close}
      title={t.cancelInvoiceTitle}
      footer={
        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="outline" className="min-h-11" onClick={close} disabled={busy}>
            {t.keepInvoice}
          </Button>
          <Button type="button" variant="destructive" className="min-h-11" onClick={() => void confirm()} disabled={busy}>
            {busy ? t.cancellingInvoice : t.cancelInvoiceConfirm}
          </Button>
        </div>
      }
    >
      {invoice && (
        <div className="space-y-3">
          <p className="text-sm text-ink">{fmt(t.cancelInvoiceBody, { amount: formatMinorMoney(invoice.amountDue, invoice.currency) })}</p>
          {error && (
            <Alert variant="danger" role="alert">
              {error}
            </Alert>
          )}
        </div>
      )}
    </Modal>
  );
}

function InvoiceRow({
  invoice,
  t,
  p,
  proof,
  onPay,
  onCancel,
}: {
  invoice: MerchantInvoice;
  t: SubscriptionText;
  p: PayText;
  proof: BillingPaymentProof | null;
  onPay: (() => void) | null;
  /** The server says it may be cancelled (`cancellable`); null hides the button. */
  onCancel: (() => void) | null;
}) {
  const status =
    invoice.status === "paid"
      ? t.statusPaid
      : invoice.status === "pending"
        ? t.statusPending
        : invoice.status === "void"
          ? t[`statusVoid_${invoice.voidReason ?? "cancelled"}` as keyof SubscriptionText] ?? t.statusVoid_cancelled
          : t.statusFailed;
  const amount = invoice.status === "paid" && invoice.amountPaid != null ? invoice.amountPaid : invoice.amountDue;
  const underReview = invoice.status === "pending" && proof?.status === "pending";
  const rejected = invoice.status === "pending" && proof?.status === "rejected" ? proof : null;
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{formatDate(invoice.paidAt ?? invoice.createdAt)}</p>
        <p className="text-xs text-ink-soft">
          {t.invoicePeriod}: {fmt(t.periodRange, { start: formatDate(invoice.periodStart), end: formatDate(invoice.periodEnd) })}
        </p>
        {rejected?.reviewNote && <p className="mt-1 text-xs text-danger">{fmt(p.transferRejected, { note: rejected.reviewNote })}</p>}
      </div>
      <div className="text-end">
        <p className="tabular text-sm font-medium text-ink">{formatMinorMoney(amount, invoice.currency)}</p>
        {invoice.discountAmount > 0 && (
          <p className="text-xs text-ink-soft">{fmt(t.discountLine, { discount: formatMinorMoney(invoice.discountAmount, invoice.currency) })}</p>
        )}
        <span
          className={cn(
            "mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium",
            invoice.status === "paid"
              ? "bg-success-soft text-success"
              : invoice.status === "pending"
                ? "bg-accent-soft text-ink"
                : invoice.status === "void"
                  ? "border border-line text-ink-soft"
                  : "bg-danger-soft text-danger"
          )}
        >
          {underReview ? p.transferUnderReview : status}
        </span>
        {((onPay && !underReview) || (onCancel && !underReview)) && (
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            {onPay && !underReview && (
              <Button type="button" variant="outline" onClick={onPay} className="min-h-10">
                {p.payInvoice}
              </Button>
            )}
            {/* Hidden while a transfer for it is being checked, as the server says too. */}
            {onCancel && !underReview && (
              <Button type="button" variant="ghost" onClick={onCancel} className="min-h-10 text-danger">
                {t.cancelInvoice}
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
