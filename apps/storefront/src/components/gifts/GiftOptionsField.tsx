"use client";

import { useEffect, useId, useState } from "react";
import {
  checkoutGiftProblemOf,
  parseMoney,
  storeGiftOptionsOf,
  type ApiClient,
  type GiftCheckoutFields,
  type StoreGiftOptions,
} from "@store-builder/api-client";
import { GIFT_OPTIONS_ENABLED } from "@/lib/features";
import { useStore } from "@/lib/StoreContext";
import { GiftIcon } from "../Icons";
import { card, input } from "../ui";
import { StoreImage } from "@/components/StoreImage";

/**
 * The checkout's gift choice: "Is this a gift?", then the
 * store's gift wrap at its price, a message with a counter, and "hide the
 * prices in the parcel". The store's offer is read fresh (GET /store/:ws
 * `giftOptions`, null when off), so a store that turns it off stops showing
 * it at once. The wrap is a line the server adds at its own price; its price
 * joins the estimated total here only for display.
 */
export function useGiftChoice({ client, workspaceId }: { client: ApiClient; workspaceId: string }) {
  const { t } = useStore();
  const copy = t.giftWrap;
  const [options, setOptions] = useState<StoreGiftOptions | null>(null);
  const [on, setOn] = useState(false);
  const [wrap, setWrap] = useState(false);
  const [message, setMessage] = useState("");
  const [hidePrices, setHidePrices] = useState(true);

  useEffect(() => {
    // Off (lib/features): the store is not asked, so there is no gift block and nothing is sent.
    if (!GIFT_OPTIONS_ENABLED) return;
    let cancelled = false;
    client
      .getStorefrontMeta(workspaceId)
      .then((meta) => {
        if (!cancelled) setOptions(storeGiftOptionsOf(meta));
      })
      .catch(() => {
        /* no gift block: the checkout works as before */
      });
    return () => {
      cancelled = true;
    };
  }, [client, workspaceId]);

  const offer = options?.wrap ?? null;
  const wrapped = Boolean(on && wrap && offer);
  const text = message.trim().slice(0, options?.messageMaxLength ?? 0);
  const payload: GiftCheckoutFields =
    on && options && (wrapped || text || hidePrices)
      ? { gift: { ...(wrapped ? { wrap: true as const } : {}), ...(text ? { message: text } : {}), ...(hidePrices ? { hidePrices: true as const } : {}) } }
      : {};

  /** After a refused order: the shopper's words for a gift refusal, or null when it was something else. */
  function onError(err: unknown): string | null {
    const problem = checkoutGiftProblemOf(err);
    if (problem === "not_offered") {
      setOptions(null);
      setOn(false);
      return copy.notOffered;
    }
    if (problem === "wrap_unavailable") {
      setWrap(false);
      setOptions((current) => (current ? { ...current, wrap: null } : current));
      return copy.wrapGone;
    }
    if (problem === "message_too_long") return copy.tooLong(options?.messageMaxLength ?? 0);
    return null;
  }

  return {
    options,
    on,
    setOn,
    wrap,
    setWrap,
    message,
    setMessage,
    hidePrices,
    setHidePrices,
    payload,
    /** What the wrap adds to the estimated total (minor units); 0 without it. */
    wrapAmount: wrapped && offer ? parseMoney(offer.priceAmount) : 0,
    /** The wrap as a shipping-quote line, so the parcel's weight counts it. */
    quoteLine: wrapped && offer ? { variantId: offer.variantId, offerId: null, quantity: 1 } : null,
    onError,
  };
}

export type GiftChoice = ReturnType<typeof useGiftChoice>;

export function GiftOptionsField({ state, idPrefix = "checkout" }: { state: GiftChoice; idPrefix?: string }) {
  const { t, money } = useStore();
  const copy = t.giftWrap;
  const ids = useId();
  const { options } = state;
  if (!options) return null;
  const max = options.messageMaxLength;
  const toggle = `${idPrefix}-gift`;
  const messageId = `${idPrefix}-gift-message`;
  const counterId = `${ids}-counter`;
  const box = "mt-0.5 size-5 shrink-0 cursor-pointer accent-primary";

  return (
    <section className={`${card} p-5 sm:p-6`} aria-labelledby={`${toggle}-title`}>
      <label htmlFor={toggle} className="flex min-h-11 cursor-pointer items-center gap-3">
        <input id={toggle} type="checkbox" className={box} checked={state.on} onChange={(e) => state.setOn(e.target.checked)} />
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <GiftIcon size={18} />
        </span>
        <span className="min-w-0">
          <span id={`${toggle}-title`} className="block text-base font-semibold text-ink">
            {copy.title}
          </span>
          <span className="block text-xs text-ink-soft">{copy.hint}</span>
        </span>
      </label>

      {state.on && (
        <div className="mt-4 space-y-4 border-t border-line pt-4">
          {options.wrap && (
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
              <input type="checkbox" className={box} checked={state.wrap} onChange={(e) => state.setWrap(e.target.checked)} />
              {options.wrap.imageUrl && (
                <StoreImage src={options.wrap.imageUrl} alt="" width={40} height={40} sizes="40px" loading="lazy" className="size-10 shrink-0 rounded-lg border border-line object-cover" />
              )}
              <span className="font-medium">{copy.wrap(money(options.wrap.priceAmount, options.wrap.currency))}</span>
            </label>
          )}

          <div>
            <label htmlFor={messageId} className="mb-1.5 block text-sm font-medium text-ink">
              {copy.message}
            </label>
            <textarea
              id={messageId}
              dir="auto"
              rows={3}
              maxLength={max}
              value={state.message}
              placeholder={copy.messagePlaceholder}
              aria-describedby={counterId}
              onChange={(e) => state.setMessage(e.target.value)}
              className={`${input} resize-y`}
            />
            <p id={counterId} className="mt-1 text-end text-xs text-ink-soft" aria-live="polite">
              {copy.counter(state.message.length, max)}
            </p>
          </div>

          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-ink">
            <input type="checkbox" className={box} checked={state.hidePrices} onChange={(e) => state.setHidePrices(e.target.checked)} />
            <span>
              <span className="block font-medium">{copy.hidePrices}</span>
              <span className="block text-xs text-ink-soft">{copy.hidePricesHint}</span>
            </span>
          </label>
        </div>
      )}
    </section>
  );
}

/** The wrap's row in the checkout summary, while it is chosen. */
export function GiftWrapRow({ state, currency }: { state: GiftChoice; currency: string }) {
  const { money } = useStore();
  const offer = state.options?.wrap;
  if (!offer || !state.quoteLine) return null;
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-soft">{offer.name}</dt>
      <dd className="text-ink">{money(offer.priceAmount, offer.currency || currency)}</dd>
    </div>
  );
}
