import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { socialLinksOf } from "@store-builder/ui/platform-info";
import "../home.css";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { DashboardShow } from "@/components/dashboard-show";
import { Faq } from "@/components/faq";
import { FinalCta } from "@/components/final-cta";
import { GrowthTools } from "@/components/growth-tools";
import { Hero } from "@/components/hero";
import { HomePricing } from "@/components/home-pricing";
import { LandingMotion } from "@/components/landing-motion";
import { OrderJourney } from "@/components/order-journey";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { StartSteps } from "@/components/start-steps";
import { StoreShowcase } from "@/components/store-showcase";
import { WhatsAppFloat } from "@/components/whatsapp-float";
import { WhyZimos } from "@/components/why-zimos";
import { WorksWith } from "@/components/works-with";
import { getPlatformSettings } from "@/lib/platform-settings";
import { homeJsonLd, jsonLdScript, pageMetadata } from "@/lib/seo";

/**
 * The landing (app/home.css, over the kit every page shares in
 * app/landing.css), in the order a merchant decides in (the owner,
 * 2026-11-14: the stores first, and a flow that sells). A night-blue stage of
 * real stores opens it, then the platforms strip and eight numbered sections:
 * the stores themselves, each one to open and look through; why ZIMOS, as
 * the three places cash on delivery loses its profit and what closes each;
 * three steps to a live store; an order's road from the ad to the profit;
 * real screens of the dashboard; the growth tools; what it costs, with the
 * plans read from the API; and the questions — then the closing band. A
 * WhatsApp button stays at the corner for whoever would rather ask first.
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
        <StoreShowcase copy={dict.templates} locale={locale} />
        <WhyZimos copy={dict.benefits} locale={locale} />
        <StartSteps copy={dict.start} />
        <OrderJourney copy={dict.journey} locale={locale} />
        <DashboardShow copy={dict.dashboard} locale={locale} />
        <GrowthTools copy={dict.growth} locale={locale} />
        <HomePricing copy={dict.pricing} trust={dict.trust} locale={locale} />
        <Faq copy={dict.faq} locale={locale} n="08" />
        <FinalCta copy={dict.finalCta} photo />
      </main>
      <SiteFooter copy={dict.footer} brand={dict.brand} locale={locale} />
      <WhatsAppFloat settings={settings} locale={locale} />
      <LandingMotion />
    </>
  );
}
