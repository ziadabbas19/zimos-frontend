"use client";

import { useCallback, useMemo, useSyncExternalStore, type MouseEvent } from "react";
import { CART_SHEET_DEFAULTS, CART_SHEET_DURATION_MS, type CartSheetSpeed, type StorefrontCartSheet } from "@store-builder/api-client";
import { useStore } from "./StoreContext";

/**
 * How the store's cart opens (GET /store/:ws `cartSheet`, chosen by the
 * merchant in Store settings → Cart behavior). Every store has the sheet,
 * whatever its plan and whatever the cart rewards switches say; the rewards
 * bar is only something drawn inside it.
 *
 *   addToCart   a product was added → the sheet opens by itself (on by default,
 *               as the cart always did; off, the button says "added" and the
 *               header's count moves)
 *   cartIcon    the header's cart icon and the phone toolbar's open it in place
 *               (on by default); off, they are links to the cart page
 *   quickOrder  a product page's "Order now" opens it with that product and the
 *               quick order form (off by default: the page's own form, as before)
 *   enabled     false: none of them, the cart is its own page
 *
 * Nothing here is per visitor on the server: the setting is the store's, so
 * the store's pages stay the same for everyone and the edge keeps them.
 */

export type CartSheetTrigger = keyof StorefrontCartSheet["openOn"];

const NO_SHEET_SETTINGS: StorefrontCartSheet = { ...CART_SHEET_DEFAULTS, openOn: { ...CART_SHEET_DEFAULTS.openOn }, trustItems: [] };

/** The store's settings, the defaults when there is none (outside a store, or an older API). */
export function cartSheetOf(store: { cartSheet?: StorefrontCartSheet | null } | null | undefined): StorefrontCartSheet {
  return store?.cartSheet ?? NO_SHEET_SETTINGS;
}

export const sheetOpensOn = (sheet: StorefrontCartSheet, trigger: CartSheetTrigger) => sheet.enabled && sheet.openOn[trigger];

/** The sheet's slide in milliseconds: 0 for "none" (drawn at once). */
export const sheetDuration = (speed: CartSheetSpeed) => CART_SHEET_DURATION_MS[speed] ?? CART_SHEET_DURATION_MS.fast;

/**
 * The rewards bar's place at the top of the sheet's scrolling part: it stays
 * there while the lines (or the quick order form) scroll under it. The
 * negative margins and offset take back the scrolling part's own padding, so
 * it sits flush with the top edge and nothing shows above it.
 */
export const STICKY_BAR_CLASS = "sticky -top-4 z-10 -mx-4 -mt-4 mb-4 bg-paper-raised px-4 pt-3 pb-1 sm:-mx-5 sm:px-5";

/** On the cart page or the checkout the sheet would only repeat the page: the cart's links go through there. */
export const onCartPage = (pathname: string | null) => /\/(cart|checkout)$/.test(pathname ?? "");

export interface CartSheetControls {
  sheet: StorefrontCartSheet;
  opensOn: (trigger: CartSheetTrigger) => boolean;
  /** After a line was added: opens the sheet when the merchant wants it to. */
  afterAdd: () => void;
  /**
   * For a link to the cart page (the header icon, the phone toolbar): a plain
   * click opens the sheet in place when the merchant wants it to; otherwise,
   * or with a modifier key, or on the cart page itself, the link goes through.
   */
  onCartLinkClick: (e: MouseEvent<HTMLElement>) => void;
}

/**
 * The store's sheet settings and the decisions made from them. `openDrawer`
 * is the cart's own (CartProvider), passed in by the caller that already has
 * the cart; without it nothing opens.
 */
export function useCartSheet(openDrawer?: () => void): CartSheetControls {
  const { store } = useStore();
  const sheet = cartSheetOf(store);
  const opensOn = useCallback((trigger: CartSheetTrigger) => sheetOpensOn(sheet, trigger), [sheet]);
  const afterAdd = useCallback(() => {
    if (opensOn("addToCart")) openDrawer?.();
  }, [opensOn, openDrawer]);
  const onCartLinkClick = useCallback(
    (e: MouseEvent<HTMLElement>) => {
      // Read at the tap: the page the shopper is on now.
      const here = typeof window === "undefined" ? "" : window.location.pathname;
      if (!openDrawer || !opensOn("cartIcon") || onCartPage(here) || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      openDrawer();
    },
    [openDrawer, opensOn]
  );
  return useMemo(() => ({ sheet, opensOn, afterAdd, onCartLinkClick }), [sheet, opensOn, afterAdd, onCartLinkClick]);
}

// ---- the quick order's place in the sheet -----------------------------------

/*
 * While the sheet shows a product page's quick order, it holds an empty box;
 * the product page draws its own quick order form into it (a portal), so the
 * form is the page's very component, its fields and its state, not a copy.
 * Closed, the box is gone and the form is back on the page.
 */
let quickSlot: HTMLElement | null = null;
const slotListeners = new Set<() => void>();

/** The sheet's quick order box (a ref callback): null while it is not shown. */
export function setQuickOrderSlot(el: HTMLElement | null) {
  if (quickSlot === el) return;
  quickSlot = el;
  for (const listener of slotListeners) listener();
}

/** The box to draw the quick order form into, or null to draw it on the page. */
export function useQuickOrderSlot(): HTMLElement | null {
  return useSyncExternalStore(
    (listener) => {
      slotListeners.add(listener);
      return () => slotListeners.delete(listener);
    },
    () => quickSlot,
    () => null
  );
}

/** A media query, false on the server and before the first paint. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (listener) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
      const list = window.matchMedia(query);
      list.addEventListener?.("change", listener);
      return () => list.removeEventListener?.("change", listener);
    },
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches,
    () => false
  );
}
