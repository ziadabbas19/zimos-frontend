import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { socialLinksOf } from "@store-builder/ui/platform-info";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { Benefits } from "@/components/benefits";
import { DashboardShow } from "@/components/dashboard-show";
import { Faq } from "@/components/faq";
import { FeaturesSummary } from "@/components/features-summary";
import { FinalCta } from "@/components/final-cta";
import { Hero } from "@/components/hero";
import { Journey } from "@/components/journey";
import { LandingMotion } from "@/components/landing-motion";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TemplatesGallery } from "@/components/templates-gallery";
import { Trust } from "@/components/trust";
import { WorksWith } from "@/components/works-with";
import { getPlatformSettings } from "@/lib/platform-settings";
import { homeJsonLd, jsonLdScript, pageMetadata } from "@/lib/seo";

/**
 * The landing (app/landing.css): real stores in the hero, the platforms
 * strip, the template gallery, benefits, eight of the features with the way
 * to /features, the five steps, the dashboard, what should reassure you, the
 * questions and the closing band — laid out like the Zemam landing. Plans
 * and prices live on /pricing.
 */

// Rebuilt at most every 5 minutes, as before the landing: the footer reads the
// platform's details from the API (lib/platform-settings.ts), whose own
// shorter window wins while they are on.
export const revalidate = 300;

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { meta } = getDictionary(locale);
  return pageMetadata({ locale, path: "", title: meta.title, description: meta.description });
}

export default async function MarketingHome({ params }: Params) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  // The same social accounts the footer shows (the console's when saved).
  const settings = await getPlatformSettings();
  const jsonLd = homeJsonLd({ description: dict.meta.description, socialLinks: socialLinksOf(settings) });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <SiteHeader />
      <main id="main" className="lz-page lz-home">
        <Hero copy={dict.hero} />
        <WorksWith copy={dict.integrations} />
        <TemplatesGallery copy={dict.templates} />
        <Benefits copy={dict.benefits} />
        <FeaturesSummary locale={locale} />
        <Journey copy={dict.journey} />
        <DashboardShow copy={dict.dashboard} locale={locale} />
        <Trust copy={dict.trust} locale={locale} />
        <Faq copy={dict.faq} locale={locale} />
        <FinalCta copy={dict.finalCta} />
      </main>
      <SiteFooter copy={dict.footer} brand={dict.brand} locale={locale} />
      <LandingMotion />
    </>
  );
}
