"use client";

import type { CartLine } from "@store-builder/api-client";
import { useStore } from "@/lib/StoreContext";
import { variantLabel } from "@/lib/product";
import { comboLineFullTotal } from "@/lib/combos";
import { StoreImage } from "../StoreImage";
import { comboText } from "./comboText";

/**
 * A cart line holding a whole combo (lib/combos), as the cart page, the cart
 * drawer and the checkout summary show it: the combo's name with a "Combo"
 * badge and its products (name × quantity, the variant), or — when the
 * server can no longer sell it — the request to remove it.
 */
export function ComboLineInfo({ line }: { line: CartLine }) {
  const { locale } = useStore();
  const text = comboText(locale);
  return (
    <>
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="line-clamp-2 text-sm font-semibold text-ink">{line.combo?.name ?? text.badge}</span>
        <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold leading-4 text-primary">{text.badge}</span>
      </span>
      {line.unavailable ? (
        <span className="mt-1 block text-xs font-medium text-danger">{text.lineUnavailable}</span>
      ) : (
        <span className="mt-0.5 block space-y-0.5 text-xs text-ink-soft">
          {(line.combo?.items ?? []).map((item) => {
            const label = variantLabel(item);
            return (
              <span key={item.itemId} className="block">
                {item.productName} × {item.quantity}
                {label && ` · ${label}`}
              </span>
            );
          })}
        </span>
      )}
    </>
  );
}

/** The combo's products bought apart, struck through beside the line's total, when that is more. */
export function ComboLineFullTotal({ line, currency, className = "" }: { line: CartLine; currency?: string; className?: string }) {
  const { locale, money } = useStore();
  const full = comboLineFullTotal(line);
  if (full === null) return null;
  return (
    <span className={`text-xs text-ink-soft line-through ${className}`}>
      <span className="sr-only">{comboText(locale).separately} </span>
      {money(full, currency)}
    </span>
  );
}

/** Up to two of the combo's product pictures side by side, filling the line's square. */
export function ComboLineThumb({ images }: { images: string[] }) {
  return (
    <div className="flex h-full w-full gap-px bg-line">
      {images.map((src) => (
        <StoreImage
          key={src}
          src={src}
          alt=""
          width={80}
          height={80}
          sizes="80px"
          loading="lazy"
          decoding="async"
          className="h-full min-w-0 flex-1 bg-paper object-cover"
        />
      ))}
    </div>
  );
}
