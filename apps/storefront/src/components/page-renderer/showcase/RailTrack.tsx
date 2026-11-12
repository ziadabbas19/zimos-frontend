"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Pixels per second for each speed. "normal" is one tile every dozen seconds or so. */
const SPEED: Record<string, number> = { slow: 20, normal: 26, fast: 34 };

/**
 * The `product_rail` train: the products slide past on their own, without a
 * seam, and the shopper can still drag, swipe or wheel the strip.
 *
 * The server sends one run of tiles (`children`) and two decorative repeats
 * (`before`, `after`). The strip is parked on the middle run; whenever it
 * drifts half a run either way it is moved back by exactly one run, which
 * lands on an identical frame — so there is no end to reach.
 *
 * It only ever runs while it is on screen, the tab is visible and the shopper
 * is not touching it, and never for a shopper who asked for less motion (the
 * strip is then an ordinary scrollable row).
 */
export function RailTrack({
  children,
  before,
  after,
  autoplay,
  speed,
  label,
}: {
  children: ReactNode;
  before: ReactNode;
  after: ReactNode;
  autoplay: boolean;
  speed: string;
  label: string;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLDivElement>(null);
  const middleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rail = railRef.current;
    const first = firstRef.current;
    const middle = middleRef.current;
    if (!rail || !first || !middle) return;

    const pxPerSecond = SPEED[speed] ?? SPEED.normal;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let segment = 0;
    let paused = false;
    let inView = false;
    let raf = 0;
    let last = 0;
    let resumeTimer = 0;
    // Fractions of a pixel a frame moves by: scrollLeft only keeps whole ones.
    let carry = 0;

    const measure = (keepPhase: boolean) => {
      const next = middle.offsetLeft - first.offsetLeft;
      if (!next) return;
      const phase = keepPhase && segment ? (((rail.scrollLeft % segment) + segment) % segment) / segment : 0.18;
      segment = next;
      rail.scrollLeft = segment + segment * phase;
    };
    // Whether the three copies scroll far enough to jump a whole copy either way. A rail of a few cards
    // on a wide screen does not: the browser clamps scrollLeft, and a jump would never land.
    const wraps = () => segment > 0 && rail.scrollWidth - rail.clientWidth >= segment * 1.5;
    const normalize = () => {
      if (!wraps()) return;
      // Bounded: each step moves a whole copy, so two are always enough once the rail wraps.
      for (let i = 0; i < 4 && rail.scrollLeft < segment * 0.5; i++) rail.scrollLeft += segment;
      for (let i = 0; i < 4 && rail.scrollLeft >= segment * 1.5; i++) rail.scrollLeft -= segment;
    };
    const canRun = () => autoplay && inView && !paused && !reduced && !document.hidden && wraps();
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    };
    const tick = (time: number) => {
      raf = 0;
      if (!canRun()) return;
      if (!last) last = time;
      const delta = Math.min(40, time - last);
      last = time;
      carry += pxPerSecond * (delta / 1000);
      const whole = Math.floor(carry);
      if (whole > 0) {
        carry -= whole;
        rail.scrollLeft -= whole;
        normalize();
      }
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (!canRun() || raf) return;
      last = 0;
      raf = requestAnimationFrame(tick);
    };
    const pause = () => {
      paused = true;
      stop();
    };
    const resume = () => {
      paused = false;
      start();
    };
    const pauseFor = (ms: number) => {
      pause();
      window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(resume, ms);
    };

    measure(false);
    normalize();

    const onScroll = () => {
      if (paused) normalize();
    };
    const onWheel = () => pauseFor(1000);
    const onResize = () => {
      pauseFor(220);
      requestAnimationFrame(() => measure(true));
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    rail.addEventListener("pointerdown", pause, { passive: true });
    window.addEventListener("pointerup", resume, { passive: true });
    window.addEventListener("pointercancel", resume, { passive: true });
    rail.addEventListener("touchstart", pause, { passive: true });
    rail.addEventListener("touchend", resume, { passive: true });
    rail.addEventListener("wheel", onWheel, { passive: true });
    rail.addEventListener("focusin", pause);
    rail.addEventListener("focusout", resume);
    rail.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    const observer = new IntersectionObserver(
      (entries) => {
        inView = !!entries[0]?.isIntersecting;
        if (inView) {
          if (!segment) measure(false);
          start();
        } else {
          stop();
        }
      },
      { threshold: 0.01 }
    );
    observer.observe(rail);

    return () => {
      stop();
      window.clearTimeout(resumeTimer);
      observer.disconnect();
      rail.removeEventListener("pointerdown", pause);
      window.removeEventListener("pointerup", resume);
      window.removeEventListener("pointercancel", resume);
      rail.removeEventListener("touchstart", pause);
      rail.removeEventListener("touchend", resume);
      rail.removeEventListener("wheel", onWheel);
      rail.removeEventListener("focusin", pause);
      rail.removeEventListener("focusout", resume);
      rail.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [autoplay, speed]);

  return (
    <div ref={railRef} className="zs-rail__track zs-scroll" tabIndex={0} aria-label={label}>
      <div ref={firstRef} className="zs-rail__copy" aria-hidden>
        {before}
      </div>
      <div ref={middleRef} className="zs-rail__copy">
        {children}
      </div>
      <div className="zs-rail__copy" aria-hidden>
        {after}
      </div>
    </div>
  );
}
