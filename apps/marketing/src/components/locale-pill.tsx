"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, otherLocale } from "@/i18n/config";
import { useI18n } from "@/i18n/provider";
import { keepPlaceOnClick } from "@/lib/keep-place";
import { ColorIcon } from "./color-icon";

const localePrefix = new RegExp(`^/(${locales.join("|")})(?=/|$)`);

/** The other language, as short as it can be said: what the pill shows. */
const SHORT = { ar: "ع", en: "EN" } as const;

/**
 * The language switch in the header, beside the theme switch: the translate
 * mark and the other language in two letters at most, to the same page in
 * it, at the same place (lib/keep-place.ts). Its full name is what a screen
 * reader hears. `prefetch={false}` keeps Next from fetching the other
 * language's page ahead of a click (the home page's header).
 */
export function LocalePill({ prefetch }: { prefetch?: boolean } = {}) {
  const { locale, dict } = useI18n();
  const pathname = usePathname() || `/${locale}`;
  const target = otherLocale(locale);
  const href = `/${target}${pathname.replace(localePrefix, "")}`;

  return (
    <Link
      href={href}
      prefetch={prefetch}
      scroll={false}
      onClick={(event) => keepPlaceOnClick(event, href)}
      hrefLang={target}
      lang={target}
      // The visible name first, so what is read out contains what is shown.
      aria-label={`${dict.nav.switchLanguage} — ${dict.nav.switchLanguageAria}`}
      title={dict.nav.switchLanguage}
      className="lz-lang-pill"
    >
      <ColorIcon name="translate" size={18} ink />
      <span>{SHORT[target]}</span>
    </Link>
  );
}
