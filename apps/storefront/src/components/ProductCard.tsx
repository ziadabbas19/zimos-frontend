"use client";

import { useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { StorefrontProduct } from "@store-builder/api-client";
import { StoreLink } from "@/components/StoreRoute";
import { useStore } from "@/lib/StoreContext";
import { dirFor, formatPrice, getDictionary, type Locale } from "@/lib/i18n";
import { compareAtOf, defaultOfferOf, discountPercent, needsProductPage, offerAppliesTo, priceOf, productImages } from "@/lib/product";
import { swipeStep } from "@/lib/swipe";
import { ArrowIcon, BoxIcon } from "./Icons";
import { QuickAddButton } from "./QuickAddButton";
import { StoreImage } from "./StoreImage";
import { skeleton } from "./ui";
import { SHOPPER_ACCOUNTS_ENABLED } from "@/lib/features";
import { WishlistHeart } from "./wishlist/WishlistHeart";

export function ProductCard({
  product,
  currency,
  locale,
  priority = false,
  from,
}: {
  product: StorefrontProduct;
  currency: string;
  locale: Locale;
  /** One of the first cards of a listing, likely on screen at once: loaded eagerly. */
  priority?: boolean;
  /** Where the card is shown (e.g. cross_sell): carried to the product page for the add-to-cart event. */
  from?: string;
}) {
  const t = getDictionary(locale);
  // The store's currency format (lib/moneyFormat), from the store context.
  const storeFormat = useStore().store?.currencyFormat ?? null;
  const price = priceOf(product);
  const compareAt = compareAtOf(product);
  const pct = price !== undefined ? discountPercent(price, compareAt) : null;
  const anyInStock = product.variants.some((v) => v.inStock);
  const images = productImages(product);
  const many = images.length > 1;

  // One variant and it is in stock: nothing to choose, so the card adds it in
  // one tap. Anything with options sends the shopper to the product page.
  const only = product.variants.length === 1 ? product.variants[0] : undefined;
  // Custom fields or menu options are filled in on the product page, never quick-added.
  const quickAdd = only && only.inStock && !needsProductPage(product) ? only : undefined;
  const offer = quickAdd ? defaultOfferOf(product) : undefined;

  // --- image carousel: every real photo, not just the first ----------------
  // In an RTL store "next" travels the other way, matching ProductGallery.
  const forward = dirFor(locale) === "rtl" ? -1 : 1;
  const [active, setActive] = useState(0);
  const current = images[active] ?? images[0];

  const step = (delta: number) => setActive((i) => (i + delta + images.length) % images.length);

  // Photos load lazily and can lag; a themed pulse fills the frame until
  // each one's `onLoad` fires, keyed by URL so a photo already seen never
  // re-shows the skeleton.
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set());
  const markLoaded = (src: string) => setLoaded((prev) => (prev.has(src) ? prev : new Set(prev).add(src)));

  // Swipe-to-advance, the same pointer math as ProductGallery's main photo —
  // a drag past the card counts as a swipe and skips the tap-to-navigate it
  // would otherwise fire.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);

  function onPointerDown(e: ReactPointerEvent) {
    if (!many) return;
    swipe.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerUp(e: ReactPointerEvent) {
    const start = swipe.current;
    swipe.current = null;
    if (!start) return;
    const delta = swipeStep(start, { x: e.clientX, y: e.clientY }, forward);
    if (delta !== null) {
      movedRef.current = true;
      step(delta);
    }
  }
  /** True when the pointer-up that preceded this click was a swipe. */
  function swallowClickAfterSwipe(e: ReactMouseEvent) {
    if (movedRef.current) {
      movedRef.current = false;
      e.preventDefault();
      return true;
    }
    return false;
  }

  return (
    // data-zf-part: the store's product font (Store settings → Fonts, lib/storeFonts) reaches the card here.
    <article data-zf-part="product" className="zt-card zt-product group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-paper-raised transition-[border-color,box-shadow] hover:border-primary hover:shadow-lg">
      {/* `z-10` lifts this above the title's stretched link (below) so the
          swipe and the nav arrows receive their own pointer events; a plain
          tap still reaches the same product through the link inside it. */}
      <div className="zt-product-media relative z-10 aspect-square overflow-hidden bg-paper">
        {current ? (
          <StoreLink
            href={`/products/${product.slug}${from ? `?from=${from}` : ""}`}
            aria-label={product.name}
            onPointerDown={onPointerDown}
            onPointerUp={(e) => {
              onPointerUp(e);
            }}
            onPointerLeave={() => {
              swipe.current = null;
            }}
            onClick={(e) => {
              swallowClickAfterSwipe(e);
            }}
            className="absolute inset-0 block touch-pan-y select-none"
          >
            {!loaded.has(current) && <span aria-hidden className={`absolute inset-0 ${skeleton}`} />}
            <StoreImage
              src={current}
              alt=""
              width={600}
              height={600}
              sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : undefined}
              decoding="async"
              onLoad={() => markLoaded(current)}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </StoreLink>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-primary/40">
            <BoxIcon size={48} />
          </div>
        )}

        {many && (
          <>
            <button
              type="button"
              aria-label={t.product.previousImage}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                step(-forward);
              }}
              className="absolute inset-y-0 start-1 z-10 flex w-8 items-center justify-center opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-paper-raised/90 text-ink shadow-sm backdrop-blur">
                <ArrowIcon size={14} className="rotate-180 rtl:rotate-0" />
              </span>
            </button>
            <button
              type="button"
              aria-label={t.product.nextImage}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                step(forward);
              }}
              className="absolute inset-y-0 end-1 z-10 flex w-8 items-center justify-center opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-paper-raised/90 text-ink shadow-sm backdrop-blur">
                <ArrowIcon size={14} className="rtl:rotate-180" />
              </span>
            </button>
          </>
        )}

        {pct && (
          <span className="absolute start-3 top-3 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-on-primary">
            {t.common.save(pct)}
          </span>
        )}
        {!anyInStock && (
          <span className="absolute end-3 top-3 rounded-full bg-paper-raised/95 px-2.5 py-1 text-xs font-semibold text-danger">
            {product.variants.length === 0 ? t.common.unavailable : t.common.outOfStock}
          </span>
        )}
        {/* The wishlist heart, on a store with shopper accounts (lib/features; it draws nothing otherwise). */}
        {SHOPPER_ACCOUNTS_ENABLED && <WishlistHeart productId={product.id} className="absolute bottom-2 end-2" />}
      </div>

      <div className="zt-product-body flex flex-1 flex-col p-4">
        <h3 className="zt-product-title line-clamp-2 text-sm font-semibold leading-snug text-ink sm:text-base">
          {/* The whole card is clickable via this stretched link. */}
          <StoreLink
            href={`/products/${product.slug}${from ? `?from=${from}` : ""}`}
            className="after:absolute after:inset-0 focus-visible:outline-none"
          >
            {product.name}
          </StoreLink>
        </h3>
        <p className="zt-product-price mt-2 flex flex-wrap items-baseline gap-x-2">
          <span className="text-base font-bold text-ink">
            {price !== undefined ? formatPrice(price, currency, locale, storeFormat) : "—"}
          </span>
          {compareAt && (
            <span className="text-sm text-ink-soft line-through">
              {formatPrice(compareAt, currency, locale, storeFormat)}
            </span>
          )}
        </p>
        {quickAdd ? (
          <QuickAddButton
            variantId={quickAdd.id}
            offerId={offer && offerAppliesTo(offer, quickAdd.id) ? offer.id : undefined}
            label={t.product.addToCart}
          />
        ) : (
          // Part of the stretched link: the whole card opens the product page,
          // where the options are chosen.
          <span
            aria-hidden
            className="zt-btn zt-btn-primary mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary transition-colors group-hover:bg-primary/90 group-has-[a:focus-visible]:outline-2 group-has-[a:focus-visible]:outline-offset-2 group-has-[a:focus-visible]:outline-primary"
          >
            {anyInStock ? t.shop.chooseOptions : t.product.viewDetails}
          </span>
        )}
      </div>
    </article>
  );
}
