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
import { ApiError, type Cart } from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";

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

export interface CartContextValue {
  cart: Cart | null;
  isLoading: boolean;
  /** Sum of every line's quantity. */
  itemCount: number;
  addItem: (variantId: string, offerId?: string, quantity?: number) => Promise<void>;
  updateItem: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  refreshCart: () => Promise<void>;
  /** Drop the local cart + token, e.g. right after a successful checkout. */
  clearCart: () => void;
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
    async (variantId: string, offerId?: string, quantity = 1) => {
      if (!workspaceId) return;
      const token = await ensureToken();
      setCart(await client.addCartItem(workspaceId, token, { variantId, offerId, quantity }));
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
    }),
    [cart, isLoading, itemCount, addItem, updateItem, removeItem, refreshCart, clearCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
