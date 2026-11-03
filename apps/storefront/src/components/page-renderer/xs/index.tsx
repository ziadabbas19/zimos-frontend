import type { PageTree } from "@store-builder/api-client";
import type { ReactNode } from "react";
import { StoreLink } from "@/components/StoreRoute";
import type { Locale } from "@/lib/i18n";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { EmptyBlock } from "../commerce";
import { type Props, bool, items, linkOf, num, safeUrl, str } from "../showcase/shared";
import { XS_CREDITS } from "@/lib/xsShell";
import { XsLookStyles } from "@/components/xs/XsLookStyles";
import { XsBackgroundPreload, XsPicture, pictureSize } from "@/components/xs/XsPicture";
import { xsBox } from "@/lib/xsImages";
import { listed } from "./listed";
import { XsFeaturesElement, XsGalleryElement, XsHeroElement, XsMinisElement, XsNewsletterElement, XsPostsElement, XsQuotesElement, XsRailElement, XsShowcaseElement, XsSplitElement, XsStackElement, type XsHomeProps } from "./home";
import { XsJourneyElement, XsReelsElement } from "./picked";
import { XsContactElement, XsStoryElement, XsTeamElement, XsTitleElement, XsVideoElement, type XsPageProps } from "./pages";
import { XsOwn } from "./own";
import type { XsGridTab } from "./XsProductGrid";
import { xsCopy } from "./copy";
import type { XsSlide } from "./XsSlider";
import { XsProductGrid, XsSlider } from "../lazy";
import { xsFocal } from "@/lib/xsPicture";

/**
 * The "xs" sections — bands drawn in the look of an imported third-party
 * template (xs = external stores; styles: app/xs-sections.css):
 *
 *   xs_slider · xs_banners · xs_products
 *
 * One element type per kind of band; `look` names the template it is drawn
 * as. Everything about one template hangs off its entry in LOOKS and its
 * `[data-xs-look="…"]` block in the stylesheet, so a template is removed by
 * deleting those two and its pictures under public/xs/<look>/.
 *
 * Server components, like the showcase bands: the product band fetches the
 * merchant's real catalogue here. Each renders nothing when it has nothing
 * to show; in the editor's preview (`editable`) it shows a hint instead.
 */

export interface XsCtx {
  workspaceId: string;
  currency: string;
  locale: Locale;
  editable: boolean;
  /** The element's own id: what a form inside the band is filed under. */
  elementId: string;
  /** In the page's opening section: its pictures are fetched first (the page's largest paint). */
  eager: boolean;
}

interface ElementProps extends XsCtx {
  props: Props;
}

function lookOf(props: Props): string | null {
  const look = str(props, "look");
  return Object.hasOwn(XS_CREDITS, look) ? look : null;
}

function Empty({ editable, message }: { editable: boolean; message: string }) {
  if (!editable) return null;
  return (
    <div className="px-4 py-6 sm:px-6">
      <EmptyBlock title="" message={message} />
    </div>
  );
}

const copy = xsCopy;

function XsSliderElement({ props, locale, editable, eager }: ElementProps) {
  const look = lookOf(props);
  const t = copy(locale);
  const slides: XsSlide[] = listed(props, "slides", 8)
    .map(({ item: slide, at }) => ({
      key: `${at}`,
      image: safeUrl(str(slide, "image")) ?? "",
      eyebrow: str(slide, "eyebrow"),
      heading: str(slide, "heading"),
      text: str(slide, "text"),
      buttonLabel: str(slide, "buttonLabel"),
      buttonHref: linkOf(slide, "buttonHref"),
      focal: xsFocal(slide.imagePosition),
      phoneImage: safeUrl(str(slide, "phoneImage")),
    }))
    .filter((slide) => slide.image);
  if (!look || slides.length === 0) return <Empty editable={editable} message={t.noSlides} />;
  const seconds = num(props, "seconds", 6, 2, 30);
  return (
    <>
      {/* The first slide is what a shopper sees first: asked for before anything else on the page. */}
      {eager ? <XsBackgroundPreload src={slides[0].image} /> : null}
      <XsSlider
        look={look}
        slides={slides}
        autoplay={bool(props, "autoplay", true)}
        seconds={seconds}
        prevLabel={t.prev}
        nextLabel={t.next}
        openLabel={locale === "ar" ? "افتح" : "Open"}
        dotLabel={locale === "ar" ? "الشريحة {n}" : "Slide {n}"}
      />
    </>
  );
}

function XsBannersElement({ props, locale, editable, eager }: ElementProps) {
  const look = lookOf(props);
  const t = copy(locale);
  const banners = listed(props, "items", 8)
    .map(({ item, at }) => ({
      at,
      size: pictureSize(item, "image"),
      image: safeUrl(str(item, "image")) ?? "",
      title: str(item, "title"),
      text: str(item, "text"),
      linkLabel: str(item, "linkLabel"),
      href: linkOf(item, "href"),
    }))
    .filter((banner) => banner.image);
  if (!look || banners.length === 0) return <Empty editable={editable} message={t.noBanners} />;
  const heading = str(props, "heading");
  const intro = str(props, "text");
  const variant = ["card", "tile", "mosaic"].includes(str(props, "variant")) ? str(props, "variant") : undefined;
  return (
    <div className="xs-banners" data-xs-look={look} data-variant={variant} data-wide={props.wide === true ? "" : undefined}>
      {heading || intro ? (
        <div className="xs-banners__intro">
          {heading ? <h2>{heading}</h2> : null}
          {intro ? <p>{intro}</p> : null}
        </div>
      ) : null}
      <div className="xs-banners__grid">
        {banners.map((banner) => {
          const body = (
            <>
              <XsPicture
                src={banner.image}
                alt={banner.title}
                box={xsBox(banner.image)}
                eager={eager}
                className="xs-banners__img"
                pic={`items.${banner.at}.image`}
                size={banner.size}
               
              />
              <span className="xs-banners__text">
                <span className="xs-banners__top">
                  {banner.title ? <span className="xs-banners__title">{banner.title}</span> : null}
                  {banner.text ? <span className="xs-banners__info">{banner.text}</span> : null}
                </span>
                {banner.linkLabel ? (
                  <span className="xs-banners__more">
                    <span className="xs-banners__link">{banner.linkLabel}</span>
                  </span>
                ) : null}
              </span>
            </>
          );
          return banner.href ? (
            <StoreLink key={banner.at} href={banner.href} className="xs-banners__item" data-xs-item={`items.${banner.at}`}>
              {body}
            </StoreLink>
          ) : (
            <div key={banner.at} className="xs-banners__item" data-xs-item={`items.${banner.at}`}>
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** One page of a collection (or of the whole catalogue), and whether more follow. Null when the call failed. */
async function firstPage(workspaceId: string, collection: string, limit: number) {
  try {
    const client = await createServerStorefrontApiClient();
    const ref = collection.trim();
    const listing = await client.searchStorefrontProducts(workspaceId, {
      ...(ref ? { collection: ref, sort: "position" as const } : { sort: "newest" as const }),
      limit,
    });
    return { products: listing.products, hasMore: listing.hasMore };
  } catch {
    return null;
  }
}

/** The store's top-level collections as tabs, after an "everything" tab; none when the call fails. */
async function collectionTabs(workspaceId: string, base: string, allLabel: string): Promise<XsGridTab[]> {
  const all: XsGridTab = { key: "all", label: allLabel, collection: base };
  try {
    const client = await createServerStorefrontApiClient();
    const collections = await client.listStorefrontCollections(workspaceId);
    return [all, ...collections.filter((c) => !c.parentId).slice(0, 8).map((c) => ({ key: c.id, label: c.name, collection: c.slug }))];
  } catch {
    return [all];
  }
}

async function XsProductsElement({ props, workspaceId, currency, locale, editable }: ElementProps) {
  const look = lookOf(props);
  const t = copy(locale);
  if (!look) return null;
  const limit = num(props, "limit", 8, 1, 24);
  const base = str(props, "collection");
  const showTabs = bool(props, "showTabs", true);
  const allLabel = str(props, "allLabel") || t.all;
  const [page, tabs] = await Promise.all([
    firstPage(workspaceId, base, limit),
    showTabs ? collectionTabs(workspaceId, base, allLabel) : Promise.resolve<XsGridTab[]>([{ key: "all", label: allLabel, collection: base }]),
  ]);
  if (!page || page.products.length === 0) return <Empty editable={editable} message={t.noProducts} />;
  return (
    <XsProductGrid
      look={look}
      workspaceId={workspaceId}
      currency={currency}
      locale={locale}
      heading={str(props, "heading")}
      text={str(props, "text")}
      linkLabel={str(props, "linkLabel")}
      linkHref={linkOf(props, "linkHref")}
      tabs={tabs}
      showSearch={bool(props, "showSearch", true)}
      showDiscount={bool(props, "showDiscount", true)}
      discountLabel={str(props, "discountLabel")}
      layout={str(props, "layout") === "slider" ? "slider" : "grid"}
      quickView={bool(props, "quickView", true)}
      pageSize={limit}
      initial={page.products}
      initialHasMore={page.hasMore}
      copy={{
        search: str(props, "searchLabel") || t.search,
        searchPlaceholder: str(props, "searchPlaceholder") || t.searchPlaceholder,
        loadMore: str(props, "loadMoreLabel") || t.loadMore,
        view: str(props, "viewLabel") || t.view,
        empty: str(props, "emptyText") || t.noProducts,
        tabs: t.tabs,
        open: str(props, "openLabel") || t.open,
        close: t.close,
        prev: t.prev,
        next: t.next,
      }}
    />
  );
}

/** An inner-page band (./pages), drawn once its look is known to be one of ours. */
function pageBand(Band: (props: XsPageProps) => ReactNode) {
  return function PageBand({ props, workspaceId, locale, editable, elementId, eager }: ElementProps) {
    const look = lookOf(props);
    return look ? <Band props={props} look={look} workspaceId={workspaceId} locale={locale} editable={editable} elementId={elementId} eager={eager} /> : null;
  };
}

/** A home-page band (./home), drawn once its look is known to be one of ours. */
function homeBand(Band: (props: XsHomeProps) => ReactNode | Promise<ReactNode>) {
  return function HomeBand({ props, workspaceId, currency, locale, editable, elementId, eager }: ElementProps) {
    const look = lookOf(props);
    return look ? Band({ props, look, workspaceId, currency, locale, editable, elementId, eager }) : null;
  };
}

const ELEMENTS: Record<string, (props: ElementProps) => ReactNode | Promise<ReactNode>> = {
  xs_slider: XsSliderElement,
  xs_banners: XsBannersElement,
  xs_products: XsProductsElement,
  xs_title: pageBand(XsTitleElement),
  xs_story: pageBand(XsStoryElement),
  xs_contact: pageBand(XsContactElement),
  xs_team: pageBand(XsTeamElement),
  xs_video: pageBand(XsVideoElement),
  xs_hero: homeBand(XsHeroElement),
  xs_showcase: homeBand(XsShowcaseElement),
  xs_features: homeBand(XsFeaturesElement),
  xs_split: homeBand(XsSplitElement),
  xs_minis: homeBand(XsMinisElement),
  xs_quotes: homeBand(XsQuotesElement),
  xs_gallery: homeBand(XsGalleryElement),
  xs_newsletter: homeBand(XsNewsletterElement),
  xs_posts: homeBand(XsPostsElement),
  xs_rail: homeBand(XsRailElement),
  xs_stack: homeBand(XsStackElement),
  xs_journey: homeBand(XsJourneyElement),
  xs_reels: homeBand(XsReelsElement),
};

/** Whether `type` is one of the xs sections. */
export function isXsElement(type: string): boolean {
  return Object.hasOwn(ELEMENTS, type);
}

/** One xs element; null for any other type. */
export function XsElement({ type, props, ctx }: { type: string; props: Props; ctx: XsCtx }) {
  if (!Object.hasOwn(ELEMENTS, type)) return null;
  const Element = ELEMENTS[type] as (props: ElementProps) => ReactNode;
  return (
    <XsOwn props={props} id={ctx.elementId}>
      <Element props={props} {...ctx} />
    </XsOwn>
  );
}

/** The looks a page draws, in the order they first appear. */
function looksIn(tree: PageTree | null): string[] {
  const found: string[] = [];
  for (const section of Array.isArray(tree?.sections) ? tree.sections : []) {
    for (const row of Array.isArray(section?.rows) ? section.rows : []) {
      for (const column of Array.isArray(row?.columns) ? row.columns : []) {
        for (const element of Array.isArray(column?.elements) ? column.elements : []) {
          if (typeof element?.type !== "string" || !isXsElement(element.type)) continue;
          const look = lookOf((element.props ?? {}) as Props);
          if (look && !found.includes(look)) found.push(look);
        }
      }
    }
  }
  return found;
}

/**
 * The attribution line under a page that uses an imported template's bands —
 * a condition of those templates' licences, so it is not something a merchant
 * can switch off: it goes when the last band of that look leaves the page.
 */
export function XsCredit({ tree }: { tree: PageTree | null }) {
  // A look Zimos designed itself has no credit to give (lib/xsShell).
  const looks = looksIn(tree).filter((look) => XS_CREDITS[look]);
  if (looks.length === 0) return null;
  return (
    <p className="xs-credit">
      {looks.map((look, index) => {
        const { name, author, href, licence } = XS_CREDITS[look]!;
        return (
          <span key={look}>
            {index > 0 ? " · " : null}
            Design: {name} by{" "}
            <a href={href} target="_blank" rel="noopener">
              {author}
            </a>{" "}
            ({licence})
          </span>
        );
      })}
    </p>
  );
}

/** The stylesheet of each look the page's bands are drawn in (components/xs/XsLookStyles). */
export function XsPageStyles({ tree }: { tree: PageTree | null }) {
  return <XsLookStyles looks={looksIn(tree)} />;
}
