"use client";

import { useEffect } from "react";

/** The parts of the page whose animations never end: held still while out of view (`.is-off`, home.css). */
const LOOPS = ".zm-hero, .zm-works, .zm-sec, .zm-night, .zm-end";

/** How far a magnetic button may follow the pointer, in px: under half the 12px gap between two buttons. */
const PULL_X = 4;
const PULL_Y = 3;

const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));

type Idle = { cancel: () => void };

function whenIdle(run: () => void): Idle {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(run, { timeout: 1500 });
    return { cancel: () => window.cancelIdleCallback(id) };
  }
  const id = window.setTimeout(run, 400);
  return { cancel: () => window.clearTimeout(id) };
}

/**
 * The home page's motion, in one place and started late: once the page is
 * idle after hydration (or 1.5s at most), never before.
 *
 * - One IntersectionObserver: reveals each `.rv` the first time it enters
 *   the screen (only without reduced motion; elements already on screen or
 *   above it are shown at once, so nothing jumps), holds the endless
 *   animations of a section that is out of view (`.is-off`), and keeps the
 *   list of magnetic buttons on screen.
 * - One passive scroll listener, drawn in one animation frame: the reading
 *   bar, the header's link to the section being read, and the closing
 *   band's slow photograph.
 * - With a mouse (hover and a fine pointer) and without reduced motion: the
 *   light that follows the pointer on a card (`.zm-spot`), the buttons that
 *   lean towards it (`[data-mag]`, held within a few px so two buttons never
 *   meet), the hero's depth and the dashboard frame's tilt (`[data-tilt]`).
 *
 * Without script nothing of this runs and the page is simply all there.
 */
export function HomeEffects() {
  useEffect(() => {
    let stop = () => {};
    const idle = whenIdle(() => {
      stop = start();
    });
    return () => {
      idle.cancel();
      stop();
    };
  }, []);

  return null;
}

function start(): () => void {
  const html = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches && !reduce;
  const cleanups: (() => void)[] = [];

  // ── The one observer ──
  const magnets = new Set<HTMLElement>();
  const loops = new Set(document.querySelectorAll<HTMLElement>(LOOPS));
  const hero = document.querySelector<HTMLElement>(".zm-hero");
  let heroOn = true;

  const io =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              const el = entry.target as HTMLElement;
              if (loops.has(el)) {
                el.classList.toggle("is-off", !entry.isIntersecting);
                if (el === hero) heroOn = entry.isIntersecting;
              }
              if (el.hasAttribute("data-mag")) {
                if (entry.isIntersecting) magnets.add(el);
                else {
                  magnets.delete(el);
                  el.style.translate = "";
                }
              }
              if (el.classList.contains("rv") && entry.isIntersecting) {
                el.classList.add("is-in");
                if (!loops.has(el) && !el.hasAttribute("data-mag")) io?.unobserve(el);
              }
            }
          },
          { rootMargin: "0px 0px -6% 0px" },
        )
      : null;

  if (io) {
    loops.forEach((el) => io.observe(el));
    if (!reduce) {
      // What is already on screen, or was scrolled past, is simply there.
      const fold = window.innerHeight;
      document.querySelectorAll<HTMLElement>(".rv").forEach((el) => {
        if (el.getBoundingClientRect().top < fold) el.classList.add("is-in");
        else io.observe(el);
      });
      html.classList.add("zm-fx");
    }
    if (pointer) document.querySelectorAll<HTMLElement>("[data-mag]").forEach((el) => io.observe(el));
    cleanups.push(() => {
      io.disconnect();
      loops.forEach((el) => el.classList.remove("is-off"));
      html.classList.remove("zm-fx");
    });
  }

  // ── The one scroll loop ──
  const bar = document.querySelector<HTMLElement>(".zm-prog");
  const band = reduce ? null : document.querySelector<HTMLElement>(".zm-end");
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(".zm-nav a[data-nav]"));
  const targets = links.map((a) => document.getElementById(a.dataset.nav ?? ""));
  let frame = 0;
  let lit: HTMLAnchorElement | null = null;

  const draw = () => {
    frame = 0;
    const view = window.innerHeight;
    const height = document.documentElement.scrollHeight - view;
    if (bar) bar.style.transform = `scaleX(${height > 0 ? Math.min(1, window.scrollY / height) : 0})`;

    // The section that crosses the line under 45% of the screen.
    let next: HTMLAnchorElement | null = null;
    const line = view * 0.45;
    targets.forEach((section, i) => {
      if (!section) return;
      const box = section.getBoundingClientRect();
      if (box.top <= line && box.bottom > line) next = links[i];
    });
    if (next !== lit) {
      lit?.classList.remove("on");
      (next as HTMLAnchorElement | null)?.classList.add("on");
      lit = next;
    }

    if (band) {
      const box = band.getBoundingClientRect();
      if (box.bottom > 0 && box.top < view) band.style.setProperty("--py", `${Math.round((box.top - view / 2) * -0.08)}px`);
    }
  };
  const onScroll = () => {
    if (!frame) frame = window.requestAnimationFrame(draw);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  draw();
  cleanups.push(() => {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
    window.cancelAnimationFrame(frame);
    lit?.classList.remove("on");
  });

  // ── The pointer ──
  if (pointer) {
    let move: PointerEvent | null = null;
    let pFrame = 0;
    let tilted: HTMLElement | null = null;

    const follow = () => {
      pFrame = 0;
      const e = move;
      if (!e) return;
      const target = e.target instanceof Element ? e.target : null;

      const spot = target?.closest<HTMLElement>(".zm-spot");
      if (spot) {
        const box = spot.getBoundingClientRect();
        spot.style.setProperty("--sx", `${Math.round(e.clientX - box.left)}px`);
        spot.style.setProperty("--sy", `${Math.round(e.clientY - box.top)}px`);
      }

      magnets.forEach((el) => {
        const box = el.getBoundingClientRect();
        const dx = e.clientX - (box.left + box.width / 2);
        const dy = e.clientY - (box.top + box.height / 2);
        const near = Math.hypot(dx, dy) < Math.max(box.width * 0.75, 90);
        el.style.translate = near ? `${clamp(dx * 0.18, PULL_X).toFixed(1)}px ${clamp(dy * 0.28, PULL_Y).toFixed(1)}px` : "";
      });

      if (hero && heroOn) {
        const box = hero.getBoundingClientRect();
        if (e.clientY >= box.top && e.clientY <= box.bottom) {
          hero.style.setProperty("--mx", (((e.clientX - box.left) / box.width - 0.5) * 2).toFixed(3));
          hero.style.setProperty("--my", (((e.clientY - box.top) / box.height - 0.5) * 2).toFixed(3));
        }
      }

      const tilt = target?.closest<HTMLElement>("[data-tilt]") ?? null;
      if (tilted && tilted !== tilt) {
        tilted.style.setProperty("--rx", "0");
        tilted.style.setProperty("--ry", "0");
      }
      tilted = tilt;
      if (tilt) {
        const box = tilt.getBoundingClientRect();
        tilt.style.setProperty("--rx", (((e.clientX - box.left) / box.width - 0.5) * 5).toFixed(2));
        tilt.style.setProperty("--ry", (((e.clientY - box.top) / box.height - 0.5) * 5).toFixed(2));
      }
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      move = e;
      if (!pFrame) pFrame = window.requestAnimationFrame(follow);
    };
    const onLeave = () => {
      magnets.forEach((el) => (el.style.translate = ""));
      if (tilted) {
        tilted.style.setProperty("--rx", "0");
        tilted.style.setProperty("--ry", "0");
        tilted = null;
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    cleanups.push(() => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.cancelAnimationFrame(pFrame);
      onLeave();
    });
  }

  return () => cleanups.forEach((fn) => fn());
}
