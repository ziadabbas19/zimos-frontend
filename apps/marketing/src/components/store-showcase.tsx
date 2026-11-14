"use client";

/* eslint-disable @next/next/no-img-element -- the captures are already sized and compressed for the page. */
import { useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import { REGISTER_URL } from "@/lib/urls";
import { GALLERY, GALLERY_FIRST, OWN_LOOKS, STORE_KINDS, galleryShot, type StoreKind } from "@/lib/store-shots";
import { ColorIcon } from "./color-icon";
import { Arrow, X } from "./duo-icons";
import { SectionLabel } from "./section-label";

type Device = "desk" | "phone";
type Filter = StoreKind | "all";

/** The kinds that have a store, in their order. */
const KINDS = STORE_KINDS.filter((kind) => GALLERY.some((store) => store.kind === kind));

/**
 * The stores, first thing under the page's opening: what a visitor came to
 * see. Every template of the library as a whole store (lib/store-shots.ts
 * GALLERY), in a grid: its home page on a laptop with the same store on a
 * phone beside it, its kind, and "View the store". The kinds above the grid
 * filter it; unfiltered, the first six show and a button brings the rest.
 *
 * A card opens the viewer: the store alone, large, on the device the visitor
 * picks, its whole home page there to scroll through from top to bottom, the
 * next and the previous store one press away — and the way in from it. It is
 * a native <dialog>, so Esc and the page behind it are the browser's own.
 * Without script every store is in the grid, and its card is a link to its
 * whole page as a picture.
 */
export function StoreShowcase({ copy, locale }: { copy: Dictionary["templates"]; locale: Locale }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [all, setAll] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const [device, setDevice] = useState<Device>("desk");
  const viewer = useRef<HTMLDialogElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const label = (look: string) => (OWN_LOOKS.includes(look) ? copy.ownBadge : copy.templateLabel.replace("{n}", look));
  const shown = (i: number) => (filter === "all" ? all || i < GALLERY_FIRST : GALLERY[i].kind === filter);

  const open = (i: number, on: Device = "desk") => {
    setViewing(i);
    setDevice(on);
    viewer.current?.showModal?.();
    scroller.current?.scrollTo?.({ top: 0 });
  };
  const close = () => viewer.current?.close?.();
  /** The next store of what the grid is filtered to, round and round. */
  const step = (by: number) => {
    if (viewing === null) return;
    const list = GALLERY.map((_, i) => i).filter((i) => filter === "all" || GALLERY[i].kind === filter);
    const at = list.indexOf(viewing);
    setViewing(list[(at + by + list.length) % list.length]);
    scroller.current?.scrollTo?.({ top: 0 });
  };

  const store = viewing === null ? null : GALLERY[viewing];

  return (
    <section className="zx-sec zx-stores" id="templates" aria-labelledby="zx-stores">
      <div className="lz-in">
        <header className="zx-head zx-head--center lz-r">
          <SectionLabel n="01" text={copy.kicker} />
          <h2 className="zx-h2" id="zx-stores">
            {copy.heading}
          </h2>
          <p className="zx-lede">{copy.intro}</p>
        </header>

        <div className="zx-kinds zx-kinds--center lz-r" role="group" aria-label={copy.pickLabel}>
          {(["all", ...KINDS] as Filter[]).map((kind) => (
            <button key={kind} type="button" className="zx-kind" aria-pressed={kind === filter} onClick={() => setFilter(kind)}>
              {copy.kinds[kind]}
              <small className="ltr">{kind === "all" ? GALLERY.length : GALLERY.filter((item) => item.kind === kind).length}</small>
            </button>
          ))}
        </div>

        <ul className="zx-shops">
          {GALLERY.map(({ look, kind }, i) => (
            <li key={look} className="zx-shop" hidden={!shown(i)}>
              <a
                className="zx-shop__open"
                href={galleryShot(look, locale, "desk", "full")}
                onClick={(event) => {
                  event.preventDefault();
                  open(i);
                }}
              >
                <span className="zx-shop__media">
                  <span className="zx-laptop">
                    <span className="zx-laptop__lid">
                      <span className="zx-shop__shot">
                        <img
                          src={galleryShot(look, locale, "desk", "card")}
                          width={720}
                          height={450}
                          alt={`${copy.names[look]} — ${copy.onComputer}`}
                          loading="lazy"
                          decoding="async"
                        />
                      </span>
                    </span>
                    <span className="zx-laptop__base" aria-hidden />
                  </span>
                  <span className="zx-phone zx-shop__phone" aria-hidden>
                    <img src={galleryShot(look, locale, "phone", "card")} width={260} height={520} alt="" loading="lazy" decoding="async" />
                  </span>
                </span>
                <span className="zx-shop__meta">
                  <span className="zx-shop__name">
                    <b>{copy.names[look]}</b>
                    <small>
                      {copy.kinds[kind]} · {label(look)}
                    </small>
                  </span>
                  <span className="zx-shop__go">
                    {copy.view}
                    <Arrow size={16} className="lz-arrow" />
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>

        <div className="zx-stores__foot lz-r">
          {filter === "all" && !all ? (
            <button type="button" className="zx-btn zx-btn--ink" onClick={() => setAll(true)}>
              {copy.showAll.replace("{n}", String(GALLERY.length))}
            </button>
          ) : (
            <a className="zx-btn zx-btn--ink" href={REGISTER_URL}>
              {copy.cta}
              <Arrow size={18} className="lz-arrow" />
            </a>
          )}
          <p className="zx-cap">{copy.caption}</p>
          {/* The designs' credits are on the credits page, linked from every page's footer. */}
        </div>
      </div>

      <dialog ref={viewer} className="zx-viewer" aria-label={copy.viewerLabel} onClose={() => setViewing(null)} onClick={(event) => event.target === viewer.current && close()}>
        {store ? (
          <div className="zx-viewer__in">
            <header className="zx-viewer__bar">
              <p>
                <b>{copy.names[store.look]}</b>
                <span>
                  {copy.kinds[store.kind]} · {label(store.look)}
                </span>
              </p>
              <div className="zx-viewer__devices" role="group" aria-label={copy.viewerLabel}>
                <button type="button" aria-pressed={device === "desk"} onClick={() => setDevice("desk")}>
                  <ColorIcon name="laptop" size={18} ink />
                  <span>{copy.onComputer}</span>
                </button>
                <button type="button" aria-pressed={device === "phone"} onClick={() => setDevice("phone")}>
                  <ColorIcon name="phone" size={18} ink />
                  <span>{copy.onPhone}</span>
                </button>
              </div>
              <a className="zx-btn zx-btn--volt zx-btn--sm" href={REGISTER_URL}>
                {copy.useTemplate}
              </a>
              <button type="button" className="zx-round zx-viewer__close" aria-label={copy.close} onClick={close}>
                <X size={18} />
              </button>
            </header>

            <div className={device === "phone" ? "zx-viewer__stage is-phone" : "zx-viewer__stage"}>
              <button type="button" className="zx-round zx-viewer__step" aria-label={copy.previous} onClick={() => step(-1)}>
                <Arrow size={18} className="zx-arr zx-arr--prev" />
              </button>
              {device === "phone" ? (
                <div className="zx-phone zx-viewer__phone">
                  <div className="zx-viewer__scroll" ref={scroller} tabIndex={0}>
                    <img key={store.look} src={galleryShot(store.look, locale, "phone", "full")} alt={`${copy.names[store.look]} — ${copy.onPhone}`} decoding="async" />
                  </div>
                </div>
              ) : (
                <div className="zx-laptop zx-viewer__laptop">
                  <div className="zx-laptop__lid">
                    <div className="zx-viewer__scroll" ref={scroller} tabIndex={0}>
                      <img key={store.look} src={galleryShot(store.look, locale, "desk", "full")} alt={`${copy.names[store.look]} — ${copy.onComputer}`} decoding="async" />
                    </div>
                  </div>
                  <div className="zx-laptop__base" aria-hidden />
                </div>
              )}
              <button type="button" className="zx-round zx-viewer__step" aria-label={copy.next} onClick={() => step(1)}>
                <Arrow size={18} className="zx-arr zx-arr--next" />
              </button>
            </div>
            <p className="zx-viewer__cap">
              {copy.scrollHint} · {copy.caption}
            </p>
          </div>
        ) : null}
      </dialog>
    </section>
  );
}
