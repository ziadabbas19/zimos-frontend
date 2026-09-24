"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { parseMoney, type StorefrontProductDetail } from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { bundlePricing, bundleTiers, type OrderBumpOffer } from "@/lib/commerce";
import {
  EMPTY_ORDER_FORM,
  FIELD_ORDER,
  toCheckoutPayload,
  validateOrderForm,
  type OrderFormErrors,
  type OrderFormField,
  type OrderFormValues,
} from "@/lib/orderForm";
import { afterOrder, orderErrorMessage, placeCodOrder, type OrderLine } from "@/lib/placeOrder";
import { useCheckoutAutosave } from "@/lib/useCheckoutAutosave";
import {
  defaultOfferOf,
  discountPercent,
  findVariant,
  offerAppliesTo,
  optionGroups,
  variantUnitPrice,
} from "@/lib/product";
import { useStore } from "@/lib/StoreContext";
import { useStoreBasePath } from "../StoreRoute";
import { AddToCartButton } from "../AddToCartButton";
import { OrderBumpCard } from "../checkout/OrderBumpCard";
import { OrderFormFields, fieldId } from "../checkout/OrderFormFields";
import { CashIcon, CheckIcon } from "../Icons";
import { Countdown } from "../page-renderer/Countdown";
import { btnPrimary, btnPrimaryLg, card } from "../ui";

const FORM_PREFIX = "quick";

/**
 * The buy box of the product page, built as a cash-on-delivery landing:
 * variant pickers → bundle/quantity offer → inline quick order form with an
 * order bump → real COD checkout. "Add to cart" stays as a secondary path.
 */
export function ProductLanding({
  workspaceId,
  product,
  bump,
  countdownHours,
}: {
  workspaceId: string;
  product: StorefrontProductDetail;
  bump: OrderBumpOffer | null;
  countdownHours: number | null;
}) {
  const { t, money } = useStore();
  const basePath = useStoreBasePath();
  const router = useRouter();
  const [client] = useState(() => createStorefrontApiClient());

  // --- variant selection -------------------------------------------------
  const groups = useMemo(() => optionGroups(product.variants), [product.variants]);
  const initialVariant = product.variants.find((v) => v.inStock) ?? product.variants[0];
  const [selection, setSelection] = useState<Record<string, string>>(() => ({
    ...(initialVariant?.optionValues ?? {}),
  }));
  const variant = groups.length > 0 ? findVariant(product.variants, selection) : initialVariant;
  const available = !!variant?.inStock;

  function isValueAvailable(name: string, value: string) {
    return product.variants.some(
      (v) =>
        v.inStock &&
        v.optionValues?.[name] === value &&
        Object.entries(selection).every(([n, val]) => n === name || v.optionValues?.[n] === val)
    );
  }

  // --- bundles / quantity --------------------------------------------------
  const tiers = useMemo(() => bundleTiers(product), [product]);
  const [quantity, setQuantity] = useState(1);
  const [tierId, setTierId] = useState(
    () => product.offers.find((o) => o.isDefault)?.id ?? tiers[0]?.id ?? ""
  );
  const tier = tiers.find((x) => x.id === tierId);
  const unit = variantUnitPrice(product, variant);
  const pricing = bundlePricing(unit, quantity, tier);
  const compareAtUnit =
    variant?.compareAtAmount && parseMoney(variant.compareAtAmount) > unit ? parseMoney(variant.compareAtAmount) : null;
  const pct = discountPercent(unit, compareAtUnit);

  const defaultOffer = defaultOfferOf(product);
  const mainLine: OrderLine | null = variant
    ? tier
      ? { variantId: variant.id, offerId: tier.offerId, quantity: 1 }
      : {
          variantId: variant.id,
          offerId: defaultOffer && offerAppliesTo(defaultOffer, variant.id) ? defaultOffer.id : undefined,
          quantity,
        }
    : null;

  // --- form ----------------------------------------------------------------
  const [values, setValues] = useState<OrderFormValues>(EMPTY_ORDER_FORM);
  const [errors, setErrors] = useState<OrderFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bumpOn, setBumpOn] = useState(false);

  const total = pricing.total + (bumpOn && bump ? bump.priceAmount : 0);

  // The hook keys on the lines' content, so a fresh array each render is fine.
  const autosaveLines: OrderLine[] = mainLine ? [mainLine] : [];
  if (bumpOn && bump) autosaveLines.push({ variantId: bump.variantId, offerId: bump.offerId, quantity: 1 });
  const autosave = useCheckoutAutosave({ client, workspaceId, values, lines: autosaveLines });

  function onFieldChange(field: OrderFormField, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const found = validateOrderForm(values, t);
    setErrors(found);
    const invalid = FIELD_ORDER.filter((k) => found[k]);
    if (invalid.length > 0) {
      setFormError(t.form.errors.summary(invalid.length));
      document.getElementById(fieldId(FORM_PREFIX, invalid[0]))?.focus();
      return;
    }
    if (!variant || !available || !mainLine) {
      setFormError(t.form.errors.unavailable);
      return;
    }

    const bumpLine: OrderLine | null =
      bumpOn && bump ? { variantId: bump.variantId, offerId: bump.offerId, quantity: 1 } : null;
    setSubmitting(true);
    setFormError(null);
    const checkoutSessionId = await autosave.stop();
    const payload = {
      ...toCheckoutPayload(values, { item: bumpLine ? undefined : mainLine }),
      ...(checkoutSessionId ? { checkoutSessionId } : {}),
    };
    try {
      const order = await placeCodOrder({
        client,
        workspaceId,
        payload,
        lines: bumpLine ? [mainLine, bumpLine] : undefined,
      });
      router.push(afterOrder({ workspaceId, basePath, order, phone: payload.contact.phone }));
    } catch (err) {
      setFormError(orderErrorMessage(err, t.form.errors.generic));
      setSubmitting(false);
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

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      document.getElementById(fieldId(FORM_PREFIX, "fullName"))?.focus({ preventScroll: true });
    }, 450);
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* Title + price */}
      <div>
        <h1 className="text-2xl font-bold leading-tight text-ink sm:text-3xl">{product.name}</h1>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-3xl font-bold text-ink">{money(unit)}</span>
          {compareAtUnit && (
            <span className="text-lg text-ink-soft line-through">
              <span className="sr-only">{t.product.compareAt} </span>
              {money(compareAtUnit)}
            </span>
          )}
          {pct && (
            <span className="rounded-full bg-primary-soft px-2.5 py-1 text-sm font-semibold text-primary">
              {t.common.save(pct)}
            </span>
          )}
        </div>
        <p className={`mt-2 flex items-center gap-1.5 text-sm font-medium ${available ? "text-success" : "text-danger"}`}>
          {available && <CheckIcon size={16} />}
          {available ? t.common.inStock : t.common.outOfStock}
        </p>
      </div>

      {countdownHours ? <Countdown label={t.product.offerEnds} endsInHours={countdownHours} /> : null}

      {/* Variant options */}
      {groups.map((group) => (
        <fieldset key={group.name}>
          <legend className="mb-2 text-sm font-semibold text-ink">
            {group.name}
            {selection[group.name] && <span className="ms-2 font-normal text-ink-soft">{selection[group.name]}</span>}
          </legend>
          <div className="flex flex-wrap gap-2">
            {group.values.map((value) => {
              const selected = selection[group.name] === value;
              const ok = isValueAvailable(group.name, value);
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelection((prev) => ({ ...prev, [group.name]: value }))}
                  className={`min-h-11 min-w-11 cursor-pointer rounded-xl border-2 px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    selected
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-line bg-paper-raised text-ink hover:border-primary"
                  } ${ok ? "" : "text-ink-soft line-through decoration-1"}`}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

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

      {tiers.length === 0 && (
        <div className="flex items-center justify-between gap-4">
          <span id="qty-label" className="text-sm font-semibold text-ink">
            {t.product.quantity}
          </span>
          <div role="group" aria-labelledby="qty-label" className="inline-flex items-center rounded-xl border border-line bg-paper-raised">
            <button
              type="button"
              aria-label={t.product.decrease}
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="h-11 w-11 cursor-pointer text-lg text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              −
            </button>
            <output aria-live="polite" className="min-w-10 text-center text-base font-semibold tabular-nums text-ink">
              {quantity}
            </output>
            <button
              type="button"
              aria-label={t.product.increase}
              onClick={() => setQuantity((q) => Math.min(99, q + 1))}
              className="h-11 w-11 cursor-pointer text-lg text-ink"
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* Primary CTA scrolls to the form; add-to-cart is the secondary path. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={scrollToForm} disabled={!available} className={`${btnPrimary} w-full`}>
          {t.product.orderNow}
        </button>
        <AddToCartButton
          variant="secondary"
          variantId={mainLine?.variantId}
          offerId={mainLine?.offerId}
          defaultQuantity={mainLine?.quantity ?? 1}
          disabled={!available}
        />
      </div>

      {/* Inline quick order form */}
      <section
        ref={formRef}
        id="order-form"
        aria-labelledby="order-form-title"
        className={`${card} scroll-mt-24 border-2 border-primary/25 p-5 sm:p-6`}
      >
        <h2 id="order-form-title" className="flex items-center gap-2 text-lg font-bold text-ink">
          <CashIcon className="text-primary" />
          {t.form.title}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">{t.form.subtitle}</p>

        <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-5">
          <OrderFormFields idPrefix={FORM_PREFIX} values={values} errors={errors} onChange={onFieldChange} />

          <dl className="space-y-2 rounded-xl bg-paper p-4 text-sm ">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">
                {product.name} × {tier ? tier.quantity : quantity}
              </dt>
              <dd className="shrink-0 text-ink">{money(pricing.full)}</dd>
            </div>
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
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">{t.checkout.shippingFee}</dt>
              <dd className="shrink-0 text-ink">{t.checkout.shippingOnConfirmation}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-line pt-2 text-base font-bold text-ink">
              <dt>{t.form.total}</dt>
              <dd className="shrink-0">{money(total)}</dd>
            </div>
          </dl>

          {bump && <OrderBumpCard bump={bump} checked={bumpOn} onChange={setBumpOn} idPrefix={FORM_PREFIX} />}

          <div role="alert" aria-live="assertive" className="empty:hidden">
            {formError && (
              <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{formError}</p>
            )}
          </div>

          <button type="submit" disabled={submitting || !available} className={btnPrimaryLg}>
            {submitting ? t.form.submitting : `${t.form.submit} — ${money(total)}`}
          </button>
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-ink-soft">
            <CashIcon size={16} />
            {t.checkout.codHint}
          </p>
        </form>
      </section>

      {/* Sticky mobile bar */}
      <div
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper-raised/95 px-4 py-3 shadow-lg backdrop-blur transition-transform duration-200 md:hidden ${
          formVisible ? "translate-y-full" : "translate-y-0"
        }`}
        aria-hidden={formVisible}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <p className="text-xs text-ink-soft">{t.form.total}</p>
            <p className="truncate text-base font-bold text-ink">{money(pricing.total)}</p>
          </div>
          <button
            type="button"
            onClick={scrollToForm}
            disabled={!available}
            tabIndex={formVisible ? -1 : 0}
            className={`${btnPrimary} flex-1`}
          >
            {t.product.stickyOrder}
          </button>
        </div>
      </div>
    </div>
  );
}
