"use client";

/* eslint-disable @next/next/no-img-element -- the captures are already sized and compressed for the page. */
import { useRef, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import { REGISTER_URL } from "@/lib/urls";
import { GALLERY, GALLERY_FIRST, OWN_LOOKS, STORE_KINDS, galleryShot, type StoreKind } from "@/lib/store-shots";
import { Arrow } from "./duo-icons";
import { SectionLabel } from "./section-label";

// The viewer's code is fetched the first time a store is opened, never before.
const StoreViewer = dynamic(() => import("./store-viewer").then((m) => m.StoreViewer), { ssr: false });

type Filter = StoreKind | "all";

/** The kinds that have a store, in their order. */
const KINDS = STORE_KINDS.filter((kind) => GALLERY.some((store) => store.kind === kind));

const count = (kind: Filter) => (kind === "all" ? GALLERY.length : GALLERY.filter((store) => store.kind === kind).length);

/**
 * The stores, first thing under the page's opening: every template of the
 * library as a whole store (lib/store-shots.ts GALLERY), each a card with
 * its home page on a laptop and on a phone, its kind, and "View the store".
 * The kinds above the grid filter it; unfiltered, the first six show and a
 * button brings the rest.
 *
 * "View the store" opens the viewer (store-viewer.tsx): the store large, on
 * a computer or a phone, its whole page to scroll through, the next and the
 * previous store a press away. Every store is in the page's HTML (the ones
 * not shown are `hidden`), and without script a card's button is a link to
 * the store's whole page as a picture.
 */
export function StoreShowcase({ copy, locale }: { copy: Dictionary["templates"]; locale: Locale }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [all, setAll] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const [opened, setOpened] = useState(false);
  const opener = useRef<HTMLElement | null>(null);

  const label = (look: string) => (OWN_LOOKS.includes(look) ? copy.ownBadge : copy.templateLabel.replace("{n}", look));
  const inFilter = (i: number) => filter === "all" || GALLERY[i].kind === filter;
  const list = GALLERY.map((_, i) => i).filter(inFilter);
  const shown = (i: number) => inFilter(i) && (filter !== "all" || all || i < GALLERY_FIRST);
  // Each shown card's place among the shown ones: they come in one after the other.
  const place = new Map(GALLERY.map((_, i) => i).filter(shown).map((i, k) => [i, k]));

  return (
    <section className="zm-sec" id="templates" aria-labelledby="zm-stores" data-section="stores">
      <div className="zm-in">
        <header className="zm-sh rv">
          <SectionLabel n="01" text={copy.kicker} />
          <h2 id="zm-stores">{copy.heading}</h2>
          <p>{copy.intro}</p>
        </header>

        <div className="zm-chips rv" role="group" aria-label={copy.pickLabel}>
          {(["all", ...KINDS] as Filter[]).map((kind) => (
            <button
              key={kind}
              type="button"
              className="zm-chip"
              aria-pressed={kind === filter}
              onClick={() => {
                setFilter(kind);
                setAll(false);
              }}
            >
              {copy.kinds[kind]}
              <em className="ltr">{count(kind)}</em>
            </button>
          ))}
        </div>

        <ul className="zm-sgrid">
          {GALLERY.map(({ look, kind }, i) => {
            const visible = place.has(i);
            const style = { "--n": place.get(i) ?? 0 } as CSSProperties;
            return (
              <li key={`${filter}-${look}`} hidden={!visible} aria-labelledby={`zm-store-${look}`}>
                <article className="zm-sc" style={style}>
                  <div className="zm-sc-pic">
                    <div className="zm-sc-lap">
                      <img src={galleryShot(look, locale, "desk", "card")} width={720} height={450} alt={`${copy.names[look]} — ${copy.onComputer}`} loading="lazy" decoding="async" />
                    </div>
                    <span className="zm-sc-ph" aria-hidden>
                      <img src={galleryShot(look, locale, "phone", "card")} width={260} height={520} alt="" loading="lazy" decoding="async" />
                    </span>
                  </div>
                  <div className="zm-sc-bd">
                    <div>
                      <h3 id={`zm-store-${look}`}>{copy.names[look]}</h3>
                      <small>
                        {copy.kinds[kind]} · {OWN_LOOKS.includes(look) ? <span className="own">{label(look)}</span> : label(look)}
                      </small>
                    </div>
                    <a
                      className="zm-btn zm-btn--blue zm-btn--sm"
                      href={galleryShot(look, locale, "desk", "full")}
                      onClick={(event) => {
                        event.preventDefault();
                        opener.current = event.currentTarget;
                        setViewing(i);
                        setOpened(true);
                      }}
                    >
                      {copy.view}
                      <Arrow size={15} className="zm-arr" />
                    </a>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>

        <div className="zm-more rv">
          {filter === "all" && !all ? (
            <button type="button" className="zm-btn zm-btn--blue" onClick={() => setAll(true)} data-mag="">
              {copy.showAll.replace("{n}", String(GALLERY.length))}
            </button>
          ) : (
            <a className="zm-btn zm-btn--blue" href={REGISTER_URL} data-mag="">
              {copy.cta}
              <Arrow size={18} className="zm-arr" />
            </a>
          )}
          <p className="zm-note">{copy.caption}</p>
        </div>
      </div>

      {opened ? (
        <StoreViewer
          copy={copy}
          locale={locale}
          list={list}
          at={viewing}
          onMove={setViewing}
          onClose={() => {
            setViewing(null);
            opener.current?.focus();
          }}
        />
      ) : null}
    </section>
  );
}
