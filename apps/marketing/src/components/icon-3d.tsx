/* eslint-disable @next/next/no-img-element -- small, already sized and compressed pictures. */

/**
 * The site's illustrated icons: Microsoft's Fluent Emoji in their 3D style
 * (MIT, github.com/microsoft/fluentui-emoji, commit 1ffb34c), copied as they
 * are into public/icons/3d at 160px (twice the largest the site draws them),
 * as WebP. They stand for a thing — a parcel, a receipt, a truck — beside
 * words that say the same, so they are decoration (alt="").
 *
 * The interface's own glyphs (arrows, ticks, the theme and language
 * switches) stay the line icons of duo-icons.tsx and color-icon.tsx. Add an
 * icon by converting the package's own picture, never by drawing one.
 */
export type Icon3DName =
  | "bags"
  | "bank"
  | "bell"
  | "card"
  | "cart"
  | "chart"
  | "check"
  | "crown"
  | "gear"
  | "gem"
  | "gift"
  | "laptop"
  | "lock"
  | "mail"
  | "megaphone"
  | "memo"
  | "money"
  | "package"
  | "palette"
  | "phone"
  | "receipt"
  | "rocket"
  | "shield"
  | "store"
  | "team"
  | "ticket"
  | "tools"
  | "truck";

export function Icon3D({ name, size = 48, className }: { name: Icon3DName; size?: number; className?: string }) {
  return (
    <img
      src={`/icons/3d/${name}.webp`}
      width={size}
      height={size}
      alt=""
      aria-hidden
      loading="lazy"
      decoding="async"
      draggable={false}
      className={className ? `i3d ${className}` : "i3d"}
    />
  );
}
