import { useRef, type CSSProperties, type KeyboardEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Leading glyph, 16px; drawn filled while its segment is the chosen one. */
  icon?: LucideIcon;
  /** A small figure after the label («مستني تأكيد ٣»). Leave out for no chip. */
  count?: number;
}

/**
 * What chose a segment: a click or a tap (where it landed; `detail` 0 for
 * Enter / Space), or an arrow key (`detail` 0, the segment it moved to). The
 * look picker draws its light / dark circle from here (@store-builder/ui/theme-reveal).
 */
export interface SegmentedPress {
  clientX: number;
  clientY: number;
  detail: number;
  currentTarget: HTMLButtonElement | null;
}

export interface SegmentedProps<T extends string> {
  value: T;
  /** NoInfer keeps T pinned to `value` / `options`, so a plain setState fits here. */
  onChange: (value: NoInfer<T>, press: SegmentedPress) => void;
  options: ReadonlyArray<SegmentedOption<T>>;
  /** Names the choice for screen readers, e.g. «الفترة». */
  label: string;
  /** `md` is 44px tall; `sm` is 36px, and 44px again under a finger. */
  size?: "sm" | "md";
  className?: string;
}

/**
 * The Mac segmented control: a pill track of equal segments and ONE thumb that
 * slides to the chosen one. The thumb is a single element one column wide,
 * moved by `translate` alone (`--i` columns along the reading direction, so it
 * runs right-to-left in Arabic) on the house spring; nothing changes size.
 *
 * A radio group underneath: one stop for Tab, then ← → (following the reading
 * direction), ↑ ↓, Home and End move and choose at once.
 *
 * The track hugs its labels; give it `w-full` to fill a row — the segments
 * stay equal and long labels are cut with an ellipsis, never wrapped.
 * Material (glass track, brand thumb, glow) is in glass/controls.css; without
 * the glass layer it is a sunken track with a solid brand pill.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
  className,
}: SegmentedProps<T>) {
  const segments = useRef<Array<HTMLButtonElement | null>>([]);
  const chosen = options.findIndex((option) => option.value === value);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const last = options.length - 1;
    // The direction of where the control sits, not of the app: it may live in an LTR island.
    const rtl = window.getComputedStyle(event.currentTarget).direction === "rtl";
    let next: number;
    switch (event.key) {
      case "ArrowRight":
        next = index + (rtl ? -1 : 1);
        break;
      case "ArrowLeft":
        next = index + (rtl ? 1 : -1);
        break;
      case "ArrowDown":
        next = index + 1;
        break;
      case "ArrowUp":
        next = index - 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    if (next < 0) next = last;
    else if (next > last) next = 0;
    const option = options[next];
    if (!option) return;
    const segment = segments.current[next] ?? null;
    segment?.focus();
    if (option.value !== value) onChange(option.value, { clientX: 0, clientY: 0, detail: 0, currentTarget: segment });
  }

  // One geometry for the thumb and for the glow under it: a column wide, `--i` columns along.
  const column =
    "absolute inset-y-1 start-1 w-[calc((100%-0.5rem)/var(--n))] rounded-full translate-x-[calc(var(--i)*100%)] rtl:translate-x-[calc(var(--i)*-100%)] transition-[translate,scale,opacity] duration-[var(--dur-move)] ease-[var(--ease-spring)] motion-reduce:transition-none";

  return (
    <div
      role="radiogroup"
      aria-label={label}
      data-slot="segmented"
      data-size={size}
      style={{ "--i": Math.max(chosen, 0), "--n": Math.max(options.length, 1) } as CSSProperties}
      className={cn(
        "zimos-segmented relative isolate inline-grid max-w-full grid-flow-col auto-cols-fr rounded-full bg-paper-sunken p-1 align-middle ring-1 ring-line ring-inset",
        size === "sm" ? "h-9 pointer-coarse:h-11" : "h-11",
        className
      )}
    >
      {/* The glow travels with the thumb but outside the clip, so it can fall below the track. */}
      <span
        aria-hidden
        className={cn("zimos-segmented-glow pointer-events-none shadow-[var(--shadow-card)]", column, chosen < 0 && "opacity-0")}
      />
      {/* The rail clips the thumb to the track: at the end of a long slide the spring presses it into the wall, never past it. */}
      <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
        <span
          className={cn(
            "zimos-segmented-thumb bg-primary forced-colors:bg-[color:Highlight]",
            column,
            "[.zimos-segmented:has([aria-checked=true]:active)_&]:scale-[0.97]",
            chosen < 0 && "opacity-0"
          )}
        />
      </span>

      {options.map((option, index) => {
        const checked = index === chosen;
        const SegmentIcon = option.icon;
        return (
          <button
            key={option.value}
            ref={(node) => {
              segments.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            // Roving focus: Tab lands on the chosen segment (or the first, when nothing is chosen yet).
            tabIndex={checked || (chosen < 0 && index === 0) ? 0 : -1}
            onClick={(event) => {
              if (!checked) onChange(option.value, event);
            }}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "relative z-[1] inline-flex min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-full text-sm font-medium whitespace-nowrap select-none",
              size === "sm" ? "px-3.5" : "px-4",
              "transition-[color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
              // The whole height of the track is the target, not only the pill inside its padding.
              "before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']",
              "focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97]",
              checked ? "text-primary-foreground forced-colors:text-[color:HighlightText]" : "text-ink-soft hover:text-ink"
            )}
          >
            {SegmentIcon && <SegmentIcon className="size-4 shrink-0" aria-hidden />}
            <span className="min-w-0 truncate">{option.label}</span>
            {option.count !== undefined && (
              <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-current/15 px-1.5 text-[11px] leading-none font-semibold tabular-nums">
                {String(option.count)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
