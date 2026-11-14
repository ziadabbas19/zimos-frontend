"use client";

import { useEffect, useState } from "react";
import { parseCssColor, readableAccent } from "./appearance";

/**
 * The store's accent the rewards bar fills with, kept readable: measured from
 * the page as it is drawn (its theme, template and light or dark mode), and
 * swapped for the nearest shade that reaches 3:1 against the track and the
 * card behind it when the accent itself does not. null while it needs no
 * change (or cannot be read): the bar keeps the accent's own class then.
 *
 * Measured once the bar is on screen and again whenever the colour mode or the
 * theme around it changes (a class, data-color-mode or style on the page or
 * any parent of the bar, or the system's light/dark setting).
 */
export function useReadableAccent(root: HTMLElement | null, enabled: boolean): string | null {
  const [fill, setFill] = useState<string | null>(null);

  useEffect(() => {
    // Off (a custom fill colour), nothing to measure: the hook answers null whatever it last held.
    if (!enabled || !root || typeof window === "undefined" || typeof window.getComputedStyle !== "function") return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const color = (selector: string) => {
        const el = root.querySelector(selector);
        return el ? parseCssColor(window.getComputedStyle(el).backgroundColor) : null;
      };
      const accent = color("[data-probe='accent']");
      const track = color("[data-probe='track']");
      const card = parseCssColor(window.getComputedStyle(root).backgroundColor);
      if (!accent || !track) {
        setFill(null);
        return;
      }
      const readable = readableAccent(accent, card ? [track, card] : [track]);
      setFill(readable === accent ? null : readable);
    };
    const schedule = () => {
      if (frame) return;
      frame = typeof window.requestAnimationFrame === "function" ? window.requestAnimationFrame(measure) : window.setTimeout(measure, 0);
    };
    schedule();

    const observer = typeof MutationObserver === "function" ? new MutationObserver(schedule) : null;
    for (let el: Element | null = root.parentElement; el; el = el.parentElement) {
      observer?.observe(el, { attributes: true, attributeFilter: ["class", "style", "data-color-mode", "data-theme"] });
    }
    const scheme = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    scheme?.addEventListener?.("change", schedule);
    return () => {
      observer?.disconnect();
      scheme?.removeEventListener?.("change", schedule);
      if (frame) {
        if (typeof window.cancelAnimationFrame === "function") window.cancelAnimationFrame(frame);
        window.clearTimeout(frame);
      }
    };
  }, [root, enabled]);

  return enabled ? fill : null;
}
