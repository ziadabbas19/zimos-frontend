import { useEffect, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import { IconPin, IconUnpin } from "@/components/icons";
import { cn } from "@store-builder/ui";
import { dashboardGetShortcuts, dashboardSetShortcuts } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspace } from "@/context/WorkspaceContext";
import { NavRow } from "@/components/shell/SidebarNav";
import { NAV_ITEMS, NAV_LABELS, findNavItem, isNavItemVisible } from "@/lib/navigation";
import { useWorkCounts } from "@/lib/workCounts";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { heading: "Shortcuts", pin: "Pin this page", unpin: "Unpin this page", full: "You can pin up to {n} pages." },
  ar: { heading: "الاختصارات", pin: "تثبيت هذه الصفحة", unpin: "إلغاء تثبيت هذه الصفحة", full: "يمكنك تثبيت {n} صفحات كحد أقصى." },
} satisfies Messages;

const MAX = 8;

/*
 * One list per store, shared by the side menu and the phone menu (both show
 * the pinned group), so a pin made in one shows in the other at once.
 */
let state: { workspaceId: string | null; shortcuts: string[] } = { workspaceId: null, shortcuts: [] };
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => state;
function setState(next: typeof state) {
  state = next;
  listeners.forEach((listener) => listener());
}

function load(workspaceId: string) {
  if (state.workspaceId === workspaceId) return;
  setState({ workspaceId, shortcuts: [] });
  dashboardGetShortcuts(apiClient, workspaceId)
    .then((shortcuts) => {
      if (state.workspaceId === workspaceId) setState({ workspaceId, shortcuts });
    })
    .catch(() => undefined);
}

function save(workspaceId: string, shortcuts: string[]) {
  const previous = state.shortcuts;
  setState({ workspaceId, shortcuts });
  dashboardSetShortcuts(apiClient, workspaceId, shortcuts).catch(() => {
    if (state.workspaceId === workspaceId) setState({ workspaceId, shortcuts: previous });
  });
}

interface SidebarShortcutsProps {
  onNavigate?: () => void;
  /** `rail` — the side menu's rows. `sheet` — the phone menu's two-column tiles. */
  variant?: "rail" | "sheet";
}

/**
 * Sidebar shortcuts (SPEC §18.6): the pages this member pinned, as the first
 * group of the menu, and the pin/unpin control for the page they are on.
 *
 * A pinned row is a way to a page, not the page's place in the menu: the row
 * in its own group is the one that lights up, so there is only ever one
 * "you are here". It carries the same badge of waiting work as that row.
 */
export function SidebarShortcuts({ onNavigate, variant = "rail" }: SidebarShortcutsProps) {
  const t = useT(STRINGS);
  const navLabels = useT(NAV_LABELS);
  const location = useLocation();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const role = currentWorkspace?.role;
  const { shortcuts } = useSyncExternalStore(subscribe, snapshot);
  const counts = useWorkCounts(workspaceId);
  const sheet = variant === "sheet";

  useEffect(() => {
    if (workspaceId) load(workspaceId);
  }, [workspaceId]);

  if (!workspaceId) return null;

  const current = findNavItem(location.pathname);
  const pinned = shortcuts
    .map((to) => NAV_ITEMS.find((item) => item.to === to))
    .filter((item): item is (typeof NAV_ITEMS)[number] => Boolean(item && isNavItemVisible(item, role)));
  const isPinned = Boolean(current && shortcuts.includes(current.to));
  const canPin = Boolean(current && current.to !== "/" && (isPinned || shortcuts.length < MAX));

  function toggle() {
    if (!current || !workspaceId) return;
    save(workspaceId, isPinned ? shortcuts.filter((to) => to !== current.to) : [...shortcuts, current.to]);
  }

  // Nothing pinned and nothing to pin (the home page): take no space at all.
  if (pinned.length === 0 && !canPin) return null;

  const PinIcon = isPinned ? IconUnpin : IconPin;
  const pinLabel = isPinned ? t.unpin : t.pin;

  // Nothing pinned yet: no heading over an empty group — one quiet line that is the invitation itself.
  if (pinned.length === 0) {
    return (
      <div data-slot="menu-shortcuts">
        <button
          type="button"
          onClick={toggle}
          aria-pressed={isPinned}
          className={cn(
            "zimos-menu-pin-slot flex w-full cursor-pointer items-center gap-2.5 rounded-full border border-dashed border-line-strong/60 text-start text-[13px] font-medium text-ink-soft transition-[background-color,color,scale] duration-150 hover:bg-paper-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
            sheet ? "min-h-12 ps-3.5 pe-3" : "h-9 px-3 pointer-coarse:h-11"
          )}
        >
          <PinIcon className={cn("shrink-0", sheet ? "size-5" : "size-[18px]")} aria-hidden />
          <span className="min-w-0 flex-1 truncate">{pinLabel}</span>
        </button>
      </div>
    );
  }

  return (
    <div data-slot="menu-shortcuts">
      <div className={cn("flex items-center gap-1", sheet ? "min-h-8 ps-1 pb-1" : "h-7 ps-3 pe-0.5 pointer-coarse:h-11")}>
        <span className={cn("min-w-0 flex-1 truncate font-semibold text-primary", sheet ? "text-[13px]" : "text-[12px]")}>{t.heading}</span>
        {current && current.to !== "/" && (
          <button
            type="button"
            onClick={toggle}
            disabled={!canPin}
            title={!canPin ? fmt(t.full, { n: MAX }) : pinLabel}
            aria-label={pinLabel}
            aria-pressed={isPinned}
            className={cn(
              "zimos-menu-pin flex shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[background-color,color,scale] duration-150 hover:bg-paper-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-primary active:scale-90 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100",
              sheet ? "-me-2 size-11" : "size-6 pointer-coarse:size-11"
            )}
          >
            <PinIcon className={sheet ? "size-[18px]" : "size-3.5"} aria-hidden />
          </button>
        )}
      </div>
      <div className={sheet ? "grid grid-cols-2 gap-2" : "flex flex-col gap-0.5"}>
        {pinned.map((item) => (
          <NavRow key={item.to} item={item} label={navLabels[item.key]} counts={counts} variant={variant} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}
