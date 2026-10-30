"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useParams } from "next/navigation";
import { ApiError, parseMoney, type Cart, type ComboSelection, type CustomizationInput } from "@store-builder/api-client";
import { getVisitorId } from "@/lib/visitorId";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { track } from "@/lib/track";
import { contentIdOf } from "@/lib/contentId";
import { takeAddSource, takenAddSourceId } from "./addSource";

/**
 * Guest cart identity lives in localStorage, keyed per workspace so two store
 * tabs (or two workspaces of the same merchant) never share a token — a token
 * from one workspace resolves to nothing in another anyway.
 */
const TOKEN_KEY_PREFIX = "zimos_cart_token_";

function tokenKeyFor(workspaceId: string) {
  return `${TOKEN_KEY_PREFIX}${workspaceId}`;
}

function readStoredToken(workspaceId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(tokenKeyFor(workspaceId));
  } catch {
    return null;
  }
}

function writeStoredToken(workspaceId: string, token: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(tokenKeyFor(workspaceId), token);
  } catch {
    /* private mode / storage disabled — cart just won't survive a reload */
  }
}

function clearStoredToken(workspaceId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(tokenKeyFor(workspaceId));
  } catch {
    /* ignore */
  }
}

/** A whole combo on one cart line (lib/combos): the combo and the variant picked for each product that lets the shopper choose. */
export interface CartComboTarget {
  comboId: string;
  comboSelection: ComboSelection;
}

/** The same picks, whatever their order (the server keeps them in the combo's order). */
function sameSelection(a: ComboSelection | undefined, b: ComboSelection): boolean {
  const key = (list: ComboSelection) => list.map((s) => `${s.itemId}:${s.variantId}`).sort().join(",");
  return key(a ?? []) === key(b);
}

export interface CartContextValue {
  cart: Cart | null;
  isLoading: boolean;
  /** Sum of every line's quantity. */
  itemCount: number;
  /**
   * A variant, or a whole combo (`{ comboId, comboSelection }`, which takes no
   * offer, custom fields or menu options). `customizations` answers the
   * product's custom fields (photos by upload id).
   */
  addItem: (
    variantId: string | CartComboTarget,
    offerId?: string,
    quantity?: number,
    customizations?: CustomizationInput,
    /** Menu options picked; the server checks and prices them. */
    options?: import("@store-builder/api-client").MenuOptionsInput
  ) => Promise<void>;
  updateItem: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  refreshCart: () => Promise<void>;
  /** Drop the local cart + token, e.g. right after a successful checkout. */
  clearCart: () => void;
  /**
   * The slide-over cart drawer (components/CartDrawer). Its open/closed state
   * lives here — next to the one cart it shows — so "add to cart" anywhere in
   * the store can open it without a second context. Nothing about the cart's
   * contents is duplicated: the drawer reads `cart` like every other consumer.
   */
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart() must be used inside <CartProvider>");
  return ctx;
}

export function CartProvider({ children }: { children: ReactNode }) {
  // The provider lives in the root layout, so it renders on every route. It only
  // does anything on `/store/[workspaceId]/...`, where this param is filled in.
  const params = useParams();
  const workspaceId =
    typeof params.workspaceId === "string" ? params.workspaceId : undefined;

  const [client] = useState(() => createStorefrontApiClient());
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Resolve the cart once per workspace: reuse a saved token when it still
  // points at a live cart, otherwise create a fresh one and remember its token.
  // (Nothing to do off the storefront routes, where there's no workspace.)
  useEffect(() => {
    if (!workspaceId) return;

    let cancelled = false;
    const saved = readStoredToken(workspaceId);

    async function resolveCart(id: string) {
      setIsLoading(true);
      try {
        if (saved) {
          try {
            const existing = await client.getCart(id, saved);
            if (!cancelled) setCart(existing);
            return;
          } catch (err) {
            if (!(err instanceof ApiError) || err.status !== 404) throw err;
            // stale token — fall through and create a new cart
          }
        }
        const created = await client.getOrCreateCart(id, saved ?? undefined);
        if (cancelled) return;
        writeStoredToken(id, created.guestToken);
        setCart(created);
      } catch {
        if (!cancelled) setCart(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    resolveCart(workspaceId);
    return () => {
      cancelled = true;
    };
  }, [workspaceId, client]);

  /** Guarantee a usable cart token before a mutation, creating the cart lazily. */
  const ensureToken = useCallback(async (): Promise<string> => {
    if (!workspaceId) throw new Error("No storefront workspace in scope");
    const saved = readStoredToken(workspaceId);
    if (saved) return saved;
    const created = await client.getOrCreateCart(workspaceId);
    writeStoredToken(workspaceId, created.guestToken);
    setCart(created);
    return created.guestToken;
  }, [workspaceId, client]);

  const addItem = useCallback(
    async (target: string | CartComboTarget, offerId?: string, quantity = 1, customizations?: CustomizationInput, options?: import("@store-builder/api-client").MenuOptionsInput) => {
      if (!workspaceId) return;
      const combo = typeof target === "string" ? null : target;
      const variantId = typeof target === "string" ? target : "";
      const token = await ensureToken();
      const next = await client.addCartItem(
        workspaceId,
        token,
        // A combo is one line the server prices as a combo; it names no variant of its own.
        combo
          ? { comboId: combo.comboId, comboSelection: combo.comboSelection, quantity }
          : { variantId, offerId, quantity, ...(customizations ? { customizations } : {}), ...(options && options.length ? { options } : {}) },
        // The visitor owns any photo among the answers.
        { visitorId: getVisitorId(workspaceId) }
      );
      setCart(next);
      // AddToCart for the store's own analytics: the line just added, valued at
      // its unit price × the quantity added (not the whole line, which may have
      // held the variant already).
      try {
        const line = combo
          ? (next.items.find((l) => l.comboId === combo.comboId && sameSelection(l.comboSelection, combo.comboSelection)) ??
            next.items.find((l) => l.comboId === combo.comboId))
          : next.items.find((l) => l.variantId === variantId && (l.offerId ?? undefined) === offerId && !l.comboId);
        const unit = line ? parseMoney(line.unitPriceSnapshot) : 0;
        track("AddToCart", {
          contentIds: [contentIdOf(line?.variant) ?? (combo ? combo.comboId : variantId)],
          valueMinor: Math.round(unit * quantity),
          currency: next.currency,
          numItems: quantity,
          source: takeAddSource(),
          sourceId: takenAddSourceId(),
        });
      } catch {
        /* tracking never breaks the cart */
      }
    },
    [workspaceId, client, ensureToken]
  );

  const updateItem = useCallback(
    async (itemId: string, quantity: number) => {
      if (!workspaceId) return;
      const token = readStoredToken(workspaceId);
      if (!token) return;
      setCart(await client.updateCartItem(workspaceId, token, itemId, quantity));
    },
    [workspaceId, client]
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      if (!workspaceId) return;
      const token = readStoredToken(workspaceId);
      if (!token) return;
      setCart(await client.removeCartItem(workspaceId, token, itemId));
    },
    [workspaceId, client]
  );

  const refreshCart = useCallback(async () => {
    if (!workspaceId) return;
    const token = readStoredToken(workspaceId);
    if (!token) {
      setCart(null);
      return;
    }
    try {
      setCart(await client.getCart(workspaceId, token));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        clearStoredToken(workspaceId);
        setCart(null);
        return;
      }
      throw err;
    }
  }, [workspaceId, client]);

  const clearCart = useCallback(() => {
    if (workspaceId) clearStoredToken(workspaceId);
    setCart(null);
  }, [workspaceId]);

  const itemCount = useMemo(
    () => (cart?.items ?? []).reduce((sum, line) => sum + line.quantity, 0),
    [cart]
  );

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      isLoading,
      itemCount,
      addItem,
      updateItem,
      removeItem,
      refreshCart,
      clearCart,
      isDrawerOpen,
      openDrawer,
      closeDrawer,
    }),
    [cart, isLoading, itemCount, addItem, updateItem, removeItem, refreshCart, clearCart, isDrawerOpen, openDrawer, closeDrawer]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
