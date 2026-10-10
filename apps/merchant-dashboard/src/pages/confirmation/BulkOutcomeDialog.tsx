import { useState } from "react";
import { Alert, Button } from "@store-builder/ui";
import type { ConfirmationTask, RecordConfirmationOutcomePayload } from "@store-builder/api-client";
import { TextField } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { fmt } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { countOf } from "@/lib/plural";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { minutesUntil } from "./confirmationRoles";
import { awaitsPaymentApproval, lockStateOf, useQueueAbilities } from "./queueModel";
import { useQueueStrings } from "./queueStrings";
import { useTaskErrorText } from "./useTaskActions";

/** The two results that can be recorded on every selected order at once. */
export type BulkOutcomeKind = "accept" | "cancel";

export interface BulkOutcomeResult {
  kind: BulkOutcomeKind;
  /** The orders whose result was saved: the task as it was shown, and as the server now has it. */
  saved: Array<{ task: ConfirmationTask; saved: ConfirmationTask }>;
  /** The orders left as they were, each with the sentence that says why. */
  failed: Array<{ task: ConfirmationTask; reason: string }>;
}

/** The longest reason the server keeps on a rejected task. */
const REASON_MAX = 300;

interface Groups {
  /** What the action will run on. */
  ready: ConfirmationTask[];
  /** A teammate is on the call right now: nobody else records a result on it. */
  held: ConfirmationTask[];
  /** Accept only: paid by transfer, and the payment is not approved yet. */
  unpaid: ConfirmationTask[];
}

function groupsOf(tasks: ConfirmationTask[], kind: BulkOutcomeKind, userId: string | null, now: number): Groups {
  const groups: Groups = { ready: [], held: [], unpaid: [] };
  for (const task of tasks) {
    const lock = lockStateOf(task, userId, now);
    if (lock.inProgress && !lock.mine && !lock.expired) groups.held.push(task);
    else if (kind === "accept" && awaitsPaymentApproval(task)) groups.unpaid.push(task);
    else groups.ready.push(task);
  }
  return groups;
}

/**
 * "Accept all selected" / "Cancel all selected": one result recorded on every
 * selected order of the queue. Nothing is sent until the question was answered
 * twice — first the dialog that names how many orders and says what happens to
 * them, then "Are you sure?" with the number again.
 *
 * There is no request for several tasks at once, so each order goes the way a
 * single one does in the list: claimed, then its result saved (confirmed, or
 * rejected with the reason typed here). An order that cannot take it — a
 * teammate got to it, it is assigned to someone else, it already has a result —
 * is left as it was, its claim is let go again, and the last screen lists it
 * with the reason.
 *
 * Mount it when the action is chosen: it reads the selection once, so the
 * orders it names do not change under the question.
 */
export function BulkOutcomeDialog({
  kind,
  tasks,
  now,
  onClose,
  onFinished,
}: {
  kind: BulkOutcomeKind;
  /** The selected orders, as the list shows them. */
  tasks: ConfirmationTask[];
  /** The page's clock, for whose claim is live. */
  now: number;
  onClose: () => void;
  /** The run ended (before its last screen): the list drops what was saved. */
  onFinished: (result: BulkOutcomeResult) => void;
}) {
  const workspaceId = useWorkspaceId();
  const t = useQueueStrings();
  const toast = useToast();
  const describe = useTaskErrorText();
  const { userId } = useQueueAbilities();

  const [groups] = useState(() => groupsOf(tasks, kind, userId, now));
  const [step, setStep] = useState<"ask" | "again" | "running" | "result">("ask");
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(0);
  const [result, setResult] = useState<BulkOutcomeResult | null>(null);

  const accept = kind === "accept";
  const total = groups.ready.length;
  const count = countOf("order", total);
  const reasonMissing = !accept && reason.trim() === "";

  /** One order, exactly as the list does it: the claim first, then the result. */
  async function workOne(task: ConfirmationTask, payload: RecordConfirmationOutcomePayload): Promise<ConfirmationTask> {
    const mine =
      task.status === "in_progress" && task.lockedByUserId === userId && minutesUntil(task.lockExpiresAt, Date.now()) > 0;
    if (!mine) await apiClient.claimConfirmationTask(workspaceId, task.id);
    try {
      return await apiClient.recordConfirmationOutcome(workspaceId, task.id, payload);
    } catch (err) {
      // The result was refused: the order goes back to the queue instead of staying under the viewer's name.
      if (!mine) await apiClient.releaseConfirmationTask(workspaceId, task.id).catch(() => undefined);
      throw err;
    }
  }

  async function run() {
    setStep("running");
    // Nobody was called: the result is recorded with the channel "other" and a note that says how it was made.
    const payload: RecordConfirmationOutcomePayload = accept
      ? { outcome: "confirmed", channel: "other", notes: t.bulkNote }
      : { outcome: "rejected", channel: "other", notes: t.bulkNote, rejectionReason: reason.trim() };
    const outcome: BulkOutcomeResult = { kind, saved: [], failed: [] };
    // One at a time: each order is two requests, and the server's rate limit is shared with the rest of the page.
    for (const [index, task] of groups.ready.entries()) {
      setDone(index);
      try {
        outcome.saved.push({ task, saved: await workOne(task, payload) });
      } catch (err) {
        outcome.failed.push({ task, reason: describe(err) });
      }
    }
    setDone(total);
    onFinished(outcome);
    if (outcome.failed.length === 0) {
      toast.success(fmt(accept ? t.bulkAccepted : t.bulkCancelled, { count: countOf("order", outcome.saved.length) }));
      onClose();
      return;
    }
    setResult(outcome);
    setStep("result");
  }

  if (step === "running") {
    return (
      // Not closable while it runs: half the orders done and no account of them would be worse than waiting.
      <Modal open onClose={() => undefined} title={t.bulkWorkingTitle} description={t.bulkKeepOpen}>
        <div role="status" className="space-y-2">
          <progress max={total} value={done} className="h-2 w-full accent-primary" />
          <p className="text-sm text-ink tabular-nums">{fmt(t.bulkProgress, { done, total })}</p>
        </div>
      </Modal>
    );
  }

  if (step === "result" && result) {
    const savedCount = result.saved.length;
    return (
      <Modal
        open
        onClose={onClose}
        title={t.bulkResultTitle}
        footer={
          <Button variant="primary" onClick={onClose}>
            {t.bulkClose}
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="text-sm font-medium text-ink">
            {savedCount === 0
              ? t.bulkNoneDone
              : fmt(accept ? t.bulkAccepted : t.bulkCancelled, { count: countOf("order", savedCount) })}
          </p>
          <div>
            <p className="text-sm font-medium text-danger">
              {fmt(t.bulkFailed, { count: countOf("order", result.failed.length) })}
            </p>
            <ul className="mt-1 max-h-56 space-y-1 overflow-y-auto text-sm text-ink-soft">
              {result.failed.map(({ task, reason: why }) => (
                <li key={task.id}>
                  <bdi dir="ltr" className="font-medium text-ink">
                    {task.order.orderNumber}
                  </bdi>
                  : {why}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Modal>
    );
  }

  if (step === "again") {
    return (
      <Modal
        open
        onClose={() => setStep("ask")}
        title={t.againTitle}
        footer={
          <>
            <Button variant="outline" onClick={() => setStep("ask")}>
              {t.bulkBack}
            </Button>
            <Button variant={accept ? "primary" : "danger"} onClick={() => void run()}>
              {fmt(accept ? t.acceptYes : t.cancelYes, { count })}
            </Button>
          </>
        }
      >
        <p role="alert" className="text-sm leading-6 font-medium text-ink">
          {fmt(accept ? t.acceptAgain : t.cancelAgain, { count })}
        </p>
      </Modal>
    );
  }

  const leftOut = groups.held.length + groups.unpaid.length;
  return (
    <Modal
      open
      onClose={onClose}
      title={fmt(accept ? t.acceptTitle : t.cancelTitle, { count })}
      description={accept ? t.acceptBody : t.cancelBody}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t.bulkClose}
          </Button>
          <Button
            variant={accept ? "primary" : "danger"}
            disabled={total === 0 || reasonMissing}
            onClick={() => setStep("again")}
          >
            {t.bulkContinue}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {total === 0 && <Alert variant="danger">{t.bulkNothing}</Alert>}
        {!accept && total > 0 && (
          <TextField
            label={t.bulkReason}
            hint={t.bulkReasonHint}
            required
            maxLength={REASON_MAX}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t.rejectionPlaceholder}
          />
        )}
        {leftOut > 0 && (
          <div className="rounded-[0.875rem] bg-accent-soft px-3 py-2.5 text-sm leading-5 text-accent-dark">
            <p className="font-medium">{t.bulkLeftOut}</p>
            <ul className="mt-0.5 list-disc ps-5">
              {groups.unpaid.length > 0 && (
                <li>{fmt(t.bulkLeftPayment, { count: countOf("order", groups.unpaid.length) })}</li>
              )}
              {groups.held.length > 0 && <li>{fmt(t.bulkLeftHeld, { count: countOf("order", groups.held.length) })}</li>}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
