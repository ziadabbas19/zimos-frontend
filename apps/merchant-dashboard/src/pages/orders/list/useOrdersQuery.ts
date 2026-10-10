import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ORDER_SORTS,
  ORDER_STAGES,
  type OrderListParams,
  type OrderSearchParams,
  type OrderSort,
  type OrderStage,
} from "@store-builder/api-client";
import { resolveSort } from "@/lib/listSort";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useRiskParam, type RiskLevel } from "@/pages/fraud/RiskBadge";
import { ORDER_FILTER_KEYS, useOrderExtraFilters, useOrderListPrefs } from "../components/OrderListFilters";
import { rememberOrdersListQuery } from "../orderListQuery";
import { ordersCacheKey } from "./ordersListCache";

export const SEARCH_MIN = 2;
export const SEARCH_MAX = 100;
export const DEFAULT_SORT: OrderSort = "newest";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** The last sort picked on this device: the fallback when the URL names none (lib/listSort.ts). */
const SORT_KEY = "zimos.orders.sort";

/**
 * The stages in the order a cash-on-delivery order lives through them; waiting
 * for an online payment (not a COD stage) and cancelled go last.
 */
export const COD_STAGE_ORDER: readonly OrderStage[] = [
  "pending_confirmation",
  "needs_follow_up",
  "ready_to_ship",
  "shipped",
  "out_for_delivery",
  "delivery_failed",
  "delivered",
  "returned",
  "awaiting_payment",
  "cancelled",
].filter((stage): stage is OrderStage => (ORDER_STAGES as readonly string[]).includes(stage));

/** The date shortcuts of the Filters sheet: its key and how many days back it starts. */
export const DATE_SHORTCUTS = [
  ["today", 0],
  ["last7", 6],
  ["last30", 29],
] as const;
export type DateShortcut = (typeof DATE_SHORTCUTS)[number][0];

/** "2026-10-06" for a moment, on this device's calendar (Cairo for an Egyptian merchant), not UTC's. */
function localDay(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The range a shortcut stands for, ending today on this device's calendar like the dates themselves. */
export function shortcutRange(shortcut: DateShortcut): { from: string; to: string } {
  const back = DATE_SHORTCUTS.find(([key]) => key === shortcut)?.[1] ?? 0;
  return { from: localDay(Date.now() - back * 86_400_000), to: localDay(Date.now()) };
}

/**
 * The device's time zone (Africa/Cairo for an Egyptian merchant). Sent with
 * the dates so the API reads "6 Oct" as that whole day there, not in UTC.
 */
function deviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

function isStage(value: string | null): value is OrderStage {
  return value !== null && (ORDER_STAGES as readonly string[]).includes(value);
}

function storedSort(): string | null {
  try {
    return window.localStorage.getItem(SORT_KEY);
  } catch {
    return null;
  }
}

function rememberSort(sort: OrderSort): void {
  try {
    window.localStorage.setItem(SORT_KEY, sort);
  } catch {
    // Private tab or blocked storage: the URL still carries the choice.
  }
}

/** A query string (no leading "?") of what is set, in the order given. */
function toQueryString(values: Record<string, unknown>): string {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "") out.set(key, String(value));
  }
  return out.toString();
}

/**
 * Everything that decides which orders the list shows, read from the URL —
 * `stage`, `q`, `from`, `to`, `sort`, `risk` and the fifteen filters of the
 * Filters sheet — so a view can be shared, saved and survives a refresh.
 * Anything malformed in a hand-edited URL is ignored rather than sent.
 *
 * Every change goes through `patch`: ONE write to the URL (with `replace`),
 * whatever number of parameters it touches. react-router's setter works from
 * the parameters of the last render, so two writes in one handler would lose
 * the first.
 *
 * It does not look at the path: under the create-order sheet (/orders/new)
 * the same list, for the same query, is on screen.
 */
export function useOrdersQuery() {
  const workspaceId = useWorkspaceId();
  const [params, setParams] = useSearchParams();
  // The extra filters (tag, source, payment, governorate, courier, seen, test, archive…).
  const extra = useOrderExtraFilters();
  // The column chooser and the page size: per store, on this device.
  const prefs = useOrderListPrefs();
  // The risk level (`?risk=`), sent to the list and the counts alike.
  const risk = useRiskParam();

  const rawStage = params.get("stage");
  const stage = isStage(rawStage) ? rawStage : null;
  const rawQ = (params.get("q") ?? "").trim();
  const q = rawQ.length >= SEARCH_MIN ? rawQ.slice(0, SEARCH_MAX) : "";
  const rawFrom = params.get("from") ?? "";
  const rawTo = params.get("to") ?? "";
  const from = DATE_RE.test(rawFrom) ? rawFrom : "";
  const to = DATE_RE.test(rawTo) ? rawTo : "";
  const rangeInvalid = Boolean(from && to && from > to);
  // Sorted on the server; the default is the list's order as it always was.
  const sort = resolveSort<OrderSort>(params.get("sort"), storedSort(), ORDER_SORTS, DEFAULT_SORT);

  // Dates only reach the API as a valid range.
  const search = {
    q: q || undefined,
    from: rangeInvalid ? undefined : from || undefined,
    to: rangeInvalid ? undefined : to || undefined,
    tz: !rangeInvalid && (from || to) ? deviceTimeZone() : undefined,
  };
  // The API accepts them on the list, the counts and the export alike.
  const fullQuery = { ...search, ...extra.query, ...risk.query } as OrderSearchParams;
  const listParams: OrderListParams = { stage: stage ?? undefined, sort, ...fullQuery };

  const listQuery = toQueryString({ stage, sort, ...fullQuery });
  const countsQuery = toQueryString({ ...fullQuery });

  // The order page's previous / next arrows follow this list.
  useEffect(() => {
    rememberOrdersListQuery(listQuery);
  }, [listQuery]);

  function patch(changes: Record<string, string | null | undefined>) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true }
    );
  }

  /** Everything the Filters sheet holds, back to nothing: dates, risk, sort and the fifteen filters. */
  const sheetCleared: Record<string, null> = {
    from: null,
    to: null,
    risk: null,
    sort: null,
    ...Object.fromEntries(ORDER_FILTER_KEYS.map((key) => [key, null])),
  };

  // Dates, risk, a sort other than the usual one, and each of the fifteen: what the Filters button counts.
  const activeCount = (from || to ? 1 : 0) + (risk.risk ? 1 : 0) + (sort !== DEFAULT_SORT ? 1 : 0) + extra.active.length;

  return {
    workspaceId,
    /** The page's query as it stands in the URL: a saved view is this whole string. */
    params,
    stage,
    q,
    from,
    to,
    rangeInvalid,
    sort,
    risk: risk.risk,
    extra,
    prefs,
    fullQuery,
    listParams,
    /** What the order page's previous / next follow (orderListQuery.ts). */
    listQuery,
    /** Names this list for the cache and the loader: the store, the query, the page size. */
    listKey: ordersCacheKey(workspaceId, `${listQuery}&limit=${prefs.pageSize}`),
    /** Names its counts: the same without stage and sort, which do not change them. */
    countsKey: ordersCacheKey(workspaceId, countsQuery),
    /** A different list starts a fresh selection (the page size is not part of it). */
    selectionKey: ordersCacheKey(workspaceId, listQuery),
    activeCount,
    hasSearch: Boolean(q),
    patch,
    setStage: (next: OrderStage | null) => patch({ stage: next }),
    setRisk: (next: RiskLevel | null) => patch({ risk: next }),
    setSort: (next: OrderSort) => {
      rememberSort(next);
      patch({ sort: next });
    },
    /** A saved view replaces every parameter with its own. */
    applyView: (viewQuery: string) => setParams(new URLSearchParams(viewQuery), { replace: true }),
    /** "Clear all" of the Filters sheet and of the chips under the toolbar. The stage and the search stay. */
    clearFilters: () => {
      rememberSort(DEFAULT_SORT);
      patch(sheetCleared);
    },
    /** The same and the search with it: the way out of "nothing matches". */
    clearSearchAndFilters: () => {
      rememberSort(DEFAULT_SORT);
      patch({ ...sheetCleared, q: null });
    },
  };
}

export type OrdersQuery = ReturnType<typeof useOrdersQuery>;
