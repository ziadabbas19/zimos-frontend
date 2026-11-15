/* eslint-disable @next/next/no-img-element -- the captures are already sized and compressed for the page. */
import type { CSSProperties } from "react";
import { preload } from "react-dom";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import { REGISTER_URL } from "@/lib/urls";
import { HERO_LOOKS, HERO_PHONES, galleryShot } from "@/lib/store-shots";
import { Arrow, Check } from "./duo-icons";

const nth = (name: "--i" | "--k", i: number) => ({ [name]: i }) as CSSProperties;

/** The phones at the laptop's two sides: the first and the last of HERO_PHONES. */
const PHONES = [HERO_PHONES[0], HERO_PHONES[HERO_PHONES.length - 1]] as const;

/**
 * The page's opening, one screen high: a night-blue stage over a darkened
 * photograph of a shop, with the words in their own block at the top — the
 * pill, the title in two lines, one paragraph, the two ways in, three ticks
 * — and under them, in the space left (home.css `.zm-stage`, a size
 * container), real stores on real devices: a laptop turning from one store
 * to the next (CSS only), a store on a phone at each side, and three cards
 * with what happens to an order, floating at the laptop's edges. The
 * devices are drawn to fit that space, so nothing ever covers the words or
 * the buttons. The first capture's alt says what they are; the rest is
 * decoration. The pointer gives the stage some depth (home-effects.tsx).
 */
export function Hero({ copy, locale }: { copy: Dictionary["hero"]; locale: Locale }) {
  const { chips } = copy;
  // The laptop's first store is the page's largest picture: fetched first, and not on a phone, where the laptop is small.
  preload(galleryShot(HERO_LOOKS[0], locale, "desk", "card"), { as: "image", fetchPriority: "high", media: "(min-width: 640px)" });
  const lines = [...copy.lines, copy.accent];

  return (
    <section className="zm-hero" aria-labelledby="zm-h1" data-section="hero">
      <div className="zm-hero-bg" aria-hidden>
        <img
          className="zm-hero-photo"
          src="/photos/store-interior-1920.webp"
          srcSet="/photos/store-interior-960.webp 960w, /photos/store-interior-1920.webp 1920w"
          sizes="100vw"
          width={1920}
          height={1080}
          alt=""
          decoding="async"
          fetchPriority="low"
        />
      </div>
      <i className="zm-glow zm-glow--a" aria-hidden />
      <i className="zm-glow zm-glow--b" aria-hidden />
      <i className="zm-glow zm-glow--c" aria-hidden />
      <i className="zm-grid" aria-hidden />

      <div className="zm-hero-copy">
        <p className="zm-pill">
          <i aria-hidden />
          {copy.badge}
        </p>
        <h1 className="zm-h1" id="zm-h1">
          {lines.map((line, i) => (
            <span key={line} className="ln">
              <span className={i === lines.length - 1 ? "acc" : undefined} style={nth("--i", i)}>
                {line}
              </span>
            </span>
          ))}
        </h1>
        <p className="zm-hero-sub">{copy.body}</p>

        <div className="zm-ctas">
          <a className="zm-btn zm-btn--volt" href={REGISTER_URL} data-mag="">
            {copy.primaryCta}
            <Arrow size={18} className="zm-arr" />
          </a>
          <a className="zm-btn zm-btn--glass" href="#templates" data-mag="">
            {copy.secondaryCta}
          </a>
        </div>

        <ul className="zm-ticks">
          {copy.ticks.map((tick) => (
            <li key={tick}>
              <Check size={14} />
              {tick}
            </li>
          ))}
        </ul>
      </div>

      <div className="zm-stage">
        {/* Hidden on a phone (the cards under 1024px): lazy, so a hidden picture is never fetched. */}
        <span className="zm-ph zm-ph--l" aria-hidden>
          <img src={galleryShot(PHONES[0], locale, "phone", "card")} width={260} height={520} alt="" loading="lazy" decoding="async" />
        </span>

        <figure className="zm-laptop">
          <div className="zm-lid">
            <div className="zm-scr">
              {HERO_LOOKS.map((look, i) => (
                <img
                  key={look}
                  src={galleryShot(look, locale, "desk", "card")}
                  width={720}
                  height={450}
                  alt={i === 0 ? copy.imageAlt : ""}
                  fetchPriority={i === 0 ? "high" : "low"}
                  loading={i === 0 ? undefined : "lazy"}
                  decoding="async"
                  style={nth("--k", i)}
                />
              ))}
            </div>
          </div>
          <div className="zm-base" aria-hidden />
        </figure>

        <span className="zm-ph zm-ph--r" aria-hidden>
          <img src={galleryShot(PHONES[1], locale, "phone", "card")} width={260} height={520} alt="" loading="lazy" decoding="async" />
        </span>

        <div className="zm-fl zm-fl--a" aria-hidden>
          <img src="/icons/3d/package.webp" width={40} height={40} alt="" loading="lazy" decoding="async" />
          <span>
            <b>{chips.order.title}</b>
            <small>{chips.order.detail}</small>
          </span>
        </div>
        <div className="zm-fl zm-fl--b" aria-hidden>
          <img src="/icons/3d/check.webp" width={40} height={40} alt="" loading="lazy" decoding="async" />
          <span>
            <b>{chips.confirmed.title}</b>
            <small>{chips.confirmed.detail}</small>
          </span>
        </div>
        <div className="zm-fl zm-fl--c" aria-hidden>
          <img src="/icons/3d/money.webp" width={40} height={40} alt="" loading="lazy" decoding="async" />
          <span>
            <b>{chips.delivered.title}</b>
            <small>{chips.delivered.detail}</small>
          </span>
        </div>
      </div>

      <div className="zm-hero-foot">
        <p>{copy.caption}</p>
        <span className="zm-scroll" aria-hidden />
      </div>
    </section>
  );
}
