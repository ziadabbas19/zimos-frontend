"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type HTMLAttributes } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import {
  isApiErrorCode,
  funnelRuntimeAdvance,
  funnelRuntimeGetStep,
  parseMoney,
  type FunnelRuntimeOffer,
  type FunnelRuntimeOutcomeType,
  type FunnelStepTypeDto,
  type StorefrontProduct,
} from "@store-builder/api-client";
import { OrderFormFields, fieldId } from "@/components/checkout/OrderFormFields";
import { BoxIcon, CashIcon } from "@/components/Icons";
import { ConfirmationHeading, OrderSnapshotSummary } from "@/components/OrderConfirmation";
import { StatusTimeline } from "@/components/StatusTimeline";
import { StoreLink, useStoreBasePath } from "@/components/StoreRoute";
import { btnPrimaryLg, btnSecondary, card, container, input, label as labelClass, skeleton } from "@/components/ui";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { getOrderSnapshot, saveOrderSnapshot, snapshotFromOrder } from "@/lib/commerce";
import { funnelErrorKind, isOutOfStock } from "@/lib/funnelErrors";
import {
  rememberFollowOn,
  rememberPlacedOrder,
  useFollowOnOrders,
  usePlacedOrder,
} from "@/lib/funnelSession";
import {
  EMPTY_ORDER_FORM,
  FIELD_ORDER,
  toCheckoutPayload,
  validateOrderForm,
  type OrderFormErrors,
  type OrderFormField,
  type OrderFormValues,
} from "@/lib/orderForm";
import { orderErrorMessage, placeCodOrder, serverFieldErrors, type OrderLine } from "@/lib/placeOrder";
import { defaultOfferOf, firstImage, offerAppliesTo, variantLabel } from "@/lib/product";
import { useStore } from "@/lib/StoreContext";
import { storeHref } from "@/lib/storeHref";
import { track, trackPurchaseOnce } from "@/lib/track";
import { useCatalog } from "@/lib/useCatalog";
import { useCheckoutAutosave } from "@/lib/useCheckoutAutosave";
import { useIsClient } from "@/lib/useIsClient";
import { useFreshCheckoutSettings, useOrderFormFields } from "@/lib/useOrderFormFields";

/**
 * What the shopper *does* on a running funnel's step, drawn under the page the
 * merchant built for it (rendered by the server page with PageRenderer).
 *
 * The backend routes a funnel on step-level outcomes, not on page elements —
 * POST …/advance with `clicked_through`, `completed_checkout`,
 * `accepted_offer` or `declined_offer` — so each step type gets its own
 * island here:
 *
 *   landing / sales / opt_in / custom → one "Continue" (clicked_through)
 *   checkout                          → the COD order form, then completed_checkout
 *   upsell / downsell                 → "Yes, add it" / "No thanks"
 *   thank_you, or a finished session  → the confirmation, no advance
 *
 * After an advance the page is refreshed in place: the URL is the session's,
 * and the server reads its new current step.
 */

/**
 * The id of the step's action island. The step page hands the renderer
 * `/f/<funnel>/<session>#<this>` as the funnel's next href, so "order now" on
 * the merchant's page scrolls to the real Continue / order form / offer.
 */
export const FUNNEL_ACTIONS_ID = "funnel-actions";

/** The action island: anchored for the page's own CTAs, clear of the sticky masthead. */
const island = `${container} scroll-mt-24`;

// --- advancing ---------------------------------------------------------------

/**
 * Reports the step's outcome. Every advance names the step it came from
 * (`fromStepKey`), so a double tap, a stale tab or a retry after a lost
 * response can't answer the *next* step: the server refuses it with
 * STEP_MISMATCH, and this re-reads where the session is and refreshes onto it.
 */
function useAdvance(workspaceId: string, funnelId: string, sessionId: string, stepKey: string) {
  const router = useRouter();
  const basePath = useStoreBasePath();
  const { t } = useStore();
  const [pending, setPending] = useState<FunnelRuntimeOutcomeType | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A ref as well as state: two taps in one frame must not both get through.
  const busy = useRef(false);

  function release(message: string | null) {
    busy.current = false;
    setPending(null);
    setError(message);
  }

  /**
   * Where is the session now? A different step (or a finished journey) is
   * refreshed onto — the island stays pending, since that render replaces it.
   * The same step means the failure was about this step's own action, and
   * `sameStep` says what to tell the shopper.
   */
  async function resync(sameStep: string) {
    try {
      const now = await funnelRuntimeGetStep(createStorefrontApiClient(), workspaceId, funnelId, sessionId);
      if (!now.done && now.session.currentStepKey === stepKey) {
        release(sameStep);
        return;
      }
      router.refresh();
    } catch (err) {
      const kind = funnelErrorKind(err);
      if (kind === "notFound") {
        // The session (or the funnel's publication) is gone: start over from
        // the entry, which resumes or shows "not available".
        router.replace(storeHref(basePath, `/f/${funnelId}`));
      } else if (kind === "paused") {
        router.refresh();
      } else {
        release(t.funnel.advanceFailed);
      }
    }
  }

  async function advance(type: FunnelRuntimeOutcomeType, orderId?: string) {
    if (busy.current) return;
    busy.current = true;
    setPending(type);
    setError(null);
    try {
      const res = await funnelRuntimeAdvance(createStorefrontApiClient(), workspaceId, funnelId, sessionId, {
        fromStepKey: stepKey,
        outcome: { type, ...(orderId ? { orderId } : {}) },
      });
      if (res.followOnOrder) {
        rememberFollowOn(sessionId, res.followOnOrder);
        trackPurchaseOnce(res.followOnOrder.id, { valueMinor: parseMoney(res.followOnOrder.totalAmount), numItems: 1 });
      }
      // Stays pending: the refreshed step remounts this island.
      router.refresh();
    } catch (err) {
      switch (funnelErrorKind(err)) {
        case "stepMismatch":
          // Already moved on (a double tap, another tab, or an earlier
          // attempt whose answer was lost). Go where the session is.
          await resync(t.funnel.advanceFailed);
          return;
        case "notFound":
          // A lost session, an unpublished funnel, or — on an accepted
          // offer — an offer/order that no longer exists. Only the session's
          // step can tell them apart.
          await resync(type === "accepted_offer" ? t.funnel.offerGone : t.funnel.advanceFailed);
          return;
        case "paused":
          router.refresh();
          return;
        case "offerNeedsOrder":
          release(t.funnel.offerNeedsOrder);
          return;
        default:
          // "network" lands here too, and retrying is safe: if the lost
          // attempt went through, the retry is refused as STEP_MISMATCH.
          release(
            isApiErrorCode(err, "ORDER_REJECTED")
              ? t.form.errors.rejected
              : isOutOfStock(err)
                ? t.funnel.offerOutOfStock
                : t.funnel.advanceFailed
          );
      }
    }
  }

  return { advance, pending, error };
}

type Flow = ReturnType<typeof useAdvance>;

function ErrorBox({ message }: { message: string | null }) {
  return (
    <div role="alert" aria-live="assertive" className="empty:hidden">
      {message && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{message}</p>}
    </div>
  );
}

/** Fires once per mounted step (Strict Mode's double effect included). */
function useTrackOnce(fire: () => void) {
  const done = useRef(false);
  const latest = useRef(fire);
  useEffect(() => {
    latest.current = fire;
  });
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    latest.current();
  }, []);
}

// --- the island ----------------------------------------------------------------

export function FunnelStepActions({
  workspaceId,
  funnelId,
  sessionId,
  step,
  offer,
  product,
  sessionOrderId,
}: {
  workspaceId: string;
  funnelId: string;
  sessionId: string;
  step: { key: string; name: string; stepType: FunnelStepTypeDto };
  offer: FunnelRuntimeOffer | null;
  product: StorefrontProduct | null;
  sessionOrderId: string | null;
}) {
  const flow = useAdvance(workspaceId, funnelId, sessionId, step.key);
  const { t, store } = useStore();

  useTrackOnce(() => {
    if (step.stepType === "checkout" || step.stepType === "thank_you") return;
    if (offer) {
      track("ViewContent", {
        contentName: offer.name,
        contentIds: [offer.id],
        valueMinor: parseMoney(offer.priceAmount),
        currency: offer.currency,
      });
    } else {
      track("ViewContent", { contentName: step.name, currency: store?.currency });
    }
  });

  if (step.stepType === "checkout") {
    return (
      <FunnelCheckout
        workspaceId={workspaceId}
        funnelId={funnelId}
        sessionId={sessionId}
        stepKey={step.key}
        sessionOrderId={sessionOrderId}
        product={product}
        flow={flow}
      />
    );
  }
  if (step.stepType === "upsell" || step.stepType === "downsell") {
    return <FunnelOfferCard workspaceId={workspaceId} offer={offer} canAccept={!!sessionOrderId} flow={flow} />;
  }
  if (step.stepType === "thank_you") {
    return <FunnelOrders workspaceId={workspaceId} sessionId={sessionId} orderId={sessionOrderId} />;
  }

  // landing / sales / opt_in / custom. There is no public opt-in capture
  // endpoint, so opt_in moves on the same way.
  return (
    <section id={FUNNEL_ACTIONS_ID} className={`${island} flex flex-col items-center gap-3 pb-16 pt-6`}>
      <div className="w-full max-w-md space-y-3">
        <ErrorBox message={flow.error} />
        <button
          type="button"
          onClick={() => void flow.advance("clicked_through")}
          disabled={!!flow.pending}
          aria-busy={!!flow.pending}
          className={btnPrimaryLg}
        >
          {flow.pending ? t.funnel.continuing : t.funnel.continue}
        </button>
      </div>
    </section>
  );
}

// --- checkout ------------------------------------------------------------------

const FORM_PREFIX = "funnel";

/**
 * The store's COD form (OrderFormFields + lib/orderForm, with the merchant's
 * checkout settings re-read on mount), placing a Buy-Now order for the product
 * the merchant put on this step — tagged with the funnel and the autosaved
 * checkout session — then reporting it with `completed_checkout`.
 *
 * The order is remembered for this session and step the moment it exists, so a
 * failed advance or a reload only ever retries the advance, never the order.
 */
function FunnelCheckout({
  workspaceId,
  funnelId,
  sessionId,
  stepKey,
  sessionOrderId,
  product,
  flow,
}: {
  workspaceId: string;
  funnelId: string;
  sessionId: string;
  stepKey: string;
  sessionOrderId: string | null;
  product: StorefrontProduct | null;
  flow: Flow;
}) {
  const { t, money, store } = useStore();
  const [client] = useState(() => createStorefrontApiClient());
  const { fields, reveal } = useOrderFormFields(useFreshCheckoutSettings(client, workspaceId));
  const saved = usePlacedOrder(sessionId);
  // Only an order placed on this very step and not yet reported counts: one the
  // session already holds belongs to an earlier pass (a funnel that loops back).
  const placed = saved && saved.stepKey === stepKey && saved.id !== sessionOrderId ? saved : null;

  const [values, setValues] = useState<OrderFormValues>(EMPTY_ORDER_FORM);
  const [errors, setErrors] = useState<OrderFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const variants = useMemo(() => product?.variants ?? [], [product]);
  const [variantId, setVariantId] = useState(() => (variants.find((v) => v.inStock) ?? variants[0])?.id ?? "");
  const variant = variants.find((v) => v.id === variantId);
  const offer = product ? defaultOfferOf(product) : undefined;
  const offerId = offer && variant && offerAppliesTo(offer, variant.id) ? offer.id : undefined;
  // What the order engine charges for this line: the offer's price when the
  // line carries the offer, the variant's own price otherwise.
  const unit = offerId && offer ? parseMoney(offer.priceAmount) : variant ? parseMoney(variant.priceAmount) : 0;
  const currency = (offerId ? offer?.currency : variant?.currency) ?? store?.currency;

  const line: OrderLine | null = variant ? { variantId: variant.id, offerId, quantity: 1 } : null;
  const autosave = useCheckoutAutosave({
    client,
    workspaceId,
    values,
    lines: line && !placed ? [line] : [],
    source: "funnel",
  });

  useTrackOnce(() => {
    if (!product) return;
    track("InitiateCheckout", { contentIds: [product.id], contentName: product.name, valueMinor: unit, currency, numItems: 1 });
  });

  function onFieldChange(field: OrderFormField, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submittingRef.current || flow.pending) return;

    if (placed) {
      await flow.advance("completed_checkout", placed.id);
      return;
    }

    const found = validateOrderForm(values, t, fields);
    setErrors(found);
    const invalid = FIELD_ORDER.filter((k) => found[k]);
    if (invalid.length > 0) {
      setFormError(t.form.errors.summary(invalid.length));
      document.getElementById(fieldId(FORM_PREFIX, invalid[0]))?.focus();
      return;
    }
    if (!product || !variant || !variant.inStock || !line) {
      setFormError(t.form.errors.unavailable);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setFormError(null);
    const checkoutSessionId = await autosave.stop();
    const payload = {
      ...toCheckoutPayload(values, fields, { item: line }),
      funnelId,
      ...(checkoutSessionId ? { checkoutSessionId } : {}),
    };
    let order;
    try {
      order = await placeCodOrder({ client, workspaceId, payload });
    } catch (err) {
      submittingRef.current = false;
      const fromServer = serverFieldErrors(err, t.form.errors);
      const invalidFromServer = FIELD_ORDER.filter((k) => fromServer[k]);
      if (invalidFromServer.length > 0) {
        // Commit first: a field the server named may be one this form was
        // hiding, and it has to exist before it can take focus.
        flushSync(() => {
          reveal(fromServer);
          setErrors(fromServer);
          setFormError(t.form.errors.summary(invalidFromServer.length));
          setSubmitting(false);
        });
        document.getElementById(fieldId(FORM_PREFIX, invalidFromServer[0]))?.focus();
      } else {
        setFormError(orderErrorMessage(err, t.form.errors));
        setSubmitting(false);
      }
      autosave.resume();
      return;
    }

    // For the thank-you step, the store's own order page and /track.
    saveOrderSnapshot(workspaceId, snapshotFromOrder(order, payload.contact.phone));
    rememberPlacedOrder(sessionId, { id: order.id, orderNumber: order.orderNumber, stepKey });
    trackPurchaseOnce(order.id, {
      valueMinor: parseMoney(order.totalAmount),
      currency: order.currency,
      contentIds: [product.id],
      contentName: product.name,
      numItems: 1,
    });
    submittingRef.current = false;
    setSubmitting(false);
    await flow.advance("completed_checkout", order.id);
  }

  if (!product) {
    return (
      <section id={FUNNEL_ACTIONS_ID} className={`${island} pb-16 pt-6`}>
        <p className="mx-auto max-w-xl rounded-2xl border border-dashed border-line-strong bg-paper-raised px-6 py-10 text-center text-sm text-ink-soft">
          {t.funnel.noProduct}
        </p>
      </section>
    );
  }

  const image = firstImage(product);
  const busy = submitting || !!flow.pending;

  return (
    <section id={FUNNEL_ACTIONS_ID} className={`${island} pb-16 pt-6`} aria-labelledby="funnel-checkout-title">
      <form onSubmit={handleSubmit} noValidate className={`${card} mx-auto max-w-2xl p-5 sm:p-8`}>
        <h2 id="funnel-checkout-title" className="font-display text-xl font-bold text-ink sm:text-2xl">
          {t.funnel.checkoutTitle}
        </h2>

        <div className="mt-5 flex items-center gap-4 rounded-xl border border-line p-3">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-paper">
            {image ? (
              // Merchant media are arbitrary remote URLs (no next/image allowlist).
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" width={64} height={64} loading="lazy" decoding="async" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-primary/40">
                <BoxIcon size={28} />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 font-semibold text-ink">{product.name}</p>
            {variant && <p className="text-sm font-bold text-ink">{money(unit, currency)}</p>}
          </div>
        </div>

        {variants.length > 1 && (
          <div className="mt-4">
            <label htmlFor={`${FORM_PREFIX}-variant`} className={labelClass}>
              {t.funnel.chooseVariant}
            </label>
            <select
              id={`${FORM_PREFIX}-variant`}
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
              disabled={!!placed || busy}
              className={`${input} cursor-pointer`}
            >
              {variants.map((v) => (
                <option key={v.id} value={v.id} disabled={!v.inStock}>
                  {variantLabel(v) || v.sku}
                  {!v.inStock ? ` — ${t.common.outOfStock}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <fieldset className="mt-6" disabled={!!placed || busy}>
          <legend className="sr-only">{t.checkout.shipping}</legend>
          <OrderFormFields
            idPrefix={FORM_PREFIX}
            values={values}
            errors={errors}
            onChange={onFieldChange}
            fields={fields}
            showAltPhone
          />
        </fieldset>

        {/* Cash on delivery is the only method the checkout accepts — a fact, not a choice. */}
        <div className="mt-5 flex min-h-14 items-center gap-3 rounded-xl border-2 border-primary bg-primary-soft px-4 py-3">
          <CashIcon className="shrink-0 text-primary" />
          <p>
            <span className="block text-sm font-semibold text-ink">{t.checkout.cod}</span>
            <span className="block text-xs text-ink-soft">{t.checkout.codHint}</span>
          </p>
        </div>
        <p className="mt-2 text-xs text-ink-soft">{t.checkout.finalNote}</p>

        <div className="mt-5 space-y-3">
          {placed && (
            <p role="status" className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success">
              <span className="font-semibold">
                {t.funnel.placedTitle} —{" "}
                <bdi dir="ltr">#{placed.orderNumber}</bdi>
              </span>
              <span className="block">{t.funnel.placedHint}</span>
            </p>
          )}
          <ErrorBox message={formError ?? flow.error} />
          <button type="submit" disabled={busy} aria-busy={busy} className={btnPrimaryLg}>
            {busy ? t.checkout.placing : placed ? t.funnel.continue : t.checkout.place}
          </button>
        </div>
      </form>
    </section>
  );
}

// --- upsell / downsell -----------------------------------------------------------

/**
 * The offer attached to this step, as the backend sent it. Accepting creates a
 * second order linked to the checkout order (server-side pricing and stock);
 * either answer follows its own edge. Without a checkout order there is
 * nothing to link to, so only "No thanks" is offered.
 *
 * The offer names its cart lines, not a product, so the photo and the
 * struck-through price come from the catalogue: the product the first line's
 * variant belongs to, and that variant's own compare-at when it is higher than
 * the offer price. No compare-at, no "you save".
 */
function FunnelOfferCard({
  workspaceId,
  offer,
  canAccept,
  flow,
}: {
  workspaceId: string;
  offer: FunnelRuntimeOffer | null;
  canAccept: boolean;
  flow: Flow;
}) {
  const { t, money } = useStore();
  const { byVariant, loaded } = useCatalog(workspaceId);
  const price = offer ? parseMoney(offer.priceAmount) : null;

  const firstLine = offer?.lines[0];
  const product = firstLine ? byVariant.get(firstLine.variantId) : undefined;
  const variant = product?.variants.find((v) => v.id === firstLine?.variantId);
  const image = product ? firstImage(product) : null;
  const quantity = offer?.lines.reduce((sum, l) => sum + (l.quantity || 0), 0) ?? 0;
  const compareAtTotal =
    variant?.compareAtAmount != null ? parseMoney(variant.compareAtAmount) * Math.max(1, quantity) : null;
  // Only a compare-at the merchant set on the variant counts, and only when the offer beats it.
  const compareAt = price !== null && compareAtTotal !== null && compareAtTotal > price ? compareAtTotal : null;

  return (
    <section id={FUNNEL_ACTIONS_ID} className={`${island} pb-16 pt-6`} aria-labelledby="funnel-offer-title">
      <div className={`${card} mx-auto max-w-xl overflow-hidden`}>
        <div className="bg-primary px-5 py-3 text-center text-sm font-semibold text-on-primary">
          {offer?.badge || t.funnel.offerBadge}
        </div>
        <div className="p-5 text-center sm:p-8">
          {offer ? (
            <>
              {/* A fixed square, filled by the photo when the catalogue has it — no jump either way. */}
              {(image || (firstLine && !loaded)) && (
                <div className="mx-auto mb-5 aspect-square w-full max-w-56 overflow-hidden rounded-2xl border border-line bg-paper">
                  {image ? (
                    // Merchant media are arbitrary remote URLs (no next/image allowlist).
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt="" width={224} height={224} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  ) : (
                    <span className={`${skeleton} block h-full w-full rounded-none`} />
                  )}
                </div>
              )}
              <h2 id="funnel-offer-title" className="font-display text-2xl font-bold text-ink">
                {offer.name}
              </h2>
              {product && product.name !== offer.name && <p className="mt-1 text-sm text-ink-soft">{product.name}</p>}
              {price !== null && (
                <p className="mt-3 flex flex-wrap items-baseline justify-center gap-x-3">
                  <span className="text-3xl font-bold text-ink">{money(price, offer.currency)}</span>
                  {compareAt !== null && (
                    <span className="text-lg text-ink-soft line-through">
                      <span className="sr-only">{t.product.compareAt} </span>
                      {money(compareAt, offer.currency)}
                    </span>
                  )}
                </p>
              )}
              {price !== null && compareAt !== null && (
                <p className="mt-1 text-sm font-medium text-success">{t.upsell.save(money(compareAt - price, offer.currency))}</p>
              )}
              <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">{t.funnel.offerHint}</p>
            </>
          ) : (
            <h2 id="funnel-offer-title" className="text-base font-medium text-ink-soft">
              {t.funnel.offerGone}
            </h2>
          )}

          <div className="mt-6 space-y-2">
            {offer && !canAccept && (
              <p role="status" className="rounded-xl bg-paper px-4 py-3 text-sm text-ink-soft">
                {t.funnel.offerNeedsOrder}
              </p>
            )}
            <ErrorBox message={flow.error} />
            {offer && canAccept && (
              <button
                type="button"
                onClick={() => void flow.advance("accepted_offer")}
                disabled={!!flow.pending}
                aria-busy={flow.pending === "accepted_offer"}
                className={btnPrimaryLg}
              >
                {flow.pending === "accepted_offer" ? t.funnel.accepting : t.funnel.accept}
              </button>
            )}
            <button
              type="button"
              onClick={() => void flow.advance("declined_offer")}
              disabled={!!flow.pending}
              aria-busy={flow.pending === "declined_offer"}
              className="flex min-h-11 w-full cursor-pointer items-center justify-center rounded-xl text-sm font-medium text-ink-soft underline-offset-4 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {flow.pending === "declined_offer" ? t.funnel.continuing : t.funnel.decline}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// --- thank you -------------------------------------------------------------------

const orderPath = (id: string, number: string | null) =>
  `/orders/${id}${number ? `?${new URLSearchParams({ number }).toString()}` : ""}`;

/**
 * The confirmation on a thank-you step, or on a session whose funnel has ended:
 * the store's own thank-you pieces (ConfirmationHeading, the "what happens next"
 * timeline, the order summary) plus any offer orders accepted on the way.
 * Order numbers and totals come from this device — the snapshot saved at
 * checkout and the follow-on orders remembered at accept — read after
 * hydration.
 *
 * Under a merchant-built page (`standalone` false) a session with no order
 * shows only the way back to the store: the merchant's page is the message.
 */
export function FunnelOrders({
  workspaceId,
  sessionId,
  orderId,
  standalone = false,
}: {
  workspaceId: string;
  sessionId: string;
  orderId: string | null;
  standalone?: boolean;
}) {
  const { t, money, store } = useStore();
  const isClient = useIsClient();
  const placed = usePlacedOrder(sessionId);
  const followOns = useFollowOnOrders(sessionId);

  const snapshot = isClient && orderId ? getOrderSnapshot(workspaceId, orderId) : null;
  const orderNumber = snapshot?.orderNumber ?? (placed && placed.id === orderId ? placed.orderNumber : null);
  const currency = snapshot?.currency ?? store?.currency;
  const Title = standalone ? "h1" : "h2";

  if (!orderId) {
    return (
      <section id={FUNNEL_ACTIONS_ID} className={`${island} pb-16 pt-6`}>
        <div className="mx-auto max-w-md text-center">
          {standalone && (
            <>
              <Title className="font-display text-2xl font-bold text-ink">{t.funnel.doneTitle}</Title>
              <p className="mt-2 text-sm text-ink-soft">{t.funnel.doneBody}</p>
            </>
          )}
          <StoreLink href="/" className={`${btnSecondary} ${standalone ? "mt-6" : ""}`}>
            {t.thankYou.backToStore}
          </StoreLink>
        </div>
      </section>
    );
  }

  const sub = standalone ? "h2" : "h3";

  return (
    <section id={FUNNEL_ACTIONS_ID} className={`${island} pb-16 pt-6`}>
      <div className="mx-auto max-w-2xl">
        <ConfirmationHeading as={Title} orderNumber={orderNumber} phone={snapshot?.phone} />

        {followOns.length > 0 && (
          <FunnelOrderList
            heading={sub}
            rows={[
              { id: orderId, label: t.funnel.mainOrder, number: orderNumber, total: snapshot ? money(snapshot.totalAmount, currency) : null },
              ...followOns.map((o) => ({
                id: o.id,
                label: t.funnel.extraOrder,
                number: o.orderNumber,
                total: money(parseMoney(o.totalAmount), currency),
              })),
            ]}
          />
        )}

        <section className={`${card} mt-8 p-5 sm:p-6`} aria-labelledby="funnel-next-title">
          <FunnelHeading as={sub} id="funnel-next-title" className="mb-5 text-lg font-semibold text-ink">
            {t.thankYou.steps}
          </FunnelHeading>
          <StatusTimeline stage={1} />
        </section>

        {snapshot && (
          <div className="mt-6">
            <OrderSnapshotSummary
              snapshot={snapshot}
              currency={currency}
              headingLevel={sub}
              footnote={followOns.length > 0 ? t.checkout.finalNote : undefined}
            />
          </div>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <StoreLink href="/track" className={btnSecondary}>
            {t.thankYou.track}
          </StoreLink>
          <StoreLink href="/" className={btnSecondary}>
            {t.thankYou.backToStore}
          </StoreLink>
        </div>
      </div>
    </section>
  );
}

function FunnelHeading({
  as: Tag,
  ...props
}: { as: "h2" | "h3" } & HTMLAttributes<HTMLHeadingElement>) {
  return <Tag {...props} />;
}

function FunnelOrderList({
  heading,
  rows,
}: {
  heading: "h2" | "h3";
  rows: { id: string; label: string; number: string | null; total: string | null }[];
}) {
  const { t } = useStore();

  return (
    <section className={`${card} mt-8 p-5 sm:p-6`} aria-labelledby="funnel-orders-title">
      <FunnelHeading as={heading} id="funnel-orders-title" className="text-lg font-semibold text-ink">
        {t.funnel.yourOrders}
      </FunnelHeading>
      <ul className="mt-3 divide-y divide-line">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <span className="min-w-0">
              <span className="block text-ink-soft">{row.label}</span>
              {row.number && (
                <bdi dir="ltr" className="font-semibold text-ink">
                  #{row.number}
                </bdi>
              )}
            </span>
            <span className="flex items-center gap-3">
              {row.total && <span className="font-semibold text-ink">{row.total}</span>}
              <StoreLink
                href={orderPath(row.id, row.number)}
                className="inline-flex min-h-11 items-center font-medium text-primary hover:underline"
              >
                {t.funnel.viewOrder}
              </StoreLink>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
