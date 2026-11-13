"use client";

import type { ReactNode } from "react";
import type { Cart } from "@store-builder/api-client";
import { CartRewardsBar } from "@store-builder/ui/cart-rewards";
import { barTiers, rewardsLocale, useCartRewardsConfig } from "@/lib/cartRewards";
import { cartSheetOf } from "@/lib/cartSheet";
import { useStore } from "@/lib/StoreContext";
import { CartShippingSummary, useCartQuote } from "@/components/checkout/CartShippingSummary";
import { SavedBanner } from "./RewardRows";

/**
 * The cart page's money, from one quote: the rewards bar, for a store whose
 * cart rewards are on, which the page puts at the top of the cart above the
 * lines (`bar`, null otherwise); and the summary — "you saved" (compare-at
 * prices and bundles, plus the reward and the code with rewards) over the
 * totals (`summary`).
 */
export function CartPageMoney({ workspaceId, cart, children }: { workspaceId: string; cart: Cart; children: (parts: { bar: ReactNode; summary: ReactNode }) => ReactNode }) {
  const { locale, money, store } = useStore();
  const config = useCartRewardsConfig(workspaceId);
  const quote = useCartQuote({ workspaceId, cart });
  const rewards = quote.shipping.rewards;
  const bar =
    config && config.tiers.length > 0 ? (
      <CartRewardsBar
        tiers={barTiers(config, rewards)}
        subtotal={Number(cart.subtotal)}
        applied={rewards?.applied ?? null}
        notes={rewards?.notes ?? []}
        locale={rewardsLocale(locale)}
        formatMoney={(n) => money(n, cart.currency)}
        loading={!rewards && quote.shipping.stale}
        appearance={config.appearance}
        speed={cartSheetOf(store).speed}
        className="mb-4"
      />
    ) : null;
  const summary = (
    <div className="space-y-4">
      <SavedBanner rewards={rewards} lineSavings={quote.shipping.lineSavings} currency={cart.currency} />
      <CartShippingSummary workspaceId={workspaceId} cart={cart} quote={quote} />
    </div>
  );
  return <>{children({ bar, summary })}</>;
}
