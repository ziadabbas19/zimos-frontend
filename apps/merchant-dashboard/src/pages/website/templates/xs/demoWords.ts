/**
 * A template's sample words in the other language. Only the words the template
 * itself came with are ever replaced, and only when they are still exactly as
 * it wrote them: anything the merchant typed stays as it is.
 */

/** Props and settings that are never words: what they hold is a choice, an address, a picture or a product's slug. */
const NOT_WORDS = new Set(["look", "variant", "layout", "image", "images", "phoneImage", "video", "product", "also", "icon", "kind", "url", "collection", "align", "headingWeight", "imageRatio", "imageFit", "endsAt", "xsLook", "primaryColor", "primaryColorSource", "id", "type", "width", "padding"]);

/** `value` with every shown English string that `strings` knows put in Arabic. */
export function inArabic<T>(value: T, strings: Record<string, string>, key = ""): T {
  if (NOT_WORDS.has(key) || /(?:Href|href|Color|Url)$/.test(key)) return value;
  if (typeof value === "string") return (Object.hasOwn(strings, value) ? strings[value] : value) as T;
  if (Array.isArray(value)) return value.map((item) => inArabic(item, strings, key)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, inArabic(v, strings, k)])) as T;
  }
  return value;
}

export type DemoLanguage = "ar" | "en";

/** The template's sample words as the replacements that lead to `target`. */
export function demoWordsTo(strings: Record<string, string>, target: DemoLanguage): Record<string, string> {
  if (target === "ar") return strings;
  const back: Record<string, string> = {};
  for (const [english, arabic] of Object.entries(strings)) if (!Object.hasOwn(back, arabic)) back[arabic] = english;
  return back;
}

/** How many of the words in `value` are the template's sample words in the other language. */
export function demoWordCount(value: unknown, words: Record<string, string>, key = ""): number {
  if (NOT_WORDS.has(key) || /(?:Href|href|Color|Url)$/.test(key)) return 0;
  if (typeof value === "string") return Object.hasOwn(words, value) && words[value] !== value ? 1 : 0;
  if (Array.isArray(value)) return value.reduce<number>((sum, item) => sum + demoWordCount(item, words, key), 0);
  if (value && typeof value === "object") return Object.entries(value).reduce<number>((sum, [k, v]) => sum + demoWordCount(v, words, k), 0);
  return 0;
}

const DICTIONARIES = import.meta.glob<{ look: string; strings: Record<string, string> }>("./ar/xs*.ar.json", { import: "default" });

/** A template's sample words, English to Arabic; null for a template that has none. */
export async function loadDemoWords(look: string): Promise<Record<string, string> | null> {
  const load = DICTIONARIES[`./ar/xs${look}.ar.json`];
  return load ? (await load()).strings : null;
}
