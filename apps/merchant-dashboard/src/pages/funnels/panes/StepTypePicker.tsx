import { cloneElement, useState, type ComponentProps, type ReactElement } from "react";
import { cn } from "@store-builder/ui";
import { IconCheck } from "@/components/icons";
import { TriggerPopover as Popover } from "@/components/TriggerPopover";
import { Sheet } from "@/components/Sheet";
import { PHONE_QUERY, useMediaQuery } from "@/components/report/useMediaQuery";
import { useLocale } from "@/i18n/LocaleContext";
import type { UiStepType } from "../funnelAdapter";
import { STEP_TYPE_LABELS } from "../FunnelEditorPage.strings";
import { STEP_TONE, STEP_TYPE_ORDER, StepIcon } from "../editor/funnelMeta";
import { STEP_TYPE_PURPOSE } from "./paneStrings";

/** A step type's icon on its tinted tile — the same tone the type has on the flow map. */
export function StepTypeTile({ type, size = "md", className }: { type: UiStepType; size?: "sm" | "md"; className?: string }) {
  return (
    <span
      data-slot="funnel-type-tile"
      className={cn(
        "grid shrink-0 place-items-center rounded-[0.625rem]",
        size === "md" ? "size-9" : "size-8",
        STEP_TONE[type],
        className
      )}
    >
      <StepIcon type={type} className={size === "md" ? "size-[18px]" : "size-4"} />
    </span>
  );
}

export interface StepTypeListProps {
  /** A step type was picked. */
  onPick: (type: UiStepType) => void;
  /** Adds the line saying what each type is for, on taller rows (56px). Default false: the compact menu. */
  detailed?: boolean;
  /** The type to tick as the current one (the type picker); none by default. */
  current?: UiStepType | null;
}

/**
 * The nine step types as a menu list — shared by "Add step", add-after,
 * insert-between and the inspector's type field. Compact, it is a name per
 * row (the button's whole name, which the flow map's tests press); detailed,
 * each row also says what the step is for.
 */
export function StepTypeList({ onPick, detailed = false, current = null }: StepTypeListProps) {
  const { locale } = useLocale();
  return (
    <ul className={cn("zimos-funnel-type-list", detailed ? "space-y-0.5" : "py-1")}>
      {STEP_TYPE_ORDER.map((type) => (
        <li key={type}>
          <button
            type="button"
            onClick={() => onPick(type)}
            data-current={type === current ? "" : undefined}
            aria-current={type === current ? "true" : undefined}
            className={cn(
              "zimos-funnel-type-row flex w-full cursor-pointer items-center text-start text-ink transition-[background-color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-primary-soft focus-visible:bg-primary-soft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100",
              detailed ? "min-h-14 gap-3 rounded-[0.875rem] px-2.5 py-2" : "min-h-9 gap-2 px-3 py-1.5 text-sm pointer-coarse:min-h-11"
            )}
          >
            {detailed ? <StepTypeTile type={type} /> : <StepIcon type={type} className="size-4 shrink-0 text-primary" />}
            {detailed ? (
              <span className="min-w-0 flex-1">
                <span className="block text-sm leading-5 font-medium">{STEP_TYPE_LABELS[locale][type]}</span>
                <span className="block text-xs leading-4 text-ink-soft">{STEP_TYPE_PURPOSE[locale][type]}</span>
              </span>
            ) : (
              STEP_TYPE_LABELS[locale][type]
            )}
            {detailed && type === current && <IconCheck className="size-4 shrink-0 text-primary" aria-hidden />}
          </button>
        </li>
      ))}
    </ul>
  );
}

export interface StepTypePickerProps {
  /** The button that opens it. It keeps its own look; the picker adds the press and the expanded state. */
  trigger: ReactElement<ComponentProps<"button">>;
  /** Names the menu: the sheet's title on a phone, the pane's label on a desktop. */
  title: string;
  /** One line under the title on a phone. */
  description?: string;
  /** The type to tick as the current one. */
  current?: UiStepType | null;
  /** Which edge of the trigger the desktop menu lines up with. */
  align?: "start" | "center" | "end";
  onPick: (type: UiStepType) => void;
}

/**
 * The step types behind one button: a menu beside it on a desktop, a bottom
 * sheet with 56px rows on a phone. Picking closes it.
 */
export function StepTypePicker({ trigger, title, description, current = null, align = "end", onPick }: StepTypePickerProps) {
  const phone = useMediaQuery(PHONE_QUERY);
  const [open, setOpen] = useState(false);

  function pick(type: UiStepType) {
    setOpen(false);
    onPick(type);
  }

  if (phone) {
    return (
      <>
        {cloneElement(trigger, { onClick: () => setOpen(true), "aria-haspopup": "dialog", "aria-expanded": open })}
        <Sheet open={open} onOpenChange={setOpen} title={title} description={description} side="bottom" size="md">
          <StepTypeList detailed current={current} onPick={pick} />
        </Sheet>
      </>
    );
  }

  return (
    <Popover
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      label={title}
      side="bottom"
      align={align}
      className="max-h-[min(34rem,var(--available-height,34rem))] w-80 overflow-y-auto p-1.5"
    >
      <StepTypeList detailed current={current} onPick={pick} />
    </Popover>
  );
}
