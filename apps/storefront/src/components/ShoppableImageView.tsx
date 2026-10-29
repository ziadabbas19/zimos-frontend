"use client";

import { useState } from "react";
import type { PublicShoppableImage } from "@store-builder/api-client";
import { useStore } from "@/lib/StoreContext";
import { firstImage, priceOf } from "@/lib/product";
import { StoreLink } from "./StoreRoute";
import { StoreImage } from "@/components/StoreImage";

const STRINGS = {
  en: { view: "View product", close: "Close", point: (name: string) => `Show ${name}`, products: "In this picture" },
  ar: { view: "شوف المنتج", close: "إغلاق", point: (name: string) => `اعرض ${name}`, products: "في الصورة دي" },
};

/**
 * A shoppable image (SPEC §7.9): the picture, a numbered point on each
 * product, and the product's card when a point is chosen. The same products
 * are listed under the picture, so nothing depends on hitting a small dot.
 */
export function ShoppableImageView({ image, heading }: { image: PublicShoppableImage; heading?: "h1" | "h2" | null }) {
  const { intlLocale, money, store } = useStore();
  const t = intlLocale.startsWith("ar") ? STRINGS.ar : STRINGS.en;
  const [open, setOpen] = useState<number | null>(null);
  const currency = store?.currency ?? "EGP";
  const Heading = heading ?? null;

  return (
    <div>
      {Heading && image.title.trim() && <Heading className="mb-4 text-2xl font-semibold text-ink">{image.title}</Heading>}
      {/* The picture's own geometry positions the points, so it is laid out left-to-right in every language. */}
      <div dir="ltr" className="relative overflow-hidden rounded-2xl border border-line bg-paper-raised">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.imageUrl} alt={image.title} className="block h-auto w-full" />
        {image.hotspots.map((spot, index) => {
          const active = open === index;
          const price = priceOf(spot.product);
          const thumb = firstImage(spot.product);
          return (
            <div key={`${spot.product.id}-${index}`} className="absolute" style={{ left: `${spot.x}%`, top: `${spot.y}%` }}>
              <button
                type="button"
                aria-label={t.point(spot.product.name)}
                aria-expanded={active}
                onClick={() => setOpen(active ? null : index)}
                className="flex size-8 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-primary text-xs font-bold text-on-primary shadow-lg transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {index + 1}
              </button>
              {active && (
                <div
                  dir={intlLocale.startsWith("ar") ? "rtl" : "ltr"}
                  className={`absolute z-10 mt-1 w-56 rounded-xl border border-line bg-paper-raised p-3 shadow-xl ${spot.x > 60 ? "right-0" : "left-0"} ${spot.y > 60 ? "bottom-6" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    {thumb && (
                      <StoreImage src={thumb} alt="" width={56} height={56} sizes="56px" className="size-14 shrink-0 rounded-lg object-cover" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">{spot.product.name}</p>
                      {price !== undefined && <p className="text-sm text-ink-soft">{money(price, currency)}</p>}
                    </div>
                  </div>
                  <StoreLink href={`/products/${spot.product.slug}`} className="mt-3 block rounded-lg bg-primary px-3 py-2 text-center text-sm font-semibold text-on-primary">
                    {t.view}
                  </StoreLink>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {image.hotspots.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-ink">{t.products}</h3>
          <ol className="mt-2 grid gap-2 sm:grid-cols-2">
            {image.hotspots.map((spot, index) => {
              const price = priceOf(spot.product);
              return (
                <li key={`${spot.product.id}-${index}`}>
                  <StoreLink
                    href={`/products/${spot.product.slug}`}
                    className="flex items-center gap-3 rounded-xl border border-line bg-paper-raised px-3 py-2 text-sm hover:border-primary"
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-medium text-ink">{spot.product.name}</span>
                    {price !== undefined && <span className="shrink-0 text-ink-soft">{money(price, currency)}</span>}
                  </StoreLink>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
