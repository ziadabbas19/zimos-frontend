import { Outlet, useLocation } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { IconSidebar } from "@/components/icons";
import { FOCUS_TOGGLE_EVENT, KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { AccessBanner } from "@/components/AccessBanner";
import { BalanceWidget } from "@/components/OrdersLock";
import { EmailConfirmBanner } from "@/components/EmailConfirmBanner";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { StoreLinkBar } from "@/components/StoreLinkBar";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { NotificationsBell } from "@/components/NotificationsBell";
import { CommandPalette } from "@/components/CommandPalette";
import { SidebarShortcuts } from "@/components/SidebarShortcuts";
import { MobileTabBar } from "@/components/MobileTabBar";
import { OverlayRoot } from "@/components/overlayRoot";
import { AccountMenu } from "@/components/shell/AccountMenu";
import { Breadcrumbs } from "@/components/shell/Breadcrumbs";
import { PhoneMenu } from "@/components/shell/PhoneMenu";
import { SidebarNav } from "@/components/shell/SidebarNav";
import { useScrollRestoration } from "@/lib/scrollRestore";

const STRINGS = {
  en: {
    hideMenu: "Hide the side menu",
    showMenu: "Show the side menu",
    toolbar: "Toolbar",
  },
  ar: {
    hideMenu: "إخفاء القائمة الجانبية",
    showMenu: "إظهار القائمة الجانبية",
    toolbar: "شريط الأدوات",
  },
} satisfies Messages;

const SIDE_MENU_ID = "zimos-side-menu";

/**
 * The dashboard's frame, three glass panes over the backdrop (`.glass-app`;
 * the material is in theme/liquid-glass.css and theme/glass/menu.css):
 *
 *   - the side menu (components/shell/SidebarNav.tsx), from `md` up;
 *   - the toolbar: hide/show the side menu, where you are, then search, the
 *     store's link, the language, light or dark, alerts and the account;
 *   - the page.
 *
 * On a phone the side menu is the dock (components/MobileTabBar.tsx) and,
 * behind its last slot, the whole menu as a sheet (components/shell/PhoneMenu.tsx).
 */
export function DashboardLayout() {
  const { currentWorkspace } = useWorkspace();
  // Going back lands where the page was left; a new page starts at the top.
  useScrollRestoration();
  const location = useLocation();
  const t = useT(STRINGS);

  // Full screen: the side menu steps aside so the page has the whole width.
  const [focus, setFocus] = useState(() => {
    try {
      return localStorage.getItem("zimos.focus") === "on";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("zimos.focus", focus ? "on" : "off");
    } catch {
      /* private mode — non-fatal */
    }
  }, [focus]);
  const toggleFocus = useCallback(() => setFocus((on) => !on), []);
  useEffect(() => {
    window.addEventListener(FOCUS_TOGGLE_EVENT, toggleFocus);
    return () => window.removeEventListener(FOCUS_TOGGLE_EVENT, toggleFocus);
  }, [toggleFocus]);

  const [mobileOpen, setMobileOpen] = useState(false);
  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // The tab names the store being worked on, not the product — a merchant with
  // several stores open in several tabs can tell them apart. Falls back to the
  // product name until the workspace list resolves.
  const storeName = currentWorkspace?.name;
  useEffect(() => {
    document.title = storeName ? `${storeName} — Dashboard` : "Zimos — Merchant Dashboard";
  }, [storeName]);

  // A menu left open across navigation would cover the page it just opened.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="glass-app flex min-h-screen" data-focus={focus ? "on" : undefined}>
      <KeyboardShortcuts />
      <aside
        id={SIDE_MENU_ID}
        data-slot="side-menu"
        className="zimos-glass zimos-glass-panel glass-nav zimos-menu sticky top-3 my-3 ms-3 hidden h-[calc(100dvh-1.5rem)] w-[248px] shrink-0 md:flex md:flex-col"
      >
        <SidebarNav shortcuts={<SidebarShortcuts />} />
      </aside>

      {/* Below `md` the side menu is hidden: the dock is the navigation, and its
          last slot opens the whole menu as a sheet. */}
      <PhoneMenu open={mobileOpen} onClose={closeMobile} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          data-slot="toolbar"
          aria-label={t.toolbar}
          className="zimos-glass glass-nav glass-topbar zimos-toolbar sticky top-0 z-30 flex h-14 items-center gap-2 ps-4 pe-1.5 md:top-3 md:mx-3 md:mt-3 md:gap-3 md:px-[9px]"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {/* Phones open the menu from "More" in the dock; one way in, not two. */}
            <button
              type="button"
              onClick={toggleFocus}
              aria-expanded={!focus}
              aria-controls={SIDE_MENU_ID}
              aria-label={focus ? t.showMenu : t.hideMenu}
              title={focus ? t.showMenu : t.hideMenu}
              className="zimos-tool hidden size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[background-color,color,scale] duration-150 hover:bg-paper-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 md:inline-flex pointer-coarse:size-11"
            >
              {/* The glyph's panel is on the side the menu is on: mirrored in Arabic. */}
              <IconSidebar className="size-5 rtl:-scale-x-100" aria-hidden />
            </button>
            <Breadcrumbs />
          </div>

          <div className="flex shrink-0 items-center gap-1 md:gap-1.5">
            {/* Search, the store's link, the language, light or dark, alerts and the account.
                On a phone the language and the theme are in the menu sheet and in Settings. */}
            {/* The pay-per-order balance and the orders it still covers, on every page (locked orders on). */}
            <BalanceWidget />
            <CommandPalette />
            {currentWorkspace?.slug && <StoreLinkBar slug={currentWorkspace.slug} className="hidden lg:flex" />}
            {/* Arabic / English, flipping the whole dashboard between RTL and LTR. */}
            <LanguageSwitch compact className="hidden md:inline-flex" />
            {/* The toggle sets its own display, so the wrapper is what hides it on a phone. */}
            <span className="hidden md:contents">
              <ThemeToggle />
            </span>
            <NotificationsBell />
            <AccountMenu />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          {/* The account's email still to confirm. */}
          <EmailConfirmBanner />
          {/* Subscription expiring / expired, or the store suspended. */}
          <AccessBanner />
          {/* One crashing page shows an error here; the side menu and the
              toolbar stay up so the merchant can move on. */}
          <RouteErrorBoundary resetKey={location.pathname}>
            {/* Settles in when moving between sections; centres the page column (index.css). */}
            <div key={location.pathname.split("/")[1] ?? ""} className="page-in">
              <Outlet />
            </div>
          </RouteErrorBoundary>
          <OverlayRoot />
        </main>
      </div>
      <MobileTabBar onMore={openMobile} moreOpen={mobileOpen} />
    </div>
  );
}
