/**
 * Smaller copies of a merchant's picture. The API writes four WebP copies beside
 * an upload (backend media/thumbnails.js, MEDIA_THUMBNAILS_ENABLED), and the
 * picture's own name says so: `<uuid>-t.jpg` has `<uuid>-t-w320.webp` and -w640,
 * -w1024, -w1600 beside it. Anything else, every picture uploaded before those
 * copies existed among them, has only its one file.
 *
 * A subpath of its own so a storefront page takes only this, not the upload tools.
 */
const WIDTHS = [320, 640, 1024, 1600] as const;
const MARKED = /^(.*\/[0-9a-f-]{36}-t)\.(?:jpe?g|png|webp)$/i;

/** The `srcset` of a picture's copies, or null when it has none and its own file is all there is. */
export function thumbnailSrcSet(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = MARKED.exec(url.split(/[?#]/, 1)[0]);
  if (!match) return null;
  return WIDTHS.map((width) => `${match[1]}-w${width}.webp ${width}w`).join(", ");
}
