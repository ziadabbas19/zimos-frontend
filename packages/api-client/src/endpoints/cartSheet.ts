/**
 * How a store's cart opens (backend: storefront/cartSheet.js). Every store
 * has the cart sheet, whatever its plan; no build or API switch turns it on.
 * Cart rewards only add their bar to it.
 *
 * Kept in workspaces.settings.cart_sheet and saved whole through the store
 * settings (PATCH /workspaces/:id with `settings.cart_sheet`, website.edit;
 * null goes back to the defaults). The storefront reads it inside
 * GET /store/:id as `cartSheet`, with the lines under the checkout button.
 */
import type { ApiClient } from "../client";
import type { Workspace } from "../types";

export type CartSheetPresentation = "auto" | "bottom_sheet" | "side_drawer" | "popup";
export type CartSheetSpeed = "fast" | "normal" | "none";

export const CART_SHEET_PRESENTATIONS: readonly CartSheetPresentation[] = ["auto", "bottom_sheet", "side_drawer", "popup"];
/** The most trust lines a store may write, and the longest one in either language. */
export const CART_SHEET_MAX_TRUST_ITEMS = 4;
export const CART_SHEET_TRUST_TEXT_MAX = 80;

/** One line under the checkout button ("Cash on delivery"), in both languages; off ones are kept, not shown. */
export interface CartSheetTrustItem {
  text: { ar: string; en: string };
  enabled: boolean;
}
export const CART_SHEET_SPEEDS: readonly CartSheetSpeed[] = ["fast", "normal", "none"];

export interface CartSheetSettings {
  /** false: no sheet at all, the cart is a page of its own ("off for all"). */
  enabled: boolean;
  openOn: {
    /** Opens by itself once a product is added (on unless the merchant switches it off). */
    addToCart: boolean;
    /** Opens from the cart icon (header, phone toolbar). */
    cartIcon: boolean;
    /** A product page's "Order now": the sheet with that product and the quick order form. */
    quickOrder: boolean;
  };
  /** auto: a bottom sheet on a phone, a side drawer on a wider screen. */
  presentation: CartSheetPresentation;
  speed: CartSheetSpeed;
  /**
   * The lines under the checkout button. Left out (never saved here), the
   * server reads the ones written on the cart rewards page before they moved.
   */
  trustItems?: CartSheetTrustItem[];
}

/** What a store that never chose gets. */
export const CART_SHEET_DEFAULTS: CartSheetSettings = {
  enabled: true,
  openOn: { addToCart: true, cartIcon: true, quickOrder: false },
  presentation: "auto",
  speed: "fast",
};

/** GET /store/:id → `cartSheet`. */
export interface StorefrontCartSheet extends Omit<CartSheetSettings, "trustItems"> {
  /** The lines under the checkout button the merchant wrote and switched on. */
  trustItems: Array<{ text: { ar: string; en: string } }>;
}

/**
 * Settings as stored (workspace.settings.cart_sheet) or served, read safely:
 * anything missing or unknown is the default, as the server reads it.
 */
export function cartSheetSettingsOf(raw: unknown): CartSheetSettings {
  const v = (raw && typeof raw === "object" ? raw : {}) as Partial<CartSheetSettings>;
  const on = (v.openOn && typeof v.openOn === "object" ? v.openOn : {}) as Partial<CartSheetSettings["openOn"]>;
  const flag = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);
  return {
    enabled: flag(v.enabled, CART_SHEET_DEFAULTS.enabled),
    openOn: {
      addToCart: flag(on.addToCart, CART_SHEET_DEFAULTS.openOn.addToCart),
      cartIcon: flag(on.cartIcon, CART_SHEET_DEFAULTS.openOn.cartIcon),
      quickOrder: flag(on.quickOrder, CART_SHEET_DEFAULTS.openOn.quickOrder),
    },
    presentation: CART_SHEET_PRESENTATIONS.includes(v.presentation as CartSheetPresentation) ? (v.presentation as CartSheetPresentation) : CART_SHEET_DEFAULTS.presentation,
    speed: CART_SHEET_SPEEDS.includes(v.speed as CartSheetSpeed) ? (v.speed as CartSheetSpeed) : CART_SHEET_DEFAULTS.speed,
    ...(Array.isArray(v.trustItems) ? { trustItems: v.trustItems.map(trustItemOf) } : {}),
  };
}

function trustItemOf(raw: unknown): CartSheetTrustItem {
  const o = (raw && typeof raw === "object" ? raw : {}) as { text?: { ar?: unknown; en?: unknown }; enabled?: unknown };
  const str = (x: unknown) => (typeof x === "string" ? x : "");
  return { text: { ar: str(o.text?.ar), en: str(o.text?.en) }, enabled: o.enabled !== false };
}

/** GET /workspaces/:id/cart-sheet: the settings as the dashboard edits them, with every trust line and where they were read from. */
export interface CartSheetStaffView extends CartSheetSettings {
  trustItems: CartSheetTrustItem[];
  /** cart_rewards: the lines written on the rewards page before they moved here; saving writes them here. */
  trustItemsFrom: "cart_sheet" | "cart_rewards";
}

export async function cartSheetGet(client: ApiClient, workspaceId: string): Promise<CartSheetStaffView> {
  const { cartSheet } = await client.request<{ cartSheet: CartSheetStaffView }>(`/workspaces/${workspaceId}/cart-sheet`);
  return { ...cartSheetSettingsOf(cartSheet), trustItems: (cartSheet.trustItems ?? []).map(trustItemOf), trustItemsFrom: cartSheet.trustItemsFrom === "cart_rewards" ? "cart_rewards" : "cart_sheet" };
}

/** The server's checks on the trust lines, said before saving: field → "trustText" (no text) or "tooLong"; "tooMany" on `trustItems`. */
export function cartSheetTrustErrors(items: readonly CartSheetTrustItem[]): Record<string, "trustText" | "tooLong" | "tooMany"> {
  const errors: Record<string, "trustText" | "tooLong" | "tooMany"> = {};
  if (items.length > CART_SHEET_MAX_TRUST_ITEMS) errors.trustItems = "tooMany";
  items.forEach((item, i) => {
    if (!item.text.ar.trim() && !item.text.en.trim()) errors[`trustItems.${i}.text`] = "trustText";
    else if (item.text.ar.trim().length > CART_SHEET_TRUST_TEXT_MAX || item.text.en.trim().length > CART_SHEET_TRUST_TEXT_MAX) errors[`trustItems.${i}.text`] = "tooLong";
  });
  return errors;
}

/**
 * The store's `cartSheet` from GET /store/:id. An API from before the
 * setting (no `cartSheet`) gets the defaults and no trust lines.
 */
export function storeCartSheetOf(store: unknown): StorefrontCartSheet {
  const value = store && typeof store === "object" ? (store as { cartSheet?: unknown }).cartSheet : undefined;
  const items = value && typeof value === "object" ? (value as { trustItems?: unknown }).trustItems : undefined;
  const text = (t: unknown) => {
    const o = (t && typeof t === "object" ? t : {}) as { ar?: unknown; en?: unknown };
    return { ar: typeof o.ar === "string" ? o.ar : "", en: typeof o.en === "string" ? o.en : "" };
  };
  return {
    ...cartSheetSettingsOf(value),
    trustItems: Array.isArray(items) ? items.map((item) => ({ text: text((item as { text?: unknown })?.text) })).filter((i) => i.text.ar || i.text.en) : [],
  };
}

/** The milliseconds a speed stands for: the sheet's slide (the rewards bar's fill has its own, cart-rewards/appearance). */
export const CART_SHEET_DURATION_MS: Record<CartSheetSpeed, number> = { fast: 260, normal: 400, none: 0 };

/** Saves the settings whole (PATCH /workspaces/:id, website.edit); null goes back to the defaults. Answers with the workspace. */
export async function cartSheetSave(client: ApiClient, workspaceId: string, settings: CartSheetSettings | null): Promise<Workspace> {
  const { workspace } = await client.request<{ workspace: Workspace }>(`/workspaces/${workspaceId}`, {
    method: "PATCH",
    body: { settings: { cart_sheet: settings } },
  });
  return workspace;
}
