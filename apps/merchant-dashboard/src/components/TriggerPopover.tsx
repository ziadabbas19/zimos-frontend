import type { ReactElement, ReactNode, RefObject, SyntheticEvent } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { cn } from "@store-builder/ui";
import { useLocale } from "@/i18n/LocaleContext";

export interface TriggerPopoverProps {
  /** The element that opens it — a `<button>` or one of our buttons. It keeps its own look. */
  trigger: ReactElement;
  /** Leave both out and the popover keeps its own open state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Which side of the trigger it opens on; it flips by itself when there is no room. Logical sides only. */
  side?: "top" | "bottom" | "inline-start" | "inline-end";
  align?: "start" | "center" | "end";
  className?: string;
  /** Names the pane for screen readers. */
  label: string;
  /** What takes focus when it opens. By default the first control inside (the pane itself after a tap, so the keyboard stays down). */
  initialFocus?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

/**
 * The pane is drawn in <body>, but React still bubbles its events to wherever
 * the trigger sits. Without this a press on Save would also be a click on the
 * table row around the trigger (which opens the order), Space in the field
 * would peek the row, and a right-click would raise the row's menu.
 */
const contain = (event: SyntheticEvent) => event.stopPropagation();

/** Base UI wants to know when the trigger is not a native button (a link, a div). */
function isNativeButton(trigger: ReactElement): boolean {
  return typeof trigger.type === "string" ? trigger.type === "button" : true;
}

/**
 * A small pane that opens beside what was pressed — for one field, a short
 * choice, a few lines of help. On Base UI's Popover: focus moves inside and
 * goes back to the trigger on close, Esc and a press outside close it, and it
 * stays on screen by flipping or sliding along the trigger.
 *
 * It opens like a menu: a fade with a small spring out of the corner nearest
 * the trigger (Base UI's --transform-origin), and leaves on a plain fade.
 * Material (frost, rim, shadow) is in glass/controls.css; without the glass
 * layer it is a solid raised card with a hairline.
 */
export function TriggerPopover({
  trigger,
  open,
  onOpenChange,
  side = "bottom",
  align = "center",
  className,
  label,
  initialFocus,
  children,
}: TriggerPopoverProps) {
  // Base UI reads the direction from its own provider, not from <html dir>: inline-start has to mean right in Arabic.
  const { dir } = useLocale();
  return (
    <DirectionProvider direction={dir}>
      <PopoverPrimitive.Root open={open} onOpenChange={(next) => onOpenChange?.(next)}>
        <PopoverPrimitive.Trigger render={trigger} nativeButton={isNativeButton(trigger)} />
        <PopoverPrimitive.Portal>
          {/* Above sheets and dialogs (a popover may open from inside one), under toasts. */}
          <PopoverPrimitive.Positioner side={side} align={align} sideOffset={8} collisionPadding={12} className="z-[60]">
            <PopoverPrimitive.Popup
              data-slot="popover"
              aria-label={label}
              initialFocus={initialFocus}
              onClick={contain}
              onDoubleClick={contain}
              onContextMenu={contain}
              onKeyDown={contain}
              onKeyUp={contain}
              onPointerDown={contain}
              onPointerUp={contain}
              onMouseDown={contain}
              onMouseUp={contain}
              onTouchStart={contain}
              onTouchEnd={contain}
              onInput={contain}
              onChange={contain}
              onSubmit={contain}
              className={cn(
                "zimos-popover max-w-[calc(100vw-1.5rem)] min-w-56 origin-[var(--transform-origin)] rounded-[1rem] bg-paper-raised p-3 text-sm text-ink shadow-[var(--shadow-pop)] ring-1 ring-line outline-none",
                "[transition:opacity_var(--dur-fade)_var(--ease-out),scale_var(--dur-move)_var(--ease-spring)] motion-reduce:transition-none",
                "data-[starting-style]:scale-[0.96] data-[starting-style]:opacity-0",
                "data-[ending-style]:scale-[0.96] data-[ending-style]:opacity-0 data-[ending-style]:[transition:opacity_var(--dur-fade)_var(--ease-out),scale_var(--dur-fade)_var(--ease-out)]",
                className
              )}
            >
              {children}
            </PopoverPrimitive.Popup>
          </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </DirectionProvider>
  );
}

/** A button inside the pane that closes it (Base UI's Popover.Close: `<PopoverClose className=…>…</PopoverClose>`). */
export const PopoverClose = PopoverPrimitive.Close;
