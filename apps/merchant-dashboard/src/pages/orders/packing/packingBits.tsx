import type { ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { IconCheck } from "@/components/icons";

/**
 * The small pieces the pick list and the packing station share: the tick box
 * of a line that is checked off by hand, the bar that says how far along the
 * work is, and the pane both screens lay their lists on.
 */

/**
 * A tick box as the list kit draws it (the brand fill of a ticked row): a
 * 44px target around a 22px box. Put it inside the `<label>` of its line — the
 * words of the line then name it, and a press anywhere on the line ticks it.
 */
export function TickBox({ checked, onChange, disabled = false }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <span className="relative -ms-2 flex size-11 shrink-0 items-center justify-center">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="peer absolute inset-0 m-0 size-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
      />
      <span
        aria-hidden
        data-checked={checked ? "" : undefined}
        className={cn(
          "zimos-row-check pointer-events-none flex size-[22px] items-center justify-center rounded-[7px]",
          "transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-active:scale-[0.92] motion-reduce:peer-active:scale-100",
          checked ? "bg-primary text-primary-foreground" : "bg-paper-raised ring-[1.5px] ring-line-strong ring-inset"
        )}
      >
        {checked && (
          <IconCheck className="size-3.5 motion-safe:animate-[list-badge-pop_var(--dur-pop)_var(--ease-pop)_both]" aria-hidden />
        )}
      </span>
    </span>
  );
}

/**
 * How far along: a track and a fill that grows from the start edge by
 * transform alone (nothing changes width). `label` is what a screen reader
 * hears — the same sentence the page writes beside the bar.
 */
export function MeterBar({
  value,
  max,
  label,
  done = false,
  className,
}: {
  value: number;
  max: number;
  label: string;
  /** Complete: the fill turns to the success colour. */
  done?: boolean;
  className?: string;
}) {
  const share = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className={cn("zimos-meter h-2.5 overflow-hidden rounded-full bg-paper-sunken", className)}
    >
      <div
        data-done={done ? "" : undefined}
        className={cn(
          "zimos-meter-fill h-full w-full rounded-full transition-transform duration-[var(--dur-move)] ease-[var(--ease-out)] [transform-origin:0_50%] motion-reduce:transition-none rtl:[transform-origin:100%_50%]",
          done ? "bg-success" : "bg-primary"
        )}
        style={{ transform: `scaleX(${share})` }}
      />
    </div>
  );
}

/** A pane in the page flow: the raised sheet every list of these two screens lies on (the glass layer makes it glass). */
export function Pane({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line", className)}>{children}</div>
  );
}
