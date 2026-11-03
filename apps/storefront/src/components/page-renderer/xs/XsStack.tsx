"use client";

import * as React from "react";
import { StoreLink } from "@/components/StoreRoute";
import { XsPicture } from "@/components/xs/XsPicture";
import { useImmersiveAllowed } from "@/components/immersive/useImmersive";

export interface XsStackSlide {
  key: string;
  image: string;
  title: string;
  text: string;
  badge: string;
  href: string | null;
}

/** How far the cards fan out, by the band's width (the narrower, the tighter). */
function fanFor(width: number) {
  if (width < 640) return { distance: 120, velocity: 500, sensitivity: 180, x: 90, y: 20, rotate: 8, shrink: 0.06 };
  if (width < 1024) return { distance: 160, velocity: 650, sensitivity: 220, x: 130, y: 30, rotate: 10, shrink: 0.09 };
  return { distance: 200, velocity: 800, sensitivity: 250, x: 170, y: 40, rotate: 12, shrink: 0.12 };
}

/** Where card `index` sits against the front one, wrapped so the deck is a loop: 0 in front, ±1 beside it… */
function offsetOf(index: number, progress: number, total: number) {
  let diff = (index - progress) % total;
  if (diff > total / 2) diff -= total;
  if (diff < -total / 2) diff += total;
  return diff;
}

/** A value along points (x ascending), straight between them. */
function along(x: number, points: Array<[number, number]>) {
  if (x <= points[0]![0]) return points[0]![1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i]!;
    const [x0, y0] = points[i - 1]!;
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return points[points.length - 1]![1];
}

/**
 * `xs_stack` — pictures dealt like a hand of cards: the front one faces the
 * shopper with its badge, title and line; the others fan out on both sides,
 * tilting, dropping and dimming as they go. Dragged, it follows the finger
 * and settles on the nearest card with a spring; the arrows and the arrow
 * keys turn it one card at a time, and the front card links to its page.
 *
 * Adapted from a stacked-cards carousel, without its animation library: one
 * spring stepped per frame writes each card's transform straight to the DOM.
 * On reduced motion or a weak device (useImmersive) it is a plain row of the
 * same cards that scrolls.
 */
export function XsStack({ look, slides, prevLabel, nextLabel }: { look: string; slides: XsStackSlide[]; prevLabel: string; nextLabel: string }) {
  const allowed = useImmersiveAllowed();
  const total = slides.length;
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const cards = React.useRef<(HTMLElement | null)[]>([]);
  const shades = React.useRef<(HTMLElement | null)[]>([]);
  const words = React.useRef<(HTMLElement | null)[]>([]);
  const motion = React.useRef({ progress: 0, target: 0, velocity: 0, raf: 0, last: 0, width: 1200 });
  const drag = React.useRef({ id: -1, startX: 0, lastX: 0, lastT: 0, vx: 0, from: 0, moved: false });
  const [front, setFront] = React.useState(0);

  const paint = React.useCallback(() => {
    const m = motion.current;
    const fan = fanFor(m.width);
    for (let i = 0; i < total; i++) {
      const o = offsetOf(i, m.progress, total);
      const a = Math.abs(o);
      const card = cards.current[i];
      if (card) {
        const y = a < 0.05 ? 0 : a * fan.y;
        const r = a < 0.05 ? 0 : o * fan.rotate;
        card.style.transform = `translate3d(${(o * fan.x).toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${r.toFixed(2)}deg) scale(${(1 - a * fan.shrink).toFixed(3)})`;
        card.style.opacity = along(o, [[-total / 2, 0], [-total / 2 + 0.5, 1], [0, 1], [total / 2 - 0.5, 1], [total / 2, 0]]).toFixed(3);
        card.style.zIndex = String(Math.round(100 - a * 10));
      }
      const shade = shades.current[i];
      if (shade) shade.style.opacity = along(o, [[-2, 0.5], [-0.5, 0.2], [0, 0], [0.5, 0.2], [2, 0.5]]).toFixed(3);
      const word = words.current[i];
      if (word) word.style.opacity = along(o, [[-0.5, 0], [0, 1], [0.5, 0]]).toFixed(3);
    }
  }, [total]);

  // The frame step, read through a ref so it can ask for the next frame of itself.
  const stepRef = React.useRef((now: number) => {
    void now;
  });
  const step = React.useCallback((now: number) => {
    const m = motion.current;
    const dt = m.last ? Math.min(0.034, (now - m.last) / 1000) : 1 / 60;
    m.last = now;
    // The original's spring: stiffness 200, damping 30, mass 1.
    const accel = -200 * (m.progress - m.target) - 30 * m.velocity;
    m.velocity += accel * dt;
    m.progress += m.velocity * dt;
    paint();
    if (Math.abs(m.progress - m.target) < 0.001 && Math.abs(m.velocity) < 0.001) {
      m.progress = m.target;
      paint();
      m.raf = 0;
      m.last = 0;
      return;
    }
    m.raf = requestAnimationFrame(stepRef.current);
  }, [paint]);
  React.useLayoutEffect(() => {
    stepRef.current = step;
  }, [step]);

  const settle = React.useCallback((target: number) => {
    const m = motion.current;
    m.target = target;
    setFront(((Math.round(target) % total) + total) % total);
    if (!m.raf) m.raf = requestAnimationFrame(step);
  }, [step, total]);

  React.useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage || !allowed) return;
    const measure = () => {
      motion.current.width = stage.clientWidth;
      paint();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [allowed, paint]);

  React.useEffect(() => {
    const m = motion.current;
    return () => cancelAnimationFrame(m.raf);
  }, []);

  if (total === 0) return null;

  const card = (slide: XsStackSlide, i: number, inStack: boolean) => {
    const body = (
      <>
        <XsPicture src={slide.image} alt={slide.title} className="xs-stack__img" eager={i === 0} loading="eager" />
        <span className="xs-stack__shade" ref={inStack ? (node) => { shades.current[i] = node; } : undefined} aria-hidden="true" />
        <span className="xs-stack__fade" aria-hidden="true" />
        {slide.badge ? <span className="xs-stack__badge">{slide.badge}</span> : null}
        <span className="xs-stack__words" dir="auto" ref={inStack ? (node) => { words.current[i] = node; } : undefined}>
          {slide.title ? <span className="xs-stack__title">{slide.title}</span> : null}
          {slide.text ? <span className="xs-stack__text">{slide.text}</span> : null}
        </span>
      </>
    );
    const common = {
      className: "xs-stack__card",
      "data-front": inStack && i === front ? "" : undefined,
      "aria-hidden": inStack && i !== front ? true : undefined,
      tabIndex: inStack && i !== front ? -1 : undefined,
    };
    return slide.href ? (
      <StoreLink
        key={slide.key}
        href={slide.href}
        {...common}
        ref={inStack ? (node: HTMLAnchorElement | null) => { cards.current[i] = node; } : undefined}
        draggable={false}
        onClick={(event: React.MouseEvent) => {
          // A drag that ends on a card is not a click on it.
          if (drag.current.moved) event.preventDefault();
        }}
      >
        {body}
      </StoreLink>
    ) : (
      <div key={slide.key} {...common} ref={inStack ? (node) => { cards.current[i] = node; } : undefined}>
        {body}
      </div>
    );
  };

  if (!allowed) {
    return (
      <div className="xs-stack__row" data-xs-look={look}>
        {slides.map((slide, i) => card(slide, i, false))}
      </div>
    );
  }

  const turn = (delta: number) => settle(Math.round(motion.current.target) + delta);

  return (
    <div className="xs-stack__deck">
      <div
        ref={stageRef}
        className="xs-stack__stage"
        dir="ltr"
        role="group"
        aria-roledescription="carousel"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") turn(1);
          else if (event.key === "ArrowLeft") turn(-1);
          else return;
          event.preventDefault();
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          const m = motion.current;
          cancelAnimationFrame(m.raf);
          m.raf = 0;
          m.last = 0;
          m.velocity = 0;
          drag.current = { id: event.pointerId, startX: event.clientX, lastX: event.clientX, lastT: event.timeStamp, vx: 0, from: m.progress, moved: false };
        }}
        onPointerMove={(event) => {
          const d = drag.current;
          if (d.id !== event.pointerId) return;
          const dx = event.clientX - d.lastX;
          if (!d.moved && Math.abs(event.clientX - d.startX) > 6) {
            d.moved = true;
            event.currentTarget.setPointerCapture(event.pointerId);
          }
          if (!d.moved) return;
          const dt = Math.max(1, event.timeStamp - d.lastT);
          d.vx = d.vx * 0.6 + ((dx / dt) * 1000) * 0.4;
          d.lastX = event.clientX;
          d.lastT = event.timeStamp;
          const m = motion.current;
          m.progress -= dx / fanFor(m.width).sensitivity;
          m.target = m.progress;
          paint();
        }}
        onPointerUp={(event) => {
          const d = drag.current;
          if (d.id !== event.pointerId) return;
          d.id = -1;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          if (!d.moved) return;
          const fan = fanFor(motion.current.width);
          const shift = Math.max(-3, Math.min(3, Math.round(-(event.clientX - d.startX) / fan.distance - d.vx / fan.velocity)));
          settle(Math.round(d.from) + shift);
          // Let the click that follows this release see it was a drag, then forget it.
          window.setTimeout(() => {
            drag.current.moved = false;
          }, 0);
        }}
        onPointerCancel={() => {
          drag.current.id = -1;
          settle(Math.round(motion.current.progress));
        }}
      >
        {slides.map((slide, i) => card(slide, i, true))}
      </div>
      <div className="xs-stack__controls" dir="ltr">
        <button type="button" className="xs-stack__arrow" aria-label={prevLabel} onClick={() => turn(-1)}>
          <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <span className="xs-stack__count" aria-live="polite" dir="ltr">
          {String(front + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
        <button type="button" className="xs-stack__arrow" aria-label={nextLabel} onClick={() => turn(1)}>
          <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </div>
    </div>
  );
}
