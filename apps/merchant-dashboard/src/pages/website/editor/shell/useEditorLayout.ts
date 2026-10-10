import { useCallback, useState, useSyncExternalStore } from "react";

/**
 * Where the editor's layout changes shape.
 *  - from `lg` (64rem) it is three zones side by side: sections, stage, inspector;
 *  - under it the stage fills the screen, with a bottom bar and sheets;
 *  - under `md` (48rem) the toolbar drops the device switch: the phone IS the device.
 */
export const WIDE_QUERY = "(min-width: 64rem)";
export const ROOMY_QUERY = "(min-width: 48rem)";

/** The three widths the stage can show. The names are StorefrontPreview's `device` values. */
export type EditorDevice = "phone" | "tablet" | "desktop";
export const EDITOR_DEVICES: readonly EditorDevice[] = ["phone", "tablet", "desktop"];

/** What the preview's imperative handle offers (StorefrontPreview's `controlsRef`). */
export interface PreviewControls {
  refresh(): void;
  setXray(on: boolean): void;
  setColorMode(mode: "light" | "dark"): void;
}

/** Whether a media query matches right now, kept up to date. `fallback` is the answer where there is no matchMedia. */
export function useMediaQuery(query: string, fallback = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = typeof window.matchMedia === "function" ? window.matchMedia(query) : null;
      if (!list) return () => undefined;
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query]
  );
  const read = useCallback(
    () => (typeof window.matchMedia === "function" ? window.matchMedia(query).matches : fallback),
    [query, fallback]
  );
  return useSyncExternalStore(subscribe, read, () => fallback);
}

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // A private tab or blocked storage: the default.
    return null;
  }
}

function writeStored(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Kept for this visit only.
  }
}

/**
 * One of a few named values remembered in this browser (the device the stage
 * shows, a panel open or closed). Anything else found in storage — an old
 * build, a hand edit — falls back to `fallback`.
 */
export function useStoredChoice<T extends string>(key: string, fallback: T, allowed: readonly T[]): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => {
    const stored = readStored(key);
    return stored !== null && (allowed as readonly string[]).includes(stored) ? (stored as T) : fallback;
  });
  const set = useCallback(
    (next: T) => {
      setValue(next);
      writeStored(key, next);
    },
    [key]
  );
  return [value, set];
}

/** A switch remembered in this browser: a side panel shown or hidden. */
export function useStoredFlag(key: string, initial: boolean): [boolean, (next: boolean) => void] {
  const [value, set] = useStoredChoice<"1" | "0">(key, initial ? "1" : "0", ["1", "0"]);
  const setFlag = useCallback((next: boolean) => set(next ? "1" : "0"), [set]);
  return [value === "1", setFlag];
}
