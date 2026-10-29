import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import "../landing.css";
import { fontVariables } from "../fonts";
import { directionOf, isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { I18nProvider } from "@/i18n/provider";
import { ogImage } from "@/lib/og";
import { SITE_URL } from "@/lib/urls";
import { SiteAnalytics } from "@/components/site-analytics";

type LocaleParams = { locale: string };

/** Set the theme class before first paint — no flash of the wrong theme. */
const themeScript = `(function(){try{var e=document.documentElement,s=null;try{s=localStorage.getItem("theme")}catch(_){}var d=s==="dark"||(s!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light"}catch(_){}})();`;

export function generateStaticParams(): LocaleParams[] {
  return locales.map((locale) => ({ locale }));
}

// Only `ar` and `en` exist — anything else is a 404, not a runtime render.
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<LocaleParams>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const { meta } = getDictionary(locale);
  // Icons come from src/app/favicon.ico; the brand PNGs in public/brand are
  // rendered in-page by <ZimosLogo />.
  return {
    // Resolves every page's relative canonical and language links.
    metadataBase: new URL(SITE_URL),
    title: meta.title,
    description: meta.description,
    applicationName: "ZIMOS",
    alternates: {
      canonical: `/${locale}`,
      languages: { ar: "/ar", en: "/en" },
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      siteName: "ZIMOS",
      locale: locale === "ar" ? "ar_EG" : "en_US",
      type: "website",
      url: `/${locale}`,
      images: [ogImage(locale)],
    },
    // Title and description come from each page's Open Graph tags.
    twitter: {
      card: "summary_large_image",
      images: [ogImage(locale).url],
    },
  };
}

// Matches the page background in each theme.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<LocaleParams>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dir = directionOf(locale);
  const dict = getDictionary(locale);

  return (
    <html
      lang={locale}
      dir={dir}
      suppressHydrationWarning
      className={`${fontVariables} lang-${locale} antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh bg-paper text-ink">
        <I18nProvider value={{ locale, dir, dict: { nav: dict.nav } }}>{children}</I18nProvider>
        <SiteAnalytics />
      </body>
    </html>
  );
}
