"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Eases a funnel step onto the page: a short fade and a small rise, run once
 * when the step mounts. The page keys this on the step, so each advance (which
 * refreshes the route in place) plays it for the new step and never for a
 * re-render of the same one.
 *
 * Web Animations rather than a stylesheet keyframe, so the first server paint
 * is the finished state — a shopper whose JavaScript is still loading sees the
 * page, not a blank waiting for an animation — and reduced motion is a plain
 * "do nothing".
 */
export function StepTransition({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== "function") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const animation = el.animate(
      [
        { opacity: 0, transform: "translateY(12px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 260, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)", fill: "backwards" }
    );
    return () => animation.cancel();
  }, []);

  return <div ref={ref}>{children}</div>;
}
