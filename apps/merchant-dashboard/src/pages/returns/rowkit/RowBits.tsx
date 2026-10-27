import { Button, cn, ZLoader } from "@store-builder/ui";
import { type Icon } from "@/components/icons";
import { quickLookRowProps, type QuickLookRowProps } from "@/components/QuickLook";

/**
 * A fact that is still on its way, inside a line of text: a bar as tall as the
 * letters would be, in a box as tall as the line, so the row does not move
 * when the words arrive. The bar is the skeleton of DataState (`zimos-skeleton`),
 * so it shimmers with the rest and stands still under reduced motion.
 */
export function InlineBone({ className }: { className?: string }) {
  return (
    <span aria-hidden className="inline-flex h-[1lh] max-w-full items-center align-top">
      <span
        className={cn(
          "zimos-skeleton relative block h-3 w-24 max-w-full animate-pulse overflow-hidden rounded-full bg-paper-sunken motion-reduce:animate-none",
          className
        )}
      />
    </span>
  );
}

type RowActionTone = "primary" | "quiet" | "danger";

export interface RowActionProps {
  label: string;
  icon?: Icon;
  onClick: () => void;
  /** The request is out: the glyph gives way to the Z loader and the pill takes no second press. */
  busy?: boolean;
  disabled?: boolean;
  /** `primary` is the brand pill; `quiet` a small pane; `danger` the same pane written in the danger colour. */
  tone?: RowActionTone;
  className?: string;
}

/**
 * The ONE action of a row, as a pill: 44px under a finger, 36px with a mouse.
 * The words never change while it works (the width of the pill is what the
 * thumb aimed at), only the glyph does.
 */
export function RowAction({ label, icon: ActionIcon, onClick, busy = false, disabled = false, tone = "primary", className }: RowActionProps) {
  return (
    <Button
      type="button"
      variant={tone === "primary" ? "default" : "outline"}
      data-tone={tone}
      aria-busy={busy || undefined}
      disabled={disabled || busy}
      onClick={() => onClick()}
      className={cn(
        "zimos-row-action h-11 max-w-full gap-1.5 rounded-full px-4 text-[13px] pointer-fine:h-9 pointer-fine:px-3.5",
        tone === "danger" && "text-danger hover:text-danger",
        className
      )}
    >
      {busy ? (
        <ZLoader size="sm" aria-hidden />
      ) : ActionIcon ? (
        <ActionIcon className="size-4" aria-hidden />
      ) : null}
      <span className="min-w-0 truncate">{label}</span>
    </Button>
  );
}

/**
 * The keys of a row that can be peeked at: Space opens Quick Look (and closes
 * it again from inside), Enter on the row itself opens the page of the row.
 * Spread it on a `ListRowCard` or hand it to a `DeskRow`.
 */
export function rowKeyProps(onPeek: () => void, onOpenFully?: () => void): QuickLookRowProps {
  const peek = quickLookRowProps(onPeek);
  return {
    tabIndex: 0,
    onKeyDown(event) {
      peek.onKeyDown(event);
      if (!onOpenFully || event.key !== "Enter" || event.target !== event.currentTarget) return;
      if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      onOpenFully();
    },
  };
}
