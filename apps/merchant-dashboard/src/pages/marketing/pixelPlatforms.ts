import { AD_PLATFORM_PIXEL_IDS, type TrackingPixelPlatform } from "@store-builder/api-client";
import { siGoogle, siGoogletagmanager, siMeta, siPinterest, siReddit, siSnapchat, siTiktok, siX } from "simple-icons";

/**
 * What each platform's ID looks like. The patterns are the backend's
 * (trackingPixelService.PLATFORMS), so a bad ID is caught before the request.
 */
export const PLATFORM_META: Record<TrackingPixelPlatform, { name: string; pattern: RegExp; example: string }> = {
  meta: { name: "Meta (Facebook & Instagram)", pattern: /^\d{5,20}$/, example: "123456789012345" },
  tiktok: { name: "TikTok", pattern: /^[A-Z0-9]{10,30}$/, example: "C4ABCDEF1234567890" },
  snapchat: { name: "Snapchat", pattern: /^[a-f0-9-]{20,40}$/i, example: "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d" },
  google: { name: "Google (GA4 / Ads)", pattern: /^(G|AW|GT)-[A-Z0-9]{4,20}$/, example: "G-ABC123XYZ" },
  gtm: { name: "Google Tag Manager", pattern: /^GTM-[A-Z0-9]{4,12}$/, example: "GTM-ABC1234" },
  clarity: { name: "Microsoft Clarity", pattern: /^[a-z0-9]{6,20}$/, example: "abcd1234ef" },
  pinterest: { name: "Pinterest", pattern: /^\d{10,16}$/, example: "2612345678901" },
  // X, Taboola, Outbrain, Kwai, Reddit, Microsoft Ads.
  ...AD_PLATFORM_PIXEL_IDS,
};

/** A platform's name, or its id for one this dashboard does not know yet. */
export function platformName(platform: string): string {
  return PLATFORM_META[platform as TrackingPixelPlatform]?.name ?? platform;
}

/**
 * How a platform is drawn beside its name:
 *  - `brand`: its logo from simple-icons (CC0, simpleicons.org), drawn in the
 *    text colour so it reads in the light and the dark theme alike;
 *  - `letter`: simple-icons 16.35.0 has no logo for it, so a circle with the
 *    platform's first letter, the same for every such platform.
 */
export type PlatformMark = { kind: "brand"; path: string } | { kind: "letter"; letter: string };

const brand = (icon: { path: string }): PlatformMark => ({ kind: "brand", path: icon.path });
const letter = (initial: string): PlatformMark => ({ kind: "letter", letter: initial });

/**
 * Every platform's mark, in one place: a new platform gets its line here
 * (pixelPlatforms.test.ts fails for a platform of PLATFORM_META without one).
 * Clarity is «C», not Microsoft's «M»: Microsoft Ads already has that letter.
 */
export const PLATFORM_ICONS: Record<TrackingPixelPlatform, PlatformMark> = {
  meta: brand(siMeta),
  tiktok: brand(siTiktok),
  snapchat: brand(siSnapchat),
  google: brand(siGoogle),
  gtm: brand(siGoogletagmanager),
  clarity: letter("C"),
  pinterest: brand(siPinterest),
  x: brand(siX),
  taboola: letter("T"),
  outbrain: letter("O"),
  kwai: letter("K"),
  reddit: brand(siReddit),
  microsoft: letter("M"),
};

/** The mark of a platform; one the dashboard does not know yet gets the circle with its id's first letter. */
export function platformMark(platform: string): PlatformMark {
  return PLATFORM_ICONS[platform as TrackingPixelPlatform] ?? letter(platform.charAt(0).toUpperCase() || "?");
}
