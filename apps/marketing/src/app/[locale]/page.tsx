import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { socialLinksOf } from "@store-builder/ui/platform-info";
import "../home.css";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { DashboardShow } from "@/components/dashboard-show";
import { Faq } from "@/components/faq";
import { FeatureBento } from "@/components/feature-bento";
import { FinalCta } from "@/components/final-cta";
import { GrowthTools } from "@/components/growth-tools";
import { Hero } from "@/components/hero";
import { Idea } from "@/components/idea";
import { LandingMotion } from "@/components/landing-motion";
import { OrderJourney } from "@/components/order-journey";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { StartSteps } from "@/components/start-steps";
import { StoreShowcase } from "@/components/store-showcase";
import { Trust } from "@/components/trust";
import { WorksWith } from "@/components/works-with";
import { getPlatformSettings } from "@/lib/platform-settings";
import { homeJsonLd, jsonLdScript, pageMetadata } from "@/lib/seo";

/**
 * The landing (app/home.css, over the kit every page shares in
 * app/landing.css). A night-blue stage of real stores opens it, then the
 * platforms strip and nine numbered sections: the idea in one statement and
 * four facts, the stores to move through, six features with a drawing each,
 * an order's road from the ad to the profit, the growth tools, real screens
 * of the dashboard, three steps to start, what should reassure you, and the
 * questions — then the closing band. Laid out after the two references the
 * owner gave (2026-11-14): the flow and the store gallery of a competing
 * store builder, in the look of Net Profit's landing. Plans and prices live
 * on /pricing.
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
        <Hero copy={dict.hero} locale={locale} />
        <WorksWith copy={dict.integrations} />
        <Idea copy={dict.idea} />
        <StoreShowcase copy={dict.templates} locale={locale} />
        <FeatureBento copy={dict.benefits} locale={locale} />
        <OrderJourney copy={dict.journey} locale={locale} />
        <GrowthTools copy={dict.growth} locale={locale} />
        <DashboardShow copy={dict.dashboard} locale={locale} />
        <StartSteps copy={dict.start} />
        <Trust copy={dict.trust} locale={locale} />
        <Faq copy={dict.faq} locale={locale} n="09" />
        <FinalCta copy={dict.finalCta} />
      </main>
      <SiteFooter copy={dict.footer} brand={dict.brand} locale={locale} />
      <LandingMotion />
    </>
  );
}
