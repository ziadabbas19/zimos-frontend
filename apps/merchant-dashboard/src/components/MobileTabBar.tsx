import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { cn } from "@store-builder/ui";
import { IconMore, type IconComponent } from "@/components/icons";
import { ViewLink } from "@/components/ViewLink";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, getIntlLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { NAV_ITEMS, isNavItemVisible, type NavKey } from "@/lib/navigation";
import { useWorkCounts } from "@/lib/workCounts";
import { useWorkspaceId } from "@/lib/useWorkspaceId";

const STRINGS = {
  en: {
    nav: "Quick navigation",
    home: "Today",
    orders: "Orders",
    confirm: "Confirm",
    products: "Products",
    more: "More",
    waiting: "{n} waiting for a call",
    overflow: "{n}+",
  },
  ar: {
    nav: "التنقل السريع",
    home: "اليوم",
    orders: "الطلبات",
    confirm: "التأكيد",
    products: "المنتجات",
    more: "المزيد",
    waiting: "{n} في انتظار مكالمة",
    overflow: "{n}+",
  },
} satisfies Messages;

type TabKey = "home" | "orders" | "confirm" | "products";

interface Tab {
  key: TabKey;
  to: string;
  end?: boolean;
  icon: IconComponent;
}

/**
 * The dock's slots: four entries of the side menu. lib/navigation.ts gives
 * each its address, its icon and the permissions its page asks for, so a slot
 * shows only to a role that can open it (an editor has no orders slot, an
 * accountant no confirmation or products slot).
 */
const SLOTS: { key: TabKey; nav: NavKey; end?: boolean }[] = [
  { key: "home", nav: "overview", end: true },
  { key: "orders", nav: "orders" },
  { key: "confirm", nav: "confirmationQueue" },
  { key: "products", nav: "catalog" },
];

function tabsFor(permissions: readonly string[] | null | undefined): Tab[] {
  return SLOTS.flatMap((slot) => {
    const item = NAV_ITEMS.find((entry) => entry.key === slot.nav);
    if (!item || !isNavItemVisible(item, permissions)) return [];
    return [{ key: slot.key, to: item.to, end: slot.end, icon: item.icon }];
  });
}

/** The routes the dock shows for this member; the phone menu leaves them out so nothing is listed twice. */
export function tabRoutesFor(permissions: readonly string[] | null | undefined): string[] {
  return tabsFor(permissions).map((tab) => tab.to);
}

function onTab(pathname: string, tab: { to: string; end?: boolean }): boolean {
  return tab.end ? pathname === tab.to : pathname === tab.to || pathname.startsWith(`${tab.to}/`);
}

/** The badge stops counting here: "99+" says "a lot" in the room an icon corner has. */
const BADGE_MAX = 99;

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

/* One slot: at least 48 x 56px under the thumb, the icon pill above the label. */
const SLOT =
  "group/slot relative flex min-h-14 min-w-12 cursor-pointer touch-manipulation flex-col items-center justify-center gap-0.5 rounded-[1.5rem] text-ink-soft select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] transition-colors duration-[var(--dur-fade)] ease-[var(--ease-out)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none";

/* The icon's pill, 52 x 30px. It swells to 1.16 while the slot is pressed (a
   short ease in) and settles back on the house pop curve. Transform only, and
   not at all for people who asked for less motion. */
const PILL =
  "zimos-dock-pill relative flex h-[30px] w-[52px] items-center justify-center rounded-full transition-transform duration-[var(--dur-pop)] ease-[var(--ease-pop)] motion-reduce:transition-none motion-safe:group-active/slot:scale-[1.16] motion-safe:group-data-[pressed]/slot:scale-[1.16] group-active/slot:duration-[var(--dur-fade)] group-active/slot:ease-[var(--ease-out)] group-data-[pressed]/slot:duration-[var(--dur-fade)] group-data-[pressed]/slot:ease-[var(--ease-out)]";

const LABEL = "zimos-dock-label px-0.5 text-[11px] leading-[14px] font-medium whitespace-nowrap";

/**
 * The phone's Dock: the four places a merchant visits every day, under
 * the thumb, plus "More" which opens the full menu. A floating pane of glass
 * (theme/glass/dock.css), not an edge-to-edge bar; a role that has no use for a slot
 * gets fewer, equal ones. Hidden from `md` up, where the side menu is always
 * on screen.
 */
export function MobileTabBar({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const { pathname } = useLocation();
  const morePress = usePressSwell<HTMLButtonElement>();
  const tabs = tabsFor(currentWorkspace?.permissions);
  const showsConfirm = tabs.some((tab) => tab.key === "confirm");
  // Calls that are due now (not ones booked for later), from the shell's one shared poll.
  // A role with no confirm slot asks for nothing; one that can't read the queue gets null: no badge.
  const { toConfirm } = useWorkCounts(showsConfirm ? workspaceId : null);
  const waiting = toConfirm !== null && toConfirm > 0 ? toConfirm : 0;
  // On a page with no slot of its own, "More" is where you are.
  const moreCurrent = moreOpen || !tabs.some((tab) => onTab(pathname, tab));
  const label: Record<TabKey, string> = { home: t.home, orders: t.orders, confirm: t.confirm, products: t.products };

  return (
    <nav
      aria-label={t.nav}
      data-slot="dock"
      className="zimos-dock fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto h-16 max-w-md rounded-[1.75rem] border border-transparent bg-paper-raised shadow-[var(--shadow-raised)] ring-1 ring-line md:hidden"
    >
      <DockLens />
      {/* Equal columns for however many slots the role has. */}
      <div className="relative grid h-full auto-cols-fr grid-flow-col px-1">
        {tabs.map((tab) => {
          const current = onTab(pathname, tab);
          return (
            <DockLink
              key={tab.key}
              to={tab.to}
              icon={tab.icon}
              label={label[tab.key]}
              current={current}
              // One filled pill at a time: while the menu is open it sits on "More".
              lit={current && !moreOpen}
              badge={
                tab.key === "confirm" && waiting > 0
                  ? {
                      count: waiting,
                      text:
                        waiting > BADGE_MAX
                          ? fmt(t.overflow, { n: BADGE_MAX })
                          : new Intl.NumberFormat(getIntlLocale()).format(waiting),
                      label: fmt(t.waiting, { n: waiting }),
                    }
                  : undefined
              }
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
          <SlotFace icon={IconMore} label={t.more} lit={moreCurrent} />
        </button>
      </div>
    </nav>
  );
}

/**
 * A slot that goes to a page. A ViewLink, so the page's code is fetched on
 * touch-start and the change runs in a view transition; "where you are" is
 * worked out by the dock (ViewLink is a plain Link, not a NavLink).
 */
function DockLink({
  to,
  icon,
  label,
  current,
  lit,
  badge,
}: {
  to: string;
  icon: IconComponent;
  label: string;
  current: boolean;
  lit: boolean;
  badge?: { count: number; text: string; label: string };
}) {
  const press = usePressSwell<HTMLAnchorElement>();
  return (
    <ViewLink
      to={to}
      aria-current={current ? "page" : undefined}
      draggable={false}
      data-slot="dock-item"
      className={cn(SLOT, !lit && "hover:text-ink")}
      {...press}
    >
      <SlotFace
        icon={icon}
        label={label}
        lit={lit}
        // Keyed by the number: a new count is a new element, so it pops in again.
        badge={badge ? <CountBadge key={badge.count} text={badge.text} /> : undefined}
      />
      {badge && <span className="sr-only">{badge.label}</span>}
    </ViewLink>
  );
}

/** What every slot shows: a 24px icon in its pill, the label under it. The current one is filled. */
function SlotFace({ icon: Icon, label, lit, badge }: { icon: IconComponent; label: string; lit: boolean; badge?: ReactNode }) {
  return (
    <>
      <span data-current={lit ? "" : undefined} className={cn(PILL, lit && "bg-primary text-primary-foreground")}>
        <Icon className="size-6" strokeWidth={lit ? 2.25 : 1.75} aria-hidden />
        {badge}
      </span>
      <span data-current={lit ? "" : undefined} className={cn(LABEL, lit && "text-primary")}>
        {label}
      </span>
    </>
  );
}

/**
 * The count on a slot: a danger pill on the icon's top end corner, ringed in
 * the dock's own fill so it reads over the icon and over the brand pill alike.
 * Decorative: the slot says the same in words for a screen reader.
 */
function CountBadge({ text }: { text: string }) {
  return (
    <span
      aria-hidden
      className="zimos-dock-badge pointer-events-none absolute -top-1 start-1/2 ms-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-[5px] text-[10px] leading-none font-semibold text-paper-raised tabular-nums ring-2 ring-paper-raised motion-safe:animate-[dock-badge-pop_var(--dur-pop)_var(--ease-pop)_both]"
    >
      {text}
    </span>
  );
}

/**
 * The refraction of the owner's reference dock: what is behind the glass bends
 * through a turbulence + displacement filter. The filter is defined once, here;
 * the lens layer that uses it lies behind the slots and is switched on in
 * theme/glass/dock.css, for mouse-and-hover devices only (the reason is written there).
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
      <span
        aria-hidden
        className="zimos-dock-lens pointer-events-none absolute inset-0 hidden overflow-hidden rounded-[calc(1.75rem-1px)]"
      />
    </>
  );
}
