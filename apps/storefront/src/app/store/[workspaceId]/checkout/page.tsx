"use client";

import { useMemo, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import { OrderBumpCard } from "@/components/checkout/OrderBumpCard";
import { OrderFormFields, fieldId } from "@/components/checkout/OrderFormFields";
import { PaymentMethodPicker } from "@/components/checkout/PaymentMethodPicker";
import { ShippingFee } from "@/components/checkout/ShippingFee";
import { ArrowIcon } from "@/components/Icons";
import { StoreLink, useStoreBasePath } from "@/components/StoreRoute";
import { btnPrimaryLg, btnSecondary, card, container, input } from "@/components/ui";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useCart } from "@/lib/CartProvider";
import { getOrderBump } from "@/lib/commerce";
import {
  EMPTY_ORDER_FORM,
  FIELD_ORDER,
  toCheckoutPayload,
  validateOrderForm,
  type OrderFormErrors,
  type OrderFormField,
  type OrderFormValues,
} from "@/lib/orderForm";
import { afterOrder, orderErrorMessage, placeCodOrder, serverFieldErrors } from "@/lib/placeOrder";
import { placeOnlineOrder, usePaymentMethods } from "@/lib/payments";
import { variantLabel } from "@/lib/product";
import { useStore } from "@/lib/StoreContext";
import { useCatalog } from "@/lib/useCatalog";
import { useCheckoutAutosave } from "@/lib/useCheckoutAutosave";
import { useShippingQuote } from "@/lib/useShippingQuote";
import { useFreshCheckoutSettings, useOrderFormFields } from "@/lib/useOrderFormFields";

const FORM_PREFIX = "checkout";

export default function CheckoutPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const basePath = useStoreBasePath();
  const { cart, addItem, clearCart } = useCart();
  const { t, money } = useStore();
  const [client] = useState(() => createStorefrontApiClient());
  const { fields, reveal } = useOrderFormFields(useFreshCheckoutSettings(client, workspaceId));
  const { products, byVariant, loaded } = useCatalog(workspaceId);

  const [values, setValues] = useState<OrderFormValues>(EMPTY_ORDER_FORM);
  const [errors, setErrors] = useState<OrderFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [appliedCode, setAppliedCode] = useState("");
  const [bumpOn, setBumpOn] = useState(false);
  // True once the bump is a real cart line (a failed order leaves it there).
  const [bumpAdded, setBumpAdded] = useState(false);
  const payment = usePaymentMethods(client, workspaceId);
  const [methodId, setMethodId] = useState<string | null>(null);
  const method = payment.methods.find((m) => m.id === methodId) ?? payment.methods[0];
  const [redirecting, setRedirecting] = useState(false);

  const currency = cart?.currency ?? "EGP";
  const items = cart?.items ?? [];
  const autosave = useCheckoutAutosave({ client, workspaceId, values, lines: items });

  const bump = useMemo(() => {
    if (!loaded) return null;
    const inCart = new Set(items.map((l) => byVariant.get(l.variantId)?.id).filter(Boolean) as string[]);
    return getOrderBump(products ?? [], [...inCart]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, products]);

  // Once the bump is a real line in the cart, the cart subtotal already has it.
  const bumpInTotals = bumpOn && bump && !bumpAdded ? bump.priceAmount : 0;
  const subtotal = cart?.subtotal ?? 0;
  // The bump counts toward the parcel's weight as soon as it's ticked.
  const quoteLines = items.map((l) => ({ variantId: l.variantId, offerId: l.offerId, quantity: l.quantity }));
  if (bumpInTotals > 0 && bump) quoteLines.push({ variantId: bump.variantId, offerId: bump.offerId ?? null, quantity: 1 });
  const shipping = useShippingQuote({ client, workspaceId, governorate: values.governorate, lines: quoteLines });
  const total = subtotal + bumpInTotals + shipping.amount;

  function onFieldChange(field: OrderFormField, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const found = validateOrderForm(values, t, fields);
    setErrors(found);
    const invalid = FIELD_ORDER.filter((k) => found[k]);
    if (invalid.length > 0) {
      setFormError(t.form.errors.summary(invalid.length));
      document.getElementById(fieldId(FORM_PREFIX, invalid[0]))?.focus();
      return;
    }
    if (!cart || items.length === 0) {
      setFormError(t.form.errors.emptyCart);
      return;
    }

    const systemNotes: string[] = [];

    setSubmitting(true);
    setFormError(null);
    const checkoutSessionId = await autosave.stop();
    try {
      if (bumpOn && bump && !bumpAdded) {
        await addItem(bump.variantId, bump.offerId, 1);
        setBumpAdded(true);
      }

      const payload = {
        ...toCheckoutPayload(values, fields, { discountCode: appliedCode, systemNotes }),
        ...(checkoutSessionId ? { checkoutSessionId } : {}),
      };
      if (method.method !== "cod") {
        const { next, external } = await placeOnlineOrder({
          client,
          workspaceId,
          basePath,
          payload,
          method,
          cartToken: cart.guestToken,
        });
        clearCart();
        if (external) {
          setRedirecting(true);
          window.location.assign(next);
        } else {
          router.push(next);
        }
        return;
      }
      const order = await placeCodOrder({ client, workspaceId, payload, cartToken: cart.guestToken });
      clearCart();
      router.push(afterOrder({ workspaceId, basePath, order, phone: payload.contact.phone }));
    } catch (err) {
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
        document.getElementById(fieldId(FORM_PREFIX, invalid[0]))?.focus();
      } else {
        setFormError(orderErrorMessage(err, t.form.errors));
        setSubmitting(false);
      }
      autosave.resume();
    }
  }

  return (
    <main className={`${container} flex-1 py-8 sm:py-10`}>
      <StoreLink
        href="/cart"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-medium text-ink-soft hover:text-primary"
      >
        <ArrowIcon size={16} className="rotate-180 rtl:rotate-0" />
        {t.checkout.backToCart}
      </StoreLink>
      <h1 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">{t.checkout.title}</h1>

      <form onSubmit={handleSubmit} noValidate className="mt-8 grid gap-8 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <section className={`${card} p-5 sm:p-6`} aria-labelledby="shipping-title">
            <h2 id="shipping-title" className="text-lg font-semibold text-ink">
              {t.checkout.shipping}
            </h2>
            <div className="mt-4">
              <OrderFormFields
                idPrefix={FORM_PREFIX}
                values={values}
                errors={errors}
                onChange={onFieldChange}
                fields={fields}
                showAltPhone
              />
            </div>
          </section>

          <section className={`${card} p-5 sm:p-6`} aria-labelledby="payment-title">
            <h2 id="payment-title" className="text-lg font-semibold text-ink">
              {t.checkout.payment}
            </h2>
            <PaymentMethodPicker
              methods={payment.methods}
              value={method.id}
              onChange={setMethodId}
              idPrefix={FORM_PREFIX}
            />
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
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
                        <span className="text-xs"> × {line.quantity}</span>
                      </span>
                      <span className="shrink-0 font-medium text-ink">{money(line.lineTotal, currency)}</span>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Discount code — validated by the backend at checkout (no public preview endpoint). */}
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
                    onClick={() => setAppliedCode("")}
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
                    dir="ltr"
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                    className={`${input} uppercase`}
                  />
                  <button
                    type="button"
                    onClick={() => codeInput.trim() && setAppliedCode(codeInput.trim())}
                    className={btnSecondary}
                  >
                    {t.checkout.apply}
                  </button>
                </div>
              )}
            </div>

            <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">{t.checkout.subtotal}</dt>
                <dd className="text-ink">{money(subtotal, currency)}</dd>
              </div>
              {bumpInTotals > 0 && bump && (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-soft">{bump.name}</dt>
                  <dd className="text-ink">{money(bump.priceAmount, currency)}</dd>
                </div>
              )}
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
            <p className="mt-2 text-xs text-ink-soft">{t.checkout.finalNote}</p>
          </section>

          {bump && items.length > 0 && (
            <OrderBumpCard bump={bump} checked={bumpOn} onChange={setBumpOn} idPrefix={FORM_PREFIX} />
          )}

          <div role="alert" aria-live="assertive" className="empty:hidden">
            {formError && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{formError}</p>}
          </div>

          <button type="submit" disabled={submitting || items.length === 0} className={btnPrimaryLg}>
            {redirecting
              ? t.payment.redirecting
              : submitting
                ? t.checkout.placing
                : method.method === "cod"
                  ? t.checkout.place
                  : t.payment.payNow}
          </button>
        </aside>
      </form>
    </main>
  );
}
