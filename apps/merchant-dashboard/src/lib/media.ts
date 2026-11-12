import type { Product, ProductMedia } from "@store-builder/api-client";
import { compressImageIfNeeded as compressImage, humanSize } from "@store-builder/image-tools";
import { shrinkForUpload, type ShrinkResult } from "@/lib/imageResize";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";

/** Matches the backend's multer limit (5 MB) in modules/media/mediaService.js. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** The backend sniffs the real bytes, but we pre-filter on these to fail fast. */
export const ACCEPTED_IMAGE_MIMES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
export const ACCEPTED_IMAGE_ACCEPT = "image/png,image/jpeg,image/gif,image/webp";

/**
 * Client-side check before upload. Returns an error message, or null if the
 * file is acceptable. Type check tolerates a blank `file.type` (some browsers
 * leave it empty) and falls back to the extension.
 */
export function validateImageFile(file: File): string | null {
  const byExt = /\.(png|jpe?g|gif|webp)$/i.test(file.name);
  const byMime = file.type ? ACCEPTED_IMAGE_MIMES.includes(file.type) : false;
  if (!byMime && !byExt) {
    return `"${file.name}" isn't a PNG, JPEG, GIF or WEBP image.`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    // Oversized files run through compressImageIfNeeded() first, so reaching
    // here means shrinking was either unsafe (animated GIF) or not enough.
    return `"${file.name}" is ${humanSize(file.size)} — the limit is 5 MB. Try a smaller or lower-resolution image.`;
  }
  if (file.size === 0) {
    return `"${file.name}" is empty.`;
  }
  return null;
}

// ---------------------------------------------------------------------
// Client-side compression
// ---------------------------------------------------------------------

/**
 * Gets an image ready to upload: a big photo is scaled down to
 * UPLOAD_MAX_EDGE and re-encoded (lib/imageResize), then, if it is somehow
 * still over MAX_IMAGE_BYTES, shrunk further by the shared
 * @store-builder/image-tools (also used by the storefront for shoppers'
 * photos). Icons, GIFs, SVGs and anything that cannot be decoded here come
 * back untouched; if nothing gets under MAX_IMAGE_BYTES the original comes
 * back, so validateImageFile() rejects it exactly as it did before.
 */
export async function prepareImageForUpload(file: File): Promise<ShrinkResult> {
  const shrunk = await shrinkForUpload(file);
  const compressed = await compressImage(shrunk.file, { maxBytes: MAX_IMAGE_BYTES, debug: import.meta.env.DEV });
  return { file: compressed, savedBytes: Math.max(0, file.size - compressed.size) };
}

/** prepareImageForUpload for callers that only need the file. */
export async function compressImageIfNeeded(file: File): Promise<File> {
  return (await prepareImageForUpload(file)).file;
}

/**
 * Displayable src for a media entry: its absolute `url` (see imageSrc). The
 * host-relative `path` is only a last resort — on R2 it is the bare object key
 * ("/<workspaceId>/<file>"), which no server answers on the dashboard origin.
 */
export function mediaSrc(media: ProductMedia): string {
  return imageSrc(media.url) ?? media.path ?? "";
}

/**
 * Displayable src for a stored image URL (a library file, a `logoUrl`...).
 * Production keeps the absolute URL: the dashboard is a static build with no
 * proxy, so a host-relative path would ask the dashboard itself for the image
 * and get its index.html back. The backend marks /uploads cross-origin so the
 * API's own files load from here, and R2 serves its public domain directly.
 * On the dev server only, an /uploads/ link is turned into a path so it goes
 * through Vite's /uploads proxy (an older local backend still sends those
 * files same-origin only). Data, blob and relative URLs pass through.
 */
export function imageSrc(url: string | null | undefined, devProxy: boolean = import.meta.env.DEV): string | null {
  if (!url) return null;
  if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("/")) return url;
  if (!devProxy) return url;
  try {
    const parsed = new URL(url);
    return parsed.pathname.startsWith("/uploads/") ? `${parsed.pathname}${parsed.search}` : url;
  } catch {
    return url;
  }
}

/**
 * Displayable src for a picture stored in a store page (a slide, a banner, a
 * logo...). The storefront draws these on its own host, so a host-relative
 * path in a page (a template's own art, "/xs/16/slide-1.jpg") is a file the
 * storefront serves: the dashboard asks the storefront for it, not itself,
 * where it would get its index.html back. The stored value is never changed.
 * Anything else goes through imageSrc. Empty or blank: null.
 */
export function storePictureSrc(
  url: string | null | undefined,
  storefront: string = STOREFRONT_URL,
  devProxy: boolean = import.meta.env.DEV
): string | null {
  const trimmed = url?.trim() ?? "";
  if (trimmed === "") return null;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return `${storefront}${trimmed}`;
  return imageSrc(trimmed, devProxy);
}

/** First media entry is the primary image. */
export function primaryImage(product: Pick<Product, "media">): ProductMedia | null {
  return product.media?.[0] ?? null;
}
