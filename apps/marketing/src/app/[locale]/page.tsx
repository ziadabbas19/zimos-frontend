import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { Features } from "@/components/features";
import { Hero } from "@/components/hero";
import { Pricing } from "@/components/pricing";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default async function MarketingHome({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);

  return (
    <>
      <SiteHeader />
      <main>
        <Hero copy={dict.hero} />
        <Features copy={dict.features} />
        <Pricing copy={dict.pricing} nav={dict.nav} />
      </main>
      <SiteFooter copy={dict.footer} nav={dict.nav} />
    </>
  );
}
