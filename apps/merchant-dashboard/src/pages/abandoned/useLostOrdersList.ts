import { useCallback, useEffect, useRef, useState } from "react";
import { isInvalidCursorError, lostOrdersList, type LostOrder, type LostOrderFilters } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";

/** The first page of a query, as it was last seen. */
interface Snapshot {
  items: LostOrder[];
  nextCursor: string | null;
  abandonedAfter: number | null;
}

// A list the merchant comes back to shows at once: the first page of each query is kept for the
// session (the rows as the server sent them — a number revealed on the page is never kept here).
const memory = new Map<string, Snapshot>();
const MAX_QUERIES = 24;

function remember(key: string, snapshot: Snapshot) {
  memory.delete(key);
  memory.set(key, snapshot);
  if (memory.size > MAX_QUERIES) memory.delete(memory.keys().next().value as string);
}

interface ListState extends Snapshot {
  key: string;
  /** An answer for this query is on screen, from memory or from the server. */
  ready: boolean;
  /** The first page is on its way. */
  refreshing: boolean;
  loadingMore: boolean;
  /** The first page failed. */
  error: unknown;
  /** "Load more" failed; the rows already loaded stay. */
  moreError: unknown;
}

function startOf(key: string): ListState {
  const seen = memory.get(key);
  return {
    key,
    items: seen?.items ?? [],
    nextCursor: seen?.nextCursor ?? null,
    abandonedAfter: seen?.abandonedAfter ?? null,
    ready: seen !== undefined,
    refreshing: true,
    loadingMore: false,
    error: null,
    moreError: null,
  };
}

export interface LostOrdersListState {
  items: LostOrder[];
  /** True only while there is nothing to show yet: a query seen before shows at once and refreshes behind. */
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  error: unknown;
  moreError: unknown;
  hasMore: boolean;
  /** The store's setting, as the last page reported it; null until a page arrived. */
  abandonedAfter: number | null;
  loadMore: () => void;
  /** Read the first page again. The rows on screen stay until the answer arrives. */
  reload: () => void;
  /** Change the loaded rows in place, after an edit or a delete. */
  setItems: (updater: (prev: LostOrder[]) => LostOrder[]) => void;
}

/**
 * The lost orders of one query (GET /checkout-sessions), page by page through
 * the `before` cursor — what `useCursorList` did here, plus a memory: the first
 * page of a query the merchant already looked at is drawn at once and
 * refreshed silently. A cursor that went stale restarts from the first page.
 */
export function useLostOrdersList(workspaceId: string, filters: LostOrderFilters): LostOrdersListState {
  // Who is looking is part of the key: what the server sends depends on the role (phones are masked for some),
  // so rows remembered for one person are never drawn for the next one to sign in on this tab.
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const key = `${workspaceId}|${user?.id ?? ""}|${currentWorkspace?.role ?? ""}|${JSON.stringify(filters)}`;
  const [state, setState] = useState<ListState>(() => startOf(key));
  // Another query: start from what memory has for it, in this same render, so its rows never show under the old tab.
  if (state.key !== key) setState(startOf(key));
  const current = state.key === key ? state : startOf(key);

  const keyRef = useRef(key);
  keyRef.current = key;
  const queryRef = useRef({ workspaceId, filters });
  queryRef.current = { workspaceId, filters };
  const run = useRef(0);

  const load = useCallback(async (cursor?: string): Promise<void> => {
    const id = ++run.current;
    const forKey = keyRef.current;
    const query = queryRef.current;
    const append = Boolean(cursor);
    setState((prev) =>
      prev.key !== forKey
        ? prev
        : { ...prev, error: null, moreError: null, refreshing: !append, loadingMore: append }
    );
    try {
      const page = await lostOrdersList(apiClient, query.workspaceId, { ...query.filters, before: cursor });
      if (id !== run.current) return;
      if (!append) {
        remember(forKey, { items: page.sessions, nextCursor: page.nextCursor, abandonedAfter: page.abandonedAfterMinutes });
      }
      setState((prev) =>
        prev.key !== forKey
          ? prev
          : {
              ...prev,
              items: append ? [...prev.items, ...page.sessions] : page.sessions,
              nextCursor: page.nextCursor,
              abandonedAfter: page.abandonedAfterMinutes,
              ready: true,
              refreshing: false,
              loadingMore: false,
            }
      );
    } catch (err) {
      if (id !== run.current) return;
      // The cursor's anchor row is gone: quietly start again from the first page.
      if (append && isInvalidCursorError(err, "before")) return load(undefined);
      setState((prev) =>
        prev.key !== forKey
          ? prev
          : append
            ? { ...prev, loadingMore: false, moreError: err }
            : { ...prev, refreshing: false, error: err }
      );
    }
  }, []);

  useEffect(() => {
    void load(undefined);
  }, [key, load]);

  const setItems = useCallback((updater: (prev: LostOrder[]) => LostOrder[]) => {
    const forKey = keyRef.current;
    // The remembered first page takes the same change, so a row deleted here is not drawn again on the way back.
    const seen = memory.get(forKey);
    if (seen) memory.set(forKey, { ...seen, items: updater(seen.items) });
    setState((prev) => (prev.key === forKey ? { ...prev, items: updater(prev.items) } : prev));
  }, []);

  const nextCursor = current.nextCursor;
  return {
    items: current.items,
    loading: !current.ready && current.error === null,
    refreshing: current.refreshing,
    loadingMore: current.loadingMore,
    error: current.error,
    moreError: current.moreError,
    hasMore: nextCursor !== null,
    abandonedAfter: current.abandonedAfter,
    loadMore: () => {
      if (nextCursor && !current.loadingMore) void load(nextCursor);
    },
    reload: () => void load(undefined),
    setItems,
  };
}
