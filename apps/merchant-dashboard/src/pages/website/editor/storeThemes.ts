import { mixHex, type AccentGrounds } from "@/lib/contrast";

/**
 * The store themes as the dashboard knows them: what to call each one, how to
 * draw its thumbnail, and the grounds its accent is read on in each mode (for
 * the Store look panel's contrast check).
 *
 * The themes themselves live in the storefront — apps/storefront/src/app/
 * store-themes.css (palette, shapes, hero layout) and app/themeFonts.ts
 * (typefaces) — keyed by `themeSettings.storeTheme`. The keys here must match
 * STORE_THEMES in apps/storefront/src/lib/brandTheme.ts, and every colour
 * below must match that stylesheet: storeThemes.test.ts reads it and checks.
 *
 * Named for how they look, never for a kind of shop: any store can wear any
 * of them. "original" is the look every store had before themes — the one on
 * which the merchant still picks font and corners themselves.
 */

export const STORE_THEMES = ["elegant", "bold", "minimal", "classic", "warm", "glass"] as const;
export type StoreThemeKey = (typeof STORE_THEMES)[number];

export const ORIGINAL_LOOK = "original";
export type ThemeChoice = StoreThemeKey | typeof ORIGINAL_LOOK;

/** In the order the pickers show them: the original look first, then the themes. */
export const THEME_CHOICES: readonly ThemeChoice[] = [ORIGINAL_LOOK, ...STORE_THEMES];

export type ColorMode = "light" | "dark";

type Localized = { en: string; ar: string };

export interface ThemePalette {
  /** The page background. */
  paper: string;
  /** Cards, the header, panels. */
  raised: string;
  ink: string;
  inkSoft: string;
  line: string;
  /** The accent a store on this theme gets until the merchant picks one. */
  accent: string;
  /** The theme's own second colour (the brand bar, small badges). */
  secondary: string;
}

export interface ThemeSpec {
  key: ThemeChoice;
  name: Localized;
  description: Localized;
  palette: Record<ColorMode, ThemePalette>;
  /**
   * Glass only: its panes are the raised colour, tinted `tint` toward the
   * accent, `alpha` opaque over the page (store-themes.css --zt-glass-*).
   */
  glass?: Record<ColorMode, { alpha: number; tint: number }>;
  /** `font-family` stacks for the thumbnail's type specimen (lib/themeFonts.ts loads them). */
  fonts: { display: string; displayWeight: number };
  /** The real shapes, drawn small (ThemeSketch.tsx). */
  sketch: {
    buttonRadius: string;
    cardRadius: string;
    imageRadius: string;
    /** How a card is set off from the page. */
    card: "line" | "hairline" | "hard" | "flat" | "shadow" | "cushion" | "glass";
    /** The theme's hero layout. */
    hero: "original" | "rule" | "poster" | "quiet" | "band" | "glow" | "panel";
    /** Button labels in capitals (Latin only — Arabic has no case). */
    upper: boolean;
  };
}

export const THEME_SPECS: Record<ThemeChoice, ThemeSpec> = {
  original: {
    key: "original",
    name: { en: "Original", ar: "الأصلي" },
    description: {
      en: "The standard Zimos look — you choose the font and corners.",
      ar: "مظهر زيموس المعتاد — تختار الخط والحواف بنفسك.",
    },
    palette: {
      light: { paper: "#F5F4EF", raised: "#FFFFFF", ink: "#16211F", inkSoft: "#3C4A46", line: "#DCDACE", accent: "#1F5D5B", secondary: "#E2A33D" },
      dark: { paper: "#0B1220", raised: "#121B2E", ink: "#E7ECF5", inkSoft: "#A9B4C9", line: "#22304A", accent: "#5B8DF6", secondary: "#E8B96A" },
    },
    fonts: { display: '"Fraunces", "Tajawal", ui-serif, Georgia, serif', displayWeight: 700 },
    sketch: { buttonRadius: "0.3em", cardRadius: "0.45em", imageRadius: "0.45em", card: "line", hero: "original", upper: false },
  },
  elegant: {
    key: "elegant",
    name: { en: "Elegant", ar: "أنيق" },
    description: {
      en: "Refined serif headings, generous white space and fine hairlines.",
      ar: "عناوين بخط رفيع أنيق، ومساحات واسعة، وخطوط دقيقة.",
    },
    palette: {
      light: { paper: "#FAF8F4", raised: "#FFFFFF", ink: "#1C1A17", inkSoft: "#5E5850", line: "#E7E1D6", accent: "#7A5A3A", secondary: "#C8B08A" },
      dark: { paper: "#121110", raised: "#1B1A18", ink: "#F1ECE4", inkSoft: "#B3AA9C", line: "#2E2B27", accent: "#D8B88C", secondary: "#8C7556" },
    },
    fonts: { display: '"Cormorant Garamond", "Markazi Text", ui-serif, Georgia, serif', displayWeight: 500 },
    sketch: { buttonRadius: "0", cardRadius: "0", imageRadius: "0", card: "hairline", hero: "rule", upper: true },
  },
  bold: {
    key: "bold",
    name: { en: "Bold", ar: "جريء" },
    description: {
      en: "Heavy type, saturated colour, pill buttons and strong dividers.",
      ar: "خط عريض وألوان مشبعة وأزرار دائرية وفواصل قوية.",
    },
    palette: {
      light: { paper: "#FFFFFF", raised: "#FFFFFF", ink: "#0B0B0C", inkSoft: "#3A3A40", line: "#D4D4D8", accent: "#D7261E", secondary: "#FFD60A" },
      dark: { paper: "#0A0A0B", raised: "#151517", ink: "#FAFAFA", inkSoft: "#B4B4BB", line: "#2E2E33", accent: "#FF5A4E", secondary: "#FFD60A" },
    },
    fonts: { display: '"Archivo", "Cairo", ui-sans-serif, system-ui, sans-serif', displayWeight: 800 },
    sketch: { buttonRadius: "999px", cardRadius: "0.2em", imageRadius: "0", card: "hard", hero: "poster", upper: true },
  },
  minimal: {
    key: "minimal",
    name: { en: "Minimal", ar: "بسيط" },
    description: {
      en: "Quiet geometric type, flat cards and a single accent colour.",
      ar: "خط هندسي هادئ وبطاقات مسطحة ولون تمييز واحد.",
    },
    palette: {
      light: { paper: "#FFFFFF", raised: "#FFFFFF", ink: "#111111", inkSoft: "#5C5C5C", line: "#E6E6E6", accent: "#2F4BFF", secondary: "#111111" },
      dark: { paper: "#0E0E0E", raised: "#161616", ink: "#F2F2F2", inkSoft: "#A3A3A3", line: "#272727", accent: "#8FA0FF", secondary: "#F2F2F2" },
    },
    fonts: { display: '"Alexandria", ui-sans-serif, system-ui, sans-serif', displayWeight: 500 },
    sketch: { buttonRadius: "0", cardRadius: "0", imageRadius: "0", card: "flat", hero: "quiet", upper: false },
  },
  classic: {
    key: "classic",
    name: { en: "Classic", ar: "كلاسيكي" },
    description: {
      en: "A balanced serif and sans pairing with soft shadows — a trusted retail feel.",
      ar: "مزيج متوازن من الخطوط وظلال ناعمة — طابع متجر موثوق.",
    },
    palette: {
      light: { paper: "#F7F4EE", raised: "#FFFFFF", ink: "#1B2433", inkSoft: "#4A5568", line: "#E2DCD0", accent: "#1F3A5F", secondary: "#B7793D" },
      dark: { paper: "#0F1522", raised: "#172033", ink: "#EBEEF4", inkSoft: "#A8B2C3", line: "#27324A", accent: "#9DB9E8", secondary: "#D9A066" },
    },
    fonts: { display: '"Lora", "Noto Naskh Arabic", ui-serif, Georgia, serif', displayWeight: 700 },
    sketch: { buttonRadius: "0.3em", cardRadius: "0.35em", imageRadius: "0.35em", card: "shadow", hero: "band", upper: false },
  },
  warm: {
    key: "warm",
    name: { en: "Warm", ar: "دافئ" },
    description: {
      en: "Friendly rounded type, warm neutrals and soft cushioned cards.",
      ar: "خط ودود مستدير وألوان دافئة وبطاقات ناعمة.",
    },
    palette: {
      light: { paper: "#FBF5EC", raised: "#FFFDF9", ink: "#3B2A20", inkSoft: "#6E5847", line: "#EEDFCC", accent: "#A64A24", secondary: "#E3A857" },
      dark: { paper: "#1C1512", raised: "#261D18", ink: "#F5E9DD", inkSoft: "#C9B5A2", line: "#3A2D25", accent: "#F09A6E", secondary: "#E9B872" },
    },
    fonts: { display: '"Baloo Bhaijaan 2", ui-sans-serif, system-ui, sans-serif', displayWeight: 700 },
    sketch: { buttonRadius: "0.6em", cardRadius: "0.9em", imageRadius: "50% 50% 0.9em 0.9em / 38% 38% 0.9em 0.9em", card: "cushion", hero: "glow", upper: false },
  },
  glass: {
    key: "glass",
    name: { en: "Glass", ar: "زجاجي" },
    description: {
      en: "Frosted see-through panels floating over a soft colour glow.",
      ar: "ألواح شفافة كالزجاج تطفو فوق توهج لوني ناعم.",
    },
    palette: {
      light: { paper: "#EEF1FA", raised: "#FFFFFF", ink: "#0F172A", inkSoft: "#475569", line: "#D3D9E8", accent: "#6242F5", secondary: "#22B8CF" },
      dark: { paper: "#070A14", raised: "#111827", ink: "#EEF2FF", inkSoft: "#A5B0C8", line: "#243049", accent: "#A594FF", secondary: "#5EEAD4" },
    },
    glass: { light: { alpha: 0.58, tint: 0.08 }, dark: { alpha: 0.55, tint: 0.1 } },
    fonts: { display: '"Space Grotesk", "Readex Pro", ui-sans-serif, system-ui, sans-serif', displayWeight: 600 },
    sketch: { buttonRadius: "999px", cardRadius: "0.7em", imageRadius: "0.7em", card: "glass", hero: "panel", upper: false },
  },
};

const THEME_SET = new Set<string>(STORE_THEMES);

/** A saved `themeSettings.storeTheme`, or the original look for anything else. */
export function readThemeChoice(raw: unknown): ThemeChoice {
  return typeof raw === "string" && THEME_SET.has(raw) ? (raw as StoreThemeKey) : ORIGINAL_LOOK;
}

/**
 * What the accent is read on in this theme and mode: the page, and a card.
 * For Glass the card is the frosted pane as it actually shows — the raised
 * colour tinted toward the accent, composited over the page at the pane's
 * opacity — so the check follows the merchant's own colour into the tint.
 */
export function accentGrounds(theme: ThemeChoice, mode: ColorMode, accent: string): AccentGrounds {
  const spec = THEME_SPECS[theme];
  const palette = spec.palette[mode];
  const glass = spec.glass?.[mode];
  if (!glass) return { page: palette.paper, card: palette.raised };
  const tinted = mixHex(palette.raised, accent, glass.tint);
  return { page: palette.paper, card: mixHex(palette.paper, tinted, glass.alpha) };
}
