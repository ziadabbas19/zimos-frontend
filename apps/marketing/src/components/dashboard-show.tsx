"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary, ShotTab } from "@/i18n/dictionary";

/**
 * Real screens of the dashboard (public/product, one set per language) in a
 * device frame, behind tabs. The frame starts tilted back 20° and straightens
 * as the section scrolls into view, while the heading drifts up — no library,
 * one transform per animation frame, off when motion is reduced.
 */
export function DashboardShow({ copy, locale }: { copy: Dictionary["dashboard"]; locale: Locale }) {
  const [shot, setShot] = useState<ShotTab["id"]>(copy.tabs[0].id);
  const section = useRef<HTMLElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let ticking = false;
    const paint = () => {
      ticking = false;
      const box = section.current?.getBoundingClientRect();
      if (!box || !card.current) return;
      const vh = window.innerHeight || 800;
      const p = Math.min(1, Math.max(0, (vh - box.top) / (vh * 0.85)));
      const scale = window.innerWidth <= 768 ? 0.86 + 0.14 * p : 1.05 - 0.05 * p;
      card.current.style.transform = `rotateX(${(20 * (1 - p)).toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      if (head.current) head.current.style.transform = `translateY(${(-36 * p).toFixed(1)}px)`;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(paint);
    };
    paint();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Arrow keys move between tabs (the tab list is one stop for Tab).
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const dirStep = document.documentElement.dir === "rtl" ? -step : step;
    const at = copy.tabs.findIndex((tab) => tab.id === shot);
    const next = (at + dirStep + copy.tabs.length) % copy.tabs.length;
    setShot(copy.tabs[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <section ref={section} className="lz-show" id="panel" aria-labelledby="lz-show">
      <div ref={head} className="lz-show__head">
        <span className="lz-eye">{copy.kicker}</span>
        <h2 className="lz-h" id="lz-show">
          {copy.heading}
        </h2>
        <p className="lz-lede">{copy.intro}</p>
        <div className="lz-tabs" role="tablist" aria-label={copy.heading} onKeyDown={onKeyDown}>
          {copy.tabs.map((tab, i) => (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={tab.id === shot}
              aria-controls={`${baseId}-panel`}
              tabIndex={tab.id === shot ? 0 : -1}
              onClick={() => setShot(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="lz-show__stage">
        <figure ref={card} className="lz-show__card">
          <div
            className="lz-show__screen"
            role="tabpanel"
            id={`${baseId}-panel`}
            aria-labelledby={`${baseId}-tab-${shot}`}
          >
            {copy.tabs.map((tab) => (
              // A plain img: the captures are already sized and compressed for the page,
              // 1440 wide, and the 2880 one only for a screen that draws them that sharp.
              // `sizes` follows the card's widths in landing.css (.lz-show__card).
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={tab.id}
                src={`/product/${tab.id}-${locale}-1440.webp`}
                srcSet={`/product/${tab.id}-${locale}-1440.webp 1440w, /product/${tab.id}-${locale}.webp 2880w`}
                sizes="(min-width: 2200px) 1440px, (min-width: 1680px) 1248px, (min-width: 1120px) 1120px, 100vw"
                width={1440}
                height={900}
                alt={tab.alt}
                loading="lazy"
                decoding="async"
                hidden={tab.id !== shot}
              />
            ))}
          </div>
        </figure>
        <p className="lz-show__cap">{copy.caption}</p>
      </div>
    </section>
  );
}
