/**
 * Text folded for a forgiving search: case, Arabic marks and the letters people
 * type either way (أ إ آ → ا, ى → ي, ة → ه), and Arabic digits as Latin ones —
 * so «اضافات» finds «إضافات» and «٢٠» finds "20".
 */
export function foldText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0629/g, "\u0647")
    .replace(/\u0624/g, "\u0648")
    .replace(/\u0626/g, "\u064A")
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/\s+/g, " ")
    .trim();
}

/** Whether every word of `query` is somewhere in `haystack` (both folded here). */
export function matchesFolded(haystack: string, query: string): boolean {
  const words = foldText(query).split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const folded = foldText(haystack);
  return words.every((word) => folded.includes(word));
}
