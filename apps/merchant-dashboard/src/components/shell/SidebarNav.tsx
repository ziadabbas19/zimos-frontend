import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@store-builder/ui";
import { IconCaretDown } from "@/components/icons";
import { StoreLinkBar } from "@/components/StoreLinkBar";
import { ViewLink } from "@/components/ViewLink";
import { ZimosLogo } from "@/components/ZimosLogo";
import { NavBadge } from "@/components/shell/NavBadge";
import { StoreSwitcher } from "@/components/shell/StoreSwitcher";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import {
  NAV_GROUPS,
  NAV_GROUP_LABELS,
  NAV_LABELS,
  NAV_OPEN_BY_DEFAULT,
  findNavItem,
  isNavItemVisible,
  isSidebarItem,
  sidebarHome,
  type NavGroup,
  type NavItem,
} from "@/lib/navigation";
import { prefetchProps } from "@/lib/prefetch";
import { useWorkCounts, type WorkCounts } from "@/lib/workCounts";

const STRINGS = {
  en: {
    navLabel: "Main navigation",
    dashboardAria: "Zimos dashboard",
    dashboardAriaNamed: "{name} — Zimos dashboard",
    collapseGroup: "Collapse {group}",
    expandGroup: "Expand {group}",
  },
  ar: {
    navLabel: "القائمة الرئيسية",
    dashboardAria: "لوحة تحكم زيموس",
    dashboardAriaNamed: "{name} — لوحة تحكم زيموس",
    collapseGroup: "طي {group}",
    expandGroup: "توسيع {group}",
  },
} satisfies Messages;

const NAV_COLLAPSED_KEY = "zimos.nav.groups.collapsed.v2";
/** The unheaded last group (My Plan, Settings, support…): under the list, always in reach. */
const FOOT_GROUP_ID = "config";

function readCollapsedGroups(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(NAV_COLLAPSED_KEY);
    if (raw) return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    /* private mode or malformed — fall through to the default below */
  }
  return Object.fromEntries(NAV_GROUPS.filter((group) => !NAV_OPEN_BY_DEFAULT.has(group.id)).map((group) => [group.id, true]));
}

/**
 * A group's rows for this role. Entries the role cannot use are left out, and
 * so is anything in `skip` — the phone menu passes the dock's own pages there,
 * so nothing is listed twice.
 */
export function visibleNavItems(group: NavGroup, role: string | null | undefined, skip?: ReadonlySet<string>): NavItem[] {
  return group.items.filter((item) => isSidebarItem(item) && isNavItemVisible(item, role) && !skip?.has(item.to));
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
 * The side menu's contents: the ZIMOS logo, the store being worked on, then
 * the list — pinned shortcuts first, then the groups — and, under a hairline
 * at the bottom, the group that must always be in reach (My Plan, Settings,
 * support). The entries, their order and who sees each one come from
 * lib/navigation.ts.
 *
 * A group folds from its heading and stays folded next time; a folded group
 * still shows the row of the page you are on, so the menu never loses track
 * of where you are. `shortcuts` is the pinned group (SidebarShortcuts), passed
 * in by the layout.
 */
export function SidebarNav({ shortcuts }: { shortcuts?: ReactNode }) {
  const { currentWorkspace } = useWorkspace();
  const location = useLocation();
  const t = useT(STRINGS);
  const navLabels = useT(NAV_LABELS);
  const groupLabels = useT(NAV_GROUP_LABELS);
  const counts = useWorkCounts(currentWorkspace?.id);
  const storeName = currentWorkspace?.name;
  const role = currentWorkspace?.role;

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(readCollapsedGroups);
  useEffect(() => {
    try {
      localStorage.setItem(NAV_COLLAPSED_KEY, JSON.stringify(collapsed));
    } catch {
      /* private mode — non-fatal */
    }
  }, [collapsed]);
  // The group that was just unfolded: its rows settle in (theme/glass/menu.css).
  const [revealed, setRevealed] = useState<string | null>(null);

  // One entry is "here": the page's own, or the entry the page sits under (NavItem.under).
  // Same longest-match rule as the breadcrumb.
  const activeTo = sidebarHome(findNavItem(location.pathname));

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

  function toggle(groupId: string) {
    setRevealed(collapsed[groupId] ? groupId : null);
    setCollapsed((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }

  const row = (item: NavItem) => (
    <NavRow key={item.to} item={item} label={navLabels[item.key]} counts={counts} current={item.to === activeTo} />
  );

  const footGroup = NAV_GROUPS.find((group) => group.id === FOOT_GROUP_ID);
  const footItems = footGroup ? visibleNavItems(footGroup, role) : [];

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
          {NAV_GROUPS.map((group) => {
            if (group.id === FOOT_GROUP_ID) return null;
            const heading = group.labelKey ? groupLabels[group.labelKey] : null;
            // A group without a heading has nothing to click, so it is never folded away.
            const isClosed = Boolean(heading && collapsed[group.id]);
            // Entries this role cannot use are left out; a group left empty goes too.
            const visible = visibleNavItems(group, role);
            if (visible.length === 0) return null;
            // Folding hides everything in the group except the page you are on.
            const items = isClosed ? visible.filter((item) => item.to === activeTo) : visible;
            const rowsId = `zimos-nav-${group.id}`;

            return (
              <div key={group.id} className="mt-3 first:mt-0">
                {heading && (
                  <button
                    type="button"
                    onClick={() => toggle(group.id)}
                    aria-expanded={!isClosed}
                    aria-controls={rowsId}
                    aria-label={fmt(isClosed ? t.expandGroup : t.collapseGroup, { group: heading })}
                    className="zimos-menu-heading group/heading flex h-7 w-full cursor-pointer items-center gap-1 rounded-full ps-3 pe-2 text-start text-[12px] font-semibold text-primary transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none pointer-coarse:h-11"
                  >
                    <span className="min-w-0 flex-1 truncate">{heading}</span>
                    {/* The caret shows when the heading is pointed at or focused. A finger has
                        no hover, and a folded group has to say there is more inside. */}
                    <IconCaretDown
                      className={cn(
                        "size-3 shrink-0 transition-[opacity,rotate] duration-150 motion-reduce:transition-none pointer-coarse:opacity-100",
                        isClosed
                          ? "-rotate-90 opacity-70 rtl:rotate-90"
                          : "opacity-0 group-hover/heading:opacity-100 group-focus-visible/heading:opacity-100"
                      )}
                      aria-hidden
                    />
                  </button>
                )}
                <div id={rowsId} data-reveal={revealed === group.id ? "" : undefined} className="flex flex-col gap-0.5">
                  {items.map(row)}
                </div>
              </div>
            );
          })}
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
