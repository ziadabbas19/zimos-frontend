import type { SettlementLine } from "@store-builder/api-client";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    applied: "Added to order",
    less: "The order was already paid or cancelled before confirming, so only what it still owed was added",
  },
  ar: {
    applied: "سُجّل على الطلب",
    less: "كان الطلب مدفوعًا أو ملغيًا قبل التأكيد، فسُجّل الباقي فقط",
  },
} satisfies Messages;

/** What a confirmed settlement's line really added to its order. Null while the settlement is a draft. */
type AppliedLine = SettlementLine & { appliedAmount?: number | null };

/**
 * "Recorded on the order" under a settlement line's amounts, with the reason when
 * the order took less than the courier collected. Nothing for a draft.
 */
export function AppliedAmount({ line, money }: { line: SettlementLine; money: (minor: number) => string }) {
  const t = useT(STRINGS);
  const applied = (line as AppliedLine).appliedAmount;
  if (applied === null || applied === undefined) return null;
  const less = applied < line.collectedAmount;
  return (
    <p data-slot="settlement-applied" className="text-xs leading-5 text-ink-soft tabular-nums">
      {t.applied}{" "}
      <bdi dir="ltr" className={less ? "font-medium text-ink" : undefined}>
        {money(applied)}
      </bdi>
    </p>
  );
}

/** The muted note for a line that added less than was collected; full width, under the row. */
export function AppliedLessNote({ line }: { line: SettlementLine }) {
  const t = useT(STRINGS);
  const applied = (line as AppliedLine).appliedAmount;
  if (applied === null || applied === undefined || applied >= line.collectedAmount) return null;
  return (
    <p data-slot="settlement-applied-note" className="mt-0.5 text-xs leading-5 text-ink-soft">
      {t.less}
    </p>
  );
}
