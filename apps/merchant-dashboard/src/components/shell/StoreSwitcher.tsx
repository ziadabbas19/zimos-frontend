import { useRef, useState } from "react";
import { cn } from "@store-builder/ui";
import { IconCaretUpDown, IconCheck, IconPlus, IconStore } from "@/components/icons";
import { Popover } from "@/components/Popover";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useCommon, useT, type Messages } from "@/i18n/LocaleContext";
import { useViewNavigate } from "@/lib/viewTransition";
import { useGuardedLeave } from "@/lib/useUnsavedGuard";

const STRINGS = {
  en: {
    selectStore: "Select a store",
    switchStore: "Switch store",
    myStores: "My stores",
    currentStore: "(open now)",
    allStores: "All my stores",
    newStore: "New store",
  },
  ar: {
    selectStore: "اختر متجرًا",
    switchStore: "تبديل المتجر",
    myStores: "متاجري",
    currentStore: "(مفتوح الآن)",
    allStores: "كل متاجري",
    newStore: "متجر جديد",
  },
} satisfies Messages;

/** The letter on a store's tile: its first character (a whole one, also for a name that starts with an emoji). */
function initialOf(name: string): string {
  return (Array.from(name.trim())[0] ?? "?").toLocaleUpperCase();
}

/** A line of the list: 36px with a mouse, 44px under a finger; rounded to sit inside the list's own corners. */
const ITEM =
  "flex min-h-9 w-full cursor-pointer items-center gap-2.5 rounded-[0.625rem] px-2.5 text-start text-sm text-ink transition-colors hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none pointer-coarse:min-h-11";
/** The letter stays white on the brand tile. */
const TILE = "zimos-store-tile flex shrink-0 items-center justify-center bg-primary font-semibold text-primary-foreground!";

interface StoreSwitcherProps {
  /** Called before the switcher leaves for another page (the phone menu closes itself). */
  onNavigate?: () => void;
  /** `md` — the compact row of the side menu. `lg` — the roomier row at the top of the phone menu. */
  size?: "md" | "lg";
  className?: string;
}

/**
 * The store being worked on, as one compact row: its tile (the first letter on
 * the brand colour), its name and a caret. Behind it: the merchant's stores
 * with a tick on the one that is open, then every store and a new one.
 *
 * The list is a Popover: drawn in the overlay root, outside the side menu's
 * glass (and, on a phone, over the menu sheet), so nothing traps or clips it.
 */
export function StoreSwitcher({ onNavigate, size = "md", className }: StoreSwitcherProps) {
  const { currentWorkspace, workspaces, selectWorkspace } = useWorkspace();
  const navigate = useViewNavigate();
  const leave = useGuardedLeave();
  const t = useT(STRINGS);
  const c = useCommon();
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const name = currentWorkspace?.name ?? t.selectStore;
  const large = size === "lg";

  function go(to: string) {
    setOpen(false);
    onNavigate?.();
    leave(() => navigate(to));
  }

  return (
    <div ref={anchor} className={className}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={t.switchStore}
        title={t.switchStore}
        aria-expanded={open}
        className={cn(
          "zimos-store-switch flex w-full cursor-pointer items-center text-start transition-[background-color,scale] duration-150 hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.98] aria-expanded:bg-paper-sunken motion-reduce:transition-none motion-reduce:active:scale-100",
          large ? "h-14 gap-3 rounded-[1.25rem] bg-paper-sunken ps-2 pe-3.5" : "h-11 gap-2.5 rounded-[1rem] bg-paper ps-1.5 pe-2.5 ring-1 ring-line"
        )}
      >
        <span aria-hidden className={cn(TILE, large ? "size-10 rounded-[0.75rem] text-base" : "size-8 rounded-[0.625rem] text-sm")}>
          {initialOf(name)}
        </span>
        <span className={cn("min-w-0 flex-1 truncate font-semibold text-ink", large ? "text-[15px]" : "text-sm")}>{name}</span>
        <IconCaretUpDown className="size-4 shrink-0 text-ink-soft" aria-hidden />
      </button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchor}
        closeLabel={c.close}
        matchWidth
        layerClassName="z-[60]"
        surfaceClassName="zimos-glass rounded-xl shadow-xl"
      >
        <div className="max-h-72 overflow-y-auto p-1.5" data-testid="store-switcher-list">
          {workspaces.length > 0 && (
            <>
              <p className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold text-ink-soft">{t.myStores}</p>
              {workspaces.map((workspace) => {
                const isCurrent = workspace.id === currentWorkspace?.id;
                return (
                  <button
                    key={workspace.id}
                    type="button"
                    onClick={() => {
                      // Another store reloads the page for it: unsaved changes ask first.
                      if (isCurrent) selectWorkspace(workspace.id);
                      else leave(() => selectWorkspace(workspace.id));
                      setOpen(false);
                    }}
                    className={ITEM}
                  >
                    <span aria-hidden className={cn(TILE, "size-6 rounded-[0.4375rem] text-[11px]")}>
                      {initialOf(workspace.name)}
                    </span>
                    <span className={cn("min-w-0 flex-1 truncate", isCurrent && "font-semibold")}>{workspace.name}</span>
                    {isCurrent && (
                      <>
                        <IconCheck className="size-4 shrink-0 text-primary" aria-hidden />
                        <span className="sr-only">{t.currentStore}</span>
                      </>
                    )}
                  </button>
                );
              })}
              <div className="mx-1.5 my-1 border-t border-line" />
            </>
          )}
          <button type="button" onClick={() => go("/stores")} className={ITEM}>
            <span aria-hidden className="flex size-6 shrink-0 items-center justify-center">
              <IconStore className="size-[18px] text-ink-soft" />
            </span>
            {t.allStores}
          </button>
          <button type="button" onClick={() => go("/workspaces")} className={ITEM}>
            <span aria-hidden className="flex size-6 shrink-0 items-center justify-center">
              <IconPlus className="size-[18px] text-ink-soft" />
            </span>
            {t.newStore}
          </button>
        </div>
      </Popover>
    </div>
  );
}
