import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import "../landing.css";
import { fontVariables } from "../fonts";
import { directionOf, isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { I18nProvider } from "@/i18n/provider";
import { ogImage } from "@/lib/og";
import { SITE_NAME } from "@/lib/seo";
import { SITE_URL } from "@/lib/urls";
import { SiteAnalytics } from "@/components/site-analytics";
import { Gtm } from "@/components/gtm";

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
  //
  // What every page shares. Each page sets its own title, description,
  // canonical and language links, Open Graph and Twitter card
  // (lib/seo.ts pageMetadata); a page that sets none of them — a 404, the
  // hidden sign-up page — gets the home page's words, and no canonical that
  // would point at another page.
  return {
    // Resolves every page's relative canonical and language links.
    metadataBase: new URL(SITE_URL),
    title: meta.title,
    description: meta.description,
    applicationName: SITE_NAME,
    openGraph: {
      siteName: SITE_NAME,
      locale: locale === "ar" ? "ar_EG" : "en_US",
      type: "website",
      images: [ogImage(locale)],
    },
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
        <Gtm />
      </body>
    </html>
  );
}
