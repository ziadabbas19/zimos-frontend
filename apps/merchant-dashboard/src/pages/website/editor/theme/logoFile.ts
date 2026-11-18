/**
 * What a store's logo file has to be, checked in the browser before it is
 * uploaded. The numbers the merchant is told come from here too, and the
 * heights must match the store's header (storefront app/xs-shell.css, `--xs-logo-h`).
 */

export type LogoSize = "sm" | "md" | "lg";

/** How tall the header draws the logo at each size, in CSS pixels. */
export const LOGO_HEIGHTS: Record<LogoSize, { desktop: number; phone: number }> = {
  sm: { desktop: 36, phone: 32 },
  md: { desktop: 48, phone: 40 },
  lg: { desktop: 60, phone: 48 },
};

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
/** Under this a logo turns blurry even at the smallest size on a sharp screen. */
export const LOGO_MIN_SIDE = 64;
export const LOGO_ACCEPT = "image/png,image/jpeg,image/webp";
const LOGO_MIMES = LOGO_ACCEPT.split(",");

export type LogoProblem =
  | { kind: "type" }
  | { kind: "heavy"; bytes: number }
  | { kind: "small"; width: number; height: number }
  | { kind: "unreadable" };

/** A picture's real size in pixels, or null when the browser can't open it. */
export function imageSizeOf(file: Blob): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });
}

/** What is wrong with this file as a logo; null when it will do. */
export async function logoFileProblem(
  file: File,
  readSize: (file: Blob) => Promise<{ width: number; height: number } | null> = imageSizeOf
): Promise<LogoProblem | null> {
  if (!LOGO_MIMES.includes(file.type)) return { kind: "type" };
  if (file.size > LOGO_MAX_BYTES) return { kind: "heavy", bytes: file.size };
  const size = await readSize(file);
  if (!size) return { kind: "unreadable" };
  if (Math.min(size.width, size.height) < LOGO_MIN_SIDE) return { kind: "small", width: size.width, height: size.height };
  return null;
}
