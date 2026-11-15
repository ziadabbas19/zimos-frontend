/**
 * The colour a chart takes (components/charts.tsx), and the colour of a
 * change's arrow beside a figure: blue for news that is good (or not bad),
 * red for bad — the owner's rule, after Shopify (2026-11-15).
 */
export type ChartTone = "good" | "bad";

/**
 * Which way a change reads. `change` is signed (now minus before, or a
 * percentage of it); a rise is good unless `lowerIsBetter` (bounce rate,
 * returns, refunds). No change, or nothing to compare with, reads as good.
 */
export function toneOf(change: number | null | undefined, lowerIsBetter = false): ChartTone {
  if (change === null || change === undefined || !Number.isFinite(change) || change === 0) return "good";
  return change > 0 !== lowerIsBetter ? "good" : "bad";
}
