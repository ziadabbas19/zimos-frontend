"use client";

import { Fragment, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { StorefrontMeta } from "@store-builder/api-client";
import { AccountHeaderLink, useAccountMenuLink } from "@/components/account/AccountHeaderLink";
import { CartIcon } from "@/components/CartIcon";
import { ColorModeSwitch } from "@/components/ColorModeSwitch";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { SearchBox } from "@/components/SearchBox";
import { headerMenuOf } from "@/components/shell/headerMenu";
import { NavDropdown } from "@/components/shell/NavDropdown";
import { ShellLink } from "@/components/ShellLink";
import { StoreImage } from "@/components/StoreImage";
import { StoreLink } from "@/components/StoreRoute";
import { getDictionary, type Locale } from "@/lib/i18n";
import type { ResolvedShellLink } from "@/lib/storeShell";
import { useStoreShell } from "@/lib/StoreShellContext";
import { XS_LOGOS } from "@/lib/xsShell";
import { readShopperDisplay } from "@/lib/shopperDisplay";
import type { ColorMode } from "@/lib/storeColorMode";
import { defaultHeaderZones, headerZonesByDevice, withColorModeSwitch, withLanguageSwitch, zoneGroups, type HeaderPart, type HeaderZone } from "@/lib/xsLayout";
import { storefrontGeneralMeta } from "@store-builder/api-client";
import { SocialLinks } from "@/components/SocialLinks";
import { XsPhoneMenu } from "./XsPhoneMenu";
import { headerSizeCss } from "./shellSizes";

/**
 * The header of an imported template (an "xs" look), drawn in place of the
 * store's own (StoreHeader) on a store whose themeSettings name that look —
 * see lib/xsShell.ts and the store layout. Styles: app/xs-shell.css.
 *
 * The markup is the template's — a thin dark strip, then a tall bar with the
 * logo, the menu and bare icons — but everything in it is the store's and is
 * edited where a store's header always is, the website editor's Header and
 * Announcement panels (`themeSettings.header`, read through useStoreShell so
 * the preview shows unsaved changes):
 *
 *   strip, start side   the announcement line (its first message)
 *   strip, end side     the template's own links (lib/xsShell XS_STRIP_LINKS), then order
 *                       tracking and the language switch only if the merchant turns them on
 *                       (the switch: Languages → "language button", lib/shopperDisplay; it
 *                       takes the place of a template's "EN", which is left out otherwise)
 *   bar                 logo or store name · the menu · search, account, wish list, cart
 *
 * — the template's arrangement, which the merchant may change part by part and
 * screen by screen (`header.zones`, lib/xsLayout): each part is drawn in the
 * template's box for its zone, so the look's rules still draw it.
 *
 * The search and the cart are the storefront's own working parts, restyled;
 * the phone menu is the template's own (XsPhoneMenu), since no two templates
 * open theirs alike. `data-zimos-shell` keeps the editor's click-to-select.
 */
export function XsHeader({
  store,
  locale,
  look,
  colorMode = "light",
  colorModeButton = false,
}: {
  store: StorefrontMeta;
  locale: Locale;
  look: string;
  /** How the server drew the store, and whether it shows the light/dark button (lib/storeColorMode). */
  colorMode?: ColorMode;
  colorModeButton?: boolean;
}) {
  const t = getDictionary(locale);
  const { header, announcement } = useStoreShell(store);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const { menu, children } = headerMenuOf(store, header, t.common);
  const links: ResolvedShellLink[] = menu ?? [{ key: "home", label: t.common.home, href: "/", external: false }];
  const accountLink = useAccountMenuLink();
  const social = storefrontGeneralMeta(store).social;
  // Where every part stands on each screen: the merchant's arrangement, else the template's — with the
  // store's language button where the template wrote a word for it, if the store shows one, and its
  // light/dark button beside it (lib/xsLayout).
  const zones = withColorModeSwitch(
    withLanguageSwitch(
      headerZonesByDevice(
        header.zones,
        defaultHeaderZones(look, { cart: header.showCart, track: header.showTrackOrder, language: header.showLanguage })
      ),
      readShopperDisplay(store.themeSettings).localeSwitch
    ),
    colorModeButton
  );
  const onPhone = Object.values(zones.mobile).flat();
  const has = (type: HeaderPart["type"]) => onPhone.some((part) => part.type === type);
  // What the bar has no room for on a phone, listed in the phone menu after the store's own menu.
  const phoneExtras: ResolvedShellLink[] = [
    ...onPhone.flatMap((part) => (part.type === "link" && part.href ? [{ key: `part:${part.id}`, label: part.label ?? "", href: part.href, external: /^https?:/i.test(part.href) }] : [])),
    ...(has("cart") ? [{ key: "cart", label: t.common.cart, href: "/cart", external: false }] : []),
    ...(has("track") ? [{ key: "track", label: t.common.trackOrder, href: "/track", external: false }] : []),
    ...(accountLink ? [accountLink] : []),
  ];
  // The bar's and the strip's own colours (the editor's Header panel), as properties app/xs-shell.css reads.
  const own: Record<string, string> = {};
  if (header.colors?.background) own["--xs-own-bar"] = header.colors.background;
  if (header.colors?.text) own["--xs-own-bar-text"] = header.colors.text;
  if (header.colors?.stripBackground) own["--xs-own-strip"] = header.colors.stripBackground;
  if (header.colors?.stripText) own["--xs-own-strip-text"] = header.colors.stripText;
  // Its own sizes, per screen: a small stylesheet of their own (./shellSizes).
  const sizeCss = headerSizeCss(header.sizes);

  const message = announcement ? (announcement.messages?.[0] ?? announcement.text) : "";

  // The logo: the one set for this header, else the store's own, else the template's (lib/xsShell XS_LOGOS), else the name —
  // or the name straight away, when the merchant asked for it in place of any picture.
  const ownLogo = header.logoAsName ? null : (header.logoImage ?? store.logoUrl ?? null);
  const templateLogo = ownLogo || header.logoAsName ? null : (XS_LOGOS[look]?.header ?? null);
  // Where that came from, for the editor's preview (components/preview/PreviewBridge applyLogo): it swaps
  // in the store's unsaved logo only where the store's logo is what shows.
  const logoSource = header.logoAsName ? "name" : header.logoImage ? "own" : ownLogo ? "store" : templateLogo ? "template" : "none";
  const brand = ownLogo ? (
    ownLogo.startsWith("/") ? (
      // A picture on this storefront: no image optimiser needed.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={ownLogo} alt={store.name} className="xs-header__logo-img" data-xs-pic="logo" />
    ) : (
      <StoreImage src={ownLogo} alt={store.name} width={160} height={54} sizes="160px" className="xs-header__logo-img" data-xs-pic="logo" />
    )
  ) : templateLogo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={templateLogo} alt={store.name} className="xs-header__logo-img" data-xs-logo="template" data-xs-pic="logo" />
  ) : (
    <span className="xs-header__logo-name" data-xs-pic="logo">{store.name}</span>
  );

  /** One part, as the template draws it; a part that is a component of its own sits in a box that takes no room. */
  function part(item: HeaderPart): ReactNode {
    switch (item.type) {
      case "notice":
        return (
          <span key={item.id} data-xs-part={item.id}>
            {announcement?.href ? <StoreLink href={announcement.href}>{message}</StoreLink> : message}
          </span>
        );
      case "link":
        return (
          <StoreLink key={item.id} href={item.href ?? "/"} data-xs-part={item.id}>
            {item.label}
          </StoreLink>
        );
      case "text":
        return (
          <span key={item.id} data-xs-part={item.id}>
            {item.label}
          </span>
        );
      case "social":
        return (
          <span key={item.id} className="xs-header__strip-social" data-xs-part={item.id}>
            <SocialLinks links={social} />
          </span>
        );
      case "track":
        return (
          <StoreLink key={item.id} href="/track" data-xs-part={item.id}>
            {t.common.trackOrder}
          </StoreLink>
        );
      case "language":
        return <LanguageSwitch key={item.id} partId={item.id} />;
      case "mode":
        return colorModeButton ? <ColorModeSwitch key={item.id} mode={colorMode} partId={item.id} /> : null;
      case "logo":
        return (
          <StoreLink
            key={item.id}
            href="/"
            className="xs-header__logo"
            data-store-logo=""
            data-logo-source={logoSource}
            data-logo-class="xs-header__logo-img"
            data-template-logo={XS_LOGOS[look]?.header ?? undefined}
            data-xs-part={item.id}
          >
            {brand}
          </StoreLink>
        );
      case "menu":
        return (
          <span key={item.id} className="xs-part" data-xs-part={item.id}>
            {links.map((link) => {
              const items = children.get(Number(link.key.split(":")[0]));
              return items ? (
                <NavDropdown key={link.key} link={link} items={items} className="xs-header__link" />
              ) : (
                <ShellLink key={link.key} link={link} className="xs-header__link" />
              );
            })}
          </span>
        );
      case "search":
        return (
          <span key={item.id} className="xs-part" data-xs-part={item.id}>
            <SearchBox />
          </span>
        );
      case "account":
        return (
          <span key={item.id} className="xs-part" data-xs-part={item.id}>
            <AccountHeaderLink />
          </span>
        );
      case "wishlist":
        // The wish list lives in the shopper's account, so the heart shows only on a store that offers accounts.
        return accountLink ? (
          <span key={item.id} className="xs-part" data-xs-part={item.id}>
            <StoreLink href="/account/wishlist" className="zt-icon-btn xs-header__wish" aria-label={locale === "ar" ? "المفضلة" : "Wish list"}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.400-7 10-7 10Z" />
              </svg>
            </StoreLink>
          </span>
        ) : null;
      case "cart":
        return (
          <span key={item.id} className="xs-part" data-xs-part={item.id}>
            <CartIcon />
          </span>
        );
      case "phone":
        return (
          <span key={item.id} className="xs-part" data-xs-part={item.id}>
            <XsPhoneMenu
              look={look}
              brand={brand}
              links={links}
              subLinks={children}
              extras={phoneExtras}
              notice={message}
              noticeHref={announcement?.href}
              showLanguage={has("language")}
              colorMode={colorModeButton && has("mode") ? colorMode : null}
              labels={{ open: t.shop.openMenu, close: t.shop.closeMenu, menu: t.common.menu }}
              own={own}
            />
          </span>
        );
    }
  }

  /** A zone's parts; where screens differ, each screen's own list, shown only on it (app/xs-shell.css `.xs-on`). */
  function zone(name: HeaderZone): ReactNode {
    return zoneGroups(zones, name).map(({ devices, parts }, i) =>
      devices ? (
        <span key={i} className="xs-on" data-xs-on={devices.join(" ")}>
          {parts.map(part)}
        </span>
      ) : (
        <Fragment key={i}>{parts.map(part)}</Fragment>
      )
    );
  }

  return (
    <header className="xs-header" data-xs-look={look} data-zimos-shell="header" data-scrolled={scrolled ? "" : undefined} style={own as CSSProperties}>
      {/* Whole numbers only, clamped by lib/storeShell (./shellSizes). */}
      {sizeCss ? <style dangerouslySetInnerHTML={{ __html: sizeCss }} /> : null}
      <div className="xs-header__strip" data-zimos-shell={announcement ? "announcement" : undefined}>
        <div className="xs-header__strip-inner">
          <div className="xs-header__notice" data-xs-zone="notice">
            {zone("notice")}
          </div>
          <div className="xs-header__strip-links" data-xs-zone="links">
            {zone("links")}
          </div>
        </div>
      </div>

      <div className="xs-header__bar">
        <nav className="xs-header__bar-inner" aria-label={t.common.menu} data-xs-zone="brand">
          {zone("brand")}

          <div className="xs-header__menu" data-xs-zone="menu">
            {zone("menu")}
          </div>

          <div className="xs-header__icons" data-xs-zone="icons">
            {zone("icons")}
          </div>
        </nav>
      </div>
    </header>
  );
}
