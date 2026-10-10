import { Segmented } from "@/components/Segmented";
import type { QueueView } from "./queueModel";
import { useQueueStrings } from "./queueStrings";

/**
 * The top of the queue: the title, how much is left in a sentence (from sm up;
 * on a phone the chips under it already say it), and — for a role that takes
 * calls, on the waiting tab — the switch between one order at a time and the
 * list. One 44px line on a phone, so the order being called stays on screen.
 */
export function QueueHeader({
  description,
  view,
  onViewChange,
}: {
  /** How much is left, or what the page is for until the counts arrive. */
  description: string;
  /** The view shown; null where there is nothing to switch (another tab, a role that cannot claim). */
  view: QueueView | null;
  onViewChange: (view: QueueView) => void;
}) {
  const t = useQueueStrings();
  return (
    <header className="mb-2 flex min-h-11 items-center justify-between gap-2 sm:mb-4 sm:items-start sm:gap-3">
      <div className="min-w-0">
        {/* The dashboard sets every h1 to 28px; a phone needs the room for the switch beside it. */}
        <h1 className="truncate font-display text-2xl font-semibold text-ink max-sm:text-[1.375rem]! max-sm:leading-8!">
          {t.title}
        </h1>
        <p className="mt-1 text-sm leading-5 text-ink-soft max-sm:sr-only">{description}</p>
      </div>
      {view && (
        <Segmented
          size="sm"
          value={view}
          onChange={onViewChange}
          label={t.viewLabel}
          // Words only: with glyphs the two segments would squeeze the title off a 390px screen.
          className="shrink-0"
          options={[
            { value: "station", label: t.viewStation },
            { value: "list", label: t.viewList },
          ]}
        />
      )}
    </header>
  );
}
