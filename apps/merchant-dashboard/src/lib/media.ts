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
 * GIF is deliberately absent: a canvas round-trip keeps only the first frame,
 * so an animated GIF would be silently flattened. Those stay subject to the
 * plain size check.
 */
const COMPRESSIBLE_MIMES = ["image/png", "image/jpeg", "image/webp"];

/** Longest-edge caps, tried in order, each paired with the quality ladder. */
const MAX_EDGE_STEPS = [2000, 1600, 1200, 900];

/** Encoder quality, tried high-to-low within each size step. */
const QUALITY_STEPS = [0.9, 0.8, 0.7, 0.6];

type Drawable = ImageBitmap | HTMLImageElement;

function isCompressible(file: File): boolean {
  const byMime = file.type ? COMPRESSIBLE_MIMES.includes(file.type) : false;
  const byExt = /\.(png|jpe?g|webp)$/i.test(file.name);
  return byMime || (!file.type && byExt);
}

function sourceSize(src: Drawable): { width: number; height: number } {
  return src instanceof HTMLImageElement
    ? { width: src.naturalWidth, height: src.naturalHeight }
    : { width: src.width, height: src.height };
}

async function loadImage(file: File): Promise<Drawable> {
  if (typeof createImageBitmap === "function") {
    try {
      // `from-image` applies EXIF orientation, which drawImage would otherwise drop.
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Fall through to the <img> path below.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Could not decode "${file.name}".`));
      img.src = url;
    });
  } finally {
    // Safe once the image has decoded — the pixels are already in memory.
    URL.revokeObjectURL(url);
  }
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

let webpSupport: Promise<boolean> | null = null;

/** Older Safari silently falls back to PNG here, which would not shrink at all. */
function supportsWebp(): Promise<boolean> {
  if (!webpSupport) {
    webpSupport = (async () => {
      const probe = document.createElement("canvas");
      probe.width = 1;
      probe.height = 1;
      const blob = await encode(probe, "image/webp", 0.8);
      return blob?.type === "image/webp";
    })().catch(() => false);
  }
  return webpSupport;
}

async function pickOutputType(file: File): Promise<string> {
  const isJpeg = file.type === "image/jpeg" || /\.jpe?g$/i.test(file.name);
  if (isJpeg) return "image/jpeg";
  // WEBP keeps transparency and beats JPEG at equal quality; JPEG is the
  // fallback, at the cost of flattening any alpha onto white.
  return (await supportsWebp()) ? "image/webp" : "image/jpeg";
}

function extensionFor(mime: string): string {
  if (mime === "image/webp") return "webp";
  if (mime === "image/png") return "png";
  return "jpg";
}

function withExtension(name: string, ext: string): string {
  const base = name.replace(/\.[^./\\]+$/, "") || "image";
  return `${base}.${ext}`;
}

function drawScaled(src: Drawable, maxEdge: number, opaque: boolean): HTMLCanvasElement | null {
  const { width, height } = sourceSize(src);
  if (!width || !height) return null;
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  if (opaque) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Shrinks an over-limit image in the browser so the merchant does not have to
 * resize it by hand. Files already under the limit — the common case — come
 * back untouched, as do formats a canvas round-trip would damage.
 *
 * Walks down MAX_EDGE_STEPS, trying each quality in QUALITY_STEPS, and stops at
 * the first encoding under MAX_IMAGE_BYTES. If nothing gets there, the original
 * is returned so validateImageFile() rejects it exactly as it did before.
 */
export async function compressImageIfNeeded(file: File): Promise<File> {
  if (file.size === 0 || file.size <= MAX_IMAGE_BYTES) return file;
  if (!isCompressible(file)) return file;
  if (typeof document === "undefined") return file;

  let source: Drawable;
  try {
    source = await loadImage(file);
  } catch {
    return file; // Undecodable here; let the server have the final say.
  }

  try {
    const type = await pickOutputType(file);
    for (const maxEdge of MAX_EDGE_STEPS) {
      const canvas = drawScaled(source, maxEdge, type === "image/jpeg");
      if (!canvas) return file;
      for (const quality of QUALITY_STEPS) {
        const blob = await encode(canvas, type, quality);
        if (!blob) return file;
        if (blob.size <= MAX_IMAGE_BYTES) {
          const compressed = new File([blob], withExtension(file.name, extensionFor(blob.type)), {
            type: blob.type,
            lastModified: Date.now(),
          });
          if (import.meta.env.DEV) {
            console.info(
              `[media] compressed "${file.name}" ${humanSize(file.size)} → ${humanSize(compressed.size)} ` +
                `(${canvas.width}×${canvas.height}, ${blob.type}, q=${quality})`
            );
          }
          return compressed;
        }
      }
    }
    return file;
  } finally {
    if (!(source instanceof HTMLImageElement)) source.close();
  }
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
