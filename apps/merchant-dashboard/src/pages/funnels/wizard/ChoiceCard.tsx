import type { ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { IconCheck } from "@/components/icons";

/**
 * One answer to a wizard question: a card that is a radio. The whole card is
 * the target (56px at least); the chosen one takes the selection ring and a
 * tick at its end. Arrow keys move between the cards of one `name`, as with
 * any radio group — put them inside an element with `role="radiogroup"`.
 *
 * Material (the small pane, the brand ring of the chosen card) is in
 * glass/funnel-list.css; without the glass layer it is a solid raised card.
 */
export function ChoiceCard({
  name,
  checked,
  onSelect,
  title,
  hint,
  leading,
  badge,
  children,
  disabled = false,
  className,
}: {
  /** The radio group's name: one per question. */
  name: string;
  checked: boolean;
  onSelect: () => void;
  title: ReactNode;
  /** A line under the title. */
  hint?: ReactNode;
  /** A thumbnail or an icon at the start. */
  leading?: ReactNode;
  /** A small chip after the title. */
  badge?: ReactNode;
  /** More under the two lines (a step chain, a preview button). Buttons and links in it stay their own controls. */
  children?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      data-slot="wizard-choice"
      data-active={checked ? "" : undefined}
      className={cn(
        "zimos-wizard-choice relative flex min-h-14 min-w-0 flex-col rounded-[1.125rem] px-3.5 py-3 text-ink",
        "transition-[scale,background-color,box-shadow] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
        "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-primary motion-safe:has-[label:active]:scale-[0.985]",
        checked ? "bg-primary-soft ring-2 ring-primary" : "bg-paper-raised ring-1 ring-line hover:bg-paper-sunken",
        disabled && "opacity-60",
        className
      )}
    >
      <label className={cn("flex min-w-0 items-center gap-3", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
        <input type="radio" name={name} className="sr-only" checked={checked} disabled={disabled} onChange={onSelect} />
        {leading && <span className="flex shrink-0 items-center justify-center">{leading}</span>}
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate text-[15px] leading-6 font-semibold text-ink" dir="auto">
              {title}
            </span>
            {badge}
          </span>
          {hint && <span className="block text-[13px] leading-5 text-ink-soft">{hint}</span>}
        </span>
        <span
          aria-hidden
          className={cn(
            "zimos-wizard-tick flex size-6 shrink-0 items-center justify-center rounded-full",
            checked ? "bg-primary text-primary-foreground" : "ring-[1.5px] ring-line-strong ring-inset"
          )}
        >
          {checked && <IconCheck className="size-3.5 motion-safe:animate-[list-badge-pop_var(--dur-pop)_var(--ease-pop)_both]" />}
        </span>
      </label>
      {children}
    </div>
  );
}
