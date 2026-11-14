import type { CSSProperties } from "react";

/**
 * The site's content icons: Phosphor's icons (MIT, @phosphor-icons/core
 * 2.1.1), copied as they are into public/icons — the regular weight — and
 * public/icons/fill — the fill weight, for a glyph on a coloured tile. Drawn
 * as a CSS mask filled with the logo's blue gradient (`.ci` in landing.css),
 * so a tile or a theme can recolour them with two custom properties; `ink`
 * fills them with the text colour instead. Decorative: the words beside them
 * carry the meaning. Add an icon by copying its two files from the package,
 * never by drawing one.
 */
export type ColorIconName =
  | "apps"
  | "bell"
  | "brush"
  | "call"
  | "card"
  | "cart"
  | "chat"
  | "check"
  | "code"
  | "coins"
  | "crown"
  | "cursor"
  | "delivery"
  | "edit"
  | "gift"
  | "globe"
  | "growth"
  | "laptop"
  | "link"
  | "lock"
  | "mail"
  | "megaphone"
  | "moon"
  | "package"
  | "phone"
  | "profit"
  | "receipt"
  | "recover"
  | "rocket"
  | "send"
  | "shield"
  | "stack"
  | "store"
  | "sun"
  | "sync"
  | "tag"
  | "team"
  | "ticket"
  | "tracking"
  | "translate"
  | "truck"
  | "vault"
  | "verified"
  | "wallet";

export function ColorIcon({
  name,
  size = 28,
  fill = false,
  ink = false,
  className,
}: {
  name: ColorIconName;
  size?: number;
  /** The fill weight: a solid glyph, for a coloured tile. */
  fill?: boolean;
  /** Filled with the text colour around it, not the gradient. */
  ink?: boolean;
  className?: string;
}) {
  const style = { "--ci": `url(/icons/${fill ? "fill/" : ""}${name}.svg)`, inlineSize: size, blockSize: size } as CSSProperties;
  const classes = ["ci", ink && "ci--ink", className].filter(Boolean).join(" ");
  return <span aria-hidden className={classes} style={style} />;
}
