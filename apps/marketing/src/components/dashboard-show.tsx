"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import { Arrow } from "./duo-icons";
import { SectionLabel } from "./section-label";

const two = (n: number) => String(n).padStart(2, "0");

/**
 * Real screens of the dashboard (public/product, one set per language) on
 * the night-blue panel, one at a time in a browser frame: the screens'
 * names are tabs, a counter with two arrows moves through them too, and
 * under the frame are the open screen's number, name and line.
 *
 * The screens turn by themselves every seven seconds: a thin line at the
 * foot of the frame runs out (CSS), and holds while the pointer or the
 * focus is there or the section is off screen; under reduced motion it
 * never runs. Choosing a screen stops the turning. With a mouse the frame
 * tilts a little towards the pointer (`data-tilt`, home-effects.tsx).
 */
export function DashboardShow({ copy, locale }: { copy: Dictionary["dashboard"]; locale: Locale }) {
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(true);
  // The screens shown so far: one not yet shown stays `hidden`, so its picture is not fetched before it is needed.
  const [seen, setSeen] = useState<readonly number[]>([0]);
  const show = (to: number) => {
    setAt(to);
    setSeen((was) => (was.includes(to) ? was : [...was, to]));
  };
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();
  const { tabs } = copy;
  const count = tabs.length;
  const open = tabs[at];

  const go = (to: number) => {
    setPlaying(false);
    show((to + count) % count);
  };

  // Arrow keys move between the tabs (the tab list is one stop for Tab), the other way round in Arabic.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (at + (document.documentElement.dir === "rtl" ? -step : step) + count) % count;
    go(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <section className="zm-night zm-sec" id="panel" aria-labelledby="zm-show" data-section="dashboard">
      <div className="zm-in zm-dwrap">
        <header className="zm-dhead rv">
          <div>
            <SectionLabel n="05" text={copy.kicker} />
            <h2 id="zm-show">{copy.heading}</h2>
            <p>{copy.intro}</p>
          </div>
          <div className="zm-dnav">
            <span className="ltr" aria-hidden>
              {two(at + 1)} / {two(count)}
            </span>
            <button type="button" className="zm-navbtn" aria-label={copy.previous} onClick={() => go(at - 1)}>
              <Arrow size={18} className="zm-arr zm-arr--back" />
            </button>
            <button type="button" className="zm-navbtn zm-navbtn--w" aria-label={copy.next} onClick={() => go(at + 1)}>
              <Arrow size={18} className="zm-arr" />
            </button>
          </div>
        </header>

        <div className="zm-dtabs rv" role="tablist" aria-label={copy.heading} onKeyDown={onKeyDown}>
          {tabs.map((tab, i) => (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              className="zm-dtab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={i === at}
              aria-controls={`${baseId}-panel`}
              tabIndex={i === at ? 0 : -1}
              onClick={() => go(i)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <figure className="rv">
          <div className="zm-dwin" data-tilt="">
            <div className="zm-dbar" aria-hidden>
              <i />
              <i />
              <i />
              <span className="ltr">app.zimos.co</span>
            </div>
            <div className="zm-dview" role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${open.id}`}>
              {tabs.map((tab, i) => (
                // A plain img: the captures are already sized and compressed, 1440 wide,
                // and the 2880 one only for a screen that draws them that sharp.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={tab.id}
                  className={i === at ? "on" : undefined}
                  src={`/product/${tab.id}-${locale}-1440.webp`}
                  srcSet={`/product/${tab.id}-${locale}-1440.webp 1440w, /product/${tab.id}-${locale}.webp 2880w`}
                  sizes="(min-width: 1024px) 760px, 100vw"
                  width={1440}
                  height={900}
                  alt={i === at ? tab.alt : ""}
                  aria-hidden={i === at ? undefined : true}
                  hidden={!seen.includes(i)}
                  loading="lazy"
                  decoding="async"
                />
              ))}
              {playing ? <i key={at} className="zm-dclock" aria-hidden onAnimationEnd={() => show((at + 1) % count)} /> : null}
            </div>
          </div>
          <figcaption className="zm-dcap">
            <span className="n ltr" aria-hidden>
              {two(at + 1)}
            </span>
            <div key={at}>
              <b>{open.label}</b>
              <span>{open.blurb}</span>
            </div>
          </figcaption>
        </figure>

        <p className="zm-cap">{copy.caption}</p>
      </div>
    </section>
  );
}
