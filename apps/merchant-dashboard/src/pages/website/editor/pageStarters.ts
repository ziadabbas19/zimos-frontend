import type { PageSection, WebsitePage } from "@store-builder/api-client";
import { createSection, presetByKey, sectionElements, setElementProp } from "./blocks";
import type { EditorLocale } from "./editorLocale";

/** How a new page starts. "products" adds the store's own products page to the menu instead of making a page. */
export const PAGE_STARTERS = ["blank", "products", "about", "contact", "faq", "landing"] as const;
export type PageStarter = (typeof PAGE_STARTERS)[number];
export type PageBuildStarter = Exclude<PageStarter, "products">;

const PLANS: Record<PageBuildStarter, { title: boolean; presets: readonly string[]; pageType: WebsitePage["pageType"] }> = {
  // Just its name: the server refuses to publish a site with an empty page.
  blank: { title: true, presets: [], pageType: "custom" },
  about: { title: true, presets: ["image-text", "features", "stats-row", "cta-band"], pageType: "static" },
  contact: { title: true, presets: ["contact-map"], pageType: "static" },
  faq: { title: true, presets: ["faq", "cta-band"], pageType: "static" },
  landing: { title: false, presets: ["hero", "claims-strip", "features", "testimonials", "products", "faq", "cta-band"], pageType: "custom" },
};

export const starterPageType = (starter: PageBuildStarter) => PLANS[starter].pageType;

/** The sections a new page opens with, their sample words in the store's language. */
export function starterSections(starter: PageBuildStarter, pageName: string, language: EditorLocale): PageSection[] {
  const plan = PLANS[starter];
  const sections = plan.presets.map((key) => createSection(presetByKey(key), language));
  if (!plan.title) return sections;
  const heading = createSection({ ...presetByKey("heading"), content: [{ level: 1 }] }, language);
  const [element] = sectionElements(heading);
  return [element ? setElementProp(heading, element, "text", pageName) : heading, ...sections];
}
