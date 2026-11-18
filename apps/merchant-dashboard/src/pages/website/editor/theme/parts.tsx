import { useId, useState, type ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { IconCaretDown, IconCheck } from "@/components/icons";

/**
 * The small pieces the theme panel and the header / footer / announcement
 * panels are built from, so the two read as one inspector: a compact titled
 * block, a switch row, a choice card, a round icon button.
 *
 * Structure only. Their material — translucent fills, the lit rim, the brand
 * fill on what is chosen — is the `[theme]` block of glass/editor.css; without
 * the glass layer they stand on the solid classes here.
 */

/** A pressable card that is one choice among several: a preset, a theme, a font pair. */
export const lookCardClass =
  "zimos-look-card relative cursor-pointer overflow-hidden rounded-[0.875rem] bg-paper-raised text-start ring-1 ring-line " +
  "transition-[scale,box-shadow] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:ring-line-strong " +
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary active:scale-[0.97] " +
  "aria-checked:ring-2 aria-checked:ring-primary aria-pressed:ring-2 aria-pressed:ring-primary " +
  "aria-disabled:cursor-not-allowed aria-disabled:opacity-60 aria-disabled:active:scale-100 motion-reduce:transition-none";

/** A round, quiet icon button: 36px with a pointer, 44px under a finger. */
export const lookIconButtonClass =
  "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft " +
  "transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-ink/6 hover:text-ink " +
  "focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 " +
  "disabled:hover:bg-transparent disabled:active:scale-100 pointer-coarse:size-11 motion-reduce:transition-none";

/** A text-only action under a list («رجع الروابط الأساسية»): a full-height target on touch. */
export const lookTextButtonClass =
  "inline-flex min-h-8 cursor-pointer items-center rounded-full text-sm font-medium text-primary underline-offset-4 hover:underline " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary pointer-coarse:min-h-11";

/**
 * One block of a panel: a title, an optional action at the end of the title's
 * line, an optional hint, then the controls. A titled block folds away under
 * its title, so a long panel can be read group by group; `defaultOpen` says how
 * it starts. Blocks are separated by a hairline; the gutter comes from
 * `--look-gutter` (set by the panel's root, so the same block sits in the
 * inspector and in a phone sheet).
 */
export function LookBlock({
  title,
  hint,
  action,
  className,
  defaultOpen = true,
  children,
}: {
  title?: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const shell = cn("border-b border-line px-[var(--look-gutter,1rem)] py-3 last:border-b-0", className);
  const body = (
    <>
      {hint && <p className="text-sm leading-6 text-ink-soft">{hint}</p>}
      {children}
    </>
  );
  if (!title) {
    return (
      <section data-slot="look-block" className={cn(shell, "space-y-3 py-4")}>
        {action}
        {body}
      </section>
    );
  }
  return (
    <details data-slot="look-block" open={open} onToggle={(e) => setOpen(e.currentTarget.open)} className={cn(shell, "group/block")}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-[0.5rem] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
        <h3 className="min-w-0 flex-1 text-base leading-6 font-semibold break-words text-ink">{title}</h3>
        {action}
        <IconCaretDown className="size-4 shrink-0 text-ink-soft transition-transform duration-[var(--dur-fade)] group-open/block:rotate-180 motion-reduce:transition-none" aria-hidden />
      </summary>
      <div className="space-y-3 pt-2 pb-1">{body}</div>
    </details>
  );
}

/** The mark on a chosen card: a small round check in the brand fill. */
export function LookCheck({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "zimos-look-check flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground",
        className
      )}
    >
      <IconCheck className="size-3" aria-hidden />
    </span>
  );
}

/**
 * A setting that is on or off: the label fills the row and the switch sits at
 * its end, so the whole 44px row is the target. A native checkbox underneath
 * (role="switch"): Space toggles it, and the knob moves by transform alone.
 */
export function SwitchRow({
  label,
  hint,
  checked,
  onChange,
  strong = false,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  /** A block's own on/off (the announcement bar): the label is set like a title. */
  strong?: boolean;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3">
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm text-ink", strong && "font-semibold")}>{label}</span>
        {hint && <span className="mt-0.5 block text-sm text-ink-soft">{hint}</span>}
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={cn(
          "zimos-look-switch relative h-6 w-10 shrink-0 cursor-pointer appearance-none rounded-full bg-line-strong",
          "transition-colors duration-[var(--dur-fade)] ease-[var(--ease-out)] checked:bg-primary",
          "before:absolute before:start-0.5 before:top-0.5 before:size-5 before:rounded-full before:bg-white before:shadow-sm before:content-['']",
          "before:transition-transform before:duration-[var(--dur-pop)] before:ease-[var(--ease-pop)]",
          "checked:before:translate-x-4 rtl:checked:before:-translate-x-4",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          "motion-reduce:transition-none motion-reduce:before:transition-none"
        )}
      />
    </label>
  );
}
