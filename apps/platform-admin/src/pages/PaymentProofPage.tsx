import { useState } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Alert, Button, cn } from "@store-builder/ui";
import type { AdminPaymentProofReview } from "@store-builder/api-client";
import { CanLink } from "@/components/Can";
import { PageHeader } from "@/components/PageHeader";
import { P } from "@/lib/permissions";
import { DataState } from "@/components/DataState";
import { Panel, Mono } from "@/components/Panel";
import { Status } from "@/components/StatusBadge";
import { TextAreaField, TextField } from "@/components/forms";
import { useToast } from "@/components/Toast";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { formatDate, formatDateTime, formatMinorMoneyExact, minorUnitDigits } from "@/lib/format";
import * as adminApi from "@/lib/adminApi";
import { PROOF_STATUS_LABEL } from "@/lib/paymentProofs";

const BLOCKER_TEXT: Record<string, string> = {
  CHARGE_ALREADY_PAID: "This invoice is already paid some other way. Reject this proof with a note; if the money arrived, refund it by hand.",
  CHARGE_REPRICED: "The invoice was re-priced after this proof was sent. Reject it with a note.",
};

/**
 * One transfer proof: the store, what it pays, where the money was sent and
 * from which number, and the screenshot behind a five-minute signed link.
 * Approving takes the amount that arrived; an invoice is settled only by
 * exactly its amount. Rejecting needs a note, which the merchant reads.
 */
export function PaymentProofPage() {
  const { id = "" } = useParams();
  const { data, loading, error, refresh, setData } = useAsync(() => adminApi.getPaymentProof(id), [id]);

  return (
    <div>
      <PageHeader title="Transfer proof" back={{ to: "/payment-proofs", label: "Transfer proofs" }} />
      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {data && <Review review={data} onChange={setData} onReloadImage={() => void refresh({ silent: true })} />}
      </DataState>
    </div>
  );
}

function Review({
  review,
  onChange,
  onReloadImage,
}: {
  review: AdminPaymentProofReview;
  onChange: (next: AdminPaymentProofReview) => void;
  onReloadImage: () => void;
}) {
  const { proof, invoice, image, approvalBlockers } = review;
  const pending = proof.status === "pending";
  const methodName = proof.method.labelEn ?? proof.method.code;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <Panel title="What it pays">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Item label="Store">
              <CanLink permission={P.WORKSPACES_VIEW} to={`/workspaces/${proof.workspace.id}`} className="font-medium text-ink hover:text-primary">
                {proof.workspace.name ?? "Deleted store"}
              </CanLink>
            </Item>
            <Item label="For">{proof.purpose === "invoice" ? "Subscription invoice" : "Balance top-up"}</Item>
            {review.wallet && <Item label="Balance now">{formatMinorMoneyExact(review.wallet.balance, review.wallet.currency)}</Item>}
            {invoice && (
              <Item label="Invoice">
                {formatMinorMoneyExact(invoice.amountDue, invoice.currency)} · {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
                <span className="block">
                  <Status value={invoice.status === "paid" ? "active" : invoice.status} label={invoice.status === "pending" ? "Due" : invoice.status === "paid" ? "Paid" : "Failed"} />
                </span>
              </Item>
            )}
            <Item label="Amount asked">
              <span className="tabular text-base font-semibold text-ink">{formatMinorMoneyExact(proof.requestedAmount, proof.currency)}</span>
            </Item>
            <Item label="Method">{methodName}</Item>
            <Item label="Sent to">
              <Mono>
                <span dir="ltr">{proof.receivingNumber}</span>
              </Mono>
            </Item>
            <Item label="Sent from">
              <Mono>
                <span dir="ltr">{proof.senderPhone}</span>
              </Mono>
            </Item>
            <Item label="Sent at">{formatDateTime(proof.createdAt)}</Item>
            {proof.submittedBy && (
              <Item label="By">
                {proof.submittedBy.fullName} <span className="text-ink-soft">({proof.submittedBy.email})</span>
              </Item>
            )}
            <Item label="Status">
              <Status value={proof.status === "approved" ? "active" : proof.status === "rejected" ? "failed" : "pending"} label={PROOF_STATUS_LABEL[proof.status]} />
            </Item>
          </dl>
        </Panel>

        {pending ? (
          <Decide review={review} onChange={onChange} blockers={approvalBlockers} methodName={methodName} />
        ) : (
          <Panel title="Review">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {proof.receivedAmount != null && <Item label="Amount received">{formatMinorMoneyExact(proof.receivedAmount, proof.currency)}</Item>}
              {proof.reviewNote && <Item label="Note to the merchant">{proof.reviewNote}</Item>}
              <Item label="By">{proof.reviewedBy?.fullName ?? "—"}</Item>
              <Item label="At">{formatDateTime(proof.reviewedAt)}</Item>
            </dl>
          </Panel>
        )}
      </div>

      <Panel
        title="Screenshot"
        description={`The link works until ${formatDateTime(image.expiresAt)}.`}
        actions={
          <Button size="sm" variant="outline" onClick={onReloadImage}>
            <RefreshCw /> New link
          </Button>
        }
      >
        <a href={image.url} target="_blank" rel="noreferrer noopener" className="block">
          <img src={image.url} alt={`Transfer screenshot sent by ${proof.workspace.name ?? "the store"}`} className="max-h-[70vh] w-full rounded-md border border-line object-contain" />
        </a>
      </Panel>
    </div>
  );
}

function Decide({
  review,
  onChange,
  blockers,
  methodName,
}: {
  review: AdminPaymentProofReview;
  onChange: (next: AdminPaymentProofReview) => void;
  blockers: string[];
  methodName: string;
}) {
  const { proof } = review;
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const digits = minorUnitDigits(proof.currency);
  const parsed = Number(amount);
  const received = amount.trim() && Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 10 ** digits) : null;
  const differs = received != null && received !== proof.requestedAmount;
  // An invoice is settled only by exactly its amount.
  const approvable =
    received != null && (proof.purpose === "topup" ? received > 0 : true) && blockers.length === 0 && !(differs && proof.purpose === "invoice");

  async function approve() {
    if (received == null) return;
    setBusy("approve");
    setError(null);
    try {
      onChange(await adminApi.approvePaymentProof(proof.id, received));
      toast.success(proof.purpose === "topup" ? "Approved. The store's balance is credited." : "Approved. The invoice is paid.");
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(null);
    }
  }

  async function reject() {
    setBusy("reject");
    setError(null);
    try {
      onChange(await adminApi.rejectPaymentProof(proof.id, note.trim()));
      toast.success("Rejected. The merchant sees your note.");
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(null);
    }
  }

  return (
    <Panel title="Decide">
      <div className="space-y-4">
        <div role="alert" className="flex gap-2 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-ink">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <span>
            Before approving, open your {methodName} app and check that {formatMinorMoneyExact(proof.requestedAmount, proof.currency)} arrived from{" "}
            <span dir="ltr" className="font-mono">
              {proof.senderPhone}
            </span>
            . A screenshot alone proves nothing.
          </span>
        </div>
        {blockers.map((code) => (
          <Alert key={code} variant="danger">
            {BLOCKER_TEXT[code] ?? code}
          </Alert>
        ))}

        <div className="space-y-2">
          <TextField
            label={`Amount received (${proof.currency})`}
            inputMode="decimal"
            dir="ltr"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setChecking(false);
            }}
            hint="What you saw arrive, not what the merchant says."
          />
          {received != null && (
            <div className={cn("grid grid-cols-2 gap-2 rounded-md border px-3 py-2 text-sm", differs ? "border-danger/40 bg-danger-soft" : "border-line")}>
              <div>
                <p className="text-xs text-ink-soft">Asked</p>
                <p className="tabular font-semibold text-ink">{formatMinorMoneyExact(proof.requestedAmount, proof.currency)}</p>
              </div>
              <div>
                <p className="text-xs text-ink-soft">Received</p>
                <p className="tabular font-semibold text-ink">{formatMinorMoneyExact(received, proof.currency)}</p>
              </div>
              {differs && proof.purpose === "invoice" && (
                <p className="col-span-2 text-xs font-medium text-danger">
                  An invoice is settled only by exactly its amount. Reject this proof with a note instead.
                </p>
              )}
              {differs && proof.purpose === "topup" && (
                <p className="col-span-2 text-xs font-medium text-danger">
                  This is not what the merchant asked for. The balance goes up by the amount received only, {formatMinorMoneyExact(received ?? 0, proof.currency)}.
                </p>
              )}
            </div>
          )}
          {checking ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void approve()} disabled={!approvable || busy !== null}>
                {busy === "approve" ? "Approving…" : `Yes, ${formatMinorMoneyExact(received ?? 0, proof.currency)} arrived — approve`}
              </Button>
              <Button variant="outline" onClick={() => setChecking(false)} disabled={busy !== null}>
                Back
              </Button>
            </div>
          ) : (
            <Button onClick={() => setChecking(true)} disabled={!approvable || busy !== null}>
              Approve…
            </Button>
          )}
        </div>

        <div className="space-y-2 border-t border-line pt-4">
          <TextAreaField
            label="Reason for rejecting (the merchant reads it)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            rows={3}
          />
          <Button variant="destructive" onClick={() => void reject()} disabled={note.trim().length < 3 || busy !== null}>
            {busy === "reject" ? "Rejecting…" : "Reject"}
          </Button>
        </div>
        {error && <Alert variant="danger">{error}</Alert>}
      </div>
    </Panel>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="mt-0.5 text-ink">{children}</dd>
    </div>
  );
}
