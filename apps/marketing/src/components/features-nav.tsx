"use client";

import { useEffect, useRef, useState } from "react";
import type { FeaturesCopy } from "@/content/features";
import { matchesQuery } from "@/lib/searchable";
import { MagnifyingGlass, X } from "./duo-icons";

type NavSection = { id: string; label: string; title: string };

/**
 * The bar that stays under the header on /features: the sections as a row of
 * links (a menu on a phone), the one being read marked, and a search over the
 * cards. The search hides what does not match in the page the server drew
 * (`data-ft-section`, `data-ft-head`, `data-ft-card`, `data-ft-extra` in
 * feature-section.tsx), so the words are sent once; a section whose title
 * matches stays whole. Without the script the links still work and every
 * card is shown. The page keys it by language: the other language's page is
 * drawn whole, so the search starts again empty.
 */
export function FeaturesNav({ sections, copy }: { sections: NavSection[]; copy: FeaturesCopy["bar"] }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");
  const [query, setQuery] = useState("");
  // On a phone the field takes the menu's place while it is open.
  const [searching, setSearching] = useState(false);
  // Sections with a match while searching; null when nothing is typed.
  const [found, setFound] = useState<string[] | null>(null);
  const row = useRef<HTMLUListElement>(null);
  const field = useRef<HTMLInputElement>(null);

  // The section being read: the last shown one whose top has passed a third
  // of the window.
  useEffect(() => {
    let ticking = false;
    const paint = () => {
      ticking = false;
      const line = window.innerHeight * 0.3;
      let current: string | undefined;
      for (const { id } of sections) {
        const el = document.getElementById(id);
        if (!el || el.hidden) continue;
        if (current !== undefined && el.getBoundingClientRect().top > line) break;
        current = id;
      }
      if (current) setActive(current);
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
  }, [sections, found]);

  // Keep the marked link inside the row when the row scrolls sideways. By
  // the difference of the two boxes, so it holds in both directions.
  useEffect(() => {
    const bar = row.current;
    const link = bar?.querySelector<HTMLElement>(`[data-id="${active}"]`);
    if (!bar || !link || bar.scrollWidth <= bar.clientWidth) return;
    const a = link.getBoundingClientRect();
    const b = bar.getBoundingClientRect();
    if (a.left >= b.left && a.right <= b.right) return;
    bar.scrollBy({ left: a.left + a.width / 2 - (b.left + b.width / 2) });
  }, [active]);

  // A row longer than the bar fades out at the edge it continues past
  // (`data-more-start` / `data-more-end`, features.css). The scroll offset
  // runs negative in a right-to-left row, so its size is what counts.
  useEffect(() => {
    const bar = row.current;
    if (!bar) return;
    const mark = () => {
      const max = bar.scrollWidth - bar.clientWidth;
      const at = Math.abs(bar.scrollLeft);
      bar.toggleAttribute("data-more-start", max > 1 && at > 1);
      bar.toggleAttribute("data-more-end", max > 1 && at < max - 1);
    };
    mark();
    bar.addEventListener("scroll", mark, { passive: true });
    window.addEventListener("resize", mark);
    return () => {
      bar.removeEventListener("scroll", mark);
      window.removeEventListener("resize", mark);
    };
  }, [found]);

  useEffect(() => {
    if (searching) field.current?.focus();
  }, [searching]);

  const shown = found ? sections.filter((s) => found.includes(s.id)) : sections;
  const current = shown.some((s) => s.id === active) ? active : (shown[0]?.id ?? "");

  const go = (id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    setActive(id);
    target.scrollIntoView({ block: "start" });
    window.history.replaceState(null, "", `#${id}`);
  };

  const search = (text: string) => {
    setQuery(text);
    const typed = text.trim();
    const hits: string[] = [];
    document.querySelectorAll<HTMLElement>("[data-ft-section]").forEach((section) => {
      const head = section.querySelector("[data-ft-head]")?.textContent ?? "";
      const whole = !typed || matchesQuery(head, typed);
      let any = whole;
      section.querySelectorAll<HTMLElement>("[data-ft-card]").forEach((card) => {
        card.hidden = !whole && !matchesQuery(`${head} ${card.textContent ?? ""}`, typed);
        if (!card.hidden) any = true;
      });
      section.querySelectorAll<HTMLElement>("[data-ft-extra]").forEach((extra) => {
        extra.hidden = !whole;
      });
      section.hidden = !any;
      if (any) hits.push(section.id);
    });
    setFound(typed ? hits : null);

    // The results start at the top of the list: bring it back into view.
    const list = document.getElementById("ft-list");
    if (typed && list && list.getBoundingClientRect().top < 0) list.scrollIntoView({ block: "start" });
  };

  const clear = () => {
    search("");
    setSearching(false);
  };

  return (
    <>
      <div className={`ft-bar${searching ? " is-searching" : ""}${query ? " has-query" : ""}`}>
        <div className="ft-bar__card">
          <nav className="ft-bar__nav" aria-label={copy.navLabel}>
            <ul ref={row} className="ft-bar__links">
              {shown.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    data-id={section.id}
                    aria-current={section.id === current ? "location" : undefined}
                    onClick={() => setActive(section.id)}
                  >
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <label className="ft-bar__jump">
            <span className="sr-only">{copy.jumpLabel}</span>
            <select value={current} onChange={(event) => go(event.target.value)}>
              {shown.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.title}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="ft-bar__open"
            aria-label={copy.openSearch}
            onClick={() => setSearching(true)}
          >
            <MagnifyingGlass size={20} />
          </button>

          <div className="ft-bar__search" role="search">
            <MagnifyingGlass size={18} className="ft-bar__glass" />
            <input
              ref={field}
              type="search"
              value={query}
              onChange={(event) => search(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") clear();
              }}
              placeholder={copy.searchPlaceholder}
              aria-label={copy.searchLabel}
              enterKeyHint="search"
              autoComplete="off"
            />
            <button type="button" className="ft-bar__clear" aria-label={copy.clearSearch} onClick={clear}>
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      <div role="status" className="lz-in">
        {found && found.length === 0 ? (
          <div className="ft-empty">
            <p>{copy.empty}</p>
            <button type="button" className="lz-link" onClick={clear}>
              {copy.clearSearch}
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
