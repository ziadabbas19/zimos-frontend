"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { StoreLink } from "@/components/StoreRoute";
import { swipeStep } from "@/lib/swipe";
import type { HeroSide, HeroVertical } from "./heroLook";
import { HeroVideo } from "./HeroVideo";

export interface HeroSlide {
  key: string;
  image: string;
  mobileImage: string | null;
  alt: string;
  eyebrow: string;
  heading: string;
  subheading: string;
  buttonLabel: string;
  buttonHref: string | null;
  side: HeroSide;
  vertical: HeroVertical;
  /** The text's place on a phone, only where it differs from `side` / `vertical` (heroLook.ts). */
  phoneSide?: HeroSide;
  phoneVertical?: HeroVertical;
  /** The veil between the picture and the text, as an opacity for each device; null or absent draws none. */
  overlay?: { desktop: number; phone: number } | null;
  /** A background video over the picture, which stays as its poster (HeroVideo.tsx); null or absent draws none. */
  video?: string | null;
  contentWidth: number;
  text: "dark" | "light";
}

/**
 * `hero_slider` — full-width pictures that cross-fade, each with an optional
 * line of text and one button laid over it.
 *
 * Every slide is in the markup from the server, so the first one paints
 * without any JavaScript and a crawler reads them all; this component only
 * moves `is-active` between them. Autoplay waits `startDelay` seconds before
 * its first step (the opening picture is the page's largest paint — nothing
 * should swap it out while the page is still arriving), pauses while the
 * shopper hovers, focuses or the tab is hidden, and never starts for a
 * shopper who asked for less motion.
 */
export function HeroSlider({
  slides,
  autoplay,
  seconds,
  startDelay,
  arrows,
  dots,
  wave,
  rtl,
  label,
  labels,
  style,
}: {
  slides: HeroSlide[];
  autoplay: boolean;
  seconds: number;
  startDelay: number;
  arrows: boolean;
  dots: boolean;
  wave: boolean;
  rtl: boolean;
  label: string;
  /** `slide` is the word before a slide number: "Slide" → "Slide 2". */
  labels: { previous: string; next: string; slide: string };
  style?: CSSProperties;
}) {
  const [active, setActive] = useState(0);
  const pausedRef = useRef(false);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const count = slides.length;
  const many = count > 1;

  const go = useCallback((delta: number) => setActive((i) => (i + delta + count) % count), [count]);

  useEffect(() => {
    if (!autoplay || !many) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let interval = 0;
    const tick = () => {
      if (!pausedRef.current && !document.hidden) setActive((i) => (i + 1) % count);
    };
    const start = window.setTimeout(() => {
      tick();
      interval = window.setInterval(tick, seconds * 1000);
    }, Math.max(startDelay, seconds) * 1000);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(interval);
    };
  }, [autoplay, many, count, seconds, startDelay]);

  function onPointerDown(e: ReactPointerEvent) {
    if (many) swipe.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerUp(e: ReactPointerEvent) {
    const from = swipe.current;
    swipe.current = null;
    if (!from) return;
    const delta = swipeStep(from, { x: e.clientX, y: e.clientY }, rtl ? -1 : 1);
    if (delta !== null) go(delta);
  }

  return (
    <section
      className="zs zs-hero"
      data-wave={wave ? "" : undefined}
      style={style}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => (pausedRef.current = false)}
      onFocus={() => (pausedRef.current = true)}
      onBlur={() => (pausedRef.current = false)}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (swipe.current = null)}
    >
      {slides.map((slide, i) => {
        const on = i === active;
        const hasText = slide.eyebrow || slide.heading || slide.subheading;
        return (
          <div
            key={slide.key}
            className={`zs-hero__slide${on ? " is-active" : ""}`}
            data-h={slide.side}
            data-v={slide.vertical}
            data-hm={slide.phoneSide}
            data-vm={slide.phoneVertical}
            data-text={slide.text}
            aria-hidden={on ? undefined : true}
            inert={on ? undefined : true}
          >
            <div className="zs-hero__media">
              <picture>
                {slide.mobileImage ? <source media="(max-width: 749px)" srcSet={slide.mobileImage} /> : null}
                {/* Merchant media are arbitrary remote URLs (no next/image allowlist). */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={slide.image}
                  alt={slide.alt}
                  width={2400}
                  height={926}
                  loading={i === 0 ? "eager" : "lazy"}
                  fetchPriority={i === 0 ? "high" : "auto"}
                  decoding="async"
                  draggable={false}
                />
              </picture>
              {slide.video ? <HeroVideo src={slide.video} active={on} /> : null}
              {slide.overlay ? (
                <span
                  className="zs-hero__overlay"
                  aria-hidden
                  style={{ "--zs-ov": String(slide.overlay.desktop), "--zs-ov-m": String(slide.overlay.phone) } as CSSProperties}
                />
              ) : null}
            </div>
            {hasText || (slide.buttonLabel && slide.buttonHref) ? (
              <div className="zs-hero__shell">
                <div className="zs-hero__content" style={{ "--zs-cw": `${slide.contentWidth}px` } as CSSProperties}>
                  {slide.eyebrow ? <p className="zs-hero__eyebrow">{slide.eyebrow}</p> : null}
                  {slide.heading ? <h2 className="zs-hero__heading">{slide.heading}</h2> : null}
                  {slide.subheading ? <p className="zs-hero__sub">{slide.subheading}</p> : null}
                  {slide.buttonLabel && slide.buttonHref ? (
                    <StoreLink className="zs-hero__btn" href={slide.buttonHref}>
                      {slide.buttonLabel}
                    </StoreLink>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}

      {many && arrows ? (
        <>
          <button type="button" className="zs-hero__nav zs-hero__nav--prev" aria-label={labels.previous} onClick={() => go(-1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button type="button" className="zs-hero__nav zs-hero__nav--next" aria-label={labels.next} onClick={() => go(1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </>
      ) : null}

      {many && dots ? (
        <div className="zs-hero__dots" role="tablist">
          {slides.map((slide, i) => (
            <button
              key={slide.key}
              type="button"
              role="tab"
              className={`zs-hero__dot${i === active ? " is-active" : ""}`}
              aria-label={`${labels.slide} ${i + 1}`}
              aria-selected={i === active}
              onClick={() => setActive(i)}
            />
          ))}
        </div>
      ) : null}

      {wave ? (
        <div className="zs-hero__wave" aria-hidden>
          <svg viewBox="0 0 1440 120" preserveAspectRatio="none" focusable="false">
            <path d="M0,70 C210,120 400,25 640,72 C875,118 1090,28 1440,72 L1440,120 L0,120 Z" />
          </svg>
        </div>
      ) : null}
    </section>
  );
}
