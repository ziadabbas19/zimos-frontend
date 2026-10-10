import type { ConfirmationTask } from "@store-builder/api-client";
import { IconHourglass } from "@/components/icons";
import { fmt } from "@/i18n/LocaleContext";
import { formatDateTime } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { minutesUntil } from "../confirmationRoles";
import { useQueueStrings } from "../queueStrings";

/**
 * The shopper may still add an upsell to this order, so nobody works it yet:
 * the order number and when it opens, nothing to act on (the server refuses a
 * claim until then). It turns into the normal card by itself when the time
 * comes; the funnel may also close the window early.
 */
export function WaitingCard({ task, now }: { task: ConfirmationTask; now: number }) {
  const t = useQueueStrings();
  const minutes = minutesUntil(task.availableAt ?? null, now);
  return (
    <div
      data-waiting=""
      aria-label={fmt(t.waitingCount, { n: 1 })}
      className="zimos-row-card flex items-start gap-3 rounded-[1.25rem] border border-dashed border-line-strong/50 bg-paper-raised px-4 py-3.5"
    >
      <span
        aria-hidden
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-dark"
      >
        <IconHourglass className="size-5" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-center gap-2 text-sm leading-5">
          <bdi dir="ltr" className="font-semibold text-ink">
            {task.order.orderNumber}
          </bdi>
          <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-dark">{t.waitingTitle}</span>
        </p>
        <p className="text-sm leading-5 text-ink-soft">
          {minutes > 0
            ? fmt(t.waitingBody, { left: countOf("minute", minutes), time: formatDateTime(task.availableAt as string) })
            : t.waitingSoon}
        </p>
      </div>
    </div>
  );
}
