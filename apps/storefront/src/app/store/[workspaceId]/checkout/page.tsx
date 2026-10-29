"use client";

import { DiscountRows, MinimumOrderNotice, clearStoredCoupon, useStoredCoupon } from "@/components/offers/CouponBits";
import { takeRecoveryPrefill } from "@/lib/recoveryPrefill";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import { CheckoutProgress, type CheckoutStep } from "@/components/checkout/CheckoutProgress";
import { OrderBumpCard } from "@/components/checkout/OrderBumpCard";
import { OrderFormFields, fieldId } from "@/components/checkout/OrderFormFields";
import { PaymentMethodPicker } from "@/components/checkout/PaymentMethodPicker";
import type { CheckoutPayload } from "@store-builder/api-client";
import { FreeShippingHint, ShippingFee } from "@/components/checkout/ShippingFee";
import { ArrowIcon } from "@/components/Icons";
import { StickyActionBar } from "@/components/StickyActionBar";
import { StoreLink, useStoreBasePath } from "@/components/StoreRoute";
import { btnPrimary, btnPrimaryLg, btnSecondary, card, container, input } from "@/components/ui";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useCart } from "@/lib/CartProvider";
import { orderBumpOf } from "@/lib/commerce";
import { focusField } from "@/lib/focusField";
import { GiftOptionsField, GiftWrapRow, useGiftChoice } from "@/components/gifts/GiftOptionsField";
import { HolidayNote } from "@/components/holiday/HolidayNote";
import { LimitLineNote, useLimitNotes } from "@/components/checkout/LimitLineNote";
import { purchaseLimitMessage } from "@/lib/buyInfo";
import {
  CUSTOMER_REFERRALS_ENABLED,
  GIFT_CARDS_ENABLED,
  LOYALTY_ENABLED,
  PURCHASE_LIMITS_ENABLED,
  SHOPPER_ACCOUNTS_ENABLED,
  STORE_CREDIT_ENABLED,
  VIP_TIERS_ENABLED,
} from "@/lib/features";
import { CheckoutTenders, useCheckoutTenders } from "@/components/tenders/CheckoutTenders";
import { CheckoutPerks, useCheckoutPerks } from "@/components/rewards/CheckoutPerks";

/** Points and store credit at checkout, and the level's perks and a friend's invite under the totals: each only while switched on. */
const TENDERS_ON = SHOPPER_ACCOUNTS_ENABLED && (LOYALTY_ENABLED || STORE_CREDIT_ENABLED);
const PERKS_ON = VIP_TIERS_ENABLED || CUSTOMER_REFERRALS_ENABLED;
import { CheckoutSavedAddresses } from "@/components/account/CheckoutSavedAddresses";
import { GiftCardField, useGiftCard } from "@/components/giftCards/GiftCardField";
import { useHolidayCheckout } from "@/lib/storeHoliday";
import {
  FIELD_ORDER,
  formOptionsOf,
  toCheckoutPayload,
  validateOrderForm,
  type OrderFormErrors,
  type OrderFormField,
  type OrderFormValues,
} from "@/lib/orderForm";
import { afterOrder, isOrderBumpRefused, orderErrorMessage, placeCodOrder, serverFieldErrors } from "@/lib/placeOrder";
import { placeOnlineOrder, usePaymentMethods } from "@/lib/payments";
import { manualIdOf, placeManualOrder, useManualMethods, type ProofDraft } from "@/lib/manualPayments";
import { ProofFields, proofErrors, useManualText } from "@/components/checkout/ManualPayment";
import { variantLabel } from "@/lib/product";
import { useStore } from "@/lib/StoreContext";
import { nextOpeningText } from "@/lib/storeHours";
import { getVisitorId } from "@/lib/visitorId";
import { track } from "@/lib/track";
import { contentIdOf } from "@/lib/contentId";
import { useCatalog } from "@/lib/useCatalog";
import { CrossSellStrip, ProductBumpCards } from "@/components/offers/StoreOffers";
import { useCartBumps } from "@/components/offers/CartBumps";
import { useCheckoutAutosave } from "@/lib/useCheckoutAutosave";
import { useShippingQuote } from "@/lib/useShippingQuote";
import { useShippingChoice } from "@/lib/shippingChoice";
import { ShippingOptionPicker } from "@/components/ShippingOptionPicker";
import { useShipTo } from "@/lib/shipTo";
import { useFreshCheckoutSettings, useOrderFormFields } from "@/lib/useOrderFormFields";
import { emptyOrderFormFor, useStoreCountry } from "@/lib/storeCountry";
import { LineCustomizations } from "@/components/LineCustomizations";
import { LineOptions } from "@/components/LineOptions";
import { PolicyLinks } from "@/components/PolicyLinks";
import { XsPageStrip } from "@/components/xs/XsPageStrip";
import { storePageAttrs, stripHoldsTitle } from "@/lib/xsStorePages";

const FORM_PREFIX = "checkout";

/** Which fields make up each step of the progress indicator. */
const CONTACT_FIELDS: OrderFormField[] = ["fullName", "phone", "altPhone", "email"];
const ADDRESS_FIELDS: OrderFormField[] = FIELD_ORDER.filter((f) => !CONTACT_FIELDS.includes(f) && f !== "notes");

export default function CheckoutPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const basePath = useStoreBasePath();
  const { cart, clearCart } = useCart();
  const { t, money, store, locale } = useStore();
  // On a store that wears a template, its shop's title strip (lib/xsStorePages).
  const xsPages = store?.xsPages ?? null;
  const [client] = useState(() => createStorefrontApiClient());
  const { fields, reveal } = useOrderFormFields(useFreshCheckoutSettings(client, workspaceId));
  const { byVariant } = useCatalog(workspaceId);
  // Store features, each inert while its switch is off (lib/features): a store on holiday,
  // what a product's purchase limits refused, and the gift wrap and message.
  const holiday = useHolidayCheckout({ client, workspaceId });
  const limitNotes = useLimitNotes(cart);
  const gift = useGiftChoice({ client, workspaceId });

  // The form starts on the store's country (dashboard → General → Country).
  const storeCountry = useStoreCountry();
  const [values, setValues] = useState<OrderFormValues>(() => emptyOrderFormFor(storeCountry));
  // Arriving from a recovery link (/r/:token): what the shopper had typed comes back, once.
  useEffect(() => {
    const prefill = takeRecoveryPrefill(workspaceId);
    if (prefill) setValues((prev) => ({ ...prev, ...prefill }));
  }, [workspaceId]);
  // The governorate chosen in the cart opens the form (once, and only into an
  // empty field); choosing one here is remembered for the cart in turn.
  const [shipTo, setShipTo] = useShipTo(workspaceId);
  const [adoptedShipTo, setAdoptedShipTo] = useState(false);
  if (!adoptedShipTo && shipTo) {
    setAdoptedShipTo(true);
    // Settings → purchase form: "pre-select the shipping region" can be switched off.
    if (!values.governorate && formOptionsOf(store?.checkout).auto_select_region) {
      setValues((prev) => ({ ...prev, governorate: shipTo }));
    }
  }
  const [errors, setErrors] = useState<OrderFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [appliedCode, setAppliedCode] = useState("");
  // A coupon that came with the link (?coupon=CODE) is applied without typing it.
  const linkCoupon = useStoredCoupon(workspaceId);
  useEffect(() => {
    if (linkCoupon) setAppliedCode((current) => current || linkCoupon);
  }, [linkCoupon]);
  const [bumpOn, setBumpOn] = useState(false);
  // Refused by the server since this page loaded (sold out, withdrawn): hidden.
  const [bumpGone, setBumpGone] = useState(false);
  const storeMethods = usePaymentMethods(client, workspaceId);
  const payment = storeMethods;
  const [methodId, setMethodId] = useState<string | null>(null);
  const method = payment.methods.find((m) => m.id === methodId) ?? payment.methods[0];
  // The store's own InstaPay / wallet methods; a chosen one wins over `method`.
  const manualMethods = useManualMethods(client, workspaceId);
  const manualId = methodId ? manualIdOf(methodId) : null;
  const manualChosen = manualId ? manualMethods.find((m) => m.id === manualId) ?? null : null;
  const manualText = useManualText();
  const [proof, setProof] = useState<ProofDraft>({ payerNumber: "", file: null });
  const [proofErrs, setProofErrs] = useState<{ payerNumber?: string; file?: string }>({});
  const [redirecting, setRedirecting] = useState(false);

  // --- the phone's sticky confirm bar ---------------------------------------
  // The total and the confirm button stay at hand on a phone, where the
  // summary sits below the whole form. The bar shows only while the real
  // button is still below the screen: once it is in view, or scrolled past
  // (the footer), the bar steps aside and covers nothing.
  const submitRef = useRef<HTMLButtonElement>(null);
  const [submitAhead, setSubmitAhead] = useState(true);
  useEffect(() => {
    const el = submitRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setSubmitAhead(!entry.isIntersecting && entry.boundingClientRect.top > 0),
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const currency = cart?.currency ?? "EGP";
  const items = useMemo(() => cart?.items ?? [], [cart]);
  const autosave = useCheckoutAutosave({ client, workspaceId, values, lines: items });

  // InitiateCheckout once per visit to this page, the first time the cart is
  // known to hold something (the cart loads after mount, so not on render 1).
  const checkoutTracked = useRef(false);
  useEffect(() => {
    if (checkoutTracked.current || !cart || cart.items.length === 0) return;
    checkoutTracked.current = true;
    track("InitiateCheckout", {
      contentIds: cart.items.map((line) => contentIdOf(line.variant) ?? line.variantId),
      valueMinor: cart.subtotal,
      currency: cart.currency,
      numItems: cart.items.reduce((sum, line) => sum + line.quantity, 0),
    });
  }, [cart]);

  // The merchant's bump — not offered when that product is already in the cart.
  const bump = useMemo(() => {
    if (bumpGone) return null;
    const inCart = items.map((l) => byVariant.get(l.variantId)?.id).filter(Boolean) as string[];
    return orderBumpOf(store?.orderBump, inCart);
  }, [bumpGone, items, byVariant, store?.orderBump]);

  // The cart products' own add-ons (Offers → Order bumps), the store-wide one left to `bump` (CartBumps.tsx).
  const cartBumps = useCartBumps(client, workspaceId, items.map((l) => byVariant.get(l.variantId)?.id).filter(Boolean) as string[], store?.orderBump?.offerId);
  // A ticked bump is not a cart line: the server adds it to the order.
  const bumpInTotals = (bumpOn && bump ? bump.priceAmount : 0) + cartBumps.selected.reduce((sum, b) => sum + b.priceAmount, 0);
  const subtotal = cart?.subtotal ?? 0;
  // The bump counts toward the parcel's weight as soon as it's ticked.
  const quoteLines = items.map((l) => ({ variantId: l.variantId, offerId: l.offerId, quantity: l.quantity }));
  if (bumpOn && bump) quoteLines.push({ variantId: bump.variantId, offerId: bump.offerId, quantity: 1 });
  for (const b of cartBumps.selected) quoteLines.push({ variantId: b.variantId, offerId: b.offerId, quantity: 1 });
  // The gift wrap is a product the server adds: its weight counts toward the parcel too.
  if (gift.quoteLine) quoteLines.push(gift.quoteLine);
  // The shopper's shipping option, when the store offers more than one (shippingChoice.ts).
  const shippingChoice = useShippingChoice(useShippingQuote({ client, workspaceId, governorate: values.governorate, country: values.country, lines: quoteLines }));
  // Pickup from the store (when offered): no delivery fee; the server charges none either.
  const storePickup = store?.delivery?.pickup ?? null;
  const pickingUp = Boolean(storePickup) && values.deliveryMethod === "pickup";
  // Delivery zones (when the store prices by them): the chosen area's fee, unless the store's free-shipping
  // threshold is reached. Display only — the server prices the order from the zone itself.
  const storeZones = store?.delivery?.zones ?? null;
  const zoneChosen = !pickingUp && storeZones ? (storeZones.find((z) => z.id === values.deliveryZoneId) ?? null) : null;
  const zoneFee = zoneChosen ? (shippingChoice.state.freeShipping?.qualified ? 0 : zoneChosen.feeAmount) : 0;
  const shipping = pickingUp
    ? { ...shippingChoice.state, amount: 0, line: { kind: "free" as const } }
    : zoneChosen
      ? { ...shippingChoice.state, amount: zoneFee, line: zoneFee > 0 ? { kind: "amount" as const, amount: zoneFee } : { kind: "free" as const } }
      : shippingChoice.state;
  // With no code typed, the store's automatic discount comes off (the code's own amount is settled by the server).
  const automaticOff = appliedCode ? 0 : (shipping.extras.automaticDiscount?.amount ?? 0);
  const total = subtotal + bumpInTotals + gift.wrapAmount + shipping.amount - automaticOff;
  // A gift card pays part of a cash-on-delivery order (lib/features; inert while off: no method, so no card).
  const giftCard = useGiftCard({ client, workspaceId, method: GIFT_CARDS_ENABLED && !manualChosen ? method : undefined, total, currency });
  // A signed-in shopper's points and store credit pay part of a cash-on-delivery order (inert while off: no method, nothing read).
  const tenders = useCheckoutTenders({ method: TENDERS_ON && !manualChosen ? method : undefined, total, currency, giftCard });
  // The signed-in shopper's VIP level and a friend's invite, which the API takes off when the order is placed.
  const perks = useCheckoutPerks({ enabled: PERKS_ON });
  // Sent with the order only when one of these is in play, so every other order goes out as it always did.
  const shopperToken = TENDERS_ON || PERKS_ON ? (tenders.shopperToken ?? perks.shopperToken ?? undefined) : undefined;

  // --- progress ------------------------------------------------------------
  // Contact → Address → Confirm above the form, from the same validation the
  // submit runs (with this store's field settings): a step is done once none
  // of its fields has an error. Display only; the form is still one page.
  const liveErrors = validateOrderForm(values, t, fields, { showAltPhone: true, requireZone: Boolean(storeZones && storeZones.length > 0) });
  const formOptions = formOptionsOf(fields);
  const contactDone = CONTACT_FIELDS.every((f) => !liveErrors[f]);
  const addressDone = ADDRESS_FIELDS.every((f) => !liveErrors[f]);
  const progressDone: CheckoutStep[] = [
    ...(contactDone ? (["contact"] as const) : []),
    ...(addressDone ? (["address"] as const) : []),
  ];
  const progressCurrent: CheckoutStep = !contactDone ? "contact" : !addressDone ? "address" : "confirm";

  function onFieldChange(field: OrderFormField, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    if (field === "governorate") setShipTo(value);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const found = validateOrderForm(values, t, fields, { showAltPhone: true, requireZone: Boolean(storeZones && storeZones.length > 0) });
    setErrors(found);
    const invalid = FIELD_ORDER.filter((k) => found[k]);
    if (invalid.length > 0) {
      setFormError(t.form.errors.summary(invalid.length));
      focusField(fieldId(FORM_PREFIX, invalid[0]));
      return;
    }
    if (!cart || items.length === 0) {
      setFormError(t.form.errors.emptyCart);
      return;
    }

    // A proof filled in at checkout must be valid; an empty one is sent later from the thank-you page.
    if (manualChosen) {
      const found = proofErrors(proof, manualText, { required: false });
      setProofErrs(found);
      if (found.payerNumber || found.file) {
        focusField(`${FORM_PREFIX}-proof-${found.payerNumber ? "payer" : "shot"}`);
        return;
      }
    }

    // Points typed under the minimum or over the balance: said beside the field (which takes focus), before anything is sent.
    const pointsProblem = TENDERS_ON ? tenders.check() : null;
    if (pointsProblem) {
      setFormError(pointsProblem);
      return;
    }

    const systemNotes: string[] = [];

    setSubmitting(true);
    setFormError(null);
    const checkoutSessionId = await autosave.stop();
    try {
      const payload = {
        ...toCheckoutPayload(values, fields, { discountCode: appliedCode, systemNotes, showAltPhone: true }),
        ...(pickingUp || storeZones ? {} : shippingChoice.payload),
        ...(bumpOn && bump ? { orderBump: { offerId: bump.offerId } } : {}),
        ...(cartBumps.selected.length > 0 ? { orderBumps: cartBumps.selected.map((b) => ({ offerId: b.offerId })) } : {}),
        ...(checkoutSessionId ? { checkoutSessionId } : {}),
        ...gift.payload,
        ...giftCard.payload,
        ...(TENDERS_ON ? tenders.payload : {}),
        ...(PERKS_ON ? perks.payload : {}),
      };
      if (manualChosen) {
        const { order } = await placeManualOrder({
          client,
          workspaceId,
          payload: payload as CheckoutPayload,
          manualPaymentMethodId: manualChosen.id,
          proof,
          cartToken: cart.guestToken,
          visitorId: getVisitorId(workspaceId),
          shopperToken,
        });
        if (PERKS_ON) perks.onPlaced();
        clearCart();
        router.push(afterOrder({ workspaceId, basePath, order, phone: payload.contact.phone }));
        return;
      }
      if (method.method !== "cod") {
        const { next, external } = await placeOnlineOrder({
          client,
          workspaceId,
          basePath,
          payload,
          method,
          cartToken: cart.guestToken,
          visitorId: getVisitorId(workspaceId),
          shopperToken,
        });
        if (PERKS_ON) perks.onPlaced();
        clearCart();
        if (external) {
          setRedirecting(true);
          window.location.assign(next);
        } else {
          router.push(next);
        }
        return;
      }
      const order = await placeCodOrder({
        client,
        workspaceId,
        payload: payload as CheckoutPayload,
        cartToken: cart.guestToken,
        visitorId: getVisitorId(workspaceId),
        shopperToken,
      });
      if (PERKS_ON) perks.onPlaced();
      clearCart();
      router.push(afterOrder({ workspaceId, basePath, order, phone: payload.contact.phone }));
    } catch (err) {
      if (isOrderBumpRefused(err)) {
        // The totals drop the add-on with it; the shopper confirms again.
        setBumpOn(false);
        setBumpGone(true);
        cartBumps.reset();
      }
      const fromServer = serverFieldErrors(err, t.form.errors);
      const invalid = FIELD_ORDER.filter((k) => fromServer[k]);
      if (invalid.length > 0) {
        // Commit first: a field the server named may be one this form was
        // hiding, and it has to exist before it can take focus.
        flushSync(() => {
          reveal(fromServer);
          setErrors(fromServer);
          setFormError(t.form.errors.summary(invalid.length));
          setSubmitting(false);
        });
        focusField(fieldId(FORM_PREFIX, invalid[0]));
      } else {
        // A store that went on holiday, a product over its purchase limit, a gift option the store
        // dropped: said in the shopper's words. Each is null while its feature is off.
        if (PURCHASE_LIMITS_ENABLED) limitNotes.capture(err);
        const featureRefusal =
          holiday.onError(err) ??
          (PURCHASE_LIMITS_ENABLED ? purchaseLimitMessage(err, locale) : null) ??
          gift.onError(err) ??
          giftCard.onError(err) ??
          (TENDERS_ON ? tenders.onError(err) : null) ??
          (PERKS_ON ? perks.onError(err) : null);
        // A code the store refused says why (lib/couponRefusals).
        setFormError(featureRefusal ?? orderErrorMessage(err, t.form.errors, { locale, money: (n) => money(n, currency) }));
        setSubmitting(false);
      }
      autosave.resume();
    }
  }

  const submitLabel = holiday.pausedLabel
    ? holiday.pausedLabel
    : redirecting
    ? t.payment.redirecting
    : submitting
      ? t.checkout.placing
      : method.method === "cod" || manualChosen
        ? t.checkout.place
        : t.payment.payNow;
  // Opening hours: while the store is closed the order cannot be placed (the server refuses it too).
  const storeClosed = store?.delivery?.hours ? !store.delivery.hours.openNow : false;
  // Closed by the weekly hours: when it opens next (lib/storeHours).
  const nextOpen = storeClosed ? (store?.delivery?.hours?.nextOpen ?? null) : null;
  const submitDisabled = submitting || items.length === 0 || storeClosed || holiday.paused;
  // The estimated delivery time: the chosen zone's, else the store's.
  const etaMinutes = pickingUp ? null : (zoneChosen?.etaMinutes ?? store?.delivery?.etaMinutes ?? null);

  return (
    <main className="flex-1" {...storePageAttrs("checkout", xsPages)}>
      {xsPages && (
        <XsPageStrip
          pages={xsPages}
          title={stripHoldsTitle(xsPages) ? (xsPages.titles.checkout ?? t.checkout.title) : undefined}
          label={t.catalog.breadcrumbs}
          crumbs={[{ label: t.common.home, href: "/" }, { label: xsPages.titles.cart ?? t.cart.title, href: "/cart" }, { label: xsPages.titles.checkout ?? t.checkout.title }]}
        />
      )}
      <div className={`${container} py-8 sm:py-10`}>
      {!xsPages && (
        <StoreLink
          href="/cart"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-medium text-ink-soft hover:text-primary"
        >
          <ArrowIcon size={16} className="rotate-180 rtl:rotate-0" />
          {t.checkout.backToCart}
        </StoreLink>
      )}
      {!stripHoldsTitle(xsPages) && <h1 className="zt-page-title mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">{t.checkout.title}</h1>}

      <div className="mt-6 max-w-xl">
        <CheckoutProgress done={progressDone} current={progressCurrent} />
      </div>
      {/* A store on holiday: when the order ships, or that orders are paused. */}
      <HolidayNote view={holiday} className="mt-3 max-w-xl" />

      <form
        onSubmit={handleSubmit}
        noValidate
        aria-busy={submitting}
        // minmax(0, …): long text or a wide row must not widen the column past the screen.
        className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]"
      >
        <div className="space-y-6">
          {storeClosed && (
            <div role="status" className={`${card} p-5`}>
              <p className="font-semibold text-ink">{t.checkout.closedTitle}</p>
              <p className="mt-1 text-sm text-ink-soft">{store?.delivery?.hours?.message || t.checkout.closedText}</p>
              {nextOpen && <p className="mt-1 text-sm font-medium text-ink">{nextOpeningText(nextOpen, t, locale)}</p>}
            </div>
          )}
          {etaMinutes ? <p className="text-sm text-ink-soft">{t.checkout.eta(etaMinutes)}</p> : null}
          <section className={`${card} p-5 sm:p-6`} aria-labelledby="shipping-title">
            <h2 id="shipping-title" className="text-lg font-semibold text-ink">
              {t.checkout.shipping}
            </h2>
            <div className="mt-4">
              {/* A signed-in shopper's contact and saved addresses, or one line to sign in (nothing on a store without accounts). */}
              {SHOPPER_ACCOUNTS_ENABLED && !pickingUp && <CheckoutSavedAddresses values={values} onChange={onFieldChange} />}
              <OrderFormFields
                idPrefix={FORM_PREFIX}
                values={values}
                errors={errors}
                onChange={onFieldChange}
                fields={fields}
                showAltPhone
                pickup={storePickup}
                zones={storeZones}
              />
              {!pickingUp && !storeZones && <ShippingOptionPicker choice={shippingChoice} idPrefix={FORM_PREFIX} />}
            </div>
          </section>

          {/* "Is this a gift?": wrap, message, hidden prices, when the store offers them. */}
          <GiftOptionsField state={gift} idPrefix={FORM_PREFIX} />

          <section className={`${card} p-5 sm:p-6`} aria-labelledby="payment-title">
            <h2 id="payment-title" className="text-lg font-semibold text-ink">
              {t.checkout.payment}
            </h2>
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
          </section>
        </div>

        <aside className="zt-checkout-summary space-y-4 lg:sticky lg:top-24 lg:self-start">
          <section className={`${card} p-5`} aria-labelledby="summary-title">
            <h2 id="summary-title" className="text-base font-semibold text-ink">
              {t.checkout.summary}
            </h2>
            {items.length === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">{t.cart.empty}</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {items.map((line) => {
                  const product = byVariant.get(line.variantId);
                  const options = variantLabel(line.variant);
                  return (
                    <li key={line.id} className="flex justify-between gap-3 text-sm">
                      <span className="min-w-0 text-ink-soft">
                        <span className="line-clamp-2 text-ink">{product?.name ?? (options || t.cart.item)}</span>
                        {product && options && <span className="block text-xs">{options}</span>}
                        <LineOptions options={line.options} />
                          <LineCustomizations customizations={line.customizations} />
                        <span className="text-xs"> × {line.quantity}</span>
                        <LimitLineNote notes={limitNotes} productId={product?.id} />
                      </span>
                      <span className="shrink-0 font-medium text-ink">{money(line.lineTotal, currency)}</span>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Discount code — validated by the backend at checkout (no public preview endpoint). */}
            {formOptions.allow_discount_codes && (
            <div className="mt-5 border-t border-line pt-4">
              <label htmlFor="discount-code" className="mb-1.5 block text-sm font-medium text-ink">
                {t.checkout.discountCode}
              </label>
              {appliedCode ? (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-primary-soft px-3 py-2">
                  <p className="text-xs text-primary" aria-live="polite">
                    {t.checkout.discountPending(appliedCode)}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setAppliedCode("");
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
                    id="discount-code"
                    type="text"
                    autoComplete="off"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="done"
                    dir="ltr"
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                    // Enter here (a phone keyboard's Go) applies the code; it must
                    // not submit the whole checkout form and place the order.
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      if (codeInput.trim()) setAppliedCode(codeInput.trim());
                    }}
                    className={`${input} uppercase`}
                  />
                  <button
                    type="button"
                    onClick={() => codeInput.trim() && setAppliedCode(codeInput.trim())}
                    className={`${btnSecondary} shrink-0`}
                  >
                    {t.checkout.apply}
                  </button>
                </div>
              )}
            </div>
            )}

            <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">{t.checkout.subtotal}</dt>
                <dd className="text-ink">{money(subtotal, currency)}</dd>
              </div>
              {bumpOn && bump && (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-soft">{bump.name}</dt>
                  <dd className="text-ink">{money(bump.priceAmount, currency)}</dd>
                </div>
              )}
              {cartBumps.selected.map((b) => (
                <div key={b.offerId} className="flex justify-between gap-3">
                  <dt className="text-ink-soft">{b.name}</dt>
                  <dd className="text-ink">{money(b.priceAmount, currency)}</dd>
                </div>
              ))}
              <GiftWrapRow state={gift} currency={currency} />
              {!appliedCode && <DiscountRows extras={shipping.extras} coupon={null} currency={currency} />}
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">{t.checkout.shippingFee}</dt>
                <dd className="text-ink">
                  <ShippingFee line={shipping.line} currency={currency} />
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-line pt-3 text-base font-bold text-ink">
                <dt>{t.checkout.totalEstimate}</dt>
                <dd>{money(total, currency)}</dd>
              </div>
            </dl>
            {/* "Have a gift card?": its code, what it takes off, and what the courier collects. */}
            {GIFT_CARDS_ENABLED && <GiftCardField state={giftCard} remainder={!TENDERS_ON} />}
            {/* "Use your store credit", "Use your points", and what is left for the courier once any of them pays part. */}
            {TENDERS_ON && <CheckoutTenders state={tenders} />}
            {/* The VIP level's perks and a friend's invite, as they will come off the order. */}
            {PERKS_ON && <CheckoutPerks state={perks} />}
            <MinimumOrderNotice extras={shipping.extras} currency={currency} className="mt-3" />
            <FreeShippingHint
              progress={shipping.freeShipping}
              line={shipping.line}
              currency={currency}
              className="mt-3"
            />
            <p className="mt-2 text-xs text-ink-soft">{t.checkout.finalNote}</p>
            <PolicyLinks className="mt-2" />
          </section>

          {bump && items.length > 0 && (
            <OrderBumpCard bump={bump} checked={bumpOn} onChange={setBumpOn} idPrefix={FORM_PREFIX} />
          )}
          {items.length > 0 && <ProductBumpCards state={cartBumps} idPrefix={`${FORM_PREFIX}-pb`} />}

          <div role="alert" aria-live="assertive" className="empty:hidden">
            {formError && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{formError}</p>}
          </div>

          <button ref={submitRef} type="submit" disabled={submitDisabled} className={btnPrimaryLg}>
            {submitLabel}
          </button>
        </aside>

        {/* Inside the form, so its button submits the same way the one above does. */}
        <StickyActionBar hidden={!submitAhead || items.length === 0} until="lg">
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <p className="text-xs text-ink-soft">{t.checkout.totalEstimate}</p>
              <p className="truncate text-base font-bold text-ink">{money(total, currency)}</p>
            </div>
            <button type="submit" disabled={submitDisabled} className={`${btnPrimary} flex-1`}>
              {submitLabel}
            </button>
          </div>
        </StickyActionBar>
      </form>

      {/* What goes with the order (Offers → Cross-sell, at checkout). */}
      {items.length > 0 && (
        <CrossSellStrip
          workspaceId={workspaceId}
          placement="checkout"
          productIds={[...new Set(items.map((line) => byVariant.get(line.variantId)?.id).filter((id): id is string => Boolean(id)))]}
        />
      )}
      </div>
    </main>
  );
}
