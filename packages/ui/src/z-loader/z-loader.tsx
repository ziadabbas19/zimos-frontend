import { useId, type AriaAttributes, type ReactNode } from "react"

export type ZLoaderSize = "sm" | "md" | "lg"

export interface ZLoaderProps {
  /** sm: inside a button or a line (16px, the icon it replaces); md: a section (32px); lg: the whole page, over a light dark veil. */
  size?: ZLoaderSize
  /** The neon's colour, any CSS colour; the trail runs from a light tint of it to it. Default: the text colour for sm (it sits on buttons of any colour), the mark's own cyan-to-blue otherwise. */
  color?: string
  /** Announced once to screen readers, in the page's language. */
  label?: string
  className?: string
  /** Decorative (the control around it already says what is happening): no role, no label. */
  "aria-hidden"?: AriaAttributes["aria-hidden"]
}

/**
 * The three strips of the ZIMOS mark (zimos-mark.png, 512px), each one closed
 * outline traced from the PNG: four edges and the corners rounded as drawn,
 * the sharp ends with the big radii. Each path starts where the light enters
 * that strip and runs clockwise. `grad` is the strip's own light-to-deep
 * direction in the mark (x1 y1 x2 y2 over the strip's box).
 */
const STRIPS = [
  {
    d: "M338.1 191L32.1 191A21 21 0 0 1 19.9 152.9L170.7 45.2A12 12 0 0 1 177.6 43L480.4 43A30 30 0 0 1 498.5 96.9L376.9 189.4A8 8 0 0 1 372 191Z",
    grad: [0, 0, 1, 0],
  },
  {
    d: "M337.5 191L361.3 191A5 5 0 0 1 364.3 200L119.2 383.9A8 8 0 0 1 114.4 385.5L29.1 385.5A30 30 0 0 1 11.2 331.5L196.7 193A10 10 0 0 1 202.7 191Z",
    grad: [0, 1, 1, 0],
  },
  {
    d: "M207.9 334.5L470.7 334.5A25.5 25.5 0 0 1 485.1 381L361.8 465.6A8 8 0 0 1 357.3 467L66.5 467A22.4 22.4 0 0 1 53.9 426.1L186.7 335.9A8 8 0 0 1 191.2 334.5Z",
    grad: [1, 0, 0, 0],
  },
] as const
const VIEW_BOX = "-20 23 552 464"

const PIXELS: Record<ZLoaderSize, number> = { sm: 16, md: 32, lg: 56 }
/** The trail's width at the head, in viewBox units: about 1px, 1.6px and 2.1px at each size's own width. */
const STROKE: Record<ZLoaderSize, number> = { sm: 34, md: 27, lg: 20 }
/** The trail's length, in hundredths of a strip's outline, and the dashes it is drawn with. */
const TRAIL: Record<ZLoaderSize, { length: number; dashes: number }> = {
  sm: { length: 18, dashes: 6 },
  md: { length: 28, dashes: 7 },
  lg: { length: 38, dashes: 8 },
}

/**
 * One cycle: the head once round each strip in turn. Every dash moves the same
 * way (the one keyframe below), and its place on the comet is a phase of that
 * cycle: a negative delay, so nothing waits at the start. A strip's outline is
 * 100 units long and the dash pattern repeats every 300, so a comet is on a
 * strip for a third of the cycle and its tail leaves while the next head runs.
 */
const CYCLE_S = 2.4
const PERIOD = 300
const HEAD_DASH = 0.6

function delay(strip: number, behindHead: number): string {
  return `${(((100 * strip + behindHead) / PERIOD) * CYCLE_S - CYCLE_S).toFixed(3)}s`
}

/**
 * Plain CSS, not Tailwind classes: the storefront does not scan this package.
 * Unlayered rules beat Tailwind's layers, so nothing here sets a size or a
 * display on the svg; a caller's `size-*` class still wins over the
 * width/height attributes. React hoists the <style> into <head> once,
 * whatever the number of loaders on the page, on the server and in the
 * browser alike.
 */
const CSS = `
.zimos-zl{flex-shrink:0;overflow:visible;--zl-a:#62e4ff;--zl-b:#2160ff;--zl-glow:#2aa8ff;--zl-g1:1.5px;--zl-g2:5px;filter:drop-shadow(0 0 var(--zl-g1) var(--zl-glow)) drop-shadow(0 0 var(--zl-g2) var(--zl-glow))}
.zimos-zl[data-tone="own"]{--zl-a:var(--zl-c);--zl-b:var(--zl-c);--zl-glow:var(--zl-c)}
@supports (color:color-mix(in oklab,red,white)){.zimos-zl[data-tone="own"]{--zl-a:color-mix(in oklab,var(--zl-c) 55%,#fff)}}
.zimos-zl[data-size="sm"]{--zl-g1:.75px;--zl-g2:2.5px}
.zimos-zl[data-size="lg"]{--zl-g1:2px;--zl-g2:8px}
.zimos-zl-base{opacity:.25}
.zimos-zl-run{animation:zimos-zl-run ${CYCLE_S}s linear infinite}
@keyframes zimos-zl-run{to{stroke-dashoffset:-${PERIOD}}}
.zimos-zl-page{position:fixed;inset:0;z-index:60;display:grid;place-items:center;background:rgb(3 7 18 / .38)}
.zimos-zl-hold{display:inline-grid;place-items:center}
.zimos-zl-hold>*{grid-area:1/1}
.zimos-zl-hold-words{visibility:hidden}
@media (prefers-reduced-motion:reduce){.zimos-zl-run{display:none}.zimos-zl-base{opacity:1}}
`

/**
 * The one loader everywhere: the mark's three strips outlined faintly, and a
 * comet running round them one after another: a white-cyan head with a strong
 * glow, then a trail in the strip's gradient that thins and fades to nothing
 * (a few dashes, each a little fainter and thinner, all moving together).
 * Under prefers-reduced-motion the whole outline glows and nothing moves.
 */
export function ZLoader({ size = "md", color, label = "Loading", className, "aria-hidden": ariaHidden }: ZLoaderProps) {
  // Unique per loader: the gradients take their colours from this svg.
  const uid = "zl" + useId().replace(/[^a-zA-Z0-9_-]/g, "")
  const hidden = ariaHidden === true || ariaHidden === "true"
  const own = color ?? (size === "sm" ? "currentColor" : undefined)
  const px = PIXELS[size]
  const width = STROKE[size]
  const { length, dashes } = TRAIL[size]
  const dash = length / dashes
  const glyph = (
    <svg
      data-slot="z-loader"
      data-size={size}
      data-tone={own ? "own" : undefined}
      className={size === "lg" ? "zimos-zl" : ["zimos-zl", className].filter(Boolean).join(" ")}
      style={own ? ({ "--zl-c": own } as React.CSSProperties) : undefined}
      width={px}
      height={px}
      viewBox={VIEW_BOX}
      fill="none"
      strokeLinejoin="round"
      focusable="false"
      {...(size !== "lg" && !hidden ? { role: "status", "aria-label": label } : { "aria-hidden": true })}
    >
      <defs>
        {STRIPS.map((strip, k) => (
          <linearGradient key={k} id={`${uid}-${k}`} x1={strip.grad[0]} y1={strip.grad[1]} x2={strip.grad[2]} y2={strip.grad[3]}>
            <stop offset="0" style={{ stopColor: "var(--zl-a)" }} />
            <stop offset="1" style={{ stopColor: "var(--zl-b)" }} />
          </linearGradient>
        ))}
        <filter id={`${uid}-h`} filterUnits="userSpaceOnUse" x="-80" y="-20" width="672" height="560" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="14" result="near" />
          <feGaussianBlur in="SourceAlpha" stdDeviation="38" result="far" />
          <feFlood floodColor="#5ee0ff" />
          <feComposite in2="near" operator="in" result="nearGlow" />
          <feFlood floodColor="#2fb4ff" floodOpacity=".9" />
          <feComposite in2="far" operator="in" result="farGlow" />
          <feMerge>
            <feMergeNode in="farGlow" />
            <feMergeNode in="nearGlow" />
            <feMergeNode in="nearGlow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {STRIPS.map((strip, k) => (
        <g key={k} stroke={`url(#${uid}-${k})`}>
          <path className="zimos-zl-base" d={strip.d} strokeWidth={width * 0.8} />
          {Array.from({ length: dashes }, (_, i) => (
            <path
              key={i}
              className="zimos-zl-run"
              d={strip.d}
              pathLength={100}
              strokeWidth={+(width * (1 - (0.4 * i) / (dashes - 1))).toFixed(2)}
              strokeOpacity={+(((dashes - i) / dashes) ** 1.4).toFixed(3)}
              strokeDasharray={`${+dash.toFixed(3)} ${+(PERIOD - dash).toFixed(3)}`}
              style={{ animationDelay: delay(k, (i + 1) * dash) }}
            />
          ))}
        </g>
      ))}
      <g filter={`url(#${uid}-h)`} stroke="#effdff" strokeWidth={width * 2} strokeLinecap="round">
        {STRIPS.map((strip, k) => (
          <path
            key={k}
            className="zimos-zl-run zimos-zl-head"
            d={strip.d}
            pathLength={100}
            strokeDasharray={`${HEAD_DASH} ${PERIOD - HEAD_DASH}`}
            style={{ animationDelay: delay(k, 0) }}
          />
        ))}
      </g>
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
