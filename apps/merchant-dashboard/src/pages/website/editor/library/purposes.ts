import { BLOCK_PRESETS, ELEMENT_SPECS, type BlockPreset } from "../blocks";
import { elementLabel, groupLabel, presetText, type EditorLocale } from "../editorLocale";
import { leftUi, type LeftUi } from "./strings";

/**
 * The library sorted by what a section is FOR — the question a merchant asks
 * («عايز قسم تقييمات») — instead of by how it is built. The presets keep
 * their own groups (blocks.ts: store, hero, trust, commerce, story, convert,
 * basics), which the in-panel library still lists; this module lays the nine
 * purposes over them: a default per group, and a line for every preset whose
 * purpose its group does not say.
 *
 * Every preset has exactly one primary purpose, so the unfiltered library
 * shows each once. A few sit under a second chip too (the order form is both
 * «منتجات» and «فورم»). Nothing is left out: a preset no line names falls to
 * its group's default, and a group nobody mapped falls to «محتوى».
 */

export const PURPOSES = ["hero", "products", "offers", "trust", "reviews", "faq", "content", "form", "footer"] as const;
export type Purpose = (typeof PURPOSES)[number];

const BY_GROUP: Record<BlockPreset["group"], Purpose> = {
  store: "content",
  hero: "hero",
  trust: "trust",
  commerce: "products",
  story: "content",
  convert: "offers",
  basics: "content",
};

/** The first purpose is the primary one. */
const BY_KEY: Record<string, Purpose | readonly Purpose[]> = {
  // What a shopper sees first.
  "store-hero-slideshow": "hero",
  "store-banner-wide": "hero",
  "announcement-bar": ["hero", "offers"],

  // Browsing and buying.
  "store-departments": "products",
  "store-product-floor": "products",
  "showcase-category-tiles": "products",
  "order-summary": "products",
  "cod-form": ["products", "form"],

  // A push to act now.
  "bundle-offer": ["offers", "products"],
  "bundle-tiers": ["offers", "products"],
  "bundle-selector": ["offers", "products"],
  "store-promo-duo": "offers",
  countdown: "offers",
  popup: ["offers", "form"],

  // Reasons to trust the store.
  features: "trust",
  "why-us": "trust",
  "feature-grid-3": "trust",
  "feature-grid-4": "trust",
  "stats-row": "trust",
  "store-brand-strip": "trust",
  "store-service-row": "trust",
  "shipping-returns": ["trust", "faq"],

  // What customers said.
  testimonial: "reviews",
  testimonials: "reviews",
  "testimonial-wall": "reviews",
  "testimonial-spotlight": "reviews",
  "reviews-list": "reviews",
  "stars-display": "reviews",
  repeater: ["content", "reviews", "faq"],

  // Questions and answers.
  faq: "faq",
  "faq-split": "faq",
  "faq-cta": "faq",
  accordion: "faq",
  toggle: ["content", "faq"],

  // Something the shopper fills in.
  form: "form",
  "contact-map": "form",
  newsletter: "form",
  "newsletter-banner": "form",

  // The bottom of the page.
  "store-footer": "footer",
  "footer-links": "footer",
  social: ["footer", "content"],
};

export function purposesOf(preset: BlockPreset): readonly Purpose[] {
  const own = BY_KEY[preset.key];
  if (own === undefined) return [BY_GROUP[preset.group] ?? "content"];
  return typeof own === "string" ? [own] : own;
}

export function primaryPurpose(preset: BlockPreset): Purpose {
  return purposesOf(preset)[0] ?? "content";
}

export function purposeLabel(purpose: Purpose, t: LeftUi): string {
  switch (purpose) {
    case "hero":
      return t.purposeHero;
    case "products":
      return t.purposeProducts;
    case "offers":
      return t.purposeOffers;
    case "trust":
      return t.purposeTrust;
    case "reviews":
      return t.purposeReviews;
    case "faq":
      return t.purposeFaq;
    case "content":
      return t.purposeContent;
    case "form":
      return t.purposeForm;
    case "footer":
      return t.purposeFooter;
  }
}

/**
 * A small curated set shown before everything else, so a new merchant is not
 * staring at a hundred cards: one per common need — an opener, a reason to
 * trust the store, where to browse, what customers said, a place for
 * questions, a push to act — each the plainest preset of its kind.
 */
const POPULAR_KEYS = ["hero", "features", "products", "testimonials", "faq", "cta-band"];
export const POPULAR_PRESETS: BlockPreset[] = POPULAR_KEYS.map((key) => BLOCK_PRESETS.find((p) => p.key === key)).filter(
  (p): p is BlockPreset => p !== undefined
);
export const POPULAR_KEY_SET: ReadonlySet<string> = new Set(POPULAR_PRESETS.map((p) => p.key));

/** The presets of each purpose (primary or secondary), in the library's own order. */
export const PRESETS_BY_PURPOSE: Record<Purpose, BlockPreset[]> = (() => {
  const table = Object.fromEntries(PURPOSES.map((purpose) => [purpose, [] as BlockPreset[]])) as Record<Purpose, BlockPreset[]>;
  for (const preset of BLOCK_PRESETS) {
    for (const purpose of purposesOf(preset)) table[purpose].push(preset);
  }
  return table;
})();

/** Each preset once, under its primary purpose — what the unfiltered library lists. */
export const PRESETS_BY_PRIMARY: Record<Purpose, BlockPreset[]> = (() => {
  const table = Object.fromEntries(PURPOSES.map((purpose) => [purpose, [] as BlockPreset[]])) as Record<Purpose, BlockPreset[]>;
  for (const preset of BLOCK_PRESETS) table[primaryPurpose(preset)].push(preset);
  return table;
})();

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

// The Arabic marks a search ignores: the short vowels and the rest of the
// tashkeel, the dagger alef, and the tatweel that only stretches a word.
// Built from code points so the source holds no bare combining marks.
const ARABIC_MARKS = new RegExp(
  `[${String.fromCharCode(0x64b)}-${String.fromCharCode(0x65f)}${String.fromCharCode(0x670)}${String.fromCharCode(0x640)}]`,
  "g"
);

/**
 * Text as a search compares it (the same folding as the command palette,
 * components/CommandPalette.tsx): lower case, no tashkeel or tatweel, every
 * alef the plain one, ة as ه and ى as ي — so «اسئله» finds «أسئلة».
 */
export function foldForSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(ARABIC_MARKS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim();
}

const LOCALES: readonly EditorLocale[] = ["en", "ar"];

/** What a preset is called, folded, in both languages — a match here ranks first. */
function nameText(preset: BlockPreset): string {
  return foldForSearch([preset.label, presetText(preset.key, preset, "ar").label].join(" "));
}

/** Everything a search can match for one preset, both languages, folded. */
function searchText(preset: BlockPreset): string {
  const ar = presetText(preset.key, preset, "ar");
  const elements = preset.elements.flatMap((type) => {
    const label = ELEMENT_SPECS[type]?.label ?? "";
    return [label, elementLabel(type, label, "ar")];
  });
  const purposes = purposesOf(preset).flatMap((purpose) => LOCALES.map((locale) => purposeLabel(purpose, leftUi(locale))));
  const groups = LOCALES.map((locale) => groupLabel(preset.group, locale));
  return foldForSearch(
    [preset.label, preset.description, ar.label, ar.description, preset.group, ...groups, ...purposes, ...elements].join(" ")
  );
}

const SEARCH_INDEX = new Map(BLOCK_PRESETS.map((preset) => [preset.key, { name: nameText(preset), all: searchText(preset) }]));

/**
 * The presets matching every word of `query`, among `within` (default: all of
 * them). Those matched by their name come first; the rest keep the library's order.
 */
export function searchPresets(query: string, within: readonly BlockPreset[] = BLOCK_PRESETS): BlockPreset[] {
  const words = foldForSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...within];
  const byName: BlockPreset[] = [];
  const byRest: BlockPreset[] = [];
  for (const preset of within) {
    const entry = SEARCH_INDEX.get(preset.key);
    if (!entry || !words.every((word) => entry.all.includes(word))) continue;
    (words.every((word) => entry.name.includes(word)) ? byName : byRest).push(preset);
  }
  return [...byName, ...byRest];
}
