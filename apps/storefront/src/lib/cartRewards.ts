"use client";

import { useEffect, useState } from "react";
import { storefrontCartRewards, type CartRewardsQuote, type StorefrontCartRewards } from "@store-builder/api-client";
import type { RewardTier } from "@store-builder/ui/cart-rewards";
import { createStorefrontApiClient } from "./apiClient";
import { CART_REWARDS_ENABLED } from "./features";
import type { Locale } from "./i18n";

/**
 * The store side of cart rewards (CART_REWARDS_ENABLED; backend
 * modules/cartRewards). The server prices everything: the quote's `rewards`
 * says what is applied and what the shopper saves, and the order is charged
 * by the same function. What lives here is only:
 *
 *  - the store's tiers, the bar's look and its icons (GET /store/:id/cart-rewards),
 *    read once per store and kept for the visit (the trust lines reach every
 *    store's cart sheet with the store itself, lib/cartSheet);
 *  - `cartTotal`, the one sum the cart drawer, the cart page and the checkout
 *    make of the quote's numbers, so the three never disagree.
 */

/** The store's config: undefined while asked for, null when rewards are off for it (or the flag is). */
export type CartRewardsConfig = StorefrontCartRewards | null | undefined;

const configs = new Map<string, Promise<StorefrontCartRewards | null>>();
const settled = new Map<string, StorefrontCartRewards | null>();

function loadConfig(workspaceId: string): Promise<StorefrontCartRewards | null> {
  let pending = configs.get(workspaceId);
  if (!pending) {
    // A refused or failed request (the API without the feature answers 404) means no rewards, never a broken cart.
    pending = storefrontCartRewards(createStorefrontApiClient(), workspaceId)
      .then((config) => (config && config.tiers.length > 0 ? config : null))
      .catch(() => null)
      .then((config) => {
        settled.set(workspaceId, config);
        return config;
      });
    configs.set(workspaceId, pending);
  }
  return pending;
}

/** For tests: forget what was read. */
export function forgetCartRewardsConfigs() {
  configs.clear();
  settled.clear();
}

export function useCartRewardsConfig(workspaceId: string | undefined): CartRewardsConfig {
  const known = workspaceId ? settled.get(workspaceId) : null;
  const [config, setConfig] = useState<CartRewardsConfig>(() => (!CART_REWARDS_ENABLED || !workspaceId ? null : known));
  useEffect(() => {
    if (!CART_REWARDS_ENABLED || !workspaceId) return;
    let live = true;
    loadConfig(workspaceId).then((value) => {
      if (live) setConfig(value);
    });
    return () => {
      live = false;
    };
  }, [workspaceId]);
  return config;
}

/** The bar's language: Arabic, else English (French reads English, like every component's own strings). */
export const rewardsLocale = (locale: Locale): "ar" | "en" => (locale === "ar" ? "ar" : "en");

/** The tiers as the bar draws them: the quote's when there is one (named by the server), else the config's. */
export function barTiers(config: StorefrontCartRewards | null | undefined, rewards: CartRewardsQuote | null): RewardTier[] {
  const source = rewards?.tiers ?? config?.tiers ?? [];
  return source.map((tier) => ({ thresholdAmount: tier.thresholdAmount, type: tier.type, value: tier.value, label: tier.label, icon: tier.icon ?? null }));
}

export interface CartTotalInput {
  /** The items, as the server priced them. */
  subtotal: number;
  /** What the delivery costs the shopper (already 0 when a reward or a rule ships it free). */
  shipping: number;
  /** The checkout's add-ons that are not cart lines (the order bump, gift wrap). */
  extras?: number;
  /** The store's automatic discount the quote says the order gets (0 with a code typed: the server settles the code). */
  automaticOff?: number;
  /** The quote's `rewards`, or null. */
  rewards?: CartRewardsQuote | null;
}

/** The estimated total, the same sum in the drawer, the cart page and the checkout. */
export function cartTotal({ subtotal, shipping, extras = 0, automaticOff = 0, rewards = null }: CartTotalInput): number {
  return Number(subtotal) + extras + shipping - automaticOff - (rewards ? rewards.discountAmount : 0);
}
