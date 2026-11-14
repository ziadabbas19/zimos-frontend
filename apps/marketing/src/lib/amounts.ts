import type { CSSProperties } from "react";
import type { Amount } from "@/i18n/dictionary";

/** "−1,250" → 1250: the figure behind a written amount. */
const figure = (amount: Amount) => Number(amount.value.replace(/[^\d.]/g, "")) || 0;

/**
 * A row's bar in the drawings of a sum (the features' profit card, the
 * journey's last step): its share of the whole, as the `--w` its bar reads.
 */
export function shareOf(row: Amount, whole: Amount): CSSProperties {
  const share = figure(whole) ? Math.round((figure(row) / figure(whole)) * 100) : 0;
  return { "--w": `${Math.min(100, share)}%` } as CSSProperties;
}
