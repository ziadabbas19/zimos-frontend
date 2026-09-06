import type { Locale } from "./config";
import type { Dictionary } from "./dictionary";
import { ar } from "./dictionaries/ar";
import { en } from "./dictionaries/en";

const dictionaries: Record<Locale, Dictionary> = { ar, en };

/**
 * Dictionary lookup, called from Server Components (the root layout and page).
 * The dictionaries are tiny and static, so this is synchronous — the selected
 * `Dictionary` object is handed to the client `I18nProvider` through the RSC
 * payload, so client code never imports the other locale's copy.
 */
export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type { Dictionary };
