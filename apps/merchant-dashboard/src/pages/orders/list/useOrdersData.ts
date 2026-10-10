import { useRef, useState } from "react";
import { isInvalidCursorError, orderRiskCountsOf, type Order, type OrderPipeline } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useCursorList } from "@/lib/useCursorList";
import { refreshWorkCounts } from "@/lib/workCounts";
import {
  cachedOrderCounts,
  cachedOrdersPage,
  forgetOrdersOf,
  rememberOrderCounts,
  rememberOrdersPage,
} from "./ordersListCache";
import type { OrdersQuery } from "./useOrdersQuery";

/** One empty list for every render that has nothing to show, so what depends on the rows does not start over. */
const NO_ORDERS: Order[] = [];

/**
 * The orders of the list and the counts of its stages, for one query.
 *
 * Loaded as before — `GET /orders` a page at a time through `useCursorList`,
 * `GET /orders/pipeline` for the counts — with a memory in front
 * (ordersListCache.ts): a list seen before in this session is on screen at
 * once, from its last first page, while the fresh one is fetched behind it.
 * Only a list never seen shows the skeleton.
 *
 * `useCursorList` takes no first rows and keeps the previous list's rows while
 * the next one loads, so this hook keeps its own note of which list the last
 * answered first page belongs to and what its first order was (`answered`):
 * rows are taken from the hook only when they are that page's (its first row
 * is that very order), and from the memory until then.
 */
export function useOrdersData(query: OrdersQuery) {
  const { workspaceId, listKey, countsKey, listParams, fullQuery, stage } = query;
  const pageSize = query.prefs.pageSize;

  const [answered, setAnswered] = useState<{ key: string; ok: boolean; first?: Order } | null>(null);
  // Only the latest first-page request may say what is on screen.
  const firstPageRequest = useRef(0);

  const list = useCursorList<Order>(
    (cursor) => {
      const key = listKey;
      const first = cursor === undefined;
      const mine = first ? ++firstPageRequest.current : 0;
      return apiClient.listOrders(workspaceId, { cursor, limit: pageSize, ...listParams }).then(
        (r) => {
          if (first) {
            rememberOrdersPage(key, { orders: r.orders, nextCursor: r.nextCursor });
            if (mine === firstPageRequest.current) setAnswered({ key, ok: true, first: r.orders[0] });
          }
          return { items: r.orders, nextCursor: r.nextCursor };
        },
        (err: unknown) => {
          if (first && mine === firstPageRequest.current) setAnswered({ key, ok: false });
          throw err;
        }
      );
    },
    [listKey],
    { isStaleCursor: (err) => isInvalidCursorError(err, "cursor") }
  );

  const counts = useAsync<{ key: string; pipeline: OrderPipeline }>(() => {
    const key = countsKey;
    return apiClient.getOrderPipeline(workspaceId, fullQuery).then((pipeline) => {
      rememberOrderCounts(key, pipeline);
      return { key, pipeline };
    });
  }, [countsKey]);

  // ---- the rows ----------------------------------------------------------
  const kept = cachedOrdersPage(listKey);
  /** What the last answered first page said, when it was this list's. */
  const answer = answered !== null && answered.key === listKey ? answered : null;
  /**
   * The hook's rows are this list's — also while it is being read again, and after more pages were
   * added (the first row stays the same object). Never the previous list's, not even for a frame.
   */
  const loaded = answer !== null && answer.ok && list.items[0] === answer.first;
  /** A first page is on its way. */
  const busy = list.loading || answer === null;
  const rows: Order[] = loaded ? list.items : (kept?.orders ?? NO_ORDERS);
  const settled = loaded && !list.loading;
  const failed = !busy && answer !== null && !answer.ok;

  // ---- the counts --------------------------------------------------------
  const fresh = counts.data && counts.data.key === countsKey ? counts.data.pipeline : null;
  const pipeline: OrderPipeline | null = fresh ?? cachedOrderCounts(countsKey) ?? null;
  const total = pipeline ? (stage ? pipeline.stages[stage] : pipeline.total) : undefined;

  function reload() {
    list.reload();
    void counts.refresh({ silent: true });
  }

  return {
    rows,
    /** Nothing to show yet: the skeleton. */
    showSkeleton: busy && !loaded && !kept,
    /** Rows are on screen and a fresh first page is on its way. */
    refreshing: busy && (loaded || Boolean(kept)),
    /** The first page is in, and it is this list's: an empty `rows` now means "no orders". */
    settled,
    /** The first page could not be read. `rows` then holds what was kept from before, if anything. */
    error: failed ? list.error : null,
    /** A later page could not be read; the rows stay. */
    loadMoreError: settled ? list.error : null,
    hasMore: settled && list.hasMore,
    loadingMore: list.loadingMore,
    loadMore: list.loadMore,
    pipeline,
    /** Counts are being read and there are none to show meanwhile. */
    countsLoading: counts.loading && !pipeline,
    countsError: counts.loading ? null : counts.error,
    retryCounts: () => void counts.refresh(),
    riskCounts: orderRiskCountsOf(pipeline),
    /** How many orders this list holds (its stage, or all of them), once the counts are in. */
    total,
    reload,
    /**
     * After something changed the orders (a bulk action, an archive, a courier
     * file): every other list kept for this store is out of date, this one is
     * read again, and so are the counts in the side menu and the dock.
     */
    afterChange: () => {
      forgetOrdersOf(workspaceId, [listKey, countsKey]);
      reload();
      refreshWorkCounts();
    },
  };
}

export type OrdersData = ReturnType<typeof useOrdersData>;
