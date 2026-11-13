import type { CheckoutFieldMode, EmailSignupCopy, StoreEmailSignup } from "@store-builder/api-client";
import { EMAIL_CAMPAIGNS_ENABLED } from "./features";
import { arOrEn, type Locale } from "./i18n";

/**
 * Where the store lets shoppers sign up for its marketing emails (GET
 * /store/:ws `emailSignup`, chosen by the merchant in Marketing → Email
 * campaigns → Signup placement): the checkout box, the quick order form's
 * box, the cart's box, a footer form and a popup.
 *
 * Off (NEXT_PUBLIC_EMAIL_CAMPAIGNS_ENABLED not "true", the API's switch off,
 * or the plan without email campaigns), nothing at all is shown. An API from
 * before the places shows the checkout box, unticked, as it always did.
 *
 * Nothing here reads a cookie or anything else per visitor on the server:
 * the store's pages stay the same for everyone and the edge cache keeps
 * them. What one visitor did (the cart's box, the popup already seen) lives
 * in the browser's storage, read after the page is up.
 */

const OFF_PLACES: Omit<StoreEmailSignup, "text"> = { checkout: null, quickOrder: null, cart: null, footer: null, popup: null };
const NO_TEXT: StoreEmailSignup["text"] = {
  ar: { label: null, privacy: null, incentive: null },
  en: { label: null, privacy: null, incentive: null },
};
/** What an API from before the places offered: the checkout box, unticked. */
export const LEGACY_SIGNUP: StoreEmailSignup = { ...OFF_PLACES, checkout: { preTicked: false }, text: NO_TEXT };

/** The places to draw for this store, or null for none at all. */
export function signupPlaces(signup: StoreEmailSignup | null | undefined, enabled = EMAIL_CAMPAIGNS_ENABLED): StoreEmailSignup | null {
  if (!enabled) return null;
  if (signup === undefined) return LEGACY_SIGNUP;
  return signup;
}

/** The merchant's words in the shopper's language (French reads the English ones). */
export function signupCopy(signup: StoreEmailSignup | null | undefined, locale: Locale): EmailSignupCopy {
  const text = signup?.text ?? NO_TEXT;
  return text[arOrEn(locale)] ?? NO_TEXT.en;
}

/**
 * The quick order form asks for an email only when the store demands one
 * (lib/orderForm quickFormFields). With its signup box on, it asks for one
 * as an option too, wherever the store's form has the field at all.
 */
export function quickFormEmailMode(quick: CheckoutFieldMode, store: CheckoutFieldMode, boxOn: boolean): CheckoutFieldMode {
  if (!boxOn || quick !== "hidden") return quick;
  return store === "hidden" ? "hidden" : "optional";
}

/** A shape check for the address; the server checks it properly. */
export const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

// The popup never opens where the shopper is paying or reading their order.
export const signupQuietPath = (pathname: string) => /\/(checkout|orders|pay|offer|track|f|r|unsubscribe)(\/|$)/.test(pathname);

// -------------------------------------------------------- visitor's memory --
// Storage can be missing or refuse (private windows, blocked site data): each
// read and write is guarded, and this page's memory stands in for it.

const memory = new Map<string, string>();

function readStored(kind: "local" | "session", key: string): string | null {
  try {
    const value = (kind === "local" ? window.localStorage : window.sessionStorage).getItem(key);
    if (value !== null) return value;
  } catch {
    /* this page's memory below */
  }
  return memory.get(`${kind}:${key}`) ?? null;
}

function writeStored(kind: "local" | "session", key: string, value: string) {
  memory.set(`${kind}:${key}`, value);
  try {
    (kind === "local" ? window.localStorage : window.sessionStorage).setItem(key, value);
  } catch {
    /* kept for this page only */
  }
}

const POPUP_KEY = (workspaceId: string) => `zimos.emailSignup.popup.${workspaceId}`;
const CART_KEY = (workspaceId: string) => `zimos.emailSignup.cart.${workspaceId}`;

/** Whether this visitor has already been shown the store's popup. */
export const popupSeen = (workspaceId: string) => readStored("local", POPUP_KEY(workspaceId)) !== null;
/** Shown once per visitor: remembered the moment it opens, whatever they do with it. */
export const rememberPopup = (workspaceId: string) => writeStored("local", POPUP_KEY(workspaceId), "1");

/**
 * The cart's box as the shopper left it, for the checkout to send (this tab
 * only, like the cart's other choices): true, false, or null when the cart's
 * box was never shown.
 */
export function cartChoice(workspaceId: string): boolean | null {
  const value = readStored("session", CART_KEY(workspaceId));
  return value === "1" ? true : value === "0" ? false : null;
}
const cartListeners = new Set<() => void>();
export function rememberCartChoice(workspaceId: string, ticked: boolean) {
  writeStored("session", CART_KEY(workspaceId), ticked ? "1" : "0");
  cartListeners.forEach((listener) => listener());
}
/** For useSyncExternalStore: every box showing the cart's choice follows a change at once (the sheet and the cart page). */
export function subscribeCartChoice(listener: () => void) {
  cartListeners.add(listener);
  return () => {
    cartListeners.delete(listener);
  };
}

/** For tests: forget this page's memory. */
export function forgetSignupMemory() {
  memory.clear();
}
