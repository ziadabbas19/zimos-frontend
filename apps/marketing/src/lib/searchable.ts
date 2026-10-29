/**
 * Text as the features search compares it: lower case, without marks (Arabic
 * diacritics, Latin accents) or tatweel, with one alef (أ إ آ → ا, through
 * NFKD), ى → ي and ة → ه — so "اسعار" finds "أسعار" and "شحنه" finds "شحنة".
 */
export function searchable(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/ـ/g, "")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase();
}

/** Every word of the query is somewhere in the text. */
export function matchesQuery(text: string, query: string): boolean {
  const words = searchable(query).split(/\s+/).filter(Boolean);
  const hay = searchable(text);
  return words.every((word) => hay.includes(word));
}
