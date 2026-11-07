import { lazy, Suspense, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { List, type LucideIcon } from "lucide-react";
import { cn } from "@store-builder/ui";
import { useT } from "@/i18n/LocaleContext";
import { useConsoleRow, type ConsoleShortcut } from "@/lib/consoleShortcuts";
import { SHELL_STRINGS } from "@/lib/shellStrings";
import { useNavLabel } from "./SidebarNav";

// Its own chunk, with the drag library: nothing of it loads until someone customizes the bar.
const ShortcutRowEditor = lazy(() => import("@/components/ShortcutRowEditor").then((module) => ({ default: module.ShortcutRowEditor })));

/**
 * The dock's slots, as this account arranged them (lib/consoleShortcuts, the
 * API's console_mobile_nav): pages of the side menu, each with its address,
 * icon and permission (lib/nav.ts), four at most. A page the account cannot
 * open leaves its slot, so it gets fewer, equal ones. An account that never
 * arranged it gets the bar it always was: Overview, Workspaces, Subscriptions,
 * Tickets.
 */
export function useDockItems(): ConsoleShortcut[] {
  return useConsoleRow("mobileNav").entries;
}

/** The bar's editor: opened from "Customize the bar" in the phone menu (the layout keeps whether it is open). */
export interface DockEditorState {
  open: boolean;
  /** How many times it was opened: each opening starts from the bar as it is then. */
  opened: number;
}

function onTab(pathname: string, to: string): boolean {
  return to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);
}

/** A tap is over in under 100ms; the pressed look is held this long so the swell is seen. */
const PRESS_HOLD_MS = 140;

/**
 * The pressed state of a slot, as a `data-pressed` attribute its icon pill
 * swells on. `:active` alone ends with the finger, often before one frame was
 * drawn; this keeps the state for PRESS_HOLD_MS, then lets the pill settle
 * back. Written straight to the element: a press re-renders nothing.
 */
function usePressSwell<T extends HTMLElement>() {
  const timer = useRef<number | undefined>(undefined);
  const downAt = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const press = (e: ReactPointerEvent<T>) => {
    window.clearTimeout(timer.current);
    downAt.current = e.timeStamp;
    e.currentTarget.setAttribute("data-pressed", "");
  };
  const release = (e: ReactPointerEvent<T>) => {
    const el = e.currentTarget;
    if (!el.hasAttribute("data-pressed")) return;
    const held = e.timeStamp - downAt.current;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => el.removeAttribute("data-pressed"), Math.max(0, PRESS_HOLD_MS - held));
  };
  return { onPointerDown: press, onPointerUp: release, onPointerLeave: release, onPointerCancel: release };
}

/* The merchant dashboard's dock, class for class (its components/MobileTabBar.tsx):
   the theme draws the glass, the brand pill and the lens on these hooks. */

/* One slot: at least 48 x 56px under the thumb, the icon pill above the label. */
const SLOT =
  "group/slot relative flex min-h-14 min-w-12 cursor-pointer touch-manipulation flex-col items-center justify-center gap-0.5 rounded-[1.5rem] text-ink-soft select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] transition-colors duration-[var(--dur-fade)] ease-[var(--ease-out)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none";

/* The icon's pill, 52 x 30px. It swells to 1.16 while the slot is pressed and settles back on the house pop curve. */
const PILL =
  "zimos-dock-pill relative flex h-[30px] w-[52px] items-center justify-center rounded-full transition-transform duration-[var(--dur-pop)] ease-[var(--ease-pop)] motion-reduce:transition-none motion-safe:group-active/slot:scale-[1.16] motion-safe:group-data-[pressed]/slot:scale-[1.16] group-active/slot:duration-[var(--dur-fade)] group-active/slot:ease-[var(--ease-out)] group-data-[pressed]/slot:duration-[var(--dur-fade)] group-data-[pressed]/slot:ease-[var(--ease-out)]";

const LABEL = "zimos-dock-label block max-w-full min-w-0 truncate px-0.5 text-[11px] leading-[14px] font-medium whitespace-nowrap";

/**
 * The phone's dock: the places an admin opens most, under the thumb, plus
 * "More" which opens the whole menu. A floating pane of glass, not an
 * edge-to-edge bar. Hidden from `md` up, where the side menu is on screen.
 */
export function Dock({
  onMore,
  moreOpen,
  editor,
  onEditorClose,
}: {
  onMore: () => void;
  moreOpen: boolean;
  editor?: DockEditorState;
  onEditorClose?: () => void;
}) {
  const t = useT(SHELL_STRINGS);
  const label = useNavLabel();
  const { pathname } = useLocation();
  const morePress = usePressSwell<HTMLButtonElement>();
  const { answer, entries: tabs } = useConsoleRow("mobileNav");
  // On a page with no slot of its own, "More" is where you are.
  const moreCurrent = moreOpen || !tabs.some((tab) => onTab(pathname, tab.to));

  return (
    <nav
      aria-label={t.quickNav}
      data-slot="dock"
      className="zimos-dock fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto h-16 max-w-md rounded-[1.75rem] border border-transparent bg-paper-raised shadow-[var(--shadow-raised)] ring-1 ring-line md:hidden"
    >
      <DockLens />
      {/* Equal columns for however many slots the account has; a long label is cut short, never pushed into its neighbour. */}
      <div className="relative grid h-full auto-cols-[minmax(0,1fr)] grid-flow-col px-1">
        {tabs.map((tab) => {
          const current = onTab(pathname, tab.to);
          return (
            <DockLink
              key={tab.to}
              to={tab.to}
              icon={tab.icon}
              label={label(tab.label)}
              current={current}
              // One filled pill at a time: while the menu is open it sits on "More".
              lit={current && !moreOpen}
            />
          );
        })}
        <button
          type="button"
          onClick={onMore}
          aria-expanded={moreOpen}
          data-slot="dock-item"
          className={cn(SLOT, !moreCurrent && "hover:text-ink")}
          {...morePress}
        >
          <SlotFace icon={List} label={t.more} lit={moreCurrent} />
        </button>
      </div>
      {answer && editor && editor.opened > 0 && onEditorClose && (
        <Suspense fallback={null}>
          {/* A new key per opening: it starts from the bar as it is now. */}
          <ShortcutRowEditor key={editor.opened} open={editor.open} onClose={onEditorClose} row="mobileNav" answer={answer} />
        </Suspense>
      )}
    </nav>
  );
}

function DockLink({ to, icon, label, current, lit }: { to: string; icon: LucideIcon; label: string; current: boolean; lit: boolean }) {
  const press = usePressSwell<HTMLAnchorElement>();
  return (
    <Link
      to={to}
      aria-current={current ? "page" : undefined}
      draggable={false}
      data-slot="dock-item"
      className={cn(SLOT, !lit && "hover:text-ink")}
      {...press}
    >
      <SlotFace icon={icon} label={label} lit={lit} />
    </Link>
  );
}

/** What every slot shows: a 24px icon in its pill, the label under it. The current one is filled. */
function SlotFace({ icon: Icon, label, lit }: { icon: LucideIcon; label: string; lit: boolean }) {
  return (
    <>
      <span data-current={lit ? "" : undefined} className={cn(PILL, lit && "bg-primary text-primary-foreground")}>
        <Icon className="size-6" strokeWidth={lit ? 2.25 : 1.75} aria-hidden />
      </span>
      <span data-current={lit ? "" : undefined} className={cn(LABEL, lit && "text-primary")}>
        {label}
      </span>
    </>
  );
}

/**
 * What is behind the glass bends through a turbulence + displacement filter.
 * The filter is defined once, here; the lens layer that uses it lies behind
 * the slots and is switched on by the theme (glass/dock.css), for
 * mouse-and-hover devices only.
 */
function DockLens() {
  return (
    <>
      <svg aria-hidden focusable="false" width="0" height="0" className="pointer-events-none absolute">
        <filter id="lg-dock-distort" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves="1" seed="17" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="3" result="swell" />
          <feDisplacementMap in="SourceGraphic" in2="swell" scale="36" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <span aria-hidden className="zimos-dock-lens pointer-events-none absolute inset-0 hidden overflow-hidden rounded-[calc(1.75rem-1px)]" />
    </>
  );
}
