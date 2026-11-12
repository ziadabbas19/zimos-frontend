/**
 * "Take me to this font": the canvas's "Aa" (on the selected element's tag,
 * or on the section's bar) asks the inspector to bring that part's font
 * field into view and put the keyboard on it. The editor opens the right
 * panel and tab first; the field — mounted already, or mounting in a moment —
 * picks the request up (components/fonts/FontPairField `focusTarget`).
 *
 * One request waits at a time, so a field that mounts later still finds it;
 * the field that matches takes it, and nothing else does.
 */

const EVENT = "zimos:font-focus";
let pending: string | null = null;

/** The target names: one per part with a font field. */
export const fontTarget = {
  element: (id: string) => `element:${id}`,
  section: (id: string) => `section:${id}`,
  page: "page",
  header: "header",
  footer: "footer",
} as const;

export function requestFontFocus(target: string): void {
  pending = target;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT, { detail: target }));
}

/** True — once — when a request for `target` is waiting. */
export function takeFontFocus(target: string): boolean {
  if (pending !== target) return false;
  pending = null;
  return true;
}

export function onFontFocus(listener: (target: string) => void): () => void {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (typeof detail === "string") listener(detail);
  };
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
