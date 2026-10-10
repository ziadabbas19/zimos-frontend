/**
 * Where a slide's text sits over its picture, and how strong the veil between
 * the two is — on a computer and on a phone.
 *
 * All of it is read from the slide's own props (never a style key), so the
 * server stores it without knowing about it:
 *
 *   side, vertical            the computer's place — what a slide always had
 *   sideMobile, verticalMobile  the phone's place; unset, the computer's
 *   overlay                   the veil in percent, 0 to 60; unset, none
 *   overlayMobile             the phone's veil; unset, the computer's
 *
 * A slide saved before these existed sets none of them: it resolves to the
 * centre and the bottom with no veil on both, which is exactly what the store
 * drew, and `heroLookMarkup` then adds nothing to its markup.
 *
 * No imports on purpose: the node test loads this file as it is.
 */

export type HeroSide = "start" | "center" | "end";
export type HeroVertical = "top" | "middle" | "bottom";

export interface HeroPlacement {
  side: HeroSide;
  vertical: HeroVertical;
  /** The veil over the picture in percent, 0 to 60. 0 draws none. */
  overlay: number;
}

export interface HeroLook {
  desktop: HeroPlacement;
  /** The hero's narrow layout (up to HERO_PHONE_MAX_PX wide). */
  phone: HeroPlacement;
}

/** The strongest veil a slide may ask for, in percent: past it the picture is hardly a picture. */
export const HERO_OVERLAY_MAX = 60;
/** Up to this width the hero draws its phone layout (store-sections.css). */
export const HERO_PHONE_MAX_PX = 749;

const SIDES: readonly HeroSide[] = ["start", "center", "end"];
const VERTICALS: readonly HeroVertical[] = ["top", "middle", "bottom"];

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/** A stored veil: a number (or a number typed as text), rounded and held inside 0–60. Null for anything else: not set. */
function overlayOf(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.min(HERO_OVERLAY_MAX, Math.max(0, Math.round(n)));
}

/**
 * A slide's look on both devices. `enabled` is the store's HERO_MEDIA switch:
 * off, the phone's own values and the veil are not read at all and the slide
 * resolves as it did before they existed.
 */
export function resolveHeroLook(slide: Record<string, unknown>, enabled: boolean): HeroLook {
  const desktop: HeroPlacement = {
    side: oneOf(slide.side, SIDES) ?? "center",
    vertical: oneOf(slide.vertical, VERTICALS) ?? "bottom",
    overlay: enabled ? (overlayOf(slide.overlay) ?? 0) : 0,
  };
  if (!enabled) return { desktop, phone: { ...desktop } };
  return {
    desktop,
    phone: {
      side: oneOf(slide.sideMobile, SIDES) ?? desktop.side,
      vertical: oneOf(slide.verticalMobile, VERTICALS) ?? desktop.vertical,
      // 0 on a phone is a choice (no veil there), not "unset".
      overlay: overlayOf(slide.overlayMobile) ?? desktop.overlay,
    },
  };
}

/** What a slide's markup carries beyond what it always did. */
export interface HeroLookMarkup {
  /** The phone's place, only where it differs from the computer's (`data-hm`, `data-vm`). */
  phoneSide?: HeroSide;
  phoneVertical?: HeroVertical;
  /** The veil's opacity (0 to 0.6) on each device; null when neither draws one, and then no veil element is drawn. */
  overlay: { desktop: number; phone: number } | null;
}

export function heroLookMarkup(look: HeroLook): HeroLookMarkup {
  const { desktop, phone } = look;
  const markup: HeroLookMarkup = {
    overlay: desktop.overlay > 0 || phone.overlay > 0 ? { desktop: desktop.overlay / 100, phone: phone.overlay / 100 } : null,
  };
  if (phone.side !== desktop.side) markup.phoneSide = phone.side;
  if (phone.vertical !== desktop.vertical) markup.phoneVertical = phone.vertical;
  return markup;
}
