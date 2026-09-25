"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { ApiClient, CheckoutPayload, CheckoutResult, StorefrontPaymentMethod } from "@store-builder/api-client";
import { saveOrderSnapshot, snapshotFromOrder } from "./commerce";
import { storeHref } from "./storeHref";
import type { OrderLine } from "./placeOrder";

/**
 * Online payments on the storefront: which methods the store offers, the
 * shopper's payment token for each unpaid order, and the store-preview flag
 * that lets the merchant try test-mode payments.
 *
 * Everything here lives in this browser only. The payment token is the
 * shopper's key to their unpaid order's payment page (status, resume, retry,
 * switch to cash on delivery); it is handed out once by the checkout.
 */

const COD_ONLY: StorefrontPaymentMethod[] = [{ id: "cod", provider: null, method: "cod", mode: "live" }];

// --------------------------------------------------------------- preview

const previewKey = (workspaceId: string) => `zimos_payments_preview_${workspaceId}`;

/** The merchant's payments preview token for this store, if this tab has one. */
export function getPreviewToken(workspaceId: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.sessionStorage.getItem(previewKey(workspaceId)) ?? undefined;
  } catch {
    return undefined;
  }
}

const PREVIEW_EVENT = "zimos-payments-preview";

export function setPreviewToken(workspaceId: string, token: string | null) {
  try {
    if (token) window.sessionStorage.setItem(previewKey(workspaceId), token);
    else window.sessionStorage.removeItem(previewKey(workspaceId));
  } catch {
    /* storage disabled: preview only lasts for this page */
  }
  window.dispatchEvent(new Event(PREVIEW_EVENT));
}

function subscribePreview(onChange: () => void) {
  window.addEventListener(PREVIEW_EVENT, onChange);
  return () => window.removeEventListener(PREVIEW_EVENT, onChange);
}

/** The preview token, re-read whenever setPreviewToken changes it. Undefined during SSR. */
export function usePreviewToken(workspaceId: string): string | undefined {
  return useSyncExternalStore(
    subscribePreview,
    () => getPreviewToken(workspaceId),
    () => undefined
  );
}

// ---------------------------------------------------------- payment tokens

const tokensKey = (workspaceId: string) => `zimos_payment_tokens_${workspaceId}`;

function readTokens(workspaceId: string): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(tokensKey(workspaceId));
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function savePaymentToken(workspaceId: string, orderId: string, token: string) {
  try {
    const entries = Object.entries(readTokens(workspaceId)).filter(([id]) => id !== orderId);
    const next = Object.fromEntries([[orderId, token], ...entries].slice(0, 20));
    window.localStorage.setItem(tokensKey(workspaceId), JSON.stringify(next));
  } catch {
    /* storage disabled */
  }
}

export function getPaymentToken(workspaceId: string, orderId: string): string | null {
  if (typeof window === "undefined") return null;
  return readTokens(workspaceId)[orderId] ?? null;
}

// --------------------------------------------------------------- methods

/**
 * The methods the store offers at checkout. Starts (and falls back to) cash on
 * delivery only, so a store without online payments renders exactly as before.
 */
export function usePaymentMethods(client: ApiClient, workspaceId: string) {
  const [methods, setMethods] = useState<StorefrontPaymentMethod[]>(COD_ONLY);
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    let live = true;
    client
      .getStorefrontPaymentMethods(workspaceId, getPreviewToken(workspaceId))
      .then((res) => {
        if (!live) return;
        setMethods(res.methods.length ? res.methods : COD_ONLY);
        setPreview(res.preview);
      })
      .catch(() => {
        /* keep cash on delivery */
      });
    return () => {
      live = false;
    };
  }, [client, workspaceId]);
  return { methods, preview };
}

/** The page a gateway sends the shopper back to, on this store's own address. */
export function paymentPageUrl(basePath: string, orderId: string): string {
  return `${window.location.origin}${storeHref(basePath, `/pay/${orderId}`)}`;
}

/**
 * Places an order paid online and returns where to send the shopper: the
 * gateway's page, or — when the gateway could not start the payment — our own
 * payment page, which offers a retry or cash on delivery.
 */
export async function placeOnlineOrder({
  client,
  workspaceId,
  basePath,
  payload,
  method,
  cartToken,
  lines,
}: {
  client: ApiClient;
  workspaceId: string;
  basePath: string;
  payload: CheckoutPayload;
  method: StorefrontPaymentMethod;
  cartToken?: string;
  lines?: OrderLine[];
}): Promise<{ result: CheckoutResult; next: string; external: boolean }> {
  const previewToken = getPreviewToken(workspaceId);
  let token = cartToken;
  let body: CheckoutPayload = {
    ...payload,
    paymentMethod: method.method,
    ...(method.provider ? { paymentProvider: method.provider } : {}),
  };
  if (lines && lines.length > 0) {
    // Several lines from a product page go through a fresh, isolated cart, as
    // for cash on delivery (placeOrder.placeCodOrder).
    const cart = await client.getOrCreateCart(workspaceId);
    for (const line of lines) await client.addCartItem(workspaceId, cart.guestToken, line);
    const { item: _ignored, ...rest } = body;
    void _ignored;
    body = rest;
    token = cart.guestToken;
  }

  // The return URL names the order, which only exists once the checkout
  // answers: the server fills in the {orderId} placeholder.
  const result = await client.placeCheckout(
    workspaceId,
    { ...body, returnUrl: paymentPageUrl(basePath, "{orderId}") },
    { cartToken: token, previewToken }
  );

  const order = result.order;
  saveOrderSnapshot(workspaceId, snapshotFromOrder(order, body.contact.phone));
  if (result.paymentToken) savePaymentToken(workspaceId, order.id, result.paymentToken);

  const redirect = result.payment?.redirectUrl;
  if (redirect) return { result, next: redirect, external: true };
  return { result, next: storeHref(basePath, `/pay/${order.id}`), external: false };
}
