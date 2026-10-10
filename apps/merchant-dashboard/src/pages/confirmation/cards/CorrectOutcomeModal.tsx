import { useState } from "react";
import { Alert, Button } from "@store-builder/ui";
import type { ConfirmationTask } from "@store-builder/api-client";
import { Field, TextField } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { fmt } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useManualCancelPrompt } from "@/pages/shipping/useManualCancelPrompt";
import { useOutcomeLabels, useQueueStrings } from "../queueStrings";

/**
 * A manager changes a finished outcome to the other final one (confirmed ⇄
 * rejected) while the order has not shipped. Opened from a done card, and from
 * the toast that follows an outcome saved a moment ago.
 */
export function CorrectOutcomeModal({
  task,
  onClose,
  onCorrected,
}: {
  task: ConfirmationTask;
  onClose: () => void;
  onCorrected: (task: ConfirmationTask) => void;
}) {
  const workspaceId = useWorkspaceId();
  const t = useQueueStrings();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const outcomeLabel = useOutcomeLabels();
  // The order's state is what gets corrected; the target is the other final outcome.
  const target = task.order.confirmationState === "rejected" ? "confirmed" : "rejected";
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const manualCancelPrompt = useManualCancelPrompt();

  async function correct(acknowledgeManualCancel: boolean) {
    const updated = await apiClient.correctConfirmationOutcome(workspaceId, task.id, {
      outcome: target,
      reason: reason.trim(),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(acknowledgeManualCancel ? { acknowledgeManualCancel: true } : {}),
    });
    toast.success(fmt(t.toastCorrected, { order: task.order.orderNumber, outcome: outcomeLabel[target].toLowerCase() }));
    onCorrected(updated);
  }

  async function submit() {
    if (!reason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await correct(false);
    } catch (err) {
      // Correcting to rejected cancels the courier booking; a courier without
      // a cancel API needs the merchant to cancel it there and confirm first.
      const offered = manualCancelPrompt.offer(err, async () => {
        try {
          await correct(true);
        } catch (retryErr) {
          throw new Error(errorMessage(retryErr));
        }
      });
      if (!offered) setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <>
      {manualCancelPrompt.dialog}
      <Modal
        // Hidden, not closed, while the manual-cancel step is up: the reason
        // and notes typed here are kept for the repeat.
        open={!manualCancelPrompt.isOpen}
        onClose={onClose}
        title={fmt(t.correctTitle, { order: task.order.orderNumber })}
        description={target === "rejected" ? t.correctToRejected : t.correctToConfirmed}
        footer={
          <>
            <Button variant="outline" onClick={onClose} disabled={busy}>
              {t.cancel}
            </Button>
            <Button variant={target === "rejected" ? "danger" : "primary"} onClick={submit} disabled={busy || !reason.trim()}>
              {busy ? t.saving : fmt(t.correctSubmit, { outcome: outcomeLabel[target] })}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && <Alert variant="danger">{error}</Alert>}
          <TextField
            label={t.correctReason}
            required
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t.correctReasonPlaceholder}
          />
          <Field label={t.correctNotes}>
            {({ id }) => <Textarea id={id} value={notes} maxLength={600} onChange={(e) => setNotes(e.target.value)} />}
          </Field>
        </div>
      </Modal>
    </>
  );
}
