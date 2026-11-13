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
export const CART_SHEET_SPEEDS: readonly CartSheetSpeed[] = ["fast", "normal", "none"];

export interface CartSheetSettings {
  /** false: no sheet at all, the cart is a page of its own ("off for all"). */
  enabled: boolean;
  openOn: {
    /** Opens by itself once a product is added. */
    addToCart: boolean;
    /** Opens from the cart icon (header, phone toolbar). */
    cartIcon: boolean;
    /** A product page's "Order now": the sheet with that product and the quick order form. */
    quickOrder: boolean;
  };
  /** auto: a bottom sheet on a phone, a side drawer on a wider screen. */
  presentation: CartSheetPresentation;
  speed: CartSheetSpeed;
}

/** What a store that never chose gets. */
export const CART_SHEET_DEFAULTS: CartSheetSettings = {
  enabled: true,
  openOn: { addToCart: false, cartIcon: true, quickOrder: false },
  presentation: "auto",
  speed: "fast",
};

/** GET /store/:id → `cartSheet`. */
export interface StorefrontCartSheet extends CartSheetSettings {
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
  };
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
