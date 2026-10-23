"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, otherLocale } from "@/i18n/config";
import { useI18n } from "@/i18n/provider";
import { keepPlaceOnClick } from "@/lib/keep-place";

const localePrefix = new RegExp(`^/(${locales.join("|")})(?=/|$)`);

/** The footer's language switch: the same page in the other language, at the same place (lib/keep-place.ts). */
export function LocaleSwitcher({ className = "" }: { className?: string }) {
  const { locale, dict } = useI18n();
  const pathname = usePathname() || `/${locale}`;
  const target = otherLocale(locale);

  const rest = pathname.replace(localePrefix, "");
  const href = `/${target}${rest}`;

  return (
    <Link
      href={href}
      scroll={false}
      onClick={(event) => keepPlaceOnClick(event, href)}
      hrefLang={target}
      lang={target}
      // The visible name first, so what is read out contains what is shown.
      aria-label={`${dict.nav.switchLanguage} — ${dict.nav.switchLanguageAria}`}
      className={`inline-flex h-9 items-center rounded-lg border border-line bg-paper-raised px-3 text-sm font-medium text-ink-soft transition-colors hover:border-ink-soft hover:text-ink ${className}`}
    >
      {dict.nav.switchLanguage}
    </Link>
  );
}
