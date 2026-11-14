"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import { Arrow } from "./duo-icons";
import { SectionLabel } from "./section-label";

const two = (n: number) => String(n).padStart(2, "0");

/**
 * Real screens of the dashboard (public/product, one set per language) on
 * the night-blue panel, one at a time in a browser frame: the screens' names
 * are tabs, and a counter with two arrows moves through them too. Under the
 * frame, the open screen's number, name and line.
 */
export function DashboardShow({ copy, locale }: { copy: Dictionary["dashboard"]; locale: Locale }) {
  const [at, setAt] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();
  const { tabs } = copy;
  const count = tabs.length;
  const open = tabs[at];

  const go = (to: number) => setAt((to + count) % count);

  // Arrow keys move between tabs (the tab list is one stop for Tab).
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const dirStep = document.documentElement.dir === "rtl" ? -step : step;
    const next = (at + dirStep + count) % count;
    setAt(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <section className="zx-sec zx-sec--night" id="panel" aria-labelledby="zx-show" data-section="dashboard">
      <div className="zx-night zx-night--plain">
        <div className="lz-in">
          <header className="zx-head zx-head--split lz-r">
            <div>
              <SectionLabel n="06" text={copy.kicker} />
              <h2 className="zx-h2" id="zx-show">
                {copy.heading}
              </h2>
              <p className="zx-lede">{copy.intro}</p>
            </div>
            <div className="zx-pager">
              <span className="zx-pager__n ltr" aria-hidden>
                <b>{two(at + 1)}</b> / {two(count)}
              </span>
              <button type="button" className="zx-round" aria-label={copy.previous} onClick={() => go(at - 1)}>
                <Arrow size={18} className="zx-arr zx-arr--prev" />
              </button>
              <button type="button" className="zx-round zx-round--solid" aria-label={copy.next} onClick={() => go(at + 1)}>
                <Arrow size={18} className="zx-arr zx-arr--next" />
              </button>
            </div>
          </header>

          <div className="zx-kinds zx-kinds--night lz-r" role="tablist" aria-label={copy.heading} onKeyDown={onKeyDown}>
            {tabs.map((tab, i) => (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                className="zx-kind"
                id={`${baseId}-tab-${tab.id}`}
                aria-selected={i === at}
                aria-controls={`${baseId}-panel`}
                tabIndex={i === at ? 0 : -1}
                onClick={() => setAt(i)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <figure className="zx-screen lz-r">
            <div className="zx-browser zx-browser--night">
              <div className="zx-browser__bar" aria-hidden>
                <i />
                <i />
                <i />
                <span className="ltr">app.zimos.co</span>
              </div>
              <div className="zx-screen__shot" role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${open.id}`}>
                {tabs.map((tab, i) => (
                  // A plain img: the captures are already sized and compressed for the page,
                  // 1440 wide, and the 2880 one only for a screen that draws them that sharp.
                  // `sizes` follows the frame's widths in home.css (.zx-screen).
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={tab.id}
                    src={`/product/${tab.id}-${locale}-1440.webp`}
                    srcSet={`/product/${tab.id}-${locale}-1440.webp 1440w, /product/${tab.id}-${locale}.webp 2880w`}
                    sizes="(min-width: 1680px) 1248px, (min-width: 1120px) 1100px, 100vw"
                    width={1440}
                    height={900}
                    alt={tab.alt}
                    loading="lazy"
                    decoding="async"
                    hidden={i !== at}
                  />
                ))}
              </div>
            </div>
            <figcaption>
              <span className="zx-screen__n ltr" aria-hidden>
                {two(at + 1)}
              </span>
              <span>
                <b>{open.label}</b>
                {open.blurb}
              </span>
            </figcaption>
          </figure>

          <p className="zx-cap zx-cap--night">{copy.caption}</p>
        </div>
      </div>
    </section>
  );
}
