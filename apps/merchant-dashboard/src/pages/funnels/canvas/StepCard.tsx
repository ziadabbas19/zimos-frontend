import { memo, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@store-builder/ui";
import { IconDocument, IconPlay, IconTag, IconWarning } from "@/components/icons";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import type { UiStep } from "../funnelAdapter";
import { CANVAS_STRINGS, STEP_TYPE_LABELS } from "../FunnelEditorPage.strings";
import { FLOW_CARD_H, FLOW_CARD_W } from "../funnelFlow";
import { pageElementCount } from "../funnelPages";
import { StepStatsLine, StepThumbnail, type StepStats } from "../FlowMapTools";
import { STEP_TONE, STEP_TYPES, StepIcon, type OfferInfo } from "../editor/funnelMeta";
import { MAP_STRINGS } from "./strings";

/** Where the page's picture sits inside a card (the «افتح الصفحة» button lies exactly over it). */
export const CARD_PAGE_BOX = { x: 12, y: 54, width: FLOW_CARD_W - 24, height: 44 };

export interface StepCardProps {
  step: UiStep;
  /** Where the card is drawn — the step's own place, or where it is being dragged. */
  x: number;
  y: number;
  selected: boolean;
  entry: boolean;
  dragging: boolean;
  /** How many problems stop this step from publishing. */
  problems: number;
  offer: OfferInfo | undefined;
  catalogLoaded: boolean;
  stats: StepStats | undefined;
  menu: readonly ContextMenuItem[];
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>, step: UiStep) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
  /** A click that was not the end of a drag: select the step. */
  onPress: (key: string) => void;
  onOpen: (key: string) => void;
  onKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>, step: UiStep) => void;
}

/**
 * One step on the map: a pane with the step's icon in a tinted tile, its name
 * and type, the page's picture, the offer on an offer step, and its numbers.
 * It is a button — a press selects it, Enter or a double-click opens its page,
 * a right-click or a long press opens its menu — and it is dragged by itself.
 */
export const StepCard = memo(function StepCard({
  step,
  x,
  y,
  selected,
  entry,
  dragging,
  problems,
  offer,
  catalogLoaded,
  stats,
  menu,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPress,
  onOpen,
  onKeyDown,
}: StepCardProps) {
  const t = useT(MAP_STRINGS);
  const pinned = useT(CANVAS_STRINGS);
  const { locale, dir } = useLocale();
  const showsOffer = STEP_TYPES[step.type].needsOffer || step.offerId !== null;
  const empty = pageElementCount(step.tree) === 0;
  const sectionCount = step.tree.sections.length;

  return (
    <ContextMenu items={menu} label={t.stepActions}>
      <div
        role="button"
        tabIndex={0}
        aria-label={step.name}
        aria-current={selected ? "true" : undefined}
        data-flow-item=""
        data-step-key={step.key}
        data-type={step.type}
        data-selected={selected ? "" : undefined}
        data-problem={problems > 0 ? "" : undefined}
        data-dragging={dragging ? "" : undefined}
        onPointerDown={(e) => onPointerDown(e, step)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={() => onPress(step.key)}
        onDoubleClick={() => onOpen(step.key)}
        onKeyDown={(e) => onKeyDown(e, step)}
        style={{ left: x, top: y, width: FLOW_CARD_W, height: FLOW_CARD_H }}
        className={cn(
          "zimos-flow-card absolute cursor-grab touch-none rounded-[1.25rem] bg-paper-raised p-3 shadow-[var(--shadow-card)] ring-1 select-none",
          "transition-transform duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          dragging ? "z-[5] scale-[1.03] cursor-grabbing shadow-[var(--shadow-raised)]" : "z-[2]",
          selected ? "ring-2 ring-primary" : problems > 0 ? "ring-danger/60" : "ring-line"
        )}
      >
        {entry && (
          <span
            data-slot="flow-entry"
            className="absolute start-3 -top-2.5 inline-flex h-5 items-center gap-1 rounded-full bg-primary px-2 text-[10.5px] leading-none font-semibold text-primary-foreground"
          >
            <IconPlay className="size-2.5 shrink-0" aria-hidden />
            {t.entry}
          </span>
        )}
        <div dir={dir} className="flex h-full flex-col">
          <div className="flex h-9 items-center gap-2">
            <span data-slot="flow-tile" className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", STEP_TONE[step.type])}>
              <StepIcon type={step.type} className="size-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm leading-5 font-semibold text-ink" dir="auto">
                {step.name}
              </span>
              <span className="block truncate text-[11px] leading-4 text-ink-soft">{STEP_TYPE_LABELS[locale][step.type]}</span>
            </span>
            {problems > 0 && (
              <span
                title={fmt(pinned.toFix, { n: problems })}
                className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-danger-soft px-1.5 py-0.5 text-[11px] font-semibold text-danger"
              >
                <IconWarning className="size-3" aria-hidden />
                <bdi>{problems}</bdi>
                <span className="sr-only">{fmt(pinned.toFix, { n: problems })}</span>
              </span>
            )}
          </div>

          {/* The page: its picture, or the plain fact that it is empty. Always 44px, the open button's box. */}
          <div className="mt-1.5 h-11" title={empty ? undefined : sectionCount === 1 ? pinned.oneSection : fmt(pinned.sections, { n: sectionCount })}>
            {empty ? (
              <p className="flex h-full items-center gap-1.5 rounded-lg border border-dashed border-danger/50 px-2 text-xs text-danger">
                <IconDocument className="size-3.5 shrink-0" aria-hidden />
                {pinned.emptyPage}
              </p>
            ) : (
              <StepThumbnail tree={step.tree} className="h-full" />
            )}
          </div>

          {showsOffer && (
            <p className={cn("mt-1 flex min-w-0 items-center gap-1.5 text-xs leading-4", step.offerId && (offer || !catalogLoaded) ? "text-ink-soft" : "text-danger")}>
              <IconTag className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate" dir="auto">
                {!step.offerId ? pinned.noOffer : offer ? fmt(pinned.offerOf, { offer: offer.offerName, product: offer.productName }) : catalogLoaded ? pinned.offerUnknown : "…"}
              </span>
            </p>
          )}

          <div className="mt-auto">
            <StepStatsLine stats={stats} />
          </div>
        </div>
      </div>
    </ContextMenu>
  );
});
