import { useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Card } from "@store-builder/ui";
import type {
  ConfirmationOutcome,
  ConfirmationTask,
  RecordConfirmationOutcomePayload,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { formatAddress, formatMoney } from "@/lib/format";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { TextField, Field } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { StatusBadge } from "@/components/StatusBadge";
import { useOrderLabels } from "@/pages/orders/orderLabels";

const OUTCOMES: ConfirmationOutcome[] = ["confirmed", "rejected", "unreachable", "postponed"];

const STRINGS = {
  en: {
    title: "Confirmation Queue",
    description: "Call each customer to confirm their order before it moves to fulfilment.",
    empty: "No orders are waiting for confirmation right now.",
    outcomeConfirmed: "Confirmed",
    outcomeRejected: "Rejected",
    outcomeUnreachable: "Unreachable",
    outcomePostponed: "Postponed",
    itemsOne: "1 item",
    itemsOther: "{n} items",
    attemptsOne: "1 previous attempt",
    attemptsOther: "{n} previous attempts",
    unnamedCustomer: "Unnamed customer",
    noPhone: "No phone number",
    claiming: "Claiming…",
    claimAndCall: "Claim & call",
    rejectionReason: "Rejection reason",
    rejectionPlaceholder: "Customer changed their mind",
    notes: "Notes",
    notesPlaceholder: "Anything worth recording from the call (optional).",
    saving: "Saving…",
    saveOutcome: "Save outcome",
    toastMarked: "{order} marked {outcome}.",
  },
  ar: {
    title: "قائمة التأكيد",
    description: "اتصل بكل عميل لتأكيد طلبه قبل أن ينتقل إلى التجهيز.",
    empty: "لا توجد طلبات بانتظار التأكيد حاليًا.",
    outcomeConfirmed: "مؤكد",
    outcomeRejected: "مرفوض",
    outcomeUnreachable: "تعذّر الوصول",
    outcomePostponed: "مؤجل",
    itemsOne: "منتج واحد",
    itemsOther: "{n} منتجات",
    attemptsOne: "محاولة سابقة واحدة",
    attemptsOther: "{n} محاولات سابقة",
    unnamedCustomer: "عميل بدون اسم",
    noPhone: "لا يوجد رقم هاتف",
    claiming: "جارٍ الاستلام…",
    claimAndCall: "استلام واتصال",
    rejectionReason: "سبب الرفض",
    rejectionPlaceholder: "غيّر العميل رأيه",
    notes: "ملاحظات",
    notesPlaceholder: "أي شيء يستحق التسجيل من المكالمة (اختياري).",
    saving: "جارٍ الحفظ…",
    saveOutcome: "حفظ النتيجة",
    toastMarked: "تم تعيين {order} كـ {outcome}.",
  },
} satisfies Messages;

/** Outcome buttons and the toast, in the active locale. */
function useOutcomeLabels(): Record<ConfirmationOutcome, string> {
  const t = useT(STRINGS);
  return {
    confirmed: t.outcomeConfirmed,
    rejected: t.outcomeRejected,
    unreachable: t.outcomeUnreachable,
    postponed: t.outcomePostponed,
  };
}

export function ConfirmationQueuePage() {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const queue = useAsync(
    () => apiClient.listConfirmationQueue(workspaceId, { status: "queued", limit: 200 }),
    [workspaceId]
  );
  const tasks = queue.data ?? [];

  function patchTask(updated: ConfirmationTask) {
    queue.setData((prev) => (prev ?? []).map((t) => (t.id === updated.id ? updated : t)));
  }

  function removeTask(taskId: string) {
    queue.setData((prev) => (prev ?? []).filter((t) => t.id !== taskId));
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title={t.title} description={t.description} />

      <DataState
        loading={queue.loading}
        error={queue.error}
        empty={tasks.length === 0}
        emptyMessage={t.empty}
        onRetry={() => queue.refresh()}
      >
        <div className="space-y-4">
          {tasks.map((task) => (
            <ConfirmationCard
              key={task.id}
              task={task}
              onClaimed={patchTask}
              onResolved={removeTask}
            />
          ))}
        </div>
      </DataState>
    </div>
  );
}

function ConfirmationCard({
  task,
  onClaimed,
  onResolved,
}: {
  task: ConfirmationTask;
  onClaimed: (task: ConfirmationTask) => void;
  onResolved: (taskId: string) => void;
}) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const t = useT(STRINGS);
  const outcomeLabel = useOutcomeLabels();
  const orderLabels = useOrderLabels();
  const { order } = task;
  const riskFlags = order.riskFlags ?? [];
  const contact = order.contactSnapshot;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ConfirmationOutcome | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [notes, setNotes] = useState("");

  const rejectionMissing = outcome === "rejected" && rejectionReason.trim() === "";

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      const updated = await apiClient.claimConfirmationTask(workspaceId, task.id);
      onClaimed(updated);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      // The card stays mounted after a claim (its task just flips to
      // in_progress), so it's safe to drop the busy flag here.
      setBusy(false);
    }
  }

  async function save() {
    if (!outcome || rejectionMissing) return;
    setBusy(true);
    setError(null);
    try {
      const payload: RecordConfirmationOutcomePayload = { outcome };
      if (notes.trim()) payload.notes = notes.trim();
      if (outcome === "rejected") payload.rejectionReason = rejectionReason.trim();
      await apiClient.recordConfirmationOutcome(workspaceId, task.id, payload);
      // Arabic has no letter case, so lowercasing is a no-op there.
      toast.success(
        fmt(t.toastMarked, {
          order: order.orderNumber,
          outcome: outcomeLabel[outcome].toLowerCase(),
        })
      );
      onResolved(task.id);
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  const itemCount = order.items.length;
  const attempts = task.attemptCount;

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/orders/${order.id}`}
              className="font-display text-lg font-medium text-ink hover:text-primary"
            >
              <bdi dir="ltr">{order.orderNumber}</bdi>
            </Link>
            {riskFlags.length > 0 && (
              <StatusBadge value="flagged" tone="danger" text={orderLabels.flagged} />
            )}
          </div>
          <p className="mt-0.5 text-sm text-ink-soft">
            {itemCount === 1 ? t.itemsOne : fmt(t.itemsOther, { n: itemCount })} ·{" "}
            {formatMoney(order.totalAmount, order.currency)}
          </p>
          {riskFlags.length > 0 && (
            <p className="mt-0.5 text-xs font-medium text-danger">
              {riskFlags.map((flag) => orderLabels.riskFlag(flag)).join(" · ")}
            </p>
          )}
        </div>
        {attempts > 0 && (
          <span className="rounded-full border border-accent/40 bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-dark">
            {attempts === 1 ? t.attemptsOne : fmt(t.attemptsOther, { n: attempts })}
          </span>
        )}
      </div>

      <div className="rounded-[0.5rem] bg-paper px-4 py-3">
        <p className="text-sm font-medium text-ink">{contact.fullName || t.unnamedCustomer}</p>
        <p className="mt-0.5 font-display text-xl font-medium text-ink">
          {contact.phone ? (
            <a href={`tel:${contact.phone}`} className="hover:text-primary">
              <bdi dir="ltr">{contact.phone}</bdi>
            </a>
          ) : (
            <span className="text-ink-soft">{t.noPhone}</span>
          )}
        </p>
        <p className="mt-1 text-sm text-ink-soft">{formatAddress(order.shippingAddressSnapshot)}</p>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {task.status === "queued" ? (
        <Button onClick={claim} disabled={busy}>
          {busy ? t.claiming : t.claimAndCall}
        </Button>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {OUTCOMES.map((o) => (
              <Button
                key={o}
                type="button"
                size="lg"
                variant={outcome === o ? "primary" : "outline"}
                onClick={() => setOutcome(o)}
                disabled={busy}
              >
                {outcomeLabel[o]}
              </Button>
            ))}
          </div>

          {outcome === "rejected" && (
            <TextField
              label={t.rejectionReason}
              required
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder={t.rejectionPlaceholder}
            />
          )}

          <Field label={t.notes}>
            {({ id }) => (
              <Textarea
                id={id}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t.notesPlaceholder}
              />
            )}
          </Field>

          <Button onClick={save} disabled={busy || !outcome || rejectionMissing}>
            {busy ? t.saving : t.saveOutcome}
          </Button>
        </div>
      )}
    </Card>
  );
}
