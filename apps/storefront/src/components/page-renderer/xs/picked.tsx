import type { StorefrontProduct } from "@store-builder/api-client";
import type { ReactNode } from "react";
import { StoreLink } from "@/components/StoreRoute";
import { XsPicture } from "@/components/xs/XsPicture";
import { formatNumber } from "@/lib/i18n";
import { firstImage } from "@/lib/product";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { ProductAction, type Props, linkOf, pricing, safeUrl, str } from "../showcase/shared";
import { XsJourney, XsReels } from "../lazy";
import type { XsHomeProps } from "./home";
import { listed } from "./listed";

/**
 * Bands built around products the merchant names one by one (by their address
 * name, the slug), not a collection:
 *
 *   xs_journey — "what do you need now?": a tab per need, each opening on the
 *                product that answers it (a bundle, usually), its price and saving
 *   xs_reels   — short videos of products in use, each with the product under it
 *                and a button to put it in the cart
 *
 * Server components: the named products are fetched here, all at once; one
 * that is missing or failed is left out (its tab keeps its words, and its own
 * picture when it has one, so a template shows whole before its products are in). Styles:
 * app/xs-home.css.
 */

const slugsIn = (value: string) =>
  value
    .split(/[,\n،]/)
    .map((part) => part.trim().replace(/^\/?products\//, ""))
    .filter(Boolean);

/** The named products, by slug; a missing one is absent from the map. */
async function productsBySlug(workspaceId: string, slugs: string[]): Promise<Map<string, StorefrontProduct>> {
  const unique = [...new Set(slugs)].slice(0, 24);
  const found = new Map<string, StorefrontProduct>();
  if (unique.length === 0) return found;
  try {
    const client = await createServerStorefrontApiClient();
    const results = await Promise.all(unique.map((slug) => client.getStorefrontProduct(workspaceId, slug).catch(() => null)));
    results.forEach((product, i) => {
      if (product && product.slug) found.set(unique[i], product);
    });
  } catch {
    // The band keeps its words; no product is shown.
  }
  return found;
}

function Arrow() {
  return (
    <svg className="xs-journey__arrow" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 5l7 7-7 7M21 12H3" />
    </svg>
  );
}

/**
 * `xs_journey` — a heading, then one tab per need (its icon, the worry in a
 * line, its name) and under them the chosen need's card: the product's
 * picture (the need's own when it has one), the worry, the product's name, why it helps, three points ticked
 * off, other products for the same need, the price with what it saves, and a
 * button to the product.
 */
export async function XsJourneyElement({ props, look, workspaceId, currency, locale }: XsHomeProps): Promise<ReactNode> {
  const stages = listed(props, "items", 8).map(({ item, at }) => ({
    key: `${at}`,
    icon: str(item, "icon") || "box",
    pain: str(item, "pain"),
    name: str(item, "name"),
    product: slugsIn(str(item, "product"))[0] ?? "",
    also: slugsIn(str(item, "also")),
    image: safeUrl(str(item, "image")),
    text: str(item, "text"),
    points: str(item, "points")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 6),
  }));
  if (stages.length === 0) return null;
  const products = await productsBySlug(
    workspaceId,
    stages.flatMap((stage) => [stage.product, ...stage.also])
  );
  const heading = str(props, "heading");
  const ctaLabel = str(props, "ctaLabel");
  const moreLabel = str(props, "moreLabel");
  const saveLabel = str(props, "saveLabel");
  const fallbackHref = linkOf(props, "fallbackHref") ?? "/products";

  const panels = stages.map((stage, i) => {
    const product = products.get(stage.product);
    const image = stage.image ?? (product ? firstImage(product) : null);
    const price = product ? pricing(product, currency, locale) : null;
    const also = stage.also.map((slug) => products.get(slug)).filter((p): p is StorefrontProduct => !!p && p.slug !== product?.slug);
    const href = product ? `/products/${product.slug}` : fallbackHref;
    const saving = price && price.saving > 0 ? formatNumber(Math.round(price.saving / 100), locale) : null;
    return (
      <article key={stage.key} className="xs-journey__card">
        <div className="xs-journey__media">
          {image ? (
            <XsPicture src={image} alt={product?.name ?? ""} className="xs-journey__img" />
          ) : (
            <span className="xs-journey__placeholder" aria-hidden="true" />
          )}
        </div>
        <div className="xs-journey__body">
          <div className="xs-journey__eyebrow">
            <span className="xs-journey__no">{String(i + 1).padStart(2, "0")}</span>
            {stage.pain ? <p>{stage.pain}</p> : null}
          </div>
          <h3 className="xs-journey__title">{product?.name || stage.name}</h3>
          {stage.text ? <p className="xs-journey__text">{stage.text}</p> : null}
          {stage.points.length > 0 ? (
            <ul className="xs-journey__points">
              {stage.points.map((point, at) => (
                <li key={at}>{point}</li>
              ))}
            </ul>
          ) : null}
          {also.length > 0 ? (
            <p className="xs-journey__more">
              {moreLabel ? `${moreLabel}: ` : null}
              {also.map((other, at) => (
                <span key={other.slug}>
                  {at > 0 ? " · " : null}
                  <StoreLink href={`/products/${other.slug}`}>{other.name}</StoreLink>
                </span>
              ))}
            </p>
          ) : null}
          <div className="xs-journey__foot">
            {price && price.price !== undefined ? (
              <div className="xs-journey__price">
                {price.was ? <s>{price.was}</s> : null}
                <strong>{price.now}</strong>
                {saving && saveLabel ? <span className="xs-journey__save">{saveLabel.replace("[amount]", saving)}</span> : null}
              </div>
            ) : (
              <span />
            )}
            {ctaLabel ? (
              <StoreLink href={href} className="xs-journey__cta">
                <span>{ctaLabel}</span>
                <Arrow />
              </StoreLink>
            ) : null}
          </div>
        </div>
      </article>
    );
  });

  return (
    <div className="xs-journey" data-xs-look={look}>
      <header className="xs-journey__head">
        {str(props, "kicker") ? <span className="xs-journey__kicker">{str(props, "kicker")}</span> : null}
        {heading ? <h2 className="xs-heading">{heading}</h2> : null}
        {str(props, "text") ? <p>{str(props, "text")}</p> : null}
      </header>
      <XsJourney
        label={heading || (locale === "ar" ? "اختاري حسب احتياجك" : "Shop by need")}
        tabs={stages.map(({ key, icon, pain, name }) => ({ key, icon, pain, name }))}
        panels={panels}
      />
    </div>
  );
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 7h13l-1.4 8.2a2 2 0 0 1-2 1.8H9.4a2 2 0 0 1-2-1.7L6 7Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M6 7 5.3 4H3M9.5 20.5h.01M16.5 20.5h.01" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

/**
 * `xs_reels` — a row of upright videos of products in use (a picture where
 * there is no video). Each card carries its product: a small picture, the
 * name, the price, and a cart button (one tap when there is nothing to choose,
 * else the product page). The row scrolls sideways; only one video plays.
 */
export async function XsReelsElement({ props, look, workspaceId, currency, locale }: XsHomeProps): Promise<ReactNode> {
  const items = listed(props, "items", 12).map(({ item, at }) => ({
    key: `${at}`,
    video: safeUrl(str(item, "video")),
    poster: safeUrl(str(item, "image")),
    product: slugsIn(str(item, "product"))[0] ?? "",
  }));
  const products = await productsBySlug(
    workspaceId,
    items.map((item) => item.product)
  );
  const cards = items
    .map((item) => {
      const product = products.get(item.product) ?? null;
      const poster = item.poster ?? (product ? firstImage(product) : null);
      if (!item.video && !poster) return null;
      const price = product ? pricing(product, currency, locale) : null;
      const thumb = product ? firstImage(product) : null;
      return {
        key: item.key,
        video: item.video,
        poster,
        label: product?.name ?? str(props, "heading"),
        href: product ? `/products/${product.slug}` : null,
        chip: product ? (
          <div className="xs-reels__product">
            <StoreLink href={`/products/${product.slug}`} className="xs-reels__thumb" aria-label={product.name}>
              {thumb ? <XsPicture src={thumb} alt="" width={56} height={56} /> : null}
            </StoreLink>
            <div className="xs-reels__copy">
              <StoreLink href={`/products/${product.slug}`} className="xs-reels__name">
                {product.name}
              </StoreLink>
              {price && price.price !== undefined ? (
                <span className="xs-reels__price">
                  {price.was ? <s>{price.was}</s> : null}
                  <span>{price.now}</span>
                </span>
              ) : null}
            </div>
            <ProductAction product={product} label={str(props, "cartLabel")} locale={locale} className="xs-reels__cart">
              <CartIcon />
            </ProductAction>
          </div>
        ) : null,
      };
    })
    .filter((card): card is NonNullable<typeof card> => card !== null);
  if (cards.length === 0) return null;
  const ar = locale === "ar";
  return (
    <div className="xs-reels" data-xs-look={look}>
      <XsReels
        heading={str(props, "heading")}
        text={str(props, "text")}
        cards={cards}
        labels={{
          prev: ar ? "السابق" : "Previous",
          next: ar ? "التالي" : "Next",
          sound: ar ? "تشغيل الصوت" : "Turn the sound on",
          open: ar ? "افتح المنتج" : "Open the product",
        }}
      />
    </div>
  );
}

export type { Props };
