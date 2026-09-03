import { useCallback, useEffect, useRef, useState } from "react";

interface AsyncState<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  /** Re-run the loader. Pass { silent: true } to keep stale data visible. */
  refresh: (opts?: { silent?: boolean }) => Promise<void>;
  setData: (updater: T | ((prev: T | null) => T)) => void;
}

/**
 * Runs `loader` on mount and whenever `deps` change. Ignores the result of a
 * stale call if deps changed mid-flight. `loader` is intentionally not part of
 * the dependency list — pass the values it closes over via `deps`.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setDataState] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const callId = useRef(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    const id = ++callId.current;
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const result = await loaderRef.current();
      if (id === callId.current) setDataState(result);
    } catch (err) {
      if (id === callId.current) setError(err);
    } finally {
      if (id === callId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const setData = useCallback((updater: T | ((prev: T | null) => T)) => {
    setDataState((prev) => (typeof updater === "function" ? (updater as (p: T | null) => T)(prev) : updater));
  }, []);

  return { data, error, loading, refresh, setData };
}
