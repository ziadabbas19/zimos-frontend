/* eslint-disable @next/next/no-img-element -- the captures are already sized and compressed for the page. */
import type { CSSProperties } from "react";
import { preload } from "react-dom";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import { REGISTER_URL } from "@/lib/urls";
import { HERO_LOOKS, HERO_PHONES, galleryShot } from "@/lib/store-shots";
import { Icon3D } from "./icon-3d";
import { Arrow, Check } from "./duo-icons";

const turn = (i: number) => ({ "--k": i }) as CSSProperties;

/**
 * Up to this width the computer frame is hidden (home.css, max-width 760px)
 * and only the phones show: its captures are not downloaded there.
 */
const FRAME_HIDDEN = "(max-width: 760px)";
/** A 1x1 transparent GIF: what the hidden frame's pictures resolve to on a phone, with no request. */
const NOTHING = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/**
 * The page's opening: a night-blue stage that reaches up behind the floating
 * header, over a photograph of a shop (public/photos, darkened so the words
 * read). The words stand in the middle — a pill, the title in two colours,
 * one paragraph, the two ways in — and under them real stores on real
 * devices: a laptop crossfading from one store to the next, and a store on a
 * phone at each side of it. Three cards float over them with what happens to
 * an order. On a phone screen the laptop steps aside and three phones take
 * the stage. The cards and the phones are decoration (aria-hidden); the
 * first picture's alt says what they are.
 */
export function Hero({ copy, locale }: { copy: Dictionary["hero"]; locale: Locale }) {
  const { chips } = copy;
  // The first capture is the page's largest picture on a computer: fetched
  // early there, and not at all on a phone.
  preload(galleryShot(HERO_LOOKS[0], locale, "desk", "card"), { as: "image", fetchPriority: "high", media: "(min-width: 761px)" });

  return (
    <section className="zx-hero" aria-labelledby="zx-h1" data-section="hero">
      <div className="zx-hero__bg" aria-hidden>
        <i className="zx-hero__photo" />
        <i className="zx-glow zx-glow--a" />
        <i className="zx-glow zx-glow--b" />
        <i className="zx-hero__grid" />
      </div>

      <div className="lz-in zx-hero__copy">
        <p className="zx-pill">
          <i aria-hidden />
          {copy.badge}
        </p>
        <h1 className="zx-h1" id="zx-h1">
          {copy.lines.map((line) => (
            <span key={line} className="zx-h1__line">
              {line}
            </span>
          ))}
          <span className="zx-h1__line zx-volt">{copy.accent}</span>
        </h1>
        <p className="zx-hero__body">{copy.body}</p>

        <div className="zx-ctas">
          <a className="zx-btn zx-btn--volt" href={REGISTER_URL}>
            {copy.primaryCta}
            <Arrow size={18} className="lz-arrow" />
          </a>
          <a className="zx-btn zx-btn--glass" href="#templates">
            {copy.secondaryCta}
          </a>
        </div>

        <ul className="zx-ticks">
          {copy.ticks.map((tick) => (
            <li key={tick}>
              <Check size={14} />
              {tick}
            </li>
          ))}
        </ul>
      </div>

      <div className="zx-stage">
        <div className="zx-fan" aria-hidden>
          {HERO_PHONES.map((look) => (
            <span key={look} className="zx-phone">
              <img src={galleryShot(look, locale, "phone", "card")} width={300} height={600} alt="" decoding="async" />
            </span>
          ))}
        </div>

        <figure className="zx-laptop zx-stage__frame">
          <div className="zx-laptop__lid">
            <div className="zx-cycle">
            {HERO_LOOKS.map((look, i) => (
              <picture key={look}>
                <source media={FRAME_HIDDEN} srcSet={NOTHING} />
                <img
                  src={galleryShot(look, locale, "desk", "card")}
                  width={960}
                  height={600}
                  alt={i === 0 ? copy.imageAlt : ""}
                  fetchPriority={i === 0 ? "high" : "low"}
                  decoding="async"
                  style={turn(i)}
                />
              </picture>
            ))}
            </div>
          </div>
          <div className="zx-laptop__base" aria-hidden />
        </figure>

        <div className="zx-floats" aria-hidden>
          <div className="zx-float zx-float--a">
            <Icon3D name="package" size={40} />
            <span>
              <b>{chips.order.title}</b>
              <small>{chips.order.detail}</small>
            </span>
          </div>
          <div className="zx-float zx-float--b">
            <Icon3D name="check" size={40} />
            <span>
              <b>{chips.confirmed.title}</b>
              <small>{chips.confirmed.detail}</small>
            </span>
          </div>
          <div className="zx-float zx-float--c">
            <Icon3D name="money" size={40} />
            <span>
              <b>{chips.delivered.title}</b>
              <small>{chips.delivered.detail}</small>
            </span>
          </div>
        </div>
      </div>

      <p className="zx-hero__cap">{copy.caption}</p>
    </section>
  );
}
