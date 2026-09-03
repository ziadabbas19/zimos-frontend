import { useCallback, useEffect, useRef, useState } from "react";

interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

interface CursorListState<T> {
  items: T[];
  loading: boolean;
  loadingMore: boolean;
  error: unknown;
  hasMore: boolean;
  loadMore: () => void;
  /** Reload from the first page (keeps filters). */
  reload: () => void;
  /** Mutate the loaded items in place, e.g. after an inline edit/delete. */
  setItems: (updater: (prev: T[]) => T[]) => void;
}

/**
 * Accumulating cursor pagination. `fetchPage(cursor)` returns one page; the hook
 * concatenates pages and re-fetches from scratch whenever `deps` change.
 * `fetchPage` is read from a ref so it doesn't need to be memoised by callers.
 */
export function useCursorList<T>(
  fetchPage: (cursor?: string) => Promise<Page<T>>,
  deps: unknown[]
): CursorListState<T> {
  const [items, setItemsState] = useState<T[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const runId = useRef(0);

  const load = useCallback(async (cursor?: string) => {
    const id = ++runId.current;
    const append = Boolean(cursor);
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const page = await fetchRef.current(cursor);
      if (id !== runId.current) return;
      setItemsState((prev) => (append ? [...prev, ...page.items] : page.items));
      setNextCursor(page.nextCursor);
    } catch (err) {
      if (id === runId.current) setError(err);
    } finally {
      if (id === runId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    void load(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    items,
    loading,
    loadingMore,
    error,
    hasMore: nextCursor !== null,
    loadMore: () => {
      if (nextCursor) void load(nextCursor);
    },
    reload: () => void load(undefined),
    setItems: (updater) => setItemsState((prev) => updater(prev)),
  };
}
