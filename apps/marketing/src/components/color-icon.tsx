import type { CSSProperties } from "react";

/**
 * The landing's content icons: Phosphor's line icons (MIT,
 * @phosphor-icons/core, regular weight), kept as files in public/icons and
 * drawn as a CSS mask filled with the logo's blue gradient (`.ci` in
 * landing.css), so a tile or a theme can recolour them with two custom
 * properties. Decorative: the words beside them carry the meaning.
 */
export type ColorIconName =
  | "apps"
  | "bell"
  | "brush"
  | "card"
  | "chat"
  | "check"
  | "code"
  | "delivery"
  | "edit"
  | "gift"
  | "globe"
  | "growth"
  | "link"
  | "lock"
  | "megaphone"
  | "package"
  | "phone"
  | "profit"
  | "receipt"
  | "send"
  | "shield"
  | "store"
  | "sync"
  | "team"
  | "tracking"
  | "vault"
  | "verified";

export function ColorIcon({ name, size = 28, className }: { name: ColorIconName; size?: number; className?: string }) {
  const style = { "--ci": `url(/icons/${name}.svg)`, inlineSize: size, blockSize: size } as CSSProperties;
  return <span aria-hidden className={className ? `ci ${className}` : "ci"} style={style} />;
}
