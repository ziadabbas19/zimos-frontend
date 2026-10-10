import { createContext, useContext, useEffect, useState, type RefObject } from "react";

/**
 * What the inspector tells the fields inside it, however deep they sit (a
 * picture inside a slide inside a list): how much room there is, and how to
 * ask the editor for a picture from the media library.
 *
 * Outside the inspector nothing provides it, so a field used elsewhere (the
 * catalogue's ImageField, the store-look panel) reads the defaults: a wide
 * layout and no library button.
 */

/** Asks the shell for a picture; it calls `apply` with the chosen URL. */
export type RequestImage = (apply: (url: string) => void) => void;

/** The two languages a store's content is written in. */
export type ContentLanguage = "ar" | "en";

export interface InspectorEnv {
  /** One input with a language switch instead of two side by side: a panel under 20rem, or the phone sheet. */
  compact: boolean;
  /** Room for two picture wells side by side (a panel of 26rem or more). */
  pairImages: boolean;
  requestImage: RequestImage | null;
  /**
   * The language the one-input fields show, shared across the panel so the
   * switch on one field turns them all. Absent outside the inspector, where
   * each field keeps its own.
   */
  contentLanguage?: ContentLanguage;
  setContentLanguage?: (language: ContentLanguage) => void;
}

const DEFAULT_ENV: InspectorEnv = { compact: false, pairImages: false, requestImage: null };

const InspectorEnvContext = createContext<InspectorEnv>(DEFAULT_ENV);

export const InspectorEnvProvider = InspectorEnvContext.Provider;

export function useInspectorEnv(): InspectorEnv {
  return useContext(InspectorEnvContext);
}

/** The width of an element's content box, or null until it has been measured. */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number | null {
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (typeof next !== "number") return;
      // Sub-pixel changes (a scrollbar fading in) never re-render the whole panel.
      setWidth((prev) => (prev !== null && Math.abs(prev - next) < 1 ? prev : next));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/** Whether a media query matches now; false where the browser cannot say. */
export function useMediaQuery(query: string): boolean {
  const read = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches;
  const [matches, setMatches] = useState<boolean>(read);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/** Under this the editor shows the inspector as a bottom sheet (Tailwind's `lg`). */
export const SHEET_QUERY = "(max-width: 63.99rem)";
/** A little under 20rem, so a 20rem panel with a hairline border still counts as wide. */
export const COMPACT_BELOW_PX = 304;
/** Two picture wells side by side need this much. */
export const PAIR_IMAGES_FROM_PX = 416;
