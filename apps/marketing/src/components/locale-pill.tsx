"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, otherLocale } from "@/i18n/config";
import { useI18n } from "@/i18n/provider";
import { keepPlaceOnClick } from "@/lib/keep-place";

const localePrefix = new RegExp(`^/(${locales.join("|")})(?=/|$)`);

/**
 * The language switch, floating at the bottom corner of the screen (as on
 * lightfunnels.com) with the theme switch beside it (`.lz-corner`, in
 * SiteHeader): the other language's name, to the same page in it, at the
 * same place (lib/keep-place.ts). Hidden on phones, where the language
 * sits in the header's sheet.
 */
export function LocalePill() {
  const { locale, dict } = useI18n();
  const pathname = usePathname() || `/${locale}`;
  const target = otherLocale(locale);
  const href = `/${target}${pathname.replace(localePrefix, "")}`;

  return (
    <Link
      href={href}
      scroll={false}
      onClick={(event) => keepPlaceOnClick(event, href)}
      hrefLang={target}
      lang={target}
      // The visible name first, so what is read out contains what is shown.
      aria-label={`${dict.nav.switchLanguage} — ${dict.nav.switchLanguageAria}`}
      className="lz-lang-pill"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable={false}>
        <path d="M4 5h9M8.5 3v2M6 5c.8 3.6 3.2 6.4 6 8M11 5c-.9 4.2-3.6 7.4-7 9" />
        <path d="m12 21 4.5-10L21 21M13.6 17.5h5.8" />
      </svg>
      {dict.nav.switchLanguage}
    </Link>
  );
}
