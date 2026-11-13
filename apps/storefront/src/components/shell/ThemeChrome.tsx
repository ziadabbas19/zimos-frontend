"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { StorefrontMeta } from "@store-builder/api-client";
import { StoreLink } from "@/components/StoreRoute";
import { useCart } from "@/lib/CartProvider";
import { useCartSheet } from "@/lib/cartSheet";
import { LOCALE_COOKIE, nextLocale, switchLabel } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";

/**
 * Two optional pieces of store chrome a merchant can switch on in
 * `themeSettings`, both off unless asked for:
 *
 *   mobileToolbar: true                       a bar along the bottom of a phone:
 *                                             home, shop, cart, search
 *   floating: { language?: true }             a language button in the corner
 *
 * The WhatsApp button is the store's own (Settings → general → floating
 * WhatsApp, components/FloatingWhatsapp) — a number in the theme settings is
 * not used: templates carried another store's there (migration 430).
 *
 * The cart item opens the drawer the way the header's cart icon does.
 */

type Blob = Record<string, unknown>;

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function ThemeChrome({ store }: { store: StorefrontMeta }) {
  const settings = (store.themeSettings ?? {}) as Blob;
  const floating = (settings.floating && typeof settings.floating === "object" ? settings.floating : {}) as Blob;
  const toolbar = settings.mobileToolbar === true;
  const { t, locale, intlLocale } = useStore();
  const { itemCount, openDrawer } = useCart();
  const { onCartLinkClick } = useCartSheet(openDrawer);
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // A funnel keeps the shopper on one path; the store's chrome steps aside there.
  if (/\/f\//.test(pathname)) return null;
  if (!toolbar && floating.language !== true) return null;

  const next = nextLocale(locale, (store as { languages?: string[] }).languages);
  function switchLanguage() {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <>
      {floating.language === true && (
        <div className="zs-float" data-toolbar={toolbar ? "" : undefined}>
          {floating.language === true && (
            <button
              type="button"
              className="zs-float__btn"
              onClick={switchLanguage}
              disabled={pending}
              lang={next}
              aria-label={switchLabel(t, next)}
            >
              <svg viewBox="0 0 24 24" aria-hidden>
                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.7" />
                <path d="M3.5 12h17M12 3c2.4 2.5 3.6 5.5 3.6 9S14.4 18.5 12 21M12 3C9.6 5.5 8.4 8.5 8.4 12S9.6 18.5 12 21" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      )}

      {toolbar && (
        <nav className="zs-toolbar" aria-label={t.common.menu}>
          <StoreLink href="/">
            <svg viewBox="0 0 24 24" {...stroke} aria-hidden>
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <path d="M9 22V12h6v10" />
            </svg>
            <span>{t.common.home}</span>
          </StoreLink>
          <StoreLink href="/products">
            <svg viewBox="0 0 24 24" {...stroke} aria-hidden>
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            <span>{locale === "ar" ? "تسوق" : "Shop"}</span>
          </StoreLink>
          {/* The cart sheet when the merchant has the cart icon open it (lib/cartSheet), else the cart page. */}
          <StoreLink href="/cart" onClick={onCartLinkClick}>
            <span className="zs-toolbar__icon">
              <svg viewBox="0 0 24 24" {...stroke} aria-hidden>
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              <b>{new Intl.NumberFormat(intlLocale).format(itemCount)}</b>
            </span>
            <span>{t.common.cart}</span>
          </StoreLink>
          <StoreLink href="/products?focus=search">
            <svg viewBox="0 0 24 24" {...stroke} aria-hidden>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <span>{locale === "ar" ? "البحث" : "Search"}</span>
          </StoreLink>
        </nav>
      )}
    </>
  );
}
