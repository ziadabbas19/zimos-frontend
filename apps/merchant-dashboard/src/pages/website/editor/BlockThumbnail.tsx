import { memo, useMemo, type CSSProperties, type ReactNode } from "react";
import type { PageElementType, PageSection } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { IconCode, IconImage, IconPlace, IconPlay, IconStar } from "@/components/icons";
import { BLOCK_PRESETS, type BlockPreset, type ColumnWithSettings, type PresetRow } from "./blocks";

/**
 * A schematic of a section, drawn from the element types it holds — no images
 * to load, so the library opens at once and a thumbnail can never disagree
 * with what the preset actually contains. Each element type has one fixed
 * sketch; a preset is its sketches stacked in order, like the section it
 * creates — or, for a preset laid out over columns, the same sketches on the
 * same 12-column grid the storefront draws, so the thumbnail shows the shape
 * the merchant will get.
 *
 * The frame is 16:10 at any width. Everything inside is measured in `em`, and
 * one em is a sixteenth of the frame's width (a container-query unit), so the
 * same drawing reads in a two-column grid on a phone, a three-column grid on a
 * desktop and the narrow library panel. A drawing taller than the frame is
 * scaled down to fit instead of being cut.
 *
 * Colour: text is grey bars (dark for a title, light for a paragraph), image
 * areas are soft tiles with a small glyph, and the store's brand colour is
 * the one accent — buttons, links, stars. The strong section grounds show on
 * the thumbnail too, or a brand-colour band and a plain one would look alike.
 */

// ---------------------------------------------------------------------------
// Colours — custom properties on the frame, so one drawing works on any ground
// ---------------------------------------------------------------------------

type Palette = CSSProperties & Record<`--tb-${string}`, string>;

const mix = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

function palette(ground: string, ink: string, accent: string, strength: [number, number, number, number, number]): Palette {
  const [strong, soft, tile, glyph, line] = strength;
  return {
    backgroundColor: ground,
    "--tb-ground": ground,
    "--tb-strong": mix(ink, strong),
    "--tb-soft": mix(ink, soft),
    "--tb-tile": mix(ink, tile),
    "--tb-glyph": mix(ink, glyph),
    "--tb-line": mix(ink, line),
    "--tb-accent": accent,
    "--tb-accent-soft": mix(accent, 22),
  };
}

const ON_LIGHT: [number, number, number, number, number] = [62, 20, 9, 38, 18];
const INK = "var(--color-ink)";
const BRAND = "var(--color-primary)";

const PLAIN = palette("var(--color-paper)", INK, BRAND, ON_LIGHT);
const GROUNDS: Record<string, Palette> = {
  paper: palette("var(--color-paper-sunken)", INK, BRAND, ON_LIGHT),
  raised: palette("var(--color-paper-sunken)", INK, BRAND, ON_LIGHT),
  "primary-soft": palette("var(--color-primary-soft)", INK, BRAND, ON_LIGHT),
  // A band in the brand colour: everything on it is drawn in the colour its text has.
  primary: palette(BRAND, "var(--primary-foreground)", "var(--primary-foreground)", [94, 56, 22, 76, 44]),
  // A dark band is dark in both themes.
  ink: palette("#14161a", "#ffffff", BRAND, [90, 42, 14, 62, 30]),
};

function groundOf(settings: Record<string, unknown> | undefined): Palette {
  const background = settings?.background;
  return typeof background === "string" ? (GROUNDS[background] ?? PLAIN) : PLAIN;
}

// The drawing's few fills, as classes over those properties.
const STRONG = "bg-[color:var(--tb-strong)]";
const SOFT = "bg-[color:var(--tb-soft)]";
const TILE = "bg-[color:var(--tb-tile)]";
const FAINT = "bg-[color:var(--tb-glyph)]";
const ACCENT = "bg-[color:var(--tb-accent)]";
const ACCENT_SOFT = "bg-[color:var(--tb-accent-soft)]";
const LINE = "border border-[color:var(--tb-line)]";
const GLYPH = "text-[color:var(--tb-glyph)]";
const ON_ACCENT = "text-[color:var(--tb-ground)]";

// ---------------------------------------------------------------------------
// Pieces shared by several sketches. Module-level elements: React reuses them
// as they are, so a hundred thumbnails cost no more to describe than one.
// ---------------------------------------------------------------------------

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** A line of text: `width` of its box, light unless told otherwise. */
function line(width: string, tone = SOFT, height = "h-[0.32em]"): ReactNode {
  return <span className={cn("block shrink-0 rounded-full", height, tone)} style={{ width }} />;
}

const PICTURE = <IconImage className={cn("size-[1.5em] shrink-0", GLYPH)} aria-hidden />;
const PICTURE_SMALL = <IconImage className={cn("size-[1em] shrink-0", GLYPH)} aria-hidden />;

const STARS = (
  <span className="flex shrink-0 items-center gap-[0.1em]">
    {range(5).map((i) => (
      <IconStar key={i} className="size-[0.5em] text-[color:var(--tb-accent)]" aria-hidden />
    ))}
  </span>
);

const DOTS = (
  <span className="absolute inset-x-0 bottom-[0.45em] flex justify-center gap-[0.25em]">
    <span className={cn("block size-[0.3em] rounded-full", STRONG)} />
    <span className={cn("block size-[0.3em] rounded-full", SOFT)} />
    <span className={cn("block size-[0.3em] rounded-full", SOFT)} />
  </span>
);

const BUTTON = <span className={cn("block h-[1.1em] w-[3.9em] shrink-0 rounded-full", ACCENT)} />;

const FIELD = <span className={cn("block h-[0.92em] w-full shrink-0 rounded-[0.28em]", LINE)} />;

/** One product as a shop shows it: its picture, its name, its price. */
const PRODUCT = (
  <span className="flex min-w-0 flex-1 flex-col gap-[0.24em]">
    <span className={cn("block h-[2.4em] rounded-[0.35em]", TILE)} />
    <span className={cn("block h-[0.26em] w-[80%] rounded-full", SOFT)} />
    <span className={cn("block h-[0.3em] w-[45%] rounded-full", ACCENT)} />
  </span>
);

const PRODUCT_ROW = (
  <span className="mx-auto flex w-[92%] gap-[0.4em]">
    {range(4).map((i) => (
      <span key={i} className="flex min-w-0 flex-1">
        {PRODUCT}
      </span>
    ))}
  </span>
);

const SLIDES = (
  <span className={cn("relative mx-auto flex h-[4.4em] w-full items-center justify-center rounded-[0.5em]", TILE)}>
    {PICTURE}
    {DOTS}
  </span>
);

/** A wide picture tile with one glyph in it — an image, a video, a map, an embed. */
function tile(glyph: ReactNode, height = "h-[4.2em]"): ReactNode {
  return <span className={cn("mx-auto flex w-[70%] items-center justify-center rounded-[0.5em]", height, TILE)}>{glyph}</span>;
}

const PLAY = (
  <span className={cn("flex size-[1.7em] items-center justify-center rounded-full", ACCENT)}>
    <IconPlay className={cn("size-[0.8em]", ON_ACCENT)} aria-hidden />
  </span>
);

const SUMMARY_CARD = (
  <span className={cn("mx-auto flex w-[70%] flex-col gap-[0.32em] rounded-[0.5em] p-[0.5em]", LINE)}>
    {range(2).map((i) => (
      <span key={i} className="flex items-center justify-between gap-[0.4em]">
        {line("46%")}
        {line("16%")}
      </span>
    ))}
    <span className="block h-px w-full bg-[color:var(--tb-line)]" />
    <span className="flex items-center justify-between gap-[0.4em]">
      {line("30%", STRONG)}
      {line("22%", ACCENT)}
    </span>
  </span>
);

// ---------------------------------------------------------------------------
// One sketch per element type, and how tall it is in em (to fit the frame)
// ---------------------------------------------------------------------------

interface Sketch {
  /** Its height in em, near enough to decide whether the drawing fits. */
  h: number;
  node: ReactNode;
}

const GALLERY_GRID: Sketch = {
  h: 3.7,
  node: (
    <span className="mx-auto grid w-[86%] grid-cols-3 gap-[0.3em]">
      {range(6).map((i) => (
        <span key={i} className={cn("block h-[1.7em] rounded-[0.35em]", TILE)} />
      ))}
    </span>
  ),
};

const FALLBACK: Sketch = { h: 0.4, node: <span className={cn("mx-auto block h-[0.4em] w-[60%] rounded-full", SOFT)} /> };

/** Keyed by element type; the builder's extra types are outside the api-client's union, hence `string`. */
const SKETCHES: Record<string, Sketch> = {
  heading: { h: 0.62, node: <span className={cn("mx-auto block h-[0.62em] w-[56%] shrink-0 rounded-full", STRONG)} /> },
  text: {
    h: 0.9,
    node: (
      <span className="mx-auto flex w-[78%] flex-col items-center gap-[0.26em]">
        {line("100%")}
        {line("72%")}
      </span>
    ),
  },
  rich_text: {
    h: 1.5,
    node: (
      <span className="mx-auto flex w-[80%] flex-col gap-[0.26em]">
        {line("100%")}
        {line("100%")}
        {line("58%")}
      </span>
    ),
  },
  button: { h: 1.1, node: <span className="flex justify-center">{BUTTON}</span> },
  text_link: { h: 0.3, node: <span className={cn("mx-auto block h-[0.3em] w-[30%] rounded-full", ACCENT)} /> },
  image: { h: 4.2, node: tile(PICTURE) },
  gallery: GALLERY_GRID,
  carousel: { h: 4.4, node: SLIDES },
  video: { h: 4.2, node: tile(PLAY) },
  embed: { h: 4.2, node: tile(<IconCode className={cn("size-[1.5em]", GLYPH)} aria-hidden />) },
  map: { h: 4.2, node: tile(<IconPlace className="size-[1.6em] text-[color:var(--tb-accent)]" aria-hidden />) },
  spacer: { h: 1.6, node: <span className="mx-auto block h-[1.6em] w-[70%] border-y border-dashed border-[color:var(--tb-line)]" /> },
  divider: { h: 0.1, node: <span className={cn("mx-auto block h-[0.1em] w-[80%] rounded-full", FAINT)} /> },
  icon: {
    h: 1.7,
    node: (
      <span className={cn("mx-auto flex size-[1.7em] items-center justify-center rounded-full", ACCENT_SOFT)}>
        <IconStar className="size-[0.95em] text-[color:var(--tb-accent)]" aria-hidden />
      </span>
    ),
  },
  list: {
    h: 1.7,
    node: (
      <span className="mx-auto flex w-[60%] flex-col gap-[0.34em]">
        {range(3).map((i) => (
          <span key={i} className="flex items-center gap-[0.35em]">
            <span className={cn("block size-[0.34em] shrink-0 rounded-full", ACCENT)} />
            <span className={cn("block h-[0.32em] flex-1 rounded-full", SOFT)} />
          </span>
        ))}
      </span>
    ),
  },
  accordion: {
    h: 3.4,
    node: (
      <span className="mx-auto flex w-[82%] flex-col gap-[0.28em]">
        {range(3).map((i) => (
          <span key={i} className={cn("flex h-[0.95em] items-center justify-between rounded-[0.28em] px-[0.4em]", LINE)}>
            {line("52%", i === 0 ? STRONG : SOFT, "h-[0.28em]")}
            <span className={cn("block size-[0.28em] rounded-full", FAINT)} />
          </span>
        ))}
      </span>
    ),
  },
  testimonial: {
    h: 4.1,
    node: (
      <span className={cn("mx-auto flex w-[80%] flex-col gap-[0.34em] rounded-[0.5em] p-[0.55em]", LINE)}>
        {STARS}
        {line("100%")}
        {line("70%")}
        <span className="flex items-center gap-[0.3em]">
          <span className={cn("block size-[0.8em] shrink-0 rounded-full", TILE)} />
          {line("30%", STRONG, "h-[0.28em]")}
        </span>
      </span>
    ),
  },
  countdown: {
    h: 1.7,
    node: (
      <span className="mx-auto flex justify-center gap-[0.3em]">
        {range(4).map((i) => (
          <span key={i} className={cn("flex h-[1.7em] w-[1.5em] items-center justify-center rounded-[0.3em]", ACCENT_SOFT)}>
            <span className={cn("block h-[0.5em] w-[0.6em] rounded-[0.12em]", ACCENT)} />
          </span>
        ))}
      </span>
    ),
  },
  form: {
    h: 3.5,
    node: (
      <span className="mx-auto flex w-[62%] flex-col gap-[0.3em]">
        {FIELD}
        {FIELD}
        <span className={cn("block h-[1em] w-[45%] rounded-full", ACCENT)} />
      </span>
    ),
  },
  social_icons: {
    h: 0.95,
    node: (
      <span className="mx-auto flex justify-center gap-[0.4em]">
        {range(4).map((i) => (
          <span key={i} className={cn("block size-[0.95em] rounded-full", FAINT)} />
        ))}
      </span>
    ),
  },
  product_card: {
    h: 3.4,
    node: (
      <span className="mx-auto flex w-[80%] items-center gap-[0.6em]">
        <span className={cn("flex size-[3.4em] shrink-0 items-center justify-center rounded-[0.45em]", TILE)}>{PICTURE_SMALL}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-[0.32em]">
          {line("90%", STRONG, "h-[0.4em]")}
          {line("55%")}
          <span className={cn("block h-[0.95em] w-[60%] rounded-full", ACCENT)} />
        </span>
      </span>
    ),
  },
  shoppable_image: {
    h: 4.2,
    node: (
      <span className={cn("relative mx-auto flex h-[4.2em] w-[70%] items-center justify-center rounded-[0.5em]", TILE)}>
        {PICTURE}
        <span className={cn("absolute start-[22%] top-[26%] block size-[0.6em] rounded-full ring-[0.16em] ring-[color:var(--tb-ground)]", ACCENT)} />
        <span className={cn("absolute end-[24%] bottom-[24%] block size-[0.6em] rounded-full ring-[0.16em] ring-[color:var(--tb-ground)]", ACCENT)} />
      </span>
    ),
  },
  product_list: { h: 3.5, node: PRODUCT_ROW },
  collection_list: {
    h: 3.2,
    node: (
      <span className="mx-auto flex w-[92%] gap-[0.4em]">
        {range(4).map((i) => (
          <span key={i} className="flex min-w-0 flex-1 flex-col items-center gap-[0.26em]">
            <span className={cn("block h-[2.6em] w-full rounded-[0.35em]", TILE)} />
            {line("60%", STRONG, "h-[0.28em]")}
          </span>
        ))}
      </span>
    ),
  },
  orbit_gallery: {
    h: 2.9,
    node: (
      <span className="mx-auto flex w-[84%] items-center justify-center gap-[0.35em]">
        <span className={cn("block h-[1.9em] flex-1 rounded-[0.35em]", TILE)} />
        <span className={cn("block h-[2.9em] flex-1 rounded-[0.35em]", TILE)} />
        <span className={cn("block h-[2.9em] flex-1 rounded-[0.35em]", TILE)} />
        <span className={cn("block h-[1.9em] flex-1 rounded-[0.35em]", TILE)} />
      </span>
    ),
  },
  cart: {
    h: 3.6,
    node: (
      <span className="mx-auto flex w-[76%] flex-col gap-[0.32em]">
        {range(2).map((i) => (
          <span key={i} className="flex items-center gap-[0.4em]">
            <span className={cn("block size-[1em] shrink-0 rounded-[0.22em]", TILE)} />
            <span className={cn("block h-[0.3em] flex-1 rounded-full", SOFT)} />
            {line("18%", STRONG, "h-[0.3em]")}
          </span>
        ))}
        <span className={cn("block h-[0.95em] w-full rounded-full", ACCENT)} />
      </span>
    ),
  },
  shader_hero: {
    h: 5.2,
    node: (
      <span
        className="mx-auto flex h-[5.2em] w-full flex-col items-center justify-center gap-[0.4em] rounded-[0.5em]"
        style={{ backgroundImage: "linear-gradient(135deg, var(--tb-accent), var(--tb-accent-soft))" }}
      >
        <span className="block h-[0.6em] w-[50%] rounded-full bg-[color:var(--tb-ground)] opacity-90" />
        <span className="block h-[0.32em] w-[34%] rounded-full bg-[color:var(--tb-ground)] opacity-60" />
      </span>
    ),
  },
  product_3d: {
    h: 3.8,
    node: (
      <span className="relative mx-auto flex h-[3.8em] w-[70%] items-center justify-center">
        <span className={cn("absolute h-[1.4em] w-full rounded-[50%]", LINE)} />
        <span className={cn("block size-[2.1em] rotate-12 rounded-[0.4em] opacity-80", ACCENT)} />
      </span>
    ),
  },
  scroll_story: {
    h: 4.2,
    node: (
      <span className="mx-auto flex w-[86%] flex-col gap-[0.4em]">
        {range(2).map((i) => (
          <span key={i} className={cn("flex items-center gap-[0.5em]", i === 1 && "flex-row-reverse")}>
            <span className={cn("block h-[1.9em] w-[46%] shrink-0 rounded-[0.35em]", TILE)} />
            <span className="flex min-w-0 flex-1 flex-col gap-[0.26em]">
              {line("100%", STRONG, "h-[0.34em]")}
              {line("65%")}
            </span>
          </span>
        ))}
      </span>
    ),
  },
  marquee: {
    h: 0.8,
    node: (
      <span className="flex gap-[0.4em] overflow-hidden">
        {range(5).map((i) => (
          <span key={i} className={cn("block h-[0.8em] w-[30%] shrink-0 rounded-full", ACCENT_SOFT)} />
        ))}
      </span>
    ),
  },
  comparison: {
    h: 1.9,
    node: (
      <span className="mx-auto flex w-[84%] flex-col gap-[0.3em]">
        {range(3).map((i) => (
          <span key={i} className="grid grid-cols-3 gap-[0.4em]">
            <span className={cn("block h-[0.42em] rounded-full", SOFT)} />
            <span className={cn("block h-[0.42em] rounded-full", ACCENT)} />
            <span className={cn("block h-[0.42em] rounded-full", TILE)} />
          </span>
        ))}
      </span>
    ),
  },
  tabs: {
    h: 2.2,
    node: (
      <span className="mx-auto flex w-[80%] flex-col gap-[0.4em]">
        <span className="flex gap-[0.3em]">
          <span className={cn("block h-[0.8em] w-[24%] rounded-full", ACCENT)} />
          <span className={cn("block h-[0.8em] w-[24%] rounded-full", TILE)} />
          <span className={cn("block h-[0.8em] w-[24%] rounded-full", TILE)} />
        </span>
        {line("100%")}
        {line("70%")}
      </span>
    ),
  },
  toggle: {
    h: 1.1,
    node: (
      <span className={cn("mx-auto flex h-[1.1em] w-[80%] items-center justify-between rounded-[0.3em] px-[0.45em]", LINE)}>
        {line("45%", STRONG, "h-[0.3em]")}
        <span className={cn("block size-[0.3em] rounded-full", FAINT)} />
      </span>
    ),
  },
  stars_display: {
    h: 0.6,
    node: (
      <span className="mx-auto flex items-center justify-center gap-[0.4em]">
        {STARS}
        <span className={cn("block h-[0.3em] w-[2.4em] rounded-full", SOFT)} />
      </span>
    ),
  },
  price: {
    h: 0.8,
    node: (
      <span className="mx-auto flex items-end justify-center gap-[0.4em]">
        <span className={cn("block h-[0.8em] w-[2.8em] rounded-[0.2em]", STRONG)} />
        <span className={cn("block h-[0.4em] w-[1.8em] rounded-full", SOFT)} />
      </span>
    ),
  },
  reviews_list: {
    h: 3.6,
    node: (
      <span className="mx-auto flex w-[80%] flex-col gap-[0.4em]">
        {range(2).map((i) => (
          <span key={i} className="flex flex-col gap-[0.22em]">
            {STARS}
            {line("100%")}
            {line("60%")}
          </span>
        ))}
      </span>
    ),
  },
  cod_form: {
    h: 4.5,
    node: (
      <span className={cn("mx-auto flex w-[66%] flex-col gap-[0.3em] rounded-[0.5em] p-[0.5em]", LINE)}>
        {FIELD}
        {FIELD}
        <span className={cn("block h-[1.05em] w-full rounded-full", ACCENT)} />
      </span>
    ),
  },
  checkout_summary: { h: 3.4, node: SUMMARY_CARD },
  order_summary: { h: 3.4, node: SUMMARY_CARD },
  upsell_accept_button: { h: 1.3, node: <span className={cn("mx-auto block h-[1.3em] w-[62%] rounded-full", ACCENT)} /> },
  upsell_decline_link: { h: 0.28, node: <span className={cn("mx-auto block h-[0.28em] w-[30%] rounded-full", FAINT)} /> },
  repeater: {
    h: 2.4,
    node: (
      <span className="mx-auto grid w-[90%] grid-cols-3 gap-[0.4em]">
        {range(3).map((i) => (
          <span key={i} className={cn("flex h-[2.4em] flex-col justify-center gap-[0.26em] rounded-[0.35em] px-[0.35em]", LINE)}>
            {line("70%", STRONG, "h-[0.3em]")}
            {line("100%", SOFT, "h-[0.26em]")}
          </span>
        ))}
      </span>
    ),
  },

  // --- the showcase bands: one element is the whole section ---
  hero_slider: {
    h: 6,
    node: (
      <span className={cn("relative flex min-h-[6em] w-full flex-1 flex-col items-center justify-center gap-[0.45em]", TILE)}>
        <IconImage className={cn("absolute end-[0.9em] top-[0.9em] size-[1.3em]", GLYPH)} aria-hidden />
        <span className={cn("block h-[0.62em] w-[46%] rounded-full", STRONG)} />
        <span className={cn("block h-[0.32em] w-[30%] rounded-full", SOFT)} />
        {BUTTON}
        {DOTS}
      </span>
    ),
  },
  image_banner: {
    h: 5.4,
    node: (
      <span className={cn("relative flex min-h-[5.4em] w-full flex-1 flex-col justify-center gap-[0.4em] px-[1.2em]", TILE)}>
        <IconImage className={cn("absolute end-[1.2em] top-1/2 size-[2em] -translate-y-1/2", GLYPH)} aria-hidden />
        <span className={cn("block h-[0.6em] w-[42%] rounded-full", STRONG)} />
        <span className={cn("block h-[0.32em] w-[30%] rounded-full", SOFT)} />
        {BUTTON}
      </span>
    ),
  },
  category_tiles: {
    h: 4.4,
    node: (
      <span className="mx-auto flex w-[90%] flex-col items-center gap-[0.5em]">
        {line("36%", STRONG, "h-[0.5em]")}
        <span className="grid w-full grid-cols-4 gap-[0.4em]">
          {range(4).map((i) => (
            <span key={i} className="flex flex-col items-center gap-[0.22em]">
              <span className={cn("block aspect-square w-full rounded-[0.4em]", TILE)} />
              {line("60%", SOFT, "h-[0.26em]")}
            </span>
          ))}
        </span>
      </span>
    ),
  },
  trust_strip: {
    h: 2.1,
    node: (
      <span className="mx-auto grid w-[92%] grid-cols-4 gap-[0.35em]">
        {range(4).map((i) => (
          <span key={i} className={cn("flex flex-col items-center gap-[0.26em] rounded-[0.4em] py-[0.45em]", LINE)}>
            <span className={cn("block size-[0.9em] rounded-full", ACCENT_SOFT)} />
            {line("60%", SOFT, "h-[0.26em]")}
          </span>
        ))}
      </span>
    ),
  },
  bundle_cards: {
    h: 4.5,
    node: (
      <span className="flex flex-col gap-[0.5em]">
        <span className="mx-auto flex w-[92%]">{line("34%", STRONG, "h-[0.5em]")}</span>
        {PRODUCT_ROW}
      </span>
    ),
  },
  product_cards: {
    h: 4.5,
    node: (
      <span className="flex flex-col gap-[0.5em]">
        <span className="mx-auto flex w-[92%]">{line("34%", STRONG, "h-[0.5em]")}</span>
        {PRODUCT_ROW}
      </span>
    ),
  },
  product_rail: {
    h: 4.5,
    node: (
      <span className="flex flex-col gap-[0.5em]">
        <span className="mx-auto flex w-[92%]">{line("34%", STRONG, "h-[0.5em]")}</span>
        <span className="flex gap-[0.4em] overflow-hidden ps-[4%]">
          {range(5).map((i) => (
            <span key={i} className="flex w-[22%] shrink-0">
              {PRODUCT}
            </span>
          ))}
        </span>
      </span>
    ),
  },
  product_shelf: {
    h: 5,
    node: (
      <span className="relative flex flex-col gap-[0.5em] pb-[0.9em]">
        <span className="mx-auto flex w-[92%]">{line("34%", STRONG, "h-[0.5em]")}</span>
        {PRODUCT_ROW}
        <span className="absolute inset-x-0 bottom-0 flex justify-center gap-[0.25em]">
          <span className={cn("block size-[0.3em] rounded-full", STRONG)} />
          <span className={cn("block size-[0.3em] rounded-full", SOFT)} />
          <span className={cn("block size-[0.3em] rounded-full", SOFT)} />
        </span>
      </span>
    ),
  },
  need_picker: {
    h: 4.6,
    node: (
      <span className="mx-auto flex w-[84%] flex-col gap-[0.5em]">
        <span className="flex justify-center gap-[0.3em]">
          <span className={cn("block h-[0.8em] w-[22%] rounded-full", ACCENT)} />
          <span className={cn("block h-[0.8em] w-[22%] rounded-full", TILE)} />
          <span className={cn("block h-[0.8em] w-[22%] rounded-full", TILE)} />
        </span>
        <span className={cn("flex items-center gap-[0.6em] rounded-[0.5em] p-[0.45em]", LINE)}>
          <span className={cn("block size-[2.3em] shrink-0 rounded-[0.35em]", TILE)} />
          <span className="flex min-w-0 flex-1 flex-col gap-[0.28em]">
            {line("80%", STRONG, "h-[0.36em]")}
            {line("55%")}
            <span className={cn("block h-[0.7em] w-[45%] rounded-full", ACCENT)} />
          </span>
        </span>
      </span>
    ),
  },
  video_reels: {
    h: 4.4,
    node: (
      <span className="mx-auto flex w-[80%] justify-center gap-[0.4em]">
        {range(4).map((i) => (
          <span key={i} className={cn("flex h-[4.4em] flex-1 items-center justify-center rounded-[0.4em]", TILE)}>
            <IconPlay className={cn("size-[0.9em]", GLYPH)} aria-hidden />
          </span>
        ))}
      </span>
    ),
  },

  // --- the builder's extra elements ---
  image_gallery: {
    h: 4.8,
    node: (
      <span className="mx-auto flex w-[60%] flex-col gap-[0.3em]">
        <span className={cn("flex h-[3.6em] items-center justify-center rounded-[0.45em]", TILE)}>{PICTURE}</span>
        <span className="grid grid-cols-4 gap-[0.3em]">
          {range(4).map((i) => (
            <span
              key={i}
              className={cn("block h-[0.9em] rounded-[0.22em]", TILE, i === 0 && "ring-[0.12em] ring-[color:var(--tb-accent)]")}
            />
          ))}
        </span>
      </span>
    ),
  },
  variant_selector: {
    h: 1,
    node: (
      <span className="mx-auto flex justify-center gap-[0.3em]">
        <span className="block h-[1em] w-[1.9em] rounded-full border-2 border-[color:var(--tb-accent)]" />
        <span className={cn("block h-[1em] w-[1.9em] rounded-full", LINE)} />
        <span className={cn("block h-[1em] w-[1.9em] rounded-full", LINE)} />
        <span className={cn("block h-[1em] w-[1.9em] rounded-full", LINE)} />
      </span>
    ),
  },
  bundle_selector: {
    h: 3.6,
    node: (
      <span className="mx-auto flex w-[72%] flex-col gap-[0.28em]">
        {range(3).map((i) => (
          <span
            key={i}
            className={cn(
              "flex h-[1em] items-center gap-[0.4em] rounded-[0.3em] border px-[0.4em]",
              i === 0 ? "border-[color:var(--tb-accent)]" : "border-[color:var(--tb-line)]"
            )}
          >
            <span className={cn("block size-[0.4em] shrink-0 rounded-full", i === 0 ? ACCENT : FAINT)} />
            <span className={cn("block h-[0.26em] flex-1 rounded-full", SOFT)} />
            {line("18%", STRONG, "h-[0.26em]")}
          </span>
        ))}
      </span>
    ),
  },
  review_form: {
    h: 3.4,
    node: (
      <span className="mx-auto flex w-[62%] flex-col gap-[0.34em]">
        {STARS}
        <span className={cn("block h-[1.5em] w-full rounded-[0.28em]", LINE)} />
        <span className={cn("block h-[1em] w-[45%] rounded-full", ACCENT)} />
      </span>
    ),
  },
  popup: {
    h: 5,
    node: (
      <span className={cn("mx-auto flex h-[5em] w-[86%] items-center justify-center rounded-[0.5em]", TILE)}>
        <span className="flex w-[58%] flex-col items-center gap-[0.3em] rounded-[0.45em] bg-[color:var(--tb-ground)] p-[0.5em] shadow-sm">
          {line("70%", STRONG, "h-[0.4em]")}
          {line("90%")}
          <span className={cn("block h-[0.8em] w-[50%] rounded-full", ACCENT)} />
        </span>
      </span>
    ),
  },
  masonry_grid: {
    h: 4.2,
    node: (
      <span className="mx-auto grid w-[84%] grid-cols-3 gap-[0.3em]">
        <span className="flex flex-col gap-[0.3em]">
          <span className={cn("block h-[2.4em] rounded-[0.35em]", TILE)} />
          <span className={cn("block h-[1.5em] rounded-[0.35em]", TILE)} />
        </span>
        <span className="flex flex-col gap-[0.3em]">
          <span className={cn("block h-[1.5em] rounded-[0.35em]", TILE)} />
          <span className={cn("block h-[2.4em] rounded-[0.35em]", TILE)} />
        </span>
        <span className="flex flex-col gap-[0.3em]">
          <span className={cn("block h-[2em] rounded-[0.35em]", TILE)} />
          <span className={cn("block h-[1.9em] rounded-[0.35em]", TILE)} />
        </span>
      </span>
    ),
  },
};
// A question list reads like an accordion.
SKETCHES.faq = SKETCHES.accordion;

/** The `gallery` element is the one sketch that reads its props: a grid, or one slide with dots. */
function sketchOf(type: string, content: Record<string, unknown> | undefined): Sketch {
  if (type === "gallery" && content?.layout === "slideshow") return SKETCHES.carousel;
  return SKETCHES[type] ?? FALLBACK;
}

// ---------------------------------------------------------------------------
// The small version of a sketch, for an element inside a column. A column is a
// third or a quarter of the thumbnail wide, so the detail above would not read.
// ---------------------------------------------------------------------------

const MINI_PICTURE: Sketch = {
  h: 2.7,
  node: <span className={cn("flex h-[2.7em] w-full items-center justify-center rounded-[0.4em]", TILE)}>{PICTURE_SMALL}</span>,
};
const MINI_PICTURE_BARE: Sketch = { h: 2.7, node: <span className={cn("block h-[2.7em] w-full rounded-[0.4em]", TILE)} /> };
const MINI_TEXT: Sketch = {
  h: 0.8,
  node: (
    <span className="flex w-full flex-col gap-[0.22em]">
      <span className={cn("block h-[0.28em] w-full rounded-full", SOFT)} />
      <span className={cn("block h-[0.28em] w-[64%] rounded-full", SOFT)} />
    </span>
  ),
};
const MINI_PRODUCT: Sketch = {
  h: 2.5,
  node: (
    <span className="flex w-full flex-col gap-[0.22em]">
      <span className={cn("block h-[2em] rounded-[0.35em]", TILE)} />
      <span className={cn("block h-[0.26em] w-[70%] rounded-full", SOFT)} />
    </span>
  ),
};
const MINI_ROWS: Sketch = {
  h: 1.5,
  node: (
    <span className="flex w-full flex-col gap-[0.22em]">
      <span className={cn("block h-[0.64em] rounded-[0.2em]", LINE)} />
      <span className={cn("block h-[0.64em] rounded-[0.2em]", LINE)} />
    </span>
  ),
};
const MINI_FORM: Sketch = {
  h: 1.8,
  node: (
    <span className="flex w-full flex-col gap-[0.24em]">
      <span className={cn("block h-[0.7em] rounded-[0.22em]", LINE)} />
      <span className={cn("block h-[0.8em] w-[60%] rounded-full", ACCENT)} />
    </span>
  ),
};
/** Cards and tables — a testimonial, a summary, a tab set — are an outlined panel. */
const MINI_PANEL: Sketch = { h: 1.7, node: <span className={cn("block h-[1.7em] w-full rounded-[0.35em]", LINE)} /> };

const MINI: Record<string, Sketch> = {
  heading: { h: 0.5, node: <span className={cn("block h-[0.5em] w-[82%] shrink-0 rounded-full", STRONG)} /> },
  text: MINI_TEXT,
  rich_text: MINI_TEXT,
  button: { h: 0.9, node: <span className={cn("block h-[0.9em] w-[2.6em] max-w-full shrink-0 rounded-full", ACCENT)} /> },
  text_link: { h: 0.26, node: <span className={cn("block h-[0.26em] w-[50%] shrink-0 rounded-full", ACCENT)} /> },
  icon: {
    h: 1.1,
    node: (
      <span className={cn("flex size-[1.1em] shrink-0 items-center justify-center rounded-full", ACCENT_SOFT)}>
        <span className={cn("block size-[0.4em] rounded-full", ACCENT)} />
      </span>
    ),
  },
  image: MINI_PICTURE,
  gallery: MINI_PICTURE,
  carousel: MINI_PICTURE,
  embed: MINI_PICTURE,
  map: MINI_PICTURE,
  scroll_story: MINI_PICTURE,
  shoppable_image: MINI_PICTURE,
  shader_hero: MINI_PICTURE,
  product_3d: MINI_PICTURE,
  hero_slider: MINI_PICTURE,
  image_banner: MINI_PICTURE,
  image_gallery: MINI_PICTURE,
  masonry_grid: MINI_PICTURE,
  video: {
    h: 2.7,
    node: (
      <span className={cn("flex h-[2.7em] w-full items-center justify-center rounded-[0.4em]", TILE)}>
        <IconPlay className={cn("size-[0.9em]", GLYPH)} aria-hidden />
      </span>
    ),
  },
  video_reels: MINI_PICTURE,
  list: {
    h: 0.9,
    node: (
      <span className="flex w-full flex-col gap-[0.26em]">
        {range(2).map((i) => (
          <span key={i} className="flex items-center gap-[0.25em]">
            <span className={cn("block size-[0.28em] shrink-0 rounded-full", ACCENT)} />
            <span className={cn("block h-[0.28em] flex-1 rounded-full", SOFT)} />
          </span>
        ))}
      </span>
    ),
  },
  countdown: {
    h: 1,
    node: (
      <span className="flex gap-[0.2em]">
        {range(3).map((i) => (
          <span key={i} className={cn("block h-[1em] w-[0.9em] rounded-[0.2em]", ACCENT_SOFT)} />
        ))}
      </span>
    ),
  },
  marquee: { h: 0.6, node: <span className={cn("block h-[0.6em] w-full rounded-full", ACCENT_SOFT)} /> },
  social_icons: {
    h: 0.6,
    node: (
      <span className="flex gap-[0.25em]">
        {range(3).map((i) => (
          <span key={i} className={cn("block size-[0.6em] rounded-full", FAINT)} />
        ))}
      </span>
    ),
  },
  divider: { h: 0.1, node: <span className={cn("block h-[0.1em] w-full rounded-full", FAINT)} /> },
  spacer: { h: 0.4, node: <span className="block h-[0.4em]" /> },
  stars_display: { h: 0.5, node: STARS },
  price: { h: 0.6, node: <span className={cn("block h-[0.6em] w-[45%] shrink-0 rounded-[0.16em]", STRONG)} /> },
  product_card: MINI_PRODUCT,
  product_list: MINI_PRODUCT,
  collection_list: MINI_PRODUCT,
  orbit_gallery: MINI_PRODUCT,
  category_tiles: MINI_PRODUCT,
  bundle_cards: MINI_PRODUCT,
  product_cards: MINI_PRODUCT,
  product_rail: MINI_PRODUCT,
  product_shelf: MINI_PRODUCT,
  accordion: MINI_ROWS,
  faq: MINI_ROWS,
  toggle: MINI_ROWS,
  bundle_selector: MINI_ROWS,
  form: MINI_FORM,
  cod_form: MINI_FORM,
  review_form: MINI_FORM,
  upsell_accept_button: { h: 0.9, node: <span className={cn("block h-[0.9em] w-[80%] shrink-0 rounded-full", ACCENT)} /> },
  upsell_decline_link: { h: 0.26, node: <span className={cn("block h-[0.26em] w-[40%] shrink-0 rounded-full", FAINT)} /> },
};

/** A picture in a column too narrow for a glyph is a bare tile. */
function miniOf(type: string, narrow: boolean): Sketch {
  const sketch = MINI[type] ?? MINI_PANEL;
  return narrow && sketch === MINI_PICTURE ? MINI_PICTURE_BARE : sketch;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/** Tailwind can't build a class from a runtime number, so map the twelve spans. */
const SPAN_CLASS: Record<number, string> = {
  1: "col-span-1",
  2: "col-span-2",
  3: "col-span-3",
  4: "col-span-4",
  5: "col-span-5",
  6: "col-span-6",
  7: "col-span-7",
  8: "col-span-8",
  9: "col-span-9",
  10: "col-span-10",
  11: "col-span-11",
  12: "col-span-12",
};

/** The frame is 16 × 10 em; this much of its height is left for the drawing. */
const ROOM = 8.2;
const STACK_GAP = 0.5;
const COLUMN_GAP = 0.32;
/** How many elements of one column are drawn. */
const COLUMN_MAX = 4;
/** Never shrink a drawing below this: past it the bars are hairlines. */
const SMALLEST = 0.42;

function columnHeight(column: PresetRow["columns"][number]): number {
  const shown = column.elements.slice(0, COLUMN_MAX);
  const narrow = column.span < 3;
  const inner = shown.reduce((sum, type) => sum + miniOf(type, narrow).h, 0) + COLUMN_GAP * Math.max(0, shown.length - 1);
  return column.settings?.surface === "card" ? inner + 0.7 : inner;
}

/** One column's sketches; a card surface gets the outline it has on the store. */
function ColumnSketch({ column }: { column: PresetRow["columns"][number] }) {
  const card = column.settings?.surface === "card";
  const centred = column.settings?.align === "center";
  const narrow = column.span < 3;
  return (
    <span
      className={cn(
        "flex min-w-0 flex-col justify-center gap-[0.32em]",
        SPAN_CLASS[column.span] ?? "col-span-12",
        centred && "items-center",
        card && "rounded-[0.4em] border border-[color:var(--tb-line)] p-[0.35em]"
      )}
    >
      {column.elements.slice(0, COLUMN_MAX).map((type, i) => (
        <span key={`${type}-${i}`} className={cn("flex w-full", centred && "justify-center")}>
          {miniOf(type, narrow).node}
        </span>
      ))}
    </span>
  );
}

interface ThumbProps {
  elements: readonly PageElementType[];
  rows?: readonly PresetRow[];
  settings?: Record<string, unknown>;
  content?: ReadonlyArray<Record<string, unknown> | undefined>;
  className?: string;
}

const Thumb = memo(function Thumb({ elements, rows, settings, content, className }: ThumbProps) {
  // One row of one column is a plain stack: draw it with the full sketches.
  const grid = rows !== undefined && (rows.length > 1 || (rows[0]?.columns.length ?? 0) > 1) ? rows : null;
  // A full-width band holding one element (the showcase sections) runs to the frame's edges.
  const bleed = !grid && settings?.width === "full" && elements.length === 1;

  const total = grid
    ? grid.reduce((sum, row) => sum + Math.max(0, ...row.columns.map(columnHeight)), 0) + STACK_GAP * Math.max(0, grid.length - 1)
    : elements.reduce((sum, type, i) => sum + sketchOf(type, content?.[i]).h, 0) + STACK_GAP * Math.max(0, elements.length - 1);
  const fit = bleed || total <= ROOM ? 1 : Math.max(SMALLEST, ROOM / total);

  return (
    <span aria-hidden className="@container block w-full">
      <span
        data-slot="block-thumb"
        className={cn(
          "zimos-block-thumb block aspect-[16/10] w-full overflow-hidden rounded-[0.75rem] text-[10px] ring-1 ring-line ring-inset supports-[font-size:1cqw]:text-[length:6.25cqw]",
          className
        )}
        style={groundOf(settings)}
      >
        <span
          className={cn("flex h-full w-full flex-col justify-center", !bleed && "gap-[0.5em] px-[1.1em] py-[0.9em]")}
          style={fit < 1 ? { fontSize: `${fit}em` } : undefined}
        >
          {grid
            ? grid.map((row, r) => (
                <span key={r} className="grid shrink-0 grid-cols-12 gap-[0.5em]">
                  {row.columns.map((column, c) => (
                    <ColumnSketch key={c} column={column} />
                  ))}
                </span>
              ))
            : elements.map((type, i) => (
                <span key={`${type}-${i}`} className={cn("flex w-full flex-col", bleed ? "min-h-0 flex-1" : "shrink-0")}>
                  {sketchOf(type, content?.[i]).node}
                </span>
              ))}
        </span>
      </span>
    </span>
  );
});

/**
 * Memoised: the library draws one of these per preset, and every keystroke
 * in the editor would otherwise redraw all of them. Their props come straight
 * off BLOCK_PRESETS, so they are the same objects every render.
 */
export const BlockThumbnail = memo(function BlockThumbnail({
  elements,
  rows,
  settings,
  content,
  className,
}: {
  elements: PageElementType[];
  /**
   * The column layout, when the preset has one. The library hands this
   * component the preset's own `elements` array, so when the layout isn't
   * passed it is looked up from that same array — by identity, not by
   * contents, since two presets may share a flattened shape.
   */
  rows?: PresetRow[];
  settings?: Record<string, unknown>;
  /**
   * Starting props, aligned index-for-index with `elements` — only read for
   * the one element whose sketch actually branches on its props (`gallery`'s
   * grid vs. slideshow layout). Looked up from the matching preset the same
   * way `rows`/`settings` are when not passed directly.
   */
  content?: Array<Record<string, unknown> | undefined>;
  className?: string;
}) {
  const preset = rows === undefined ? BLOCK_PRESETS.find((p) => p.elements === elements) : undefined;
  return (
    <Thumb
      elements={elements}
      rows={rows ?? preset?.rows}
      settings={settings ?? preset?.settings}
      content={content ?? preset?.content}
      className={className}
    />
  );
});

/** The thumbnail of a library preset, read straight off it. */
export function PresetThumbnail({ preset, className }: { preset: BlockPreset; className?: string }) {
  return <Thumb elements={preset.elements} rows={preset.rows} settings={preset.settings} content={preset.content} className={className} />;
}

/**
 * The thumbnail of a section as it is on a page (or in the saved library):
 * the same drawing, read from the section's own rows, columns and elements.
 */
export function SectionThumbnail({ section, className }: { section: PageSection; className?: string }) {
  const shape = useMemo(() => {
    const rows: PresetRow[] = (section.rows ?? []).map((row) => ({
      columns: (row.columns ?? []).map((column) => ({
        span: column.span ?? 12,
        elements: (column.elements ?? []).map((element) => element.type),
        settings: (column as ColumnWithSettings).settings,
      })),
    }));
    const flat = (section.rows ?? []).flatMap((row) => (row.columns ?? []).flatMap((column) => column.elements ?? []));
    return {
      rows,
      elements: flat.map((element) => element.type),
      content: flat.map((element) => element.props),
    };
  }, [section]);

  return (
    <Thumb
      elements={shape.elements}
      rows={shape.rows}
      settings={section.settings}
      content={shape.content}
      className={className}
    />
  );
}
