import { useEffect, useRef, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import type { PlanFeatureKey } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { StoreLinkBar } from "@/components/StoreLinkBar";
import { ViewLink } from "@/components/ViewLink";
import { ZimosLogo } from "@/components/ZimosLogo";
import { NavBadge } from "@/components/shell/NavBadge";
import { usePlaceName } from "@/components/shell/PlaceDock";
import { PlaceTile } from "@/components/shell/PlaceTile";
import { StoreSwitcher } from "@/components/shell/StoreSwitcher";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { NAV_GROUPS, NAV_LABELS, findNavItem, isNavItemVisible, isSidebarItem, sidebarHome, type NavGroup, type NavItem } from "@/lib/navigation";
import { FOOT_GROUP_ID, placeBadge, placeOf, placesFor, type Place } from "@/lib/places";
import { prefetchProps } from "@/lib/prefetch";
import { usePlanFeatures } from "@/lib/usePlanFeatures";
import { useWorkCounts, type WorkCounts } from "@/lib/workCounts";

const STRINGS = {
  en: {
    navLabel: "Main navigation",
    dashboardAria: "Zimos dashboard",
    dashboardAriaNamed: "{name} — Zimos dashboard",
  },
  ar: {
    navLabel: "القائمة الرئيسية",
    dashboardAria: "لوحة تحكم زيموس",
    dashboardAriaNamed: "{name} — لوحة تحكم زيموس",
  },
} satisfies Messages;


/**
 * A group's rows for this member. Entries their role cannot open are left out, and
 * so is anything in `skip` — the phone menu passes the dock's own pages there,
 * so nothing is listed twice — and an entry whose plan feature (NavItem.plan) is
 * `planGated` (lib/usePlanFeatures).
 */
export function visibleNavItems(
  group: NavGroup,
  permissions: readonly string[] | null | undefined,
  skip?: ReadonlySet<string>,
  planGated?: (feature: PlanFeatureKey) => boolean
): NavItem[] {
  return group.items.filter(
    (item) => isSidebarItem(item) && isNavItemVisible(item, permissions) && !skip?.has(item.to) && !(item.plan && planGated?.(item.plan))
  );
}

const ROW =
  "group/row relative flex items-center gap-2.5 rounded-full text-sm font-medium transition-[background-color,color,scale] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100";
/** Side menu: 36px with a mouse, 44px under a finger. */
const ROW_RAIL = "zimos-menu-row h-9 px-3 pointer-coarse:h-11";
/** Phone menu: a 48px tile; a long Arabic label takes a second line instead of being cut. */
const ROW_SHEET = "zimos-menu-tile min-h-12 py-1.5 ps-3.5 pe-3";

export interface NavRowProps {
  item: NavItem;
  label: string;
  /** The shell's shared counts of waiting work; the row picks its own by `item.badge`. */
  counts: WorkCounts;
  /** This row is where you are: the filled brand pill. */
  current?: boolean;
  /** `rail` — a line of the side menu. `sheet` — a tile of the phone menu. */
  variant?: "rail" | "sheet";
  onNavigate?: () => void;
}

/**
 * One destination: icon, label, and the count of work waiting there. The same
 * row draws the side menu, the pinned shortcuts and the phone menu.
 *
 * In the side menu it is a <ViewLink> (prefetch + view transition). In the
 * phone menu it is a plain prefetching <Link>: there the sheet going away
 * is the transition, and a view transition would paint the page over it.
 */
export function NavRow({ item, label, counts, current = false, variant = "rail", onNavigate }: NavRowProps) {
  const sheet = variant === "sheet";
  const Icon = item.icon;
  const className = cn(
    ROW,
    sheet ? ROW_SHEET : ROW_RAIL,
    current ? "bg-primary text-primary-foreground" : sheet ? "bg-paper-sunken text-ink" : "text-ink hover:bg-paper-sunken"
  );
  const body = (
    <>
      <Icon
        // The current row's glyph is drawn heavier, the way a filled one reads.
        strokeWidth={current ? 2.25 : 1.75}
        className={cn("shrink-0", sheet ? "size-5" : "size-[18px]", !current && "text-ink-soft group-hover/row:text-ink")}
        aria-hidden
      />
      <span className={cn("min-w-0 flex-1", sheet ? "line-clamp-2 leading-tight" : "truncate")}>{label}</span>
      {item.badge && <NavBadge kind={item.badge} count={counts[item.badge]} onBrand={current} />}
    </>
  );

  if (sheet) {
    return (
      <Link
        to={item.to}
        {...prefetchProps(item.to)}
        aria-current={current ? "page" : undefined}
        onClick={onNavigate}
        data-slot="menu-row"
        className={className}
      >
        {body}
      </Link>
    );
  }
  return (
    <ViewLink to={item.to} aria-current={current ? "page" : undefined} onClick={onNavigate} data-slot="menu-row" className={className}>
      {body}
    </ViewLink>
  );
}

/**
 * One place of the dashboard in the side menu: its tile in its colour, its
 * name, and — while you are elsewhere — the count of its most urgent waiting
 * work. It goes to the place's first page. A place of one page (Home) is that
 * page's own row, lit while you are on it.
 */
function PlaceRow({ place, name, counts, open, current }: { place: Place; name: string; counts: WorkCounts; open: boolean; current: boolean }) {
  const badge = open ? null : placeBadge(place, counts);
  return (
    <ViewLink
      to={place.to}
      aria-current={current ? "page" : undefined}
      data-slot="place-row"
      data-place={place.id}
      data-open={open ? "" : undefined}
      className={cn(
        ROW,
        "zimos-place-row h-9 ps-1.5 pe-3 pointer-coarse:h-11",
        current ? "bg-primary text-primary-foreground" : open ? "font-semibold text-ink" : "text-ink hover:bg-paper-sunken"
      )}
    >
      <PlaceTile place={place.id} onBrand={current} className="size-[26px]" />
      <span className="zimos-place-name min-w-0 flex-1 truncate">{name}</span>
      {badge && <NavBadge kind={badge.kind} count={badge.count} />}
    </ViewLink>
  );
}

/**
 * The side menu's contents: the ZIMOS logo, the store being worked on, the
 * pinned shortcuts, then the dashboard's places in their order, each beside
 * its coloured tile (the same tiles as the dock under the page). The place
 * you are in is open under its name with its pages; the others are one row
 * each, so the menu stays short and says where you are at a glance. Under a
 * hairline at the bottom, the group that must always be in reach (My Plan,
 * Settings, support). The entries, their order and who sees each one come
 * from lib/navigation.ts. `shortcuts` is the pinned group (SidebarShortcuts),
 * passed in by the layout.
 */
export function SidebarNav({ shortcuts }: { shortcuts?: ReactNode }) {
  const { currentWorkspace } = useWorkspace();
  const location = useLocation();
  const t = useT(STRINGS);
  const navLabels = useT(NAV_LABELS);
  const placeName = usePlaceName();
  const counts = useWorkCounts(currentWorkspace?.id);
  const storeName = currentWorkspace?.name;
  const permissions = currentWorkspace?.permissions;
  const plan = usePlanFeatures();

  // One entry is "here": the page's own, or the entry the page sits under (NavItem.under).
  // Same longest-match rule as the breadcrumb.
  const activeTo = sidebarHome(findNavItem(location.pathname));
  const here = placeOf(location.pathname);
  const places = placesFor(permissions, plan.gated);

  // The list is longer than the pane: bring the current row into view when the page changes.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scroller = scrollRef.current;
    const current = scroller?.querySelector<HTMLElement>('a[aria-current="page"]');
    if (!scroller || !current) return;
    const pane = scroller.getBoundingClientRect();
    const at = current.getBoundingClientRect();
    if (at.top < pane.top + 12) scroller.scrollTop -= pane.top + 12 - at.top;
    else if (at.bottom > pane.bottom - 24) scroller.scrollTop += at.bottom - (pane.bottom - 24);
  }, [activeTo]);

  const row = (item: NavItem) => (
    <NavRow key={item.to} item={item} label={navLabels[item.key]} counts={counts} current={item.to === activeTo} />
  );

  const footGroup = NAV_GROUPS.find((group) => group.id === FOOT_GROUP_ID);
  const footItems = footGroup ? visibleNavItems(footGroup, permissions, undefined, plan.gated) : [];

  return (
    <>
      <div className="shrink-0 px-2.5 pt-3">
        <ViewLink
          to="/"
          className="flex h-10 items-center rounded-full px-3 transition-opacity hover:opacity-80 motion-reduce:transition-none"
          aria-label={storeName ? fmt(t.dashboardAriaNamed, { name: storeName }) : t.dashboardAria}
        >
          <ZimosLogo height={22} />
        </ViewLink>
        <StoreSwitcher className="mt-1.5" />
        {/* From lg up the store's link is in the toolbar. */}
        {currentWorkspace?.slug && <StoreLinkBar slug={currentWorkspace.slug} className="mt-1.5 lg:hidden" />}
      </div>

      {/* On a short window the last group scrolls with the list instead of standing under it:
          it is longer here than the pane has room to keep in view. */}
      <nav aria-label={t.navLabel} className="mt-1 flex min-h-0 flex-1 flex-col [@media(max-height:52rem)]:overflow-y-auto [@media(max-height:52rem)]:[scrollbar-width:none]">
        {/* No scrollbar is drawn (it would take a strip off the rows on Windows and leave
            the pinned group wider than the list); the list fades out at both ends instead. */}
        <div
          ref={scrollRef}
          className="zimos-menu-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 pt-2.5 pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [@media(max-height:52rem)]:flex-none [@media(max-height:52rem)]:overflow-visible"
        >
          {shortcuts}
          <div className="flex flex-col gap-0.5">
            {places.map((place) => {
              const open = place.id === here;
              // Home is one page: its row is the page's own.
              const single = place.items.length === 1 && place.group.labelKey === null;
              return (
                <div key={place.id}>
                  <PlaceRow place={place} name={placeName(place)} counts={counts} open={open} current={single && place.to === activeTo} />
                  {open && !single && (
                    <div id={`zimos-nav-${place.id}`} data-reveal="" className="mt-0.5 mb-2 ms-[1.4rem] flex flex-col gap-0.5 border-s border-line ps-2">
                      {place.items.map(row)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {footItems.length > 0 && (
          <div className="zimos-menu-foot shrink-0 border-t border-line px-2.5 pt-2 pb-2.5">
            <div className="flex flex-col gap-0.5">{footItems.map(row)}</div>
          </div>
        )}
      </nav>
    </>
  );
}
