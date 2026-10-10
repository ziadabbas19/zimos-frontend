import { accentOf, type FontKey, type RadiusKey, type StoreLook } from "../storeLook";
import { ORIGINAL_LOOK, type ThemeChoice } from "../storeThemes";

/**
 * Ready styles: each one a COMBINATION of values the store look already has —
 * a theme, the accent for light and for dark mode, and on the original look
 * the second colour, the font pairing and the corners too. Nothing here is a
 * new setting: applying a preset writes the same `StoreLook` fields the panel's
 * own controls write, so the storefront reads it as it reads any other look
 * (apps/storefront/src/lib/brandTheme.ts).
 *
 * A theme owns its fonts, corners and buttons, so a preset built on a theme
 * leaves `fontFamily`, `cornerRadius` and `secondaryColor` as the merchant had
 * them — they only show again on the original look.
 *
 * Every accent passes the panel's contrast check on its own theme's grounds in
 * its own mode (storeThemes.ts `accentGrounds`, lib/contrast.ts `checkAccent`):
 * white or ink on the button at 4.5 : 1 or better, and the colour itself as
 * text on the page and on a card.
 */
export interface ThemePreset {
  key: string;
  name: { en: string; ar: string };
  /** The kind of shop it suits, in a few words. */
  note: { en: string; ar: string };
  storeTheme: ThemeChoice;
  /** The accent in light mode. */
  primaryColor: string;
  /** The accent in dark mode — lighter, so it reads on a dark page. */
  primaryColorDark: string;
  /** Original look only. */
  secondaryColor?: string;
  /** Original look only. */
  fontFamily?: FontKey;
  /** Original look only. */
  cornerRadius?: RadiusKey;
}

export const THEME_PRESETS: readonly ThemePreset[] = [
  {
    key: "calm",
    name: { en: "Calm", ar: "هادي" },
    note: { en: "Fashion and clothing", ar: "موضة وملابس" },
    storeTheme: "elegant",
    primaryColor: "#6F5F4E",
    primaryColorDark: "#D9C4A9",
  },
  {
    key: "bold",
    name: { en: "Bold", ar: "جريء" },
    note: { en: "Gadgets and deals", ar: "إلكترونيات وعروض" },
    storeTheme: "bold",
    primaryColor: "#1447E6",
    primaryColorDark: "#8FB0FF",
  },
  {
    key: "soft",
    name: { en: "Soft", ar: "ناعم" },
    note: { en: "Beauty and care", ar: "تجميل وعناية" },
    storeTheme: "warm",
    primaryColor: "#A8325E",
    primaryColorDark: "#F5A3BF",
  },
  {
    key: "luxe",
    name: { en: "Premium", ar: "فخم" },
    note: { en: "Perfume and accessories", ar: "عطور وإكسسوارات" },
    storeTheme: ORIGINAL_LOOK,
    primaryColor: "#1C1917",
    primaryColorDark: "#E3C27E",
    secondaryColor: "#C8A04A",
    fontFamily: "classic",
    cornerRadius: "sharp",
  },
  {
    key: "classic",
    name: { en: "Classic", ar: "كلاسيك" },
    note: { en: "A store people trust", ar: "متجر عام موثوق" },
    storeTheme: "classic",
    primaryColor: "#1F3A5F",
    primaryColorDark: "#9DB9E8",
  },
  {
    key: "fresh",
    name: { en: "Fresh", ar: "فريش" },
    note: { en: "Food, grocery, pharmacy", ar: "أكل وبقالة وصيدلية" },
    storeTheme: ORIGINAL_LOOK,
    primaryColor: "#127A39",
    primaryColorDark: "#4ADE80",
    secondaryColor: "#F59E0B",
    fontFamily: "tajawal",
    cornerRadius: "round",
  },
  {
    key: "mono",
    name: { en: "Minimal", ar: "بسيط" },
    note: { en: "Black and white", ar: "أبيض وأسود" },
    storeTheme: "minimal",
    primaryColor: "#111111",
    primaryColorDark: "#F2F2F2",
  },
];

/**
 * The look with a preset laid over it — one object, so the caller's single
 * `onChange` is one undo step and one preview update. The logo, announcement
 * bar, header and footer are not part of a style and stay as they are.
 */
export function applyThemePreset(look: StoreLook, preset: ThemePreset): StoreLook {
  return {
    ...look,
    storeTheme: preset.storeTheme,
    primaryColor: preset.primaryColor,
    primaryColorFromTemplate: false,
    primaryColorDark: preset.primaryColorDark,
    secondaryColor: preset.secondaryColor ?? look.secondaryColor,
    fontFamily: preset.fontFamily ?? look.fontFamily,
    cornerRadius: preset.cornerRadius ?? look.cornerRadius,
  };
}

/** Whether the look is exactly this preset — the card then shows as chosen. */
export function matchesThemePreset(look: StoreLook, preset: ThemePreset): boolean {
  if (look.storeTheme !== preset.storeTheme) return false;
  if (accentOf(look) !== preset.primaryColor || look.primaryColorDark !== preset.primaryColorDark) return false;
  if (preset.storeTheme !== ORIGINAL_LOOK) return true;
  return (
    (preset.secondaryColor === undefined || look.secondaryColor === preset.secondaryColor) &&
    (preset.fontFamily === undefined || look.fontFamily === preset.fontFamily) &&
    (preset.cornerRadius === undefined || look.cornerRadius === preset.cornerRadius)
  );
}
