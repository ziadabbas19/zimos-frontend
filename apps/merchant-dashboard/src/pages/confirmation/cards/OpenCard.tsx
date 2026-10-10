import { useId, useState } from "react";
import { Alert, Button, cn } from "@store-builder/ui";
import type {
  ConfirmationAssignee,
  ConfirmationChannel,
  ConfirmationOutcome,
  ConfirmationTask,
} from "@store-builder/api-client";
import { IconCheck, IconPhone } from "@/components/icons";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { fmt } from "@/i18n/LocaleContext";
import { formatDateTime } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { ChannelPicker, WhatsAppButton, useChannelLabels } from "../confirmationChannel";
import { OUTCOMES, OUTCOME_ICON, awaitsPaymentApproval, lockStateOf, useQueueAbilities } from "../queueModel";
import { useOutcomeLabels, useQueueStrings } from "../queueStrings";
import { outcomePayload, useTaskActions } from "../useTaskActions";
import { OrderFacts, OrderHeadline } from "./OrderSummary";
import { attemptAgentName, isCustomerLinkAttempt } from "../customerLink";

/** Once picked, an outcome takes its meaning colour (with the word, never colour alone). */
const OUTCOME_PICKED: Record<ConfirmationOutcome, string> = {
  confirmed: "bg-success-soft text-success ring-success",
  rejected: "bg-danger-soft text-danger ring-danger",
  unreachable: "bg-accent-soft text-accent-dark ring-accent",
  postponed: "bg-accent-soft text-accent-dark ring-accent",
};

function AttemptsBadge({ count }: { count: number }) {
  const t = useQueueStrings();
  if (count === 0) return null;
  return (
    <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-accent-dark">
      {count === 1 ? t.attemptsOne : fmt(t.attemptsOther, { n: count })}
    </span>
  );
}

/** A pending or in-progress task in the list: claim, record an outcome, release, hand to an agent. */
export function OpenCard({
  task,
  team,
  now,
  selected,
  onToggleSelected,
  onChanged,
  onResolved,
}: {
  task: ConfirmationTask;
  /** Members the task may be assigned to; empty unless the viewer manages orders and has someone to hand it to. */
  team: ConfirmationAssignee[];
  /** The page's clock: lock countdowns and "placed 3 hours ago" move together. */
  now: number;
  /** Whether the card is ticked for an action on several orders; undefined hides the tick box. */
  selected?: boolean;
  onToggleSelected: () => void;
  onChanged: (task: ConfirmationTask) => void;
  /** The outcome was saved: `saved` is the task as the server now has it. */
  onResolved: (task: ConfirmationTask, saved: ConfirmationTask, outcome: ConfirmationOutcome) => void;
}) {
  const toast = useToast();
  const t = useQueueStrings();
  const outcomeLabel = useOutcomeLabels();
  const channelLabel = useChannelLabels();
  const { userId, canConfirm, canManage } = useQueueAbilities();
  const actions = useTaskActions(task, onChanged);
  const { busy, error } = actions;

  const [outcome, setOutcome] = useState<ConfirmationOutcome | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [notes, setNotes] = useState("");
  // The channel belongs to one claim: a fresh claim starts from "call" again,
  // and opening WhatsApp while holding the claim picks WhatsApp.
  const [channelChoice, setChannelChoice] = useState<{ lockedAt: string | null; channel: ConfirmationChannel }>({
    lockedAt: null,
    channel: "call",
  });
  const assignId = useId();
  const [assignOpen, setAssignOpen] = useState(false);

  const { order } = task;
  const { inProgress, mine, expired, minutesLeft } = lockStateOf(task, userId, now);
  const holderName = task.lockedBy?.fullName ?? t.someone;
  const rejectionMissing = outcome === "rejected" && rejectionReason.trim() === "";
  const lastAttempt = task.attempts[task.attempts.length - 1];
  // The dialer opens only on touch phones; elsewhere the button says what it does.
  const canDial =
    Boolean(order.contactSnapshot.phone) &&
    typeof window !== "undefined" &&
    Boolean(window.matchMedia?.("(pointer: coarse)").matches);
  const channel = channelChoice.lockedAt === task.lockedAt ? channelChoice.channel : "call";
  const pickChannel = (next: ConfirmationChannel) => setChannelChoice({ lockedAt: task.lockedAt, channel: next });
  const assignedToOther = Boolean(task.assignedTo) && task.assignedTo?.id !== userId;
  const assignedName = task.assignedTo?.fullName ?? t.someone;

  // "Claim & call" does both on a phone: the claim first (so nobody else
  // takes the order), then the dialer opens on the customer's number.
  const claim = () =>
    actions.run(async () => {
      await actions.claimTask();
      const phone = order.contactSnapshot.phone;
      if (phone && window.matchMedia?.("(pointer: coarse)").matches) {
        window.location.href = `tel:${phone.replace(/[^\d+]/g, "")}`;
      }
    });

  const release = () =>
    actions.run(async () => {
      await actions.releaseTask();
      toast.success(fmt(t.toastReleased, { order: order.orderNumber }));
    });

  const assign = (assignee: string) =>
    actions.run(async () => {
      const updated = await actions.assignTask(assignee);
      toast.success(
        assignee
          ? fmt(t.assignedToast, { order: order.orderNumber, name: updated.assignedTo?.fullName ?? "" })
          : fmt(t.unassignedToast, { order: order.orderNumber })
      );
    });

  const save = () =>
    actions.run(async () => {
      if (!outcome || rejectionMissing) return;
      const saved = await actions.recordOutcome(outcomePayload({ outcome, channel, notes, rejectionReason }));
      onResolved(task, saved, outcome);
    });

  let lockLine: string | null = null;
  const lockSoon = mine && !expired && minutesLeft <= 3;
  if (mine) {
    lockLine = expired
      ? t.yourClaimExpired
      : lockSoon
        ? fmt(t.lockSoon, { left: countOf("minute", minutesLeft) })
        : fmt(t.yourClaim, { left: countOf("minute", minutesLeft) });
  } else if (inProgress) {
    lockLine = expired
      ? fmt(t.heldByExpired, { name: holderName })
      : fmt(t.heldBy, { name: holderName, left: countOf("minute", minutesLeft) });
  }

  let callbackLine: string | null = null;
  if (!inProgress && task.nextRetryAt) {
    const due = new Date(task.nextRetryAt).getTime() <= now;
    callbackLine = fmt(due ? t.callbackDue : t.callbackLater, { time: formatDateTime(task.nextRetryAt) });
  }

  const canAssign = canManage && (team.length > 0 || Boolean(task.assignedTo));

  return (
    <div
      data-task-card={task.id}
      data-selected={selected ? "" : undefined}
      className={cn(
        "zimos-row-card scroll-mt-20 space-y-3 rounded-[1.25rem] p-4 shadow-[var(--shadow-card)] sm:p-5",
        selected ? "bg-primary-soft ring-2 ring-primary" : "bg-paper-raised ring-1 ring-line"
      )}
    >
      <OrderHeadline
        task={task}
        leading={
          selected !== undefined && (
            // A 44px target around a 22px box, pulled toward the edges so the box lines up with the card's padding.
            <label className="relative -ms-2.5 -mt-2.5 -me-1 flex size-11 shrink-0 cursor-pointer items-center justify-center">
              <input
                type="checkbox"
                className="peer absolute inset-0 m-0 size-full cursor-pointer appearance-none opacity-0"
                checked={selected}
                onChange={onToggleSelected}
                aria-label={fmt(t.selectTask, { order: order.orderNumber })}
              />
              <span
                aria-hidden
                data-checked={selected ? "" : undefined}
                className={cn(
                  "zimos-row-check pointer-events-none flex size-[22px] items-center justify-center rounded-[7px]",
                  "transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
                  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-active:scale-[0.92] motion-reduce:peer-active:scale-100",
                  selected ? "bg-primary text-primary-foreground" : "bg-paper-raised ring-[1.5px] ring-line-strong ring-inset"
                )}
              >
                {selected && <IconCheck className="size-3.5" aria-hidden />}
              </span>
            </label>
          )
        }
        aside={<AttemptsBadge count={task.attemptCount} />}
      />

      <OrderFacts
        task={task}
        now={now}
        contactAction={<WhatsAppButton order={order} onOpen={() => mine && !expired && pickChannel("whatsapp")} />}
        onChanged={onChanged}
      />

      {/* One quiet line for who has it; a manager opens the picker only when needed. */}
      {(task.assignedTo || (canManage && team.length > 0)) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
          <p className={task.assignedTo ? "font-medium text-ink" : "text-ink-soft"}>
            {!task.assignedTo
              ? t.notAssigned
              : task.assignedTo.id === userId
                ? t.assignedToYou
                : fmt(t.assignedTo, { name: assignedName })}
          </p>
          {canAssign && !assignOpen && (
            <button
              type="button"
              onClick={() => setAssignOpen(true)}
              className="min-h-11 cursor-pointer rounded-full px-2 font-semibold text-primary-dark underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
            >
              {task.assignedTo ? t.assignChange : t.assignShow}
            </button>
          )}
          {canAssign && assignOpen && (
            <>
              <label htmlFor={assignId} className="sr-only">
                {fmt(t.assignTo, { order: order.orderNumber })}
              </label>
              <Select
                id={assignId}
                value={task.assignedTo?.id ?? ""}
                onChange={(e) => {
                  setAssignOpen(false);
                  void assign(e.target.value);
                }}
                disabled={busy}
                autoFocus
                className="h-11 w-auto min-w-44"
              >
                <option value="">{t.nobody}</option>
                {/* The current assignee stays a real option even when they are not in the pick list
                    (a solo store, or someone who left the team), so "Nobody" is a change that unassigns. */}
                {task.assignedTo && !team.some((agent) => agent.id === task.assignedTo?.id) && (
                  <option value={task.assignedTo.id}>{assignedName}</option>
                )}
                {team.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.fullName}
                  </option>
                ))}
              </Select>
            </>
          )}
        </div>
      )}

      {(callbackLine || lastAttempt) && (
        <div className="space-y-0.5 text-sm leading-5 text-ink-soft">
          {callbackLine && <p className="font-medium text-accent-dark">{callbackLine}</p>}
          {lastAttempt && (
            <p>
              {fmt(t.lastAttempt, {
                outcome: outcomeLabel[lastAttempt.outcome],
                agent: attemptAgentName(lastAttempt, t.unknownAgent),
                time: formatDateTime(lastAttempt.createdAt),
              })}
              {lastAttempt.channel && !isCustomerLinkAttempt(lastAttempt) && <> · {fmt(t.via, { channel: channelLabel[lastAttempt.channel] })}</>}
            </p>
          )}
        </div>
      )}

      {lockLine && (
        <p
          role={lockSoon || (mine && expired) ? "status" : undefined}
          className={
            mine && expired
              ? "text-sm font-medium text-danger"
              : lockSoon
                ? "rounded-[0.875rem] bg-accent-soft px-3 py-2 text-sm font-medium text-accent-dark"
                : "text-sm text-ink-soft"
          }
        >
          {lockLine}
        </p>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      {mine && !expired ? (
        <div className="space-y-4">
          <div role="group" aria-label={t.outcomesLabel} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {OUTCOMES.map((o) => {
              const Icon = OUTCOME_ICON[o];
              const picked = outcome === o;
              return (
                <button
                  key={o}
                  type="button"
                  aria-pressed={picked}
                  onClick={() => setOutcome(o)}
                  // A manually paid order is confirmed only once its payment is approved (the server refuses too).
                  disabled={busy || (o === "confirmed" && awaitsPaymentApproval(task))}
                  className={cn(
                    "zimos-queue-outcome flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-[1rem] text-sm font-semibold ring-1 transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100",
                    picked ? OUTCOME_PICKED[o] : "bg-paper-raised text-ink ring-line hover:bg-paper-sunken"
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {outcomeLabel[o]}
                </button>
              );
            })}
          </div>

          <ChannelPicker value={channel} onChange={pickChannel} disabled={busy} />

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
              <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t.notesPlaceholder} />
            )}
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void save()}
              disabled={busy || !outcome || rejectionMissing}
              className="h-12 flex-1 rounded-full px-6 sm:flex-none"
            >
              {busy ? t.saving : t.saveOutcome}
            </Button>
            <Button variant="outline" onClick={() => void release()} disabled={busy} className="h-12 rounded-full px-5">
              {t.release}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 empty:hidden">
          {canConfirm && (!inProgress || expired) && assignedToOther && !canManage ? (
            <p className="text-sm text-ink-soft">{fmt(t.assignedToOther, { name: assignedName })}</p>
          ) : (
            canConfirm &&
            (!inProgress || expired) && (
              <Button
                data-next-action
                onClick={() => void claim()}
                disabled={busy}
                className="h-12 flex-1 gap-2 rounded-full px-6 sm:flex-none"
              >
                {!inProgress && !mine && <IconPhone className="size-4" aria-hidden />}
                {busy ? t.claiming : mine ? t.reclaim : inProgress ? t.takeOver : canDial ? t.claimAndCall : t.claimOnly}
              </Button>
            )
          )}
          {inProgress && !mine && !expired && canManage && (
            <Button variant="outline" onClick={() => void release()} disabled={busy} className="h-12 rounded-full px-5">
              {busy ? t.releasing : t.release}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
