import type { Product, ProductMedia } from "@store-builder/api-client";

/** Matches the backend's multer limit (5 MB) in modules/media/mediaService.js. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** The backend sniffs the real bytes, but we pre-filter on these to fail fast. */
export const ACCEPTED_IMAGE_MIMES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
export const ACCEPTED_IMAGE_ACCEPT = "image/png,image/jpeg,image/gif,image/webp";

function humanSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

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
    return `"${file.name}" is ${humanSize(file.size)} — the limit is 5 MB.`;
  }
  if (file.size === 0) {
    return `"${file.name}" is empty.`;
  }
  return null;
}

/**
 * Displayable src for a media entry. Prefer the host-relative `path` so the
 * image loads through the dev proxy (same-origin); fall back to stripping the
 * host off the absolute `url`.
 */
export function mediaSrc(media: ProductMedia): string {
  if (media.path) return media.path;
  try {
    return new URL(media.url).pathname;
  } catch {
    return media.url;
  }
}

/** First media entry is the primary image. */
export function primaryImage(product: Pick<Product, "media">): ProductMedia | null {
  return product.media?.[0] ?? null;
}
