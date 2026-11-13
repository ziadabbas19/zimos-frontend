/**
 * The orders report and the products report (backend:
 * src/modules/analytics/orderProductReports.js), at
 * /workspaces/:workspaceId/analytics/reports (analytics.view), while the API
 * runs with STORE_FEATURES order_product_reports (404 FEATURE_UNAVAILABLE otherwise).
 * All exported names in this file are prefixed with `ordersReport` /
 * `productsReport` (or `OrdersReport` / `ProductsReport`).
 *
 * The orders are the ones the Orders page lists for those dates (archived and
 * test orders left out), each under its Orders page stage. Money is integer
 * minor units in the store's currency; rates are percentages (12.5 = 12.5%),
 * null without a denominator.
 */
import type { ApiClient } from "../client";
import type { ReportsCompare, ReportsRange, ReportsRangeParams, ReportsUnit } from "./reports";
import type { OrderStage } from "../types";

export type OrdersReportKpiKey = "orders" | "revenue" | "averageOrderValue" | "cancellationRate" | "returnRate" | "deliveryRate";

export interface OrdersReportKpi {
  value: number | null;
  /** The comparison window's value; null with `compare: "none"`. */
  previous: number | null;
}

export interface OrdersReportFigures {
  orders: number;
  revenue: number;
  averageOrderValue: number;
  cancellationRate: number | null;
  returnRate: number | null;
  deliveryRate: number | null;
  cancelled: number;
  shipped: number;
  delivered: number;
  returned: number;
}

/** A governorate, payment method or courier; `name` null = none (no governorate, not shipped yet). */
export interface OrdersReportGroup extends OrdersReportFigures {
  name: string | null;
}

export interface OrdersReportPoint {
  /** "YYYY-MM-DDTHH:mm", store time. */
  bucket: string;
  orders: number;
  revenue: number;
}

export interface OrdersReport {
  range: ReportsRange;
  previousRange: { from: string; to: string } | null;
  compare: ReportsCompare;
  unit: ReportsUnit;
  currency: string;
  kpis: Record<OrdersReportKpiKey, OrdersReportKpi>;
  counts: { cancelled: number; shipped: number; delivered: number; returned: number };
  series: OrdersReportPoint[];
  previousSeries: OrdersReportPoint[] | null;
  /** Every Orders page stage, in its order, zero included. */
  byStatus: Array<{ status: OrderStage; orders: number; revenue: number }>;
  byGovernorate: OrdersReportGroup[];
  byPaymentMethod: OrdersReportGroup[];
  byCarrier: OrdersReportGroup[];
}

export interface OrdersReportParams extends ReportsRangeParams {
  compare?: ReportsCompare;
  unit?: ReportsUnit;
}

/** The table's filters: a breakdown row clicked. `""` = none (no governorate, not shipped yet). */
export interface OrdersReportTableParams extends ReportsRangeParams {
  status?: OrderStage;
  governorate?: string;
  paymentMethod?: string;
  carrier?: string;
  cursor?: string;
  limit?: number;
}

export interface OrdersReportOrder {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: OrderStage;
  paymentMethod: string;
  governorate: string | null;
  carrier: string | null;
  items: number;
  total: number;
  /** False for a cancelled order or a prepaid one never paid: its total isn't in the revenue. */
  countsAsRevenue: boolean;
  /** Only for a teammate who may see orders; null while the order's details are locked. */
  customerName?: string | null;
  contactLocked?: boolean;
}

export interface OrdersReportOrders {
  currency: string;
  timeZone: string;
  orders: OrdersReportOrder[];
  nextCursor: string | null;
}

export interface ProductsReportRow {
  productId: string;
  name: string;
  imageUrl: string | null;
  status: string | null;
  units: number;
  revenue: number;
  orders: number;
  returnedUnits: number;
  /** Percent of the range's product revenue; null when there was none. */
  share: number | null;
  /** Units that can still be sold, over its active variants; null without any. */
  stock: number | null;
}

export interface ProductsReportStockRow {
  productId: string;
  name: string;
  imageUrl: string | null;
  available: number;
  state: "low" | "out";
}

export interface ProductsReport {
  range: ReportsRange;
  currency: string;
  totals: { revenue: number; units: number; productsSold: number; productsUnsold: number };
  topByRevenue: ProductsReportRow[];
  topByUnits: ProductsReportRow[];
  lowestSellers: ProductsReportRow[];
  noSales: ProductsReportRow[];
  stock: ProductsReportStockRow[];
  /** Every product that sold, by revenue. */
  rows: ProductsReportRow[];
  /** A variant without its own alert level counts as low at or below this. */
  lowStockFallback: number;
}

export interface ProductsReportTrend {
  productId: string;
  name: string;
  unit: ReportsUnit;
  currency: string;
  series: Array<{ bucket: string; units: number; revenue: number }>;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/analytics/reports`;

function query(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value !== undefined && value !== null) search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

async function csv(client: ApiClient, path: string): Promise<Blob> {
  // `rawFetch` is private on ApiClient; it carries the token, refresh and ApiError.
  const raw = client as unknown as { rawFetch(path: string, init: RequestInit): Promise<Response> };
  const res = await raw.rawFetch(path, { headers: { Accept: "text/csv" } });
  return res.blob();
}

export async function ordersReportGet(client: ApiClient, workspaceId: string, params: OrdersReportParams = {}): Promise<OrdersReport> {
  const { report } = await client.request<{ report: OrdersReport }>(`${base(workspaceId)}/orders-overview${query(params)}`);
  return report;
}

export function ordersReportOrders(client: ApiClient, workspaceId: string, params: OrdersReportTableParams = {}) {
  return client.request<OrdersReportOrders>(`${base(workspaceId)}/orders-overview/orders${query(params)}`);
}

/** The table's orders as CSV, the filters applied (at most 10,000 rows). */
export function ordersReportExportCsv(client: ApiClient, workspaceId: string, params: OrdersReportTableParams = {}): Promise<Blob> {
  const { cursor: _cursor, limit: _limit, ...rest } = params;
  return csv(client, `${base(workspaceId)}/orders-overview/export${query(rest)}`);
}

export async function productsReportGet(client: ApiClient, workspaceId: string, params: ReportsRangeParams & { limit?: number } = {}): Promise<ProductsReport> {
  const { report } = await client.request<{ report: ProductsReport }>(`${base(workspaceId)}/products-overview${query(params)}`);
  return report;
}

export async function productsReportTrend(client: ApiClient, workspaceId: string, productId: string, params: ReportsRangeParams = {}): Promise<ProductsReportTrend> {
  const { trend } = await client.request<{ trend: ProductsReportTrend }>(`${base(workspaceId)}/products-overview/${productId}/trend${query(params)}`);
  return trend;
}

/** Every product of the range as CSV, sold or not. */
export function productsReportExportCsv(client: ApiClient, workspaceId: string, params: ReportsRangeParams = {}): Promise<Blob> {
  return csv(client, `${base(workspaceId)}/products-overview/export${query(params)}`);
}
