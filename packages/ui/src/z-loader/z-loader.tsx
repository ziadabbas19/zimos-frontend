import type { AriaAttributes, ReactNode } from "react"

export type ZLoaderSize = "sm" | "md" | "lg"

export interface ZLoaderProps {
  /** sm: inside a button or a line (16px, the icon it replaces); md: a section (32px); lg: the whole page, over a light dark veil. */
  size?: ZLoaderSize
  /** The neon's colour, any CSS colour. Default: the text colour for sm (it sits on buttons of any colour), the brand's `--color-primary` otherwise. */
  color?: string
  /** Announced once to screen readers, in the page's language. */
  label?: string
  className?: string
  /** Decorative (the control around it already says what is happening): no role, no label. */
  "aria-hidden"?: AriaAttributes["aria-hidden"]
}

/**
 * The Z of the ZIMOS mark as one closed outline: the top bar, the diagonal and
 * the bottom bar, the bars' ends slanted like the diagonal. One path, so the
 * neon runs round the whole letter without a break.
 */
const Z_PATH = "M20.3 4H81.6L34.3 47H81.6L67.3 60H4L51.3 17H6Z"
const VIEW_BOX = "0 0 86 64"

const PIXELS: Record<ZLoaderSize, number> = { sm: 16, md: 32, lg: 56 }
/** Stroke in viewBox units, about 1px, 1.6px and 2px at each size's own width. */
const STROKE: Record<ZLoaderSize, number> = { sm: 5.5, md: 4.4, lg: 3.1 }

/**
 * Plain CSS, not Tailwind classes: the storefront does not scan this package.
 * Unlayered rules beat Tailwind's layers, so nothing here sets a size or a
 * display; a caller's `size-*` class still wins over the width/height
 * attributes. React hoists the <style> into <head> once, whatever the number
 * of loaders on the page, on the server and in the browser alike.
 */
const CSS = `
.zimos-zl{flex-shrink:0;overflow:visible;--zl-g1:1.5px;--zl-g2:5px;filter:drop-shadow(0 0 var(--zl-g1) var(--zl-c)) drop-shadow(0 0 var(--zl-g2) var(--zl-c))}
.zimos-zl[data-size="sm"]{--zl-g1:.75px;--zl-g2:2.5px}
.zimos-zl[data-size="lg"]{--zl-g1:2px;--zl-g2:8px}
.zimos-zl-base{opacity:.32}
.zimos-zl-trace{stroke-dasharray:26 74;animation:zimos-zl-trace 1.4s linear infinite}
@keyframes zimos-zl-trace{to{stroke-dashoffset:-100}}
.zimos-zl-page{position:fixed;inset:0;z-index:60;display:grid;place-items:center;background:rgb(3 7 18 / .38)}
.zimos-zl-hold{display:inline-grid;place-items:center}
.zimos-zl-hold>*{grid-area:1/1}
.zimos-zl-hold-words{visibility:hidden}
@media (prefers-reduced-motion:reduce){.zimos-zl-trace{animation:none;stroke-dasharray:none}}
`

/**
 * The one loader everywhere: the Z outlined, a neon light running round its
 * edge (a dash moved along the outline, glowing). Under prefers-reduced-motion
 * the whole outline glows and nothing moves. No hooks, so it renders in a
 * server component as well (a Suspense fallback).
 */
export function ZLoader({ size = "md", color, label = "Loading", className, "aria-hidden": ariaHidden }: ZLoaderProps) {
  const hidden = ariaHidden === true || ariaHidden === "true"
  const neon = color ?? (size === "sm" ? "currentColor" : "var(--color-primary, #0080e0)")
  const px = PIXELS[size]
  const glyph = (
    <svg
      data-slot="z-loader"
      data-size={size}
      className={size === "lg" ? "zimos-zl" : ["zimos-zl", className].filter(Boolean).join(" ")}
      style={{ "--zl-c": neon } as React.CSSProperties}
      width={px}
      height={px}
      viewBox={VIEW_BOX}
      fill="none"
      stroke="var(--zl-c)"
      strokeWidth={STROKE[size]}
      strokeLinejoin="round"
      focusable="false"
      {...(size !== "lg" && !hidden ? { role: "status", "aria-label": label } : { "aria-hidden": true })}
    >
      <path className="zimos-zl-base" d={Z_PATH} />
      <path className="zimos-zl-trace" d={Z_PATH} pathLength={100} />
    </svg>
  )
  return (
    <>
      <style href="zimos-z-loader" precedence="zimos-z-loader">
        {CSS}
      </style>
      {size === "lg" ? (
        <div
          data-slot="z-loader-page"
          className={["zimos-zl-page", className].filter(Boolean).join(" ")}
          {...(hidden ? { "aria-hidden": true } : { role: "status", "aria-label": label })}
        >
          {glyph}
        </div>
      ) : (
        glyph
      )}
    </>
  )
}

export interface ZLoaderHoldProps {
  /** The button's own words: kept in place, hidden, so the button keeps its size. */
  children: ReactNode
  /** What is happening, announced once ("Deleting…", "Loading…"). */
  label?: string
  className?: string
}

/** Inside a button while its call is out: the Z (sm) sits on the button's own words, which keep their room. */
export function ZLoaderHold({ children, label, className }: ZLoaderHoldProps) {
  return (
    <span data-slot="z-loader-hold" className={["zimos-zl-hold", className].filter(Boolean).join(" ")}>
      <span className="zimos-zl-hold-words" aria-hidden="true">
        {children}
      </span>
      <ZLoader size="sm" label={label} />
    </span>
  )
}
