import type { PageElement } from "@store-builder/api-client";
import type { EditorLocale } from "../editorLocale";
import { describeLink } from "./fields";
import { countWord, inspectorNumber, inspectorUi, type CountNoun } from "./strings";

/**
 * One line that says what an element holds — its own words when it has any,
 * else what is in it («٣ صور», «صورة واحدة»). Shown under the element's name
 * in the section's list, in the editor's language.
 */

/** Props that carry the words a shopper reads, most telling first. */
const WORD_KEYS = ["text", "label", "title", "heading", "quote", "body", "kicker", "address", "name"] as const;

/** The list an element is made of, and what one entry of it is called. */
const LISTS: Record<string, { key: string; noun: CountNoun }> = {
  gallery: { key: "images", noun: "picture" },
  carousel: { key: "images", noun: "picture" },
  image_gallery: { key: "images", noun: "picture" },
  masonry_grid: { key: "items", noun: "picture" },
  faq: { key: "items", noun: "question" },
  accordion: { key: "items", noun: "row" },
  list: { key: "items", noun: "point" },
  marquee: { key: "items", noun: "point" },
  tabs: { key: "items", noun: "tab" },
  comparison: { key: "rows", noun: "row" },
  scroll_story: { key: "steps", noun: "step" },
  social_icons: { key: "links", noun: "link" },
  hero_slider: { key: "slides", noun: "slide" },
  category_tiles: { key: "items", noun: "category" },
  trust_strip: { key: "items", noun: "card" },
  video_reels: { key: "items", noun: "video" },
  need_picker: { key: "stages", noun: "need" },
};

/** Props that hold where the element sends the shopper. */
const LINK_KEYS = ["href", "buttonHref", "ctaHref"] as const;

function clean(value: string, max = 80): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function elementSummary(element: PageElement, locale: EditorLocale): string {
  const t = inspectorUi(locale);
  const props = (element.props ?? {}) as Record<string, unknown>;
  const text = (key: string) => (typeof props[key] === "string" ? clean(props[key] as string) : "");
  const parts: string[] = [];

  if (element.type === "image") {
    // A picture is its own summary: say whether there is one, then what it shows.
    if (!text("src")) return countWord("picture", 0, locale);
    return text("alt") || countWord("picture", 1, locale);
  }
  if (element.type === "spacer") {
    return typeof props.height === "number" ? `${inspectorNumber(props.height, locale)}px` : "";
  }

  const words = WORD_KEYS.map(text).find(Boolean);
  if (words) parts.push(words);

  const list = LISTS[element.type];
  if (list) {
    const entries = props[list.key];
    parts.push(countWord(list.noun, Array.isArray(entries) ? entries.length : 0, locale));
  }

  // A button or a link also says where it goes.
  if (element.type === "button" || element.type === "text_link") {
    const href = LINK_KEYS.map(text).find(Boolean);
    const target = href ? describeLink(href, t) : null;
    if (target && !target.unclear) parts.push(target.words);
  }

  if (parts.length === 0) {
    const url = text("url") || text("video");
    if (url) parts.push(url);
  }
  return parts.join(" · ");
}
