import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { socialLinksOf } from "@store-builder/ui/platform-info";
import "../home.css";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { FeatureGrid } from "@/components/feature-grid";
import { GrowthTools } from "@/components/growth-tools";
import { Hero } from "@/components/hero";
import { HomeEffects } from "@/components/home-effects";
import { HomeFaq } from "@/components/home-faq";
import { HomeFinal } from "@/components/home-final";
import { HomeFooter } from "@/components/home-footer";
import { HomeHeader } from "@/components/home-header";
import { DashboardShow, OrderJourney } from "@/components/home-lazy";
import { HomePricing } from "@/components/home-pricing";
import { StartSteps } from "@/components/start-steps";
import { StoreShowcase } from "@/components/store-showcase";
import { WhatsAppFloat } from "@/components/whatsapp-float";
import { WorksWith } from "@/components/works-with";
import { getPlatformSettings } from "@/lib/platform-settings";
import { homeJsonLd, jsonLdScript, pageMetadata } from "@/lib/seo";

/**
 * The landing (app/home.css, every rule under `.zm`), in the order a
 * merchant decides in (the owner, 2026-11-14: the stores first, and a flow
 * that sells): a night-blue opening with real stores on real devices, the
 * platforms strip, then eight numbered sections — the stores themselves,
 * each one to open and look through; what a merchant gets; three steps to a
 * live store; an order's road from the ad to the profit; real screens of
 * the dashboard; the growth tools; what it costs, with the plans read from
 * the API; and the questions — then the closing band. A WhatsApp button
 * stays at the corner for whoever would rather ask first.
 *
 * Mostly server-rendered: the header, the stores gallery, and (each in a
 * chunk of its own, components/home-lazy.tsx) the order's journey, the
 * dashboard and the plans are client components; the questions and the
 * closing band need no script. The motion starts once the page is idle
 * (components/home-effects.tsx).
 */

// Rebuilt at most every minute: the plans and the footer's platform details
// come from the API (lib/plans.ts, lib/platform-settings.ts). The browser
// reads the plans again on every visit besides (components/use-live-offer.ts).
export const revalidate = 60;

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
      <div className="zm">
        <i className="zm-prog" aria-hidden />
        <HomeHeader />
        <main id="main">
          <Hero copy={dict.hero} locale={locale} />
          <WorksWith copy={dict.integrations} />
          <StoreShowcase copy={dict.templates} locale={locale} />
          <FeatureGrid locale={locale} startCta={dict.finalCta.primaryCta} />
          <StartSteps copy={dict.start} />
          <OrderJourney copy={dict.journey} />
          <DashboardShow copy={dict.dashboard} locale={locale} />
          <GrowthTools copy={dict.growth} locale={locale} />
          <HomePricing copy={dict.pricing} trust={dict.trust} locale={locale} />
          <HomeFaq copy={dict.faq} locale={locale} />
          <HomeFinal copy={dict.finalCta} />
        </main>
        <HomeFooter copy={dict.footer} brand={dict.brand} locale={locale} />
        <WhatsAppFloat settings={settings} locale={locale} />
        <HomeEffects />
      </div>
    </>
  );
}
