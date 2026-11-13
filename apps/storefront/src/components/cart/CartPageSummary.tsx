"use client";

import type { Cart } from "@store-builder/api-client";
import { CartRewardsBar } from "@store-builder/ui/cart-rewards";
import { CART_REWARDS_ENABLED } from "@/lib/features";
import { barTiers, rewardsLocale, useCartRewardsConfig } from "@/lib/cartRewards";
import { useStore } from "@/lib/StoreContext";
import { CartShippingSummary, useCartQuote } from "@/components/checkout/CartShippingSummary";
import { SavedBanner } from "./RewardRows";

/**
 * The cart page's money: the rewards bar and "you saved" over the totals for
 * a store with cart rewards (one quote shared by the three, as in the cart
 * sheet), the totals alone — exactly as before — otherwise.
 */
export function CartPageSummary({ workspaceId, cart }: { workspaceId: string; cart: Cart }) {
  const config = useCartRewardsConfig(CART_REWARDS_ENABLED ? workspaceId : undefined);
  if (!CART_REWARDS_ENABLED || !config) return <CartShippingSummary workspaceId={workspaceId} cart={cart} />;
  return <WithRewards workspaceId={workspaceId} cart={cart} config={config} />;
}

function WithRewards({ workspaceId, cart, config }: { workspaceId: string; cart: Cart; config: NonNullable<ReturnType<typeof useCartRewardsConfig>> }) {
  const { locale, money } = useStore();
  const quote = useCartQuote({ workspaceId, cart });
  const rewards = quote.shipping.rewards;
  return (
    <div className="space-y-4">
      <CartRewardsBar
        tiers={barTiers(config, rewards)}
        subtotal={Number(cart.subtotal)}
        applied={rewards?.applied ?? null}
        notes={rewards?.notes ?? []}
        locale={rewardsLocale(locale)}
        formatMoney={(n) => money(n, cart.currency)}
        loading={!rewards && quote.shipping.stale}
      />
      <SavedBanner rewards={rewards} currency={cart.currency} />
      <CartShippingSummary workspaceId={workspaceId} cart={cart} quote={quote} />
    </div>
  );
}
