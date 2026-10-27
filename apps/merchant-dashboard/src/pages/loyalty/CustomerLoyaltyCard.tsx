import { useId, useState, type FormEvent } from "react";
import { IconScale } from "@/components/icons";
import { Alert, Button, Input } from "@store-builder/ui";
import { LOYALTY_LIMITS, loyaltyCustomerAdjust, loyaltyCustomerGet, type LoyaltyAccount } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { isPermissionError } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate, formatMoney } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { fmt, useCommon, useT } from "@/i18n/LocaleContext";
import { CustomerCard, type CustomerCardFrame } from "@/pages/customers/detail/CardFrame";
import { SkeletonBar } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { Field } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { BalanceHistory, type BalanceHistoryRow } from "@/pages/customers/BalanceHistory";
import { LOYALTY_KIND_KEY, LOYALTY_STRINGS, parseWhole } from "./loyaltyStrings";

/**
 * The customer page's points card: the balance, what it is
 * worth, when it expires, every change of it, and «إضافة/خصم نقط» for staff
 * (customers.manage). A store that never set the programme up and a customer
 * with no points show nothing at all.
 *
 * `frame` (optional) lets the customer page draw this card as one of its folding
 * sections instead of a pane of its own; left out, the card is the `Section` it
 * always was.
 */
export function CustomerLoyaltyCard({ customerId, frame }: { customerId: string; frame?: CustomerCardFrame }) {
  const t = useT(LOYALTY_STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const account = useAsync(() => loyaltyCustomerGet(apiClient, workspaceId, customerId), [workspaceId, customerId]);
  const [adjusting, setAdjusting] = useState(false);

  const data = account.data;
  // No role for it: the page's other cards still stand, this one stays out.
  if (isPermissionError(account.error)) return null;
  // Nothing to show, and nothing to do: the store has no point value yet and this customer holds no points.
  if (data && data.worth === null && data.balance === 0 && data.history.length === 0) return null;

  if (!data) {
    return (
      <CustomerCard frame={frame} title={t.cardTitle} description={t.cardHint}>
        {account.error ? (
          <div role="alert" className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-danger">{errorMessage(account.error)}</p>
            <Button variant="outline" size="sm" className="min-h-11" onClick={() => void account.refresh()}>
              {common.retry}
            </Button>
          </div>
        ) : (
          <div role="status" aria-busy="true">
            <span className="sr-only">{common.loading}</span>
            <div aria-hidden>
              <SkeletonBar className="h-7 w-32" />
              <SkeletonBar className="mt-3 w-2/5" />
            </div>
          </div>
        )}
      </CustomerCard>
    );
  }

  const points = (n: number) => pluralOf(t, "points", n);
  const rows: BalanceHistoryRow[] = data.history.map((row) => ({
    id: row.id,
    what: t[LOYALTY_KIND_KEY[row.kind]] ?? row.kind,
    orderId: row.orderId,
    // Only what staff wrote: the other notes are the system's own remarks (an order number, "online checkout").
    note: row.kind === "adjust" ? row.note : null,
    change: row.points,
    changeText: points(Math.abs(row.points)),
    afterText: points(row.balanceAfter),
    createdAt: row.createdAt,
  }));

  return (
    <CustomerCard
      frame={frame}
      title={t.cardTitle}
      description={t.cardHint}
      // The folded line of the customer page: the balance and what it is worth.
      summary={[points(data.balance), data.worth !== null ? fmt(t.worth, { amount: formatMoney(data.worth, data.currency) }) : null].filter(Boolean).join(" · ")}
      flush
      actions={
        <Button type="button" variant="outline" className="min-h-11" onClick={() => setAdjusting(true)}>
          <IconScale className="size-4" aria-hidden />
          {t.adjust}
        </Button>
      }
    >
      <div className="px-4 pb-4">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-3xl font-semibold tabular-nums text-ink">{points(data.balance)}</span>
          {data.worth !== null && <span className="text-sm text-ink-soft">{fmt(t.worth, { amount: formatMoney(data.worth, data.currency) })}</span>}
        </p>
        {data.expiresAt && <p className="mt-1 text-xs text-ink-soft">{fmt(t.expiresOn, { date: formatDate(data.expiresAt) })}</p>}
        {/* Frozen (the plan, or an unpaid subscription): the balance waits, it is not lost. */}
        {data.frozen && <p className="mt-1 text-xs font-medium text-accent-dark">{t.cardFrozen}</p>}
      </div>
      <h3 className="px-4 pb-2 text-xs font-semibold text-ink-soft">{t.history}</h3>
      <BalanceHistory rows={rows} empty={t.historyEmpty} />

      <AdjustPointsDialog
        open={adjusting}
        account={data}
        onClose={() => setAdjusting(false)}
        onSave={async (body) => {
          const out = await loyaltyCustomerAdjust(apiClient, workspaceId, customerId, body);
          await account.refresh({ silent: true });
          return out.applied;
        }}
      />
    </CustomerCard>
  );
}

function AdjustPointsDialog({
  open,
  account,
  onClose,
  onSave,
}: {
  open: boolean;
  account: LoyaltyAccount;
  onClose: () => void;
  /** Resolves with the points that really moved (a balance never goes below zero). */
  onSave: (body: { points: number; note: string }) => Promise<number>;
}) {
  const t = useT(LOYALTY_STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const [direction, setDirection] = useState<"add" | "take">("add");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openedFor, setOpenedFor] = useState(false);
  // Each opening starts empty.
  if (open !== openedFor) {
    setOpenedFor(open);
    if (open) {
      setDirection("add");
      setAmount("");
      setNote("");
      setAmountError(null);
      setNoteError(null);
      setFailure(null);
    }
  }

  const points = (n: number) => pluralOf(t, "points", n);
  const typed = parseWhole(amount, 1, LOYALTY_LIMITS.adjustMax);
  const next = typed === null ? null : account.balance + (direction === "add" ? typed : -typed);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const tooMany = direction === "take" && typed !== null && typed > account.balance;
    const amountProblem = typed === null ? t.pointsError : tooMany ? fmt(t.tooMany, { balance: points(account.balance) }) : null;
    const noteProblem = note.trim() ? null : t.noteError;
    setAmountError(amountProblem);
    setNoteError(noteProblem);
    if (amountProblem || noteProblem || typed === null) return;
    setSaving(true);
    setFailure(null);
    try {
      const applied = await onSave({ points: direction === "add" ? typed : -typed, note: note.trim() });
      onClose();
      toast.success(applied === 0 ? t.nothingMoved : fmt(applied > 0 ? t.added : t.taken, { points: points(Math.abs(applied)) }));
    } catch (err) {
      setFailure(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const choice = (value: "add" | "take", label: string) => (
    <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-2 rounded-[var(--radius)] px-3 text-sm text-ink ring-1 ring-line has-[:checked]:bg-primary-soft has-[:checked]:font-medium has-[:checked]:text-primary-dark has-[:checked]:ring-primary">
      <input
        type="radio"
        name={`${formId}-direction`}
        className="size-4 accent-primary"
        checked={direction === value}
        onChange={() => {
          setDirection(value);
          setAmountError(null);
        }}
      />
      {label}
    </label>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.adjustTitle}
      description={fmt(t.adjustDescription, { balance: points(account.balance) })}
      footer={
        <>
          <Button type="button" variant="outline" className="min-h-11" disabled={saving} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className="min-h-11" disabled={saving}>
            {saving ? t.adjustSaving : t.adjustSave}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink">{t.direction}</legend>
          <div className="flex flex-col gap-2 sm:flex-row">
            {choice("add", t.addPoints)}
            {choice("take", t.takePoints)}
          </div>
        </fieldset>
        <Field
          label={t.pointsLabel}
          required
          error={amountError ?? undefined}
          hint={next !== null && next >= 0 ? fmt(t.newBalance, { balance: points(next) }) : undefined}
        >
          {(props) => (
            <Input
              {...props}
              type="text"
              inputMode="numeric"
              dir="ltr"
              autoComplete="off"
              maxLength={8}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setAmountError(null);
              }}
              className="h-11 w-40 text-center tabular-nums"
            />
          )}
        </Field>
        <Field label={t.note} required error={noteError ?? undefined} hint={t.noteHint}>
          {(props) => (
            <Textarea
              {...props}
              rows={2}
              maxLength={LOYALTY_LIMITS.noteMax}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setNoteError(null);
              }}
            />
          )}
        </Field>
        {failure && <Alert variant="danger">{failure}</Alert>}
      </form>
    </Modal>
  );
}
