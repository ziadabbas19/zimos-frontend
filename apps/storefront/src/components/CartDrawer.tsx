"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import { useCart } from "@/lib/CartProvider";
import { variantLabel } from "@/lib/product";
import { lineImage } from "@/lib/variantImage";
import { useStore } from "@/lib/StoreContext";
import { cartErrorMessage } from "@/lib/placeOrder";
import { useCatalog } from "@/lib/useCatalog";
import { useDialog, useSheetPresence } from "@/lib/useDialog";
import { StoreLink } from "@/components/StoreRoute";
import { CartShippingSummary } from "@/components/checkout/CartShippingSummary";
import { HolidayCheckoutGate } from "@/components/holiday/HolidayCheckoutGate";
import { BoxIcon, CartGlyph, CrossIcon } from "./Icons";
import { QuantityStepper } from "./QuantityStepper";
import { StoreImage } from "./StoreImage";
import { backdrop, btnPrimaryLg, btnSecondary, focusRing, iconBtn, modalLayer, sheet, skeleton } from "./ui";
import { LineCustomizations } from "@/components/LineCustomizations";
import { LineOptions } from "@/components/LineOptions";
import { ComboLineFullTotal, ComboLineInfo, ComboLineThumb } from "@/components/combos/ComboLine";
import { comboLineImages, isComboLine } from "@/lib/combos";

/**
 * The cart as a slide-over, opened by "add to cart" anywhere in the store and
 * by the header's cart icon: the lines, a quantity stepper, the subtotal and
 * shipping (CartShippingSummary, quoted only while the drawer is open) and
 * the two ways out — checkout, or back to browsing. The cart page stays the
 * full view; this is the quick one.
 *
 * It reads the one cart from CartProvider (which also holds its open state),
 * so a change here shows on the cart page and the header count at once. The
 * live region below announces what changed for screen readers, whether the
 * drawer is open or not.
 */
export function CartDrawer() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { cart, isLoading, isAdding, itemCount, updateItem, removeItem, isDrawerOpen, closeDrawer } = useCart();
  const { t, money } = useStore();
  // The catalogue names and pictures the drawer's lines. It is read once the
  // cart has a line, the drawer opens or a line is on its way in (so the first
  // added line still shows its name and picture at once) — not on every page a
  // visitor with an empty cart opens. Once read, it stays.
  const [catalogWanted, setCatalogWanted] = useState(false);
  const wantsCatalog = catalogWanted || itemCount > 0 || isDrawerOpen || isAdding;
  useEffect(() => {
    if (wantsCatalog && !catalogWanted) setCatalogWanted(true);
  }, [wantsCatalog, catalogWanted]);
  const { byVariant, loaded } = useCatalog(wantsCatalog ? workspaceId : undefined);
  const pathname = usePathname();
  const dialogRef = useDialog<HTMLDivElement>({ open: isDrawerOpen, onClose: closeDrawer });
  // In the DOM only while open or sliding out — a closed sheet parked
  // off-screen would widen an RTL page (lib/useDialog).
  const { present, shown } = useSheetPresence(isDrawerOpen);

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A route change (checkout, a product link in a line) closes the drawer.
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      closeDrawer();
    }
  }, [pathname, closeDrawer]);

  // What the live region says: the count once it changes, the first
  // render excluded so a page load does not read the cart out.
  const [announcement, setAnnouncement] = useState("");
  const lastCount = useRef<number | null>(null);
  useEffect(() => {
    if (lastCount.current === null) {
      lastCount.current = itemCount;
      return;
    }
    if (lastCount.current === itemCount) return;
    lastCount.current = itemCount;
    const timer = window.setTimeout(() => setAnnouncement(itemCount > 0 ? t.shop.itemsInCart(itemCount) : t.cart.empty), 0);
    return () => window.clearTimeout(timer);
  }, [itemCount, t]);

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

  const currency = cart?.currency;
  const items = cart?.items ?? [];
  const isEmpty = items.length === 0;

  return (
    <>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {present && (
      <div className={modalLayer}>
      <div className={backdrop(shown)} aria-hidden onClick={closeDrawer} />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        aria-hidden={!isDrawerOpen}
        inert={!isDrawerOpen}
        className={sheet(shown)}
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line px-4 sm:px-5">
          <h2 id="cart-drawer-title" className="flex items-center gap-2 font-display text-lg font-bold text-ink">
            <CartGlyph className="text-primary" />
            {t.shop.drawerTitle}
            {itemCount > 0 && (
              <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                {new Intl.NumberFormat().format(itemCount)}
              </span>
            )}
          </h2>
          <button type="button" onClick={closeDrawer} aria-label={t.common.close} className={iconBtn}>
            <CrossIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          <div aria-live="polite" className="empty:hidden">
            {error && <p className="mb-3 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}
          </div>

          {isLoading && !cart ? (
            <ul aria-busy="true" aria-label={t.cart.loading} className="space-y-4">
              {[0, 1].map((i) => (
                <li key={i} className="flex gap-3">
                  <span className={`${skeleton} h-20 w-20 shrink-0`} />
                  <span className="flex-1 space-y-2 pt-1">
                    <span className={`${skeleton} block h-4 w-3/4`} />
                    <span className={`${skeleton} block h-3 w-1/3`} />
                    <span className={`${skeleton} block h-9 w-28`} />
                  </span>
                </li>
              ))}
            </ul>
          ) : isEmpty ? (
            <div className="flex flex-col items-center px-4 py-14 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                <CartGlyph size={32} />
              </span>
              <p className="mt-4 text-lg font-semibold text-ink">{t.cart.empty}</p>
              <p className="mt-1 text-sm text-ink-soft">{t.cart.emptyHint}</p>
              <button type="button" onClick={closeDrawer} className={`${btnSecondary} mt-6`}>
                {t.common.continueShopping}
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {items.map((line) => {
                const rowBusy = pendingId === line.id;
                const product = byVariant.get(line.variantId);
                // A whole combo on one line (lib/combos): its name and products, not its first product's.
                const combo = isComboLine(line);
                const comboImages = combo ? comboLineImages(line, byVariant) : [];
                // The variant's own picture, else the product's (lib/variantImage).
                const image = product ? lineImage(product, line.variantId) : null;
                const options = variantLabel(line.variant);
                const lineName = combo ? line.combo?.name : product?.name;
                return (
                  <li key={line.id} className={`flex gap-3 py-4 first:pt-0 transition-opacity ${rowBusy ? "opacity-60" : ""}`}>
                    {/* A fixed box, so the row keeps its height whether the photo has arrived or not. */}
                    <div className={`h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line bg-paper ${line.unavailable ? "opacity-50" : ""}`}>
                      {combo && comboImages.length > 0 ? (
                        <ComboLineThumb images={comboImages} />
                      ) : !combo && image ? (
                        <StoreImage src={image} alt="" width={80} height={80} sizes="80px" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      ) : loaded ? (
                        <div className="flex h-full w-full items-center justify-center text-primary/40">
                          <BoxIcon size={28} />
                        </div>
                      ) : (
                        <span className={`${skeleton} block h-full w-full rounded-none`} />
                      )}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {combo ? (
                            <ComboLineInfo line={line} />
                          ) : product ? (
                            <StoreLink
                              href={`/products/${product.slug}`}
                              className={`line-clamp-2 rounded text-sm font-semibold text-ink hover:text-primary ${focusRing}`}
                            >
                              {product.name}
                            </StoreLink>
                          ) : loaded ? (
                            <span className="text-sm font-semibold text-ink">{options || t.cart.item}</span>
                          ) : (
                            <span className={`${skeleton} block h-4 w-32`} />
                          )}
                          {!combo && product && options && <p className="mt-0.5 text-xs text-ink-soft">{options}</p>}
                          <LineOptions options={line.options} />
                          <LineCustomizations customizations={line.customizations} />
                          {!line.unavailable && <p className="mt-0.5 text-xs text-ink-soft">{t.cart.perUnit(money(line.currentUnitPrice, currency))}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => run(line.id, () => removeItem(line.id), t.cart.removeFailed)}
                          disabled={rowBusy}
                          aria-label={`${t.cart.remove}${lineName ? ` — ${lineName}` : ""}`}
                          className={`-me-2 -mt-2 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-soft transition-colors hover:text-danger disabled:opacity-50 ${focusRing}`}
                        >
                          <CrossIcon size={18} />
                        </button>
                      </div>

                      {/* A combo that can no longer be bought counts nothing: only the way to remove it. */}
                      {!line.unavailable && (
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <QuantityStepper
                            size="sm"
                            value={line.quantity}
                            disabled={rowBusy}
                            onChange={(next) => run(line.id, () => updateItem(line.id, next), t.cart.updateFailed)}
                          />
                          <span className="flex flex-wrap items-baseline justify-end gap-x-2">
                            <ComboLineFullTotal line={line} currency={currency} />
                            <span className="text-sm font-bold text-ink">{money(line.lineTotal, currency)}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {!isEmpty && cart && (
          // The checkout button clears the home indicator (0 where there is none).
          <div className="shrink-0 border-t border-line bg-paper-raised px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-5">
            <CartShippingSummary workspaceId={workspaceId} cart={cart} enabled={isDrawerOpen} />
            <div className="mt-4 grid gap-2">
              {/* On holiday: the same link under its ship date, or a button that is off while orders are paused. */}
              <HolidayCheckoutGate buttonClassName={btnPrimaryLg}>
                <StoreLink href="/checkout" className={btnPrimaryLg} data-autofocus="">
                  {t.cart.checkout}
                </StoreLink>
              </HolidayCheckoutGate>
              <button type="button" onClick={closeDrawer} className={btnSecondary}>
                {t.common.continueShopping}
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
      )}
    </>
  );
}
