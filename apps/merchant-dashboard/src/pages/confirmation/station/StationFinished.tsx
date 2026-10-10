import { Link } from "react-router-dom";
import { Button } from "@store-builder/ui";
import { EmptyState } from "@/components/EmptyState";
import { IconCelebrate, IconClock, IconHourglass, IconRefresh, IconTeam, type IconComponent } from "@/components/icons";
import { fmt } from "@/i18n/LocaleContext";
import { formatDateTime } from "@/lib/format";
import { countOf, pluralOf } from "@/lib/plural";
import { useQueueStrings } from "../queueStrings";
import { useStationStrings } from "./stationStrings";

function BookedLine({ icon: Icon, children }: { icon: IconComponent; children: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-ink-soft" aria-hidden />
      <span className="min-w-0">{children}</span>
    </li>
  );
}

/**
 * Nothing is due: a calm end to the sitting — what was done in it, what is
 * booked for later (callbacks with their nearest time, funnel orders still in
 * their offers window, calls teammates are on) and the ways on from here.
 * Every figure is counted from the queue as loaded or from its counts; with
 * nothing to count, the line is not drawn.
 */
export function StationFinished({
  done,
  confirmed,
  laterCount,
  nearestLaterAt,
  waitingCount,
  othersOnCalls,
  hasList,
  filtersActive,
  onClearFilters,
  onRefresh,
  onShowList,
}: {
  /** Results recorded in this sitting, and how many of them were confirmations. */
  done: number;
  confirmed: number;
  laterCount: number;
  nearestLaterAt: string | null;
  waitingCount: number;
  othersOnCalls: number;
  /** The list view has something to show (booked, waiting or assigned calls). */
  hasList: boolean;
  filtersActive: boolean;
  onClearFilters: () => void;
  onRefresh: () => void;
  onShowList: () => void;
}) {
  const t = useStationStrings();
  const q = useQueueStrings();
  const anythingBooked = laterCount > 0 || waitingCount > 0 || othersOnCalls > 0;

  // With nothing recorded yet: either the queue is truly empty, or what is in it is not the viewer's to call
  // now (booked for later, in its offers window, a teammate's) — the lines and the list say which.
  const notEmpty = anythingBooked || hasList;
  const title = done > 0 ? t.doneTitle : notEmpty ? t.noneDue : q.emptyPending;
  const description =
    done > 0
      ? confirmed > 0
        ? fmt(t.doneConfirmed, { orders: countOf("order", confirmed) })
        : fmt(t.doneLogged, { calls: countOf("call", done) })
      : notEmpty
        ? undefined
        : q.answerNone;

  return (
    <EmptyState
      tone="success"
      className="mx-auto w-full max-w-[40rem] rounded-[1.75rem] max-sm:px-4 max-sm:py-8"
      icon={<IconCelebrate aria-hidden />}
      title={title}
      description={description}
      action={
        <div className="flex flex-col items-center gap-4">
          {anythingBooked && (
            <ul aria-label={t.bookedLabel} className="w-full max-w-sm space-y-1.5 text-start text-sm leading-5 text-ink">
              {laterCount > 0 && (
                <BookedLine icon={IconClock}>
                  {nearestLaterAt
                    ? `${pluralOf(t, "later", laterCount)} · ${fmt(t.nearest, { time: formatDateTime(nearestLaterAt) })}`
                    : pluralOf(t, "later", laterCount)}
                </BookedLine>
              )}
              {waitingCount > 0 && <BookedLine icon={IconHourglass}>{fmt(q.waitingCount, { n: waitingCount })}</BookedLine>}
              {othersOnCalls > 0 && <BookedLine icon={IconTeam}>{pluralOf(t, "others", othersOnCalls)}</BookedLine>}
            </ul>
          )}
          {filtersActive && <p className="max-w-sm text-sm leading-5 text-ink-soft">{t.filtered}</p>}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={onRefresh} className="min-h-11 gap-2 rounded-full px-5">
              <IconRefresh className="size-4" aria-hidden />
              {t.refresh}
            </Button>
            {filtersActive && (
              <Button variant="outline" onClick={onClearFilters} className="min-h-11 rounded-full px-5">
                {t.clearFilters}
              </Button>
            )}
            {hasList && (
              <Button variant="outline" onClick={onShowList} className="min-h-11 rounded-full px-5">
                {t.showList}
              </Button>
            )}
            <Button variant="ghost" asChild className="min-h-11 rounded-full px-4">
              <Link to="/orders">{q.emptyAction}</Link>
            </Button>
          </div>
        </div>
      }
    />
  );
}
