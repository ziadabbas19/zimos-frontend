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
import { fmt, useT } from "@/i18n/LocaleContext";
import { getErrorMessage } from "@/lib/errors";
import { formatBp, formatDate, formatDateTime, formatMinorMoneyExact } from "@/lib/format";
import { initialCodeForm, neverApproved, toCodeInput, type CodeFormState } from "@/lib/referrals";
import { REFERRAL_STRINGS, isolate, statusLabel } from "@/lib/referralStrings";

/**
 * Components shared by the Agents screens and an agent's own My referrals
 * page. Amounts arrive in minor units; rates and percentage discounts in
 * basis points (1500 = 15.00%), like everywhere else in the API. The unit
 * conversions live in lib/referrals.
 */

/** "EGP 1,200.00 pending · EGP 300.00 paid" per currency, never summed across. */
export function CommissionTotals({ totals, empty = "—" }: { totals: AdminCommissionTotals[]; empty?: string }) {
  const t = useT(REFERRAL_STRINGS);
  if (totals.length === 0) return <span className="text-ink-soft">{empty}</span>;
  return (
    <div className="space-y-0.5">
      {totals.map((total) => (
        <div key={total.currency} className="text-sm whitespace-nowrap">
          <span className="font-medium">{formatMinorMoneyExact(total.pending, total.currency)}</span>
          <span className="text-ink-soft">{t.totalsPending}</span>
          <span className="font-medium">{formatMinorMoneyExact(total.markedPaid, total.currency)}</span>
          <span className="text-ink-soft">{t.totalsPaid}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- review

/** Where a code stands with a creator's review (migration 742); nothing once it is simply approved. */
export function ApprovalBadge({ code }: { code: AdminReferralCode }) {
  const t = useT(REFERRAL_STRINGS);
  if (code.approvalStatus === "pending") {
    return (
      <StatusBadge tone="warning" dot>
        {t.pendingReview}
      </StatusBadge>
    );
  }
  if (code.approvalStatus === "rejected" || code.changesRejected) {
    return (
      <StatusBadge tone="danger" dot>
        {code.changesRejected ? t.changeRejected : t.rejected}
      </StatusBadge>
    );
  }
  return null;
}

/** A row's status: on or off, unless it was never approved, and its review with the reason given. */
export function CodeStatus({ code }: { code: AdminReferralCode }) {
  const t = useT(REFERRAL_STRINGS);
  return (
    <>
      <span className="flex flex-wrap gap-1">
        {!neverApproved(code) && (
          <StatusBadge tone={code.active ? "success" : "neutral"} dot>
            {code.active ? t.active : t.inactive}
          </StatusBadge>
        )}
        <ApprovalBadge code={code} />
      </span>
      {code.proposed ? (
        <span className="mt-1 block max-w-72 text-xs whitespace-normal text-ink-soft">{t.codeChangeWaiting}</span>
      ) : (
        code.approvalNote && <span className="mt-1 block max-w-72 text-xs whitespace-normal text-ink-soft">{fmt(t.reasonValue, { reason: code.approvalNote })}</span>
      )}
    </>
  );
}

// ------------------------------------------------------------- code form

export function CodeFields({
  form,
  setForm,
  creating,
  defaultRateBp,
  hideActive = false,
}: {
  form: CodeFormState;
  setForm: (next: CodeFormState) => void;
  creating: boolean;
  defaultRateBp: number;
  hideActive?: boolean;
}) {
  const t = useT(REFERRAL_STRINGS);
  const set = (patch: Partial<CodeFormState>) => setForm({ ...form, ...patch });
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t.code}
          required={creating}
          disabled={!creating}
          dir="ltr"
          value={form.code}
          onChange={(e) => set({ code: e.target.value.toUpperCase() })}
          placeholder="CAIRO10"
          maxLength={32}
          hint={creating ? t.codeHintNew : t.codeHintFixed}
        />
        <TextField
          label={t.label}
          value={form.label}
          onChange={(e) => set({ label: e.target.value })}
          placeholder={t.fieldsLabelPlaceholder}
          maxLength={120}
          hint={t.labelHint}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          label={t.discount}
          value={form.discountType}
          onChange={(e) => set({ discountType: e.target.value as ReferralDiscountType })}
        >
          <option value="none">{t.fieldsNone}</option>
          <option value="percentage">{t.fieldsPercentage}</option>
          <option value="fixed">{t.fieldsFixed}</option>
        </SelectField>
        {form.discountType !== "none" && (
          <TextField
            label={form.discountType === "percentage" ? t.percent : t.amount}
            required
            inputMode="decimal"
            value={form.discountAmount}
            onChange={(e) => set({ discountAmount: e.target.value })}
            placeholder={form.discountType === "percentage" ? "15" : "50.00"}
          />
        )}
        {form.discountType === "fixed" && (
          <TextField
            label={t.currency}
            required
            dir="ltr"
            value={form.discountCurrency}
            onChange={(e) => set({ discountCurrency: e.target.value.toUpperCase() })}
            maxLength={3}
            hint={t.fieldsCurrencyHint}
          />
        )}
      </div>
      <TextField
        label={t.fieldsRate}
        inputMode="decimal"
        value={form.commissionPercent}
        onChange={(e) => set({ commissionPercent: e.target.value })}
        placeholder={fmt(t.fieldsRateDefault, { rate: formatBp(defaultRateBp) })}
        hint={t.fieldsRateHint}
      />
      {!creating && !hideActive && (
        <Toggle
          label={t.active}
          description={t.fieldsActiveHint}
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
  hideActive = false,
  description,
  submitLabel,
  onClose,
  onSubmit,
}: {
  /** Absent to create a new code. */
  code?: AdminReferralCode;
  defaultRateBp: number;
  /** Its on/off switch isn't this form's to change, and isn't sent. */
  hideActive?: boolean;
  description?: string;
  submitLabel?: string;
  onClose: () => void;
  onSubmit: (input: AdminReferralCodeInput) => Promise<void>;
}) {
  const t = useT(REFERRAL_STRINGS);
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
      if (!creating && !hideActive) input.active = form.active;
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
      title={creating ? t.codeNew : fmt(t.codeEdit, { code: isolate(code.code) })}
      description={description}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t.cancel}
          </Button>
          <Button type="submit" form="code-form" disabled={busy || (creating && form.code.trim().length < 3)}>
            {busy ? t.saving : (submitLabel ?? (creating ? t.codeCreate : t.save))}
          </Button>
        </>
      }
    >
      <form id="code-form" onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <CodeFields form={form} setForm={setForm} creating={creating} defaultRateBp={defaultRateBp} hideActive={hideActive} />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------- ledger

export function PayoutBadge({ status }: { status: AdminCommission["payoutStatus"] }) {
  const t = useT(REFERRAL_STRINGS);
  return status === "marked_paid" ? (
    <StatusBadge tone="success" dot>
      {t.payout_marked_paid}
    </StatusBadge>
  ) : (
    <StatusBadge tone="warning" dot>
      {t.payout_pending}
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
  const t = useT(REFERRAL_STRINGS);
  return (
    <Panel flush>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {showAgent && <Th>{t.agent}</Th>}
            <Th>{t.merchant}</Th>
            <Th>{t.code}</Th>
            <Th>{t.ledgerPaidOn}</Th>
            <Th className="text-end">{t.ledgerAmountPaid}</Th>
            <Th className="text-end">{t.suggestedCommission}</Th>
            <Th>{t.status}</Th>
            {onMarkPaid && (
              <Th className="text-end">
                <span className="sr-only">{t.actions}</span>
              </Th>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className={cn(row.voidedAt && "opacity-60")}>
              {showAgent && <Td className="text-sm">{row.agentName ?? "—"}</Td>}
              <Td>
                <span className="font-medium">{row.workspace.name ?? t.ledgerDeletedWorkspace}</span>
                <span className="block text-xs text-ink-soft">{row.isFirstPayment ? t.ledgerFirstPayment : t.ledgerRenewal}</span>
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
                <span className="block text-xs text-ink-soft">{fmt(t.ledgerAtRate, { rate: formatBp(row.commissionRateBp) })}</span>
              </Td>
              <Td>
                {row.voidedAt ? (
                  <StatusBadge tone="neutral" dot>
                    {t.payout_voided}
                  </StatusBadge>
                ) : (
                  <PayoutBadge status={row.payoutStatus} />
                )}
                {row.voidedAt && (
                  <span className="mt-1 block text-xs text-ink-soft" title={formatDateTime(row.voidedAt)}>
                    {fmt(t.ledgerReversed, { date: formatDate(row.voidedAt) })}
                    {row.voidedBy ? ` · ${row.voidedBy.fullName}` : ""}
                    {row.voidReason ? ` · ${row.voidReason}` : ""}
                  </span>
                )}
                {row.voidedAt && row.payoutStatus === "marked_paid" && (
                  <span className="mt-1 block text-xs font-medium text-danger">{t.ledgerPaidOut}</span>
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
                      <CheckCircle2 /> {t.ledgerMarkPaid}
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
  const t = useT(REFERRAL_STRINGS);
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
      title={t.markPaidTitle}
      description={fmt(t.markPaidDescription, {
        amount: formatMinorMoneyExact(row.suggestedCommission, row.currency),
        name: row.workspace.name ?? t.markPaidThisMerchant,
        date: formatDate(row.paidAt),
      })}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t.cancel}
          </Button>
          <Button type="submit" form="mark-paid-form" disabled={busy}>
            {busy ? t.saving : t.ledgerMarkPaid}
          </Button>
        </>
      }
    >
      <form id="mark-paid-form" onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <Alert>{t.markPaidNotice}</Alert>
        <TextAreaField
          label={t.note}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder={t.markPaidPlaceholder}
          hint={t.markPaidHint}
        />
      </form>
    </Modal>
  );
}

// ------------------------------------------------------------- merchants

export function MerchantsTable({ merchants, linkWorkspaces }: { merchants: AdminReferredMerchant[]; linkWorkspaces: boolean }) {
  const t = useT(REFERRAL_STRINGS);
  return (
    <Panel flush>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <Th>{t.merchant}</Th>
            <Th>{t.code}</Th>
            <Th>{t.merchantsCodeEntered}</Th>
            <Th>{t.plan}</Th>
            <Th>{t.subscription}</Th>
          </TableRow>
        </TableHeader>
        <TableBody>
          {merchants.map((m) => (
            <TableRow key={`${m.workspace.id}:${m.code.id ?? m.via ?? ""}`}>
              <Td className="font-medium">
                {linkWorkspaces ? (
                  <Link to={`/workspaces/${m.workspace.id}`} className="hover:text-primary hover:underline">
                    {m.workspace.name ?? t.ledgerDeletedWorkspace}
                  </Link>
                ) : (
                  (m.workspace.name ?? t.ledgerDeletedWorkspace)
                )}
              </Td>
              <Td>
                {/* A store linked by hand has no code (migration 725). */}
                {m.code.code ? <Mono>{m.code.code}</Mono> : <span className="text-sm text-ink-soft">{t.merchantsLinkedByHand}</span>}
              </Td>
              <Td className="whitespace-nowrap text-sm">{formatDate(m.attachedAt)}</Td>
              <Td className="text-sm">
                {m.planName ?? "—"}
                <span className="block text-xs text-ink-soft">{t[`cycleWord_${m.billingCycle}` as const] ?? m.billingCycle}</span>
              </Td>
              <Td>
                <Status value={m.subscriptionStatus} label={statusLabel(m.subscriptionStatus)} />
              </Td>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}
