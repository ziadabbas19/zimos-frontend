/* eslint-disable @next/next/no-img-element -- the plain <img> is the fallback on purpose, see below. */
import Image, { getImageProps } from "next/image";
import type { ImgHTMLAttributes } from "react";
import { isOptimizableImage } from "@/lib/imageOrigins";
import { xsPicturePath, xsSrcSet } from "@/lib/xsPicture";

type StoreImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "width" | "height" | "srcSet" | "sizes"> & {
  src: string;
  alt: string;
  /** The intrinsic size the box is drawn at; with `className` sizing it, this reserves the space. */
  width: number;
  height: number;
  /** How wide the image shows at each breakpoint, for the browser to pick a file. */
  sizes: string;
};

/**
 * A merchant photo.
 *
 * Merchant media are arbitrary remote URLs, so Next's optimizer can only
 * serve the ones on an origin listed in NEXT_PUBLIC_STORE_IMAGE_ORIGINS (the
 * media bucket's public address, set at build time — lib/imageOrigins.ts). For
 * those, next/image sends a resized WebP picked by `sizes` instead of the
 * full upload. A picture of an imported template's demo catalogue (public/xs)
 * comes as its own AVIF and WebP copies, picked by `sizes` the same way
 * (lib/xsPicture). Everything else — and every image while the variable is
 * unset — is the same plain <img> the storefront always drew, with the same
 * width, height, loading and priority attributes.
 */
export function StoreImage({ src, alt, width, height, sizes, ...rest }: StoreImageProps) {
  if (isOptimizableImage(src)) {
    return <Image src={src} alt={alt} width={width} height={height} sizes={sizes} {...rest} />;
  }
  const img = <img src={src} alt={alt} width={width} height={height} {...rest} />;
  const path = xsPicturePath(src);
  if (!path) return img;
  // No box of its own (.xs-pic, app/xs-sections.css): the <img> is laid out as before.
  return (
    <picture className="xs-pic">
      <source type="image/avif" srcSet={xsSrcSet(path, "avif")} sizes={sizes} />
      <source type="image/webp" srcSet={xsSrcSet(path, "webp")} sizes={sizes} />
      {img}
    </picture>
  );
}

type StorePictureProps = StoreImageProps & {
  /** Another file for phones, when the merchant gave one. */
  mobileSrc?: string | null;
  /** When the phone file applies, e.g. "(max-width: 749px)". */
  media: string;
};

/**
 * A merchant photo with a separate file for phones (the hero and the banner).
 * Each file comes resized by the optimizer when its origin is listed, as in
 * StoreImage; otherwise this is the same <picture> of the original files.
 */
export function StorePicture({ src, mobileSrc, media, alt, width, height, sizes, ...rest }: StorePictureProps) {
  const main = isOptimizableImage(src) ? getImageProps({ src, alt, width, height, sizes }).props : null;
  const phone = mobileSrc && isOptimizableImage(mobileSrc) ? getImageProps({ src: mobileSrc, alt, width, height, sizes }).props : null;
  return (
    <picture>
      {mobileSrc ? <source media={media} srcSet={phone?.srcSet ?? mobileSrc} sizes={phone?.sizes} /> : null}
      <img src={main?.src ?? src} srcSet={main?.srcSet} sizes={main?.sizes} alt={alt} width={width} height={height} {...rest} />
    </picture>
  );
}
