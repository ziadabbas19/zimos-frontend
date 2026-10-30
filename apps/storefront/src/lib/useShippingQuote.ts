"use client";

import { storefrontQuoteExtras, storefrontShippingQuoteFor, type StorefrontQuoteExtras } from "@store-builder/api-client";
import { useEffect, useState } from "react";
import type { ApiClient, ComboSelection, FreeShippingProgress, ShippingQuote } from "@store-builder/api-client";
import { provinceFor } from "./orderForm";
import { getVisitorId } from "./visitorId";
import { quotePricesShipping, shippingLineFor, type ShippingLine } from "./shippingLine";
import { quoteOptionsOf, type ShippingOptionChoice } from "./shippingChoice";

const DEBOUNCE_MS = 300;

/**
 * A line to quote: a variant (with its offer), or a whole combo (`comboId` +
 * `comboSelection`, no variant): the server prices a combo as its products at
 * the combo's price, so the weight and the free-shipping threshold are right.
 */
export interface QuoteLine {
  variantId?: string;
  offerId?: string | null;
  quantity: number;
  comboId?: string | null;
  comboSelection?: ComboSelection;
}

export type { ShippingLine };

export interface ShippingQuoteState {
  line: ShippingLine;
  /** What to add to the total: the shown price, else 0. */
  amount: number;
  /** Progress to the store's free-shipping threshold; null when it has none. */
  freeShipping: FreeShippingProgress | null;
  /** The automatic discount, the minimum order and the bundle saving the quote reports. */
  extras: StorefrontQuoteExtras;
  /** The store's shipping options for this cart (standard first); absent or [] = no choice (shippingChoice.ts). */
  options?: ShippingOptionChoice[];
}

/**
 * The shipping line for a checkout form or the cart, from POST /shipping-quote
 * — the same calculation the order is charged by, so the number shown is the
 * number charged.
 *
 * The quote is asked for as soon as there are lines (with or without a
 * governorate), then again whenever the governorate or the lines change. A
 * failed quote falls back to "on confirmation" — it must never block the
 * order. `enabled: false` asks nothing (a closed cart drawer).
 */
export function useShippingQuote({
  client,
  workspaceId,
  governorate,
  country = "EG",
  lines,
  enabled = true,
}: {
  client: ApiClient;
  workspaceId: string;
  /** The governorate code ("" until chosen). */
  governorate: string;
  /** The order's country: the form's, which starts on the store's (lib/storeCountry). */
  country?: string;
  lines: QuoteLine[];
  enabled?: boolean;
}): ShippingQuoteState {
  const province = provinceFor(governorate);
  const items = lines
    .filter((l) => l.quantity > 0)
    .map((l) =>
      l.comboId
        ? { comboId: l.comboId, comboSelection: l.comboSelection ?? [], quantity: l.quantity }
        : { variantId: l.variantId, ...(l.offerId ? { offerId: l.offerId } : {}), quantity: l.quantity }
    );
  // The effect keys on content, not on the fresh array each render.
  const requestKey = JSON.stringify([workspaceId, country, province, items]);
  const active = enabled && items.length > 0;

  const [state, setState] = useState<{ key: string; quote: ShippingQuote | null; failed: boolean } | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      // For this visitor: a product A/B test's price counts, as the order will charge it.
      storefrontShippingQuoteFor(client, workspaceId, { country, governorate: province ?? null, items }, { visitorId: getVisitorId(workspaceId) })
        .then((quote) => {
          if (!cancelled) setState({ key: requestKey, quote, failed: false });
        })
        .catch(() => {
          if (!cancelled) setState({ key: requestKey, quote: null, failed: true });
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, active]);

  const extras = storefrontQuoteExtras(active ? state?.quote : null);
  if (!active) return { line: { kind: "on_confirmation" }, amount: 0, freeShipping: null, extras };
  if (!state) return { line: province ? { kind: "calculating" } : { kind: "pick_governorate" }, amount: 0, freeShipping: null, extras };
  if (state.failed || !state.quote) {
    // A failure for an older request says nothing about this one yet.
    return { line: state.key === requestKey ? { kind: "on_confirmation" } : { kind: "calculating" }, amount: 0, freeShipping: null, extras };
  }

  const line = shippingLineFor(state.quote, { hasGovernorate: Boolean(province), fresh: state.key === requestKey });
  const freeShipping = quotePricesShipping(state.quote) ? (state.quote.freeShipping ?? null) : null;
  const options = line.kind === "amount" || line.kind === "free" ? quoteOptionsOf(state.quote) : [];
  return { line, amount: line.kind === "amount" ? line.amount : 0, freeShipping, extras, options };
}
