import type { Metadata } from "next";
import { visibleSocialLinks, type SocialLinkConfig, type SocialPlatform } from "@store-builder/ui/social-links";
import { locales, otherLocale, type Locale } from "@/i18n/config";
import { ogImage } from "./og";
import { SITE_URL } from "./urls";

/**
 * What search engines and link previews read about each page: the title and
 * description, the canonical address, the page in the other language, the
 * Open Graph and Twitter tags, and the home page's structured data.
 */

/**
 * The platform's name in titles, link previews and structured data — one
 * spelling everywhere, so Google ties the name to this site. The pages'
 * own text and the logo keep writing it as they do.
 */
export const SITE_NAME = "Zimos";

/** The logo in the structured data: the square mark, 512px, transparent. */
export const LOGO_URL = `${SITE_URL}/brand/zimos-icon-512.png`;

const OG_LOCALES: Record<Locale, string> = { ar: "ar_EG", en: "en_US" };

/** `"<page> — Zimos"`: every page's title but the home page's. */
export function titleOf(page: string): string {
  return `${page} — ${SITE_NAME}`;
}

/**
 * A page's address in each language, and `x-default`: the same address with
 * no language, which proxy.ts sends on to the visitor's language (Arabic when
 * none matches) — the page Google advises for visitors who match neither.
 * `path` is "" for the home page, "/pricing" for the pricing page. The paths
 * are relative: the layout's `metadataBase` makes them absolute.
 */
export function languageAlternates(path: string): Record<Locale | "x-default", string> {
  const languages = Object.fromEntries(locales.map((locale) => [locale, `/${locale}${path}`])) as Record<Locale, string>;
  return { ...languages, "x-default": path || "/" };
}

/**
 * Title, description, canonical and language links, Open Graph and the
 * Twitter card of one page. A page's `openGraph` replaces the layout's whole
 * object (Next merges metadata one level deep), so each page carries all of it.
 */
export function pageMetadata({
  locale,
  path,
  title,
  description,
  type = "website",
}: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  type?: "website" | "article";
}): Metadata {
  const url = `/${locale}${path}`;
  const image = ogImage(locale);
  return {
    title,
    description,
    alternates: { canonical: url, languages: languageAlternates(path) },
    openGraph: {
      type,
      url,
      title,
      description,
      siteName: SITE_NAME,
      locale: OG_LOCALES[locale],
      alternateLocale: [OG_LOCALES[otherLocale(locale)]],
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: image.url, alt: image.alt }],
    },
  };
}

/** Accounts that are a profile of the platform; a chat link or an email address is not one. */
const NOT_PROFILES: readonly SocialPlatform[] = ["whatsapp", "email"];

/**
 * The structured data of the home page: the organization behind the site
 * (name, address, logo, and its social accounts — the ones the footer
 * shows) and the site itself, for the site name Google shows.
 */
export function homeJsonLd({
  description,
  socialLinks,
}: {
  description: string;
  socialLinks: readonly SocialLinkConfig[] | null | undefined;
}) {
  const home = `${SITE_URL}/`;
  const organization = `${SITE_URL}/#organization`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organization,
        name: SITE_NAME,
        url: home,
        logo: LOGO_URL,
        description,
        sameAs: visibleSocialLinks(socialLinks)
          .filter((link) => !NOT_PROFILES.includes(link.platform))
          .map((link) => link.href),
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: home,
        // The same site in both languages: /ar and /en carry the same entry.
        inLanguage: [...locales],
        publisher: { "@id": organization },
      },
    ],
  };
}

/**
 * JSON for a `<script type="application/ld+json">`, with every `<` escaped
 * so no text in it can close the script tag (Next's JSON-LD guide).
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
