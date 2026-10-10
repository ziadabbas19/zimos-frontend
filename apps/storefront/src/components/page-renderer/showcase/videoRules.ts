/**
 * When a slide's background video may play at all.
 *
 * The slide's picture is always there and is what most visitors see; the
 * video is an extra for a wide screen on a good connection. It is left out —
 * not even asked for — on a phone-wide screen, for a visitor who asked for
 * less motion, with data saving on, or on a slow connection.
 *
 * No imports on purpose: the node test loads this file as it is.
 */

/** The hero's own narrow layout (store-sections.css; HERO_PHONE_MAX_PX in heroLook.ts). */
export const HERO_PHONE_QUERY = "(max-width: 749px)";
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** What the browser calls a connection too slow for a background video (Network Information API). */
const SLOW_CONNECTIONS = ["slow-2g", "2g", "3g"];

export interface HeroVideoConditions {
  /** The screen is phone-wide. */
  phone: boolean;
  /** The visitor asked for less motion. */
  reducedMotion: boolean;
  /** `navigator.connection.saveData`, where the browser has it. */
  saveData?: unknown;
  /** `navigator.connection.effectiveType`, where the browser has it. */
  effectiveType?: unknown;
}

/** A browser that says nothing about its connection (Safari, Firefox) is taken as fast enough. */
export function heroVideoAllowed(conditions: HeroVideoConditions): boolean {
  if (conditions.phone || conditions.reducedMotion) return false;
  if (conditions.saveData === true) return false;
  return !(typeof conditions.effectiveType === "string" && SLOW_CONNECTIONS.includes(conditions.effectiveType));
}

export interface ConnectionLike {
  saveData?: unknown;
  effectiveType?: unknown;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
}

/** `navigator.connection`, or null where the browser has none. */
export function connectionOf(nav: unknown): ConnectionLike | null {
  const connection = nav && typeof nav === "object" ? (nav as { connection?: unknown }).connection : null;
  return connection && typeof connection === "object" ? (connection as ConnectionLike) : null;
}

/** The file's type for its <source>, read off the address (the media library only keeps MP4 and WebM). */
export function videoTypeOf(url: string): string | undefined {
  const path = url.split(/[?#]/)[0] ?? "";
  if (/\.mp4$/i.test(path)) return "video/mp4";
  if (/\.webm$/i.test(path)) return "video/webm";
  return undefined;
}
