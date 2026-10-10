import { IconArrowDown, IconArrowUp } from "@/components/icons";

const BUTTON_CLASS =
  "inline-flex cursor-pointer items-center justify-center rounded-full p-1 text-ink-soft transition-colors duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent motion-reduce:transition-none pointer-coarse:min-h-11 pointer-coarse:min-w-11";

/**
 * Up / down buttons for reordering a section or an element — the plain-click
 * (and plain-keyboard) alternative to dragging. Disabled at either end.
 * Small under a mouse; a full 44px target each under a finger.
 */
export function MoveButtons({
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  upLabel,
  downLabel,
}: {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  upLabel: string;
  downLabel: string;
}) {
  return (
    <span className="flex shrink-0 items-center gap-0.5 normal-case tracking-normal">
      <button
        type="button"
        onClick={onMoveUp}
        disabled={!canMoveUp}
        aria-label={upLabel}
        title={upLabel}
        className={BUTTON_CLASS}
      >
        <IconArrowUp className="size-3.5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={!canMoveDown}
        aria-label={downLabel}
        title={downLabel}
        className={BUTTON_CLASS}
      >
        <IconArrowDown className="size-3.5" aria-hidden />
      </button>
    </span>
  );
}
