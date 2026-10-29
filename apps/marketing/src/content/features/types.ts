/**
 * The words of the features page (/features) and of its summary on the home
 * page. They live here, not in the site dictionary, and only these two Server
 * Components read them.
 *
 * Source: the owner's list of what a merchant gets (2026-10-28), shortened
 * where a line was long: the page keeps the list's Egyptian Arabic, the home
 * summary is in the home page's Modern Standard Arabic. Not on these pages: brand
 * names of shipping companies or payment gateways, prices, AI or "smart",
 * Shopify, device notifications, total counts of features, numbers that read
 * as a plan's limit (the page does not tell plans apart), and what the list
 * marks as not built (features.test.ts checks the words).
 */

/** The sections, in page order; each id is its anchor (`/features#orders`). */
export const FEATURE_SECTION_IDS = [
  "products",
  "orders",
  "shipping",
  "payments",
  "fraud",
  "customers",
  "marketing",
  "store",
  "reports",
  "notifications",
  "team",
  "developers",
] as const;

export type FeatureSectionId = (typeof FEATURE_SECTION_IDS)[number];

/** The home page's eight cards, each opening its section of /features. */
export const HOME_CARD_IDS = [
  "orders",
  "shipping",
  "payments",
  "fraud",
  "marketing",
  "store",
  "reports",
  "loyalty",
] as const;

export type HomeCardId = (typeof HOME_CARD_IDS)[number];

export interface FeatureItem {
  title: string;
  body: string;
}

export interface FeatureSection {
  /** Short, in the row of sections; the phone menu shows the title. */
  label: string;
  title: string;
  /** One line under the title. */
  intro: string;
  items: FeatureItem[];
}

export interface FeaturesCopy {
  meta: {
    title: string;
    description: string;
  };

  hero: {
    kicker: string;
    heading: string;
    body: string;
    cta: string;
  };

  /** The sticky bar: the sections, and the search over them. */
  bar: {
    navLabel: string;
    /** The phone menu's name. */
    jumpLabel: string;
    searchLabel: string;
    searchPlaceholder: string;
    /** The phone's search button, which opens the field in place of the menu. */
    openSearch: string;
    empty: string;
    /** Empties the field (and closes it on a phone). */
    clearSearch: string;
  };

  sections: Record<FeatureSectionId, FeatureSection>;

  /** Real dashboard captures (public/product) shown in two sections. */
  shots: {
    caption: string;
    orders: string;
    profit: string;
  };

  /** The closing band, the same words as the home page's. */
  cta: {
    heading: string;
    body: string;
    primaryCta: string;
    secondaryCta: string;
  };

  /** The summary on the home page. */
  home: {
    kicker: string;
    heading: string;
    intro: string;
    cards: Record<HomeCardId, FeatureItem>;
    cta: string;
  };
}
