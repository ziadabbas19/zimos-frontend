/**
 * Dashboard-wide helpers (backend: src/modules/dashboard): global search, the
 * setup guide and the member's sidebar shortcuts.
 *
 * Mounted at /workspaces/:workspaceId. Any active member may call them; a
 * search group the member's role cannot see comes back empty.
 */
import type { ApiClient } from "../client";

export interface SearchOrderHit {
  id: string;
  orderNumber: string;
  customerName: string | null;
  totalAmount: string;
  currency: string;
  createdAt: string;
}

export interface SearchProductHit {
  id: string;
  name: string;
  productCode: string | null;
  status: string;
  imageUrl: string | null;
}

export interface SearchCustomerHit {
  id: string;
  fullName: string | null;
  phone: string;
  totalOrders: number;
}

export interface SearchFunnelHit {
  id: string;
  name: string;
  status: string;
}

export interface DashboardSearchResult {
  orders: SearchOrderHit[];
  products: SearchProductHit[];
  customers: SearchCustomerHit[];
  funnels: SearchFunnelHit[];
}

export type SetupStepKey = "product" | "website" | "payment" | "shipping" | "domain" | "pixel" | "order";

export interface SetupGuide {
  steps: { key: SetupStepKey; done: boolean; optional: boolean }[];
  /** Required steps done / required steps in all. */
  completed: number;
  total: number;
  percent: number;
  done: boolean;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}`;

/** Up to five matches per group. Fewer than two characters returns nothing. */
export async function dashboardSearch(client: ApiClient, workspaceId: string, q: string, signal?: AbortSignal): Promise<DashboardSearchResult> {
  return client.request<DashboardSearchResult>(`${base(workspaceId)}/search?q=${encodeURIComponent(q)}`, { signal });
}

export async function dashboardSetupGuide(client: ApiClient, workspaceId: string): Promise<SetupGuide> {
  return client.request<SetupGuide>(`${base(workspaceId)}/setup-guide`);
}

/** The dashboard routes this member pinned, in order. */
export async function dashboardGetShortcuts(client: ApiClient, workspaceId: string): Promise<string[]> {
  const { shortcuts } = await client.request<{ shortcuts: string[] }>(`${base(workspaceId)}/shortcuts`);
  return shortcuts;
}

/** Replaces the list. At most 8 routes, each like "/orders". */
export async function dashboardSetShortcuts(client: ApiClient, workspaceId: string, shortcuts: string[]): Promise<string[]> {
  const result = await client.request<{ shortcuts: string[] }>(`${base(workspaceId)}/shortcuts`, { method: "PUT", body: { shortcuts } });
  return result.shortcuts;
}

/**
 * The Home page's shortcuts row of this member in this store (backend:
 * dashboard/homeShortcuts.js). Ids from a fixed catalogue; the server has
 * already left out what the member's role, the store's plan or this deploy's
 * switches do not allow.
 */
export interface HomeShortcuts {
  /** False: the member never arranged the row and `shortcuts` is the default one. */
  customized: boolean;
  /** The row, in order. */
  shortcuts: string[];
  /** The default row, for going back to it. */
  defaults: string[];
  /** Every id this member may put on the row. */
  available: string[];
  /** How many the row may hold. */
  max: number;
}

export async function dashboardGetHomeShortcuts(client: ApiClient, workspaceId: string): Promise<HomeShortcuts> {
  const { homeShortcuts } = await client.request<{ homeShortcuts: HomeShortcuts }>(`${base(workspaceId)}/home-shortcuts`);
  return homeShortcuts;
}

/** Replaces the row. 422 for an id outside the catalogue, a repeat or too many; 403 HOME_SHORTCUT_NOT_ALLOWED for a page this member may not open. */
export async function dashboardSetHomeShortcuts(client: ApiClient, workspaceId: string, shortcuts: string[]): Promise<HomeShortcuts> {
  const { homeShortcuts } = await client.request<{ homeShortcuts: HomeShortcuts }>(`${base(workspaceId)}/home-shortcuts`, { method: "PUT", body: { shortcuts } });
  return homeShortcuts;
}

/** Back to the default row. */
export async function dashboardResetHomeShortcuts(client: ApiClient, workspaceId: string): Promise<HomeShortcuts> {
  const { homeShortcuts } = await client.request<{ homeShortcuts: HomeShortcuts }>(`${base(workspaceId)}/home-shortcuts`, { method: "DELETE" });
  return homeShortcuts;
}

/**
 * `GET /workspaces/:id/bootstrap` — what the dashboard's frame reads on every
 * page load, in one answer. Each part is the body (or the named part of the
 * body) of the endpoint beside it, built by the same code on the server; a
 * part the member's role may not read is null, and that endpoint answers 403.
 * The order pipeline (the menu's "to ship" badge) is not in it: it counts
 * every order of the store, and is asked for on its own.
 */
export interface DashboardBootstrap {
  /** `GET /auth/me`, the whole body. */
  me: unknown;
  /** `GET /auth/me/ui-preferences` → `uiPreferences`. */
  uiPreferences: unknown;
  /** `GET /workspaces` → `workspaces`. */
  workspaces: unknown[];
  /** `GET /workspaces/:id/access` → `access`. */
  access: unknown;
  /** `GET /workspaces/:id/plan-features` → `planFeatures`. */
  planFeatures: unknown;
  /** `GET /workspaces/:id/notifications/summary`, the whole body. */
  notifications: unknown;
  /** `GET /workspaces/:id/shortcuts` → `shortcuts`. */
  shortcuts: string[];
  /** `GET /workspaces/:id/home-shortcuts` → `homeShortcuts`. Absent from an API that does not have them yet. */
  homeShortcuts?: HomeShortcuts;
  /** `GET /workspaces/:id/confirmation-tasks/counts` → `counts`. */
  confirmationCounts: unknown | null;
  /** `GET /workspaces/:id/inbox/conversations?status=open&unread=true&limit=1`, the whole body. */
  inboxUnread: unknown | null;
}

export async function dashboardBootstrap(client: ApiClient, workspaceId: string): Promise<DashboardBootstrap> {
  const { bootstrap } = await client.request<{ bootstrap: DashboardBootstrap }>(`${base(workspaceId)}/bootstrap`);
  return bootstrap;
}
