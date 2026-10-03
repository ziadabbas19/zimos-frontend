/**
 * Orders CSV export (backend: src/modules/orders/orderExportService.js).
 * Functions take the shared ApiClient instance and use its public `request()`.
 * Exported names are prefixed with `ordersExport` / `OrderExport`.
 *
 * GET /workspaces/:id/orders/export/columns and /orders/export. Both need
 * orders.view and orders.export (403 FORBIDDEN otherwise; of the system roles
 * only the owner holds orders.export). The phone, alternatePhone and email
 * columns also need customers.reveal_sensitive: without it the defaults leave
 * them out and naming one is a 403. Other refusals, before any byte of the file:
 * 422 EXPORT_TOO_LARGE (details: { rows, maxRows }), 422 VALIDATION_ERROR (a
 * date range over 366 days, an unknown column).
 */
import { ApiError, type ApiClient } from "../client";
import type { OrderListParams } from "../types";

// ------------------------------------------------------------------ types --

export interface OrderExportColumn {
  key: string;
  label: { en: string; ar: string };
  /** Only meaningful on a row-per-line file. */
  perItem: boolean;
  /** A contact column (needs customers.reveal_sensitive). */
  sensitive: boolean;
  /** False for a contact column the caller may not take. */
  available: boolean;
}

export interface OrderExportCatalogue {
  columns: OrderExportColumn[];
  /** The columns used when none are named, per row shape (already filtered for the caller). */
  defaults: { order: string[]; item: string[] };
  maxRows: number;
  canRevealSensitive: boolean;
}

export type OrderExportRowPer = "order" | "item";

/** The orders list's own filters and sort, plus the file's shape. */
export interface OrderExportParams extends Omit<OrderListParams, "limit" | "cursor"> {
  columns?: string[];
  rowPer?: OrderExportRowPer;
  lang?: "en" | "ar";
}

// ------------------------------------------------------------- endpoints --

const base = (workspaceId: string) => `/workspaces/${workspaceId}/orders/export`;

function query(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export async function ordersExportColumns(client: ApiClient, workspaceId: string): Promise<OrderExportCatalogue> {
  return client.request<OrderExportCatalogue>(`${base(workspaceId)}/columns`);
}

/**
 * The file as a Blob, ready to save. `request()` hands non-JSON answers back
 * as text, and decoding drops the byte-order mark, so it is put back: it is
 * what makes Excel read the Arabic as UTF-8.
 */
export async function ordersExportCsv(client: ApiClient, workspaceId: string, params: OrderExportParams = {}): Promise<Blob> {
  const text = await client.request<string>(`${base(workspaceId)}${query(params)}`, { headers: { Accept: "text/csv" } });
  const body = text.startsWith("﻿") ? text : `﻿${text}`;
  return new Blob([body], { type: "text/csv;charset=utf-8" });
}

/** `{ rows, maxRows }` of a 422 EXPORT_TOO_LARGE, or null for anything else. */
export function ordersExportTooLarge(err: unknown): { rows: number; maxRows: number } | null {
  if (!(err instanceof ApiError) || err.status !== 422 || err.code !== "EXPORT_TOO_LARGE") return null;
  const body = err.details as { error?: { details?: { rows?: unknown; maxRows?: unknown } } } | undefined;
  const rows = Number(body?.error?.details?.rows);
  const maxRows = Number(body?.error?.details?.maxRows);
  return Number.isFinite(rows) && Number.isFinite(maxRows) ? { rows, maxRows } : null;
}
