/**
 * Reports endpoints (backend: src/modules/analytics — overviewService.js and
 * utmReportService.js). Functions take the shared ApiClient instance and use
 * its public `request()`. Exported names are prefixed with `reports` / `Report`.
 *
 * Mounted at /workspaces/:workspaceId/analytics; both need analytics.view
 * (403 FORBIDDEN without it). A window is `from`/`to` (ISO; `to` exclusive),
 * at most 366 days — longer, or `from` not before `to`, is a 422
 * VALIDATION_ERROR. Money is integer minor units; rates are percentages with
 * one decimal (12.5 = 12.5%) or null when there is nothing to divide by.
 */
import type { ApiClient } from "../client";

// ------------------------------------------------------------------ types --

export interface ReportWindowParams {
  from?: string;
  to?: string;
}

/** One number for the window, and for the window before it (null with compare=none). */
export interface ReportMetric {
  value: number | null;
  previous: number | null;
}

export type ReportOverviewMetricKey =
  | "sales"
  | "orders"
  | "averageOrderValue"
  | "cancelledOrders"
  | "collected"
  | "confirmationRate"
  | "deliveryRate"
  | "deliveredOrders"
  | "sessions"
  | "conversionRate"
  | "newCustomers"
  | "returningCustomers";

/** The money metrics of the overview (minor units, never null). */
export const REPORT_MONEY_METRICS: readonly ReportOverviewMetricKey[] = ["sales", "averageOrderValue", "collected"];

export interface ReportOverviewDay {
  /** YYYY-MM-DD on the store's clock. */
  date: string;
  orders: number;
  sales: number;
  sessions: number;
}

export interface ReportTopProduct {
  /** Null for a product deleted since. */
  productId: string | null;
  name: string;
  quantity: number;
  sales: number;
}

export interface ReportOverview {
  range: { from: string; to: string; timeZone: string };
  previousRange: { from: string; to: string } | null;
  currency: string;
  /** When the numbers were computed: the same window is served from a one-minute cache. */
  generatedAt: string;
  metrics: Record<ReportOverviewMetricKey, ReportMetric>;
  /** Every day of the window, zeros included. */
  series: ReportOverviewDay[];
  previousSeries: ReportOverviewDay[] | null;
  topProducts: ReportTopProduct[];
}

export interface ReportOverviewParams extends ReportWindowParams {
  compare?: "previous" | "none";
}

export const REPORT_UTM_GROUP_BY = ["source", "medium", "campaign", "content", "term"] as const;
export type ReportUtmGroupBy = (typeof REPORT_UTM_GROUP_BY)[number];

/** The values a report can be narrowed to (a drill-down from a row). */
export type ReportUtmFilterKey = "source" | "medium" | "campaign";

export interface ReportUtmRow {
  /**
   * The UTM value, lower-cased. Null with `tracked` = the storefront saw the
   * purchase but the visit had no such tag (direct); null without `tracked` =
   * orders with no storefront purchase at all (entered by hand, phone orders,
   * or a blocked tracker).
   */
  key: string | null;
  tracked: boolean;
  visitors: number;
  orders: number;
  liveOrders: number;
  cancelledOrders: number;
  sales: number;
  averageOrderValue: number;
  confirmedOrders: number;
  deliveredOrders: number;
  deliveredSales: number;
  /** orders ÷ visitors, %; null for the not-tracked row or without visitors. */
  conversionRate: number | null;
}

export interface ReportUtm {
  range: { from: string; to: string; timeZone: string };
  currency: string;
  groupBy: ReportUtmGroupBy;
  filters: Partial<Record<ReportUtmFilterKey, string>>;
  totals: {
    visitors: number;
    orders: number;
    trackedOrders: number;
    sales: number;
    averageOrderValue: number;
    confirmedOrders: number;
    deliveredOrders: number;
    deliveredSales: number;
    conversionRate: number | null;
  };
  /** Highest sales first; at most 200 (`truncated` says when there were more). */
  rows: ReportUtmRow[];
  truncated: boolean;
  series: { date: string; visitors: number; orders: number; sales: number }[];
}

export interface ReportUtmParams extends ReportWindowParams, Partial<Record<ReportUtmFilterKey, string>> {
  groupBy?: ReportUtmGroupBy;
}

// ------------------------------------------------------------- endpoints --

const base = (workspaceId: string) => `/workspaces/${workspaceId}/analytics`;

function query(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

/** The dashboard home: every metric for the window and the one before it. */
export async function reportsGetOverview(
  client: ApiClient,
  workspaceId: string,
  params: ReportOverviewParams = {}
): Promise<ReportOverview> {
  const { overview } = await client.request<{ overview: ReportOverview }>(`${base(workspaceId)}/overview${query(params)}`);
  return overview;
}

/** Sales by UTM value. */
export async function reportsGetUtm(client: ApiClient, workspaceId: string, params: ReportUtmParams = {}): Promise<ReportUtm> {
  const { report } = await client.request<{ report: ReportUtm }>(`${base(workspaceId)}/utm${query(params)}`);
  return report;
}
