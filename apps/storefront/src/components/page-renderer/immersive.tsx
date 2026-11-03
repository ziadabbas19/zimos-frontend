import { ApiError, parseMoney, type StorefrontProduct } from "@store-builder/api-client";
import { BoxIcon } from "@/components/Icons";
// Split into their own chunks (see immersive/lazy.tsx): pages without these
// elements pay nothing for them.
import { OrbitStage, Product3D, ScrollStory, ShaderHero } from "@/components/immersive/lazy";
import type { ClothingRailProps, RailGarment } from "@/components/immersive/ClothingRail";
import type { StoryStep } from "@/components/immersive/ScrollStory";
import { ProductCard } from "@/components/ProductCard";
import { StoreLink } from "@/components/StoreRoute";
import { btnPrimary } from "@/components/ui";
import { formatPrice, getDictionary, intlLocaleFor, type Locale } from "@/lib/i18n";
import {
  compareAtOf,
  defaultOfferOf,
  discountPercent,
  firstImage,
  needsProductPage,
  offerAppliesTo,
  priceOf,
  productImages,
  variantUnitPrice,
} from "@/lib/product";
import {
  buyGroups,
  compactPrice,
  fabricAt,
  garmentColour,
  garmentKind,
  garmentText,
  isNewProduct,
  optionDetails,
  plainDescription,
} from "@/lib/railGarment";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { EmptyBlock } from "./commerce";
import { bool, num, resolveHref, safeUrl, str, type Props } from "./props";

/**
 * The four immersive element types: a hero drawn in the store's colours, a
 * spinnable 3D product, a turning product carousel, and a story that advances
 * as the page scrolls. Also the catalogue behind a template's clothing rail
 * (`loadRail`, drawn by the `xs_rail` band).
 *
 * Like the commerce elements, these are server components that fetch the
 * merchant's real catalogue; the moving parts are small client components they
 * hand data to. Each one has a still, readable version for visitors on reduced
 * motion, a metered connection or a weak device — that decision is made in the
 * browser (useImmersive.ts), never guessed here.
 *
 * A failing catalogue call renders nothing rather than breaking the page.
 */

/** A product's GLB model, if the merchant uploaded one alongside the photos. */
function modelUrlOf(product: Pick<StorefrontProduct, "media">): string | null {
  const media = product.media;
  if (!Array.isArray(media)) return null;
  for (const entry of media) {
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    const mime = typeof o.mimeType === "string" ? o.mimeType : "";
    const url = typeof o.url === "string" ? o.url.trim() : "";
    if (mime === "model/gltf-binary" && /^https?:\/\//i.test(url)) return url;
  }
  return null;
}

async function loadProduct(workspaceId: string, idOrSlug: string): Promise<StorefrontProduct | null> {
  try {
    const client = await createServerStorefrontApiClient();
    if (idOrSlug) return await client.getStorefrontProduct(workspaceId, idOrSlug);
    const { products } = await client.listStorefrontProducts(workspaceId, { limit: 1 });
    return products[0] ?? null;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    return null;
  }
}

/** `shader_hero` — the opening screen, painted in the store's own two colours. */
export function ShaderHeroElement({ props, locale }: { props: Props; locale: Locale }) {
  const title = str(props, "title");
  const subtitle = str(props, "subtitle");
  const ctaLabel = str(props, "ctaLabel");
  const ctaHref = resolveHref(str(props, "ctaHref", "/products"));
  const height = num(props, "height", 460, 260, 760);

  if (!title && !subtitle && !ctaLabel) return null;

  return (
    <ShaderHero minHeight={height}>
      {title ? (
        <h1 className="max-w-2xl text-balance text-3xl font-bold text-on-primary drop-shadow-sm sm:text-5xl">{title}</h1>
      ) : null}
      {subtitle ? <p className="max-w-xl text-base text-on-primary/90 sm:text-lg">{subtitle}</p> : null}
      {ctaLabel && ctaHref ? (
        <div>
          <StoreLink href={ctaHref} className={btnPrimary} lang={locale}>
            {ctaLabel}
          </StoreLink>
        </div>
      ) : null}
    </ShaderHero>
  );
}

/** `product_3d` — one product the shopper can pick up and turn. */
export async function Product3DElement({
  props,
  workspaceId,
  locale,
}: {
  props: Props;
  workspaceId: string;
  locale: Locale;
}) {
  const t = getDictionary(locale);
  const product = await loadProduct(workspaceId, str(props, "productId").trim());
  if (!product) return null;

  // The merchant can point at a model directly, otherwise it comes from the
  // product's own media. No model, no block — never a fake 3D badge.
  const model = safeUrl(str(props, "modelUrl")) ?? modelUrlOf(product);
  if (!model) return null;

  const title = str(props, "title");
  const poster = firstImage(product) ?? undefined;

  return (
    <div className="grid gap-6 sm:grid-cols-2 sm:items-center">
      <Product3D src={model} poster={poster} name={product.name} t={t} />
      <div className="flex flex-col gap-3">
        {title ? <h2 className="text-2xl font-bold text-ink">{title}</h2> : null}
        <p className="flex items-center gap-2 text-sm text-ink-soft">
          <BoxIcon size={18} />
          {t.immersive.spinHint}
        </p>
        {product.description ? <p className="text-ink-soft">{product.description}</p> : null}
        <div>
          <StoreLink href={`/products/${product.slug}`} className={btnPrimary} lang={locale}>
            {t.renderer.viewDetails}
          </StoreLink>
        </div>
      </div>
    </div>
  );
}

/** `orbit_gallery` — the collection as a drum that turns, not a flat grid. */
export async function OrbitGalleryElement({
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
  const t = getDictionary(locale);
  const limit = num(props, "limit", 8, 3, 16);
  const collectionId = str(props, "collectionId").trim();

  let products: StorefrontProduct[] = [];
  try {
    const client = await createServerStorefrontApiClient();
    const res = await client.listStorefrontProducts(workspaceId, {
      limit,
      ...(collectionId ? { collectionId } : {}),
    });
    products = res.products;
  } catch {
    return null;
  }
  const title = str(props, "title");
  if (products.length === 0) return <EmptyBlock title={title} message={t.renderer.emptyProducts} />;

  return (
    <div>
      {title ? <h2 className="mb-5 text-2xl font-bold text-ink">{title}</h2> : null}
      <OrbitStage label={title || t.immersive.carousel} prevLabel={t.immersive.previous} nextLabel={t.immersive.next}>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} currency={currency} locale={locale} />
        ))}
      </OrbitStage>
    </div>
  );
}

/** `scroll_story` — before/after, or how it's made, step by step. */
export function ScrollStoryElement({ props }: { props: Props }) {
  const raw = props.steps;
  const steps: StoryStep[] = Array.isArray(raw)
    ? raw
        .map((item) => {
          const o = (item ?? {}) as Props;
          return { title: str(o, "title"), body: str(o, "body"), image: safeUrl(str(o, "image")) ?? "" };
        })
        .filter((s) => s.title.trim() !== "" || s.body.trim() !== "")
    : [];

  if (steps.length === 0) return null;
  return <ScrollStory steps={steps} title={str(props, "title") || undefined} />;
}

/**
 * One product as a piece on the rail: its first photo hangs, its second is
 * the back, and — when the merchant says their photos come that way — its
 * third shows the side it rests on. Without a photo it is drawn as the
 * garment its name says, in its colour option (lib/railGarment). The
 * hang-tag carries the price.
 */
function railGarment(product: StorefrontProduct, index: number, currency: string, locale: Locale, sidePhotos: boolean, newLabel: string): RailGarment {
  const [image, backImage, sidePhoto] = productImages(product);
  const sideImage = sidePhotos ? sidePhoto : undefined;
  const money = (amount: number) => compactPrice(formatPrice(amount, currency, locale));
  const price = priceOf(product);
  const compareAt = compareAtOf(product);
  const percent = price !== undefined ? discountPercent(price, compareAt) : null;
  const description = plainDescription(product.description);
  const details = optionDetails(product);
  const badge: RailGarment["badge"] = percent
    ? { text: new Intl.NumberFormat(intlLocaleFor(locale), { style: "percent" }).format(-percent / 100), tone: "sale" }
    : isNewProduct(product)
      ? { text: newLabel, tone: "new" }
      : undefined;
  return {
    id: product.id,
    name: product.name,
    ...(description ? { description } : {}),
    ...(image
      ? { image, ...(backImage ? { backImage } : {}), ...(sideImage ? { sideImage } : {}) }
      : { kind: garmentKind(garmentText(product)), color: garmentColour(product) ?? fabricAt(index) }),
    ...(price !== undefined ? { tag: money(price) } : {}),
    ...(compareAt ? { tagWas: money(compareAt) } : {}),
    ...(badge ? { badge } : {}),
    ...(details.length > 0 ? { details } : {}),
    href: `/products/${product.slug}`,
    ...(railBuy(product, money) ?? {}),
  };
}

/**
 * What the detail view sells: every variant with its own price, ready to add.
 * Nothing when the product has fields to fill or menu options to pick — those
 * are bought from its own page (lib/product needsProductPage), as on a card.
 */
function railBuy(product: StorefrontProduct, money: (amount: number) => string): Pick<RailGarment, "buy"> | null {
  if (product.variants.length === 0 || needsProductPage(product)) return null;
  const only = product.variants.length === 1 ? product.variants[0] : undefined;
  const offer = only ? defaultOfferOf(product) : undefined;
  return {
    buy: {
      groups: buyGroups(product),
      variants: product.variants.map((variant) => {
        const unit = variantUnitPrice(product, variant);
        const compare = variant.compareAtAmount === null ? 0 : parseMoney(variant.compareAtAmount);
        return {
          id: variant.id,
          values: variant.optionValues ?? {},
          inStock: variant.inStock,
          price: money(unit),
          ...(compare > unit ? { was: money(compare) } : {}),
        };
      }),
      ...(offer && only && offerAppliesTo(offer, only.id) ? { offerId: offer.id } : {}),
    },
  };
}

const HANGERS = ["wood", "matte", "none"] as const;

/** A rail ready to draw: everything but its button, which the band draws in its look. */
export type LoadedRail = Omit<ClothingRailProps, "action"> & { ctaLabel: string; ctaHref: string | null };

/**
 * The rail a band's props describe, with the store's products on it, for the
 * template look's `xs_rail` (xs/home.tsx). Null when the catalogue could not
 * be read; `items` is empty when it has nothing to hang.
 */
export async function loadRail(props: Props, workspaceId: string, currency: string, locale: Locale): Promise<LoadedRail | null> {
  const t = getDictionary(locale);
  const limit = num(props, "limit", 8, 3, 16);
  const collectionId = str(props, "collectionId").trim();

  let products: StorefrontProduct[] = [];
  try {
    const client = await createServerStorefrontApiClient();
    const res = await client.listStorefrontProducts(workspaceId, {
      limit,
      ...(collectionId ? { collectionId } : {}),
    });
    products = res.products;
  } catch {
    return null;
  }
  const sidePhotos = bool(props, "sidePhotos", false);
  return {
    items: products.map((product, index) => railGarment(product, index, currency, locale, sidePhotos, t.immersive.railNew)),
    eyebrow: str(props, "eyebrow") || undefined,
    heading: str(props, "heading") || undefined,
    caption: str(props, "caption") || undefined,
    autoplay: bool(props, "autoplay", true),
    hanger: HANGERS.find((h) => h === str(props, "hanger")) ?? "wood",
    labels: {
      front: t.immersive.railFront,
      back: t.immersive.railBack,
      close: t.immersive.railClose,
      show: t.immersive.railShow,
      view: t.immersive.railView,
      addToCart: t.product.addToCart,
      adding: t.product.adding,
      added: t.product.added,
      addFailed: t.product.addFailed,
      outOfStock: t.common.outOfStock,
    },
    ctaLabel: str(props, "ctaLabel"),
    ctaHref: resolveHref(str(props, "ctaHref", "/products")),
  };
}
