import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "./features.css";
import { FEATURE_SECTION_IDS, getFeatures } from "@/content/features";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { Backdrop } from "@/components/backdrop";
import { Arrow } from "@/components/duo-icons";
import { FeatureSection } from "@/components/feature-section";
import { FeaturesNav } from "@/components/features-nav";
import { FinalCta } from "@/components/final-cta";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ogImage } from "@/lib/og";
import { REGISTER_URL } from "@/lib/urls";

type Params = { params: Promise<{ locale: string }> };

// Rebuilt at most every 5 minutes, like the home page: the footer reads the
// platform's details from the API (lib/platform-settings.ts).
export const revalidate = 300;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { meta } = getFeatures(locale);
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: `/${locale}/features`, languages: { ar: "/ar/features", en: "/en/features" } },
    openGraph: {
      title: meta.title,
      description: meta.description,
      type: "website",
      url: `/${locale}/features`,
      images: [ogImage(locale)],
    },
  };
}

/**
 * Everything a merchant gets (content/features): the promise and the way in,
 * a bar of the sections that stays under the header with a search over the
 * cards, a section per area with a card per feature, and the closing band.
 */
export default async function FeaturesPage({ params }: Params) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const copy = getFeatures(locale);
  const sections = FEATURE_SECTION_IDS.map((id) => ({
    id,
    label: copy.sections[id].label,
    title: copy.sections[id].title,
  }));

  return (
    <>
      <SiteHeader />
      <main id="main" className="lz-page ft-page">
        <section className="lz-hero ft-hero" aria-labelledby="ft-h1">
          <Backdrop id="lz-wave-features" grid />
          <div className="lz-in ft-hero__in">
            <span className="lz-eye">{copy.hero.kicker}</span>
            <h1 className="lz-h1" id="ft-h1">
              {copy.hero.heading}
            </h1>
            <p className="lz-hero__body">{copy.hero.body}</p>
            <div className="lz-ctas">
              <a className="lz-btn" href={REGISTER_URL}>
                {copy.hero.cta}
                <Arrow size={18} className="lz-arrow" />
              </a>
            </div>
          </div>
        </section>

        <div className="ft-body">
          <FeaturesNav key={locale} sections={sections} copy={copy.bar} />
          <div id="ft-list">
            {FEATURE_SECTION_IDS.map((id) => (
              <FeatureSection key={id} id={id} copy={copy} locale={locale} />
            ))}
          </div>
        </div>

        <FinalCta copy={copy.cta} phones={false} />
      </main>
      <SiteFooter copy={dict.footer} brand={dict.brand} locale={locale} />
    </>
  );
}
