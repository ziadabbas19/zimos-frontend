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
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { TextField, Field } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";

const OUTCOMES: ConfirmationOutcome[] = ["confirmed", "rejected", "unreachable", "postponed"];

const OUTCOME_LABEL: Record<ConfirmationOutcome, string> = {
  confirmed: "Confirmed",
  rejected: "Rejected",
  unreachable: "Unreachable",
  postponed: "Postponed",
};

export function ConfirmationQueuePage() {
  const workspaceId = useWorkspaceId();
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
      <PageHeader
        title="Confirmation Queue"
        description="Call each customer to confirm their order before it moves to fulfilment."
      />

      <DataState
        loading={queue.loading}
        error={queue.error}
        empty={tasks.length === 0}
        emptyMessage="لا يوجد أوردرات مستنية تأكيد دلوقتي 🎉"
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
  const { order } = task;
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
      toast.success(`${order.orderNumber} marked ${OUTCOME_LABEL[outcome].toLowerCase()}.`);
      onResolved(task.id);
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link
            to={`/orders/${order.id}`}
            className="font-display text-lg font-medium text-ink hover:text-primary"
          >
            {order.orderNumber}
          </Link>
          <p className="mt-0.5 text-sm text-ink-soft">
            {order.items.length} item{order.items.length === 1 ? "" : "s"} ·{" "}
            {formatMoney(order.totalAmount, order.currency)}
          </p>
        </div>
        {task.attemptCount > 0 && (
          <span className="rounded-full border border-accent/40 bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-dark">
            {task.attemptCount} previous attempt{task.attemptCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="rounded-[0.5rem] bg-paper px-4 py-3">
        <p className="text-sm font-medium text-ink">{contact.fullName || "Unnamed customer"}</p>
        <p className="mt-0.5 font-display text-xl font-medium text-ink">
          {contact.phone ? (
            <a href={`tel:${contact.phone}`} className="hover:text-primary">
              {contact.phone}
            </a>
          ) : (
            <span className="text-ink-soft">No phone number</span>
          )}
        </p>
        <p className="mt-1 text-sm text-ink-soft">{formatAddress(order.shippingAddressSnapshot)}</p>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {task.status === "queued" ? (
        <Button onClick={claim} disabled={busy}>
          {busy ? "Claiming…" : "Claim & call"}
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
                {OUTCOME_LABEL[o]}
              </Button>
            ))}
          </div>

          {outcome === "rejected" && (
            <TextField
              label="Rejection reason"
              required
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Customer changed their mind"
            />
          )}

          <Field label="Notes">
            {({ id }) => (
              <Textarea
                id={id}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything worth recording from the call (optional)."
              />
            )}
          </Field>

          <Button onClick={save} disabled={busy || !outcome || rejectionMissing}>
            {busy ? "Saving…" : "Save outcome"}
          </Button>
        </div>
      )}
    </Card>
  );
}
