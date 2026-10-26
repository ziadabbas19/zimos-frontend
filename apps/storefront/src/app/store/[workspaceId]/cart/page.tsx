"use client";

import { CrossSellStrip } from "@/components/offers/StoreOffers";
import { useState } from "react";
import { useParams } from "next/navigation";
import { BoxIcon, CartGlyph } from "@/components/Icons";
import { QuantityStepper } from "@/components/QuantityStepper";
import { StoreImage } from "@/components/StoreImage";
import { CartBodyBones, SkeletonStatus } from "@/components/Skeleton";
import { StoreLink } from "@/components/StoreRoute";
import { TrustStrip } from "@/components/TrustStrip";
import { storeCards } from "@/lib/storePromises";
import { CartShippingSummary } from "@/components/checkout/CartShippingSummary";
import { HolidayCheckoutGate } from "@/components/holiday/HolidayCheckoutGate";
import { btnPrimaryLg, btnSecondary, card, container } from "@/components/ui";
import { useCart } from "@/lib/CartProvider";
import { variantLabel } from "@/lib/product";
import { lineImage } from "@/lib/variantImage";
import { useStore } from "@/lib/StoreContext";
import { cartErrorMessage } from "@/lib/placeOrder";
import { useCatalog } from "@/lib/useCatalog";
import { LineCustomizations } from "@/components/LineCustomizations";
import { LineOptions } from "@/components/LineOptions";
import { XsPageStrip } from "@/components/xs/XsPageStrip";
import { storePageAttrs, stripHoldsTitle } from "@/lib/xsStorePages";

export default function CartPage() {
  // Still needed for the catalogue lookup — the links go through StoreLink,
  // which resolves this store’s own prefix.
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { cart, isLoading, updateItem, removeItem } = useCart();
  const { t, money, store, locale } = useStore();
  // On a store that wears a template, its shop's title strip (lib/xsStorePages).
  const xsPages = store?.xsPages ?? null;
  const { byVariant } = useCatalog(workspaceId);

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currency = cart?.currency;
  const isEmpty = !cart || cart.items.length === 0;

  async function run(lineId: string, action: () => Promise<void>, fallback: string) {
    if (pendingId) return;
    setPendingId(lineId);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(cartErrorMessage(err, t.form.errors, fallback));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <main className="flex-1" {...storePageAttrs("cart", xsPages)}>
      {xsPages && (
        <XsPageStrip
          pages={xsPages}
          title={stripHoldsTitle(xsPages) ? (xsPages.titles.cart ?? t.cart.title) : undefined}
          label={t.catalog.breadcrumbs}
          crumbs={[{ label: t.common.home, href: "/" }, { label: xsPages.titles.cart ?? t.cart.title }]}
        />
      )}
      <div className={`${container} py-8 sm:py-10`}>
      {!stripHoldsTitle(xsPages) && <h1 className="zt-page-title font-display text-2xl font-bold text-ink sm:text-3xl">{t.cart.title}</h1>}

      {isLoading && !cart ? (
        // The page's own shape while the cart resolves, so nothing jumps when it lands (the same bones a navigation here shows).
        <SkeletonStatus label={t.cart.loading}>
          <CartBodyBones />
        </SkeletonStatus>
      ) : isEmpty ? (
        <div className={`${card} mt-8 flex flex-col items-center px-6 py-16 text-center`}>
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <CartGlyph size={32} />
          </span>
          <p className="mt-4 text-lg font-semibold text-ink">{t.cart.empty}</p>
          <p className="mt-1 text-sm text-ink-soft">{t.cart.emptyHint}</p>
          <StoreLink href="/" className={`${btnSecondary} mt-6`}>
            {t.common.continueShopping}
          </StoreLink>
        </div>
      ) : (
        // minmax(0, …): a long name or a wide price row must not widen the
        // column past the screen (a bare `1fr` grows to its content).
        <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div>
            <div aria-live="polite" className="empty:hidden">
              {error && <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}
            </div>

            <ul className={`${card} divide-y divide-line`}>
              {cart.items.map((line) => {
                const rowBusy = pendingId === line.id;
                const product = byVariant.get(line.variantId);
                // The variant's own picture, else the product's (lib/variantImage).
                const image = product ? lineImage(product, line.variantId) : null;
                const options = variantLabel(line.variant);
                return (
                  <li key={line.id} className={`flex gap-4 p-4 sm:p-5 ${rowBusy ? "opacity-60" : ""}`}>
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line bg-paper">
                      {image ? (
                        <StoreImage src={image} alt="" width={80} height={80} sizes="80px" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-primary/40">
                          <BoxIcon size={28} />
                        </div>
                      )}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          {product ? (
                            <StoreLink
                              href={`/products/${product.slug}`}
                              className="line-clamp-2 text-sm font-semibold text-ink hover:text-primary"
                            >
                              {product.name}
                            </StoreLink>
                          ) : (
                            <span className="text-sm font-semibold text-ink">{options || t.cart.item}</span>
                          )}
                          {product && options && <p className="mt-0.5 text-xs text-ink-soft">{options}</p>}
                          <LineOptions options={line.options} />
                          <LineCustomizations customizations={line.customizations} />
                        </div>
                        <button
                          type="button"
                          onClick={() => run(line.id, () => removeItem(line.id), t.cart.removeFailed)}
                          disabled={rowBusy}
                          className="-me-2 -mt-2 inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg px-2 text-xs font-medium text-danger hover:underline disabled:opacity-50"
                        >
                          {t.cart.remove}
                        </button>
                      </div>

                      <span className="text-xs text-ink-soft">{t.cart.perUnit(money(line.currentUnitPrice, currency))}</span>
                      {line.priceChanged && <span className="mt-1 text-xs text-accent-dark">{t.cart.priceChanged}</span>}

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                        {/* The same stepper the drawer and the product page use. */}
                        <QuantityStepper
                          size="sm"
                          value={line.quantity}
                          disabled={rowBusy}
                          onChange={(next) => run(line.id, () => updateItem(line.id, next), t.cart.updateFailed)}
                        />
                        <span className="text-base font-bold text-ink">{money(line.lineTotal, currency)}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className={`${card} p-5`}>
              <h2 className="text-base font-semibold text-ink">{t.cart.summary}</h2>
              {/* Shipping comes from the same quote the order is charged by,
                  once the shopper picks a governorate here or at checkout. */}
              <div className="mt-4">
                <CartShippingSummary workspaceId={workspaceId} cart={cart} />
              </div>
              {/* On holiday: the same link under its ship date, or a button that is off while orders are paused. */}
              <HolidayCheckoutGate buttonClassName={`${btnPrimaryLg} mt-5`} noteClassName="mt-4">
                <StoreLink href="/checkout" className={`${btnPrimaryLg} mt-5`}>
                  {t.cart.checkout}
                </StoreLink>
              </HolidayCheckoutGate>
              <StoreLink
                href="/"
                className="mt-2 flex min-h-11 items-center justify-center text-sm font-medium text-primary hover:underline"
              >
                {t.common.continueShopping}
              </StoreLink>
            </div>
            <TrustStrip cards={storeCards(store)} locale={locale} compact />
          </aside>
        </div>
      )}

      {/* What goes with the cart: the merchant's cross-sell rule, or what was bought together. */}
      {!isEmpty && cart && (
        <CrossSellStrip
          workspaceId={workspaceId}
          placement="cart"
          productIds={[...new Set(cart.items.map((line) => byVariant.get(line.variantId)?.id).filter((id): id is string => Boolean(id)))]}
        />
      )}
      </div>
    </main>
  );
}
