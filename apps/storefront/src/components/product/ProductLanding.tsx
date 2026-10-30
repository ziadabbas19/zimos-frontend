"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, useCallback } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import {
  parseMoney,
  storefrontProductPage,
  type CheckoutSettings,
  type StorefrontProductDetail,
} from "@store-builder/api-client";
import { useCart } from "@/lib/CartProvider";
import { storeHref } from "@/lib/storeHref";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useShippingQuote } from "@/lib/useShippingQuote";
import { useShippingChoice } from "@/lib/shippingChoice";
import { ShippingOptionPicker } from "../ShippingOptionPicker";
import { ShippingFee } from "@/components/checkout/ShippingFee";
import { bundlePricing, bundleTiers, type OrderBumpOffer } from "@/lib/commerce";
import {
  formOptionsOf,
  FIELD_ORDER,
  quickFormFields,
  toCheckoutPayload,
  validateOrderForm,
  type OrderFormErrors,
  type OrderFormField,
  type OrderFormValues,
} from "@/lib/orderForm";
import {
  afterOrder,
  isOrderBumpRefused,
  cartErrorMessage,
  orderErrorMessage,
  placeCodOrder,
  serverFieldErrors,
  type OrderLine,
} from "@/lib/placeOrder";
import { placeOnlineOrder, usePaymentMethods } from "@/lib/payments";
import { manualIdOf, placeManualOrder, useManualMethods, type ProofDraft } from "@/lib/manualPayments";
import { PaymentMethodPicker } from "@/components/checkout/PaymentMethodPicker";
import { ProofFields, proofErrors, useManualText } from "@/components/checkout/ManualPayment";
import type { CheckoutPayload } from "@store-builder/api-client";
import { useCheckoutAutosave } from "@/lib/useCheckoutAutosave";
import { useOrderFormFields } from "@/lib/useOrderFormFields";
import {
  defaultOfferOf,
  discountPercent,
  findVariant,
  offerAppliesTo,
  optionGroups,
  variantUnitPrice,
} from "@/lib/product";
import { useStore } from "@/lib/StoreContext";
import { getVisitorId } from "@/lib/visitorId";
import { focusField } from "@/lib/focusField";
import { useStoreBasePath } from "../StoreRoute";
import { StickyActionBar } from "../StickyActionBar";
import { CustomFieldInputs, useCustomFieldAnswers } from "./CustomFieldInputs";
import { MenuOptionPicker, useMenuOptions } from "./MenuOptionPicker";
import { ProductBuyNotes } from "./ProductBuyNotes";
import { SizeGuideLink } from "./SizeGuide";
import { BackInStock } from "../stockAlert/BackInStock";
import { preorderFor, stepperLimits, takesPreorders } from "@/lib/buyInfo";
import { LOYALTY_ENABLED, PREORDERS_ENABLED, PURCHASE_LIMITS_ENABLED, SHOPPER_ACCOUNTS_ENABLED, SIZE_CHARTS_ENABLED, STOCK_ALERTS_ENABLED } from "@/lib/features";
import { EarnPointsNote } from "../tenders/EarnPointsNote";
import { WishlistHeart } from "../wishlist/WishlistHeart";
import { useHoliday } from "@/lib/storeHoliday";
import { AddToCartButton } from "../AddToCartButton";
import { QuantityStepper } from "../QuantityStepper";
import { OrderBumpCard } from "../checkout/OrderBumpCard";
import { OrderFormFields, fieldId } from "../checkout/OrderFormFields";
import { CashIcon, CheckIcon } from "../Icons";
import { customFieldsDelta, storefrontProductBundle } from "@store-builder/api-client";
import { readPick, usePick } from "@/lib/pagePicks";
import { useProductTest } from "@/lib/productTest";
import { track } from "@/lib/track";
import { contentIdOf } from "@/lib/contentId";
import { emptyOrderFormFor, useStoreCountry } from "@/lib/storeCountry";
import { BundleAddToCartButton, BundlePicker, useBundleSelection } from "./BundlePicker";
import { ProductBumpCards, useProductBumps } from "../offers/StoreOffers";
import { DiscountRows, MinimumOrderNotice, discountOff, useCouponPreview, useStoredCoupon } from "../offers/CouponBits";
import { OfferCountdown } from "./OfferCountdown";
import { OptionPicker } from "./OptionPicker";
import { setChosenVariantImage, variantImageOf } from "@/lib/variantImage";
import { productPageText } from "./productPageText";
import { btnPrimary, btnPrimaryLg, card } from "../ui";

const FORM_PREFIX = "quick";

/**
 * The buy box of the product page, built as a cash-on-delivery landing:
 * variant pickers → bundle/quantity offer → inline quick order form with an
 * order bump → real COD checkout. "Add to cart" stays as a secondary path.
 */
/**
 * The buy buttons, or, while the chosen variant is sold out and the product
 * takes no pre-orders, the sign-up to hear when it is back in their place.
 * With STOCK_ALERTS_ENABLED off the buttons are all there is, as before.
 */
function RestockOrButtons({
  product,
  variant,
  children,
}: {
  product: { id: string; preorder?: unknown };
  variant: Parameters<typeof BackInStock>[0]["variant"];
  children: ReactNode;
}) {
  if (!STOCK_ALERTS_ENABLED) return <>{children}</>;
  return (
    <BackInStock product={product} variant={variant}>
      {children}
    </BackInStock>
  );
}

export function ProductLanding({
  workspaceId,
  product: listedProduct,
  bump: bumpOffer,
  description,
  checkoutSettings,
}: {
  workspaceId: string;
  product: StorefrontProductDetail;
  bump: OrderBumpOffer | null;
  /** Shown above the order form when the product puts its description first. */
  description?: string | null;
  /** From this page's own render, not the layout's — see useFreshCheckoutSettings. */
  checkoutSettings: CheckoutSettings;
}) {
  const { t, money, locale, store } = useStore();
  // A running A/B test: this visitor's prices (lib/productTest); the price waits until it is known.
  const { product, pending: testPending } = useProductTest(workspaceId, listedProduct);
  const text = productPageText(locale);
  // The product page's settings (SPEC §7.3), defaults filled in.
  const page = useMemo(() => storefrontProductPage(product), [product]);
  // The store's purchase form layout (settings → purchase form) outranks the
  // product's own switch: "one_step" keeps every product page free of the
  // form and sends "Buy now" straight to the checkout.
  const ps =
    formOptionsOf(checkoutSettings).layout === "one_step"
      ? { ...page.pageSettings, inline_checkout: false, skip_cart: true }
      : page.pageSettings;
  const cart = useCart();
  const buyLabel = ps.buy_now_text || (ps.inline_checkout ? t.product.orderNow : text.buyNow);
  const quickFields = useMemo(() => quickFormFields(checkoutSettings), [checkoutSettings]);
  const { fields, reveal } = useOrderFormFields(quickFields);
  const basePath = useStoreBasePath();
  const router = useRouter();
  const [client] = useState(() => createStorefrontApiClient());

  // --- variant selection -------------------------------------------------
  const groups = useMemo(() => optionGroups(product.variants), [product.variants]);
  const initialVariant = product.variants.find((v) => v.inStock) ?? product.variants[0];
  // Off on the product (page settings) or for the whole store (purchase form → pre-select a variant):
  // the shopper picks every option before buying.
  const autoSelect = page.pageSettings.auto_select_variant !== false && formOptionsOf(checkoutSettings).auto_select_variant !== false;
  const [selection, setSelection] = useState<Record<string, string>>(() =>
    !autoSelect && groups.length > 0 ? {} : { ...(initialVariant?.optionValues ?? {}) }
  );
  // What the shopper picked on this page's variant_selector / bundle_selector (lib/pagePicks), after hydration.
  useEffect(() => {
    const picked = product.variants.find((v) => v.id === readPick("variant", product.id));
    if (picked) setSelection({ ...(picked.optionValues ?? {}) });
    const offer = readPick("offer", product.id);
    if (offer && product.offers.some((o) => o.id === offer)) setTierId(offer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);
  usePick(
    "variant",
    product.id,
    useCallback((id: string) => {
      const picked = product.variants.find((v) => v.id === id);
      if (picked) setSelection({ ...(picked.optionValues ?? {}) });
    }, [product.variants])
  );
  // Options left to choose (auto_select_variant off): no variant yet, and not "out of stock".
  const choosing = !autoSelect && groups.some((g) => !selection[g.name]);
  const variant = groups.length > 0 ? (choosing ? undefined : findVariant(product.variants, selection)) : initialVariant;
  // Sold out, but taken as a pre-order with its ship date (PREORDERS_ENABLED; never while it is off).
  const preorder = PREORDERS_ENABLED ? preorderFor(product, variant) : null;
  const available = !!variant?.inStock || !!preorder;
  // A store on holiday pauses its order buttons (HOLIDAY_MODE_ENABLED; open as usual while it is off).
  const holiday = useHoliday();
  // The quantity stepper's bounds from the product's purchase limits (PURCHASE_LIMITS_ENABLED).
  const quantityLimits = PURCHASE_LIMITS_ENABLED ? stepperLimits(product) : {};
  // The gallery leads with the chosen variant's own picture (lib/variantImage).
  const chosenImage = variantImageOf(variant);
  useEffect(() => {
    setChosenVariantImage(product.id, chosenImage);
  }, [product.id, chosenImage]);

  function isValueAvailable(name: string, value: string) {
    return product.variants.some(
      (v) =>
        (v.inStock || (PREORDERS_ENABLED && takesPreorders(product))) &&
        v.optionValues?.[name] === value &&
        Object.entries(selection).every(([n, val]) => n === name || v.optionValues?.[n] === val)
    );
  }

  // --- bundles / quantity --------------------------------------------------
  // A reusable quantity bundle (BundlePicker) takes the place of the offer
  // ladder and the quantity stepper; the server prices it.
  const bundle = useMemo(() => storefrontProductBundle(product), [product]);
  const bundleChoice = useBundleSelection({ client, workspaceId, bundle, product, mainVariant: variant });
  const tiers = useMemo(() => (bundle ? [] : bundleTiers(product)), [bundle, product]);
  const [quantity, setQuantity] = useState(() => (PURCHASE_LIMITS_ENABLED ? stepperLimits(product).min : undefined) ?? 1);
  const [tierId, setTierId] = useState(
    () => product.offers.find((o) => o.isDefault)?.id ?? tiers[0]?.id ?? ""
  );
  usePick("offer", product.id, useCallback((id: string) => setTierId(id), []));
  const tier = tiers.find((x) => x.id === tierId);
  // The product's custom fields: answered here, sent with the order line.
  const custom = useCustomFieldAnswers(workspaceId, product.id, product.customFields);
  // The product's menu options (Size, Extras): picked here, priced by the server.
  const menu = useMenuOptions(product.optionGroups ?? []);
  const hasMenu = menu.groups.length > 0;
  const unit = variantUnitPrice(product, variant);
  const pricing = bundleChoice ? bundleChoice.pricing : bundlePricing(unit, quantity, tier);
  const compareAtUnit =
    variant?.compareAtAmount && parseMoney(variant.compareAtAmount) > unit ? parseMoney(variant.compareAtAmount) : null;
  const pct = discountPercent(unit, compareAtUnit);

  const defaultOffer = defaultOfferOf(product);
  // The bundle's pieces beyond the first line (another variant per piece).
  const bundleExtraLines: OrderLine[] = bundleChoice ? bundleChoice.lines.slice(1) : [];
  const mainLine: OrderLine | null = bundleChoice
    ? (bundleChoice.lines[0] ?? null)
    : variant
    ? tier
      ? { variantId: variant.id, offerId: tier.offerId, quantity: 1 }
      : {
          variantId: variant.id,
          offerId: defaultOffer && offerAppliesTo(defaultOffer, variant.id) ? defaultOffer.id : undefined,
          quantity,
        }
    : null;

  // --- form ----------------------------------------------------------------
  // The form starts on the store's country (dashboard → General → Country).
  const storeCountry = useStoreCountry();
  const [values, setValues] = useState<OrderFormValues>(() => emptyOrderFormFor(storeCountry));
  const [errors, setErrors] = useState<OrderFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bumpOn, setBumpOn] = useState(false);
  // Refused by the server since this page loaded (sold out, withdrawn): hidden.
  const [bumpGone, setBumpGone] = useState(false);
  const bump = bumpGone ? null : bumpOffer;
  // The product's own order bumps (Offers → Order bumps), beside the store-wide one.
  const productBumps = useProductBumps(client, workspaceId, product.id, bumpOffer?.offerId);
  const productBumpsAmount = productBumps.selected.reduce((sum, b) => sum + b.priceAmount, 0);
  const storeMethods = usePaymentMethods(client, workspaceId);
  const payment = storeMethods;
  const [methodId, setMethodId] = useState<string | null>(null);
  const method = payment.methods.find((m) => m.id === methodId) ?? payment.methods[0];
  // The store's own InstaPay / wallet methods, as on /checkout; a chosen one wins over `method`.
  const manualMethods = useManualMethods(client, workspaceId);
  const manualId = methodId ? manualIdOf(methodId) : null;
  const manualChosen = manualId ? (manualMethods.find((m) => m.id === manualId) ?? null) : null;
  const manualText = useManualText();
  const [proof, setProof] = useState<ProofDraft>({ payerNumber: "", file: null });
  const [proofErrs, setProofErrs] = useState<{ payerNumber?: string; file?: string }>({});
  const [redirecting, setRedirecting] = useState(false);

  // The hook keys on the lines' content, so a fresh array each render is fine.
  const autosaveLines: OrderLine[] = mainLine ? [mainLine, ...bundleExtraLines] : [];
  if (bumpOn && bump) autosaveLines.push({ variantId: bump.variantId, offerId: bump.offerId, quantity: 1 });
  for (const b of productBumps.selected) autosaveLines.push({ variantId: b.variantId, offerId: b.offerId, quantity: 1 });
  const autosave = useCheckoutAutosave({ client, workspaceId, values, lines: autosaveLines });
  // The shopper's shipping option, when the store offers more than one (shippingChoice.ts).
  const shippingChoice = useShippingChoice(useShippingQuote({ client, workspaceId, governorate: values.governorate, country: values.country, lines: autosaveLines }));
  // Delivery zones (when the store prices by them): the chosen area's fee, unless the free-shipping
  // threshold is reached. Display only — the server prices the order from the zone itself.
  // Pickup from the store (when offered): no delivery fee; the server charges none either.
  const storePickup = store?.delivery?.pickup ?? null;
  const pickingUp = Boolean(storePickup) && values.deliveryMethod === "pickup";
  const storeZones = store?.delivery?.zones ?? null;
  const zoneChosen = !pickingUp && storeZones ? (storeZones.find((z) => z.id === values.deliveryZoneId) ?? null) : null;
  const zoneFee = zoneChosen ? (shippingChoice.state.freeShipping?.qualified ? 0 : zoneChosen.feeAmount) : 0;
  const shipping = pickingUp
    ? { ...shippingChoice.state, amount: 0, line: { kind: "free" as const } }
    : zoneChosen
      ? { ...shippingChoice.state, amount: zoneFee, line: zoneFee > 0 ? { kind: "amount" as const, amount: zoneFee } : { kind: "free" as const } }
      : shippingChoice.state;

  // A coupon from the link (?coupon=CODE), previewed by the server; with none, the store's automatic discount.
  const linkCoupon = useStoredCoupon(workspaceId);
  const coupon = useCouponPreview(client, workspaceId, formOptionsOf(fields).allow_discount_codes ? linkCoupon : "", autosaveLines);
  // Priced fields the shopper filled in, on every unit of the line they ride on (as the server charges them).
  const fieldsExtra = (customFieldsDelta(product.customFields, custom.toInput()) + menu.deltaPerUnit) * (mainLine?.quantity ?? 0);
  const total =
    pricing.total +
    fieldsExtra +
    (bumpOn && bump ? bump.priceAmount : 0) +
    productBumpsAmount +
    shipping.amount -
    discountOff(shipping.extras, coupon);

  // The product's view and the start of its order form, for the store's pixels and analytics
  // (SPEC §13.2), once each per page view; ids as the product feed gives them (lib/contentId).
  const viewTracked = useRef<string | null>(null);
  useEffect(() => {
    if (viewTracked.current === product.id) return;
    // A tick later, and marked sent only once it is (an effect can run twice before it sticks).
    const timer = window.setTimeout(() => {
      viewTracked.current = product.id;
      track("ViewContent", {
        contentIds: [contentIdOf(variant ?? initialVariant) ?? product.id],
        contentName: product.name,
        valueMinor: unit,
        currency: store?.currency,
      });
    });
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);
  const checkoutTracked = useRef(false);
  function onFormStart() {
    if (checkoutTracked.current) return;
    checkoutTracked.current = true;
    track("InitiateCheckout", {
      contentIds: [mainLine, ...bundleExtraLines]
        .filter((l): l is OrderLine => !!l)
        .map((l) => contentIdOf(product.variants.find((v) => v.id === l.variantId)) ?? l.variantId),
      contentName: product.name,
      valueMinor: pricing.total,
      currency: store?.currency,
      numItems: [mainLine, ...bundleExtraLines].reduce((sum, l) => sum + (l?.quantity ?? 0), 0),
    });
  }

  function onFieldChange(field: OrderFormField, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const found = validateOrderForm(values, t, fields, { requireZone: Boolean(storeZones && storeZones.length > 0) });
    setErrors(found);
    const invalid = FIELD_ORDER.filter((k) => found[k]);
    if (invalid.length > 0) {
      setFormError(t.form.errors.summary(invalid.length));
      focusField(fieldId(FORM_PREFIX, invalid[0]));
      return;
    }
    if (!variant || !available || !mainLine) {
      setFormError(t.form.errors.unavailable);
      return;
    }
    if (!custom.check()) {
      setFormError(t.custom.summary);
      return;
    }
    if (!menu.check()) {
      setFormError(t.menu.summary);
      return;
    }
    // A proof filled in here must be valid; an empty one is sent later from the thank-you page.
    if (manualChosen) {
      const found = proofErrors(proof, manualText, { required: false });
      setProofErrs(found);
      if (found.payerNumber || found.file) {
        focusField(`${FORM_PREFIX}-proof-${found.payerNumber ? "payer" : "shot"}`);
        return;
      }
    }
    // The answers ride on the line that places the order only: the shipping
    // quote and the autosave above key on the lines and must not re-run per keystroke.
    const customizations = custom.toInput();
    const withAnswers: OrderLine = customizations ? { ...mainLine, customizations } : mainLine;
    const orderLine: OrderLine = hasMenu ? { ...withAnswers, options: menu.toInput() } : withAnswers;
    const visitorId = getVisitorId(workspaceId);

    setSubmitting(true);
    setFormError(null);
    const checkoutSessionId = await autosave.stop();
    // A ticked bump names its offer only; the server adds it to this order.
    const payload = {
      // Only a coupon the server said applies is sent: a stale link must not fail the order.
      ...toCheckoutPayload(values, fields, { item: orderLine, ...(coupon?.valid ? { discountCode: coupon.code } : {}) }),
      ...(pickingUp || storeZones ? {} : shippingChoice.payload),
      ...(bundleExtraLines.length > 0 ? { extraItems: bundleExtraLines } : {}),
      ...(bumpOn && bump ? { orderBump: { offerId: bump.offerId } } : {}),
      ...(productBumps.selected.length > 0
        ? { orderBumps: productBumps.selected.map((b) => ({ offerId: b.offerId })) }
        : {}),
      ...(checkoutSessionId ? { checkoutSessionId } : {}),
    };
    try {
      if (manualChosen) {
        // Placed unpaid like cash on delivery; the server prices it and keeps the payment token.
        const { order } = await placeManualOrder({
          client,
          workspaceId,
          payload: payload as CheckoutPayload,
          manualPaymentMethodId: manualChosen.id,
          proof,
          visitorId,
        });
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
          visitorId,
        });
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
        visitorId,
      });
      router.push(afterOrder({ workspaceId, basePath, order, phone: payload.contact.phone }));
    } catch (err) {
      if (custom.showServerProblems(err)) {
        setFormError(t.custom.summary);
        setSubmitting(false);
        autosave.resume();
        return;
      }
      if (isOrderBumpRefused(err)) {
        // The totals above drop the add-on with it; the shopper confirms again.
        setBumpOn(false);
        setBumpGone(true);
        productBumps.reset();
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
        // A code the store refused says why (lib/couponRefusals).
        setFormError(orderErrorMessage(err, t.form.errors, { locale, money: (n) => money(n) }));
        setSubmitting(false);
      }
      autosave.resume();
    }
  }

  // --- sticky mobile bar ---------------------------------------------------
  const formRef = useRef<HTMLElement>(null);
  const [formVisible, setFormVisible] = useState(false);
  useEffect(() => {
    const el = formRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setFormVisible(entry.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // --- buy now without the inline form --------------------------------------
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  async function buyNow() {
    if (!mainLine || !available || buying) return;
    if (custom.fields.length > 0 && !custom.check()) return;
    if (hasMenu && !menu.check()) return;
    setBuying(true);
    setBuyError(null);
    try {
      await cart.addItem(
        mainLine.variantId,
        mainLine.offerId,
        mainLine.quantity,
        custom.fields.length > 0 ? custom.toInput() : undefined,
        hasMenu ? menu.toInput() : undefined
      );
      for (const line of bundleExtraLines) await cart.addItem(line.variantId, undefined, line.quantity);
      // skip_cart: straight to the checkout; otherwise the cart, to review first.
      router.push(storeHref(basePath, ps.skip_cart ? "/checkout" : "/cart"));
    } catch (err) {
      if (!custom.showServerProblems(err)) {
        setBuyError(cartErrorMessage(err, t.form.errors, t.product.addFailed));
      }
      setBuying(false);
    }
  }

  function scrollToForm() {
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    formRef.current?.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
    window.setTimeout(() => {
      document.getElementById(fieldId(FORM_PREFIX, "fullName"))?.focus({ preventScroll: true });
    }, 450);
  }

  return (
    <div className="zt-pdp-info flex min-w-0 flex-col gap-6">
      {/* Title + price */}
      <div className={SHOPPER_ACCOUNTS_ENABLED ? "relative" : undefined}>
        {/* The heart shows once the store is known to have accounts: its corner is kept from the start, so the title never re-wraps around it. */}
        {SHOPPER_ACCOUNTS_ENABLED && (
          <div className="absolute end-0 -top-1.5 sm:-top-1">
            <WishlistHeart productId={product.id} look="page" />
          </div>
        )}
        <h1 className={`zt-pdp-title${SHOPPER_ACCOUNTS_ENABLED ? " pe-14" : ""} text-2xl font-bold leading-tight text-ink sm:text-3xl`}>{product.name}</h1>
        <div className={`zt-pdp-price mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1${testPending ? " invisible" : ""}`}>
          <span className="text-3xl font-bold text-ink" data-sale={compareAtUnit ? "" : undefined}>{money(unit)}</span>
          {compareAtUnit && (
            <span className="zt-pdp-compare text-lg text-ink-soft line-through">
              <span className="sr-only">{t.product.compareAt} </span>
              {money(compareAtUnit)}
            </span>
          )}
          {pct && (
            <span className="zt-pdp-save rounded-full bg-primary-soft px-2.5 py-1 text-sm font-semibold text-primary">
              {t.common.save(pct)}
            </span>
          )}
        </div>
        {/* What one unit of this product earns in points, on a store with a loyalty programme (lib/features). */}
        {LOYALTY_ENABLED && <EarnPointsNote unitMinor={unit} />}
        <p className={`mt-2 flex items-center gap-1.5 text-sm font-medium ${available ? "text-success" : choosing ? "text-ink-soft" : "text-danger"}${preorder ? " hidden" : ""}`}>
          {available && <CheckIcon size={16} />}
          {available
            ? t.common.inStock
            : choosing
              ? t.shop.chooseOptions
            : product.variants.length === 0
              ? t.common.unavailable
              : t.common.outOfStock}
        </p>
        {/* A pre-order's ship date, the product's purchase limits, a store on holiday: each only with its switch. */}
        <ProductBuyNotes product={product} preorder={preorder} />
      </div>

      {ps.countdown ? <OfferCountdown endsAt={ps.countdown.ends_at} /> : null}

      {/* Variant options */}
      {groups.map((group) => (
        <OptionPicker
          key={group.name}
          group={group}
          display={page.options.find((o) => o.name === group.name)}
          selected={selection[group.name]}
          isAvailable={(value) => isValueAvailable(group.name, value)}
          onSelect={(value) => setSelection((prev) => ({ ...prev, [group.name]: value }))}
        />
      ))}

      {/* "Size guide", when a chart reaches this product (SIZE_CHARTS_ENABLED). */}
      {SIZE_CHARTS_ENABLED && <SizeGuideLink workspaceId={workspaceId} productId={product.id} />}

      {bundleChoice && <BundlePicker selection={bundleChoice} product={product} mainVariant={variant} />}

      {/* Bundle / quantity offer */}
      {tiers.length > 1 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">{t.product.chooseOffer}</legend>
          <div className="grid gap-2">
            {tiers.map((x) => {
              const selected = tier?.id === x.id;
              const p = bundlePricing(unit, x.quantity, x);
              const badge = x.badge;
              return (
                <label
                  key={x.id}
                  className={`relative flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 p-3.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
                    selected ? "border-primary bg-primary-soft" : "border-line bg-paper-raised hover:border-primary"
                  }`}
                >
                  <input
                    type="radio"
                    name="bundle"
                    value={x.id}
                    checked={selected}
                    onChange={() => setTierId(x.id)}
                    className="h-5 w-5 shrink-0 cursor-pointer accent-primary"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink">{x.label ?? t.common.piece(x.quantity)}</span>
                      {x.discountPct > 0 && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-on-primary">
                          {t.common.save(x.discountPct)}
                        </span>
                      )}
                      {badge && (
                        <span className="rounded-full border border-primary/30 px-2 py-0.5 text-xs font-medium text-primary">
                          {badge}
                        </span>
                      )}
                    </span>
                    {p.saving > 0 && (
                      <span className="mt-0.5 block text-xs text-success">{t.product.youSave(money(p.saving))}</span>
                    )}
                  </span>
                  <span className="text-end">
                    <span className="block text-base font-bold text-ink">{money(p.total)}</span>
                    {p.saving > 0 && <span className="block text-xs text-ink-soft line-through">{money(p.full)}</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {tiers.length === 0 && !bundleChoice && !ps.hide_quantity_selector && (
        <div className="zt-pdp-qty flex items-center justify-between gap-4">
          <span id="qty-label" className="text-sm font-semibold text-ink">
            {t.product.quantity}
          </span>
          {/* The same stepper the cart page and the cart drawer use. */}
          <QuantityStepper value={quantity} onChange={setQuantity} labelledBy="qty-label" {...quantityLimits} />
        </div>
      )}

      {/* What the shopper fills in for this product (engraving, a note, their photo). */}
      <MenuOptionPicker state={menu} />
      <CustomFieldInputs state={custom} />

      {/* Primary CTA scrolls to the form; add-to-cart is the secondary path. */}
      {page.specialOfferText && (
        <p className="rounded-xl border border-primary/25 bg-primary-soft px-4 py-2.5 text-center text-sm font-semibold text-primary">
          {page.specialOfferText}
        </p>
      )}
      {/* Sold out with no pre-order: the sign-up to hear when it is back takes the buttons' place (STOCK_ALERTS_ENABLED). */}
      <RestockOrButtons product={product} variant={variant}>
      <div className="zt-pdp-buy grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={ps.inline_checkout ? scrollToForm : () => void buyNow()}
          disabled={!available || buying || holiday.paused}
          className={`${btnPrimary} w-full`}
        >
          {holiday.pausedLabel ?? (buying ? text.buying : preorder ? t.buyInfo.preorder : buyLabel)}
        </button>
        {bundleChoice && custom.fields.length === 0 && !hasMenu ? (
          <BundleAddToCartButton selection={bundleChoice} disabled={!available || !bundleChoice.available} />
        ) : (
        <AddToCartButton
          variant="secondary"
          variantId={mainLine?.variantId}
          offerId={mainLine?.offerId}
          defaultQuantity={mainLine?.quantity ?? 1}
          disabled={!available}
          customizations={custom.fields.length > 0 ? custom.toInput() : undefined}
          options={hasMenu ? menu.toInput() : undefined}
          beforeAdd={
            custom.fields.length > 0 || hasMenu ? () => (custom.fields.length === 0 || custom.check()) && (!hasMenu || menu.check()) : undefined
          }
          onAddError={custom.fields.length > 0 ? custom.showServerProblems : undefined}
        />
        )}
      </div>
      </RestockOrButtons>

      <p role="alert" className="text-sm font-medium text-danger empty:hidden">{buyError}</p>

      {ps.inline_checkout && !ps.checkout_before_description && description ? (
        <div className="whitespace-pre-line rounded-2xl border border-line bg-paper-raised p-5 text-base leading-relaxed text-ink-soft sm:p-6">
          {description}
        </div>
      ) : null}

      {/* Inline quick order form */}
      {ps.inline_checkout && (
      <section
        ref={formRef}
        id="order-form"
        aria-labelledby="order-form-title"
        className={`zt-pdp-order ${card} scroll-mt-24 border-2 border-primary/25 p-5 sm:p-6`}
      >
        <h2 id="order-form-title" className="flex items-center gap-2 text-lg font-bold text-ink">
          <CashIcon className="text-primary" />
          {t.form.title}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">{t.form.subtitle}</p>

        <form onSubmit={handleSubmit} onFocusCapture={onFormStart} noValidate className="mt-5 space-y-5">
          <OrderFormFields
            idPrefix={FORM_PREFIX}
            values={values}
            errors={errors}
            onChange={onFieldChange}
            fields={fields}
            pickup={storePickup}
            zones={storeZones}
          />
          {!pickingUp && !storeZones && <ShippingOptionPicker choice={shippingChoice} idPrefix={FORM_PREFIX} />}

          <dl className="space-y-2 rounded-xl bg-paper p-4 text-sm ">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">
                {product.name} × {bundleChoice ? bundleChoice.quantity : tier ? tier.quantity : quantity}
              </dt>
              <dd className="shrink-0 text-ink">{money(pricing.full)}</dd>
            </div>
            {fieldsExtra > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">{t.custom.extras}</dt>
                <dd className="shrink-0 text-ink">{money(fieldsExtra)}</dd>
              </div>
            )}
            {pricing.saving > 0 && (
              <div className="flex justify-between gap-3 text-success">
                <dt>{t.checkout.bundleSaving}</dt>
                <dd className="shrink-0">−{money(pricing.saving)}</dd>
              </div>
            )}
            {bumpOn && bump && (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">{bump.name}</dt>
                <dd className="shrink-0 text-ink">{money(bump.priceAmount)}</dd>
              </div>
            )}
            {productBumps.selected.map((b) => (
              <div key={b.offerId} className="flex justify-between gap-3">
                <dt className="text-ink-soft">{b.name}</dt>
                <dd className="shrink-0 text-ink">{money(b.priceAmount)}</dd>
              </div>
            ))}
            <DiscountRows extras={shipping.extras} coupon={coupon} />
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">{t.checkout.shippingFee}</dt>
              <dd className="shrink-0 text-ink">
                <ShippingFee line={shipping.line} />
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-line pt-2 text-base font-bold text-ink">
              <dt>{t.form.total}</dt>
              <dd className="shrink-0">{money(total)}</dd>
            </div>
          </dl>

          <MinimumOrderNotice extras={shipping.extras} />

          {bump && <OrderBumpCard bump={bump} checked={bumpOn} onChange={setBumpOn} idPrefix={FORM_PREFIX} />}
          <ProductBumpCards state={productBumps} idPrefix={FORM_PREFIX} />

          {(payment.methods.length > 1 || manualMethods.length > 0) && (
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
          )}

          <div role="alert" aria-live="assertive" className="empty:hidden">
            {formError && (
              <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{formError}</p>
            )}
          </div>

          <button type="submit" disabled={submitting || !available || holiday.paused} className={btnPrimaryLg}>
            {redirecting
              ? t.payment.redirecting
              : submitting
                ? t.form.submitting
                : `${method.method === "cod" || manualChosen ? t.form.submit : t.payment.payNow} — ${money(total)}`}
          </button>
          {method.method === "cod" && !manualChosen && (
            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-ink-soft">
              <CashIcon size={16} />
              {t.checkout.codHint}
            </p>
          )}
        </form>
      </section>
      )}

      {/* Sticky mobile bar: clears the home indicator, and steps aside while the form is on screen. Off when the product page says so. */}
      {ps.sticky_buy_button && (
      <StickyActionBar hidden={formVisible}>
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <p className="text-xs text-ink-soft">{t.form.total}</p>
            <p className="truncate text-base font-bold text-ink">{money(pricing.total)}</p>
          </div>
          <button
            type="button"
            onClick={ps.inline_checkout ? scrollToForm : () => void buyNow()}
            disabled={!available || buying || holiday.paused}
            tabIndex={formVisible ? -1 : 0}
            className={`${btnPrimary} flex-1`}
          >
            {holiday.pausedLabel ?? (preorder ? t.buyInfo.preorder : ps.buy_now_text || (ps.inline_checkout ? t.product.stickyOrder : text.buyNow))}
          </button>
        </div>
      </StickyActionBar>
      )}
    </div>
  );
}
