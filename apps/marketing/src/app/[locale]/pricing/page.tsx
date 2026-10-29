import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { Faq } from "@/components/faq";
import { PlanCards, PricesComingSoon } from "@/components/plan-cards";
import { PaymentNote, payPerOrderQuestions } from "@/components/pricing";
import { Service } from "@/components/service";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { container } from "@/components/ui";
import { ogImage } from "@/lib/og";
import { getPublicOffer } from "@/lib/plans";

type Params = { params: Promise<{ locale: string }> };

// Prices come from the API: the page is rebuilt at most every 5 minutes, and
// renders "coming soon" (not an error) when the API can't be reached.
export const revalidate = 300;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { pricing } = getDictionary(locale);
  return {
    title: pricing.pageTitle,
    description: pricing.pageDescription,
    alternates: { canonical: `/${locale}/pricing`, languages: { ar: "/ar/pricing", en: "/en/pricing" } },
    openGraph: {
      title: pricing.pageTitle,
      description: pricing.pageDescription,
      type: "website",
      url: `/${locale}/pricing`,
      images: [ogImage(locale)],
    },
  };
}

/**
 * Every plan on offer with its prices (monthly and yearly, in its currency),
 * trial, limits and features, in the page's HTML; the pay-per-order plan with
 * its questions while the API sends it; the way payment works; and what ZIMOS
 * is and sells.
 */
export default async function PricingPage({ params }: Params) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const offer = await getPublicOffer();
  const plans = offer?.plans ?? [];
  const payPerOrder = offer?.payPerOrder ?? null;

  return (
    <>
      <SiteHeader />
      <main id="main">
        <section aria-labelledby="pricing-page-heading" className="bg-paper py-16 sm:py-24">
          <div className={container}>
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold text-primary">{dict.pricing.kicker}</p>
              <h1 id="pricing-page-heading" className="mt-3 text-4xl font-bold text-ink sm:text-5xl">
                {dict.pricing.pageHeading}
              </h1>
              <p className="mt-4 text-lg leading-relaxed text-pretty text-ink-soft">
                {payPerOrder ? dict.pricing.payPerOrder.pageIntro : dict.pricing.pageIntro}
              </p>
            </div>

            {plans.length > 0 || payPerOrder ? (
              <div className="mt-10">
                <PlanCards
                  plans={plans}
                  payPerOrder={payPerOrder}
                  copy={dict.pricing}
                  locale={locale}
                  idPrefix="pricing-page"
                  headingLevel={2}
                />
              </div>
            ) : (
              <PricesComingSoon copy={dict.pricing} />
            )}
            <PaymentNote copy={dict.pricing} locale={locale} />
          </div>
        </section>
        {payPerOrder ? (
          <Faq copy={payPerOrderQuestions(payPerOrder, dict.pricing, dict.faq.contactLink, locale)} locale={locale} />
        ) : null}
        <Service copy={dict.service} payPerOrder={Boolean(payPerOrder)} />
      </main>
      <SiteFooter copy={dict.footer} brand={dict.brand} locale={locale} />
    </>
  );
}
