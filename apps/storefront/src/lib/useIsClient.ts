import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False during SSR and hydration, true afterwards — for values that only the
 * browser has (localStorage, `window.location`, `navigator`), read without a
 * mount effect so the server HTML and the first client render still agree.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
