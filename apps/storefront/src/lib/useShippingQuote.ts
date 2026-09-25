"use client";

import { useEffect, useState } from "react";
import type { ApiClient, ShippingQuote } from "@store-builder/api-client";
import { provinceFor } from "./orderForm";

const DEBOUNCE_MS = 300;

export interface QuoteLine {
  variantId: string;
  offerId?: string | null;
  quantity: number;
}

export type ShippingLine =
  /** Price shown and added to the total. */
  | { kind: "amount"; amount: number }
  /** Tier-priced store, no governorate chosen yet. */
  | { kind: "pick_governorate" }
  | { kind: "calculating" }
  /** Rate-priced store (or the quote failed): the old "confirmed on the call" line. */
  | { kind: "on_confirmation" };

/**
 * The shipping line for a checkout form, from POST /shipping-quote.
 *
 * Only a store that prices by weight tier gets a price here; a rate-priced
 * store keeps the "confirmed when we call you" line it always had. The quote
 * is asked for as soon as there are lines (without a governorate) so the
 * form knows which of the two it is, then again whenever the governorate or
 * the lines change. A failed quote falls back to "on confirmation" — it must
 * never block the order.
 */
export function useShippingQuote({
  client,
  workspaceId,
  governorate,
  lines,
}: {
  client: ApiClient;
  workspaceId: string;
  /** The form's governorate code ("" until chosen). */
  governorate: string;
  lines: QuoteLine[];
}): { line: ShippingLine; amount: number } {
  const province = provinceFor(governorate);
  const items = lines
    .filter((l) => l.quantity > 0)
    .map((l) => ({ variantId: l.variantId, ...(l.offerId ? { offerId: l.offerId } : {}), quantity: l.quantity }));
  // The effect keys on content, not on the fresh array each render.
  const requestKey = JSON.stringify([workspaceId, province, items]);

  const [state, setState] = useState<{ key: string; quote: ShippingQuote | null; failed: boolean } | null>(null);

  useEffect(() => {
    if (items.length === 0) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      client
        .getShippingQuote(workspaceId, { country: "EG", governorate: province ?? null, items })
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
  }, [requestKey]);

  if (items.length === 0 || !state) return { line: { kind: "on_confirmation" }, amount: 0 };
  if (state.failed || !state.quote || state.quote.pricingMode !== "weight_tiers") {
    return { line: { kind: "on_confirmation" }, amount: 0 };
  }
  if (!province) return { line: { kind: "pick_governorate" }, amount: 0 };
  // The last answer was for another governorate or basket: a new one is on its way.
  if (state.key !== requestKey) return { line: { kind: "calculating" }, amount: 0 };
  return { line: { kind: "amount", amount: state.quote.amount }, amount: state.quote.amount };
}
