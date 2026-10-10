import { useId, useState } from "react";
import type { DiscountType } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { IconBag, IconCaretDown, IconTag } from "@/components/icons";
import { formatMoney, formatPercent, majorToMinor, percentToBasisPoints } from "@/lib/format";
import { fmt, useT } from "@/i18n/LocaleContext";
import { DISCOUNT_STRINGS } from "./discountModel";

/** The sample basket, in minor units: one product at 250, shipping at 50. Illustration only. */
const SAMPLE_SUBTOTAL = 25_000;
const SAMPLE_SHIPPING = 5_000;

export interface DiscountPreviewValues {
  code: string;
  type: DiscountType;
  /** As typed in the form: a percent ("20") or an amount in major units ("50"). */
  value: string;
  /** As typed, major units; "" for none. */
  minimumSubtotal: string;
  specificProducts: boolean;
}

interface Worked {
  /** Minor units taken off the sample subtotal; null when the form does not say yet, or the type has no figure. */
  discount: number | null;
  /** The words of the discount line: «خصم ٢٠٪». */
  label: string | null;
  shipping: number;
  total: number;
  /** The typed minimum, when the sample cart is under it. */
  belowMinimum: number | null;
}

/**
 * The sample cart with the form's discount on it. This is arithmetic for a
 * picture — the storefront and the server price a real order; nothing here is
 * sent anywhere.
 */
function work(values: DiscountPreviewValues, percentLine: string, fixedLine: string): Worked {
  const minimum = majorToMinor(values.minimumSubtotal);
  const belowMinimum = Number.isFinite(minimum) && minimum > SAMPLE_SUBTOTAL ? minimum : null;
  let discount: number | null = null;
  let label: string | null = null;
  let shipping = SAMPLE_SHIPPING;

  if (belowMinimum === null) {
    if (values.type === "percentage") {
      const points = percentToBasisPoints(values.value);
      if (Number.isFinite(points) && points >= 0 && points <= 10_000) {
        discount = Math.round((SAMPLE_SUBTOTAL * points) / 10_000);
        label = fmt(percentLine, { percent: formatPercent(points) });
      }
    } else if (values.type === "fixed") {
      const amount = majorToMinor(values.value);
      if (Number.isFinite(amount) && amount >= 0) {
        discount = Math.min(amount, SAMPLE_SUBTOTAL);
        label = fixedLine;
      }
    } else if (values.type === "free_shipping") {
      shipping = 0;
    }
  }

  return { discount, label, shipping, total: SAMPLE_SUBTOTAL - (discount ?? 0) + shipping, belowMinimum };
}

/**
 * The discount as the shopper meets it: a small mock of the storefront's cart
 * summary — one sample line, the code chip, the discount line, shipping and
 * the new total — redrawn as the form changes. It says on its face that it is
 * an example on a 250 cart; the real pricing stays the server's.
 *
 * Beside the form from md up. On a phone it comes first, folded to one slim
 * strip (the code and the new total) that stays in view while the form scrolls
 * and opens the whole summary on a tap.
 *
 * It looks like the store, not like the dashboard: solid "paper", no glass
 * (glass/offers.css, `.zimos-offer-paper`).
 */
export function DiscountPreview({ values, currency }: { values: DiscountPreviewValues; currency: string }) {
  const t = useT(DISCOUNT_STRINGS);
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const worked = work(values, t.previewPercentLine, t.previewFixedLine);
  const money = (minor: number) => formatMoney(minor, currency);
  const code = values.code.trim().toUpperCase();
  const changed = worked.total !== SAMPLE_SUBTOTAL + SAMPLE_SHIPPING;
  const row = "flex items-baseline justify-between gap-3";

  return (
    <aside
      aria-label={t.previewTitle}
      data-slot="offer-preview"
      className="zimos-offer-paper overflow-hidden rounded-[1.25rem] bg-paper-raised text-ink shadow-[var(--shadow-raised)] ring-1 ring-line md:shadow-[var(--shadow-card)]"
    >
      {/* The phone's strip: what matters in one line, and the way into the rest. */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? t.previewHide : t.previewShow}
        onClick={() => setOpen((was) => !was)}
        className="flex min-h-12 w-full cursor-pointer items-center gap-2.5 px-3.5 py-2 text-start focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary md:hidden"
      >
        <span className="zimos-offer-code inline-flex h-7 max-w-[45%] shrink-0 items-center gap-1.5 rounded-full bg-primary-soft px-2.5 text-xs font-semibold text-primary-dark dark:text-primary">
          <IconTag className="size-3.5 shrink-0" aria-hidden />
          <bdi dir={code ? "ltr" : undefined} className="min-w-0 truncate">
            {code || t.previewAutomatic}
          </bdi>
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-ink-soft">
          {changed && (
            <s className="me-1.5 tabular-nums">
              <bdi>{money(SAMPLE_SUBTOTAL + SAMPLE_SHIPPING)}</bdi>
            </s>
          )}
          <span className="font-semibold text-ink tabular-nums">
            <bdi>{fmt(t.previewTotalShort, { amount: money(worked.total) })}</bdi>
          </span>
        </span>
        <IconCaretDown
          className={cn(
            "size-4 shrink-0 text-ink-soft transition-[rotate] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      <div id={panelId} className={cn("border-t border-line px-4 pt-3 pb-4 md:block md:border-t-0 md:pt-4", !open && "max-md:hidden")}>
        <p className="text-[13px] leading-5 font-semibold text-ink">{t.previewTitle}</p>
        <p className="text-xs leading-5 text-ink-soft">
          <bdi>{fmt(t.previewSample, { amount: money(SAMPLE_SUBTOTAL) })}</bdi>
        </p>

        {/* The one sample line. The thumbnail's box is fixed, so nothing moves around it. */}
        <div className="mt-3 flex items-center gap-3">
          <span className="zimos-offer-thumb flex size-11 shrink-0 items-center justify-center rounded-[0.75rem] bg-paper-sunken text-ink-soft">
            <IconBag className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">{t.previewProduct}</span>
            <span className="block text-xs text-ink-soft tabular-nums">{fmt(t.previewQty, { n: 1 })}</span>
          </span>
          <span className="shrink-0 text-sm font-semibold text-ink tabular-nums">
            <bdi>{money(SAMPLE_SUBTOTAL)}</bdi>
          </span>
        </div>

        <div className="mt-3 flex">
          <span className="zimos-offer-code inline-flex h-8 max-w-full items-center gap-1.5 rounded-full bg-primary-soft px-3 text-[13px] font-semibold text-primary-dark dark:text-primary">
            <IconTag className="size-4 shrink-0" aria-hidden />
            <bdi dir={code ? "ltr" : undefined} className="min-w-0 truncate">
              {code || t.previewAutomatic}
            </bdi>
          </span>
        </div>

        <dl className="mt-3 space-y-1.5 border-t border-dashed border-line pt-3 text-sm">
          <div className={row}>
            <dt className="text-ink-soft">{t.previewSubtotal}</dt>
            <dd className="text-ink tabular-nums">
              <bdi>{money(SAMPLE_SUBTOTAL)}</bdi>
            </dd>
          </div>
          {worked.discount !== null && worked.label && (
            <div className={cn(row, "font-medium text-success")}>
              <dt>{worked.label}</dt>
              <dd className="tabular-nums">
                <bdi>{fmt(t.previewMinus, { amount: money(worked.discount) })}</bdi>
              </dd>
            </div>
          )}
          <div className={row}>
            <dt className="text-ink-soft">{t.previewShipping}</dt>
            {worked.shipping === 0 ? (
              <dd className="font-medium text-success">{t.previewFreeShipping}</dd>
            ) : (
              <dd className="text-ink tabular-nums">
                <bdi>{money(worked.shipping)}</bdi>
              </dd>
            )}
          </div>
          <div className={cn(row, "border-t border-line pt-2 text-base font-semibold text-ink")}>
            <dt>{t.previewTotal}</dt>
            <dd className="tabular-nums">
              {changed && (
                <s className="me-2 text-sm font-normal text-ink-soft">
                  <bdi>{money(SAMPLE_SUBTOTAL + SAMPLE_SHIPPING)}</bdi>
                </s>
              )}
              <bdi>{money(worked.total)}</bdi>
            </dd>
          </div>
        </dl>

        {/* What the picture cannot show, in words. */}
        <div className="mt-3 space-y-1 text-xs leading-5 text-ink-soft">
          {worked.belowMinimum !== null && (
            <p className="font-medium text-accent-dark">
              <bdi>{fmt(t.previewBelowMinimum, { amount: money(worked.belowMinimum) })}</bdi>
            </p>
          )}
          {worked.belowMinimum === null && (values.type === "percentage" || values.type === "fixed") && worked.discount === null && (
            <p>{t.previewNoValue}</p>
          )}
          {values.type === "buy_x_get_y" && <p>{t.previewBuyXGetY}</p>}
          {values.specificProducts && <p>{t.previewSpecific}</p>}
          <p>{t.previewDisclaimer}</p>
        </div>
      </div>
    </aside>
  );
}
