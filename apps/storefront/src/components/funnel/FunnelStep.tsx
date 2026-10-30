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
  type StorefrontOrderBump,
  type StorefrontProduct,
} from "@store-builder/api-client";
import { OrderBumpCard } from "@/components/checkout/OrderBumpCard";
import { OrderFormFields, fieldId } from "@/components/checkout/OrderFormFields";
import { PaymentMethodPicker } from "@/components/checkout/PaymentMethodPicker";
import type { CheckoutPayload } from "@store-builder/api-client";
import { placeOnlineOrder, usePaymentMethods } from "@/lib/payments";
import { manualIdOf, placeManualOrder, useManualMethods, type ProofDraft } from "@/lib/manualPayments";
import { ManualPaymentStatus, ProofFields, proofErrors, useManualText } from "@/components/checkout/ManualPayment";
import { getVisitorId } from "@/lib/visitorId";
import { BoxIcon, CashIcon } from "@/components/Icons";
import { ConfirmationHeading, OrderSnapshotSummary } from "@/components/OrderConfirmation";
import { StatusTimeline } from "@/components/StatusTimeline";
import { StoreLink, useStoreBasePath } from "@/components/StoreRoute";
import { btnPrimaryLg, btnSecondary, card, container, input, label as labelClass, skeleton } from "@/components/ui";
import { createStorefrontApiClient } from "@/lib/apiClient";
import {
  getOrderSnapshot,
  mergeIntoOrderSnapshot,
  orderBumpOf,
  saveOrderSnapshot,
  snapshotFromOrder,
  type OrderBumpOffer,
} from "@/lib/commerce";
import { funnelErrorKind, isOutOfStock } from "@/lib/funnelErrors";
import { focusField } from "@/lib/focusField";
import {
  rememberFollowOn,
  rememberPlacedOrder,
  useFollowOnOrders,
  usePlacedOrder,
} from "@/lib/funnelSession";
import {
  FIELD_ORDER,
  formOptionsOf,
  toCheckoutPayload,
  validateOrderForm,
  type OrderFormErrors,
  type OrderFormField,
  type OrderFormValues,
} from "@/lib/orderForm";
import { isOrderBumpRefused, orderErrorMessage, placeCodOrder, serverFieldErrors, type OrderLine } from "@/lib/placeOrder";
import { defaultOfferOf, firstImage, offerAppliesTo, variantLabel } from "@/lib/product";
import { useStore } from "@/lib/StoreContext";
import { useFunnelCurrency } from "./FunnelCurrency";
import { FunnelOptIn } from "./FunnelOptIn";
import { readPick } from "@/lib/pagePicks";
import { storeHref } from "@/lib/storeHref";
import { setTrackingContext, track, trackPurchaseOnce } from "@/lib/track";
import { useCatalog } from "@/lib/useCatalog";
import { useCheckoutAutosave } from "@/lib/useCheckoutAutosave";
import { useIsClient } from "@/lib/useIsClient";
import { useFreshCheckoutSettings, useOrderFormFields } from "@/lib/useOrderFormFields";
import { contentIdOf, lineContentId } from "@/lib/contentId";
import { emptyOrderFormFor, useStoreCountry } from "@/lib/storeCountry";
import { DiscountRows, clearStoredCoupon, useCouponPreview, useStoredCoupon } from "@/components/offers/CouponBits";
import { PolicyLinks } from "@/components/PolicyLinks";
import { OfferVariantPicker } from "@/components/offers/OfferVariantPicker";
import { OfferTimer, useOfferCountdown } from "@/components/offers/OfferTimer";
import { variantImageOf } from "@/lib/variantImage";

/**
 * What the shopper *does* on a running funnel's step, drawn under the page the
 * merchant built for it (rendered by the server page with PageRenderer).
 *
 * The backend routes a funnel on step-level outcomes, not on page elements —
 * POST …/advance with `clicked_through`, `completed_checkout`,
 * `accepted_offer` or `declined_offer` — so each step type gets its own
 * island here:
 *
 *   landing / sales / custom          → one "Continue" (clicked_through)
 *   opt_in                            → the sign-up form, then clicked_through (FunnelOptIn)
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
export function useAdvance(workspaceId: string, funnelId: string, sessionId: string, stepKey: string) {
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

  async function advance(type: FunnelRuntimeOutcomeType, orderId?: string, sourceElementId?: string, variantId?: string) {
    if (busy.current) return;
    busy.current = true;
    setPending(type);
    setError(null);
    try {
      const res = await funnelRuntimeAdvance(createStorefrontApiClient(), workspaceId, funnelId, sessionId, {
        fromStepKey: stepKey,
        outcome: { type, ...(orderId ? { orderId } : {}), ...(sourceElementId ? { sourceElementId } : {}), ...(variantId ? { variantId } : {}) },
      });
      // A one-click offer charged to a saved card that was declined is not a purchase (SPEC §9.5).
      const declined = (res.followOnOrder as { payment?: { status?: string } } | undefined)?.payment?.status === "declined";
      if (res.followOnOrder && !declined) {
        rememberFollowOn(sessionId, res.followOnOrder);
        trackPurchaseOnce(res.followOnOrder.id, { valueMinor: parseMoney(res.followOnOrder.totalAmount), numItems: 1 });
      }
      if (declined) setError(t.funnel.oneClickDeclined);
      if (res.mergedOrder) {
        // Joined the checkout order: the thank-you page shows its new total,
        // and the purchase is the added line alone (keyed by that line, since
        // the order's own purchase was already sent).
        mergeIntoOrderSnapshot(workspaceId, res.mergedOrder);
        const added = res.mergedOrder.items.find((i) => i.id === res.mergedOrder?.addedItemId);
        if (added) {
          trackPurchaseOnce(added.id, {
            valueMinor: parseMoney(added.lineTotalAmount),
            currency: res.mergedOrder.currency,
            numItems: added.quantity,
          });
        }
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
  offerJoinsOrder = false,
  bump,
  product,
  sessionOrderId,
}: {
  workspaceId: string;
  funnelId: string;
  sessionId: string;
  step: { key: string; name: string; stepType: FunnelStepTypeDto };
  offer: FunnelRuntimeOffer | null;
  /** Accepting the offer joins the checkout order (the runtime says). */
  offerJoinsOrder?: boolean;
  /** A checkout step's order bump, as the runtime sent it. */
  bump?: StorefrontOrderBump | null;
  product: StorefrontProduct | null;
  sessionOrderId: string | null;
}) {
  const flow = useAdvance(workspaceId, funnelId, sessionId, step.key);
  const { t, store } = useStore();
  const funnelCurrency = useFunnelCurrency();

  // Tag the store's own analytics with this funnel while its steps are on
  // screen. Set during render so the view_content / begin_checkout effects
  // below already carry it; cleared when the shopper leaves the funnel. Both
  // merge into the context StoreAnalytics (store layout) owns.
  if (typeof window !== "undefined") setTrackingContext({ workspaceId, funnelId, stepKey: step.key });
  useEffect(() => {
    setTrackingContext({ workspaceId, funnelId, stepKey: step.key });
    return () => setTrackingContext({ funnelId: undefined, stepKey: undefined });
  }, [workspaceId, funnelId, step.key]);

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
      track("ViewContent", { contentName: step.name, currency: funnelCurrency ?? store?.currency });
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
        bumpOffer={orderBumpOf(bump, product ? [product.id] : [])}
        flow={flow}
      />
    );
  }
  if (step.stepType === "upsell" || step.stepType === "downsell") {
    return (
      <FunnelOfferCard
        workspaceId={workspaceId}
        offer={offer}
        canAccept={!!sessionOrderId}
        joinsOrder={offerJoinsOrder}
        flow={flow}
      />
    );
  }
  if (step.stepType === "thank_you") {
    return <FunnelOrders workspaceId={workspaceId} sessionId={sessionId} orderId={sessionOrderId} />;
  }

  // The visitor signs up before the opt-in step moves on (FunnelOptIn; backend funnels/funnelOptIn.js).
  if (step.stepType === "opt_in") {
    return (
      <FunnelOptIn
        anchorId={FUNNEL_ACTIONS_ID}
        workspaceId={workspaceId}
        funnelId={funnelId}
        sessionId={sessionId}
        stepName={step.name}
        pending={!!flow.pending}
        advanceError={flow.error}
        onSignedUp={() => void flow.advance("clicked_through")}
      />
    );
  }

  // landing / sales / custom.
  return (
    <section id={FUNNEL_ACTIONS_ID} className={`${island} flex flex-col items-center gap-3 pb-16 pt-6`}>
      <PageLinkActions
        pending={!!flow.pending}
        onClick={(sourceElementId) => void flow.advance("clicked_through", undefined, sourceElementId)}
      />
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
export function FunnelCheckout({
  workspaceId,
  funnelId,
  sessionId,
  stepKey,
  sessionOrderId,
  product,
  bumpOffer,
  flow,
  embedded = false,
  title,
}: {
  workspaceId: string;
  funnelId: string;
  sessionId: string;
  stepKey: string;
  sessionOrderId: string | null;
  product: StorefrontProduct | null;
  /** The step's order bump (funnel_steps.bump_offer_id), or null. */
  bumpOffer: OrderBumpOffer | null;
  flow: Flow;
  /** Drawn inside the page (a cod_form element): no section of its own. */
  embedded?: boolean;
  /** The form's heading; the checkout title when unset. */
  title?: string;
}) {
  const { t, money, store, locale } = useStore();
  const funnelCurrency = useFunnelCurrency();
  const [client] = useState(() => createStorefrontApiClient());
  const { fields, reveal } = useOrderFormFields(useFreshCheckoutSettings(client, workspaceId));
  const saved = usePlacedOrder(sessionId);
  // Only an order placed on this very step and not yet reported counts: one the
  // session already holds belongs to an earlier pass (a funnel that loops back).
  const placed = saved && saved.stepKey === stepKey && saved.id !== sessionOrderId ? saved : null;

  // The form starts on the store's country (dashboard → General → Country).
  const storeCountry = useStoreCountry();
  const [values, setValues] = useState<OrderFormValues>(() => emptyOrderFormFor(storeCountry));
  const [errors, setErrors] = useState<OrderFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [bumpOn, setBumpOn] = useState(false);
  // Refused by the server since this step loaded (sold out, withdrawn): hidden.
  const [bumpGone, setBumpGone] = useState(false);
  const bump = bumpGone ? null : bumpOffer;
  const basePath = useStoreBasePath();

  // The methods this funnel offers (payment rules → methods per funnel): cash on
  // delivery and the store's gateways.
  const funnelMethods = usePaymentMethods(client, workspaceId, funnelId);
  const payment = funnelMethods;
  const [methodId, setMethodId] = useState<string | null>(null);
  const method = payment.methods.find((m) => m.id === methodId) ?? payment.methods[0];
  // The store's own InstaPay / wallet methods, as on /checkout; a chosen one wins over `method`.
  const manualMethods = useManualMethods(client, workspaceId);
  const manualId = methodId ? manualIdOf(methodId) : null;
  const manualChosen = manualId ? (manualMethods.find((m) => m.id === manualId) ?? null) : null;
  const manualText = useManualText();
  const [proof, setProof] = useState<ProofDraft>({ payerNumber: "", file: null });
  const [proofErrs, setProofErrs] = useState<{ payerNumber?: string; file?: string }>({});
  const onlyCod = payment.methods.length === 1 && payment.methods[0].method === "cod" && manualMethods.length === 0;

  const variants = useMemo(() => product?.variants ?? [], [product]);
  const [variantId, setVariantId] = useState(() => (variants.find((v) => v.inStock) ?? variants[0])?.id ?? "");
  // A variant picked on an earlier page's variant_selector (lib/pagePicks) comes first.
  useEffect(() => {
    const picked = product ? readPick("variant", product.id) : null;
    if (picked && variants.some((v) => v.id === picked)) setVariantId(picked);
  }, [product, variants]);
  const variant = variants.find((v) => v.id === variantId);
  const offer = product ? defaultOfferOf(product) : undefined;
  const offerId = offer && variant && offerAppliesTo(offer, variant.id) ? offer.id : undefined;
  // What the order engine charges for this line: the offer's price when the
  // line carries the offer, the variant's own price otherwise.
  const unit = offerId && offer ? parseMoney(offer.priceAmount) : variant ? parseMoney(variant.priceAmount) : 0;
  const currency = (offerId ? offer?.currency : variant?.currency) ?? funnelCurrency ?? store?.currency;

  const line: OrderLine | null = variant ? { variantId: variant.id, offerId, quantity: 1 } : null;
  const autosaveLines: OrderLine[] = line && !placed ? [line] : [];
  if (autosaveLines.length > 0 && bumpOn && bump) autosaveLines.push({ variantId: bump.variantId, offerId: bump.offerId, quantity: 1 });
  const autosave = useCheckoutAutosave({
    client,
    workspaceId,
    values,
    lines: autosaveLines,
    source: "funnel",
  });

  // A discount code: typed here, or from a ?coupon= link (stored by the store layout). Previewed by
  // the server for these lines in this funnel — a funnel-limited code applies — and sent only when it applies.
  const allowCodes = formOptionsOf(fields).allow_discount_codes;
  const linkCoupon = useStoredCoupon(workspaceId);
  const [codeInput, setCodeInput] = useState("");
  const [typedCode, setTypedCode] = useState("");
  const [codeRemoved, setCodeRemoved] = useState(false);
  const appliedCode = allowCodes && !codeRemoved ? typedCode || linkCoupon : "";
  const coupon = useCouponPreview(client, workspaceId, appliedCode, autosaveLines, funnelId);
  const couponOff = coupon?.valid ? coupon.amount : 0;

  useTrackOnce(() => {
    if (!product) return;
    track("InitiateCheckout", { contentIds: [contentIdOf(variant) ?? product.id], contentName: product.name, valueMinor: unit, currency, numItems: 1 });
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

    // A store that prices by delivery zones needs the area here too (the server requires it).
    const found = validateOrderForm(values, t, fields, { showAltPhone: true, requireZone: Boolean(store?.delivery?.zones?.length) });
    setErrors(found);
    const invalid = FIELD_ORDER.filter((k) => found[k]);
    if (invalid.length > 0) {
      setFormError(t.form.errors.summary(invalid.length));
      focusField(fieldId(FORM_PREFIX, invalid[0]));
      return;
    }
    if (!product || !variant || !variant.inStock || !line) {
      setFormError(t.form.errors.unavailable);
      return;
    }
    // A proof filled in here must be valid; an empty one is sent later from the funnel's last page.
    if (manualChosen) {
      const badProof = proofErrors(proof, manualText, { required: false });
      setProofErrs(badProof);
      if (badProof.payerNumber || badProof.file) {
        focusField(`${FORM_PREFIX}-proof-${badProof.payerNumber ? "payer" : "shot"}`);
        return;
      }
    }

    submittingRef.current = true;
    setSubmitting(true);
    setFormError(null);
    const checkoutSessionId = await autosave.stop();
    const payload = {
      ...toCheckoutPayload(values, fields, { item: line, showAltPhone: true, ...(coupon?.valid ? { discountCode: coupon.code } : {}) }),
      funnelId,
      // The server adds the step's bump to this order from its offer.
      ...(bumpOn && bump ? { orderBump: { offerId: bump.offerId } } : {}),
      ...(checkoutSessionId ? { checkoutSessionId } : {}),
    };
    let order;
    try {
      if (manualChosen) {
        // Unpaid like cash on delivery, priced by the server; the funnel goes on, and the
        // payment block (where to pay, the proof) waits on the funnel's last page and the order page.
        ({ order } = await placeManualOrder({
          client,
          workspaceId,
          payload: payload as CheckoutPayload,
          manualPaymentMethodId: manualChosen.id,
          proof,
          visitorId: getVisitorId(workspaceId),
        }));
      } else if (method && method.method !== "cod") {
        // Paid online: the gateway's page, then the payment page, which sends the
        // shopper back here to go on (the server moves a card order on once paid).
        const { result, next } = await placeOnlineOrder({
          client,
          workspaceId,
          basePath,
          payload: payload as CheckoutPayload,
          method,
          visitorId: getVisitorId(workspaceId),
          returnTo: `/f/${funnelId}/${sessionId}#${FUNNEL_ACTIONS_ID}`,
        });
        rememberPlacedOrder(sessionId, { id: result.order.id, orderNumber: result.order.orderNumber, stepKey });
        // The gateway's page, or our payment page when the gateway could not start (already store-prefixed).
        window.location.assign(next);
        return;
      } else {
        order = await placeCodOrder({
          client,
          workspaceId,
          payload: payload as CheckoutPayload,
          visitorId: getVisitorId(workspaceId),
        });
      }
    } catch (err) {
      submittingRef.current = false;
      if (isOrderBumpRefused(err)) {
        setBumpOn(false);
        setBumpGone(true);
      }
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
        focusField(fieldId(FORM_PREFIX, invalidFromServer[0]));
      } else {
        // A code the store refused says why (lib/couponRefusals).
        setFormError(orderErrorMessage(err, t.form.errors, { locale, money: (n) => money(n, currency) }));
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
      contentIds: (order.items ?? []).map((i) => lineContentId(i)).filter((id): id is string => !!id),
      contentName: product.name,
      numItems: bumpOn && bump ? 2 : 1,
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
    <section
      id={embedded ? undefined : FUNNEL_ACTIONS_ID}
      className={embedded ? undefined : `${island} pb-16 pt-6`}
      aria-labelledby={`funnel-checkout-title-${stepKey}${embedded ? "-page" : ""}`}
    >
      <form onSubmit={handleSubmit} noValidate className={`${card} mx-auto max-w-2xl p-5 sm:p-8`}>
        <h2 id={`funnel-checkout-title-${stepKey}${embedded ? "-page" : ""}`} className="font-display text-xl font-bold text-ink sm:text-2xl">
          {title?.trim() || t.funnel.checkoutTitle}
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
            pickup={store?.delivery?.pickup ?? null}
            zones={store?.delivery?.zones ?? null}
          />
        </fieldset>

        {onlyCod || !method ? (
          // Cash on delivery is the only method this funnel takes — a fact, not a choice.
          <div className="mt-5 flex min-h-14 items-center gap-3 rounded-xl border-2 border-primary bg-primary-soft px-4 py-3">
            <CashIcon className="shrink-0 text-primary" />
            <p>
              <span className="block text-sm font-semibold text-ink">{t.checkout.cod}</span>
              <span className="block text-xs text-ink-soft">{t.checkout.codHint}</span>
            </p>
          </div>
        ) : (
          <fieldset className="mt-5" disabled={!!placed || busy}>
            <legend className={labelClass}>{t.checkout.payment}</legend>
            <PaymentMethodPicker
              methods={payment.methods}
              value={manualChosen ? (methodId as string) : method.id}
              onChange={setMethodId}
              idPrefix={FORM_PREFIX}
              manualMethods={manualMethods}
            >
              <ProofFields value={proof} onChange={setProof} errors={proofErrs} idPrefix={`${FORM_PREFIX}-proof`} />
              <p className="text-xs text-ink-soft">{manualText.laterHint}</p>
            </PaymentMethodPicker>
          </fieldset>
        )}
        <p className="mt-2 text-xs text-ink-soft">{t.checkout.finalNote}</p>

        {allowCodes && !placed && (
          <div className="mt-5 border-t border-line pt-4">
            <label htmlFor={`${FORM_PREFIX}-discount`} className="mb-1.5 block text-sm font-medium text-ink">
              {t.checkout.discountCode}
            </label>
            {appliedCode ? (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-primary-soft px-3 py-2">
                <dl className="min-w-0 flex-1 text-sm" aria-live="polite">
                  {coupon ? (
                    <DiscountRows extras={{ automaticDiscount: null, minimumOrder: null, bundleDiscountAmount: 0 }} coupon={coupon} currency={currency} />
                  ) : (
                    <p className="text-xs text-primary">{t.checkout.discountPending(appliedCode)}</p>
                  )}
                </dl>
                <button
                  type="button"
                  onClick={() => {
                    setTypedCode("");
                    setCodeRemoved(true);
                    clearStoredCoupon(workspaceId);
                  }}
                  className="min-h-11 shrink-0 cursor-pointer px-2 text-xs font-medium text-ink-soft hover:text-danger"
                >
                  {t.checkout.removeCode}
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  id={`${FORM_PREFIX}-discount`}
                  type="text"
                  autoComplete="off"
                  dir="ltr"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  className={`${input} uppercase`}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!codeInput.trim()) return;
                    setTypedCode(codeInput.trim());
                    setCodeRemoved(false);
                  }}
                  className={btnSecondary}
                >
                  {t.checkout.apply}
                </button>
              </div>
            )}
            {couponOff > 0 && variant && (
              <p className="mt-2 text-sm font-semibold text-ink">
                {t.checkout.subtotal}: {money(unit + (bumpOn && bump ? bump.priceAmount : 0) - couponOff, currency)}
              </p>
            )}
          </div>
        )}

        {bump && !placed && (
          <div className="mt-5 space-y-3">
            <OrderBumpCard bump={bump} checked={bumpOn} onChange={setBumpOn} idPrefix={FORM_PREFIX} />
            {bumpOn && variant && (
              <dl className="space-y-1.5 rounded-xl bg-paper px-4 py-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-soft">{product.name}</dt>
                  <dd className="shrink-0 text-ink">{money(unit, currency)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-soft">{bump.name}</dt>
                  <dd className="shrink-0 text-ink">{money(bump.priceAmount, currency)}</dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-line pt-1.5 font-semibold text-ink">
                  <dt>{t.checkout.subtotal}</dt>
                  <dd className="shrink-0">{money(unit + bump.priceAmount, currency)}</dd>
                </div>
              </dl>
            )}
          </div>
        )}

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
          {/* "By placing your order you agree to…", as on the store checkout. */}
          <PolicyLinks />
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
  joinsOrder = false,
  flow,
}: {
  workspaceId: string;
  offer: FunnelRuntimeOffer | null;
  canAccept: boolean;
  /** Accepting adds it to the checkout order rather than a second one. */
  joinsOrder?: boolean;
  flow: Flow;
}) {
  const { t, money } = useStore();
  const { byVariant, loaded } = useCatalog(workspaceId);
  const price = offer ? parseMoney(offer.priceAmount) : null;

  const firstLine = offer?.lines[0];
  const product = firstLine ? byVariant.get(firstLine.variantId) : undefined;
  // The offer's real countdown (offers/offerCountdown.js): once it ends the offer can only be declined.
  const countdown = useOfferCountdown(offer?.expiresAt);
  const open = !countdown.ended;
  // The option the shopper takes it in (a one-line offer of a product with several, OfferVariantPicker).
  const [chosenId, setChosenId] = useState<string | null>(null);
  const chosenVariantId = offer && offer.lines.length === 1 ? (chosenId ?? firstLine?.variantId ?? "") : "";
  const variant = product?.variants.find((v) => v.id === (chosenVariantId || firstLine?.variantId));
  const image = product ? (variantImageOf(variant) ?? firstImage(product)) : null;
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
              {chosenVariantId && (
                <OfferVariantPicker product={product} value={chosenVariantId} onChange={setChosenId} disabled={!!flow.pending} />
              )}
              <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">{joinsOrder ? t.funnel.offerJoinsHint : t.funnel.offerHint}</p>
              <OfferTimer {...countdown} />
            </>
          ) : (
            <h2 id="funnel-offer-title" className="text-base font-medium text-ink-soft">
              {t.funnel.offerGone}
            </h2>
          )}

          <PageOfferActions
            canAccept={!!offer && canAccept && open}
            pending={!!flow.pending}
            onAction={(type) => void flow.advance(type, undefined, undefined, type === "accepted_offer" && chosenVariantId ? chosenVariantId : undefined)}
          />
          <div className="mt-6 space-y-2">
            {offer && !canAccept && (
              <p role="status" className="rounded-xl bg-paper px-4 py-3 text-sm text-ink-soft">
                {t.funnel.offerNeedsOrder}
              </p>
            )}
            <ErrorBox message={flow.error} />
            {offer && canAccept && open && (
              <button
                type="button"
                onClick={() => void flow.advance("accepted_offer", undefined, undefined, chosenVariantId || undefined)}
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

/**
 * The page's own offer buttons (the builder's `upsell_accept_button` and
 * `upsell_decline_link` elements, drawn by the page renderer with
 * `data-funnel-action`). They carry no logic of their own: a click anywhere on
 * one is reported here, to the same `advance` the built-in buttons use. An
 * accept is ignored while the offer cannot be accepted.
 */
function PageOfferActions({
  canAccept,
  pending,
  onAction,
}: {
  canAccept: boolean;
  pending: boolean;
  onAction: (type: "accepted_offer" | "declined_offer") => void;
}) {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target.closest("[data-funnel-action]") : null;
      const action = target?.getAttribute("data-funnel-action");
      if (pending) return;
      if (action === "accepted_offer" && canAccept) onAction("accepted_offer");
      if (action === "declined_offer") onAction("declined_offer");
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [canAccept, pending, onAction]);
  return null;
}

/**
 * The page's own "move on" buttons (a `button` element with no link, drawn by
 * the page renderer with `data-funnel-action="clicked_through"`). A click is
 * reported with the button's element id, so an edge drawn from that button on
 * the funnel map decides where it leads; without such an edge it follows the
 * step's ordinary next link.
 */
function PageLinkActions({ pending, onClick }: { pending: boolean; onClick: (sourceElementId: string | undefined) => void }) {
  useEffect(() => {
    function handle(event: MouseEvent) {
      const target =
        event.target instanceof Element ? event.target.closest('[data-funnel-action="clicked_through"]') : null;
      if (!target || pending) return;
      onClick(target.getAttribute("data-funnel-source") || undefined);
    }
    document.addEventListener("click", handle);
    return () => document.removeEventListener("click", handle);
  }, [pending, onClick]);
  return null;
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
  const funnelCurrency = useFunnelCurrency();
  const isClient = useIsClient();
  const placed = usePlacedOrder(sessionId);
  const followOns = useFollowOnOrders(sessionId);

  const snapshot = isClient && orderId ? getOrderSnapshot(workspaceId, orderId) : null;
  const orderNumber = snapshot?.orderNumber ?? (placed && placed.id === orderId ? placed.orderNumber : null);
  const currency = snapshot?.currency ?? funnelCurrency ?? store?.currency;
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

        {/* Paid by InstaPay / a wallet: where to pay, the proof's status, and the form while one may be sent. */}
        <ManualPaymentStatus workspaceId={workspaceId} orderId={orderId} />

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
