import { storefrontProductPage, type StorefrontProductDetail } from "@store-builder/api-client";
import type { Dictionary } from "@/lib/i18n";
import { type Props, num, safeUrl, str } from "./props";
import { StoreImage } from "@/components/StoreImage";

/**
 * The `repeater` element (SPEC §9.4): one block per item of a list that
 * belongs to the page's product — its features, testimonials or FAQs (the
 * product's own content, catalogue → product → content) or its approved
 * reviews. The page says only which list and how to lay it out; the items
 * are the product's, so the same page shows the right ones for any product.
 *
 * Renders nothing when the list is empty: no invented items, ever.
 */

interface Item {
  title: string;
  body: string;
  image: string | null;
  rating: number | null;
}

function itemsOf(product: StorefrontProductDetail, source: string): Item[] {
  const cms = storefrontProductPage(product).cms;
  const text = (v: unknown) => (typeof v === "string" ? v : "");
  switch (source) {
    case "product.cms.features":
      return cms.features.map((f) => ({ title: text(f.title), body: text(f.description), image: safeUrl(text(f.image)), rating: null }));
    case "product.cms.testimonials":
      return cms.testimonials.map((x) => ({
        title: text(x.name),
        body: text(x.text),
        image: safeUrl(text(x.image)),
        rating: typeof x.rating === "number" ? Math.min(5, Math.max(1, Math.round(x.rating))) : null,
      }));
    case "product.cms.faqs":
      return cms.faqs.map((f) => ({ title: text(f.question), body: text(f.answer), image: null, rating: null }));
    case "product.reviews":
      return (Array.isArray(product.reviews) ? product.reviews : [])
        .map((r) => (r && typeof r === "object" ? (r as { rating?: unknown; comment?: unknown }) : {}))
        .filter((r) => typeof r.rating === "number")
        .map((r) => ({
          title: "",
          body: text(r.comment),
          image: null,
          rating: Math.min(5, Math.max(1, Math.round(r.rating as number))),
        }));
    default:
      return [];
  }
}

export function RepeaterElement({
  props,
  product,
  t,
}: {
  props: Props;
  product: StorefrontProductDetail | null;
  t: Dictionary;
}) {
  if (!product) return null;
  const items = itemsOf(product, str(props, "source"))
    .filter((item) => item.title.trim() || item.body.trim())
    .slice(0, num(props, "limit", 12, 1, 24));
  if (items.length === 0) return null;

  const title = str(props, "title");
  const grid = str(props, "layout") === "grid";
  return (
    <div>
      {title.trim() && <h3 className="mb-4 text-xl font-semibold text-ink">{title}</h3>}
      <ul className={grid ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "space-y-3"}>
        {items.map((item, i) => (
          <li key={i} className="zt-card flex gap-4 rounded-2xl border border-line bg-paper-raised p-5">
            {item.image && (
              <StoreImage src={item.image} alt="" width={56} height={56} sizes="56px" loading="lazy" className="size-14 shrink-0 rounded-xl object-cover" />
            )}
            <div className="min-w-0">
              {item.rating !== null && (
                <p className="text-primary" aria-label={t.renderer.rating(item.rating)}>
                  <span aria-hidden>{"★".repeat(item.rating) + "☆".repeat(5 - item.rating)}</span>
                </p>
              )}
              {item.title.trim() && <p className="text-base font-semibold text-ink">{item.title}</p>}
              {item.body.trim() && (
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{item.body}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
