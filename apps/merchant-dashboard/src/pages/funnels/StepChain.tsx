import { Fragment } from "react";
import { IconCaretRight } from "@/components/icons";
import { cn } from "@store-builder/ui";
import { useLocale } from "@/i18n/LocaleContext";
import { STEP_TYPE_LABELS } from "./FunnelEditorPage.strings";
import type { UiStepType } from "./funnelAdapter";
import { StepIcon } from "./editor/funnelMeta";

/** The offer steps keep their map colours, so a template's branch is seen before it is read. */
const CHIP_TONE: Partial<Record<UiStepType, string>> = {
  upsell: "bg-success-soft text-success ring-success/25",
  downsell: "bg-accent-soft text-accent-dark ring-accent/30",
  checkout: "bg-primary-soft text-primary-dark ring-primary/20 dark:text-primary",
};

/**
 * A starter's steps as a row of chips ("Landing page › Checkout › Thank you"),
 * so a template can be picked by its shape rather than its name. Each chip
 * carries its step's icon; the chevrons follow the reading direction.
 */
export function StepChain({ types, className }: { types: UiStepType[]; className?: string }) {
  const { locale } = useLocale();
  return (
    <ol data-slot="step-chain" className={cn("flex flex-wrap items-center gap-1", className)}>
      {types.map((type, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <li aria-hidden className="text-ink-soft">
              <IconCaretRight className="size-3 rtl:rotate-180" />
            </li>
          )}
          <li
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
              CHIP_TONE[type] ?? "bg-paper text-ink-soft ring-line"
            )}
          >
            <StepIcon type={type} className="size-3 shrink-0" />
            {STEP_TYPE_LABELS[locale][type]}
          </li>
        </Fragment>
      ))}
    </ol>
  );
}
