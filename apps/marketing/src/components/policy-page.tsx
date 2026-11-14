import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { socialLinksOf, type PublicPlatformSettings } from "@store-builder/ui/platform-info";
import { SocialLinks } from "@store-builder/ui/social-links";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formatLongDate } from "@/lib/format";
import { getPlatformSettings } from "@/lib/platform-settings";
import { pageMetadata, titleOf } from "@/lib/seo";
import { POLICIES_LAST_UPDATED, POLICY_SLUGS, companyDetails, policyPage, type PolicySlug } from "@/lib/policies";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { container } from "./ui";

/** Title, description and the page's address in both languages. */
export function policyMetadata(slug: PolicySlug, locale: string): Metadata {
  if (!isLocale(locale)) return {};
  const page = policyPage(slug, locale);
  return pageMetadata({ locale, path: `/${slug}`, title: titleOf(page.title), description: page.description, type: "article" });
}

/**
 * A policy page (refund policy, terms, privacy) or the contact page: its
 * title, the "last updated" date, the text from src/content/policies.json,
 * and — on the contact page — the contact details, ZIMOS's social accounts
 * and the entity details. The contact and entity details, in the text too,
 * follow the console when PLATFORM_SETTINGS_ENABLED is on (lib/policies.ts).
 */
export async function PolicyPage({ slug, params }: { slug: PolicySlug; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const settings = await getPlatformSettings();
  const page = policyPage(slug, locale, settings);
  const related = POLICY_SLUGS.filter((other) => other !== slug);

  return (
    <>
      <SiteHeader />
      <main id="main" className="bg-paper py-14 sm:py-20">
        <div className={`${container} max-w-3xl`}>
          <article>
            <h1 className="text-3xl font-bold text-ink sm:text-4xl">{page.title}</h1>
            <p className="mt-3 text-sm text-ink-soft">
              <time dateTime={POLICIES_LAST_UPDATED}>
                {dict.legal.lastUpdated.replace("{date}", formatLongDate(POLICIES_LAST_UPDATED, locale))}
              </time>
            </p>
            <p className="mt-6 text-lg leading-relaxed text-pretty text-ink">{page.intro}</p>

            {slug === "contact" ? <ContactDetails locale={locale} settings={settings} /> : null}

            {page.sections.map((section) => (
              <section key={section.heading} className="mt-10">
                <h2 className="text-xl font-bold text-ink">{section.heading}</h2>
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="mt-3 leading-relaxed text-pretty text-ink-soft">
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </article>

          <nav aria-labelledby="related-heading" className="mt-14 border-t border-line pt-6">
            <h2 id="related-heading" className="text-sm font-semibold text-ink">
              {dict.legal.relatedHeading}
            </h2>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
              {related.map((other) => (
                <li key={other}>
                  <Link href={`/${locale}/${other}`} className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">
                    {policyPage(other, locale).title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </main>
      <SiteFooter copy={dict.footer} brand={dict.brand} locale={locale} />
    </>
  );
}

/** A value someone filled in, not a "[placeholder]" still waiting for one. */
const isReal = (value: string) => !value.includes("[");

function ContactDetails({ locale, settings }: { locale: Locale; settings: PublicPlatformSettings | null }) {
  const { legal } = getDictionary(locale);
  const company = companyDetails(locale, settings);
  const row = (label: string, value: React.ReactNode) => (
    <div className="grid gap-1 border-b border-line py-3 sm:grid-cols-[10rem_1fr]">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
  return (
    <div className="mt-10 grid gap-8">
      <section aria-labelledby="contact-heading">
        <h2 id="contact-heading" className="text-xl font-bold text-ink">
          {legal.contactHeading}
        </h2>
        <dl className="mt-3">
          {row(
            legal.email,
            isReal(company.email) && company.email.includes("@") ? (
              <a href={`mailto:${company.email}`} dir="ltr" className="text-primary underline underline-offset-2">
                {company.email}
              </a>
            ) : (
              <span dir="ltr">{company.email}</span>
            )
          )}
          {row(
            legal.phone,
            isReal(company.phone) ? (
              <a href={`tel:${company.phone.replace(/[^\d+]/g, "")}`} dir="ltr" className="text-primary underline underline-offset-2">
                {company.phone}
              </a>
            ) : (
              <span dir="ltr">{company.phone}</span>
            )
          )}
          {row(legal.address, company.address)}
          {row(legal.hours, company.hours)}
        </dl>
      </section>
      <SocialLinks locale={locale} links={socialLinksOf(settings)} heading={legal.socialHeading} headingClassName="text-xl font-bold text-ink" />
      <section aria-labelledby="entity-heading">
        <h2 id="entity-heading" className="text-xl font-bold text-ink">
          {legal.entityHeading}
        </h2>
        <dl className="mt-3">
          {row(legal.legalName, company.legalName)}
          {row(legal.registration, company.registration)}
          {row(legal.taxRegistration, <span dir="ltr">{company.taxRegistration}</span>)}
        </dl>
      </section>
    </div>
  );
}
