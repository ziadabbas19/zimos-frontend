"use client";

import type { StorefrontMeta } from "@store-builder/api-client";
import { StoreLink } from "@/components/StoreRoute";
import { ZimosLogo } from "@/components/ZimosLogo";
import { AccountHeaderLink, useAccountMenuLink } from "@/components/account/AccountHeaderLink";
import { brandingRemoved } from "@/components/PoweredByZimos";
import { getDictionary, type Locale } from "@/lib/i18n";
import { hasSideNav } from "@/lib/storeNav";
import { useStoreShell } from "@/lib/StoreShellContext";
import type { LogoSize, ResolvedShellLink } from "@/lib/storeShell";
import { AnnouncementBar } from "./AnnouncementBar";
import { CartIcon } from "./CartIcon";
import { LanguageSwitch } from "./LanguageSwitch";
import { MobileMenu } from "./MobileMenu";
import { SearchBox } from "./SearchBox";
import { headerMenuOf } from "./shell/headerMenu";
import { NavDropdown } from "./shell/NavDropdown";
import { ShellLink } from "./ShellLink";
import { StickyHeader } from "./StickyHeader";
import { StoreImage } from "./StoreImage";
import { ThemeToggle } from "./ThemeToggle";
import { container } from "./ui";

/**
 * The store's masthead, rendered once by the store layout for every page — so a
 * page the merchant built in the website editor ("About us") sits under the
 * same branding and keeps the cart within reach instead of looking orphaned.
 *
 * It carries the merchant's identity — their logo when they have uploaded one,
 * and their name either way. A store that has not uploaded a logo yet falls
 * back to the ZIMOS lockup, which is otherwise confined to the footer's
 * "Powered by" line.
 *
 * Above it, only when the store payload carries one, the merchant's
 * announcement line. The shell (StickyHeader) adds a shadow and trims the bar
 * once the page scrolls under it; on a phone the links move into a sheet.
 *
 * StickyHeader can also draw the bar transparent over a home-page hero; that
 * look is not switched on here. A store's first section is whatever the
 * merchant put there, and light text over a light section would be
 * unreadable, so the bar stays solid everywhere.
 *
 * What the merchant can change — their own menu links, the logo's size and
 * placement, which controls show, whether the bar sticks — comes from
 * `themeSettings.header` (lib/storeShell.ts), read through useStoreShell so
 * the editor's preview can show unsaved changes. Every default is the header
 * as it was before those settings existed, down to the markup.
 *
 * A store that chose the side navigation (lib/storeNav) keeps this bar up to
 * `xl` and hands over to the column beside the page from there
 * (shell/StoreSideNav): the bar's rows are hidden from `xl`, and only the
 * announcement line, if there is one, stays across the top of the page.
 */

/** Whole class strings per logo size — Tailwind can't build them at runtime. `md` is the original look. */
const LOGO_IMG_CLASS: Record<LogoSize, string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
};
const LOGO_IMG_PX: Record<LogoSize, number> = { sm: 32, md: 40, lg: 48 };
const LOGO_MARK_PX: Record<LogoSize, number> = { sm: 26, md: 32, lg: 40 };
const LOGO_NAME_CLASS: Record<LogoSize, string> = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-xl",
};

/** An inline header link, hidden until its breakpoint class adds `…:inline-flex`. */
const NAV_LINK =
  "zt-nav-link hidden min-h-11 items-center rounded-xl px-3 text-sm font-medium text-ink-soft transition-colors hover:bg-primary-soft hover:text-primary group-data-[overlay]/header:text-white group-data-[overlay]/header:hover:bg-white/10 group-data-[overlay]/header:hover:text-white";

export function StoreHeader({ store, locale }: { store: StorefrontMeta; locale: Locale }) {
  const t = getDictionary(locale);
  const { header, announcement } = useStoreShell(store);
  const size = header.logoSize;
  const centred = header.logoAlign === "center";

  // The side navigation takes over from `xl`: this class hides a row of the bar from there.
  const wide = hasSideNav(header) ? " xl:hidden" : "";

  // The merchant's own menu, when they wrote one. Wide screens show it inline
  // from `md` (it can be several links long) and phones in the menu sheet,
  // which therefore stays available up to `md` instead of `sm`.
  // Pages and collections flagged "show in header" join it; a menu link may
  // open a list under it (shell/NavDropdown): `menu[i].children`.
  const { menu, children } = headerMenuOf(store, header, t.common);
  const menuLinks = menu?.map((link) => {
    const items = children.get(Number(link.key.split(":")[0]));
    return items ? (
      <NavDropdown key={link.key} link={link} items={items} className={`${NAV_LINK} md:inline-flex`} />
    ) : (
      <ShellLink key={link.key} link={link} className={`${NAV_LINK} md:inline-flex`} />
    );
  });

  // The shopper's account, on a store that offers accounts (null otherwise, and always while lib/features has them off).
  const accountLink = useAccountMenuLink();
  // The sheet: the menu (or Home, as always), then the cart and order tracking.
  const sheetLinks: ResolvedShellLink[] = [
    ...(menu ?? [{ key: "home", label: t.common.home, href: "/", external: false }]),
    ...(header.showCart ? [{ key: "cart", label: t.common.cart, href: "/cart", external: false }] : []),
    ...(header.showTrackOrder
      ? [{ key: "track", label: t.common.trackOrder, href: "/track", external: false }]
      : []),
    ...(accountLink ? [accountLink] : []),
  ];

  const logo = (
    // data-store-logo lets the editor preview swap in an unsaved logo (and
    // data-logo-size tells it how big to draw it); neither changes anything
    // about how the header renders.
    <StoreLink
      href="/"
      data-store-logo=""
      data-logo-size={size === "md" ? undefined : size}
      className={`zt-logo flex min-h-11 min-w-0 items-center gap-3 rounded-lg transition-opacity hover:opacity-85${centred ? " justify-self-center" : ""}`}
    >
      {store.logoUrl ? (
        // A small light chip keeps an arbitrary-coloured logo legible while
        // overlaid; it disappears the moment the bar solidifies.
        <StoreImage
          src={store.logoUrl}
          alt=""
          width={LOGO_IMG_PX[size]}
          height={LOGO_IMG_PX[size]}
          sizes={`${LOGO_IMG_PX[size]}px`}
          className={`zt-logo-img ${LOGO_IMG_CLASS[size]} shrink-0 rounded-xl object-contain transition-[background-color,box-shadow] duration-200 group-data-[overlay]/header:bg-white/90 group-data-[overlay]/header:p-1 group-data-[overlay]/header:shadow-sm motion-reduce:transition-none`}
        />
      ) : brandingRemoved(store) ? null : (
        // `.zimos-logo[data-overlay ancestor]` forces the dark-surface
        // (light wordmark) export regardless of the `auto` surface prop —
        // see the header rules in globals.css.
        <ZimosLogo height={LOGO_MARK_PX[size]} surface="auto" className="shrink-0" />
      )}
      <span
        className={`zt-logo-name truncate font-display ${LOGO_NAME_CLASS[size]} font-bold text-ink transition-colors duration-200 group-data-[overlay]/header:text-white motion-reduce:transition-none`}
      >
        {store.name}
      </span>
    </StoreLink>
  );

  const controls = (
    <>
      {/* Product search with suggestions (a button that opens it on a phone). */}
      <SearchBox />
      {header.showTrackOrder && (
        <StoreLink href="/track" className={`${NAV_LINK} sm:inline-flex`}>
          {t.common.trackOrder}
        </StoreLink>
      )}
      {/* On a phone the language switch sits in the menu sheet too, so the
          search button fits beside the cart without squeezing the store's name. */}
      {header.showLanguage && (
        <span className="hidden sm:contents">
          <LanguageSwitch />
        </span>
      )}
      {/* View prices in another of the store's currencies (display only). */}
      <span className="hidden sm:contents">
      </span>
      {/* On a phone the theme toggle lives in the menu sheet; a wrapper hides
          it here because the button's own recipe sets its display. */}
      {header.showTheme && (
        <span className="hidden sm:contents">
          <ThemeToggle />
        </span>
      )}
      <AccountHeaderLink />
      {header.showCart && <CartIcon />}
      {(sheetLinks.length > 0 || header.showTheme) && (
        <MobileMenu
          storeName={store.name}
          links={sheetLinks}
          showTheme={header.showTheme}
          showLanguage={header.showLanguage}
          until={menu ? "md" : "sm"}
        />
      )}
    </>
  );

  return (
    <StickyHeader sticky={header.sticky} className={announcement ? "" : wide}>
      {announcement && <AnnouncementBar announcement={announcement} label={t.shop.announcement} />}
      {/* Brand bar — the merchant's two colours, edge to edge (the gradient
          is `.zt-brand-bar` in globals.css, where a store theme can restyle
          or drop it). Hidden while overlaid: a coloured hairline floating
          over a hero photo reads as a rendering glitch, not a brand touch. */}
      <div
        className={`zt-brand-bar h-1 w-full transition-opacity duration-200 group-data-[overlay]/header:opacity-0 motion-reduce:transition-none${wide}`}
        aria-hidden
      />
      {centred ? (
        // Logo in the middle: the menu on the start side, the controls on the
        // end side. Grid columns follow the document direction, so RTL mirrors.
        <div
          className={`${container} grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-3 transition-[height] duration-200 group-data-[scrolled]/header:h-14 motion-reduce:transition-none${wide}`}
        >
          <nav aria-label={t.common.menu} className="flex min-w-0 items-center gap-1">
            {menuLinks}
          </nav>
          {logo}
          <div className="flex items-center justify-end gap-2">{controls}</div>
        </div>
      ) : (
        <div
          className={`zt-header-bar ${container} flex h-16 items-center justify-between gap-3 transition-[height] duration-200 group-data-[scrolled]/header:h-14 motion-reduce:transition-none${wide}`}
        >
          {logo}
          <nav aria-label={t.common.menu} className="zt-nav flex items-center gap-2">
            {menuLinks}
            {controls}
          </nav>
        </div>
      )}
    </StickyHeader>
  );
}
