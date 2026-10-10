import type { PageElement } from "@store-builder/api-client";
import { optionLabel, type EditorLocale } from "../editorLocale";
import { leftUi } from "./strings";

/**
 * The one-line gist of an element in a section's outline, pulled from
 * whichever prop carries its text, in the editor's language. What it reads is
 * what it always read (the element's own words first, then a count of what it
 * holds); only the fixed words around them are translated now.
 */

function truncate(value: string, max = 90): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** A number prop that may have been typed as text. */
function numberOf(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function elementSummary(element: PageElement, locale: EditorLocale): string {
  const t = leftUi(locale);
  const props = (element.props ?? {}) as Record<string, unknown>;
  const str = (key: string) => (typeof props[key] === "string" ? (props[key] as string) : "");
  const count = (key: string) => (Array.isArray(props[key]) ? (props[key] as unknown[]).length : 0);
  const join = (parts: Array<string | false | null | undefined | 0>, glue = " · ") =>
    truncate(parts.filter((part): part is string => typeof part === "string" && part !== "").join(glue));
  const limit = numberOf(props.limit);
  // The extra builder elements are outside the api-client's element union.
  const type = element.type as string;

  switch (type) {
    case "heading":
    case "text":
    case "rich_text":
      return truncate(str("text"));
    case "button":
      return join([str("label"), str("href") && `→ ${str("href")}`], " ");
    case "image":
      return str("src") ? truncate(str("alt") || t.image) : t.noImage;
    case "gallery":
    case "carousel":
    case "image_gallery":
      return join([str("title"), t.images(count("images"))]);
    case "masonry_grid":
      return join([str("title"), t.images(count("items"))]);
    case "testimonial":
      return join([str("quote") && `“${str("quote")}”`, str("author")], " — ");
    case "faq":
    case "accordion":
      return join([str("title"), t.rows(count("items"))]);
    case "list":
      return join([str("title"), t.items(count("items"))]);
    case "product_list": {
      const source = str("source");
      return join([str("title"), source && optionLabel("source", source, source, locale), limit !== null && t.products(limit)]);
    }
    case "collection_list":
      return join([str("title"), limit !== null && t.collections(limit)]);
    case "product_card":
      return truncate(str("title") || t.oneProduct);
    case "shoppable_image":
      return truncate(str("title") || t.shoppableImage);
    case "countdown": {
      const hours = numberOf(props.endsInHours);
      const until = str("endsAt")
        ? new Date(str("endsAt")).toLocaleString(locale === "ar" ? "ar-EG" : "en-US")
        : hours !== null && hours > 0 && t.hours(hours);
      return join([str("label"), until]);
    }
    case "video":
    case "embed":
      return truncate(str("title") || str("url") || t.nothingLinked);
    case "map":
      return truncate(str("address") || t.noAddress);
    case "social_icons":
      return t.links(count("links"));
    case "form":
      return truncate(str("title") || t.form);
    case "spacer": {
      const height = numberOf(props.height);
      return height !== null && height > 0 ? t.pixels(height) : "";
    }
    case "icon":
      return truncate(str("name"));
    case "cart":
      return truncate(str("title") || t.cart);
    case "divider":
      return "";
    case "shader_hero":
      return truncate(str("title") || str("subtitle") || t.livingHero);
    case "product_3d":
      return truncate(str("title") || str("productId") || t.product3d);
    case "orbit_gallery":
      return join([str("title"), limit !== null && t.products(limit)]);
    case "scroll_story":
      return join([str("title"), t.steps(count("steps"))]);
    case "marquee": {
      const items = Array.isArray(props.items) ? props.items : [];
      // The claims themselves are the gist here — there is no title to show.
      return items.length === 0
        ? t.nothingWritten
        : truncate(items.filter((item) => typeof item === "string").join(" · "));
    }
    case "comparison":
      return join([str("title"), t.rows(count("rows"))]);
    case "tabs":
      return join([str("title"), t.tabs(count("items"))]);
    case "text_link":
      return join([str("text"), str("href") && `→ ${str("href")}`], " ");
    case "stars_display": {
      const rating = numberOf(props.rating);
      return join([rating !== null && rating > 0 && t.stars(rating), str("label")]);
    }
    case "upsell_accept_button":
    case "upsell_decline_link":
      return truncate(str("label"));
    case "repeater":
      return join([str("title"), str("source").split(".").pop()]);
    // The showcase bands (showcaseBlocks.ts).
    case "hero_slider":
      return t.slides(count("slides"));
    case "category_tiles":
    case "trust_strip":
    case "video_reels":
      return join([str("heading"), t.items(count("items"))]);
    case "need_picker":
      return join([str("heading"), t.needs(count("stages"))]);
    case "bundle_cards":
    case "product_rail":
    case "product_shelf":
    case "product_cards":
    case "image_banner":
      return join([str("heading"), str("collection")]);
    default:
      // toggle, price, reviews, the order form and the summaries — and anything newer — say their title.
      return truncate(str("title"));
  }
}
