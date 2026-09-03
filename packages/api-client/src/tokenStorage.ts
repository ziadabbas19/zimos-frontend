export interface TokenPair {
  accessToken: string | null;
  refreshToken: string | null;
}

export interface TokenStorage {
  get(): TokenPair;
  set(tokens: TokenPair): void;
  clear(): void;
}

const ACCESS_KEY = "sb.accessToken";
const REFRESH_KEY = "sb.refreshToken";

/**
 * Default storage backed by localStorage. Safe to import in SSR contexts —
 * it no-ops when `window` isn't available (Next.js server components/middleware
 * should pass their own TokenStorage instead, e.g. backed by cookies).
 */
export function createLocalStorageTokenStorage(): TokenStorage {
  const hasWindow = typeof window !== "undefined";

  return {
    get() {
      if (!hasWindow) return { accessToken: null, refreshToken: null };
      return {
        accessToken: window.localStorage.getItem(ACCESS_KEY),
        refreshToken: window.localStorage.getItem(REFRESH_KEY),
      };
    },
    set({ accessToken, refreshToken }) {
      if (!hasWindow) return;
      if (accessToken) window.localStorage.setItem(ACCESS_KEY, accessToken);
      if (refreshToken) window.localStorage.setItem(REFRESH_KEY, refreshToken);
    },
    clear() {
      if (!hasWindow) return;
      window.localStorage.removeItem(ACCESS_KEY);
      window.localStorage.removeItem(REFRESH_KEY);
    },
  };
}

/** In-memory storage, useful for tests or server-side one-off requests. */
export function createMemoryTokenStorage(initial: TokenPair = { accessToken: null, refreshToken: null }): TokenStorage {
  let tokens = initial;
  return {
    get: () => tokens,
    set: (next) => {
      tokens = { ...tokens, ...next };
    },
    clear: () => {
      tokens = { accessToken: null, refreshToken: null };
    },
  };
}
