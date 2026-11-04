import { ar } from "./i18nAr";
import { en, type Dictionary } from "./i18nEn";
import { fr } from "./i18nFr";
import type { Locale } from "./i18n";

/** Every language at once: what the server reads (lib/i18n.ts). Never imported by browser code. */
export const ALL_DICTIONARIES: Record<Locale, Dictionary> = { ar, en, fr };
