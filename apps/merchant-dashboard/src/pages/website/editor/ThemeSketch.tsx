import type { CSSProperties, ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { labelOn, mixHex } from "@/lib/contrast";
import type { RadiusKey } from "./storeLook";
import { ORIGINAL_LOOK, THEME_SPECS, type ColorMode, type ThemeChoice } from "./storeThemes";

/**
 * The original look's corners are the merchant's (storeLook.ts `RadiusKey`),
 * not the spec's: drawn small, in the sketch's own `em`.
 */
const ORIGINAL_CORNERS: Record<RadiusKey, { buttonRadius: string; cardRadius: string; imageRadius: string }> = {
  sharp: { buttonRadius: "0.08em", cardRadius: "0.1em", imageRadius: "0.1em" },
  soft: { buttonRadius: "0.3em", cardRadius: "0.45em", imageRadius: "0.45em" },
  round: { buttonRadius: "0.75em", cardRadius: "0.95em", imageRadius: "0.95em" },
};

/**
 * A theme's thumbnail: a small storefront — header, hero, three product cards —
 * drawn with the theme's own palette (in either mode), corners, card style and
 * hero layout, and the store's name set in the theme's heading face. What
 * tells the themes apart at a glance is their shape and type, not only their
 * colour, so all of it is here.
 *
 * Every size is in `em` off a root sized in container units, so one drawing
 * fills a narrow radio card in the Store look panel or a wide gallery card
 * alike. Decorative: the card around it names the theme.
 *
 * `corners`, `secondary` and `headingFont` draw what the merchant (or a ready
 * style) chose on top of the spec — the first two on the original look only,
 * where they are the merchant's; a theme owns its own. All three are optional:
 * without them the drawing is the theme as it comes.
 */
export function ThemeSketch({
  theme,
  mode,
  accent,
  title,
  className,
  corners,
  secondary,
  headingFont,
}: {
  theme: ThemeChoice;
  mode: ColorMode;
  /** The merchant's accent for this mode; the theme's own default when unset. */
  accent?: string | null;
  /** The specimen: the store's name, set in the theme's heading face. */
  title: string;
  className?: string;
  /** Original look only: the corners chosen there, over the spec's own. */
  corners?: RadiusKey;
  /** Original look only: the second colour chosen there, drawn as the small tag on a product card. */
  secondary?: string | null;
  /** A `font-family` for the specimen, over the theme's heading face. */
  headingFont?: string;
}) {
  const spec = THEME_SPECS[theme];
  const p = spec.palette[mode];
  const a = accent ?? p.accent;
  const original = theme === ORIGINAL_LOOK;
  const s = original && corners ? { ...spec.sketch, ...ORIGINAL_CORNERS[corners] } : spec.sketch;
  const dark = mode === "dark";
  const second = (original ? secondary : null) ?? p.secondary;

  const bar = (width: string, color = p.inkSoft, extra: CSSProperties = {}): ReactNode => (
    <span
      aria-hidden
      style={{ display: "block", width, height: "0.42em", borderRadius: "999px", background: color, opacity: 0.55, ...extra }}
    />
  );

  const glass = s.card === "glass";
  const pane: CSSProperties = glass
    ? {
        background: `color-mix(in srgb, ${mixHex(p.raised, a, spec.glass?.[mode].tint ?? 0.08)} ${Math.round(
          (spec.glass?.[mode].alpha ?? 0.58) * 100
        )}%, transparent)`,
        border: `1px solid ${dark ? "rgb(255 255 255 / 0.14)" : "rgb(255 255 255 / 0.7)"}`,
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }
    : {};

  const cardStyle: CSSProperties = {
    background: p.raised,
    borderRadius: s.cardRadius,
    border: `1px solid ${p.line}`,
    ...(s.card === "hard" ? { border: `0.14em solid ${p.ink}`, boxShadow: `0.28em 0.28em 0 ${p.ink}` } : {}),
    ...(s.card === "shadow" ? { boxShadow: `0 0.1em 0.3em rgb(0 0 0 / ${dark ? 0.4 : 0.1}), 0 0.6em 1.2em -0.6em rgb(0 0 0 / ${dark ? 0.5 : 0.18})` } : {}),
    ...(s.card === "cushion" ? { border: "1px solid transparent", boxShadow: `0 0.8em 1.6em -0.8em ${dark ? "rgb(0 0 0 / 0.6)" : "rgb(120 66 30 / 0.3)"}` } : {}),
    ...(s.card === "hairline" ? { boxShadow: "0 1px 1px rgb(0 0 0 / 0.03)" } : {}),
    ...pane,
  };

  const button = (fill = a, text = labelOn(a), extra: CSSProperties = {}): ReactNode => (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: s.hero === "poster" ? "1.9em" : "1.65em",
        minWidth: s.upper ? "6.2em" : "5.2em",
        padding: "0 0.8em",
        borderRadius: s.buttonRadius,
        background: fill,
        ...(s.card === "hard" ? { boxShadow: `0.18em 0.18em 0 ${p.ink}` } : {}),
        ...(glass ? { boxShadow: `0 0.5em 1em -0.4em color-mix(in srgb, ${fill} 70%, transparent)` } : {}),
        ...extra,
      }}
    >
      {bar(s.upper ? "3.6em" : "3em", text, { opacity: 0.9, height: s.upper ? "0.32em" : "0.38em" })}
    </span>
  );

  const heading = (color: string, size: string, align: "center" | "start"): ReactNode => (
    <span
      className="block max-w-full truncate"
      style={{
        fontFamily: headingFont ?? spec.fonts.display,
        fontWeight: s.hero === "poster" ? 900 : headingFont ? 700 : spec.fonts.displayWeight,
        fontSize: size,
        lineHeight: 1.15,
        letterSpacing: s.hero === "poster" ? "-0.03em" : s.hero === "quiet" ? "-0.02em" : undefined,
        color,
        textAlign: align,
      }}
    >
      {title}
    </span>
  );

  const hero = (): ReactNode => {
    switch (s.hero) {
      case "rule":
        return (
          <div className="flex flex-1 flex-col items-center justify-center gap-[0.55em] px-[2em] py-[0.8em]">
            <span aria-hidden style={{ width: "1.8em", height: "1px", background: a }} />
            {heading(p.ink, "2em", "center")}
            {bar("11em")}
            {button()}
          </div>
        );
      case "poster":
        return (
          <div className="flex flex-1 flex-col items-start justify-center gap-[0.55em] px-[1.4em] py-[0.8em]" style={{ background: a }}>
            {heading(labelOn(a), "2.5em", "start")}
            <span aria-hidden style={{ width: "2.8em", height: "0.32em", background: labelOn(a) }} />
            {button(labelOn(a), a, { boxShadow: `0.18em 0.18em 0 ${dark ? "#000" : "#0B0B0C"}` })}
          </div>
        );
      case "quiet":
        return (
          <div className="flex flex-1 flex-col items-start justify-center gap-[0.6em] px-[1.6em] py-[0.8em]">
            {heading(p.ink, "1.9em", "start")}
            {bar("10em")}
            {button()}
          </div>
        );
      case "band":
        return (
          <div
            className="flex flex-1 flex-col items-center justify-center gap-[0.5em] px-[1.6em] py-[0.8em]"
            style={{ background: p.raised, borderBlock: `1px solid ${p.line}` }}
          >
            {heading(p.ink, "1.8em", "center")}
            <span aria-hidden style={{ width: "2.2em", height: "0.18em", borderRadius: "999px", background: second }} />
            {button()}
          </div>
        );
      case "glow":
        return (
          <div
            className="flex flex-1 items-center justify-center gap-[1.2em] px-[1.6em] py-[0.8em]"
            style={{
              backgroundImage: `radial-gradient(80% 90% at 50% 0%, color-mix(in oklab, ${a} 18%, transparent), transparent 70%)`,
            }}
          >
            <div className="flex min-w-0 flex-col items-center gap-[0.5em]">
              {heading(p.ink, "1.8em", "center")}
              {bar("8em")}
              {button()}
            </div>
            <span
              aria-hidden
              className="shrink-0"
              style={{ width: "4.4em", height: "5.2em", borderRadius: s.imageRadius, background: mixHex(p.line, a, 0.25) }}
            />
          </div>
        );
      case "panel":
        return (
          <div className="flex flex-1 flex-col justify-center px-[1.8em] py-[0.7em]">
            <div className="flex flex-col items-center gap-[0.5em] px-[1em] py-[1em]" style={{ ...pane, borderRadius: "0.9em" }}>
              {heading(p.ink, "1.8em", "center")}
              {bar("8em")}
              {button(a, labelOn(a), { backgroundImage: `linear-gradient(135deg, color-mix(in oklab, ${a} 88%, white), ${a})` })}
            </div>
          </div>
        );
      default:
        return (
          <div className="flex flex-1 items-center gap-[1.2em] px-[1.4em] py-[0.8em]">
            <div className="flex min-w-0 flex-1 flex-col items-start gap-[0.5em]">
              {heading(p.ink, "1.8em", "start")}
              {bar("7.5em")}
              {button()}
            </div>
            <span
              aria-hidden
              className="shrink-0"
              style={{ width: "6em", height: "4.5em", borderRadius: s.imageRadius, background: mixHex(p.line, a, 0.2) }}
            />
          </div>
        );
    }
  };

  const headerStyle: CSSProperties = {
    background: glass ? undefined : s.hero === "rule" || s.hero === "quiet" || s.hero === "glow" ? p.paper : p.raised,
    borderBottom: s.card === "hard" ? `0.16em solid ${p.ink}` : s.hero === "glow" ? "none" : `1px solid ${p.line}`,
    ...(glass ? pane : {}),
  };

  return (
    <div
      aria-hidden
      className={cn("relative w-full select-none overflow-hidden [container-type:inline-size]", className)}
      style={{ aspectRatio: "16 / 10", background: p.paper, color: p.ink }}
    >
      {glass && (
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(60% 55% at 10% 0%, color-mix(in oklab, ${a} ${dark ? 34 : 26}%, transparent), transparent 70%), radial-gradient(50% 50% at 95% 20%, color-mix(in oklab, ${p.secondary} ${dark ? 30 : 24}%, transparent), transparent 70%)`,
          }}
        />
      )}
      <div className="relative flex h-full flex-col" style={{ fontSize: "3.6cqw" }}>
        {/* Header: logo mark, name, links. */}
        <div className="flex items-center gap-[0.5em] px-[1.2em] py-[0.55em]" style={headerStyle}>
          <span aria-hidden style={{ width: "0.9em", height: "0.9em", borderRadius: s.buttonRadius === "0" ? 0 : "0.25em", background: a }} />
          {bar("3.8em", p.ink, { opacity: 0.7 })}
          <span className="ms-auto flex gap-[0.4em]">
            {bar("1.6em")}
            {bar("1.6em")}
            {bar("1.6em")}
          </span>
        </div>
        {s.card === "hard" && <span aria-hidden className="block h-[0.3em]" style={{ background: `linear-gradient(to right, ${a}, ${p.secondary})` }} />}

        {hero()}

        {/* Three product cards. */}
        <div
          className="mt-auto grid grid-cols-3 gap-[0.7em] px-[1.2em] pb-[1em]"
          style={{ borderTop: s.card === "hard" ? `0.16em solid ${p.ink}` : undefined, paddingTop: s.card === "hard" ? "0.7em" : undefined }}
        >
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col overflow-hidden" style={cardStyle}>
              <span
                aria-hidden
                style={{ display: "block", position: "relative", height: "2.3em", background: mixHex(p.line, a, i === 1 ? 0.18 : 0.06) }}
              >
                {original && i === 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: "0.3em",
                      insetInlineStart: "0.3em",
                      width: "1.5em",
                      height: "0.55em",
                      borderRadius: s.buttonRadius,
                      background: second,
                    }}
                  />
                )}
              </span>
              <span className="flex flex-col gap-[0.3em] p-[0.45em]">
                {bar("80%", p.ink, { opacity: 0.6, height: "0.34em" })}
                {bar("45%", a, { opacity: 0.9, height: "0.34em" })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
