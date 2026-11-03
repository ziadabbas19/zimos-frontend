"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface XsJourneyTab {
  key: string;
  icon: string;
  pain: string;
  name: string;
}

/** Each need's line icon (stroke, 24 box). */
const ICONS: Record<string, ReactNode> = {
  moon: <path d="M20.5 14.5A8 8 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />,
  bottle: (
    <>
      <path d="M9 3h6l-1 4h-4L9 3Z" />
      <path d="M9.5 7h5l1.5 5v7a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-7l1.5-5Z" />
    </>
  ),
  bag: (
    <>
      <path d="M6 8h12l1 11H5L6 8Z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 2.5" />
    </>
  ),
  heart: <path d="M12 20.5s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10.5c0 5.4-7 10-7 10Z" />,
  star: <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8L12 3.5Z" />,
  box: (
    <>
      <path d="M12 3.5 20 8v8l-8 4.5L4 16V8l8-4.5Z" />
      <path d="M4 8l8 4.5L20 8M12 12.5V20" />
    </>
  ),
};

/**
 * `xs_journey`'s tabs: one per need, and the panel of the one chosen under
 * them (the panels are drawn on the server and handed in, in the same order).
 * A tab list in the WAI-ARIA way: arrows move between the needs, Home/End to
 * the ends, and the chosen one's panel is the only one shown.
 */
export function XsJourney({ tabs, panels, label }: { tabs: XsJourneyTab[]; panels: ReactNode[]; label: string }) {
  const [on, setOn] = useState(0);
  const id = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    let next = on;
    if (event.key === forward) next = (on + 1) % tabs.length;
    else if (event.key === back) next = (on - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    setOn(next);
    buttons.current[next]?.focus();
    buttons.current[next]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  return (
    <>
      <div className="xs-journey__tabs" role="tablist" aria-label={label} onKeyDown={onKey}>
        {tabs.map((tab, i) => (
          <button
            key={tab.key}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${id}-t${i}`}
            aria-selected={i === on}
            aria-controls={`${id}-p${i}`}
            tabIndex={i === on ? 0 : -1}
            className="xs-journey__tab"
            onClick={() => setOn(i)}
          >
            <span className="xs-journey__tab-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">{ICONS[tab.icon] ?? ICONS.box}</svg>
            </span>
            {tab.pain ? <span className="xs-journey__tab-pain">{tab.pain}</span> : null}
            {tab.name ? <span className="xs-journey__tab-name">{tab.name}</span> : null}
          </button>
        ))}
      </div>
      {panels.map((panel, i) => (
        <div key={tabs[i]?.key ?? i} role="tabpanel" id={`${id}-p${i}`} aria-labelledby={`${id}-t${i}`} hidden={i !== on} className="xs-journey__panel">
          {panel}
        </div>
      ))}
    </>
  );
}
