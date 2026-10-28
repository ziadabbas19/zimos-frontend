import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Alert, Button, Table, TableBody, TableHeader, TableRow, cn } from "@store-builder/ui";
import type {
  AdminCommission,
  AdminCommissionTotals,
  AdminReferralCode,
  AdminReferralCodeInput,
  AdminReferredMerchant,
  ReferralDiscountType,
} from "@store-builder/api-client";
import { Modal } from "@/components/Modal";
import { Mono, Panel, Td, Th } from "@/components/Panel";
import { SelectField, TextAreaField, TextField } from "@/components/forms";
import { Status, StatusBadge } from "@/components/StatusBadge";
import { Toggle } from "@/components/Toggle";
import { getErrorMessage } from "@/lib/errors";
import { formatBp, formatDate, formatDateTime, formatMinorMoneyExact } from "@/lib/format";
import { initialCodeForm, toCodeInput, type CodeFormState } from "@/lib/referrals";

/**
 * Components shared by the Agents screens and an agent's own My referrals
 * page. Amounts arrive in minor units; rates and percentage discounts in
 * basis points (1500 = 15.00%), like everywhere else in the API. The unit
 * conversions live in lib/referrals.
 */

/** "EGP 1,200.00 pending · EGP 300.00 paid" per currency, never summed across. */
export function CommissionTotals({ totals, empty = "—" }: { totals: AdminCommissionTotals[]; empty?: string }) {
  if (totals.length === 0) return <span className="text-ink-soft">{empty}</span>;
  return (
    <div className="space-y-0.5">
      {totals.map((t) => (
        <div key={t.currency} className="text-sm whitespace-nowrap">
          <span className="font-medium">{formatMinorMoneyExact(t.pending, t.currency)}</span>
          <span className="text-ink-soft"> pending · </span>
          <span className="font-medium">{formatMinorMoneyExact(t.markedPaid, t.currency)}</span>
          <span className="text-ink-soft"> paid</span>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------- code form

export function CodeFields({
  form,
  setForm,
  creating,
  defaultRateBp,
}: {
  form: CodeFormState;
  setForm: (next: CodeFormState) => void;
  creating: boolean;
  defaultRateBp: number;
}) {
  const set = (patch: Partial<CodeFormState>) => setForm({ ...form, ...patch });
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Code"
          required={creating}
          disabled={!creating}
          value={form.code}
          onChange={(e) => set({ code: e.target.value.toUpperCase() })}
          placeholder="CAIRO10"
          maxLength={32}
          hint={creating ? "3–32 letters, digits or dashes. It can't be changed later." : "Codes can't be renamed."}
        />
        <TextField
          label="Label"
          value={form.label}
          onChange={(e) => set({ label: e.target.value })}
          placeholder="e.g. Nasr City"
          maxLength={120}
          hint="Internal only — merchants never see it."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          label="Discount"
          value={form.discountType}
          onChange={(e) => set({ discountType: e.target.value as ReferralDiscountType })}
        >
          <option value="none">None (tracking only)</option>
          <option value="percentage">Percentage off</option>
          <option value="fixed">Fixed amount off</option>
        </SelectField>
        {form.discountType !== "none" && (
          <TextField
            label={form.discountType === "percentage" ? "Percent" : "Amount"}
            required
            inputMode="decimal"
            value={form.discountAmount}
            onChange={(e) => set({ discountAmount: e.target.value })}
            placeholder={form.discountType === "percentage" ? "15" : "50.00"}
          />
        )}
        {form.discountType === "fixed" && (
          <TextField
            label="Currency"
            required
            value={form.discountCurrency}
            onChange={(e) => set({ discountCurrency: e.target.value.toUpperCase() })}
            maxLength={3}
            hint="Charges in other currencies get no discount."
          />
        )}
      </div>
      <TextField
        label="Commission rate override (%)"
        inputMode="decimal"
        value={form.commissionPercent}
        onChange={(e) => set({ commissionPercent: e.target.value })}
        placeholder={`Default ${formatBp(defaultRateBp)}`}
        hint="Leave empty for the platform default. Applies to payments recorded from now on."
      />
      {!creating && (
        <Toggle
          label="Active"
          description="An inactive code can't be entered by new merchants, and gives no discount or commission on any payment from now on — including charges already priced with it."
          checked={form.active}
          onChange={(active) => set({ active })}
        />
      )}
    </div>
  );
}

export function CodeModal({
  code,
  defaultRateBp,
  onClose,
  onSubmit,
}: {
  /** Absent to create a new code. */
  code?: AdminReferralCode;
  defaultRateBp: number;
  onClose: () => void;
  onSubmit: (input: AdminReferralCodeInput) => Promise<void>;
}) {
  const creating = !code;
  const [form, setForm] = useState(() => initialCodeForm(code));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    let input: AdminReferralCodeInput;
    try {
      input = toCodeInput(form, { includeCode: creating });
      if (!creating) input.active = form.active;
    } catch (err) {
      setError(getErrorMessage(err));
      return;
    }
    setBusy(true);
    try {
      await onSubmit(input);
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={creating ? "New referral code" : `Edit ${code.code}`}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="code-form" disabled={busy || (creating && form.code.trim().length < 3)}>
            {busy ? "Saving…" : creating ? "Create code" : "Save"}
          </Button>
        </>
      }
    >
      <form id="code-form" onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <CodeFields form={form} setForm={setForm} creating={creating} defaultRateBp={defaultRateBp} />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------- ledger

export function PayoutBadge({ status }: { status: AdminCommission["payoutStatus"] }) {
  return status === "marked_paid" ? (
    <StatusBadge tone="success" dot>
      Paid
    </StatusBadge>
  ) : (
    <StatusBadge tone="warning" dot>
      Pending
    </StatusBadge>
  );
}

export function LedgerTable({
  rows,
  onMarkPaid,
  showAgent = false,
}: {
  rows: AdminCommission[];
  /** Absent in the read-only (agent) view. */
  onMarkPaid?: (row: AdminCommission) => void;
  showAgent?: boolean;
}) {
  return (
    <Panel flush>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {showAgent && <Th>Agent</Th>}
            <Th>Merchant</Th>
            <Th>Code</Th>
            <Th>Paid on</Th>
            <Th className="text-end">Amount paid</Th>
            <Th className="text-end">Suggested commission</Th>
            <Th>Status</Th>
            {onMarkPaid && (
              <Th className="text-end">
                <span className="sr-only">Actions</span>
              </Th>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className={cn(row.voidedAt && "opacity-60")}>
              {showAgent && <Td className="text-sm">{row.agentName ?? "—"}</Td>}
              <Td>
                <span className="font-medium">{row.workspace.name ?? "Deleted workspace"}</span>
                <span className="block text-xs text-ink-soft">{row.isFirstPayment ? "First payment" : "Renewal"}</span>
              </Td>
              <Td>
                <Mono>{row.code.code ?? "—"}</Mono>
              </Td>
              <Td className="whitespace-nowrap text-sm">
                {/* When the merchant's money arrived — the date entered with a
                    manual payment, not when it was recorded. */}
                <span title={formatDateTime(row.paidAt)}>{formatDate(row.paidAt)}</span>
              </Td>
              <Td className="text-end whitespace-nowrap text-sm">{formatMinorMoneyExact(row.amountPaid, row.currency)}</Td>
              <Td className="text-end whitespace-nowrap">
                <span className={cn("font-medium", row.voidedAt && "line-through")}>
                  {formatMinorMoneyExact(row.suggestedCommission, row.currency)}
                </span>
                <span className="block text-xs text-ink-soft">at {formatBp(row.commissionRateBp)}</span>
              </Td>
              <Td>
                {row.voidedAt ? (
                  <StatusBadge tone="neutral" dot>
                    Voided
                  </StatusBadge>
                ) : (
                  <PayoutBadge status={row.payoutStatus} />
                )}
                {row.voidedAt && (
                  <span className="mt-1 block text-xs text-ink-soft" title={formatDateTime(row.voidedAt)}>
                    Payment reversed {formatDate(row.voidedAt)}
                    {row.voidedBy ? ` · ${row.voidedBy.fullName}` : ""}
                    {row.voidReason ? ` · ${row.voidReason}` : ""}
                  </span>
                )}
                {row.voidedAt && row.payoutStatus === "marked_paid" && (
                  <span className="mt-1 block text-xs font-medium text-danger">Already paid out to the agent</span>
                )}
                {row.payoutStatus === "marked_paid" && (
                  <span className="mt-1 block text-xs text-ink-soft" title={row.payoutNote ?? undefined}>
                    {formatDate(row.markedPaidAt)}
                    {row.markedPaidBy ? ` · ${row.markedPaidBy.fullName}` : ""}
                    {row.payoutNote ? ` · ${row.payoutNote}` : ""}
                  </span>
                )}
              </Td>
              {onMarkPaid && (
                <Td className="text-end">
                  {row.payoutStatus === "pending" && !row.voidedAt && (
                    <Button size="sm" variant="outline" onClick={() => onMarkPaid(row)}>
                      <CheckCircle2 /> Mark paid
                    </Button>
                  )}
                </Td>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}

export function MarkPaidModal({
  row,
  onClose,
  onConfirm,
}: {
  row: AdminCommission;
  onClose: () => void;
  onConfirm: (note: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onConfirm(note.trim());
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title="Mark commission paid"
      description={`${formatMinorMoneyExact(row.suggestedCommission, row.currency)} for ${row.workspace.name ?? "this merchant"}'s payment on ${formatDate(row.paidAt)}.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="mark-paid-form" disabled={busy}>
            {busy ? "Saving…" : "Mark paid"}
          </Button>
        </>
      }
    >
      <form id="mark-paid-form" onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <Alert>
          This only records that you paid the agent — Zimos moves no money. It can&rsquo;t be undone.
        </Alert>
        <TextAreaField
          label="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="e.g. Bank transfer, ref 1234"
          hint="Optional. The agent can see it."
        />
      </form>
    </Modal>
  );
}

// ------------------------------------------------------------- merchants

export function MerchantsTable({ merchants, linkWorkspaces }: { merchants: AdminReferredMerchant[]; linkWorkspaces: boolean }) {
  return (
    <Panel flush>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <Th>Merchant</Th>
            <Th>Code</Th>
            <Th>Code entered</Th>
            <Th>Plan</Th>
            <Th>Subscription</Th>
          </TableRow>
        </TableHeader>
        <TableBody>
          {merchants.map((m) => (
            <TableRow key={`${m.workspace.id}:${m.code.id ?? m.via ?? ""}`}>
              <Td className="font-medium">
                {linkWorkspaces ? (
                  <Link to={`/workspaces/${m.workspace.id}`} className="hover:text-primary hover:underline">
                    {m.workspace.name ?? "Deleted workspace"}
                  </Link>
                ) : (
                  (m.workspace.name ?? "Deleted workspace")
                )}
              </Td>
              <Td>
                {/* A store linked by hand has no code (migration 725). */}
                {m.code.code ? <Mono>{m.code.code}</Mono> : <span className="text-sm text-ink-soft">Linked by hand</span>}
              </Td>
              <Td className="whitespace-nowrap text-sm">{formatDate(m.attachedAt)}</Td>
              <Td className="text-sm">
                {m.planName ?? "—"}
                <span className="block text-xs text-ink-soft">{m.billingCycle}</span>
              </Td>
              <Td>
                <Status value={m.subscriptionStatus} />
              </Td>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}
