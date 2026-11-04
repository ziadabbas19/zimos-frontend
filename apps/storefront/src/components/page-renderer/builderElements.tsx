import {
  resolveCheckoutForm,
  resolveCheckoutSettings,
  type StorefrontProductDetail,
} from "@store-builder/api-client";
import { CheckoutSummaryBlock, FunnelActionButton, FunnelCodForm, GallerySlideshow, OrderSummaryBlock, PickedPrice, ProductLanding, TabsBlock } from "./lazy";
import { StoreLink } from "@/components/StoreRoute";
import { orderBumpOf } from "@/lib/commerce";
import { formatPrice, type Dictionary, type Locale } from "@/lib/i18n";
import { compareAtOf, priceOf } from "@/lib/product";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { getStoreMeta } from "@/lib/storeMeta";
import type { PageRendererFunnel } from "./PageRenderer";
import { variantPriceTags } from "./builderMore";
import { type Props, bool, num, qaList, resolveHref, safeUrl, str, strList } from "./props";

/**
 * The builder elements of SPEC §9.3 (backend contract: ELEMENT_PROP_RULES in
 * modules/pages/pageTree.js; editor specs: ELEMENT_SPECS in the dashboard's
 * blocks.ts). Like every other element, each renders nothing when it has
 * nothing to show, and reads its props defensively.
 *
 * A product element with no `productId` uses "the page's product": the newest
 * product of the store — a one-product store, which is what these pages are
 * built for, never has to pick.
 */

/** The chosen product, or the store's newest one; null when the store has none or the call failed. */
async function productFor(workspaceId: string, productId: string): Promise<StorefrontProductDetail | null> {
  try {
    const client = await createServerStorefrontApiClient();
    let ref = productId;
    if (!ref) {
      const { products } = await client.listStorefrontProducts(workspaceId, { limit: 1 });
      ref = products[0]?.id ?? "";
    }
    return ref ? await client.getStorefrontProduct(workspaceId, ref) : null;
  } catch {
    return null;
  }
}

export function TextLinkElement({ props }: { props: Props }) {
  const text = str(props, "text");
  const href = resolveHref(str(props, "href"));
  if (!text.trim() || !href) return null;
  const className = "text-sm font-medium text-primary underline-offset-4 hover:underline sm:text-base";
  return href.startsWith("/") ? (
    <StoreLink href={href} className={className}>
      {text}
    </StoreLink>
  ) : (
    <a href={href} className={className} {...(bool(props, "newTab") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {text}
    </a>
  );
}

export function TabsElement({ props }: { props: Props }) {
  const items = qaList(props, "items");
  if (items.length === 0) return null;
  return <TabsBlock title={str(props, "title")} items={items} />;
}

/** One native disclosure: no client JS, and it works with the keyboard as is. */
export function ToggleElement({ props }: { props: Props }) {
  const title = str(props, "title");
  const body = str(props, "body");
  if (!title.trim() || !body.trim()) return null;
  return (
    <details open={bool(props, "open")} className="zt-card group rounded-2xl border border-line bg-paper-raised">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 text-base font-semibold text-ink">
        {title}
        <span aria-hidden className="text-ink-soft transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <p className="whitespace-pre-line px-5 pb-5 text-sm leading-relaxed text-ink-soft sm:text-base">{body}</p>
    </details>
  );
}

export function CarouselElement({ props }: { props: Props }) {
  const images = strList(props, "images")
    .map((src) => safeUrl(src))
    .filter((src): src is string => !!src);
  if (images.length === 0) return null;
  return <GallerySlideshow images={images} title={str(props, "title")} />;
}

/** A fixed star rating the merchant states themselves — for real averages use reviews_list. */
export function StarsDisplayElement({ props, t }: { props: Props; t: Dictionary }) {
  const rating = num(props, "rating", 0, 0, 5);
  if (rating === 0) return null;
  const label = str(props, "label");
  return (
    <p className="flex flex-wrap items-center gap-2">
      <span className="text-lg text-primary" aria-label={t.renderer.rating(rating)}>
        <span aria-hidden>{"★".repeat(rating) + "☆".repeat(5 - rating)}</span>
      </span>
      {label.trim() && <span className="text-sm text-ink-soft">{label}</span>}
    </p>
  );
}

const PRICE_SIZE: Record<string, string> = {
  small: "text-lg",
  medium: "text-2xl",
  large: "text-3xl sm:text-4xl",
};

/** The product's real price from the catalogue — never a number typed into the page. */
export async function PriceElement({
  props,
  workspaceId,
  currency,
  locale,
}: {
  props: Props;
  workspaceId: string;
  currency: string;
  locale: Locale;
}) {
  const product = await productFor(workspaceId, str(props, "productId"));
  const price = product ? priceOf(product) : undefined;
  if (!product || price === undefined) return null;
  const compareAt = props.showCompareAt === false ? null : compareAtOf(product);
  // Follows the variant the shopper picks on the page (item 93, builderMore.tsx).
  const byVariant = variantPriceTags(product, currency, locale);
  if (props.showCompareAt === false) for (const tag of Object.values(byVariant)) tag.compareAt = null;
  return (
    <PickedPrice
      productId={product.id}
      initial={{ amount: price, price: formatPrice(price, currency, locale), compareAt: compareAt === null ? null : formatPrice(compareAt, currency, locale) }}
      byVariant={byVariant}
      currency={currency}
      sizeClass={PRICE_SIZE[str(props, "size")] ?? PRICE_SIZE.medium}
    />
  );
}

/** Approved reviews of the product, newest first, with the real average. */
export async function ReviewsListElement({
  props,
  workspaceId,
  t,
  locale,
}: {
  props: Props;
  workspaceId: string;
  t: Dictionary;
  locale: Locale;
}) {
  const product = await productFor(workspaceId, str(props, "productId"));
  if (!product) return null;
  const reviews = (Array.isArray(product.reviews) ? product.reviews : [])
    .map((r) => (r && typeof r === "object" ? (r as { rating?: unknown; comment?: unknown; createdAt?: unknown }) : {}))
    .filter((r) => typeof r.rating === "number")
    .slice(0, num(props, "limit", 6, 1, 50));
  if (reviews.length === 0) return null;

  const title = str(props, "title");
  const date = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { dateStyle: "medium" });
  return (
    <div>
      {title.trim() && <h3 className="mb-4 text-xl font-semibold text-ink">{title}</h3>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {reviews.map((review, i) => {
          const rating = Math.min(5, Math.max(1, Math.round(review.rating as number)));
          const when = typeof review.createdAt === "string" ? new Date(review.createdAt) : null;
          return (
            <li key={i} className="zt-card rounded-2xl border border-line bg-paper-raised p-5">
              <p className="text-primary" aria-label={t.renderer.rating(rating)}>
                <span aria-hidden>{"★".repeat(rating) + "☆".repeat(5 - rating)}</span>
              </p>
              {typeof review.comment === "string" && review.comment.trim() && (
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink">{review.comment}</p>
              )}
              {when && !Number.isNaN(when.getTime()) && <p className="mt-2 text-xs text-ink-soft">{date.format(when)}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * `cod_form`: the store's real buy box for one product — variant pickers,
 * quantity or bundles, and the purchase form the merchant set up (settings →
 * purchase form) — placing a real cash-on-delivery order. It is the product
 * page's own component, so the two can never drift apart.
 *
 * Left out of a funnel (the funnel's checkout step owns the form there) and
 * of the editor's preview (a preview must not place orders).
 */
export async function CodFormElement({
  props,
  workspaceId,
  funnel,
  editable,
}: {
  props: Props;
  workspaceId: string;
  funnel?: PageRendererFunnel;
  editable?: boolean;
}) {
  // In a funnel: the funnel's own order form, which moves the shopper on (components/funnel/FunnelCodForm).
  if (funnel) {
    if (editable) return null;
    const funnelProduct = await productFor(workspaceId, str(props, "productId"));
    return funnelProduct ? <FunnelCodForm product={funnelProduct} title={str(props, "title")} /> : null;
  }
  const [store, product] = await Promise.all([
    getStoreMeta(workspaceId).catch(() => null),
    productFor(workspaceId, str(props, "productId")),
  ]);
  if (!store || !product) return null;
  const title = str(props, "title");
  return (
    <div className={editable ? "pointer-events-none" : undefined}>
      {title.trim() && <h3 className="mb-4 text-xl font-semibold text-ink">{title}</h3>}
      <ProductLanding
        workspaceId={workspaceId}
        product={product}
        bump={orderBumpOf(store.orderBump, [product.id])}
        checkoutSettings={
          { ...resolveCheckoutSettings(store.checkout), form: resolveCheckoutForm(store.checkout) } as ReturnType<
            typeof resolveCheckoutSettings
          >
        }
      />
    </div>
  );
}

export function CheckoutSummaryElement({ props, funnel }: { props: Props; funnel?: PageRendererFunnel }) {
  // The cart is a way out of a funnel.
  if (funnel) return null;
  return <CheckoutSummaryBlock title={str(props, "title")} buttonLabel={str(props, "buttonLabel")} />;
}

export function OrderSummaryElement({ props, workspaceId }: { props: Props; workspaceId: string }) {
  return <OrderSummaryBlock workspaceId={workspaceId} title={str(props, "title")} />;
}

export function UpsellActionElement({
  props,
  action,
  funnel,
  editable,
  t,
}: {
  props: Props;
  action: "accepted_offer" | "declined_offer";
  funnel?: PageRendererFunnel;
  editable?: boolean;
  t: Dictionary;
}) {
  // Only a funnel step has an offer to answer; the editor still draws the button.
  if (!funnel && !editable) return null;
  const fallback = action === "accepted_offer" ? t.funnel.accept : t.funnel.decline;
  return <FunnelActionButton action={action} label={str(props, "label") || fallback} />;
}
