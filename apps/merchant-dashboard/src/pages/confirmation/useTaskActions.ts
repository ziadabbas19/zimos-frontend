import { useState } from "react";
import {
  apiErrorDetails,
  isApiErrorCode,
  type ConfirmationChannel,
  type ConfirmationLockDetails,
  type ConfirmationOutcome,
  type ConfirmationTask,
  type RecordConfirmationOutcomePayload,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { fmt } from "@/i18n/LocaleContext";
import { countOf } from "@/lib/plural";
import { minutesUntil } from "./confirmationRoles";
import { useQueueStrings } from "./queueStrings";

/** What an agent filled in for one call, before it becomes the request body. */
export interface OutcomeDraft {
  outcome: ConfirmationOutcome;
  channel: ConfirmationChannel;
  notes: string;
  /** Sent only with `rejected`. */
  rejectionReason: string;
}

/** The body of POST /confirmation-tasks/:id/outcome — one shape for the list's form and the station's buttons. */
export function outcomePayload(draft: OutcomeDraft): RecordConfirmationOutcomePayload {
  const payload: RecordConfirmationOutcomePayload = { outcome: draft.outcome, channel: draft.channel };
  if (draft.notes.trim()) payload.notes = draft.notes.trim();
  if (draft.outcome === "rejected") payload.rejectionReason = draft.rejectionReason.trim();
  return payload;
}

/** A teammate holds the task, it is handed to someone else, or it is finished: nothing more to do on it here. */
export function isTaskGoneError(err: unknown): boolean {
  return (
    isApiErrorCode(err, "TASK_ALREADY_LOCKED") ||
    isApiErrorCode(err, "TASK_ASSIGNED_TO_OTHER") ||
    isApiErrorCode(err, "TASK_ALREADY_DONE")
  );
}

/**
 * The sentence for a call on a task that failed: who holds the lock, or whom
 * the task is assigned to, when the server says; its own message otherwise.
 */
export function useTaskErrorText(): (err: unknown) => string {
  const t = useQueueStrings();
  const errorMessage = useErrorMessage();
  return (err) => {
    if (isApiErrorCode(err, "TASK_ALREADY_LOCKED")) {
      const lock = apiErrorDetails<ConfirmationLockDetails>(err);
      return fmt(t.lockedBy, {
        name: lock?.lockedBy?.fullName ?? t.someone,
        left: countOf("minute", minutesUntil(lock?.lockExpiresAt ?? null, Date.now())),
      });
    }
    if (isApiErrorCode(err, "TASK_ASSIGNED_TO_OTHER")) {
      const details = apiErrorDetails<{ assignedTo: { fullName: string } | null }>(err);
      return fmt(t.assignedToOther, { name: details?.assignedTo?.fullName ?? t.someone });
    }
    if (isApiErrorCode(err, "TASK_ALREADY_DONE")) return t.bulkGone;
    return errorMessage(err);
  };
}

/**
 * The calls one task takes — claim, release, assign, record the outcome —
 * and the busy / error state around them. The list's card and the station's
 * card both work a task through this, so a claim always comes before an
 * outcome the same way in both.
 *
 * `onChanged` receives the task as the server now has it (claimed, released,
 * assigned); the page puts it back in its place in the list.
 */
export function useTaskActions(task: ConfirmationTask, onChanged: (task: ConfirmationTask) => void) {
  const workspaceId = useWorkspaceId();
  const describe = useTaskErrorText();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Runs one action with the card's busy and error state around it; true when it went through. */
  async function run(action: () => Promise<void>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (err) {
      setError(describe(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** Locks the task to the viewer (again: extends the lock). */
  async function claimTask(): Promise<ConfirmationTask> {
    const updated = await apiClient.claimConfirmationTask(workspaceId, task.id);
    onChanged(updated);
    return updated;
  }

  async function releaseTask(): Promise<ConfirmationTask> {
    const updated = await apiClient.releaseConfirmationTask(workspaceId, task.id);
    onChanged(updated);
    return updated;
  }

  /** Hands the task to an agent, or with "" back to everyone. */
  async function assignTask(userId: string): Promise<ConfirmationTask> {
    const updated = userId
      ? await apiClient.assignConfirmationTask(workspaceId, task.id, userId)
      : await apiClient.unassignConfirmationTask(workspaceId, task.id);
    onChanged(updated);
    return updated;
  }

  /** Records the call. The task must be claimed by the viewer first — the server refuses otherwise. */
  function recordOutcome(payload: RecordConfirmationOutcomePayload): Promise<ConfirmationTask> {
    return apiClient.recordConfirmationOutcome(workspaceId, task.id, payload);
  }

  return { busy, error, setError, describe, run, claimTask, releaseTask, assignTask, recordOutcome };
}
