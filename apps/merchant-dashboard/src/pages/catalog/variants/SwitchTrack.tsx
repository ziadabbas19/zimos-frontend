import { cn } from "@store-builder/ui";

/**
 * The look of an on / off switch: a 40×24 track and a thumb that slides to the
 * end when it is on (toward the left in Arabic), on the house spring — `translate`
 * only. It is the picture, not the control: put it inside a `role="switch"`
 * button, or beside a checkbox with that role, which carries the name, the
 * state and the focus. Material is in glass/product-media.css; without the
 * glass layer the track is the store's colour when on and a quiet grey when off.
 */
export function SwitchTrack({ on, className }: { on: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      data-on={on ? "" : undefined}
      className={cn(
        "zimos-variant-switch-track pointer-events-none relative block h-6 w-10 shrink-0 rounded-full",
        "transition-[background-color,opacity] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
        on ? "bg-primary" : "bg-ink/30",
        className
      )}
    >
      <span
        className={cn(
          "zimos-variant-switch-thumb absolute start-0.5 top-0.5 block size-5 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.3)]",
          "transition-[translate,scale] duration-[var(--dur-move)] ease-[var(--ease-spring)] motion-reduce:transition-none",
          on && "translate-x-4 rtl:-translate-x-4"
        )}
      />
    </span>
  );
}
