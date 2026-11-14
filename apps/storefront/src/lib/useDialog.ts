"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * What every modal layer in the store needs and nothing more: while it is
 * open, Tab wraps inside it, Escape closes it, the page behind stops
 * scrolling, and when it closes focus goes back to whatever opened it.
 *
 * Shared by the cart drawer and the mobile menu sheet. The product gallery's
 * lightbox carries its own copy of the same trap (it also has to catch the
 * arrow keys), which is left as it is.
 */

/** Everything inside the layer a Tab can reach. */
function focusablesIn(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      "a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])"
    )
  ).filter((el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true");
}

export function useDialog<T extends HTMLElement>({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): RefObject<T | null> {
  const ref = useRef<T>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const dialog = ref.current;
    if (!dialog) return;
    // Captured now: by cleanup time focus may already sit inside the layer,
    // and the control that opened it is the one focus must return to.
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Let the open transition start before moving focus, so the browser does
    // not scroll a still-offscreen element into view.
    const focusTimer = window.setTimeout(() => {
      const first = focusablesIn(dialog).find((el) => el.dataset.autofocus !== undefined) ?? focusablesIn(dialog)[0];
      (first ?? dialog).focus({ preventScroll: true });
    }, 30);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !dialog) return;
      const items = focusablesIn(dialog);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !dialog.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !dialog.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      opener?.focus({ preventScroll: true });
    };
  }, [open]);

  return ref;
}

/**
 * Keeps a sliding layer in the DOM only while it is open or still sliding
 * out. A closed sheet parked off the inline-start edge with a transform is
 * not gone: in an RTL page it extends the document sideways and hands the
 * shopper a horizontal scrollbar. So while closed the layer is `hidden`
 * (`present` false); on open it is shown a frame later than it is mounted,
 * which gives the slide-in its starting position.
 *
 *   present — render the layer (mounted / display) at all
 *   shown   — the open position (drives the transform)
 *
 * A `duration` of 0 (a store whose cart moves at no speed) draws it open and
 * takes it away in the same render: no starting position, nothing to wait for.
 */
export function useSheetPresence(open: boolean, duration = 320): { present: boolean; shown: boolean } {
  const [shown, setShown] = useState(false);
  const [closing, setClosing] = useState(false);
  const wasOpen = useRef(false);

  // Timers rather than requestAnimationFrame: a background tab stops
  // animation frames entirely, and a sheet whose "shown" never lands would
  // stay parked off-screen (or, worse, slide in after it was closed).
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      // One tick after mount, so the slide-in has its starting position painted.
      const timer = window.setTimeout(() => {
        setClosing(false);
        setShown(true);
      }, 20);
      return () => window.clearTimeout(timer);
    }
    // Only a sheet that was open has anything to slide out.
    if (!wasOpen.current) return;
    wasOpen.current = false;
    const slide = window.setTimeout(() => {
      setShown(false);
      setClosing(true);
    }, 0);
    const gone = window.setTimeout(() => setClosing(false), duration);
    return () => {
      window.clearTimeout(slide);
      window.clearTimeout(gone);
    };
  }, [open, duration]);

  if (duration <= 0) return { present: open, shown: open };
  return { present: open || shown || closing, shown };
}

/** True when the visitor asked the OS for less movement. Safe on the server. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
