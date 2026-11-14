import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Metadata } from "next";
import { describe, expect, it } from "vitest";
import { SOCIAL_LINKS } from "@store-builder/ui/social-links";
import { generateMetadata as homeMetadata } from "@/app/[locale]/page";
import { generateMetadata as featuresMetadata } from "@/app/[locale]/features/page";
import { generateMetadata as pricingMetadata } from "@/app/[locale]/pricing/page";
import { generateMetadata as refundMetadata } from "@/app/[locale]/refund-policy/page";
import { generateMetadata as termsMetadata } from "@/app/[locale]/terms/page";
import { generateMetadata as privacyMetadata } from "@/app/[locale]/privacy/page";
import { generateMetadata as contactMetadata } from "@/app/[locale]/contact/page";
import { generateMetadata as creditsMetadata } from "@/app/[locale]/credits/page";
import { getDictionary } from "@/i18n/dictionaries";
import { LOGO_URL, SITE_NAME, homeJsonLd, jsonLdScript } from "./seo";
import { SITE_URL } from "./urls";

/**
 * What search engines read on every page of the site, in both languages: a
 * title and description of its own, a canonical address that is the page
 * itself, the page in the other language and x-default, and the Open Graph
 * and Twitter tags. And the home page's structured data.
 */

type MetadataOf = (args: { params: Promise<{ locale: string }> }) => Metadata | Promise<Metadata>;

const PAGES: Array<[path: string, metadataOf: MetadataOf]> = [
  ["", homeMetadata],
  ["/features", featuresMetadata],
  ["/pricing", pricingMetadata],
  ["/refund-policy", refundMetadata],
  ["/terms", termsMetadata],
  ["/privacy", privacyMetadata],
  ["/contact", contactMetadata],
  ["/credits", creditsMetadata],
];

const LOCALES = ["ar", "en"] as const;

async function metadataOf(path: string, locale: string) {
  const page = PAGES.find(([p]) => p === path)!;
  return page[1]({ params: Promise.resolve({ locale }) });
}

const each = LOCALES.flatMap((locale) => PAGES.map(([path]) => [locale, path || "/"] as const));
const pathOf = (shown: string) => (shown === "/" ? "" : shown);

describe("every page's metadata", () => {
  it.each(each)("%s %s: title, description, canonical and language links", async (locale, shown) => {
    const path = pathOf(shown);
    const meta = await metadataOf(path, locale);

    expect(meta.title).toMatch(/Zimos/);
    expect(typeof meta.description).toBe("string");
    expect((meta.description as string).length).toBeGreaterThanOrEqual(40);
    expect(meta.alternates?.canonical).toBe(`/${locale}${path}`);
    expect(meta.alternates?.languages).toEqual({ ar: `/ar${path}`, en: `/en${path}`, "x-default": path || "/" });
  });

  it.each(each)("%s %s: Open Graph and the Twitter card", async (locale, shown) => {
    const path = pathOf(shown);
    const meta = await metadataOf(path, locale);
    const og = meta.openGraph as Record<string, unknown>;
    const twitter = meta.twitter as Record<string, unknown>;

    expect(og).toMatchObject({
      title: meta.title,
      description: meta.description,
      url: `/${locale}${path}`,
      siteName: SITE_NAME,
      locale: locale === "ar" ? "ar_EG" : "en_US",
      alternateLocale: [locale === "ar" ? "en_US" : "ar_EG"],
    });
    expect(og.images).toEqual([expect.objectContaining({ url: `/og/zimos-og-${locale}.png`, width: 1200, height: 630 })]);
    expect(twitter).toMatchObject({ card: "summary_large_image", title: meta.title, description: meta.description });
    expect(twitter.images).toEqual([expect.objectContaining({ url: `/og/zimos-og-${locale}.png` })]);
  });

  it("gives no two pages the same title or the same description", async () => {
    const all = await Promise.all(each.map(([locale, shown]) => metadataOf(pathOf(shown), locale)));
    const titles = all.map((meta) => meta.title);
    const descriptions = all.map((meta) => meta.description);
    expect(new Set(titles).size).toBe(all.length);
    expect(new Set(descriptions).size).toBe(all.length);
  });

  it("puts Zimos first on the home page, with what it is", async () => {
    for (const locale of LOCALES) {
      const { title } = await metadataOf("", locale);
      expect(title).toMatch(/^Zimos — /);
    }
    expect((await metadataOf("", "ar")).title).toContain("منصة إنشاء متجر إلكتروني");
    expect((await metadataOf("", "en")).title).toContain("Online Store Builder");
  });

  it("has the link-preview images on disk", () => {
    for (const locale of LOCALES) {
      expect(existsSync(resolve(__dirname, `../../public/og/zimos-og-${locale}.png`))).toBe(true);
    }
  });
});

describe("the home page's structured data", () => {
  const graph = (data: ReturnType<typeof homeJsonLd>) =>
    Object.fromEntries(data["@graph"].map((node) => [node["@type"], node as Record<string, unknown>]));

  it("is an Organization and a WebSite named Zimos, as valid JSON", () => {
    const description = getDictionary("en").meta.description;
    const parsed = JSON.parse(jsonLdScript(homeJsonLd({ description, socialLinks: SOCIAL_LINKS })));
    expect(parsed["@context"]).toBe("https://schema.org");
    const nodes = graph(parsed);
    expect(Object.keys(nodes).sort()).toEqual(["Organization", "WebSite"]);

    expect(nodes.Organization).toMatchObject({ name: "Zimos", url: `${SITE_URL}/`, logo: LOGO_URL, description });
    expect(nodes.WebSite).toMatchObject({ name: "Zimos", url: `${SITE_URL}/`, publisher: { "@id": nodes.Organization["@id"] } });
  });

  it("has the logo it names on disk", () => {
    expect(LOGO_URL.startsWith(`${SITE_URL}/`)).toBe(true);
    expect(existsSync(resolve(__dirname, "../../public", LOGO_URL.slice(SITE_URL.length + 1)))).toBe(true);
  });

  it("lists the social profiles the footer shows, and no chat link or email", () => {
    const nodes = graph(homeJsonLd({ description: "x", socialLinks: SOCIAL_LINKS }));
    const sameAs = nodes.Organization.sameAs as string[];
    expect(sameAs.length).toBeGreaterThan(0);
    for (const href of sameAs) expect(href).toMatch(/^https:\/\//);
    expect(sameAs.some((href) => href.includes("wa.me") || href.startsWith("mailto:"))).toBe(false);
    const profiles = SOCIAL_LINKS.filter((link) => link.enabled && !["whatsapp", "email"].includes(link.platform));
    expect(sameAs).toHaveLength(profiles.length);
  });

  it("leaves sameAs empty when there is no account, and invents none", () => {
    const nodes = graph(homeJsonLd({ description: "x", socialLinks: [] }));
    expect(nodes.Organization.sameAs).toEqual([]);
  });

  it("cannot close its script tag", () => {
    const script = jsonLdScript(homeJsonLd({ description: "</script><script>alert(1)</script>", socialLinks: [] }));
    expect(script).not.toContain("<");
    expect(JSON.parse(script)["@graph"][0].description).toBe("</script><script>alert(1)</script>");
  });
});
