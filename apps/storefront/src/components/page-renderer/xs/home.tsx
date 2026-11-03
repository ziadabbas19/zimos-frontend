import type { StorefrontProduct } from "@store-builder/api-client";
import type { ReactNode } from "react";
import { StoreLink } from "@/components/StoreRoute";
import type { Locale } from "@/lib/i18n";
import { firstImage } from "@/lib/product";
import { xsBackground, xsFocal } from "@/lib/xsPicture";
import { xsBox } from "@/lib/xsImages";
import { XsPicture, listPictureSize, pictureSize } from "@/components/xs/XsPicture";
import { EmptyBlock } from "../commerce";
import { type Props, collectionProducts, items, linkOf, num, pricing, safeUrl, str } from "../showcase/shared";
import { XsCountdown, XsNewsletterForm, XsQuotes, XsStack } from "../lazy";
import { ClothingRail } from "@/components/immersive/lazy";
import { loadRail } from "../immersive";
import { listed } from "./listed";
import type { XsQuote } from "./XsQuotes";

/**
 * The bands a "studio" kind of imported template builds its home page from
 * (first carried over for look 02):
 *
 *   xs_hero · xs_showcase · xs_features · xs_split · xs_minis · xs_quotes
 *   xs_gallery · xs_newsletter · xs_posts · xs_rail · xs_stack
 *
 * Server components; the two product bands fetch the merchant's real
 * catalogue here. Each renders nothing when it has nothing to show, and a
 * hint instead in the editor's preview. Styles: app/xs-home.css.
 */

export interface XsHomeProps {
  props: Props;
  look: string;
  workspaceId: string;
  currency: string;
  locale: Locale;
  editable: boolean;
  /** The element's own id: what a form inside the band is filed under. */
  elementId: string;
  /** In the page's opening section: its pictures are fetched first. */
  eager: boolean;
}

function Empty({ editable, message }: { editable: boolean; message: string }) {
  if (!editable) return null;
  return (
    <div className="px-4 py-6 sm:px-6">
      <EmptyBlock title="" message={message} />
    </div>
  );
}

const noProducts = (locale: Locale) => (locale === "ar" ? "لا توجد منتجات في هذه المجموعة بعد." : "No products in this collection yet.");

/** A link drawn as one of the look's buttons; nothing without both a label and somewhere to go. */
function Button({ label, href, tone }: { label: string; href: string | null; tone: "solid" | "accent" | "outline" }) {
  if (!label || !href) return null;
  return (
    <StoreLink href={href} className="xs-btn" data-tone={tone}>
      {label}
    </StoreLink>
  );
}

/** A band's `images` list: each usable address with its place in the list (`images.1`). */
function pictureList(props: Props, max: number): { src: string; at: number }[] {
  return (Array.isArray(props.images) ? props.images : [])
    .map((value, at) => ({ src: typeof value === "string" ? safeUrl(value) : null, at }))
    .filter((entry): entry is { src: string; at: number } => Boolean(entry.src))
    .slice(0, max);
}

/** `xs_hero` — a heading, a line and two buttons on the look's colour, with a cut-out picture beside them. */
export function XsHeroElement({ props, look, eager }: XsHomeProps): ReactNode {
  const heading = str(props, "heading");
  const image = safeUrl(str(props, "image"));
  if (!heading && !image) return null;
  return (
    <div className="xs-hero" data-xs-look={look}>
      <div className="xs-hero__inner">
        <div className="xs-hero__text">
          {heading ? <h1 className="xs-hero__heading">{heading}</h1> : null}
          {str(props, "text") ? <p className="xs-hero__line">{str(props, "text")}</p> : null}
          <p className="xs-hero__buttons">
            <Button label={str(props, "buttonLabel")} href={linkOf(props, "buttonHref")} tone="accent" />
            <Button label={str(props, "button2Label")} href={linkOf(props, "button2Href")} tone="outline" />
          </p>
        </div>
        {image ? (
          <div className="xs-hero__art">
            <XsPicture src={image} alt={heading} box={xsBox(image)} eager={eager} pic="image" size={pictureSize(props, "image")} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ProductLink({ product, currency, locale, children, className }: { product: StorefrontProduct; currency: string; locale: Locale; children?: ReactNode; className: string }) {
  const image = firstImage(product);
  const { now } = pricing(product, currency, locale);
  return (
    <StoreLink href={`/products/${product.slug}`} className={className}>
      {image ? <XsPicture src={image} alt={product.name} box={xsBox(image)} className="xs-showcase__img" /> : <span className="xs-showcase__img" />}
      <h3 className="xs-showcase__name">{product.name}</h3>
      <strong className="xs-showcase__price">{now}</strong>
      {children}
    </StoreLink>
  );
}

/** `xs_showcase` — a few words on the start side, then the store's own products lifting on hover. */
export async function XsShowcaseElement({ props, look, workspaceId, currency, locale, editable }: XsHomeProps): Promise<ReactNode> {
  const products = await collectionProducts(workspaceId, str(props, "collection"), num(props, "limit", 3, 1, 12));
  if (!products || products.length === 0) return <Empty editable={editable} message={noProducts(locale)} />;
  const heading = str(props, "heading");
  const intro = heading || str(props, "text");
  return (
    <div className="xs-showcase" data-xs-look={look}>
      <div className="xs-showcase__inner" data-intro={intro ? "" : undefined}>
        {intro ? (
          <div className="xs-showcase__intro">
            {heading ? <h2 className="xs-heading">{heading}</h2> : null}
            {str(props, "text") ? <p>{str(props, "text")}</p> : null}
            <Button label={str(props, "buttonLabel")} href={linkOf(props, "buttonHref")} tone="solid" />
          </div>
        ) : null}
        {products.map((product) => (
          <ProductLink key={product.id} product={product} currency={currency} locale={locale} className="xs-showcase__item">
            <span className="xs-showcase__plus" aria-hidden>
              +
            </span>
          </ProductLink>
        ))}
      </div>
    </div>
  );
}

const FEATURE_ICONS = new Set(["truck", "bag", "support", "return"]);

/** `xs_features` — reasons in a two-column list with the look's line icons, beside a rounded picture. */
export function XsFeaturesElement({ props, look }: XsHomeProps): ReactNode {
  const features = listed(props, "items", 8).filter(({ item }) => str(item, "title") || str(item, "text"));
  const heading = str(props, "heading");
  const image = safeUrl(str(props, "image"));
  if (!heading && features.length === 0) return null;
  return (
    <div className="xs-features" data-xs-look={look}>
      <div className="xs-features__inner">
        <div>
          {heading ? <h2 className="xs-heading">{heading}</h2> : null}
          {str(props, "text") ? <p>{str(props, "text")}</p> : null}
          <div className="xs-features__list">
            {features.map(({ item: feature, at }) => {
              const icon = str(feature, "icon");
              // Its own icon (the template's, or the merchant's upload) before the look's drawing (under public/xs/<look>/).
              const own = safeUrl(str(feature, "image"));
              return (
                <div key={at} className="xs-features__item" data-xs-item={`items.${at}`}>
                  <span className="xs-features__icon">
                    <XsPicture src={own ?? `/xs/${look}/${FEATURE_ICONS.has(icon) ? icon : "truck"}.svg`} alt="" width={40} height={40} pic={`items.${at}.image`} size={pictureSize(feature, "image")} />
                  </span>
                  <h3>{str(feature, "title")}</h3>
                  <p>{str(feature, "text")}</p>
                </div>
              );
            })}
          </div>
        </div>
        {image ? (
          <div className="xs-features__art">
            <XsPicture src={image} alt={heading} box={xsBox(image)} pic="image" size={pictureSize(props, "image")} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** The four words under the countdown's numbers: the band's own where it has them, else the shopper's language's. */
function countdownLabels(props: Props, locale: Locale): [string, string, string, string] {
  const own = Array.isArray(props.countdownLabels) ? props.countdownLabels : [];
  const fallback = locale === "ar" ? ["يوم", "ساعة", "دقيقة", "ثانية"] : ["Days", "Hours", "Mins", "Secs"];
  return [0, 1, 2, 3].map((i) => (typeof own[i] === "string" && own[i].trim() ? own[i] : fallback[i])) as [string, string, string, string];
}

/** `xs_split` — three overlapping pictures on one side; a heading, a line, a ticked list and a button on the other. */
export function XsSplitElement({ props, look, locale }: XsHomeProps): ReactNode {
  const pictures = pictureList(props, 3);
  const points = (Array.isArray(props.points) ? props.points : []).filter((value): value is string => typeof value === "string" && value.trim() !== "").slice(0, 8);
  const heading = str(props, "heading");
  if (!heading && pictures.length === 0) return null;
  return (
    <div className="xs-split" data-xs-look={look}>
      <div className="xs-split__inner">
        <div className="xs-split__grid">
          {pictures.map(({ src, at }, index) => (
            <div key={at} className="xs-split__pic" data-slot={index + 1} data-xs-item={`images.${at}`}>
              <XsPicture src={src} alt="" box={xsBox(src)} pic={`images.${at}`} size={listPictureSize(props, "images", at)} />
            </div>
          ))}
        </div>
        <div className="xs-split__text">
          {heading ? <h2 className="xs-heading">{heading}</h2> : null}
          {str(props, "text") ? <p>{str(props, "text")}</p> : null}
          {points.length > 0 ? (
            <ul className="xs-split__points">
              {points.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
          ) : null}
          {str(props, "endsAt") ? (
            <XsCountdown endsAt={str(props, "endsAt")} labels={countdownLabels(props, locale)} />
          ) : null}
          <Button label={str(props, "buttonLabel")} href={linkOf(props, "buttonHref")} tone="solid" />
        </div>
      </div>
    </div>
  );
}

/** `xs_minis` — three of the store's products as small side-by-side cards with a link each. */
export async function XsMinisElement({ props, look, workspaceId, locale, editable }: XsHomeProps): Promise<ReactNode> {
  const products = await collectionProducts(workspaceId, str(props, "collection"), num(props, "limit", 3, 1, 9));
  if (!products || products.length === 0) return <Empty editable={editable} message={noProducts(locale)} />;
  const more = str(props, "linkLabel") || (locale === "ar" ? "المزيد" : "Read More");
  return (
    <div className="xs-minis" data-xs-look={look}>
      <div className="xs-minis__inner">
        {products.map((product) => {
          const image = firstImage(product);
          const href = `/products/${product.slug}`;
          return (
            <div key={product.id} className="xs-minis__item">
              <StoreLink href={href} className="xs-minis__thumb" tabIndex={-1} aria-hidden>
                {image ? <XsPicture src={image} alt={product.name} box={xsBox(image)} /> : null}
              </StoreLink>
              <div>
                <h3>{product.name}</h3>
                {product.description ? <p>{String(product.description).replace(/<[^>]*>/g, "").slice(0, 70)}</p> : null}
                <StoreLink href={href} className="xs-minis__more">
                  {more}
                </StoreLink>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** `xs_quotes` — the merchant's own customers' words, one at a time. */
export function XsQuotesElement({ props, look, locale }: XsHomeProps): ReactNode {
  const quotes: XsQuote[] = listed(props, "items", 8)
    .map(({ item, at }) => ({ key: `${at}`, quote: str(item, "quote"), name: str(item, "name"), role: str(item, "role"), image: safeUrl(str(item, "image")), size: pictureSize(item, "image") }))
    .filter((item) => item.quote);
  if (quotes.length === 0) return null;
  return <XsQuotes look={look} heading={str(props, "heading")} quotes={quotes} prevLabel={locale === "ar" ? "السابق" : "Previous"} nextLabel={locale === "ar" ? "التالي" : "Next"} />;
}

/** `xs_gallery` — a row of pictures under an optional heading and line; each opens the same link when one is set. */
export function XsGalleryElement({ props, look }: XsHomeProps): ReactNode {
  const pictures = pictureList(props, 12);
  if (pictures.length === 0) return null;
  const heading = str(props, "heading");
  const href = linkOf(props, "href");
  return (
    <div className="xs-gallery" data-xs-look={look} data-variant={str(props, "variant") === "logos" ? "logos" : undefined}>
      {heading || str(props, "text") ? (
        <div className="xs-gallery__intro">
          {heading ? <h2 className="xs-heading">{heading}</h2> : null}
          {str(props, "text") ? <p>{str(props, "text")}</p> : null}
        </div>
      ) : null}
      <div className="xs-gallery__row" style={{ gridTemplateColumns: `repeat(${Math.min(pictures.length, 6)}, minmax(0, 1fr))` }}>
        {pictures.map(({ src, at }) => {
          const picture = <XsPicture src={src} alt={heading} box={xsBox(src)} pic={`images.${at}`} size={listPictureSize(props, "images", at)} />;
          return href ? (
            <StoreLink key={at} href={href} className="xs-gallery__item" tabIndex={-1} aria-hidden data-xs-item={`images.${at}`}>
              {picture}
            </StoreLink>
          ) : (
            <div key={at} className="xs-gallery__item" data-xs-item={`images.${at}`}>
              {picture}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** `xs_newsletter` — a heading, a line and a one-line sign-up, optionally over a picture. */
export function XsNewsletterElement({ props, look, workspaceId, locale, editable, elementId }: XsHomeProps): ReactNode {
  const heading = str(props, "heading");
  const image = safeUrl(str(props, "image"));
  const ar = locale === "ar";
  return (
    <div className="xs-newsletter" data-xs-look={look} data-picture={image ? "" : undefined} style={image ? xsBackground(image, xsFocal(props.imagePosition)) : undefined} data-xs-bg={image ? "image" : undefined} data-xs-bg-src={image ?? undefined}>
      <div className="xs-newsletter__inner">
        {heading ? <h2 className="xs-heading">{heading}</h2> : null}
        {str(props, "text") ? <p>{str(props, "text")}</p> : null}
        <XsNewsletterForm
          workspaceId={workspaceId}
          elementId={elementId}
          formName={str(props, "formName") || heading}
          placeholder={str(props, "placeholder") || (ar ? "بريدك الإلكتروني" : "Your email address")}
          buttonLabel={str(props, "buttonLabel") || (ar ? "اشترك" : "Subscribe")}
          disabled={editable}
          copy={
            ar
              ? { sending: "جارٍ الإرسال…", sent: str(props, "successMessage") || "تم اشتراكك. شكرًا لك.", error: "تعذّر الاشتراك. حاول مرة أخرى.", needEmail: "اكتب بريدًا إلكترونيًا صحيحًا." }
              : { sending: "Sending…", sent: str(props, "successMessage") || "You are subscribed. Thank you.", error: "Could not subscribe. Please try again.", needEmail: "Enter a valid email address." }
          }
        />
      </div>
    </div>
  );
}

/**
 * `xs_rail` — the store's clothes on a rail (components/immersive/ClothingRail),
 * drawn in the look: its type, its colours and its own button under the rail.
 * Its products come from `loadRail` (page-renderer/immersive.tsx).
 */
export async function XsRailElement({ props, look, workspaceId, currency, locale, editable }: XsHomeProps): Promise<ReactNode> {
  const rail = await loadRail(props, workspaceId, currency, locale);
  if (!rail) return null;
  if (rail.items.length === 0) return <Empty editable={editable} message={noProducts(locale)} />;
  const { ctaLabel, ctaHref, ...drawn } = rail;
  return (
    <div className="xs-rail" data-xs-look={look}>
      <ClothingRail
        {...drawn}
        action={ctaLabel && ctaHref ? <Button key="action" label={ctaLabel} href={ctaHref} tone="solid" /> : undefined}
      />
    </div>
  );
}

/**
 * `xs_stack` — pictures dealt like a hand of cards (./XsStack): each with a
 * small badge, a title, a line and a link, under the band's own heading.
 */
export function XsStackElement({ props, look, locale }: XsHomeProps): ReactNode {
  const slides = listed(props, "items", 8)
    .map(({ item, at }) => ({
      key: `${at}`,
      image: safeUrl(str(item, "image")) ?? "",
      title: str(item, "title"),
      text: str(item, "text"),
      badge: str(item, "badge"),
      href: linkOf(item, "href"),
    }))
    .filter((slide) => slide.image);
  if (slides.length === 0) return null;
  const heading = str(props, "heading");
  const ar = locale === "ar";
  return (
    <div className="xs-stack" data-xs-look={look}>
      {heading || str(props, "text") ? (
        <div className="xs-stack__intro">
          {heading ? <h2 className="xs-heading">{heading}</h2> : null}
          {str(props, "text") ? <p>{str(props, "text")}</p> : null}
        </div>
      ) : null}
      <XsStack look={look} slides={slides} prevLabel={ar ? "السابق" : "Previous"} nextLabel={ar ? "التالي" : "Next"} />
    </div>
  );
}

/** `xs_posts` — article cards written by hand: a picture, a small line, a title, a sentence and a link each. */
export function XsPostsElement({ props, look }: XsHomeProps): ReactNode {
  const posts = listed(props, "items", 6).filter(({ item }) => str(item, "title") || safeUrl(str(item, "image")));
  if (posts.length === 0) return null;
  const heading = str(props, "heading");
  const intro = str(props, "text");
  const allLabel = str(props, "linkLabel");
  const allHref = linkOf(props, "linkHref");
  return (
    <div className="xs-posts" data-xs-look={look}>
      {heading || intro || allLabel ? (
        <div className="xs-posts__head">
          <div>
            {heading ? <h2 className="xs-heading">{heading}</h2> : null}
            {intro ? <p>{intro}</p> : null}
          </div>
          {allLabel && allHref ? (
            <StoreLink href={allHref} className="xs-posts__all">
              {allLabel}
            </StoreLink>
          ) : null}
        </div>
      ) : null}
      <div className="xs-posts__grid">
        {posts.map(({ item: post, at }) => {
          const image = safeUrl(str(post, "image"));
          const href = linkOf(post, "href");
          const title = str(post, "title");
          const more = str(post, "linkLabel");
          return (
            <article key={at} className="xs-posts__item" data-xs-item={`items.${at}`}>
              {image ? (
                <div className="xs-posts__pic">
                  <XsPicture src={image} alt={title} box={xsBox(image)} pic={`items.${at}.image`} size={pictureSize(post, "image")} />
                </div>
              ) : null}
              <div className="xs-posts__body">
                {str(post, "meta") ? <span className="xs-posts__meta">{str(post, "meta")}</span> : null}
                {title ? <h3>{href ? <StoreLink href={href}>{title}</StoreLink> : title}</h3> : null}
                {str(post, "text") ? <p>{str(post, "text")}</p> : null}
                {more && href ? (
                  <StoreLink href={href} className="xs-posts__more">
                    {more}
                  </StoreLink>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
