"use client";

import { useId } from "react";
import type { StorefrontCollection, StorefrontMeta } from "@store-builder/api-client";
import { AccountHeaderLink } from "@/components/account/AccountHeaderLink";
import { CartIcon } from "@/components/CartIcon";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { brandingRemoved } from "@/components/PoweredByZimos";
import { SearchCombobox } from "@/components/SearchBox";
import { ShellLink } from "@/components/ShellLink";
import { StoreImage } from "@/components/StoreImage";
import { StoreLink } from "@/components/StoreRoute";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ZimosLogo } from "@/components/ZimosLogo";
import { focusRing } from "@/components/ui";
import { getDictionary, type Locale } from "@/lib/i18n";
import { useStoreShell } from "@/lib/StoreShellContext";
import type { LogoSize, ResolvedShellLink } from "@/lib/storeShell";
import { headerMenuOf } from "./headerMenu";

/**
 * The store's navigation as a column beside the page, for a store that chose
 * it (Store look → Navigation; lib/storeNav). From `xl` only: below that the
 * column is not drawn and the bar across the top (StoreHeader) carries on
 * with its menu sheet, exactly as on a store that never chose it.
 *
 * Top to bottom it holds what the bar holds: the logo and the store's name,
 * the product search, the menu (the merchant's own links or the built-in
 * ones, with the pages flagged "show in header", and the list under a link
 * that has one), order tracking, then the store's categories as a tree; at
 * the foot, the account, the cart, the language and the light / dark switch.
 * Each of those obeys the same "show in header" switches as the bar, and the
 * column stays in view while the page scrolls beside it.
 *
 * `xl`, not `lg`: the column takes 16rem, so the page beside it is never
 * narrower than the 64rem the store's own wide layouts (`lg:`) are drawn for.
 *
 * It sits on the inline-start side (the right in Arabic) because the layout
 * is a row in the document's direction. `data-zimos-shell="header"` lets the
 * editor's preview select it as the header, and a product page that hides the
 * header hides it too.
 */

/** A store with a long list of categories still gets a column that ends. */
const MAX_TOP_COLLECTIONS = 30;
const MAX_SUB_COLLECTIONS = 12;

const LOGO_IMG_CLASS: Record<LogoSize, string> = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-12 w-12" };
const LOGO_IMG_PX: Record<LogoSize, number> = { sm: 32, md: 40, lg: 48 };
const LOGO_MARK_PX: Record<LogoSize, number> = { sm: 26, md: 32, lg: 40 };

const row = `flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-ink transition-colors hover:bg-primary-soft hover:text-primary ${focusRing}`;
const subRow = `flex min-h-11 items-center rounded-lg px-3 text-sm text-ink-soft transition-colors hover:bg-primary-soft hover:text-primary ${focusRing}`;
const subList = "ms-3 border-s border-line ps-1";
const heading = "px-3 pb-1 text-xs font-semibold text-ink-soft";

export function StoreSideNav({
  store,
  locale,
  collections,
}: {
  store: StorefrontMeta;
  locale: Locale;
  collections: StorefrontCollection[];
}) {
  const t = getDictionary(locale);
  const { header } = useStoreShell(store);
  const categoriesId = useId();
  const size = header.logoSize;

  const top = collections.filter((c) => !c.parentId).slice(0, MAX_TOP_COLLECTIONS);
  const under = (id: string) => collections.filter((c) => c.parentId === id).slice(0, MAX_SUB_COLLECTIONS);

  const { menu, children } = headerMenuOf(store, header, t.common);
  const home: ResolvedShellLink = { key: "home", label: t.common.home, href: "/", external: false };
  // The collections flagged "show in header" are in the category tree below; listing them twice helps nobody.
  const links = (menu ?? [home]).filter((link) => top.length === 0 || !link.key.startsWith("collection:"));

  return (
    <aside
      data-zimos-shell="header"
      data-store-sidenav=""
      aria-label={t.common.menu}
      className="zt-sidenav hidden w-64 shrink-0 flex-col border-e border-line bg-paper-raised xl:sticky xl:top-0 xl:flex xl:h-dvh xl:self-start"
    >
      <div className="zt-brand-bar h-1 w-full shrink-0" aria-hidden />

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-3 py-5">
        <StoreLink
          href="/"
          data-store-logo=""
          data-logo-size={size === "md" ? undefined : size}
          className={`zt-logo mx-1 flex min-h-11 min-w-0 items-center gap-3 rounded-lg transition-opacity hover:opacity-85 ${focusRing}`}
        >
          {store.logoUrl ? (
            <StoreImage
              src={store.logoUrl}
              alt=""
              width={LOGO_IMG_PX[size]}
              height={LOGO_IMG_PX[size]}
              sizes={`${LOGO_IMG_PX[size]}px`}
              className={`zt-logo-img ${LOGO_IMG_CLASS[size]} shrink-0 rounded-xl object-contain`}
            />
          ) : brandingRemoved(store) ? null : (
            <ZimosLogo height={LOGO_MARK_PX[size]} surface="auto" className="shrink-0" />
          )}
          <span className="zt-logo-name line-clamp-2 min-w-0 font-display text-lg font-bold leading-snug text-ink">{store.name}</span>
        </StoreLink>

        <div className="mx-1">
          <SearchCombobox />
        </div>

        <nav aria-label={t.common.menu}>
          <ul className="space-y-0.5">
            {links.map((link) => {
              const items = children.get(Number(link.key.split(":")[0]));
              return (
                <li key={link.key}>
                  <ShellLink link={link} className={row} />
                  {items && (
                    <ul className={subList}>
                      {items.map((item) => (
                        <li key={item.key}>
                          <ShellLink link={item} className={subRow} />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
            {header.showTrackOrder && (
              <li>
                <StoreLink href="/track" className={row}>
                  {t.common.trackOrder}
                </StoreLink>
              </li>
            )}
          </ul>
        </nav>

        {top.length > 0 && (
          <nav aria-labelledby={categoriesId} data-sidenav-categories="">
            <p id={categoriesId} className={heading}>
              {t.home.collections}
            </p>
            <ul className="space-y-0.5">
              <li>
                <StoreLink href="/products" className={row}>
                  {t.catalog.allProducts}
                </StoreLink>
              </li>
              {top.map((c) => {
                const subs = under(c.id);
                return (
                  <li key={c.id}>
                    <StoreLink href={`/products?collection=${encodeURIComponent(c.slug)}`} className={row}>
                      <span className="min-w-0 truncate">{c.name}</span>
                    </StoreLink>
                    {subs.length > 0 && (
                      <ul className={subList}>
                        {subs.map((s) => (
                          <li key={s.id}>
                            <StoreLink href={`/products?collection=${encodeURIComponent(s.slug)}`} className={subRow}>
                              <span className="min-w-0 truncate">{s.name}</span>
                            </StoreLink>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </div>

      {/* Each control labels itself; with every one switched off the strip is not there at all. */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-line px-4 py-3 empty:hidden">
        <AccountHeaderLink />
        {header.showCart && <CartIcon />}
        {header.showLanguage && <LanguageSwitch />}
        {header.showTheme && <ThemeToggle />}
      </div>
    </aside>
  );
}
