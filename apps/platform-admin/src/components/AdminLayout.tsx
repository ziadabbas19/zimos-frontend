import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { PanelLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { LanguageToggle } from "@/components/LanguageToggle";
import { OverlayRoot } from "@/components/overlayRoot";
import { AccountMenu } from "@/components/shell/AccountMenu";
import { Breadcrumbs } from "@/components/shell/Breadcrumbs";
import { Dock, type DockEditorState } from "@/components/shell/Dock";
import { HomeShortcuts } from "@/components/HomeShortcuts";
import { PushBridge } from "@/components/push/PushBridge";
import { PushPrompt } from "@/components/push/PushPrompt";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { PhoneMenu } from "@/components/shell/PhoneMenu";
import { SidebarNav } from "@/components/shell/SidebarNav";
import { useT } from "@/i18n/LocaleContext";
import { SHELL_STRINGS } from "@/lib/shellStrings";
import { P } from "@/lib/permissions";
import { useLandingPath } from "@/lib/nav";

const SIDE_MENU_ID = "zimos-side-menu";
/** Whether the side menu is hidden, kept on this device (the merchant dashboard's key). */
const FOCUS_KEY = "zimos.focus";

/**
 * The console's frame — the merchant dashboard's own (its DashboardLayout):
 * three glass panes over the backdrop (`.glass-app`; the material is the
 * shared theme in packages/ui/src/theme):
 *
 *   - the side menu (components/shell/SidebarNav.tsx), from `md` up;
 *   - the toolbar: hide/show the side menu, where you are, then the workspace
 *     search, the language, light or dark, alerts and the account;
 *   - the page.
 *
 * On a phone the side menu is the dock (components/shell/Dock.tsx) and, behind
 * its last slot, the whole menu as a sheet (components/shell/PhoneMenu.tsx).
 */
export function AdminLayout() {
  const t = useT(SHELL_STRINGS);
  const location = useLocation();
  const { can } = useAuth();

  // Full width: the side menu steps aside so the page has the whole screen.
  const [focus, setFocus] = useState(() => {
    try {
      return localStorage.getItem(FOCUS_KEY) === "on";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(FOCUS_KEY, focus ? "on" : "off");
    } catch {
      /* private mode — non-fatal */
    }
  }, [focus]);
  const toggleFocus = useCallback(() => setFocus((on) => !on), []);

  const [mobileOpen, setMobileOpen] = useState(false);
  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  // The bottom bar's editor, opened from the phone menu, which steps aside for it.
  const [dockEditor, setDockEditor] = useState<DockEditorState>({ open: false, opened: 0 });
  const customizeDock = useCallback(() => {
    setMobileOpen(false);
    setDockEditor((current) => ({ open: true, opened: current.opened + 1 }));
  }, []);
  const closeDockEditor = useCallback(() => setDockEditor((current) => ({ ...current, open: false })), []);
  // The account's first page (Overview, or the first section it opens): where the
  // offer of device notifications and its shortcuts row sit, as on the dashboard's Home.
  const landing = useLandingPath();
  const onLanding = landing !== null && location.pathname === landing;

  // A menu left open across navigation would cover the page it just opened.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // The environment badge shows only on a build labelled as a non-production
  // one; unset (or anything else) shows none.
  const appEnv = import.meta.env.VITE_APP_ENV;
  const envLabel = appEnv === "staging" ? t.staging : appEnv === "development" ? t.development : null;

  return (
    <div className="glass-app flex min-h-screen" data-focus={focus ? "on" : undefined}>
      <aside
        id={SIDE_MENU_ID}
        data-slot="side-menu"
        className="zimos-glass zimos-glass-panel glass-nav zimos-menu sticky top-3 my-3 ms-3 hidden h-[calc(100dvh-1.5rem)] w-[248px] shrink-0 md:flex md:flex-col"
      >
        <SidebarNav />
      </aside>

      {/* Below `md` the side menu is hidden: the dock is the navigation, and its
          last slot opens the whole menu as a sheet. */}
      <PhoneMenu open={mobileOpen} onClose={closeMobile} onCustomizeDock={customizeDock} />
      {/* Device notifications: this browser's subscription kept in step, and a clicked one opening its page. */}
      <PushBridge />

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
              <PanelLeft className="size-5 rtl:-scale-x-100" aria-hidden />
            </button>
            <Breadcrumbs />
          </div>

          <div className="flex shrink-0 items-center gap-1 md:gap-1.5">
            {/* Workspace search reads the workspace and subscription lists. */}
            {can(P.WORKSPACES_VIEW) && <GlobalSearch />}
            {envLabel && (
              <span
                className="hidden items-center gap-1.5 rounded-full border border-accent/25 bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-dark sm:inline-flex"
                title={t.environment}
              >
                <span className="size-1.5 rounded-full bg-accent" aria-hidden />
                {envLabel}
              </span>
            )}
            {/* Arabic / English, flipping the whole console between RTL and LTR.
                On a phone the language and the theme are in the menu sheet and in the account menu. */}
            <LanguageToggle compact className="hidden md:inline-flex" />
            {/* The toggle sets its own display, so the wrapper is what hides it on a phone. */}
            <span className="hidden md:contents">
              <ThemeToggle />
            </span>
            {/* Any console account's: the API tells each only what its permissions open. */}
            <NotificationBell />
            <AccountMenu />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          {/* Settles in when moving between sections; the theme centres the page column. */}
          <div key={location.pathname.split("/")[1] ?? ""} className="page-in">
            <div className="mx-auto w-full max-w-7xl">
              {onLanding && (
                <>
                  <PushPrompt className="mb-4" />
                  <HomeShortcuts className="mb-6" />
                </>
              )}
              <Outlet />
            </div>
          </div>
          <OverlayRoot />
        </main>
      </div>
      <Dock onMore={openMobile} moreOpen={mobileOpen} editor={dockEditor} onEditorClose={closeDockEditor} />
    </div>
  );
}
