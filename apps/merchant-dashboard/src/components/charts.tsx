/**
 * The dashboard's charts, as plain inline SVG with HTML on top.
 *
 * The look follows the owner's reference (21st.dev "Peak Chart", 2026-11-15):
 * a dark pane whose edges glow, the line brightest at its peak, a lit dot
 * resting on the peak that follows the pointer, and the value under the
 * pointer on a small pane of glass. The whole pane takes one tone: **blue
 * when the figure moved the good way, red when it moved the bad way** (a
 * falling bounce rate is good). With no comparison to judge by it stays blue.
 * The drawing is CSS (charts.css): gradients, not a canvas, so it costs
 * nothing to paint and fits any width.
 *
 * Rules every chart keeps:
 *
 * - One series each (and its previous period, dashed), so no legend palette.
 * - The SVG only draws the marks; the dot, the labels and the readout are
 *   HTML over it, so they keep their size whatever the chart's width.
 * - Hovering, a tap, or the arrow keys on the focused chart show the exact
 *   value; a screen reader gets the summary, and each value as it is reached.
 * - A time axis runs left to right in Arabic too (the pane is `dir="ltr"`).
 * - It draws in once it is on screen; with reduced motion it is simply there.
 */
import { useCallback, useId, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { toneOf, type ChartTone } from "@/lib/chartTone";
import "./charts.css";

export type { ChartTone };

export interface ChartPoint {
  label: string;
  value: number;
}

/** The tone of a period against the one before it, summed over the days both have. */
function toneOfTotals(current: number[], previous: Array<number | null> | null | undefined, lowerIsBetter = false): ChartTone {
  if (!previous || previous.length === 0) return "good";
  let now = 0;
  let before = 0;
  let paired = 0;
  current.forEach((value, i) => {
    const old = previous[i];
    if (old === null || old === undefined) return;
    now += value;
    before += old;
    paired += 1;
  });
  return paired === 0 ? "good" : toneOf(now - before, lowerIsBetter);
}

/* --------------------------------------------------------------- geometry -- */

/** The SVG's own units: 1000 across, 100 down, stretched to the plot's box. */
const W = 1000;
const H = 100;

/**
 * A smooth line through the points that never overshoots them (monotone
 * cubic, Steffen's tangents): the highest point stays the top of the curve,
 * so the dot sits on it.
 */
function smoothPath(xs: number[], ys: number[]): string {
  const n = xs.length;
  if (n === 0) return "";
  if (n === 1) return `M${xs[0].toFixed(1)},${ys[0].toFixed(2)}`;
  const h: number[] = [];
  const s: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    h.push(xs[i + 1] - xs[i] || 1e-6);
    s.push((ys[i + 1] - ys[i]) / h[i]);
  }
  const m: number[] = [s[0]];
  for (let i = 1; i < n - 1; i++) {
    const p = (s[i - 1] * h[i] + s[i] * h[i - 1]) / (h[i - 1] + h[i]);
    m.push((Math.sign(s[i - 1]) + Math.sign(s[i])) * Math.min(Math.abs(s[i - 1]), Math.abs(s[i]), 0.5 * Math.abs(p)));
  }
  m.push(s[n - 2]);
  let d = `M${xs[0].toFixed(1)},${ys[0].toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const third = h[i] / 3;
    d += ` C${(xs[i] + third).toFixed(1)},${(ys[i] + m[i] * third).toFixed(2)} ${(xs[i + 1] - third).toFixed(1)},${(ys[i + 1] - m[i + 1] * third).toFixed(2)} ${xs[i + 1].toFixed(1)},${ys[i + 1].toFixed(2)}`;
  }
  return d;
}

/** Runs of consecutive known values (a previous period can be shorter than this one). */
function runsOf(values: Array<number | null>): Array<Array<[number, number]>> {
  const runs: Array<Array<[number, number]>> = [];
  let run: Array<[number, number]> = [];
  values.forEach((value, i) => {
    if (value === null) {
      if (run.length) runs.push(run);
      run = [];
    } else run.push([i, value]);
  });
  if (run.length) runs.push(run);
  return runs;
}

/**
 * How lit the line is at `x`: full on the peak, fading with distance (the
 * reference's falloff), never under `floor`. The line itself is always drawn
 * in the tone's colour; this light goes over it, so every day stays readable.
 */
const FALLOFF = 260;
function lineStops(peakX: number, floor = 0.5) {
  return Array.from({ length: 41 }, (_, i) => {
    const x = (i / 40) * W;
    return { offset: i / 40, opacity: floor + (1 - floor) * Math.exp(-Math.pow(Math.abs(x - peakX) / FALLOFF, 1.44)) };
  });
}

/** When the reveal (1.7s, ease-in-out) reaches `fraction` of the width: the dot lands then. */
const REVEAL_S = 1.7;
function revealAt(fraction: number): number {
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (ease(mid) < fraction) lo = mid;
    else hi = mid;
  }
  return REVEAL_S * ((lo + hi) / 2);
}

/** Near an edge, a label hangs inward instead of centring on its point. */
function edgeOf(fraction: number): "start" | "end" | undefined {
  return fraction < 0.1 ? "start" : fraction > 0.9 ? "end" : undefined;
}

/* ------------------------------------------------------------------ hooks -- */

/** True once the element has been on screen (and at once where that can't be watched). */
function useShown(): [(el: HTMLElement | null) => (() => void) | void, boolean] {
  const [shown, setShown] = useState(() => typeof IntersectionObserver === "undefined");
  const ref = useCallback(
    (el: HTMLElement | null) => {
      if (!el || shown) return;
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setShown(true);
            io.disconnect();
          }
        },
        { threshold: 0.25 }
      );
      io.observe(el);
      return () => io.disconnect();
    },
    [shown]
  );
  return [ref, shown];
}

/**
 * Which point is "under" the pointer, a finger or the keyboard. `pick` turns
 * a 0..1 position across the plot into an index. The mouse lets go when it
 * leaves; a finger's choice stays until the next touch.
 */
function usePlotPointer(count: number, pick: (ratio: number) => number) {
  const [index, setIndex] = useState<number | null>(null);
  const [byKey, setByKey] = useState(false);
  const at = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = box.width > 0 ? Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)) : 0;
    setIndex(Math.min(count - 1, Math.max(0, pick(ratio))));
    setByKey(false);
  };
  const handlers = {
    tabIndex: 0,
    onPointerMove: at,
    onPointerDown: at,
    onPointerLeave: (event: PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "mouse") setIndex(null);
    },
    onBlur: () => setIndex(null),
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
      const last = count - 1;
      let next: number | null = null;
      if (event.key === "ArrowRight") next = index === null ? 0 : Math.min(last, index + 1);
      else if (event.key === "ArrowLeft") next = index === null ? last : Math.max(0, index - 1);
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = last;
      else if (event.key === "Escape" && index !== null) {
        setIndex(null);
        return;
      }
      if (next === null) return;
      event.preventDefault();
      setIndex(next);
      setByKey(true);
    },
  };
  return { index, byKey, handlers };
}

/* ------------------------------------------------------------------ frame -- */

interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** The pane: the glow, the grid, and the tone everything inside takes. */
function PeakFrame({
  tone,
  height,
  className,
  hovering,
  children,
}: {
  tone: ChartTone;
  height: number;
  className?: string;
  hovering: boolean;
  children: ReactNode;
}) {
  const [ref, shown] = useShown();
  return (
    <div
      ref={ref}
      dir="ltr"
      data-slot="chart"
      data-tone={tone}
      data-shown={shown ? "" : undefined}
      data-hovering={hovering ? "" : undefined}
      className={cn("zimos-peak", className)}
      style={{ height }}
    >
      <span aria-hidden className="pk-grid" />
      {children}
    </div>
  );
}

/** A point of the plot, as a place on the pane (the plot sits inside the insets). */
function placeOf(insets: Insets, xFraction: number, yFraction: number) {
  return {
    left: `calc(${insets.left}px + (100% - ${insets.left + insets.right}px) * ${xFraction.toFixed(4)})`,
    top: `calc(${insets.top}px + (100% - ${insets.top + insets.bottom}px) * ${yFraction.toFixed(4)})`,
  };
}

/** The labels under the plot: first, middle and last. */
function XLabels({ labels, insets, place }: { labels: string[]; insets: Insets; place: (i: number) => number }) {
  const last = labels.length - 1;
  if (last < 0) return null;
  const shown = [0, Math.floor(last / 2), last].filter((i, k, all) => all.indexOf(i) === k);
  return (
    <>
      {shown.map((i) => {
        const fraction = place(i);
        const { left } = placeOf(insets, fraction, 0);
        const translate = i === 0 && shown.length > 1 ? "0" : i === last && shown.length > 1 ? "-100%" : "-50%";
        return (
          <span key={i} aria-hidden className="pk-axis" style={{ left, bottom: 10, translate: `${translate} 0` }}>
            <bdi>{labels[i]}</bdi>
          </span>
        );
      })}
    </>
  );
}

/** The value scale at the start of the plot (0, half, top), with faint guides across. */
function YScale({ max, insets, format }: { max: number; insets: Insets; format: (value: number) => string }) {
  return (
    <>
      {[0, 0.5, 1].map((g) => {
        const { top } = placeOf(insets, 0, 1 - g);
        return (
          <span key={g} aria-hidden>
            <span className="pk-axis" style={{ top, left: 12, translate: "0 -50%" }}>
              <bdi>{format(max * g)}</bdi>
            </span>
            <span
              className="absolute border-t border-dashed border-white/[0.07]"
              style={{ top, left: insets.left, right: insets.right }}
            />
          </span>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------ line charts -- */

interface LinePanelProps {
  labels: string[];
  values: number[];
  previous?: Array<number | null> | null;
  previousLabels?: Array<string | undefined>;
  format: (value: number) => string;
  formatAxis?: (value: number) => string;
  height: number;
  className?: string;
  summary: string;
  tone: ChartTone;
  legend?: { current: string; previous: string };
}

function LinePanel({
  labels,
  values,
  previous,
  previousLabels,
  format,
  formatAxis,
  height,
  className,
  summary,
  tone,
  legend,
}: LinePanelProps) {
  const id = useId();
  const n = values.length;
  const fraction = (i: number) => (n > 1 ? i / (n - 1) : 0.5);
  const { index, byKey, handlers } = usePlotPointer(n, (ratio) => Math.round(ratio * (n - 1)));

  const hasPrevious = Boolean(previous && previous.some((v) => v !== null));
  const max = Math.max(0, ...values, ...(hasPrevious ? (previous as Array<number | null>).map((v) => v ?? 0) : [])) || 1;
  const insets: Insets = { top: legend ? 44 : 34, right: 20, bottom: 30, left: formatAxis ? 58 : 20 };
  const yOf = (v: number) => H - (Math.max(0, v) / max) * H;
  const xs = values.map((_, i) => fraction(i) * W);
  const ys = values.map(yOf);
  const line = smoothPath(xs, ys);
  const area = n > 1 ? `${line} L${W},${H} L0,${H} Z` : "";
  const before = hasPrevious
    ? runsOf(previous as Array<number | null>)
        .map((run) => smoothPath(run.map(([i]) => fraction(i) * W), run.map(([, v]) => yOf(v))))
        .join(" ")
    : "";
  const peak = values.reduce((best, v, i) => (v > values[best] ? i : best), 0);
  const peakX = fraction(peak) * W;
  const light = lineStops(peakX, 0);
  const halo = lineStops(peakX, 0.12);
  const at = index ?? peak;
  const dot = placeOf(insets, fraction(at), ys[at] / H);
  const pastValue = index !== null && hasPrevious ? (previous as Array<number | null>)[index] ?? null : null;
  const ghost = pastValue !== null ? placeOf(insets, fraction(index!), yOf(pastValue) / H) : null;
  const readoutBelow = index !== null && ys[index] < 34;

  return (
    <PeakFrame tone={tone} height={height} className={className} hovering={index !== null}>
      {formatAxis && <YScale max={max} insets={insets} format={formatAxis} />}
      {legend && hasPrevious && (
        <span aria-hidden className="pk-legend">
          <span>
            <i />
            {legend.current}
          </span>
          <span>
            <i data-previous="" />
            {legend.previous}
          </span>
        </span>
      )}
      <div
        className="pk-plot"
        role="img"
        aria-label={summary}
        style={{ top: insets.top, right: insets.right, bottom: insets.bottom, left: insets.left }}
        {...handlers}
      >
        <svg className="pk-svg pk-reveal" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id={`${id}-light`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={W} y2="0">
              {light.map((stop) => (
                <stop key={stop.offset} offset={stop.offset} style={{ stopColor: "rgb(var(--pk-line-hi))", stopOpacity: stop.opacity.toFixed(3) }} />
              ))}
            </linearGradient>
            <linearGradient id={`${id}-halo`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={W} y2="0">
              {halo.map((stop) => (
                <stop key={stop.offset} offset={stop.offset} style={{ stopColor: "rgb(var(--pk-line))", stopOpacity: (stop.opacity * 0.45).toFixed(3) }} />
              ))}
            </linearGradient>
            <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: "rgb(var(--pk-glow))", stopOpacity: 0.34 }} />
              <stop offset="100%" style={{ stopColor: "rgb(var(--pk-glow))", stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          {area && <path d={area} fill={`url(#${id}-area)`} />}
          {before && (
            <path d={before} fill="none" stroke="rgb(255 255 255 / 0.32)" strokeWidth="1.5" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
          )}
          {/* A soft halo, the line in the tone's colour, and the light on it: halo and light gather at the peak. */}
          <path d={line} fill="none" stroke={`url(#${id}-halo)`} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <path d={line} fill="none" style={{ stroke: "rgb(var(--pk-line))" }} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <path d={line} fill="none" stroke={`url(#${id}-light)`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      {/* Over the plot, in the pane's own pixels. */}
      {index !== null && <span aria-hidden className="pk-cursor" style={{ left: dot.left, top: insets.top, bottom: insets.bottom }} />}
      {ghost && <span aria-hidden className="pk-dot-ghost" style={ghost} />}
      <span aria-hidden className="pk-dot" style={{ ...dot, animationDelay: `${revealAt(fraction(peak)).toFixed(2)}s` }} />
      {n > 1 && (
        <span
          aria-hidden
          className="pk-peak-label"
          data-edge={edgeOf(fraction(peak))}
          style={{ ...placeOf(insets, fraction(peak), ys[peak] / H), animationDelay: `${(revealAt(fraction(peak)) + 0.2).toFixed(2)}s` }}
        >
          <bdi>{format(values[peak])}</bdi>
        </span>
      )}
      {index !== null && (
        <span
          aria-hidden
          className="pk-readout"
          data-edge={edgeOf(fraction(index))}
          data-below={readoutBelow ? "" : undefined}
          style={dot}
        >
          <span className="pk-readout-value">
            <bdi>{format(values[index])}</bdi>
          </span>
          <span className="pk-readout-label" dir="auto">
            {labels[index]}
          </span>
          {pastValue !== null && (
            <span className="pk-readout-label" dir="auto">
              {legend ? `${previousLabels?.[index] ?? legend.previous}: ` : ""}
              <bdi>{format(pastValue)}</bdi>
            </span>
          )}
        </span>
      )}
      {/* What a screen reader hears as the arrow keys move along the line. */}
      <span className="sr-only" aria-live="polite">
        {byKey && index !== null ? `${labels[index]}: ${format(values[index])}` : ""}
      </span>
      <XLabels labels={labels} insets={insets} place={fraction} />
    </PeakFrame>
  );
}

/**
 * The tiny trend inside a metric tile: this period, brightest at its peak,
 * with a dot there; the one before it dashed. Blue or red like the big
 * charts (`tone`, or worked out from the two periods). Decorative — the
 * tile's value and its change carry the numbers.
 */
export function Sparkline({
  current,
  previous,
  height = 32,
  className,
  tone,
  lowerIsBetter = false,
}: {
  current: number[];
  previous?: number[] | null;
  height?: number;
  className?: string;
  tone?: ChartTone;
  lowerIsBetter?: boolean;
}) {
  const id = useId();
  const pad = 3;
  const n = current.length;
  const series = previous && previous.length ? [current, previous] : [current];
  const max = Math.max(0, ...series.flat());
  const x = (i: number, count: number) => (count > 1 ? (i / (count - 1)) * W : W / 2);
  const y = (v: number) => (max > 0 ? pad + (H - pad * 2) * (1 - v / max) : H - pad);
  const path = (values: number[]) => smoothPath(values.map((_, i) => x(i, values.length)), values.map(y));
  const peak = current.reduce((best, v, i) => (v > current[best] ? i : best), 0);
  const shade = tone ?? toneOfTotals(current, previous, lowerIsBetter);
  return (
    <span aria-hidden data-tone={shade} className={cn("zimos-spark block h-8 w-full", className)} style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full overflow-visible" preserveAspectRatio="none">
        <defs>
          <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={W} y2="0">
            {lineStops(x(peak, n)).map((stop) => (
              <stop key={stop.offset} offset={stop.offset} style={{ stopColor: "var(--sp-line)", stopOpacity: stop.opacity.toFixed(3) }} />
            ))}
          </linearGradient>
        </defs>
        {previous && previous.length > 0 && (
          <path d={path(previous)} fill="none" stroke="var(--color-line-strong)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        )}
        <path d={path(current)} fill="none" stroke={`url(#${id})`} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {n > 0 && max > 0 && <span className="sp-dot" style={{ left: `${(x(peak, n) / W) * 100}%`, top: `${(y(current[peak]) / H) * 100}%` }} />}
    </span>
  );
}

export interface ComparePoint {
  label: string;
  value: number;
  /** Same position in the period before; null when that window wasn't loaded. */
  previous: number | null;
  previousLabel?: string;
}

/**
 * This period against the one before it: the line over a faint fill, the
 * comparison dashed. Hovering shows both values for that day. Blue when this
 * period is ahead of the last (behind, for `lowerIsBetter`), red when not;
 * `tone` overrides that with the verdict the page already shows.
 */
export function ComparisonLineChart({
  points,
  format,
  formatAxis = format,
  height = 260,
  className,
  summary,
  currentLabel,
  previousLabel,
  tone,
  lowerIsBetter = false,
}: {
  points: ComparePoint[];
  format: (value: number) => string;
  formatAxis?: (value: number) => string;
  height?: number;
  className?: string;
  summary: string;
  currentLabel: string;
  previousLabel: string;
  tone?: ChartTone;
  lowerIsBetter?: boolean;
}) {
  const values = points.flatMap((p) => [p.value, p.previous ?? 0]);
  if (points.length === 0 || values.every((v) => v === 0)) {
    return <EmptyPlot height={height} className={className} label={summary} />;
  }
  const current = points.map((p) => p.value);
  const previous = points.map((p) => p.previous);
  return (
    <LinePanel
      labels={points.map((p) => p.label)}
      values={current}
      previous={previous}
      previousLabels={points.map((p) => p.previousLabel)}
      format={format}
      formatAxis={formatAxis}
      height={height}
      className={className}
      summary={summary}
      tone={tone ?? toneOfTotals(current, previous, lowerIsBetter)}
      legend={{ current: currentLabel, previous: previousLabel }}
    />
  );
}

/** Nothing to draw — every value is zero, or there are no points at all. */
function isFlat(points: ChartPoint[]): boolean {
  return points.length === 0 || points.every((p) => p.value === 0);
}

interface AxisProps {
  points: ChartPoint[];
  /** Turns a value into the text shown on the readout and on the peak. */
  format: (value: number) => string;
  height?: number;
  className?: string;
  /** Sentence describing the whole figure, for screen readers. */
  summary: string;
  /** Blue (good, the default) or red (bad): the verdict the page shows for this figure. */
  tone?: ChartTone;
}

/**
 * Revenue-over-time: one line over a faint fill. Only the peak is labelled —
 * a number on every point is noise at 30+ days; the pointer reads the rest.
 */
export function LineAreaChart({ points, format, height = 220, className, summary, tone = "good" }: AxisProps) {
  if (isFlat(points)) return <EmptyPlot height={height} className={className} label={summary} />;
  return (
    <LinePanel
      labels={points.map((p) => p.label)}
      values={points.map((p) => p.value)}
      format={format}
      height={height}
      className={className}
      summary={summary}
      tone={tone}
    />
  );
}

/* ------------------------------------------------------------- bar charts -- */

/** Rounded at the data end, square where it meets the baseline. */
function barPath(x: number, width: number, top: number, radius: number): string {
  const r = Math.min(radius, H - top, width / 2);
  return `M${x},${H} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + width - r},${top} Q${x + width},${top} ${x + width},${top + r} L${x + width},${H} Z`;
}

/**
 * Counts per day (or per hour). Bars grow from the baseline; the tallest is
 * lit, the one under the pointer too, and its value reads on glass.
 */
export function BarChart({ points, format, height = 220, className, summary, tone = "good" }: AxisProps) {
  const id = useId();
  const n = points.length;
  const { index, byKey, handlers } = usePlotPointer(n, (ratio) => Math.floor(ratio * n));
  if (isFlat(points)) return <EmptyPlot height={height} className={className} label={summary} />;

  const insets: Insets = { top: 34, right: 20, bottom: 30, left: 20 };
  const max = Math.max(...points.map((p) => p.value)) || 1;
  const slot = W / n;
  const gap = Math.min(slot * 0.28, 10);
  const width = Math.max(1, slot - gap);
  const top = (v: number) => H - (Math.max(0, v) / max) * H;
  const center = (i: number) => (i + 0.5) / n;
  const peak = points.reduce((best, p, i) => (p.value > points[best].value ? i : best), 0);
  const at = index ?? peak;

  return (
    <PeakFrame tone={tone} height={height} className={className} hovering={index !== null}>
      <div
        className="pk-plot"
        role="img"
        aria-label={summary}
        style={{ top: insets.top, right: insets.right, bottom: insets.bottom, left: insets.left }}
        {...handlers}
      >
        <svg className="pk-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id={`${id}-bar`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: "rgb(var(--pk-line))", stopOpacity: 0.85 }} />
              <stop offset="100%" style={{ stopColor: "rgb(var(--pk-line))", stopOpacity: 0.18 }} />
            </linearGradient>
            <linearGradient id={`${id}-lit`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: "rgb(var(--pk-line-hi))", stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: "rgb(var(--pk-line))", stopOpacity: 0.35 }} />
            </linearGradient>
          </defs>
          <line x1="0" x2={W} y1={H} y2={H} stroke="rgb(255 255 255 / 0.12)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          {points.map((p, i) => {
            if (p.value <= 0) return null;
            const lit = i === at;
            return (
              <path
                key={`${p.label}-${i}`}
                className="pk-bar"
                d={barPath(i * slot + gap / 2, width, top(p.value), 6)}
                fill={`url(#${id}-${lit ? "lit" : "bar"})`}
                style={{ animationDelay: `${Math.min(0.9, i * (0.9 / Math.max(1, n)))}s` }}
              />
            );
          })}
        </svg>
      </div>
      <span aria-hidden className="pk-dot" style={{ ...placeOf(insets, center(at), top(points[at].value) / H), animationDelay: "0.9s" }} />
      {index === null && (
        <span
          aria-hidden
          className="pk-peak-label"
          data-edge={edgeOf(center(peak))}
          style={{ ...placeOf(insets, center(peak), top(points[peak].value) / H), animationDelay: "1.05s" }}
        >
          <bdi>{format(points[peak].value)}</bdi>
        </span>
      )}
      {index !== null && (
        <span
          aria-hidden
          className="pk-readout"
          data-edge={edgeOf(center(index))}
          data-below={top(points[index].value) < 34 ? "" : undefined}
          style={placeOf(insets, center(index), top(points[index].value) / H)}
        >
          <span className="pk-readout-value">
            <bdi>{format(points[index].value)}</bdi>
          </span>
          <span className="pk-readout-label" dir="auto">
            {points[index].label}
          </span>
        </span>
      )}
      <span className="sr-only" aria-live="polite">
        {byKey && index !== null ? `${points[index].label}: ${format(points[index].value)}` : ""}
      </span>
      <XLabels labels={points.map((p) => p.label)} insets={insets} place={center} />
    </PeakFrame>
  );
}

export interface StackedPoint {
  label: string;
  /** The larger series (drawn as the back bar). */
  primary: number;
  /** The subset series (drawn in front). */
  secondary: number;
  comparisonPrimary?: number | null;
  comparisonSecondary?: number | null;
}

/**
 * Traffic: views as the faint back bar, visitors as the lit front one, and
 * the comparison period as dashed lines. Hover shows every value for that
 * bucket. Blue when there were more visitors than in the period before.
 */
export function StackedBarsChart({
  points,
  height = 280,
  className,
  summary,
  primaryLabel,
  secondaryLabel,
  comparisonLabel,
  format = (v) => String(v),
  tone,
}: {
  points: StackedPoint[];
  height?: number;
  className?: string;
  summary: string;
  primaryLabel: string;
  secondaryLabel: string;
  comparisonLabel?: string;
  format?: (value: number) => string;
  tone?: ChartTone;
}) {
  const id = useId();
  const n = points.length;
  const { index, byKey, handlers } = usePlotPointer(n, (ratio) => Math.floor(ratio * n));
  const values = points.flatMap((p) => [p.primary, p.comparisonPrimary ?? 0]);
  if (n === 0 || values.every((v) => v === 0)) {
    return <EmptyPlot height={height} className={className} label={summary} />;
  }
  const insets: Insets = { top: 44, right: 20, bottom: 30, left: 52 };
  const max = Math.max(...values, 1);
  const slot = W / n;
  const barW = Math.max(2, slot * 0.58);
  const x = (i: number) => i * slot + (slot - barW) / 2;
  const center = (i: number) => (i + 0.5) / n;
  const y = (v: number) => H - (Math.max(0, v) / max) * H;
  const hasComparison = points.some((p) => p.comparisonPrimary !== null && p.comparisonPrimary !== undefined);
  const linePath = (pick: (p: StackedPoint) => number | null | undefined) =>
    runsOf(points.map((p) => pick(p) ?? null))
      .map((run) => smoothPath(run.map(([i]) => center(i) * W), run.map(([, v]) => y(v))))
      .join(" ");
  const shade =
    tone ??
    toneOfTotals(
      points.map((p) => p.secondary),
      hasComparison ? points.map((p) => p.comparisonSecondary ?? null) : null
    );
  const point = index === null ? null : points[index];

  return (
    <PeakFrame tone={shade} height={height} className={className} hovering={index !== null}>
      <YScale max={max} insets={insets} format={(v) => format(Math.round(v))} />
      <span aria-hidden className="pk-legend">
        <span>
          <i style={{ borderTopWidth: 6, opacity: 0.4 }} />
          {primaryLabel}
        </span>
        <span>
          <i style={{ borderTopWidth: 6 }} />
          {secondaryLabel}
        </span>
        {hasComparison && comparisonLabel && (
          <span>
            <i data-previous="" />
            {comparisonLabel}
          </span>
        )}
      </span>
      <div
        className="pk-plot"
        role="img"
        aria-label={summary}
        style={{ top: insets.top, right: insets.right, bottom: insets.bottom, left: insets.left }}
        {...handlers}
      >
        <svg className="pk-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id={`${id}-front`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: "rgb(var(--pk-line-hi))", stopOpacity: 0.95 }} />
              <stop offset="100%" style={{ stopColor: "rgb(var(--pk-line))", stopOpacity: 0.3 }} />
            </linearGradient>
          </defs>
          {points.map((p, i) => (
            <g key={`${p.label}-${i}`} opacity={index === null || index === i ? 1 : 0.55}>
              {p.primary > 0 && <path className="pk-bar" d={barPath(x(i), barW, y(p.primary), 5)} style={{ fill: "rgb(var(--pk-line) / 0.26)", animationDelay: `${Math.min(0.8, i * 0.04)}s` }} />}
              {p.secondary > 0 && (
                <path className="pk-bar" d={barPath(x(i), barW, y(p.secondary), 5)} fill={`url(#${id}-front)`} style={{ animationDelay: `${Math.min(0.8, i * 0.04) + 0.08}s` }} />
              )}
            </g>
          ))}
          {hasComparison && (
            <g className="pk-reveal">
              <path d={linePath((p) => p.comparisonPrimary)} fill="none" stroke="rgb(255 255 255 / 0.32)" strokeWidth="1.5" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
              <path d={linePath((p) => p.comparisonSecondary)} fill="none" stroke="rgb(255 255 255 / 0.5)" strokeWidth="1.5" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
            </g>
          )}
        </svg>
      </div>
      {point && index !== null && (
        <span
          aria-hidden
          className="pk-readout"
          data-edge={edgeOf(center(index))}
          data-below={y(point.primary) < 40 ? "" : undefined}
          style={placeOf(insets, center(index), y(point.primary) / H)}
        >
          <span className="pk-readout-label" dir="auto">
            {point.label}
          </span>
          <span className="flex justify-between gap-4">
            <span className="pk-readout-label">{primaryLabel}</span>
            <span className="pk-readout-value">
              <bdi>{format(point.primary)}</bdi>
            </span>
          </span>
          <span className="flex justify-between gap-4">
            <span className="pk-readout-label">{secondaryLabel}</span>
            <span className="pk-readout-value">
              <bdi>{format(point.secondary)}</bdi>
            </span>
          </span>
          {hasComparison && comparisonLabel && (
            <span className="pk-readout-label">
              {comparisonLabel}:{" "}
              <bdi>
                {format(point.comparisonPrimary ?? 0)} / {format(point.comparisonSecondary ?? 0)}
              </bdi>
            </span>
          )}
        </span>
      )}
      <span className="sr-only" aria-live="polite">
        {byKey && point ? `${point.label}: ${primaryLabel} ${format(point.primary)}, ${secondaryLabel} ${format(point.secondary)}` : ""}
      </span>
      <XLabels labels={points.map((p) => p.label)} insets={insets} place={center} />
    </PeakFrame>
  );
}

/* ---------------------------------------------------------- ranked rows -- */

export interface HBarRow {
  label: string;
  value: number;
  /** Small line under the label, e.g. "12 units · EGP 3,400". */
  caption?: string;
}

/**
 * Ranked rows — order status, top products. Not an SVG: it is a list with a
 * proportional track behind each row, so every value is also plain text and
 * the whole thing reads as a table without a chart-specific fallback. The
 * first row's track is lit, like a chart's peak.
 */
export function HBarList({
  rows,
  format,
  className,
  emptyLabel,
}: {
  rows: HBarRow[];
  format?: (value: number) => string;
  className?: string;
  emptyLabel?: ReactNode;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <>{emptyLabel ?? null}</>;
  return (
    <ul className={cn("space-y-2.5", className)}>
      {rows.map((row, i) => (
        <li key={`${row.label}-${i}`}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm text-ink" dir="auto">
              {row.label}
            </span>
            <span className="tabular-nums shrink-0 text-sm font-medium text-ink">
              <bdi dir="ltr">{format ? format(row.value) : row.value}</bdi>
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-paper-sunken">
            <div
              className={cn(
                "h-full rounded-full bg-gradient-to-r from-primary/55 to-primary rtl:bg-gradient-to-l",
                row.value === max && "shadow-[0_0_10px_color-mix(in_srgb,var(--color-primary)_55%,transparent)]"
              )}
              style={{ width: `${Math.round((row.value / max) * 100)}%` }}
            />
          </div>
          {row.caption && (
            <p className="mt-0.5 text-xs text-ink-soft" dir="auto">
              {row.caption}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Keeps the card the same height when the range has no activity in it. */
function EmptyPlot({ height, className, label }: { height: number; className?: string; label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      style={{ height }}
      className={cn(
        "flex items-center justify-center rounded-[1.25rem] border border-dashed border-line text-xs text-ink-soft",
        className
      )}
    >
      {label}
    </div>
  );
}
