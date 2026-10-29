"use client";

import { useId, useState } from "react";
import type { Cart } from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { GOVERNORATES } from "@/lib/egypt";
import { useShipTo } from "@/lib/shipTo";
import { useStore } from "@/lib/StoreContext";
import { useShippingQuote } from "@/lib/useShippingQuote";
import { cartQuoteLines } from "@/lib/combos";
import { useStoreCountry } from "@/lib/storeCountry";
import { input } from "@/components/ui";
import { FreeShippingHint, ShippingFee } from "./ShippingFee";
import { arOrEn } from "@/lib/i18n";

/**
 * The money half of the cart (drawer and page): subtotal, shipping, and the
 * total once shipping is known — priced by the same quote the checkout and
 * the order use. The governorate picked here is the one checkout opens with
 * (lib/shipTo), so the shopper sees the real shipping before checkout.
 *
 * A store that prices no shipping keeps the cart exactly as it was:
 * "Calculated at checkout", no governorate picker, no total.
 */
export function CartShippingSummary({
  workspaceId,
  cart,
  enabled = true,
}: {
  workspaceId: string;
  cart: Cart;
  /** false asks the API nothing (a closed drawer). */
  enabled?: boolean;
}) {
  const { t, money, locale } = useStore();
  const [client] = useState(() => createStorefrontApiClient());
  const [shipTo, setShipTo] = useShipTo(workspaceId);
  const selectId = useId();
  const country = useStoreCountry();
  const shipping = useShippingQuote({
    client,
    workspaceId,
    governorate: shipTo,
    country,
    // A combo line is quoted as its combo, not its first product (lib/combos).
    lines: cartQuoteLines(cart.items),
    enabled,
  });

  const unpriced = shipping.line.kind === "on_confirmation";
  const known = shipping.line.kind === "amount" || shipping.line.kind === "free";
  const currency = cart.currency;

  return (
    <div className="space-y-3">
      {!unpriced && (
        <div className="flex items-center gap-2">
          <label htmlFor={selectId} className="shrink-0 text-sm text-ink-soft">
            {t.cart.shipTo}
          </label>
          <select
            id={selectId}
            value={shipTo}
            onChange={(e) => setShipTo(e.target.value)}
            // 16px like every other field: anything smaller makes iOS zoom in on focus.
            className={`${input} min-w-0 cursor-pointer py-1.5`}
          >
            <option value="">{t.cart.shipToPlaceholder}</option>
            {GOVERNORATES.map((g) => (
              <option key={g.code} value={g.code}>
                {g[arOrEn(locale)]}
              </option>
            ))}
          </select>
        </div>
      )}

      <dl className="space-y-1.5 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-soft">{t.cart.subtotal}</dt>
          <dd className="font-semibold text-ink">{money(cart.subtotal, currency)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-soft">{t.checkout.shippingFee}</dt>
          <dd className="text-end text-ink-soft">
            {unpriced ? t.cart.shippingAtCheckout : <ShippingFee line={shipping.line} currency={currency} />}
          </dd>
        </div>
        {known && (
          <div className="flex justify-between gap-3 border-t border-line pt-2 text-base font-bold text-ink">
            <dt>{t.checkout.totalEstimate}</dt>
            <dd>{money(Number(cart.subtotal) + shipping.amount, currency)}</dd>
          </div>
        )}
      </dl>

      <FreeShippingHint progress={shipping.freeShipping} line={shipping.line} currency={currency} />
    </div>
  );
}
