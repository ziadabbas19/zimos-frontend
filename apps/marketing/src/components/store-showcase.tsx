"use client";

/* eslint-disable @next/next/no-img-element -- the captures are already sized and compressed for the page. */
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import { REGISTER_URL } from "@/lib/urls";
import { GALLERY_LOOKS, OWN_LOOKS, STORE_SHOTS, deskShot } from "@/lib/store-shots";
import { ColorIcon } from "./color-icon";
import { Arrow, X } from "./duo-icons";
import { SectionLabel } from "./section-label";

const two = (n: number) => String(n).padStart(2, "0");

type Device = "desk" | "phone";

/**
 * The stores, first thing under the page's opening: what a visitor came to
 * see. A row to move through — the store in the middle stands at full size on
 * a laptop, with the same store on a phone beside it where there is a phone
 * capture, and the ones beside it wait, smaller and dimmed. The kinds of
 * store above the row, the two arrows and a swipe all move it: the row is a
 * native scroller that snaps to its cards, so it also works with no script.
 *
 * "View the store" on a card opens the viewer: the store alone, large, on
 * the device the visitor picks, its page there to scroll through as far as
 * the capture goes — and the way in from it. It is a native <dialog>, so Esc
 * and the page behind it are the browser's own.
 */
export function StoreShowcase({ copy, locale }: { copy: Dictionary["templates"]; locale: Locale }) {
  const [active, setActive] = useState(0);
  const [viewing, setViewing] = useState<string | null>(null);
  const [device, setDevice] = useState<Device>("desk");
  const rail = useRef<HTMLUListElement>(null);
  const cards = useRef<(HTMLLIElement | null)[]>([]);
  const viewer = useRef<HTMLDialogElement>(null);
  const count = GALLERY_LOOKS.length;

  // The card crossing the middle of the row is the active one.
  useEffect(() => {
    const root = rail.current;
    if (!root || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.i));
        }
      },
      { root, rootMargin: "0px -49% 0px -49%" },
    );
    cards.current.forEach((card) => card && io.observe(card));
    return () => io.disconnect();
  }, []);

  const go = (to: number) => {
    const card = cards.current[(to + count) % count];
    const root = rail.current;
    if (!card || !root) return;
    // By the row's own scroll, so the page itself does not move.
    const box = card.getBoundingClientRect();
    const frame = root.getBoundingClientRect();
    const scale = frame.width / root.offsetWidth || 1;
    const delta = (box.left + box.width / 2 - (frame.left + frame.width / 2)) / scale;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.scrollBy({ left: delta, behavior: calm ? "auto" : "smooth" });
  };

  const open = (look: string) => {
    setViewing(look);
    setDevice("desk");
    viewer.current?.showModal?.();
  };
  const close = () => viewer.current?.close?.();

  const label = (look: string) => copy.templateLabel.replace("{n}", look);
  const shown = viewing ? STORE_SHOTS[viewing] : null;
  const onPhone = device === "phone" && Boolean(shown?.phone);

  return (
    <section className="zx-sec zx-stores" id="templates" aria-labelledby="zx-stores">
      <div className="lz-in">
        <header className="zx-head zx-head--split lz-r">
          <div>
            <SectionLabel n="01" text={copy.kicker} />
            <h2 className="zx-h2" id="zx-stores">
              {copy.heading}
            </h2>
            <p className="zx-lede">{copy.intro}</p>
          </div>
          <div className="zx-pager">
            <span className="zx-pager__n ltr" aria-hidden>
              <b>{two(active + 1)}</b> / {two(count)}
            </span>
            <button type="button" className="zx-round" aria-label={copy.previous} onClick={() => go(active - 1)}>
              <Arrow size={18} className="zx-arr zx-arr--prev" />
            </button>
            <button type="button" className="zx-round zx-round--solid" aria-label={copy.next} onClick={() => go(active + 1)}>
              <Arrow size={18} className="zx-arr zx-arr--next" />
            </button>
          </div>
        </header>

        <div className="zx-kinds lz-r" role="group" aria-label={copy.pickLabel}>
          {GALLERY_LOOKS.map((look, i) => (
            <button key={look} type="button" className="zx-kind" aria-pressed={i === active} onClick={() => go(i)}>
              {copy.categories[look]}
            </button>
          ))}
        </div>
      </div>

      <ul className="zx-rail" ref={rail}>
        {GALLERY_LOOKS.map((look, i) => {
          const own = OWN_LOOKS.includes(look);
          const phone = STORE_SHOTS[look].phone;
          return (
            <li
              key={look}
              ref={(el) => {
                cards.current[i] = el;
              }}
              data-i={i}
              className={i === active ? "zx-store is-active" : "zx-store"}
            >
              <div className={phone ? "zx-store__media" : "zx-store__media zx-store__media--solo"}>
                <div className="zx-laptop">
                  <div className="zx-laptop__lid">
                    <div className="zx-store__shot">
                      <img
                        src={deskShot(look, locale)}
                        width={960}
                        height={own ? 600 : 900}
                        alt={`${copy.categories[look]} — ${label(look)}`}
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  </div>
                  <div className="zx-laptop__base" aria-hidden />
                </div>
                {/* The name is under the card, so the phone needs no alt of its own. */}
                {phone ? (
                  <div className="zx-phone zx-store__phone" aria-hidden>
                    <img src={phone} width={390} height={1600} alt="" loading="lazy" decoding="async" />
                  </div>
                ) : null}
              </div>
              <div className="zx-store__meta">
                <p>
                  <b>{copy.categories[look]}</b>
                  <span>{copy.blurbs[look]}</span>
                </p>
                <div className="zx-store__acts">
                  <span className={own ? "zx-tag zx-tag--own" : "zx-tag"}>{own ? copy.ownBadge : label(look)}</span>
                  <button type="button" className="zx-btn zx-btn--ink zx-btn--sm" tabIndex={i === active ? 0 : -1} onClick={() => open(look)}>
                    {copy.view}
                    <Arrow size={16} className="lz-arrow" />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="lz-in zx-stores__foot lz-r">
        <p className="zx-stores__hint">{copy.hoverHint}</p>
        <a className="zx-btn zx-btn--line" href={REGISTER_URL}>
          {copy.cta}
          <Arrow size={18} className="lz-arrow" />
        </a>
        <p className="zx-cap">{copy.caption}</p>
        {/* The designs' credits are on the credits page, linked from every page's footer. */}
      </div>

      <dialog ref={viewer} className="zx-viewer" aria-label={copy.viewerLabel} onClose={() => setViewing(null)} onClick={(event) => event.target === viewer.current && close()}>
        {viewing && shown ? (
          <div className="zx-viewer__in">
            <header className="zx-viewer__bar">
              <p>
                <b>{copy.categories[viewing]}</b>
                <span>{OWN_LOOKS.includes(viewing) ? copy.ownBadge : label(viewing)}</span>
              </p>
              {shown.phone ? (
                <div className="zx-viewer__devices" role="group" aria-label={copy.viewerLabel}>
                  <button type="button" aria-pressed={!onPhone} onClick={() => setDevice("desk")}>
                    <ColorIcon name="laptop" size={18} ink />
                    {copy.onComputer}
                  </button>
                  <button type="button" aria-pressed={onPhone} onClick={() => setDevice("phone")}>
                    <ColorIcon name="phone" size={18} ink />
                    {copy.onPhone}
                  </button>
                </div>
              ) : null}
              <a className="zx-btn zx-btn--volt zx-btn--sm" href={REGISTER_URL}>
                {copy.useTemplate}
              </a>
              <button type="button" className="zx-round zx-viewer__close" aria-label={copy.close} onClick={close}>
                <X size={18} />
              </button>
            </header>
            <div className={onPhone ? "zx-viewer__stage is-phone" : "zx-viewer__stage"}>
              {onPhone ? (
                <div className="zx-phone zx-viewer__phone">
                  <div className="zx-viewer__scroll">
                    <img src={shown.phone} width={390} height={1600} alt={`${copy.categories[viewing]} — ${copy.onPhone}`} decoding="async" />
                  </div>
                </div>
              ) : (
                <div className="zx-laptop zx-viewer__laptop">
                  <div className="zx-laptop__lid">
                    <div className="zx-viewer__scroll">
                      <img
                        src={deskShot(viewing, locale)}
                        width={960}
                        height={OWN_LOOKS.includes(viewing) ? 600 : 900}
                        alt={`${copy.categories[viewing]} — ${copy.onComputer}`}
                        decoding="async"
                      />
                    </div>
                  </div>
                  <div className="zx-laptop__base" aria-hidden />
                </div>
              )}
            </div>
            <p className="zx-viewer__cap">{copy.caption}</p>
          </div>
        ) : null}
      </dialog>
    </section>
  );
}
