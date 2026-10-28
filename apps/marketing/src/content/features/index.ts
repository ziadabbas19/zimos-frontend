import type { Locale } from "@/i18n/config";
import { ar } from "./ar";
import { en } from "./en";
import type { FeaturesCopy } from "./types";

export { FEATURE_SECTION_IDS, HOME_CARD_IDS } from "./types";
export type { FeatureItem, FeatureSection, FeatureSectionId, FeaturesCopy, HomeCardId } from "./types";

const copies: Record<Locale, FeaturesCopy> = { ar, en };

/** The features page's words in a language — for Server Components only. */
export function getFeatures(locale: Locale): FeaturesCopy {
  return copies[locale];
}
