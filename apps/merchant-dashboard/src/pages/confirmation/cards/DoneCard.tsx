import { useState } from "react";
import { Button } from "@store-builder/ui";
import type { ConfirmationAttempt, ConfirmationTask } from "@store-builder/api-client";
import { IconCaretDown } from "@/components/icons";
import { StatusBadge } from "@/components/StatusBadge";
import { fmt } from "@/i18n/LocaleContext";
import { formatDateTime } from "@/lib/format";
import { useChannelLabels } from "../confirmationChannel";
import { useQueueAbilities } from "../queueModel";
import { sourceLabel, useOutcomeLabels, useQueueStrings } from "../queueStrings";
import { CorrectOutcomeModal } from "./CorrectOutcomeModal";
import { OrderFacts, OrderHeadline } from "./OrderSummary";
import { attemptAgentName, isCustomerLinkAttempt } from "../customerLink";

/** A fold inside a card: one 44px line that opens what is read rarely. */
const FOLD = "group/fold rounded-[0.875rem] bg-ink/[0.03] px-3.5 text-sm ring-1 ring-line dark:bg-white/[0.03]";
const FOLD_SUMMARY =
  "flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-[0.625rem] font-medium text-ink select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden";

function FoldCaret() {
  return (
    <IconCaretDown
      className="ms-auto size-4 shrink-0 text-ink-soft transition-[rotate] duration-[var(--dur-fade)] ease-[var(--ease-out)] group-open/fold:rotate-180 motion-reduce:transition-none"
      aria-hidden
    />
  );
}

/**
 * A finished task: who and how much, the outcome with who recorded it and
 * when, then — folded, because the work is done — the order itself and the
 * history of attempts; and a manager's correction while the order can still
 * take one.
 */
export function DoneCard({
  task,
  now,
  onChanged,
}: {
  task: ConfirmationTask;
  now: number;
  onChanged: (task: ConfirmationTask) => void;
}) {
  const t = useQueueStrings();
  const outcomeLabel = useOutcomeLabels();
  const { canManage } = useQueueAbilities();
  const [correcting, setCorrecting] = useState(false);

  const outcome = task.outcome ?? "confirmed";
  const last = task.attempts[task.attempts.length - 1];

  return (
    <div className="zimos-row-card space-y-3 rounded-[1.25rem] bg-paper-raised p-4 shadow-[var(--shadow-card)] ring-1 ring-line sm:p-5">
      <OrderHeadline task={task} aside={<StatusBadge value={outcome} text={outcomeLabel[outcome]} />} />

      <div className="space-y-1 text-sm leading-5 text-ink-soft">
        <p>
          {fmt(t.doneAt, { outcome: outcomeLabel[outcome], time: formatDateTime(task.completedAt ?? task.updatedAt) })}
          {(last?.agent || isCustomerLinkAttempt(last)) && <> · {isCustomerLinkAttempt(last) ? attemptAgentName(last, "") : fmt(t.doneBy, { agent: last?.agent?.fullName ?? "" })}</>}
        </p>
        {task.rejectionReason && (
          <p className="text-ink">
            <bdi>“{task.rejectionReason}”</bdi>
          </p>
        )}
      </div>

      <details className={FOLD}>
        <summary className={FOLD_SUMMARY}>
          {t.orderDetails}
          <FoldCaret />
        </summary>
        <div className="pt-1 pb-3.5">
          <OrderFacts task={task} now={now} />
        </div>
      </details>

      {task.attempts.length > 0 && (
        <details className={FOLD}>
          <summary className={FOLD_SUMMARY}>
            {fmt(t.history, { n: task.attempts.length })}
            <FoldCaret />
          </summary>
          <ol className="space-y-2 pt-1 pb-3.5">
            {task.attempts.map((attempt) => (
              <AttemptRow key={attempt.id} attempt={attempt} />
            ))}
          </ol>
        </details>
      )}

      {task.correctable && canManage && (
        <Button variant="outline" onClick={() => setCorrecting(true)} className="min-h-11 rounded-full px-5">
          {t.correct}
        </Button>
      )}

      {correcting && (
        <CorrectOutcomeModal
          task={task}
          onClose={() => setCorrecting(false)}
          onCorrected={(updated) => {
            setCorrecting(false);
            onChanged(updated);
          }}
        />
      )}
    </div>
  );
}

function AttemptRow({ attempt }: { attempt: ConfirmationAttempt }) {
  const t = useQueueStrings();
  const outcomeLabel = useOutcomeLabels();
  const channelLabel = useChannelLabels();
  const what = attempt.previousOutcome
    ? fmt(t.corrected, { from: outcomeLabel[attempt.previousOutcome], to: outcomeLabel[attempt.outcome] })
    : outcomeLabel[attempt.outcome];
  return (
    <li className="border-b border-line pb-2 last:border-b-0 last:pb-0">
      <p className="text-ink">
        <span className="font-medium">{what}</span> · {sourceLabel(t, attempt.source)} ·{" "}
        {attemptAgentName(attempt, t.unknownAgent)}
        {attempt.channel && !isCustomerLinkAttempt(attempt) && <> · {fmt(t.via, { channel: channelLabel[attempt.channel] })}</>}
      </p>
      <p className="text-xs text-ink-soft">{formatDateTime(attempt.createdAt)}</p>
      {attempt.notes && <p className="mt-0.5 whitespace-pre-line text-ink-soft">{attempt.notes}</p>}
    </li>
  );
}
