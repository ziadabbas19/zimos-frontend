/**
 * The dashboard's three chart shapes, as plain inline SVG.
 *
 * No charting library: these are small, single-series figures and a dependency
 * would cost more than it saves. Rules they all follow:
 *
 * - One series each, so there is no legend and no categorical palette — the
 *   card title names what is plotted and the colour is a brand token, which
 *   means dark mode is handled by the tokens rather than by a second palette.
 * - Marks are thin, grid and axis lines are recessive, and values are written
 *   in ink tokens, never in the series colour.
 * - Every mark carries a `<title>`, so hovering (and a screen reader) gives the
 *   exact value instead of making the merchant read it off an axis.
 * - The figure is wrapped in `dir="ltr"` by its caller: a time axis runs
 *   left-to-right in Arabic too.
 */
import { useId, useState, type MouseEvent, type ReactNode } from "react";
import { cn } from "@store-builder/ui";

export interface ChartPoint {
  label: string;
  value: number;
}

const AXIS_CLASS = "fill-[var(--color-ink-soft)] text-[10px]";

/**
 * The tiny trend inside a metric tile: this period as a solid line, the one
 * before it dashed. Decorative — the tile's value and delta carry the numbers.
 */
export function Sparkline({
  current,
  previous,
  height = 32,
  className,
}: {
  current: number[];
  previous?: number[] | null;
  height?: number;
  className?: string;
}) {
  const width = 120;
  const pad = 2;
  const series = previous && previous.length ? [current, previous] : [current];
  const max = Math.max(0, ...series.flat());
  const path = (values: number[]) => {
    if (values.length === 0) return "";
    const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
    return values
      .map((v, i) => {
        const x = values.length > 1 ? pad + i * step : width / 2;
        const y = max > 0 ? pad + (height - pad * 2) * (1 - v / max) : height - pad;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  };
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("h-8 w-full", className)}
      preserveAspectRatio="none"
      aria-hidden
    >
      {previous && previous.length > 0 && (
        <path
          d={path(previous)}
          fill="none"
          stroke="var(--color-line-strong)"
          strokeWidth="1"
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <path
        d={path(current)}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
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
 * This period against the one before it: a solid line over a faint fill, and
 * the comparison dashed. Hovering shows both values for that day.
 */
export function ComparisonLineChart({
  points,
  format,
  formatAxis = format,
  height = 240,
  className,
  summary,
  currentLabel,
  previousLabel,
}: {
  points: ComparePoint[];
  format: (value: number) => string;
  formatAxis?: (value: number) => string;
  height?: number;
  className?: string;
  summary: string;
  currentLabel: string;
  previousLabel: string;
}) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const width = 640;
  const padStart = 52;
  const padEnd = 12;
  const padTop = 12;
  const padBottom = 24;
  const plotW = width - padStart - padEnd;
  const plotH = height - padTop - padBottom;

  const values = points.flatMap((p) => [p.value, p.previous ?? 0]);
  if (points.length === 0 || values.every((v) => v === 0)) {
    return <EmptyPlot height={height} className={className} label={summary} />;
  }

  const max = Math.max(...values);
  const step = points.length > 1 ? plotW / (points.length - 1) : 0;
  const x = (i: number) => (points.length > 1 ? padStart + i * step : padStart + plotW / 2);
  const y = (v: number) => padTop + plotH - (v / max) * plotH;
  const linePath = (pick: (p: ComparePoint) => number | null) =>
    points
      .map((p, i) => {
        const v = pick(p);
        return v === null ? null : `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      })
      .filter(Boolean)
      .join(" ");
  const current = linePath((p) => p.value);
  const area = `${current} L${x(points.length - 1).toFixed(1)},${padTop + plotH} L${x(0).toFixed(1)},${padTop + plotH} Z`;
  const hasPrevious = points.some((p) => p.previous !== null);
  const previous = hasPrevious ? linePath((p) => p.previous) : "";
  const gridSteps = [0, 0.25, 0.5, 0.75, 1];
  const last = points.length - 1;
  const mid = Math.floor(last / 2);

  const onMove = (event: MouseEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / box.width;
    const px = ratio * width - padStart;
    const index = step > 0 ? Math.round(px / step) : 0;
    setHover(Math.min(last, Math.max(0, index)));
  };

  const point = hover === null ? null : points[hover];
  const tipStart = hover !== null && hover > last / 2;

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={summary}
        preserveAspectRatio="none"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridSteps.map((g) => (
          <g key={g}>
            <line
              x1={padStart}
              x2={width - padEnd}
              y1={y(max * g)}
              y2={y(max * g)}
              stroke="var(--color-line)"
              strokeWidth="1"
              strokeDasharray={g === 0 ? undefined : "2 4"}
            />
            <text x={padStart - 6} y={y(max * g) + 3} textAnchor="end" className={AXIS_CLASS}>
              {formatAxis(max * g)}
            </text>
          </g>
        ))}
        <path d={area} fill={`url(#${gradientId})`} />
        {previous && (
          <path
            d={previous}
            fill="none"
            stroke="var(--color-line-strong)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <path
          d={current}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {point && hover !== null && (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={padTop}
              y2={padTop + plotH}
              stroke="var(--color-line-strong)"
              strokeWidth="1"
            />
            {point.previous !== null && (
              <circle cx={x(hover)} cy={y(point.previous)} r="3.5" fill="var(--color-paper-raised)" stroke="var(--color-line-strong)" strokeWidth="1.5" />
            )}
            <circle cx={x(hover)} cy={y(point.value)} r="4" fill="var(--color-primary)" />
          </g>
        )}
        {[0, mid, last].filter((i, k, arr) => arr.indexOf(i) === k).map((i) => (
          <text
            key={i}
            x={x(i)}
            y={height - 6}
            textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"}
            className={AXIS_CLASS}
          >
            {points[i].label}
          </text>
        ))}
      </svg>
      {point && (
        <div
          className={cn(
            "pointer-events-none absolute top-2 z-10 min-w-40 rounded-[0.5rem] border border-line bg-paper-raised p-2.5 text-xs shadow-md",
            tipStart ? "start-14" : "end-3"
          )}
          dir="auto"
        >
          <p className="mb-1.5 font-medium text-ink">{point.label}</p>
          <p className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-ink-soft">
              <span aria-hidden className="inline-block h-0.5 w-3 rounded bg-primary" />
              {currentLabel}
            </span>
            <span className="tabular-nums font-medium text-ink">
              <bdi dir="ltr">{format(point.value)}</bdi>
            </span>
          </p>
          {point.previous !== null && (
            <p className="mt-1 flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-ink-soft">
                <span aria-hidden className="inline-block h-0 w-3 border-t border-dashed border-line-strong" />
                {point.previousLabel ?? previousLabel}
              </span>
              <span className="tabular-nums text-ink-soft">
                <bdi dir="ltr">{format(point.previous)}</bdi>
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Nothing to draw — every value is zero, or there are no points at all. */
function isFlat(points: ChartPoint[]): boolean {
  return points.length === 0 || points.every((p) => p.value === 0);
}

interface AxisProps {
  points: ChartPoint[];
  /** Turns a value into the text shown in tooltips and on the max label. */
  format: (value: number) => string;
  height?: number;
  className?: string;
  /** Sentence describing the whole figure, for screen readers. */
  summary: string;
}

/**
 * Revenue-over-time: a 2px line over a faint fill. Only the peak is labelled —
 * a number on every point is noise at 30+ days.
 */
export function LineAreaChart({ points, format, height = 200, className, summary }: AxisProps) {
  const gradientId = useId();
  const width = 600;
  const padTop = 18;
  const padBottom = 20;
  const plot = height - padTop - padBottom;

  if (isFlat(points)) return <EmptyPlot height={height} className={className} label={summary} />;

  const max = Math.max(...points.map((p) => p.value));
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  const x = (i: number) => (points.length > 1 ? i * step : width / 2);
  const y = (value: number) => padTop + plot - (value / max) * plot;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${padTop + plot} L${x(0).toFixed(1)},${padTop + plot} Z`;
  const peak = points.reduce((best, p, i) => (p.value > points[best].value ? i : best), 0);
  const last = points.length - 1;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("h-auto w-full", className)}
      role="img"
      aria-label={summary}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Baseline only: a full grid would compete with a line this thin. */}
      <line
        x1="0"
        x2={width}
        y1={padTop + plot}
        y2={padTop + plot}
        stroke="var(--color-line)"
        strokeWidth="1"
      />
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={x(last)} cy={y(points[last].value)} r="4" fill="var(--color-primary)" />
      <text
        x={Math.min(width - 4, Math.max(4, x(peak)))}
        y={Math.max(10, y(points[peak].value) - 6)}
        textAnchor={peak > points.length / 2 ? "end" : "start"}
        className={AXIS_CLASS}
      >
        {format(points[peak].value)}
      </text>
      {/* Hit areas: wider than the line, so hovering anywhere near works. */}
      {points.map((p, i) => (
        <rect
          key={p.label}
          x={Math.max(0, x(i) - step / 2)}
          y={padTop}
          width={Math.max(step, 6)}
          height={plot}
          fill="transparent"
        >
          <title>{`${p.label}: ${format(p.value)}`}</title>
        </rect>
      ))}
      <text x="0" y={height - 6} className={AXIS_CLASS}>
        {points[0].label}
      </text>
      <text x={width} y={height - 6} textAnchor="end" className={AXIS_CLASS}>
        {points[last].label}
      </text>
    </svg>
  );
}

/** Counts per day. Bars sit on the baseline with a rounded top and a 2px gap. */
export function BarChart({
  points,
  format,
  height = 200,
  className,
  summary,
  color = "var(--color-primary)",
}: AxisProps & { color?: string }) {
  const width = 600;
  const padTop = 12;
  const padBottom = 20;
  const plot = height - padTop - padBottom;

  if (isFlat(points)) return <EmptyPlot height={height} className={className} label={summary} />;

  const max = Math.max(...points.map((p) => p.value));
  const slot = width / points.length;
  const barWidth = Math.max(1, slot - 2);
  const radius = Math.min(4, barWidth / 2);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("h-auto w-full", className)}
      role="img"
      aria-label={summary}
      preserveAspectRatio="none"
    >
      <line
        x1="0"
        x2={width}
        y1={padTop + plot}
        y2={padTop + plot}
        stroke="var(--color-line)"
        strokeWidth="1"
      />
      {points.map((p, i) => {
        const barHeight = max > 0 ? (p.value / max) * plot : 0;
        const x = i * slot + 1;
        const y = padTop + plot - barHeight;
        const r = Math.min(radius, barHeight);
        // Rounded at the data end, square where it meets the baseline.
        const d =
          barHeight <= 0
            ? ""
            : `M${x},${padTop + plot} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + barWidth - r},${y} Q${x + barWidth},${y} ${x + barWidth},${y + r} L${x + barWidth},${padTop + plot} Z`;
        return (
          <g key={p.label}>
            {d && <path d={d} fill={color} />}
            <rect x={x} y={padTop} width={barWidth} height={plot} fill="transparent">
              <title>{`${p.label}: ${format(p.value)}`}</title>
            </rect>
          </g>
        );
      })}
      <text x="0" y={height - 6} className={AXIS_CLASS}>
        {points[0].label}
      </text>
      <text x={width} y={height - 6} textAnchor="end" className={AXIS_CLASS}>
        {points[points.length - 1].label}
      </text>
    </svg>
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
 * Umami's traffic chart: views as the back bar, visitors in front, and the
 * comparison period as dashed lines. Hover shows every value for that bucket.
 */
export function StackedBarsChart({
  points,
  height = 260,
  className,
  summary,
  primaryLabel,
  secondaryLabel,
  comparisonLabel,
  format = (v) => String(v),
}: {
  points: StackedPoint[];
  height?: number;
  className?: string;
  summary: string;
  primaryLabel: string;
  secondaryLabel: string;
  comparisonLabel?: string;
  format?: (value: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 720;
  const padStart = 44;
  const padEnd = 12;
  const padTop = 12;
  const padBottom = 24;
  const plotW = width - padStart - padEnd;
  const plotH = height - padTop - padBottom;

  const values = points.flatMap((p) => [p.primary, p.comparisonPrimary ?? 0]);
  if (points.length === 0 || values.every((v) => v === 0)) {
    return <EmptyPlot height={height} className={className} label={summary} />;
  }
  const max = Math.max(...values, 1);
  const slot = plotW / points.length;
  const barW = Math.max(2, slot * 0.6);
  const x = (i: number) => padStart + i * slot + (slot - barW) / 2;
  const cx = (i: number) => padStart + i * slot + slot / 2;
  const y = (v: number) => padTop + plotH - (v / max) * plotH;
  const hasComparison = points.some((p) => p.comparisonPrimary !== null && p.comparisonPrimary !== undefined);
  const linePath = (pick: (p: StackedPoint) => number | null | undefined) =>
    points
      .map((p, i) => {
        const v = pick(p);
        return v === null || v === undefined ? null : `${i === 0 ? "M" : "L"}${cx(i).toFixed(1)},${y(v).toFixed(1)}`;
      })
      .filter(Boolean)
      .join(" ");
  const last = points.length - 1;
  const ticks = [0, Math.floor(last / 4), Math.floor(last / 2), Math.floor((3 * last) / 4), last].filter((v, i, a) => a.indexOf(v) === i);
  const point = hover === null ? null : points[hover];
  const tipStart = hover !== null && hover > last / 2;

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={summary}
        preserveAspectRatio="none"
        onMouseMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const px = ((event.clientX - box.left) / box.width) * width - padStart;
          setHover(Math.min(last, Math.max(0, Math.floor(px / slot))));
        }}
        onMouseLeave={() => setHover(null)}
      >
        {[0, 0.5, 1].map((g) => (
          <g key={g}>
            <line x1={padStart} x2={width - padEnd} y1={y(max * g)} y2={y(max * g)} stroke="var(--color-line)" strokeWidth="1" strokeDasharray={g === 0 ? undefined : "2 4"} />
            <text x={padStart - 6} y={y(max * g) + 3} textAnchor="end" className={AXIS_CLASS}>
              {format(Math.round(max * g))}
            </text>
          </g>
        ))}
        {points.map((p, i) => (
          <g key={p.label}>
            <rect x={x(i)} y={y(p.primary)} width={barW} height={Math.max(0, padTop + plotH - y(p.primary))} rx="2" fill="var(--color-primary)" fillOpacity={hover === i ? 0.35 : 0.25} />
            <rect x={x(i)} y={y(p.secondary)} width={barW} height={Math.max(0, padTop + plotH - y(p.secondary))} rx="2" fill="var(--color-primary)" fillOpacity={hover === i ? 1 : 0.85} />
          </g>
        ))}
        {hasComparison && (
          <>
            <path d={linePath((p) => p.comparisonPrimary)} fill="none" stroke="var(--color-line-strong)" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            <path d={linePath((p) => p.comparisonSecondary)} fill="none" stroke="var(--color-ink-soft)" strokeWidth="1.5" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
          </>
        )}
        {ticks.map((i) => (
          <text key={i} x={cx(i)} y={height - 6} textAnchor="middle" className={AXIS_CLASS}>
            {points[i].label}
          </text>
        ))}
      </svg>
      {point && (
        <div
          className={cn(
            "pointer-events-none absolute top-2 z-10 min-w-44 rounded-[0.5rem] border border-line bg-paper-raised p-2.5 text-xs shadow-md",
            tipStart ? "start-12" : "end-3"
          )}
          dir="auto"
        >
          <p className="mb-1.5 font-medium text-ink">{point.label}</p>
          <p className="flex items-center justify-between gap-4">
            <span className="text-ink-soft">{primaryLabel}</span>
            <span className="tabular-nums font-medium text-ink">{format(point.primary)}</span>
          </p>
          <p className="mt-0.5 flex items-center justify-between gap-4">
            <span className="text-ink-soft">{secondaryLabel}</span>
            <span className="tabular-nums font-medium text-ink">{format(point.secondary)}</span>
          </p>
          {hasComparison && comparisonLabel && (
            <p className="mt-1 flex items-center justify-between gap-4 border-t border-line pt-1">
              <span className="text-ink-soft">{comparisonLabel}</span>
              <span className="tabular-nums text-ink-soft">
                {format(point.comparisonPrimary ?? 0)} / {format(point.comparisonSecondary ?? 0)}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export interface HBarRow {
  label: string;
  value: number;
  /** Small line under the label, e.g. "12 units · EGP 3,400". */
  caption?: string;
}

/**
 * Ranked rows — order status, top products. Not an SVG: it is a list with a
 * proportional track behind each row, so every value is also plain text and
 * the whole thing reads as a table without a chart-specific fallback.
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
      {rows.map((row) => (
        <li key={row.label}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm text-ink" dir="auto">
              {row.label}
            </span>
            <span className="tabular-nums shrink-0 text-sm font-medium text-ink">
              <bdi dir="ltr">{format ? format(row.value) : row.value}</bdi>
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-paper">
            <div
              className="h-full rounded-full bg-primary"
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
function EmptyPlot({
  height,
  className,
  label,
}: {
  height: number;
  className?: string;
  label: string;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      style={{ height }}
      className={cn(
        "flex items-center justify-center rounded-[0.5rem] border border-dashed border-line text-xs text-ink-soft",
        className
      )}
    >
      {label}
    </div>
  );
}
