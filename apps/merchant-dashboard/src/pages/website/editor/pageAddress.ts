import type { WebsitePage } from "@store-builder/api-client";

/**
 * A page's address on the store, as the merchant writes it: the part after the
 * first slash. The server refuses the same reserved words
 * (Backend pagesService RESERVED_PAGE_SEGMENTS): keep the two lists in step.
 * The server's words with a dot in them need no line here: an address can't hold a dot.
 */
export const RESERVED_PAGE_WORDS: readonly string[] = [
  "f",
  "cart",
  "checkout",
  "products",
  "orders",
  "offer",
  "track",
  "preview",
  "pay",
  "policies",
  "downloads",
  "affiliate",
  "subscriptions",
  "looks",
  "learn",
  "store-reviews",
  "account",
  "blog",
  "compare",
  "gift-card",
  "r",
  "unsubscribe",
  "search",
  "login",
  "register",
];

export type AddressProblem = "empty" | "format" | "reserved" | "taken";

const ARABIC_LETTERS: Record<string, string> = {
  ا: "a", أ: "a", إ: "e", آ: "a", ب: "b", ت: "t", ث: "th", ج: "g", ح: "h", خ: "kh", د: "d", ذ: "z", ر: "r", ز: "z",
  س: "s", ش: "sh", ص: "s", ض: "d", ط: "t", ظ: "z", ع: "a", غ: "gh", ف: "f", ق: "k", ك: "k", ل: "l", م: "m", ن: "n",
  ه: "h", ة: "a", و: "w", ؤ: "o", ي: "y", ى: "a", ئ: "e", ء: "",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

/** "Our Story" → "our-story"; an Arabic name is written in English letters, «من نحن» → "mn-nhn". */
export function slugFromName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ًͯ-ْ]/g, "")
    .toLowerCase()
    .replace(/[؀-ۿ]/g, (letter) => ARABIC_LETTERS[letter] ?? "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
}

export const pathOfSlug = (slug: string) => `/${slug.trim().replace(/^\/+/, "")}`;
export const slugOfPath = (path: string) => path.replace(/^\/+/, "");

/** What is wrong with an address; null when it can be used. A page may always keep the address it has. */
export function addressProblem(slug: string, takenPaths: readonly string[], ownPath?: string): AddressProblem | null {
  const clean = slug.trim().replace(/^\/+/, "");
  if (clean === "") return "empty";
  const path = `/${clean}`;
  if (ownPath !== undefined && path === ownPath) return null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(clean)) return "format";
  if (RESERVED_PAGE_WORDS.includes(clean.split("/")[0] ?? "")) return "reserved";
  return takenPaths.includes(path) ? "taken" : null;
}

/** The pages as the merchant ordered them: home first, then their chosen order, then the rest by address. */
export function orderPages(pages: readonly WebsitePage[]): WebsitePage[] {
  const place = (page: WebsitePage) => (page.pageType === "home" ? -1 : (page.menuOrder ?? Number.MAX_SAFE_INTEGER));
  return [...pages].sort((a, b) => place(a) - place(b) || a.path.localeCompare(b.path));
}

/** A free address for a copy of a page: /about-copy, then /about-copy-2… */
export function copyPath(path: string, takenPaths: readonly string[]): string {
  const base = path === "/" ? "/home" : path;
  let candidate = `${base}-copy`;
  for (let n = 2; takenPaths.includes(candidate); n += 1) candidate = `${base}-copy-${n}`;
  return candidate;
}
