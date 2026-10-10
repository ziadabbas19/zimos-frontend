import { IconCard, IconCheck, IconClick, IconClose, type IconComponent } from "@/components/icons";
import { useLocale } from "@/i18n/LocaleContext";
import { STEP_TYPE_LABELS } from "../FunnelEditorPage.strings";
import type { UiEdgeCondition, UiStepType } from "../funnelAdapter";
import { STEP_TONE, STEP_TYPE_ORDER, StepIcon } from "../editor/funnelMeta";

/**
 * How an arrow looks on the map, per condition: «وافق» a solid green line,
 * «رفض» a dashed amber one, the order in the store's colour, a plain "next"
 * grey — so the two answers out of an offer never look alike, and neither
 * reads as an error.
 */
export const ARROW_LOOK: Record<UiEdgeCondition, { stroke: string; dash?: string; text: string; ring: string; icon: IconComponent | null }> = {
  always: { stroke: "var(--color-ink-soft)", text: "text-ink-soft", ring: "ring-line", icon: null },
  completed_checkout: { stroke: "var(--color-primary)", text: "text-primary-dark dark:text-primary", ring: "ring-primary/35", icon: IconCard },
  accepted_offer: { stroke: "var(--color-success)", text: "text-success", ring: "ring-success/40", icon: IconCheck },
  declined_offer: { stroke: "var(--color-accent)", dash: "6 5", text: "text-accent-dark", ring: "ring-accent/45", icon: IconClose },
  // One button's own path (a link point on the card).
  clicked_through: { stroke: "var(--color-ink)", text: "text-ink", ring: "ring-line-strong", icon: IconClick },
};

/** The step types as a list to pick from — the map's "+" on a card, on an arrow and on a dropped link. */
export function StepTypeMenu({ onPick, autoFocus = false }: { onPick: (type: UiStepType) => void; autoFocus?: boolean }) {
  const { locale } = useLocale();
  return (
    <ul className="p-1">
      {STEP_TYPE_ORDER.map((type, i) => (
        <li key={type}>
          <button
            type="button"
            autoFocus={autoFocus && i === 0}
            onClick={() => onPick(type)}
            className="flex min-h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 text-start text-sm text-ink hover:bg-paper-sunken focus-visible:bg-paper-sunken focus-visible:outline-none pointer-coarse:min-h-11"
          >
            <span aria-hidden className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${STEP_TONE[type]}`}>
              <StepIcon type={type} className="size-4" />
            </span>
            {STEP_TYPE_LABELS[locale][type]}
          </button>
        </li>
      ))}
    </ul>
  );
}
