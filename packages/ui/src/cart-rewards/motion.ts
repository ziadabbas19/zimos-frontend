"use client";

import { useEffect, useRef, useState } from "react";

/** The cart's own easing: quick to move, soft to land. */
export const CART_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

/** True when the visitor asked the OS for less movement. Safe on the server. */
export function reducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A number that glides to each new value (ease-out, `duration` ms) instead of
 * jumping — for money that changes as the cart does. Interruptible: a new
 * value starts from wherever the last glide had got to. Whole minor units
 * only, so a formatted amount never shows a fraction of a piastre. Under
 * reduced motion (or with no animation frames) it is the value at once.
 */
export function useTweenedNumber(target: number, duration = 350): number {
  const [value, setValue] = useState(target);
  const current = useRef(target);

  useEffect(() => {
    const from = current.current;
    if (from === target) return;
    if (reducedMotion() || typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
      current.current = target;
      setValue(target);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = t >= 1 ? target : Math.round(from + (target - from) * eased);
      current.current = next;
      setValue(next);
      if (t < 1) frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}

/** A short "pop" on an element (transform only), skipped under reduced motion. */
export function pop(el: Element | null, duration = 180) {
  if (!el || reducedMotion() || typeof (el as HTMLElement).animate !== "function") return;
  (el as HTMLElement).animate([{ transform: "scale(1)" }, { transform: "scale(1.28)" }, { transform: "scale(1)" }], { duration, easing: CART_EASE });
}
