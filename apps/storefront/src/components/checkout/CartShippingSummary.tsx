"use client";

import { useId, useState } from "react";
import type { Cart } from "@store-builder/api-client";
import { useTweenedNumber } from "@store-builder/ui/cart-rewards";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { GOVERNORATES } from "@/lib/egypt";
import { useShipTo } from "@/lib/shipTo";
import { useStore } from "@/lib/StoreContext";
import { useShippingQuote } from "@/lib/useShippingQuote";
import { cartQuoteLines } from "@/lib/combos";
import { useStoreCountry } from "@/lib/storeCountry";
import { CART_REWARDS_ENABLED } from "@/lib/features";
import { cartTotal } from "@/lib/cartRewards";
import { input } from "@/components/ui";
import { AutomaticDiscountRow, RewardDiscountRow } from "@/components/cart/RewardRows";
import { FreeShippingHint, ShippingFee } from "./ShippingFee";
import { arOrEn } from "@/lib/i18n";

/** The cart's quote: the governorate picked here and what the server says these lines cost. */
export function useCartQuote({ workspaceId, cart, enabled = true }: { workspaceId: string; cart: Cart; enabled?: boolean }) {
  const [client] = useState(() => createStorefrontApiClient());
  const [shipTo, setShipTo] = useShipTo(workspaceId);
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
  return { shipping, shipTo, setShipTo };
}

export type CartQuote = ReturnType<typeof useCartQuote>;

/**
 * The money half of the cart (drawer and page): subtotal, shipping, and the
 * total once shipping is known — priced by the same quote the checkout and
 * the order use. The governorate picked here is the one checkout opens with
 * (lib/shipTo), so the shopper sees the real shipping before checkout.
 *
 * A store that prices no shipping keeps the cart exactly as it was:
 * "Calculated at checkout", no governorate picker, no total.
 *
 * With cart rewards on (CART_REWARDS_ENABLED) the quote also says what the
 * reward and the automatic discount take off, and the total is the same sum
 * the checkout makes (lib/cartRewards.cartTotal). `quote`: a quote already
 * asked for by the caller (the cart sheet shares it with the rewards bar).
 */
export function CartShippingSummary({
  workspaceId,
  cart,
  enabled = true,
  quote,
}: {
  workspaceId: string;
  cart: Cart;
  /** false asks the API nothing (a closed drawer). */
  enabled?: boolean;
  quote?: CartQuote;
}) {
  const { t, money, locale } = useStore();
  const own = useCartQuote({ workspaceId, cart, enabled: enabled && !quote });
  const { shipping, shipTo, setShipTo } = quote ?? own;
  const selectId = useId();

  const unpriced = shipping.line.kind === "on_confirmation";
  const known = shipping.line.kind === "amount" || shipping.line.kind === "free";
  const currency = cart.currency;
  const rewards = CART_REWARDS_ENABLED ? shipping.rewards : null;
  const automaticOff = CART_REWARDS_ENABLED ? (shipping.extras.automaticDiscount?.amount ?? 0) : 0;
  const total = CART_REWARDS_ENABLED
    ? cartTotal({ subtotal: Number(cart.subtotal), shipping: shipping.amount, automaticOff, rewards })
    : Number(cart.subtotal) + shipping.amount;
  const shownSubtotal = useTweenedNumber(Number(cart.subtotal));
  const shownTotal = useTweenedNumber(total);
  // A free-shipping reward: the fee it saves, struck through in the shipping row.
  const waivedFee = rewards?.applied?.freeShipping && rewards.shippingFeeAmount ? rewards.shippingFeeAmount : 0;

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

      <dl className={CART_REWARDS_ENABLED ? `space-y-1.5 text-sm transition-opacity duration-200 ${shipping.stale && rewards ? "opacity-70" : ""}` : "space-y-1.5 text-sm"}>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-soft">{t.cart.subtotal}</dt>
          <dd className={CART_REWARDS_ENABLED ? "font-semibold tabular-nums text-ink" : "font-semibold text-ink"}>{money(CART_REWARDS_ENABLED ? shownSubtotal : cart.subtotal, currency)}</dd>
        </div>
        {CART_REWARDS_ENABLED && <RewardDiscountRow rewards={rewards} currency={currency} />}
        {CART_REWARDS_ENABLED && <AutomaticDiscountRow amount={automaticOff} currency={currency} />}
        <div className="flex justify-between gap-3">
          <dt className="text-ink-soft">{t.checkout.shippingFee}</dt>
          <dd className="text-end text-ink-soft">
            {waivedFee > 0 && <s className="me-1.5 tabular-nums text-ink-soft/80">{money(waivedFee, currency)}</s>}
            {unpriced ? t.cart.shippingAtCheckout : <ShippingFee line={shipping.line} currency={currency} />}
          </dd>
        </div>
        {known && (
          <div className="flex justify-between gap-3 border-t border-line pt-2 text-base font-bold text-ink">
            <dt>{t.checkout.totalEstimate}</dt>
            <dd className={CART_REWARDS_ENABLED ? "tabular-nums" : undefined}>{money(CART_REWARDS_ENABLED ? shownTotal : total, currency)}</dd>
          </div>
        )}
      </dl>

      <FreeShippingHint progress={shipping.freeShipping} line={shipping.line} currency={currency} />
    </div>
  );
}
