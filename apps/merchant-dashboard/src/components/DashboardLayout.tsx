import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { cn } from "@store-builder/ui";
import { NAV_GROUPS, NAV_GROUP_LABELS, NAV_LABELS, findNavItem } from "@/lib/navigation";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { StoreLinkBar } from "@/components/StoreLinkBar";
import { ZimosLogo } from "@/components/ZimosLogo";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";

const STRINGS = {
  en: {
    signOut: "Sign out",
    selectStore: "Select a store",
    newStore: "+ New store",
    openNav: "Open navigation",
    closeNav: "Close navigation",
    navLabel: "Main navigation",
    dashboardAria: "Zimos dashboard",
    dashboardAriaNamed: "{name} — Zimos dashboard",
    switchStore: "Switch store",
    collapseGroup: "Collapse {group}",
    expandGroup: "Expand {group}",
  },
  ar: {
    signOut: "تسجيل الخروج",
    selectStore: "اختر متجرًا",
    newStore: "+ متجر جديد",
    openNav: "فتح القائمة",
    closeNav: "إغلاق القائمة",
    navLabel: "القائمة الرئيسية",
    dashboardAria: "لوحة تحكم زيموس",
    dashboardAriaNamed: "{name} — لوحة تحكم زيموس",
    switchStore: "تبديل المتجر",
    collapseGroup: "طي {group}",
    expandGroup: "توسيع {group}",
  },
} satisfies Messages;

const NAV_COLLAPSED_KEY = "zimos.nav.groups.collapsed";

function readCollapsedGroups(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(NAV_COLLAPSED_KEY);
    if (raw) return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    /* private mode or malformed — fall through to every group open */
  }
  return {};
}

/**
 * Sidebar body — rendered twice: once in the desktop rail and once inside the
 * mobile drawer. `onNavigate` lets the drawer close itself when a link is
 * followed. Same approach as the platform-admin console.
 */
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { logout } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const location = useLocation();
  const t = useT(STRINGS);
  const navLabels = useT(NAV_LABELS);
  const groupLabels = useT(NAV_GROUP_LABELS);
  const storeName = currentWorkspace?.name;

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(readCollapsedGroups);
  useEffect(() => {
    try {
      localStorage.setItem(NAV_COLLAPSED_KEY, JSON.stringify(collapsed));
    } catch {
      /* private mode — non-fatal */
    }
  }, [collapsed]);

  // Collapsing a group hides everything in it except the page you are on, so
  // the sidebar never loses track of where you are.
  const activeTo = findNavItem(location.pathname)?.to;

  return (
    <>
      <div className="px-5 py-5">
        <Link
          to="/"
          onClick={onNavigate}
          className="block transition-opacity hover:opacity-80"
          aria-label={storeName ? fmt(t.dashboardAriaNamed, { name: storeName }) : t.dashboardAria}
        >
          <ZimosLogo height={26} />
          {storeName && (
            <span className="mt-2 block truncate text-sm font-medium text-ink-soft">
              {storeName}
            </span>
          )}
        </Link>
      </div>
      <nav aria-label={t.navLabel} className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group, index) => {
          const heading = group.labelKey ? groupLabels[group.labelKey] : null;
          const isClosed = Boolean(collapsed[group.id]);
          const items = isClosed ? group.items.filter((i) => i.to === activeTo) : group.items;

          return (
            <div key={group.id} className={cn(index > 0 && "mt-4")}>
              {heading && (
                <button
                  type="button"
                  onClick={() => setCollapsed((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
                  aria-expanded={!isClosed}
                  aria-label={fmt(isClosed ? t.expandGroup : t.collapseGroup, { group: heading })}
                  className="mb-1 flex w-full cursor-pointer items-center gap-1.5 rounded-md px-3 py-1 text-[11px] font-semibold tracking-wider text-ink-soft uppercase transition-colors hover:text-ink rtl:tracking-normal"
                >
                  <span className="flex-1 text-start">{heading}</span>
                  <ChevronDown
                    className={cn("size-3.5 transition-transform", isClosed && "-rotate-90 rtl:rotate-90")}
                    aria-hidden
                  />
                </button>
              )}
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      // Dark primary-dark stays deep (white text sits on it elsewhere),
                      // so on primary-soft it is ~3:1; the lifted primary holds 4.5:1.
                      cn(
                        "relative flex items-center gap-2.5 rounded-[0.5rem] px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-primary-soft hover:text-primary-dark dark:hover:text-primary",
                        isActive && "bg-primary-soft text-primary-dark dark:text-primary"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span
                            aria-hidden
                            className="absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-primary"
                          />
                        )}
                        <item.icon className="size-[18px] shrink-0" aria-hidden />
                        <span className="min-w-0 truncate">{navLabels[item.key]}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="flex items-center gap-2 border-t border-line px-3 py-4">
        <button
          onClick={() => logout()}
          className="cursor-pointer flex-1 rounded-[0.5rem] px-3 py-2 text-start text-sm font-medium text-ink-soft hover:bg-danger-soft hover:text-danger"
        >
          {t.signOut}
        </button>
        <ThemeToggle />
      </div>
    </>
  );
}

export function DashboardLayout() {
  const { user } = useAuth();
  const { currentWorkspace, workspaces, selectWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT(STRINGS);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // The tab names the store being worked on, not the product — a merchant with
  // several stores open in several tabs can tell them apart. Falls back to the
  // product name until the workspace list resolves.
  const storeName = currentWorkspace?.name;
  useEffect(() => {
    document.title = storeName ? `${storeName} — Dashboard` : "Zimos — Merchant Dashboard";
  }, [storeName]);

  // A drawer left open across navigation would cover the page it just opened.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="hidden w-60 shrink-0 border-e border-line bg-paper-raised md:flex md:flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile drawer — below `md` the rail above is hidden, so without this
          the dashboard has no navigation at all on a phone. */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-primary-dark/40 md:hidden dark:bg-black/60"
          onMouseDown={() => setMobileOpen(false)}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={t.navLabel}
            onMouseDown={(e) => e.stopPropagation()}
            className="animate-slide-in-start absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-e border-line bg-paper-raised shadow-lg"
          >
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label={t.closeNav}
              className="absolute end-3 top-4 cursor-pointer rounded-md p-1 text-ink-soft hover:bg-primary-soft hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-2 border-b border-line bg-paper-raised px-4 sm:gap-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label={t.openNav}
              aria-expanded={mobileOpen}
              className="-ms-1 shrink-0 cursor-pointer rounded-md p-2 text-ink-soft hover:bg-primary-soft hover:text-ink md:hidden"
            >
              <Menu className="size-5" aria-hidden />
            </button>

            <div className="relative max-w-[40vw] shrink-0 sm:max-w-none">
              <button
                onClick={() => setSwitcherOpen((v) => !v)}
                aria-label={t.switchStore}
                aria-expanded={switcherOpen}
                className="cursor-pointer flex items-center gap-2 rounded-[0.5rem] px-2 py-1.5 text-sm font-medium text-ink hover:bg-paper"
              >
                <span className="truncate">{currentWorkspace?.name ?? t.selectStore}</span>
                <span className="text-ink-soft" aria-hidden>
                  ▾
                </span>
              </button>
              {switcherOpen && (
                <div className="absolute start-0 top-full z-20 mt-1 w-64 rounded-[0.5rem] border border-line bg-paper-raised py-1 shadow-lg">
                  {workspaces.map((workspace) => (
                    <button
                      key={workspace.id}
                      onClick={() => {
                        selectWorkspace(workspace.id);
                        setSwitcherOpen(false);
                      }}
                      className={cn(
                        "block w-full cursor-pointer px-3 py-2 text-start text-sm hover:bg-primary-soft",
                        workspace.id === currentWorkspace?.id &&
                          "font-medium text-primary-dark dark:text-primary"
                      )}
                    >
                      {workspace.name}
                    </button>
                  ))}
                  <div className="my-1 border-t border-line" />
                  <button
                    onClick={() => {
                      setSwitcherOpen(false);
                      navigate("/workspaces");
                    }}
                    className="cursor-pointer block w-full px-3 py-2 text-start text-sm text-primary hover:bg-primary-soft"
                  >
                    {t.newStore}
                  </button>
                </div>
              )}
            </div>

            {/* The store's public link, beside the store it belongs to: on every
                page, and it changes with the switcher above. */}
            {currentWorkspace?.slug && <StoreLinkBar slug={currentWorkspace.slug} />}
          </div>

          <div className="flex shrink-0 items-center gap-2 text-sm text-ink-soft sm:gap-3">
            {/* Dashboard-wide locale switch. Lives in the header (not the
                sidebar footer beside ThemeToggle) so it stays reachable on
                mobile, where the sidebar collapses into the drawer. */}
            <LanguageSwitch className="hidden sm:inline-flex" />
            <LanguageSwitch compact className="sm:hidden" />
            <span className="hidden sm:inline">{user?.fullName ?? user?.email}</span>
            <div className="flex size-8 items-center justify-center rounded-full bg-primary-soft font-medium text-primary-dark dark:text-primary">
              {(user?.fullName ?? user?.email ?? "?").charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          {/* One crashing page shows an error here; the sidebar and header
              stay up so the merchant can move on. */}
          <RouteErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </RouteErrorBoundary>
        </main>
      </div>
    </div>
  );
}
