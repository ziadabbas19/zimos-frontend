import type { StorefrontProduct } from "@store-builder/api-client";
import { Fragment, type ReactNode } from "react";
import { StoreLink } from "@/components/StoreRoute";
import { HERO_MEDIA_ENABLED } from "@/lib/features";
import { dirFor, formatNumber, getDictionary, type Locale } from "@/lib/i18n";
import { firstImage } from "@/lib/product";
import { EmptyBlock } from "../commerce";
import { showcaseCopy } from "./copy";
import { heroLookMarkup, resolveHeroLook } from "./heroLook";
import { HeroSlider, type HeroSlide } from "./HeroSlider";
import { NeedTabs, type NeedTab } from "./NeedTabs";
import { RailTrack } from "./RailTrack";
import { ReelsTrack } from "./ReelsTrack";
import { ShelfRail } from "./ShelfRail";
import {
  ProductAction,
  ProductTile,
  type Props,
  bool,
  collectionProducts,
  cssVars,
  items,
  linkOf,
  loc,
  locList,
  num,
  pricing,
  productByRef,
  safeUrl,
  str,
  toneOf,
} from "./shared";

/**
 * The showcase sections — ten element types that each draw one full-width
 * band of a storefront page (styles: app/store-sections.css):
 *
 *   hero_slider · category_tiles · trust_strip · bundle_cards · need_picker
 *   product_rail · video_reels · product_shelf · product_cards · image_banner
 *
 * Server components, like the commerce and immersive elements: the product
 * bands fetch the merchant's real catalogue here and hand the moving parts —
 * a slider, a sliding rail, tabs, video playback — to small client
 * components. Each one renders nothing when it has nothing to show; in the
 * website editor's preview (`editable`) it shows a hint instead, so an empty
 * block can still be found and filled in.
 */

export interface ShowcaseCtx {
  workspaceId: string;
  currency: string;
  locale: Locale;
  editable: boolean;
  /** In the page's opening section: its picture loads at once rather than lazily. */
  eager?: boolean;
}

interface ElementProps extends ShowcaseCtx {
  props: Props;
}

/** What an empty block shows: a hint in the editor, nothing on the live store. */
function Empty({ editable, title = "", message }: { editable: boolean; title?: string; message: string }) {
  if (!editable) return null;
  return (
    <div className="px-4 py-6 sm:px-6">
      <EmptyBlock title={title} message={message} />
    </div>
  );
}

function pick<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** A picture for this language: the `…En` one on an English store when there is one. */
function localizedImage(props: Props, key: string, locale: Locale): string | null {
  if (locale === "en") {
    const en = safeUrl(str(props, `${key}En`));
    if (en) return en;
  }
  return safeUrl(str(props, key));
}

// --- hero_slider ---------------------------------------------------------

function HeroSliderElement({ props, locale, editable }: ElementProps) {
  const copy = showcaseCopy(locale);
  const slides: HeroSlide[] = [];
  items(props, "slides", 8).forEach((slide, i) => {
    const image = localizedImage(slide, "image", locale);
    if (!image) return;
    const look = resolveHeroLook(slide, HERO_MEDIA_ENABLED);
    slides.push({
      key: `${i}`,
      image,
      mobileImage: localizedImage(slide, "mobileImage", locale),
      alt: str(slide, "alt"),
      eyebrow: loc(slide, "eyebrow", locale),
      heading: loc(slide, "heading", locale),
      subheading: loc(slide, "subheading", locale),
      buttonLabel: loc(slide, "buttonLabel", locale),
      buttonHref: linkOf(slide, "buttonHref"),
      // The computer's place as it always was; the phone's own place and the veil only while the switch is on (heroLook.ts).
      side: look.desktop.side,
      vertical: look.desktop.vertical,
      ...heroLookMarkup(look),
      // A background video over the picture, which stays as its poster; read only while the switch is on.
      video: HERO_MEDIA_ENABLED ? safeUrl(str(slide, "video")) : null,
      contentWidth: num(slide, "contentWidth", 620, 200, 900),
      text: pick(str(slide, "text"), ["dark", "light"] as const, "dark"),
    });
  });
  if (slides.length === 0) return <Empty editable={editable} message={copy.emptySlides} />;

  return (
    <HeroSlider
      slides={slides}
      autoplay={bool(props, "autoplay", true)}
      seconds={num(props, "seconds", 5, 2, 30)}
      startDelay={num(props, "startDelay", 5, 0, 120)}
      arrows={bool(props, "arrows", true)}
      dots={bool(props, "dots", true)}
      wave={bool(props, "wave", false)}
      rtl={dirFor(locale) === "rtl"}
      label={loc(props, "label", locale) || copy.slider}
      labels={{ previous: copy.previous, next: copy.next, slide: copy.slide }}
      style={cssVars({
        "--zs-hero-h": `${num(props, "height", 620, 240, 900)}px`,
        "--zs-hero-h-tablet": `${num(props, "heightTablet", 520, 240, 900)}px`,
      })}
    />
  );
}

// --- category_tiles ------------------------------------------------------

function CategoryTilesElement({ props, locale, editable }: ElementProps) {
  const tiles = items(props, "items", 24)
    .map((item) => ({
      image: safeUrl(str(item, "image")),
      title: loc(item, "title", locale),
      href: linkOf(item, "href"),
    }))
    .filter((tile) => tile.image || tile.title.trim());
  if (tiles.length === 0) return <Empty editable={editable} message={showcaseCopy(locale).emptyTiles} />;

  const heading = loc(props, "heading", locale);
  return (
    <section
      className="zs zs-cats"
      data-tone={toneOf(props)}
      style={cssVars({
        "--zs-cols": num(props, "columns", 3, 2, 6),
        "--zs-cols-m": num(props, "columnsMobile", 3, 2, 4),
      })}
    >
      <div className="zs-cats__inner">
        {heading.trim() ? <h2 className="zs-cats__heading">{heading}</h2> : null}
        <div className="zs-cats__grid">
          {tiles.map((tile, i) => {
            const box = (
              <div className="zs-cats__box">
                {tile.image ? (
                  // Merchant media are arbitrary remote URLs (no next/image allowlist).
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={tile.image}
                    alt={tile.title}
                    width={1000}
                    height={1000}
                    loading={i < 3 ? "eager" : "lazy"}
                    decoding="async"
                    className="zs-cats__img"
                  />
                ) : null}
              </div>
            );
            return (
              <article key={`${tile.title}-${i}`} className="zs-cats__item">
                {tile.href ? (
                  <StoreLink className="zs-cats__link" href={tile.href} aria-label={tile.title} tabIndex={-1}>
                    {box}
                  </StoreLink>
                ) : (
                  <div className="zs-cats__link">{box}</div>
                )}
                {tile.title.trim() ? (
                  <h3 className="zs-cats__title">
                    {tile.href ? <StoreLink href={tile.href}>{tile.title}</StoreLink> : tile.title}
                  </h3>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// --- trust_strip -----------------------------------------------------------

/** Line icons on a 24px grid; an unknown name draws the shield. */
const TRUST_ICONS: Record<string, ReactNode> = {
  box: (
    <>
      <path d="M4 7.5 12 4l8 3.5v9L12 20l-8-3.5v-9Z" />
      <path d="m4 7.5 8 3.5 8-3.5M12 11v9" />
    </>
  ),
  cash: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6.5 9.5v5M17.5 9.5v5" />
    </>
  ),
  truck: (
    <>
      <path d="M3 6.5h10.5v9H3zM13.5 9.5h3.7l3.3 3.3v2.7h-7" />
      <circle cx="7.5" cy="17.5" r="1.8" />
      <circle cx="16.5" cy="17.5" r="1.8" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5 19 6v5.5c0 4.2-2.9 7.4-7 9-4.1-1.6-7-4.8-7-9V6l7-2.5Z" />
      <path d="m9 12 2.2 2.2L15.2 10" />
    </>
  ),
  support: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="m6 6 3.5 3.5M18 6l-3.5 3.5M6 18l3.5-3.5M18 18l-3.5-3.5" />
    </>
  ),
  return: (
    <>
      <path d="M4 9h11a5 5 0 0 1 0 10H8" />
      <path d="M8 5 4 9l4 4" />
    </>
  ),
  gift: (
    <>
      <path d="M4 11h16v9H4zM3 7.5h18V11H3zM12 7.5V20" />
      <path d="M12 7.5C10.5 4 7 4.5 7.5 6.5 8 8 12 7.5 12 7.5Zm0 0C13.5 4 17 4.5 16.5 6.5 16 8 12 7.5 12 7.5Z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  heart: <path d="M12 20s-7-4.4-7-9.6A4 4 0 0 1 12 8a4 4 0 0 1 7 2.4C19 15.6 12 20 12 20Z" />,
  star: <path d="m12 4 2.4 5 5.6.8-4 3.9.9 5.5L12 16.6l-4.9 2.6.9-5.5-4-3.9L9.6 9 12 4Z" />,
};

function TrustStripElement({ props, locale, editable }: ElementProps) {
  const cards = items(props, "items", 8)
    .map((item) => ({
      icon: str(item, "icon"),
      title: loc(item, "title", locale),
      text: loc(item, "text", locale),
    }))
    .filter((card) => card.title.trim() || card.text.trim());
  if (cards.length === 0) return <Empty editable={editable} message={showcaseCopy(locale).emptyTrust} />;

  return (
    <section
      className="zs zs-trust"
      data-tone={toneOf(props)}
      style={cssVars({ "--zs-cols": Math.min(4, cards.length) })}
    >
      <div className="zs-trust__inner">
        <ul className="zs-trust__list">
          {cards.map((card, i) => (
            <li key={`${card.title}-${i}`} className="zs-trust__item">
              <div className="zs-trust__card">
                <span className="zs-trust__icon" aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    {TRUST_ICONS[card.icon] ?? TRUST_ICONS.shield}
                  </svg>
                </span>
                {card.title.trim() ? <h3 className="zs-trust__title">{card.title}</h3> : null}
                {card.text.trim() ? <p className="zs-trust__text">{card.text}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// --- product bands: what they share ----------------------------------------

/** The band's products, or the reason there is nothing to draw. */
async function bandProducts(
  { props, workspaceId, locale, editable }: ElementProps,
  fallbackLimit: number
): Promise<{ products: StorefrontProduct[] } | { empty: ReactNode }> {
  const products = await collectionProducts(workspaceId, str(props, "collection"), num(props, "limit", fallbackLimit, 1, 24));
  if (!products) return { empty: null };
  if (products.length === 0) {
    return {
      empty: (
        <Empty editable={editable} title={loc(props, "heading", locale)} message={getDictionary(locale).renderer.emptyProducts} />
      ),
    };
  }
  return { products };
}

// --- bundle_cards -----------------------------------------------------------

async function BundleCardsElement(ctx: ElementProps) {
  const { props, currency, locale } = ctx;
  const result = await bandProducts(ctx, 4);
  if ("empty" in result) return result.empty;

  const heading = loc(props, "heading", locale);
  const subheading = loc(props, "subheading", locale);
  const badge = loc(props, "badge", locale);
  const cartLabel = loc(props, "cartLabel", locale);

  return (
    <section
      className="zs zs-bundles"
      data-tone={toneOf(props)}
      data-mobile-only={bool(props, "mobileOnly", false) ? "" : undefined}
    >
      <div className="zs-bundles__inner">
        {heading.trim() || subheading.trim() ? (
          <div className="zs-bundles__head">
            {heading.trim() ? <h2>{heading}</h2> : null}
            {subheading.trim() ? <p>{subheading}</p> : null}
          </div>
        ) : null}
        <div className="zs-bundles__grid">
          {result.products.map((product) => {
            const image = firstImage(product);
            const { now, was } = pricing(product, currency, locale);
            return (
              <article key={product.id} className="zs-bundles__card">
                <StoreLink className="zs-bundles__link" href={`/products/${product.slug}`}>
                  <div className="zs-bundles__media">
                    {image ? (
                      // Merchant media are arbitrary remote URLs (no next/image allowlist).
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image} alt={product.name} width={720} height={720} loading="lazy" decoding="async" />
                    ) : null}
                    {badge.trim() && was ? <span className="zs-bundles__badge">{badge}</span> : null}
                  </div>
                  <div className="zs-bundles__info">
                    <h3>{product.name}</h3>
                    <div className="zs-bundles__price" data-sale={was ? "" : undefined}>
                      <span>{now}</span>
                      {was ? <s>{was}</s> : null}
                    </div>
                  </div>
                </StoreLink>
                <div className="zs-bundles__atc">
                  <ProductAction product={product} label={cartLabel} locale={locale} />
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// --- need_picker --------------------------------------------------------------

async function NeedPickerElement({ props, workspaceId, currency, locale, editable }: ElementProps) {
  const stages = items(props, "stages", 8).filter((stage) => loc(stage, "name", locale).trim() || str(stage, "productId").trim());
  if (stages.length === 0) return <Empty editable={editable} message={showcaseCopy(locale).emptyNeeds} />;

  const copy = showcaseCopy(locale);
  const [products, alternatives] = await Promise.all([
    Promise.all(stages.map((stage) => productByRef(workspaceId, str(stage, "productId")))),
    Promise.all(stages.map((stage) => productByRef(workspaceId, str(stage, "altProductId")))),
  ]);

  const kicker = loc(props, "kicker", locale);
  const heading = loc(props, "heading", locale);
  const sub = loc(props, "sub", locale);
  const ctaLabel = loc(props, "ctaLabel", locale) || getDictionary(locale).renderer.viewDetails;
  const moreLabel = loc(props, "moreLabel", locale);
  const saveLabel = loc(props, "saveLabel", locale);

  const tabs: NeedTab[] = stages.map((stage, i) => ({
    key: `${i}`,
    icon: str(stage, "icon"),
    pain: loc(stage, "pain", locale),
    name: loc(stage, "name", locale) || products[i]?.name || "",
  }));

  const cards = stages.map((stage, i) => {
    const product = products[i];
    const alt = alternatives[i];
    const image = safeUrl(str(stage, "image")) ?? (product ? firstImage(product) : null);
    const pain = loc(stage, "pain", locale);
    const desc = loc(stage, "desc", locale);
    const points = locList(stage, "items", locale);
    const title = product?.name ?? loc(stage, "name", locale);
    const price = product ? pricing(product, currency, locale) : null;
    // The saving as a plain amount, in whole units: "Save 255 EGP".
    const saving =
      price && price.saving > 0 && saveLabel.includes("[amount]")
        ? saveLabel.replace("[amount]", formatNumber(Math.round(price.saving / 100), locale))
        : null;

    return (
      <Fragment key={i}>
        {image ? (
          <div className="zs-need__media">
            {/* Merchant media are arbitrary remote URLs (no next/image allowlist). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt={title} width={1000} height={1000} loading="lazy" decoding="async" />
          </div>
        ) : null}
        <div className="zs-need__body">
          <div className="zs-need__eyebrow-row">
            <span className="zs-need__no">{String(i + 1).padStart(2, "0")}</span>
            {pain.trim() ? <p className="zs-need__eyebrow">{pain}</p> : null}
          </div>
          {title.trim() ? <h3 className="zs-need__title">{title}</h3> : null}
          {desc.trim() ? <p className="zs-need__desc">{desc}</p> : null}
          {points.length > 0 ? (
            <ul className="zs-need__items">
              {points.map((point, n) => (
                <li key={`${point}-${n}`}>{point}</li>
              ))}
            </ul>
          ) : null}
          {alt && moreLabel.trim() ? (
            <p className="zs-need__more">
              {moreLabel}: <StoreLink href={`/products/${alt.slug}`}>{alt.name}</StoreLink>
            </p>
          ) : null}
          {product && price ? (
            <div className="zs-need__foot">
              <div className="zs-need__price">
                {price.was ? <span className="zs-need__was">{price.was}</span> : null}
                <span className="zs-need__now">{price.now}</span>
                {saving ? <span className="zs-need__save">{saving}</span> : null}
              </div>
              <StoreLink href={`/products/${product.slug}`} className="zs-need__cta">
                <span>{ctaLabel}</span>
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M14 5l7 7-7 7M21 12H3" />
                </svg>
              </StoreLink>
            </div>
          ) : null}
        </div>
      </Fragment>
    );
  });

  return (
    <section className="zs zs-need" data-tone={toneOf(props)}>
      <div className="zs-need__wrap">
        {kicker.trim() || heading.trim() || sub.trim() ? (
          <header className="zs-need__head">
            {kicker.trim() ? <span className="zs-need__kicker">{kicker}</span> : null}
            {heading.trim() ? <h2>{heading}</h2> : null}
            {sub.trim() ? <p>{sub}</p> : null}
          </header>
        ) : null}
        <NeedTabs
          tabs={tabs}
          cards={cards}
          label={heading || kicker}
          labels={{ previous: copy.previous, next: copy.next }}
          rtl={dirFor(locale) === "rtl"}
        />
      </div>
    </section>
  );
}

// --- product_rail ---------------------------------------------------------------

async function ProductRailElement(ctx: ElementProps) {
  const { props, currency, locale } = ctx;
  const result = await bandProducts(ctx, 8);
  if ("empty" in result) return result.empty;

  const heading = loc(props, "heading", locale);
  const buttonLabel = loc(props, "buttonLabel", locale);
  const buttonHref = linkOf(props, "buttonHref");
  const tile = {
    currency,
    locale,
    className: "zs-rail__card",
    cartLabel: loc(props, "cartLabel", locale),
    showDiscount: bool(props, "showDiscount", true),
    fit: str(props, "imageFit"),
  };
  const run = (inert: boolean) =>
    result.products.map((product) => <ProductTile key={product.id} product={product} inert={inert} {...tile} />);

  return (
    <section className="zs zs-rail" data-tone={toneOf(props)}>
      {heading.trim() ? (
        <div className="zs-rail__heading-wrap">
          <h2 className="zs-rail__heading">{heading}</h2>
        </div>
      ) : null}
      <div className="zs-rail__viewport">
        <RailTrack
          autoplay={bool(props, "autoplay", true)}
          speed={str(props, "speed")}
          label={heading}
          before={run(true)}
          after={run(true)}
        >
          {run(false)}
        </RailTrack>
      </div>
      {buttonLabel.trim() && buttonHref ? (
        <div className="zs-rail__footer">
          <StoreLink className="zs-pill-btn" href={buttonHref}>
            {buttonLabel}
          </StoreLink>
        </div>
      ) : null}
    </section>
  );
}

// --- video_reels ------------------------------------------------------------------

async function VideoReelsElement({ props, workspaceId, currency, locale, editable }: ElementProps) {
  const copy = showcaseCopy(locale);
  const clips = items(props, "items", 12)
    .map((item) => ({
      video: safeUrl(str(item, "video")),
      poster: safeUrl(str(item, "poster")),
      productId: str(item, "productId"),
    }))
    .filter((clip): clip is { video: string; poster: string | null; productId: string } => clip.video !== null);
  if (clips.length === 0) return <Empty editable={editable} message={copy.emptyVideos} />;

  const products = await Promise.all(clips.map((clip) => productByRef(workspaceId, clip.productId)));
  const heading = loc(props, "heading", locale);
  const subheading = loc(props, "subheading", locale);

  return (
    <section className="zs zs-reels" data-tone={toneOf(props)}>
      <ReelsTrack
        rtl={dirFor(locale) === "rtl"}
        labels={{
          previous: copy.previous,
          next: copy.next,
          nav: copy.videos,
          soundOn: copy.soundOn,
          soundOff: copy.soundOff,
        }}
        heading={
          <div className="zs-reels__copy">
            {heading.trim() ? <h2 className="zs-reels__heading">{heading}</h2> : null}
            {subheading.trim() ? <p className="zs-reels__sub">{subheading}</p> : null}
          </div>
        }
      >
        {clips.map((clip, i) => {
          const product = products[i];
          const thumb = product ? firstImage(product) : null;
          const price = product ? pricing(product, currency, locale) : null;
          return (
            <article key={`${clip.video}-${i}`} className="zs-reels__card" data-reel-card="">
              <div className="zs-reels__media">
                <video
                  className="zs-reels__video"
                  playsInline
                  muted
                  loop
                  preload="none"
                  poster={clip.poster ?? undefined}
                  aria-label={product?.name}
                >
                  <source src={clip.video} type={/\.mp4(\?|$)/i.test(clip.video) ? "video/mp4" : undefined} />
                </video>
                <div className="zs-reels__actions">
                  <button type="button" className="zs-reels__btn" data-reel-mute="" aria-label={copy.soundOn} aria-pressed="false">
                    <svg viewBox="0 0 24 24" aria-hidden className="zs-reels__icon-muted">
                      <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                      <path d="m16.5 9.5 5 5m0-5-5 5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    </svg>
                    <svg viewBox="0 0 24 24" aria-hidden className="zs-reels__icon-sound">
                      <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                      <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    </svg>
                  </button>
                  {product ? (
                    <StoreLink className="zs-reels__btn" href={`/products/${product.slug}`} aria-label={`${copy.viewProduct}: ${product.name}`}>
                      <svg viewBox="0 0 24 24" aria-hidden>
                        <rect x="5" y="7.5" width="11" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
                        <path d="M9 5h8a2 2 0 0 1 2 2v8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                      </svg>
                    </StoreLink>
                  ) : null}
                </div>
                {product && price ? (
                  <div className="zs-reels__product">
                    <StoreLink className="zs-reels__thumb" href={`/products/${product.slug}`} tabIndex={-1} aria-hidden>
                      {thumb ? (
                        // Merchant media are arbitrary remote URLs (no next/image allowlist).
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="" width={104} height={104} loading="lazy" decoding="async" />
                      ) : null}
                    </StoreLink>
                    <div className="zs-reels__pcopy">
                      <StoreLink className="zs-reels__ptitle" href={`/products/${product.slug}`}>
                        {product.name}
                      </StoreLink>
                      <div className="zs-reels__price">
                        {price.was ? <s>{price.was}</s> : null}
                        <span>{price.now}</span>
                      </div>
                    </div>
                    <ProductAction product={product} label={getDictionary(locale).product.addToCart} locale={locale} className="zs-reels__cart">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <circle cx="9" cy="20" r="1.2" />
                        <circle cx="18" cy="20" r="1.2" />
                        <path d="M2.5 3.5h3l2.3 11.2a1.8 1.8 0 0 0 1.8 1.4h7.8a1.8 1.8 0 0 0 1.8-1.4L20.5 8H6.4" />
                      </svg>
                    </ProductAction>
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </ReelsTrack>
    </section>
  );
}

// --- product_shelf --------------------------------------------------------------------

async function ProductShelfElement(ctx: ElementProps) {
  const { props, currency, locale } = ctx;
  const result = await bandProducts(ctx, 8);
  if ("empty" in result) return result.empty;

  const copy = showcaseCopy(locale);
  const heading = loc(props, "heading", locale);
  const subheading = loc(props, "subheading", locale);
  const buttonLabel = loc(props, "buttonLabel", locale);
  const buttonHref = linkOf(props, "buttonHref");
  // Sold-out products stay on the shelf only when the merchant asked for them.
  const showSoldOut = bool(props, "showSoldOut", true);
  const products = showSoldOut ? result.products : result.products.filter((p) => p.variants.some((v) => v.inStock));
  if (products.length === 0) return null;

  return (
    <section className="zs zs-shelf" data-tone={toneOf(props)}>
      <ShelfRail
        rtl={dirFor(locale) === "rtl"}
        label={heading}
        labels={{ previous: copy.previous, next: copy.next, page: copy.page }}
        heading={
          <div className="zs-shelf__heading-block">
            {heading.trim() ? <h2 className="zs-shelf__heading">{heading}</h2> : null}
            {subheading.trim() ? <p className="zs-shelf__sub">{subheading}</p> : null}
          </div>
        }
      >
        {products.map((product) => (
          <ProductTile
            key={product.id}
            product={product}
            currency={currency}
            locale={locale}
            className="zs-shelf__card"
            cartLabel={loc(props, "cartLabel", locale)}
            showDiscount={bool(props, "showDiscount", true)}
            showSoldOut={showSoldOut}
            fit={str(props, "imageFit")}
          />
        ))}
      </ShelfRail>
      {buttonLabel.trim() && buttonHref ? (
        <div className="zs-shelf__action">
          <StoreLink className="zs-pill-btn" href={buttonHref}>
            {buttonLabel}
          </StoreLink>
        </div>
      ) : null}
    </section>
  );
}

// --- product_cards ----------------------------------------------------------------------

async function ProductCardsElement(ctx: ElementProps) {
  const { props, currency, locale } = ctx;
  const result = await bandProducts(ctx, 8);
  if ("empty" in result) return result.empty;

  const copy = showcaseCopy(locale);
  const heading = loc(props, "heading", locale);
  const subheading = loc(props, "subheading", locale);
  const buttonLabel = loc(props, "buttonLabel", locale);
  const buttonHref = linkOf(props, "buttonHref");
  const cartLabel = loc(props, "cartLabel", locale);
  const showDiscount = bool(props, "showDiscount", true);
  const viewAll =
    buttonLabel.trim() && buttonHref ? (
      <StoreLink className="zs-pgrid__all" href={buttonHref}>
        {buttonLabel}
      </StoreLink>
    ) : null;

  return (
    <section
      className="zs zs-pgrid"
      data-tone={toneOf(props)}
      style={cssVars({ "--zs-cols": num(props, "columns", 4, 2, 6) })}
    >
      <div className="zs-pgrid__shell">
        {heading.trim() || subheading.trim() || viewAll ? (
          <header className="zs-pgrid__head">
            <div>
              {heading.trim() ? <h2>{heading}</h2> : null}
              {subheading.trim() ? <p>{subheading}</p> : null}
            </div>
            {viewAll}
          </header>
        ) : null}
        <div className="zs-pgrid__grid">
          {result.products.map((product) => {
            const image = firstImage(product);
            const { now, was, percent } = pricing(product, currency, locale);
            const href = `/products/${product.slug}`;
            return (
              <article key={product.id} className="zs-pgrid__card">
                <StoreLink className="zs-pgrid__media" href={href} aria-label={product.name} tabIndex={-1}>
                  <div className="zs-pgrid__box">
                    {showDiscount && percent ? <span className="zs-pgrid__badge">{copy.discount(percent)}</span> : null}
                    {image ? (
                      // Merchant media are arbitrary remote URLs (no next/image allowlist).
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image} alt="" width={900} height={900} loading="lazy" decoding="async" className="zs-pgrid__img" />
                    ) : null}
                  </div>
                </StoreLink>
                <div className="zs-pgrid__body">
                  <h3>
                    <StoreLink href={href}>{product.name}</StoreLink>
                  </h3>
                  <div className="zs-pgrid__price" data-sale={was ? "" : undefined}>
                    {was ? <s>{was}</s> : null}
                    <span>{now}</span>
                  </div>
                  <ProductAction product={product} label={cartLabel} locale={locale} />
                </div>
              </article>
            );
          })}
        </div>
        {viewAll ? <div className="zs-pgrid__footer">{viewAll}</div> : null}
      </div>
    </section>
  );
}

// --- image_banner -------------------------------------------------------------------------

function ImageBannerElement({ props, locale, editable, eager = false }: ElementProps) {
  const image = safeUrl(str(props, "image"));
  if (!image) return <Empty editable={editable} message={showcaseCopy(locale).emptyBanner} />;

  const mobileImage = safeUrl(str(props, "mobileImage"));
  const heading = loc(props, "heading", locale);
  const text = loc(props, "text", locale);
  const buttonLabel = loc(props, "buttonLabel", locale);
  const buttonHref = linkOf(props, "buttonHref");
  const hasCopy = heading.trim() || text.trim() || (buttonLabel.trim() && buttonHref);

  return (
    <section
      className="zs zs-banner"
      style={cssVars({
        "--zs-banner-h": `${num(props, "height", 490, 200, 900)}px`,
        "--zs-banner-h-tablet": `${num(props, "heightTablet", 430, 200, 900)}px`,
        "--zs-banner-h-mobile": `${num(props, "heightMobile", 390, 200, 900)}px`,
      })}
    >
      <div className="zs-banner__media">
        <picture>
          {mobileImage ? <source media="(max-width: 767px)" srcSet={mobileImage} /> : null}
          {/* Merchant media are arbitrary remote URLs (no next/image allowlist). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt={str(props, "alt")} width={2600} height={1114} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : undefined} decoding="async" />
        </picture>
        {hasCopy ? <span className="zs-banner__overlay" aria-hidden /> : null}
      </div>
      {hasCopy ? (
        <div className="zs-banner__content">
          {heading.trim() ? <h2 className="zs-banner__heading">{heading}</h2> : null}
          {text.trim() ? <div className="zs-banner__text">{text}</div> : null}
          {buttonLabel.trim() && buttonHref ? (
            <StoreLink className="zs-banner__btn" href={buttonHref}>
              {buttonLabel}
            </StoreLink>
          ) : null}
        </div>
      ) : null}
      {bool(props, "wave", false) ? (
        <svg className="zs-banner__wave" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden focusable="false">
          <path d="M0 42 C120 8 190 76 330 48 S565 8 720 50 S970 10 1125 47 S1320 76 1440 40 V90 H0 Z" />
        </svg>
      ) : null}
    </section>
  );
}

// --- the renderer's way in ------------------------------------------------------------------

const ELEMENTS: Record<string, (props: ElementProps) => ReactNode | Promise<ReactNode>> = {
  hero_slider: HeroSliderElement,
  category_tiles: CategoryTilesElement,
  trust_strip: TrustStripElement,
  bundle_cards: BundleCardsElement,
  need_picker: NeedPickerElement,
  product_rail: ProductRailElement,
  video_reels: VideoReelsElement,
  product_shelf: ProductShelfElement,
  product_cards: ProductCardsElement,
  image_banner: ImageBannerElement,
};

/** Whether `type` is one of the showcase sections. */
export function isShowcaseElement(type: string): boolean {
  return Object.hasOwn(ELEMENTS, type);
}

/** One showcase element; null for any other type. */
export function ShowcaseElement({ type, props, ctx }: { type: string; props: Props; ctx: ShowcaseCtx }) {
  if (!Object.hasOwn(ELEMENTS, type)) return null;
  const Element = ELEMENTS[type] as (props: ElementProps) => ReactNode;
  return <Element props={props} {...ctx} />;
}
