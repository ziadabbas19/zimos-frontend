import { useSyncExternalStore, type CSSProperties } from "react";
import type { Locale } from "@/i18n/LocaleContext";

/**
 * The picture behind the dashboard's glass (owner, 2026-11-15: "bring us glass
 * backgrounds"): abstract wallpapers from Unsplash (free for commercial use,
 * public/wallpapers/CREDITS.md), or "calm", the plain ground with the glow
 * colours. Kept on this device, like the look; the default is the ZIMOS blue
 * waves. The panes over a picture are filled more (liquid-glass.css), so
 * words on them stay readable whatever the picture.
 */
export type WallpaperId = "waves" | "violet" | "ribbons" | "rainbow" | "neon" | "night" | "calm";

export const WALLPAPERS: Array<{ id: WallpaperId; name: Record<Locale, string> }> = [
  { id: "waves", name: { ar: "موج أزرق", en: "Blue waves" } },
  { id: "violet", name: { ar: "موج بنفسجي", en: "Violet waves" } },
  { id: "ribbons", name: { ar: "شرائط زجاج", en: "Glass ribbons" } },
  { id: "rainbow", name: { ar: "ألوان ناعمة", en: "Soft colours" } },
  { id: "neon", name: { ar: "نيون", en: "Neon" } },
  { id: "night", name: { ar: "ليل", en: "Night" } },
  { id: "calm", name: { ar: "هادئة", en: "Calm" } },
];

const KEY = "zimos.wallpaper";
const EVENT = "zimos:wallpaper";
export const DEFAULT_WALLPAPER: WallpaperId = "waves";

export function readWallpaper(): WallpaperId {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && WALLPAPERS.some((w) => w.id === saved)) return saved as WallpaperId;
  } catch {
    /* private mode: the default */
  }
  return DEFAULT_WALLPAPER;
}

export function setWallpaper(id: WallpaperId) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* private mode: for this visit only */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The wallpaper chosen on this device; every frame and the settings picker follow it at once. */
export function useWallpaper(): WallpaperId {
  return useSyncExternalStore(subscribe, readWallpaper, () => DEFAULT_WALLPAPER);
}

/** A picture's files, for the frame (`data-wallpaper` and these two variables) and the picker's thumbnail. */
export function wallpaperFiles(id: WallpaperId) {
  return { wide: `/wallpapers/${id}.webp`, phone: `/wallpapers/${id}-phone.webp`, thumb: `/wallpapers/${id}-thumb.webp` };
}

/** The frame's attributes for a wallpaper: none for "calm", which keeps the plain ground. */
export function wallpaperFrame(id: WallpaperId): { "data-wallpaper"?: string; style?: CSSProperties } {
  if (id === "calm") return {};
  const files = wallpaperFiles(id);
  return {
    "data-wallpaper": id,
    style: { "--zimos-wallpaper": `url("${files.wide}")`, "--zimos-wallpaper-phone": `url("${files.phone}")` } as CSSProperties,
  };
}
