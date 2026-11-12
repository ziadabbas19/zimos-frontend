"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useParams, usePathname } from "next/navigation";
import type { Cart, CartLine, StorefrontCartRewards } from "@store-builder/api-client";
import { CART_EASE, CartRewardsBar, reducedMotion, useTweenedNumber } from "@store-builder/ui/cart-rewards";
import { useCart } from "@/lib/CartProvider";
import { variantLabel } from "@/lib/product";
import { lineImage } from "@/lib/variantImage";
import { useStore } from "@/lib/StoreContext";
import { cartErrorMessage } from "@/lib/placeOrder";
import { useCatalog } from "@/lib/useCatalog";
import { useDialog, useSheetPresence } from "@/lib/useDialog";
import { pickText } from "@/lib/i18n";
import { CART_REWARDS_ENABLED } from "@/lib/features";
import { barTiers, rewardsLocale, trustLines, useCartRewardsConfig } from "@/lib/cartRewards";
import { comboLineImages, isComboLine } from "@/lib/combos";
import { StoreLink } from "@/components/StoreRoute";
import { CartShippingSummary, useCartQuote } from "@/components/checkout/CartShippingSummary";
import { HolidayCheckoutGate } from "@/components/holiday/HolidayCheckoutGate";
import { LineCustomizations } from "@/components/LineCustomizations";
import { LineOptions } from "@/components/LineOptions";
import { ComboLineFullTotal, ComboLineInfo, ComboLineThumb } from "@/components/combos/ComboLine";
import { CartDrawer } from "@/components/CartDrawer";
import { BoxIcon, CartGlyph, CrossIcon } from "@/components/Icons";
import { QuantityStepper } from "@/components/QuantityStepper";
import { StoreImage } from "@/components/StoreImage";
import { btnPrimaryLg, btnSecondary, focusRing, iconBtn, modalLayer, skeleton } from "@/components/ui";
import { SavedBanner } from "./RewardRows";

/**
 * The cart with rewards (CART_REWARDS_ENABLED, for a store whose merchant
 * switched cart rewards on): a bottom sheet on a phone, a side drawer from
 * the inline end on a wider screen. Top to bottom: the rewards bar, the
 * lines, "you saved", the totals, then the way to checkout and the
 * merchant's trust lines.
 *
 * Every number comes from the server: the cart's lines, and the shipping
 * quote (asked once, shared by the bar and the totals) for the reward, the
 * discounts and the total — the same function that prices the order. A
 * quantity change shows at once on its line (and goes back if the server
 * refuses it); the totals and the bar follow the server's answer, gliding to
 * their new numbers.
 *
 * Motion: the sheet opens and closes in 260 ms on the cart's ease-out curve
 * with the backdrop fading alongside; on a phone it can be dragged down from
 * anywhere while its content is scrolled to the top, and let go it closes or
 * snaps back by how far and how fast it went. A removed line fades and folds
 * away in 200 ms. Only transform and opacity animate (and the removed row's
 * own height). Under reduced motion it all happens at once.
 *
 * Keyboard and screen readers: a modal dialog (lib/useDialog: Tab stays
 * inside, Escape closes, focus goes back), a live region for the count.
 */

const DURATION = 260;
const REMOVE_MS = 200;

const TEXT = {
  en: { title: "Shopping cart", completeOrder: "Complete order", trust: "Why shop with us" },
  ar: { title: "سلة المشتريات", completeOrder: "كمّل الطلب", trust: "ليه تشتري مننا" },
};

/** The store's cart: the rewards sheet when the store has rewards, the drawer as it always was otherwise. */
export function CartDrawerSwitch() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const config = useCartRewardsConfig(CART_REWARDS_ENABLED ? workspaceId : undefined);
  if (!CART_REWARDS_ENABLED || !config) return <CartDrawer />;
  return <CartSheet config={config} />;
}

const EMPTY_CART: Cart = { id: "", guestToken: "", currency: "EGP", status: "active", items: [], subtotal: 0 };

/** One amount that glides to its new value. */
function Money({ value, currency, className }: { value: number; currency?: string; className?: string }) {
  const { money } = useStore();
  const shown = useTweenedNumber(value);
  return <span className={className}>{money(shown, currency)}</span>;
}

interface Leaving {
  line: CartLine;
  /** Where the row was, so it folds away in place once the server's cart no longer has it. */
  index: number;
  /** The fold has finished. */
  folded: boolean;
  /** The server has removed it. */
  gone: boolean;
}

export function CartSheet({ config }: { config: StorefrontCartRewards }) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { cart, isLoading, isAdding, itemCount, updateItem, removeItem, isDrawerOpen, closeDrawer } = useCart();
  const { t, locale, money } = useStore();
  const text = pickText(TEXT, locale);
  const lang = rewardsLocale(locale);

  // The catalogue names and pictures the lines; read once the cart has a line, the sheet opens or a line is on its way in.
  const [catalogWanted, setCatalogWanted] = useState(false);
  const wantsCatalog = catalogWanted || itemCount > 0 || isDrawerOpen || isAdding;
  // Once wanted, kept (adjusted while rendering, not in an effect: no second pass).
  if (wantsCatalog && !catalogWanted) setCatalogWanted(true);
  const { byVariant, loaded } = useCatalog(wantsCatalog ? workspaceId : undefined);

  const pathname = usePathname();
  const dialogRef = useDialog<HTMLDivElement>({ open: isDrawerOpen, onClose: closeDrawer });
  const { present, shown } = useSheetPresence(isDrawerOpen, DURATION);
  const backdropRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // A route change (checkout, a product link in a line) closes the sheet.
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      closeDrawer();
    }
  }, [pathname, closeDrawer]);

  // The count, said once it changes (not on the first draw).
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

  // The quote, asked only while the sheet is open: the bar and the totals read the same one.
  const quote = useCartQuote({ workspaceId, cart: cart ?? EMPTY_CART, enabled: isDrawerOpen && Boolean(cart && cart.items.length > 0) });
  const rewards = quote.shipping.rewards;

  // ---- quantities: shown at once, sent one at a time per line, the last one wins; refused = back to the server's.
  const [error, setError] = useState<string | null>(null);
  const [wanted, setWanted] = useState<Record<string, number>>({});
  const desired = useRef(new Map<string, number>());
  const sending = useRef(new Set<string>());
  async function send(lineId: string) {
    if (sending.current.has(lineId)) return;
    sending.current.add(lineId);
    try {
      while (desired.current.has(lineId)) {
        const quantity = desired.current.get(lineId) as number;
        try {
          await updateItem(lineId, quantity);
        } catch (err) {
          desired.current.delete(lineId);
          setError(cartErrorMessage(err, t.form.errors, t.cart.updateFailed));
          break;
        }
        if (desired.current.get(lineId) === quantity) desired.current.delete(lineId);
      }
    } finally {
      sending.current.delete(lineId);
      setWanted(Object.fromEntries(desired.current));
    }
  }
  function changeQuantity(lineId: string, quantity: number) {
    setError(null);
    desired.current.set(lineId, quantity);
    setWanted(Object.fromEntries(desired.current));
    void send(lineId);
  }

  // ---- removal: the row folds away while the server removes it; refused = it unfolds again.
  const [leaving, setLeaving] = useState<Record<string, Leaving>>({});
  const settle = (id: string, change: Partial<Leaving>) =>
    setLeaving((all) => {
      const entry = all[id];
      if (!entry) return all;
      const next = { ...entry, ...change };
      const rest = { ...all };
      delete rest[id];
      return next.folded && next.gone ? rest : { ...rest, [id]: next };
    });
  async function remove(line: CartLine) {
    if (leaving[line.id]) return;
    setError(null);
    desired.current.delete(line.id);
    const index = Math.max(0, (cart?.items ?? []).findIndex((l) => l.id === line.id));
    setLeaving((all) => ({ ...all, [line.id]: { line, index, folded: false, gone: false } }));
    window.setTimeout(() => settle(line.id, { folded: true }), reducedMotion() ? 0 : REMOVE_MS);
    try {
      await removeItem(line.id);
      settle(line.id, { gone: true });
    } catch (err) {
      setLeaving((all) => {
        const rest = { ...all };
        delete rest[line.id];
        return rest;
      });
      setError(cartErrorMessage(err, t.form.errors, t.cart.removeFailed));
    }
  }

  // The rows: the server's lines, with any row still folding away kept where it was.
  const lines: CartLine[] = [...(cart?.items ?? [])];
  for (const [id, entry] of Object.entries(leaving).sort((a, b) => a[1].index - b[1].index)) {
    if (lines.some((l) => l.id === id)) continue;
    lines.splice(Math.min(entry.index, lines.length), 0, entry.line);
  }
  const isEmpty = lines.length === 0;
  const currency = cart?.currency;
  const moneyOf = (amount: number) => money(amount, currency);

  // ---- swipe down to close (touch, phones only): from the handle and header, or from the content while it is at its top.
  useEffect(() => {
    const sheetEl = dialogRef.current;
    if (!present || !sheetEl) return;
    let drag: { startY: number; base: number; lastY: number; lastT: number; v: number; dy: number; active: boolean } | null = null;
    const backdropEl = backdropRef.current;
    const wide = () => typeof window.matchMedia === "function" && window.matchMedia("(min-width: 640px)").matches;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || wide() || !isDrawerOpen) return;
      const target = e.target as HTMLElement;
      const body = bodyRef.current;
      const inBody = Boolean(body && body.contains(target));
      // A field or a control keeps its own touch.
      if (target.closest("select, input, textarea, [data-no-drag]")) return;
      if (inBody && body && body.scrollTop > 0) return;
      // Grabbed mid-slide: start from where the sheet is now.
      const matrix = new DOMMatrixReadOnly(getComputedStyle(sheetEl).transform === "none" ? undefined : getComputedStyle(sheetEl).transform);
      drag = { startY: e.touches[0].clientY, base: matrix.m42, lastY: e.touches[0].clientY, lastT: e.timeStamp, v: 0, dy: 0, active: false };
    };
    const onMove = (e: TouchEvent) => {
      if (!drag) return;
      const y = e.touches[0].clientY;
      const dy = y - drag.startY;
      if (!drag.active) {
        if (Math.abs(dy) < 6) return;
        // Upwards is the content's scroll, not a drag.
        if (dy < 0) {
          drag = null;
          return;
        }
        drag.active = true;
        // The finger moves it now; the duration and curve set on the element stay for the release.
        sheetEl.style.transitionProperty = "none";
        if (backdropEl) backdropEl.style.transitionProperty = "none";
      }
      e.preventDefault();
      const dt = e.timeStamp - drag.lastT;
      if (dt > 0) drag.v = 0.7 * ((y - drag.lastY) / dt) + 0.3 * drag.v;
      drag.lastY = y;
      drag.lastT = e.timeStamp;
      drag.dy = Math.max(0, drag.base + dy);
      sheetEl.style.transform = `translateY(${drag.dy}px)`;
      if (backdropEl) backdropEl.style.opacity = String(Math.max(0, 1 - drag.dy / Math.max(1, sheetEl.offsetHeight)));
    };
    const onEnd = () => {
      const d = drag;
      drag = null;
      if (!d || !d.active) return;
      sheetEl.style.transitionProperty = "";
      if (backdropEl) backdropEl.style.transitionProperty = "";
      // A flick (faster than half a pixel a millisecond) or a third of the way down closes it; less snaps back.
      if (d.v > 0.5 || d.dy > sheetEl.offsetHeight / 3) {
        if (backdropEl) backdropEl.style.opacity = "";
        closeDrawer();
      } else {
        sheetEl.style.transform = "";
        if (backdropEl) backdropEl.style.opacity = "";
      }
    };
    sheetEl.addEventListener("touchstart", onStart, { passive: true });
    sheetEl.addEventListener("touchmove", onMove, { passive: false });
    sheetEl.addEventListener("touchend", onEnd);
    sheetEl.addEventListener("touchcancel", onEnd);
    return () => {
      sheetEl.removeEventListener("touchstart", onStart);
      sheetEl.removeEventListener("touchmove", onMove);
      sheetEl.removeEventListener("touchend", onEnd);
      sheetEl.removeEventListener("touchcancel", onEnd);
    };
  }, [present, isDrawerOpen, closeDrawer, dialogRef]);

  // A sheet opened again starts clean (a drag may have left it where the finger let go).
  useEffect(() => {
    if (isDrawerOpen && dialogRef.current) dialogRef.current.style.transform = "";
  }, [isDrawerOpen, dialogRef]);

  const motion: CSSProperties = { transitionDuration: `${DURATION}ms`, transitionTimingFunction: CART_EASE };
  const trust = trustLines(config, locale);
  const tiers = barTiers(config, rewards);

  return (
    <>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {present && (
        <div className={modalLayer}>
          <div
            ref={backdropRef}
            aria-hidden
            onClick={closeDrawer}
            className={`absolute inset-0 bg-ink/40 transition-opacity motion-reduce:transition-none ${shown ? "opacity-100" : "pointer-events-none opacity-0"}`}
            style={motion}
          />

          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-sheet-title"
            aria-hidden={!isDrawerOpen}
            inert={!isDrawerOpen}
            className={`absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-3xl bg-paper-raised shadow-2xl will-change-transform transition-transform motion-reduce:transition-none sm:inset-y-0 sm:start-auto sm:end-0 sm:max-h-none sm:w-full sm:max-w-md sm:rounded-none ${
              shown ? "translate-y-0 sm:translate-x-0" : "translate-y-full sm:translate-x-full sm:translate-y-0 sm:rtl:-translate-x-full"
            }`}
            style={motion}
          >
            {/* The handle says the sheet can be pulled down (phones). */}
            <div className="flex shrink-0 justify-center pt-2.5 sm:hidden" aria-hidden="true">
              <span className="h-1.5 w-10 rounded-full bg-line-strong/70" />
            </div>

            <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line px-4 sm:h-16 sm:px-5">
              <h2 id="cart-sheet-title" className="flex items-center gap-2 font-display text-lg font-bold text-ink">
                <CartGlyph className="text-primary" />
                {text.title}
                {itemCount > 0 && (
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold tabular-nums text-primary">
                    {new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en").format(itemCount)}
                  </span>
                )}
              </h2>
              <button type="button" onClick={closeDrawer} aria-label={t.common.close} className={iconBtn} data-no-drag="">
                <CrossIcon />
              </button>
            </div>

            <div ref={bodyRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
              <div aria-live="polite" className="empty:hidden">
                {error && <p className="mb-3 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}
              </div>

              {isLoading && !cart ? (
                <div aria-busy="true" aria-label={t.cart.loading} className="space-y-4">
                  <CartRewardsBar tiers={tiers} subtotal={0} applied={null} locale={lang} formatMoney={moneyOf} loading />
                  {[0, 1].map((i) => (
                    <div key={i} className="flex gap-3">
                      <span className={`${skeleton} h-20 w-20 shrink-0`} />
                      <span className="flex-1 space-y-2 pt-1">
                        <span className={`${skeleton} block h-4 w-3/4`} />
                        <span className={`${skeleton} block h-3 w-1/3`} />
                        <span className={`${skeleton} block h-9 w-28`} />
                      </span>
                    </div>
                  ))}
                </div>
              ) : isEmpty ? (
                <div className="space-y-6">
                  {/* An empty cart still shows what the first reward needs. */}
                  <CartRewardsBar tiers={tiers} subtotal={0} applied={null} locale={lang} formatMoney={moneyOf} />
                  <div className="flex flex-col items-center px-4 py-8 text-center">
                    <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                      <CartGlyph size={32} />
                    </span>
                    <p className="mt-4 text-lg font-semibold text-ink">{t.cart.empty}</p>
                    <p className="mt-1 text-sm text-ink-soft">{t.cart.emptyHint}</p>
                    <button type="button" onClick={closeDrawer} className={`${btnSecondary} mt-6`}>
                      {t.common.continueShopping}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <CartRewardsBar
                    tiers={tiers}
                    subtotal={Number(cart?.subtotal ?? 0)}
                    applied={rewards?.applied ?? null}
                    notes={rewards?.notes ?? []}
                    locale={lang}
                    formatMoney={moneyOf}
                    loading={!rewards && quote.shipping.stale}
                  />

                  <ul className="divide-y divide-line">
                    {lines.map((line) => {
                      const leavingNow = Boolean(leaving[line.id]);
                      const quantity = wanted[line.id] ?? line.quantity;
                      const lineTotal = quantity === line.quantity ? line.lineTotal : Number(line.currentUnitPrice) * quantity;
                      const product = byVariant.get(line.variantId);
                      const combo = isComboLine(line);
                      const comboImages = combo ? comboLineImages(line, byVariant) : [];
                      const image = product ? lineImage(product, line.variantId) : null;
                      const options = variantLabel(line.variant);
                      const lineName = combo ? line.combo?.name : product?.name;
                      const compareAt = line.variant?.compareAtAmount ?? null;
                      const wasTotal = !combo && !line.offerId && compareAt && compareAt > Number(line.currentUnitPrice) ? compareAt * quantity : null;
                      return (
                        <li
                          key={line.id}
                          // The row folds away (its own height, 1fr → 0fr) and fades as it goes.
                          className="grid transition-[grid-template-rows,opacity] ease-out motion-reduce:transition-none"
                          style={{ gridTemplateRows: leavingNow ? "0fr" : "1fr", opacity: leavingNow ? 0 : 1, transitionDuration: `${REMOVE_MS}ms` }}
                          aria-hidden={leavingNow || undefined}
                        >
                          <div className="min-h-0 overflow-hidden">
                            <div className="flex gap-3 py-4">
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
                                      <StoreLink href={`/products/${product.slug}`} className={`line-clamp-2 rounded text-sm font-semibold text-ink hover:text-primary ${focusRing}`}>
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
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => remove(line)}
                                    disabled={leavingNow}
                                    aria-label={`${t.cart.remove}${lineName ? ` — ${lineName}` : ""}`}
                                    data-no-drag=""
                                    className={`-me-2 -mt-2 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-soft transition-colors hover:text-danger disabled:opacity-50 ${focusRing}`}
                                  >
                                    <CrossIcon size={18} />
                                  </button>
                                </div>

                                {!line.unavailable && (
                                  <div className="mt-2 flex items-center justify-between gap-3" data-no-drag="">
                                    <QuantityStepper size="sm" value={quantity} disabled={leavingNow} onChange={(next) => changeQuantity(line.id, next)} />
                                    <span className="flex flex-wrap items-baseline justify-end gap-x-2">
                                      <ComboLineFullTotal line={line} currency={currency} />
                                      {wasTotal !== null && (
                                        <s className="text-xs tabular-nums text-ink-soft">
                                          <Money value={wasTotal} currency={currency} />
                                        </s>
                                      )}
                                      <Money value={lineTotal} currency={currency} className="text-sm font-bold tabular-nums text-ink" />
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  <SavedBanner rewards={rewards} currency={currency} />

                  {cart && <CartShippingSummary workspaceId={workspaceId} cart={cart} quote={quote} />}
                </div>
              )}
            </div>

            {!isEmpty && cart && (
              // The button clears the home indicator (0 where there is none).
              <div className="shrink-0 border-t border-line bg-paper-raised px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-5 sm:pt-4">
                <HolidayCheckoutGate buttonClassName={btnPrimaryLg}>
                  <StoreLink href="/checkout" className={btnPrimaryLg} data-autofocus="">
                    {text.completeOrder}
                  </StoreLink>
                </HolidayCheckoutGate>
                {trust.length > 0 && (
                  <ul aria-label={text.trust} className="mt-2.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                    {trust.map((item) => (
                      <li key={item} className="inline-flex items-center gap-1">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-success">
                          <path d="m5 12 5 5 9-10" />
                        </svg>
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
