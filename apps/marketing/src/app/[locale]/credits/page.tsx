import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { container } from "@/components/ui";
import { ogImage } from "@/lib/og";
import { GALLERY_LOOKS, SHOT_CREDITS } from "@/lib/store-shots";

type Params = { params: Promise<{ locale: string }> };

/**
 * The site's other free resources: the icons (components/duo-icons.tsx,
 * components/color-icon.tsx) and the fonts (app/fonts.ts).
 */
const RESOURCES = [
  { name: "Phosphor Icons", href: "https://phosphoricons.com", licence: "MIT" },
  { name: "Fraunces", href: "https://fonts.google.com/specimen/Fraunces", licence: "SIL Open Font License 1.1" },
  { name: "Plus Jakarta Sans", href: "https://fonts.google.com/specimen/Plus+Jakarta+Sans", licence: "SIL Open Font License 1.1" },
  { name: "Tajawal", href: "https://fonts.google.com/specimen/Tajawal", licence: "SIL Open Font License 1.1" },
];

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { credits } = getDictionary(locale);
  return {
    title: `${credits.title} — ZIMOS`,
    description: credits.description,
    alternates: { canonical: `/${locale}/credits`, languages: { ar: "/ar/credits", en: "/en/credits" } },
    openGraph: {
      title: `${credits.title} — ZIMOS`,
      description: credits.description,
      type: "article",
      url: `/${locale}/credits`,
      images: [ogImage(locale)],
    },
  };
}

const link = "text-primary underline underline-offset-2";

/**
 * The credit each store design's licence asks for wherever it is shown
 * (lib/store-shots.ts SHOT_CREDITS, every look on the site), then the icons
 * and fonts the site uses. Linked from every page's footer.
 */
export default async function CreditsPage({ params }: Params) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const { credits } = dict;

  return (
    <>
      <SiteHeader />
      <main id="main" className="bg-paper py-14 sm:py-20">
        <div className={`${container} max-w-3xl`}>
          <article>
            <h1 className="text-3xl font-bold text-ink sm:text-4xl">{credits.title}</h1>
            <p className="mt-6 text-lg leading-relaxed text-pretty text-ink">{credits.intro}</p>

            <section aria-labelledby="credits-templates" className="mt-10">
              <h2 id="credits-templates" className="text-xl font-bold text-ink">
                {credits.templatesHeading}
              </h2>
              <p className="mt-3 leading-relaxed text-pretty text-ink-soft">{credits.templatesLead}</p>
              <ul className="mt-3 grid gap-2 leading-relaxed text-ink-soft">
                {GALLERY_LOOKS.map((look) => {
                  const { name, author, href, licence, licenceHref } = SHOT_CREDITS[look];
                  return (
                    <li key={look}>
                      {dict.templates.templateLabel.replace("{n}", look)}:{" "}
                      <bdi lang="en" dir="ltr">
                        {name} by{" "}
                        <a href={href} target="_blank" rel="noopener noreferrer" className={link}>
                          {author}
                        </a>{" "}
                        (
                        {licenceHref ? (
                          <a href={licenceHref} target="_blank" rel="noopener noreferrer" className={link}>
                            {licence}
                          </a>
                        ) : (
                          licence
                        )}
                        )
                      </bdi>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section aria-labelledby="credits-resources" className="mt-10">
              <h2 id="credits-resources" className="text-xl font-bold text-ink">
                {credits.resourcesHeading}
              </h2>
              <ul className="mt-3 grid gap-2 leading-relaxed text-ink-soft">
                {RESOURCES.map(({ name, href, licence }) => (
                  <li key={name}>
                    <bdi lang="en" dir="ltr">
                      <a href={href} target="_blank" rel="noopener noreferrer" className={link}>
                        {name}
                      </a>{" "}
                      ({licence})
                    </bdi>
                  </li>
                ))}
              </ul>
            </section>
          </article>
        </div>
      </main>
      <SiteFooter copy={dict.footer} brand={dict.brand} locale={locale} />
    </>
  );
}
