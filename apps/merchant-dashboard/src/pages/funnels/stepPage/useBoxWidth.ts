import { useCallback, useRef, useState } from "react";

/**
 * How wide the box the editor was given is — not how wide the screen is. The
 * step's page editor fills whatever it is put in: the whole window under the
 * funnel's bar, or a pane of a split-test dialog; a media query would lay the
 * second one out as if it had the first one's room.
 *
 * Returns a ref callback for the box and its width in CSS pixels (null until
 * it has been measured once; the caller picks what to draw meanwhile).
 */
export function useBoxWidth(): [(node: HTMLElement | null) => void, number | null] {
  const [width, setWidth] = useState<number | null>(null);
  const observer = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: HTMLElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!node) return;
    setWidth(Math.round(node.getBoundingClientRect().width));
    if (typeof ResizeObserver !== "function") return;
    const next = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (entry) setWidth(Math.round(entry.contentRect.width));
    });
    next.observe(node);
    observer.current = next;
  }, []);

  return [ref, width];
}

/** From here the three zones sit side by side (the store editor's `lg`). */
export const WIDE_BOX = 1024;
/** From here the bar has room for the device switch (the store editor's `md`). */
export const ROOMY_BOX = 768;
