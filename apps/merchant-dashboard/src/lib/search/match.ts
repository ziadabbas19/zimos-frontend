import { foldText } from "@/pages/offers/hub/foldText";

/**
 * The matching behind every search of the dashboard's own places (Spotlight,
 * the settings lists): both languages at once, forgiving of how Arabic is
 * typed, and of a slip of the finger.
 *
 * Text is folded first (pages/offers/hub/foldText: case, Arabic marks, أ إ آ
 * ٱ → ا, ؤ → و, ئ → ي, ى → ي, ة → ه, Arabic digits), then cut into words; a
 * word of four letters or more loses a leading «ال», so «شحن» and «الشحن»
 * are the same word. A query matches when every one of its words is found
 * somewhere in the item; how well each word is found decides the order:
 *
 *   the whole query is the title > it starts the title > title words >
 *   the extra words (keywords) > the description > the place it sits in,
 *
 * and a word found only by one or two slips (a letter missing, extra,
 * changed, or two swapped) counts least.
 */

/** What an item is searched by. Every list is in both languages. */
export interface Searchable {
  /** The item's name, in each language. */
  titles: readonly string[];
  /** Other words it is found by (synonyms, the other spelling). */
  keywords?: readonly string[];
  /** One line of what it is for. */
  details?: readonly string[];
  /** The names of the places it sits in (its breadcrumb). */
  trail?: readonly string[];
}

/** Characters that split words, besides spaces. */
const SEPARATORS = /[\s\-_/\\|·•,.:;!?()[\]{}&+*'"`«»“”‘’،؛؟]+/u;

function stem(word: string): string {
  return word.length > 3 && word.startsWith("ال") ? word.slice(2) : word;
}

/** Folded words of a text, as the search compares them. */
export function searchWords(text: string): string[] {
  return foldText(text).split(SEPARATORS).filter(Boolean).map(stem);
}

/**
 * The edit distance of two words (an optimal string alignment: insert,
 * delete, change, swap two neighbours), or `max + 1` as soon as it is known
 * to be more than `max`.
 */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a === b) return 0;
  let before: number[] = [];
  let previous: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row: number[] = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, before[j - 2] + 1);
      row.push(value);
      if (value < best) best = value;
    }
    if (best > max) return max + 1;
    before = previous;
    previous = row;
  }
  return previous[b.length];
}

/** How many slips a word of this length may have: none under four letters, one up to seven, two from eight. */
function slipsAllowed(length: number): number {
  return length < 4 ? 0 : length < 8 ? 1 : 2;
}

/** How well one query word is found among some words: 1 is the word itself, 0 not at all. */
function wordLevel(query: string, words: readonly string[]): number {
  let level = 0;
  const slips = slipsAllowed(query.length);
  for (const word of words) {
    if (word === query) return 1;
    if (word.startsWith(query)) level = Math.max(level, 0.9);
    // A word a little shorter than what was typed (a plural, an ending): "orders" finds "order".
    else if (word.length >= 4 && query.startsWith(word) && query.length - word.length <= 2) level = Math.max(level, 0.75);
    else if (query.length >= 2 && word.includes(query)) level = Math.max(level, 0.7);
    else if (slips > 0 && level < 0.45) {
      // A slip, in the whole word or in the start of it (the word still being typed).
      const whole = editDistance(query, word, slips);
      const start = word.length > query.length ? editDistance(query, word.slice(0, query.length), slips) : whole;
      if (Math.min(whole, start) <= slips) level = 0.45;
    }
  }
  return level;
}

interface Prepared {
  titleWords: string[];
  titlePhrases: string[];
  keywordWords: string[];
  keywordPhrases: string[];
  detailWords: string[];
  trailWords: string[];
}

const prepared = new WeakMap<Searchable, Prepared>();

function prepare(item: Searchable): Prepared {
  let ready = prepared.get(item);
  if (!ready) {
    const words = (texts: readonly string[] | undefined) => (texts ?? []).flatMap(searchWords);
    const phrases = (texts: readonly string[] | undefined) => (texts ?? []).map((text) => searchWords(text).join(" ")).filter(Boolean);
    ready = {
      titleWords: words(item.titles),
      titlePhrases: phrases(item.titles),
      keywordWords: words(item.keywords),
      keywordPhrases: phrases(item.keywords),
      detailWords: words(item.details),
      trailWords: words(item.trail),
    };
    prepared.set(item, ready);
  }
  return ready;
}

/** Each part of an item, and how much a word found in it weighs. */
const WEIGHTS = { title: 100, keyword: 75, detail: 45, trail: 35 } as const;

/**
 * How well `query` matches `item`: 0 when some word of the query is found
 * nowhere in it; otherwise the higher, the closer (about 30 to 160).
 */
export function matchScore(query: string, item: Searchable): number {
  const words = searchWords(query);
  if (words.length === 0) return 0;
  const ready = prepare(item);
  let sum = 0;
  for (const word of words) {
    const score = Math.max(
      wordLevel(word, ready.titleWords) * WEIGHTS.title,
      wordLevel(word, ready.keywordWords) * WEIGHTS.keyword,
      wordLevel(word, ready.detailWords) * WEIGHTS.detail,
      wordLevel(word, ready.trailWords) * WEIGHTS.trail
    );
    if (score === 0) return 0;
    sum += score;
  }
  const phrase = words.join(" ");
  let bonus = 0;
  if (ready.titlePhrases.includes(phrase)) bonus = 60;
  else if (ready.titlePhrases.some((title) => title.startsWith(phrase))) bonus = 40;
  else if (words.length > 1 && ready.titlePhrases.some((title) => title.includes(phrase))) bonus = 25;
  else if (ready.keywordPhrases.includes(phrase)) bonus = 30;
  else if (ready.keywordPhrases.some((keyword) => keyword.startsWith(phrase))) bonus = 15;
  return sum / words.length + bonus;
}
