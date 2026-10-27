import { useId, useState, type ReactNode } from "react";
import { Button, cn } from "@store-builder/ui";
import { IconCaretDown } from "@/components/icons";
import { Sheet } from "@/components/Sheet";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { filters: "Filters", clearAll: "Clear all" },
  ar: { filters: "الفلاتر", clearAll: "مسح الكل" },
} satisfies Messages;

export interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Default «الفلاتر» / "Filters". */
  title?: string;
  /** Filters in effect; enables "Clear all". */
  activeCount: number;
  onReset: () => void;
  /** e.g. «اعرض ٤٢ أوردر». The primary button; closing the sheet is its only job (filters apply as they change). */
  applyLabel: ReactNode;
  /** `<FilterGroup>`s. */
  children: ReactNode;
}

/**
 * The one place a list is filtered: a bottom sheet on the phone, a centred
 * dialog from 640px (components/Sheet.tsx). The body is a column of
 * `FilterGroup`s parted by hairlines. Filters take effect as they change, so
 * the list behind is already the answer; the main button only closes the
 * sheet, and says what is waiting behind it («اعرض ٤٢ أوردر»). «امسح الكل»
 * puts every filter back and is off while none is set.
 */
export function FilterSheet({ open, onOpenChange, title, activeCount, onReset, applyLabel, children }: FilterSheetProps) {
  const t = useT(STRINGS);
  const nothingSet = activeCount <= 0;
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={title ?? t.filters}
      side="auto"
      size="md"
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            disabled={nothingSet}
            // Still focusable when it turns off under the finger that pressed it: focus stays in the footer.
            focusableWhenDisabled
            onClick={() => {
              if (!nothingSet) onReset();
            }}
            className="rounded-full px-4 text-ink-soft hover:text-ink data-disabled:cursor-not-allowed data-disabled:opacity-50 sm:me-auto"
          >
            {t.clearAll}
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)} className="max-w-full rounded-full px-5">
            <span className="min-w-0 truncate">{applyLabel}</span>
          </Button>
        </>
      }
    >
      <div data-slot="filter-groups" className="flex flex-col">
        {children}
      </div>
    </Sheet>
  );
}

export interface FilterGroupProps {
  label: string;
  hint?: string;
  children: ReactNode;
  /** closed by default when true */
  collapsible?: boolean;
  defaultOpen?: boolean;
}

/**
 * One filter in the sheet: a 13px semibold label (a heading, so the sheet can
 * be walked filter by filter), an optional hint, then its controls — which
 * name themselves (`FilterChoice` takes a `label`; give a bare field an
 * `aria-label`). `collapsible` makes the label a disclosure button, closed
 * until pressed unless `defaultOpen`, for the filters few people reach for:
 * its caret turns half a circle, and nothing changes height on a timer.
 */
export function FilterGroup({ label, hint, children, collapsible = false, defaultOpen = false }: FilterGroupProps) {
  const panelId = useId();
  const [open, setOpen] = useState(defaultOpen);
  // The controls settle in only after a press, not when the sheet itself opens.
  const [pressed, setPressed] = useState(false);
  const expanded = !collapsible || open;

  return (
    <div
      data-slot="filter-group"
      className={cn("border-t border-line first:border-t-0 first:pt-0 last:pb-0", collapsible ? "py-1.5" : "py-4")}
    >
      {collapsible ? (
        <h3 className="flex">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            data-slot="filter-toggle"
            onClick={() => {
              setOpen((was) => !was);
              setPressed(true);
            }}
            // Drawn 8px wider than the column on each side, so its words line up with the other labels.
            className="-mx-2 flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-[0.75rem] px-2 py-1.5 text-start transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none"
          >
            <span className="block min-w-0 flex-1">
              <span className="block text-[13px] leading-5 font-semibold text-ink">{label}</span>
              {hint && (
                <span data-slot="filter-hint" className="mt-0.5 block text-xs leading-4 font-normal text-ink-soft">
                  {hint}
                </span>
              )}
            </span>
            <IconCaretDown
              className={cn(
                "size-4 shrink-0 text-ink-soft transition-[rotate] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
                open && "rotate-180"
              )}
              aria-hidden
            />
          </button>
        </h3>
      ) : (
        <>
          <h3 className="text-[13px] leading-5 font-semibold text-ink">{label}</h3>
          {hint && (
            <p data-slot="filter-hint" className="mt-0.5 text-xs leading-4 text-ink-soft">
              {hint}
            </p>
          )}
        </>
      )}
      <div
        id={panelId}
        hidden={!expanded}
        className={cn(
          collapsible ? "pt-1.5 pb-2.5" : "pt-2.5",
          collapsible && pressed && "motion-safe:animate-[list-group-in_var(--dur-fade)_var(--ease-out)_both]"
        )}
      >
        {children}
      </div>
    </div>
  );
}

export interface FilterChoiceProps<T extends string> {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T | null;
  onChange: (value: T | null) => void;
  /** Names the choice for screen readers. */
  label: string;
  /** Pressing the chosen pill again lets go of it (`null`). Off by default: give an "all" option instead, or turn this on. */
  allowClear?: boolean;
}

// The same pill as a chip of the row over the list (ChipRow), so one filter looks the same in both places:
// glass/list.css styles `.zimos-chip` once.
const CHOICE =
  "zimos-chip inline-flex h-10 max-w-full cursor-pointer items-center rounded-full px-3.5 text-sm font-medium select-none pointer-coarse:h-11 " +
  "transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:active:scale-100";
const CHOICE_ON = "bg-primary text-primary-foreground forced-colors:bg-[color:Highlight] forced-colors:text-[color:HighlightText]";
const CHOICE_OFF = "bg-paper-raised text-ink ring-1 ring-line hover:bg-paper-sunken";

/**
 * A single choice among a few, as pills that wrap onto as many lines as they
 * need. Toggle buttons in a named group (`aria-pressed`); `null` is "no
 * choice".
 */
export function FilterChoice<T extends string>({ options, value, onChange, label, allowClear = false }: FilterChoiceProps<T>) {
  return (
    <div role="group" aria-label={label} data-slot="filter-choice" className="flex flex-wrap gap-2">
      {options.map((option) => {
        const pressed = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={pressed}
            onClick={() => {
              if (!pressed) onChange(option.value);
              else if (allowClear) onChange(null);
            }}
            className={cn(CHOICE, pressed ? CHOICE_ON : CHOICE_OFF)}
          >
            <span className="min-w-0 truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
