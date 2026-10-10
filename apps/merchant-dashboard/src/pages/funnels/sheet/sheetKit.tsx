import { createContext, useContext, useEffect, useId, useState, type ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { IconArrowLeft, IconCaretDown } from "@/components/icons";

/**
 * The small parts the funnel's settings sheet is built from (FunnelGrowthPanel.tsx):
 * the unsaved-changes guard its parts report to, the pinned footer of a part,
 * a fold for what is used rarely, and the back row of a second level.
 */

export interface SheetGuard {
  /** A part says whether it holds something not saved yet. `id` names the reporter; several may report at once. */
  setDirty: (id: string, dirty: boolean) => void;
  /** Runs `action` at once, or — while something is unsaved — after the merchant agrees to lose it. */
  guard: (action: () => void) => void;
  /** Lets a part ask for the wide sheet (a version's page editor needs the room). */
  setWide: (wide: boolean) => void;
}

// Outside the sheet (a field reused on another screen) nothing guards: actions just run.
const NO_GUARD: SheetGuard = {
  setDirty: () => undefined,
  guard: (action) => action(),
  setWide: () => undefined,
};

export const SheetGuardContext = createContext<SheetGuard>(NO_GUARD);

export function useSheetGuard(): SheetGuard {
  return useContext(SheetGuardContext);
}

/** Reports `dirty` to the sheet while mounted, and clears it on the way out. */
export function useSheetDirty(id: string, dirty: boolean): void {
  const { setDirty } = useContext(SheetGuardContext);
  useEffect(() => {
    setDirty(id, dirty);
  }, [id, dirty, setDirty]);
  useEffect(() => () => setDirty(id, false), [id, setDirty]);
}

/**
 * The save bar of a part, pinned under the sheet's scrolling body: what is
 * waiting on the start side, the actions at the end (give the main one last).
 * On a phone the actions fill the row, 44px tall, clear of the home indicator.
 */
export function PartFooter({ message, children, className }: { message?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div
      data-slot="sheet-footer"
      data-funnel-sheet-foot=""
      className={cn(
        "flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 pt-3 pb-4 max-sm:pb-[max(1rem,env(safe-area-inset-bottom))]",
        className
      )}
    >
      {message ? (
        <p role="status" className="min-w-0 flex-1 basis-40 text-sm font-medium text-ink">
          {message}
        </p>
      ) : (
        <span aria-hidden className="flex-1" />
      )}
      <div className="flex shrink-0 flex-wrap items-center gap-2 max-sm:w-full max-sm:*:flex-1 *:data-[slot=button]:min-h-11 *:data-[slot=button]:rounded-full *:data-[slot=button]:px-4">
        {children}
      </div>
    </div>
  );
}

/**
 * A fold inside the sheet: one 44px row that opens what is used rarely. The
 * body stays mounted while closed, so a half-typed field survives a fold.
 */
export function Fold({
  title,
  summary,
  defaultOpen = false,
  open: controlled,
  onOpenChange,
  children,
}: {
  title: string;
  /** One quiet line on the closed row: what is inside. */
  summary?: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const [inner, setInner] = useState(defaultOpen);
  const open = controlled ?? inner;
  const panelId = useId();
  return (
    <section data-funnel-sheet-fold="" data-open={open ? "" : undefined} className="rounded-2xl bg-paper-raised ring-1 ring-line">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          if (controlled === undefined) setInner(!open);
          onOpenChange?.(!open);
        }}
        className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-2 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">{title}</span>
          {summary && !open && <span className="block truncate text-xs leading-5 text-ink-soft">{summary}</span>}
        </span>
        <IconCaretDown
          aria-hidden
          className={cn(
            "size-4 shrink-0 text-ink-soft transition-transform duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
            open && "rotate-180"
          )}
        />
      </button>
      <div id={panelId} role="region" aria-label={title} hidden={!open} className="space-y-4 border-t border-line px-4 pt-3 pb-4">
        {children}
      </div>
    </section>
  );
}

/**
 * The top of a second level inside the sheet: a 44px way back that names where
 * it goes, the level's own title, and a slot at the end (a status chip, a save).
 */
export function BackRow({ backLabel, title, onBack, end }: { backLabel: string; title: string; onBack: () => void; end?: ReactNode }) {
  return (
    <div data-funnel-sheet-back="" className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 ps-2 pe-5 pb-2">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-medium text-ink-soft transition-[color,background-color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-primary-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none"
      >
        <IconArrowLeft className="size-4 shrink-0 rtl:rotate-180" aria-hidden />
        {backLabel}
      </button>
      <h3 className="min-w-0 flex-1 truncate text-[15px] leading-6 font-semibold text-ink" dir="auto">
        {title}
      </h3>
      {end && <div className="flex shrink-0 items-center gap-2">{end}</div>}
    </div>
  );
}
