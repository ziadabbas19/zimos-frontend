import { useState } from "react";
import { Alert, cn } from "@store-builder/ui";
import {
  apiErrorDetails,
  isApiErrorCode,
  type ConfirmationChannel,
  type ConfirmationLockDetails,
  type ConfirmationOutcome,
  type ConfirmationTask,
  type RecordConfirmationOutcomePayload,
} from "@store-builder/api-client";
import { fmt } from "@/i18n/LocaleContext";
import { useWhatsAppConfirmUrl, useWhatsAppLabel } from "../confirmationChannel";
import { minutesUntil } from "../confirmationRoles";
import { awaitsPaymentApproval, dialablePhone, lockStateOf, telHref, useQueueAbilities } from "../queueModel";
import { useQueueStrings } from "../queueStrings";
import { isTaskGoneError, outcomePayload, useTaskActions } from "../useTaskActions";
import { CancelSheet, LaterSheet, NoteSheet } from "./OutcomeSheets";
import { StationActions, type StationPending } from "./StationActions";
import { StationOrder } from "./StationOrder";
import { StationStrip, type StationProgress } from "./StationStrip";
import { useStationStrings } from "./stationStrings";
import { useStationKeys } from "./useStationKeys";

/**
 * ONE order, large: the sitting's progress (StationStrip), who to call, what
 * they ordered, how much and where it goes (StationOrder), and the result of
 * the call as one press (StationActions). This file holds what happens when
 * something is pressed.
 *
 * The claim, the lock and the outcome are the list's own (../useTaskActions.ts):
 * the task is claimed before a result is saved, exactly as "Claim" then "Save & next"
 * do it there, and the result is recorded with the channel last
 * used on this card. A task a teammate got to first is handed back to the
 * station, which says so and moves on.
 *
 * `frozen` is the card that slides away after a result: a picture, nothing in
 * it can be pressed and its keys are off.
 */
export function StationCard({
  task,
  now,
  progress,
  frozen = false,
  entering = false,
  onChanged,
  onSaved,
  onSkip,
  onGone,
}: {
  task: ConfirmationTask;
  /** The page's clock. */
  now: number;
  progress: StationProgress;
  frozen?: boolean;
  /** It arrives after another order left: it slides in from the end edge. */
  entering?: boolean;
  onChanged: (task: ConfirmationTask) => void;
  /** A result was saved; `saved` is the task as the server now has it. */
  onSaved: (task: ConfirmationTask, saved: ConfirmationTask, outcome: ConfirmationOutcome) => void;
  /** On to the next one without a result (the claim, if any, was let go). */
  onSkip: (task: ConfirmationTask) => void;
  /** A teammate holds the task, it is someone else's, or it is finished: say `message` and move on. */
  onGone: (task: ConfirmationTask, message: string, err: unknown) => void;
}) {
  const t = useStationStrings();
  const q = useQueueStrings();
  const { userId } = useQueueAbilities();
  const actions = useTaskActions(task, onChanged);
  const { error, setError } = actions;

  // The channel last used on this card; until one of the two is pressed the result is recorded as a call.
  const [usedChannel, setUsedChannel] = useState<ConfirmationChannel | null>(null);
  const channel: ConfirmationChannel = usedChannel ?? "call";
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [sheet, setSheet] = useState<"later" | "cancel" | "note" | null>(null);
  const [pending, setPending] = useState<StationPending | null>(null);

  const { order } = task;
  const lock = lockStateOf(task, userId, now);
  const name = order.contactSnapshot.fullName?.trim() || q.unnamedCustomer;
  const phone = dialablePhone(order.contactSnapshot.phone);
  const whatsAppUrl = useWhatsAppConfirmUrl(order);
  const whatsAppLabel = useWhatsAppLabel(order);
  const who = fmt(t.sheetFor, { name, order: order.orderNumber });
  const locked = frozen || pending !== null;
  // A manually paid order is confirmed only once its payment is approved (the server refuses too).
  const paymentHeld = awaitsPaymentApproval(task);

  /** Whether the viewer's claim is live this second (the page's clock only moves every half minute). */
  function claimIsLive(): boolean {
    return (
      task.status === "in_progress" && task.lockedByUserId === userId && minutesUntil(task.lockExpiresAt, Date.now()) > 0
    );
  }

  /** The claim comes first, exactly as in the list: nothing is recorded on a task the viewer does not hold. */
  async function ensureClaimed(): Promise<void> {
    if (claimIsLive()) return;
    await actions.claimTask();
  }

  async function saveWithClaim(payload: RecordConfirmationOutcomePayload): Promise<ConfirmationTask> {
    await ensureClaimed();
    try {
      return await actions.recordOutcome(payload);
    } catch (err) {
      // The claim ran out between the two clocks: claim again, as the list's "Claim again" does, and save once more.
      if (!isApiErrorCode(err, "TASK_NOT_LOCKED_BY_YOU") && !isApiErrorCode(err, "TASK_NOT_CLAIMED")) throw err;
      await actions.claimTask();
      return actions.recordOutcome(payload);
    }
  }

  function goneMessage(err: unknown): string {
    if (isApiErrorCode(err, "TASK_ALREADY_LOCKED")) {
      const held = apiErrorDetails<ConfirmationLockDetails>(err);
      return fmt(t.takenBy, { name: held?.lockedBy?.fullName ?? q.someone });
    }
    if (isApiErrorCode(err, "TASK_ASSIGNED_TO_OTHER")) {
      const details = apiErrorDetails<{ assignedTo: { fullName: string } | null }>(err);
      return fmt(t.takenAssigned, { name: details?.assignedTo?.fullName ?? q.someone });
    }
    return t.takenDone;
  }

  function fail(err: unknown) {
    if (isTaskGoneError(err)) {
      setSheet(null);
      onGone(task, goneMessage(err), err);
      return;
    }
    setError(actions.describe(err));
  }

  async function record(outcome: ConfirmationOutcome) {
    if (locked) return;
    // The Enter key reaches here too, so the rule is checked where the result is saved.
    if (outcome === "confirmed" && paymentHeld) {
      setError(q.paymentFirst);
      return;
    }
    setPending(outcome);
    setError(null);
    try {
      const saved = await saveWithClaim(outcomePayload({ outcome, channel, notes: note, rejectionReason: reason }));
      setSheet(null);
      onSaved(task, saved, outcome);
    } catch (err) {
      fail(err);
    } finally {
      setPending(null);
    }
  }

  // The claim first (so nobody else takes the order), then the dialer opens on the customer's number.
  async function call() {
    if (locked || !phone) return;
    setUsedChannel("call");
    setPending("call");
    setError(null);
    try {
      await ensureClaimed();
      window.location.href = telHref(phone);
    } catch (err) {
      fail(err);
    } finally {
      setPending(null);
    }
  }

  /** WhatsApp was opened for this order: note the channel, and claim the order so a teammate does not call it too. */
  function whatsAppOpened() {
    if (frozen) return;
    setUsedChannel("whatsapp");
    if (pending !== null) return;
    setPending("whatsapp");
    setError(null);
    void ensureClaimed()
      .catch(fail)
      .finally(() => setPending(null));
  }

  /** The W key: there is no link to follow, so the chat is opened here. */
  function openWhatsApp() {
    if (frozen || !whatsAppUrl) return;
    window.open(whatsAppUrl, "_blank", "noopener,noreferrer");
    whatsAppOpened();
  }

  async function skip() {
    if (locked) return;
    if (claimIsLive()) {
      setPending("skip");
      setError(null);
      try {
        await actions.releaseTask();
      } catch (err) {
        // The claim is already gone (it ran out, or the task was finished elsewhere): nothing to let go of.
        const alreadyFree =
          isApiErrorCode(err, "TASK_NOT_CLAIMED") ||
          isApiErrorCode(err, "TASK_NOT_LOCKED_BY_YOU") ||
          isApiErrorCode(err, "TASK_ALREADY_DONE");
        if (!alreadyFree) {
          setError(actions.describe(err));
          setPending(null);
          return;
        }
      }
      setPending(null);
    }
    onSkip(task);
  }

  function openSheet(kind: "later" | "cancel" | "note") {
    if (locked) return;
    setError(null);
    setSheet(kind);
  }

  useStationKeys(
    {
      call: () => void call(),
      whatsapp: openWhatsApp,
      confirmed: () => void record("confirmed"),
      noAnswer: () => void record("unreachable"),
      later: () => openSheet("later"),
      cancelled: () => openSheet("cancel"),
      skip: () => void skip(),
    },
    !frozen
  );

  return (
    <article
      data-slot="station-card"
      data-frozen={frozen ? "" : undefined}
      aria-label={fmt(t.cardLabel, { order: order.orderNumber, name })}
      aria-hidden={frozen || undefined}
      inert={frozen}
      className={cn(
        "zimos-station @container relative mx-auto flex w-full max-w-[40rem] flex-col rounded-[1.75rem] bg-paper-raised px-4 pt-3.5 pb-2.5 text-ink shadow-[var(--shadow-raised)] ring-1 ring-line sm:px-6 sm:pt-5 sm:pb-3",
        // On a phone the card is the screen: it ends just above the dock, and what does not fit scrolls inside it.
        "max-sm:h-[calc(100dvh_-_var(--station-top,11.5rem)_-_4.75rem_-_max(0.75rem,env(safe-area-inset-bottom)))] max-sm:min-h-[26rem]",
        entering && !frozen && "motion-safe:animate-[confirm-station-in_var(--dur-move)_var(--ease-spring)_both]",
        frozen && "pointer-events-none motion-safe:animate-[confirm-station-out_var(--dur-move)_var(--ease-spring)_both]"
      )}
    >
      <StationStrip task={task} lock={lock} progress={progress} />

      <div className="zimos-station-body -mx-1 mt-2 min-h-0 flex-1 space-y-2.5 px-1 max-sm:overflow-y-auto max-sm:overscroll-contain sm:mt-3 sm:space-y-4">
        <StationOrder task={task} now={now} userId={userId} inProgress={lock.inProgress} onChanged={onChanged} />
      </div>

      <div className="mt-2 shrink-0 space-y-2 sm:mt-4">
        {lock.mine && lock.expired && (
          <p role="status" className="rounded-[0.875rem] bg-accent-soft px-3 py-1.5 text-xs leading-5 font-medium text-accent-dark">
            {t.lockExpired}
          </p>
        )}
        {error && sheet === null && (
          <Alert variant="danger" className="py-2">
            {error}
          </Alert>
        )}
        <StationActions
          orderId={order.id}
          canCall={phone !== null}
          noPhoneLabel={q.noPhone}
          whatsAppUrl={whatsAppUrl}
          whatsAppLabel={whatsAppLabel}
          usedChannel={usedChannel}
          pending={pending}
          locked={locked}
          hasNote={note.trim() !== ""}
          confirmHeldReason={paymentHeld ? q.paymentFirst : null}
          onCall={() => void call()}
          onWhatsApp={whatsAppOpened}
          onRecord={(outcome) => void record(outcome)}
          onLater={() => openSheet("later")}
          onCancel={() => openSheet("cancel")}
          onNote={() => openSheet("note")}
          onSkip={() => void skip()}
        />
      </div>

      {!frozen && (
        <>
          <LaterSheet
            open={sheet === "later"}
            onClose={() => setSheet(null)}
            who={who}
            busy={pending === "postponed"}
            error={sheet === "later" ? error : null}
            channel={channel}
            onChannel={setUsedChannel}
            note={note}
            onNote={setNote}
            onSave={() => void record("postponed")}
          />
          <CancelSheet
            open={sheet === "cancel"}
            onClose={() => setSheet(null)}
            who={who}
            busy={pending === "rejected"}
            error={sheet === "cancel" ? error : null}
            reason={reason}
            onReason={setReason}
            channel={channel}
            onChannel={setUsedChannel}
            note={note}
            onNote={setNote}
            onSave={() => void record("rejected")}
          />
          <NoteSheet open={sheet === "note"} onClose={() => setSheet(null)} who={who} note={note} onNote={setNote} />
        </>
      )}
    </article>
  );
}
