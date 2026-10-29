/**
 * Combos: different products sold together at one price (backend:
 * src/modules/combos, PRODUCT_COMBOS_ENABLED — off, every call here answers
 * 404 and the public product carries `combos: []`).
 *
 * Staff, /workspaces/:workspaceId/combos (products.view to read,
 * products.manage to change). Storefront: `product.combos` on the public
 * product, a cart line `{ comboId, comboSelection }`, and the checkout item
 * the same way. The server prices everything; in the order a combo is one
 * line per product sharing a `comboKey`.
 *
 * `priceValue` by `pricingMode`: fixed_price — what one combo costs (minor
 * units, never above its products); percent_off — basis points off its
 * products (1000 = 10%); amount_off — minor units off them.
 *
 * Notable codes: COMBO_NEEDS_TWO_PRODUCTS, COMBO_PRICE_ABOVE_TOTAL (details
 * carry componentsTotal), COMBO_PRODUCT_NEEDS_INPUT (a product with a
 * required custom field or menu group), COMBO_VARIANT_REQUIRED (a pick
 * missing or not that product's), COMBO_UNAVAILABLE (a product gone or not
 * for sale), COMBO_NOT_IN_FUNNEL, ORDER_HAS_COMBO (editing an order's items).
 * All exported names start with `combos` / `Combo` / `storefront…Combo`.
 */
import type { ApiClient } from "../client";
import type { StorefrontVariant } from "../types";

export type ComboPricingMode = "fixed_price" | "percent_off" | "amount_off";
export type ComboStatus = "draft" | "active" | "archived";

export interface ComboItemInput {
  productId: string;
  /** Required unless pickVariant. */
  variantId?: string | null;
  /** The shopper chooses the variant. */
  pickVariant?: boolean;
  quantity?: number;
}

export interface ComboPayload {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  status?: ComboStatus;
  pricingMode: ComboPricingMode;
  priceValue: number;
  /** Empty: shown on the page of every product in it. */
  showOnProductIds?: string[];
  /** 2–10, at least two different products. */
  items: ComboItemInput[];
}

export interface ComboDto {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  status: ComboStatus;
  pricingMode: ComboPricingMode;
  priceValue: number;
  showOnProductIds: string[];
  items: Array<{
    id: string;
    productId: string | null;
    productName: string | null;
    productStatus: string | null;
    variantId: string | null;
    variantOptions: Record<string, string> | null;
    pickVariant: boolean;
    quantity: number;
  }>;
  /** At the cheapest choice of every component the shopper picks. */
  price: { full: number; total: number };
  /** Every product still for sale. */
  available: boolean;
  createdAt: string;
  updatedAt: string;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/combos`;

export async function combosList(client: ApiClient, workspaceId: string, status?: ComboStatus): Promise<ComboDto[]> {
  const { combos } = await client.request<{ combos: ComboDto[] }>(`${base(workspaceId)}${status ? `?status=${status}` : ""}`);
  return combos;
}

export async function combosGet(client: ApiClient, workspaceId: string, comboId: string): Promise<ComboDto> {
  return (await client.request<{ combo: ComboDto }>(`${base(workspaceId)}/${comboId}`)).combo;
}

export async function combosCreate(client: ApiClient, workspaceId: string, payload: ComboPayload): Promise<ComboDto> {
  return (await client.request<{ combo: ComboDto }>(base(workspaceId), { method: "POST", body: payload })).combo;
}

/** `items`, when sent, replaces them all. */
export async function combosUpdate(client: ApiClient, workspaceId: string, comboId: string, payload: Partial<ComboPayload>): Promise<ComboDto> {
  return (await client.request<{ combo: ComboDto }>(`${base(workspaceId)}/${comboId}`, { method: "PATCH", body: payload })).combo;
}

/** Archived, never deleted: orders keep its name. */
export async function combosArchive(client: ApiClient, workspaceId: string, comboId: string): Promise<void> {
  await client.request(`${base(workspaceId)}/${comboId}`, { method: "DELETE" });
}

/** The form's live price: what the products cost and what the combo would (422 with the reason otherwise). */
export async function combosPreview(
  client: ApiClient,
  workspaceId: string,
  payload: Pick<ComboPayload, "pricingMode" | "priceValue" | "items">
): Promise<{ componentsTotal: number; total: number }> {
  return (await client.request<{ preview: { componentsTotal: number; total: number } }>(`${base(workspaceId)}/preview`, { method: "POST", body: payload })).preview;
}

// ------------------------------------------------------------- storefront --

/** A combo on a product's page. */
export interface StorefrontCombo {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  pricingMode: ComboPricingMode;
  priceValue: number;
  items: Array<{
    id: string;
    quantity: number;
    /** The shopper chooses among `variants`; otherwise `variants` holds the one variant. */
    pickVariant: boolean;
    product: { id: string; name: string; slug: string | null; imageUrl: string | null } | null;
    variants: StorefrontVariant[];
  }>;
  /** At the first in-stock choice of every component; the checkout prices it again. */
  price: { full: number; total: number; saving: number };
  /** Every product for sale with stock: otherwise it is shown as sold out. */
  available: boolean;
}

/** The combos off a public product, [] from an older server or while combos are off. */
export function storefrontProductCombos(product: unknown): StorefrontCombo[] {
  const raw = (product ?? {}) as { combos?: unknown };
  return Array.isArray(raw.combos) ? (raw.combos as StorefrontCombo[]) : [];
}

/** One combo's price for these unit prices (per combo): the same rule as the server's. */
export function comboUnitTotal(mode: ComboPricingMode, value: number, full: number): number {
  if (mode === "fixed_price") return Math.min(value, full);
  if (mode === "percent_off") return full - Math.min(full, Math.round((full * value) / 10000));
  if (mode === "amount_off") return Math.max(0, full - value);
  return full;
}

/** The variants a shopper picked in a combo: one per component that lets them choose. */
export type ComboSelection = Array<{ itemId: string; variantId: string }>;
