/**
 * A product's menu options (backend: catalog/menuOptions.js), mounted at
 * /workspaces/:workspaceId/product-options/:productId — read with
 * products.view, replaced as a whole with products.manage. Choices' prices are
 * minor units and only ever added by the server.
 */
import type { ApiClient } from "../client";

export interface MenuOptionChoice {
  id?: string;
  name: string;
  priceDeltaAmount: number;
  active: boolean;
  /**
   * The choice's code in the merchant's till / kitchen system, sent to
   * integrations with the order. Never shown to shoppers. Left out of a save:
   * the stored one is kept; null or "" clears it.
   */
  externalCode?: string | null;
}

export interface MenuOptionGroup {
  id?: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  active: boolean;
  choices: MenuOptionChoice[];
}

/** What a shopper sends with a line: the choices picked per group. */
export type MenuOptionsInput = Array<{ groupId: string; choiceIds: string[] }>;

/** A product page's groups (GET /store/:ws/products/:id `optionGroups`): active ones only. */
export interface StorefrontOptionGroup {
  id: string;
  name: string;
  required: boolean;
  /** At least this many picks (1 for a required group). */
  minSelect: number;
  maxSelect: number;
  choices: Array<{ id: string; name: string; priceDeltaAmount: number }>;
}

/** The picks a cart or order line carries, names and prices included. */
export type MenuOptionsSnapshot = Array<{ groupId?: string; groupName: string; choices: Array<{ choiceId?: string; name: string; priceDeltaAmount: number }> }>;

const base = (workspaceId: string, productId: string) => `/workspaces/${workspaceId}/product-options/${productId}`;

export async function menuOptionsGet(client: ApiClient, workspaceId: string, productId: string): Promise<MenuOptionGroup[]> {
  const { groups } = await client.request<{ groups: MenuOptionGroup[] }>(base(workspaceId, productId));
  return groups;
}

/** 422 OPTION_GROUP_NOT_FOUND / OPTION_CHOICE_NOT_FOUND for an id that is not this product's. */
export async function menuOptionsSave(client: ApiClient, workspaceId: string, productId: string, groups: MenuOptionGroup[]): Promise<MenuOptionGroup[]> {
  const res = await client.request<{ groups: MenuOptionGroup[] }>(base(workspaceId, productId), { method: "PUT", body: { groups } });
  return res.groups;
}

/** "Size: Large · Extras: Cheese, Olives". */
export function menuOptionsLabel(snapshot: MenuOptionsSnapshot | null | undefined): string {
  if (!Array.isArray(snapshot) || snapshot.length === 0) return "";
  return snapshot.map((g) => `${g.groupName}: ${g.choices.map((c) => c.name).join(", ")}`).join(" · ");
}
