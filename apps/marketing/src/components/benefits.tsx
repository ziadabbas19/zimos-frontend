/* eslint-disable @next/next/no-img-element -- the captures are already sized and compressed for the page. */
import type { CSSProperties } from "react";
import type { Capability, Dictionary } from "@/i18n/dictionary";
import { FAN_LOOKS, STORE_SHOTS } from "@/lib/store-shots";
import { ColorIcon, type ColorIconName } from "./color-icon";
import { Check } from "./duo-icons";

const ITEM_ICON: Record<Capability["id"], ColorIconName> = {
  mobile: "phone",
  domain: "link",
  funnels: "growth",
  confirmation: "chat",
  shipping: "delivery",
  analytics: "profit",
};

/** Templates, editor, phone layout, two languages, your domain — the big card's chips. */
const CHIP_ICON: ColorIconName[] = ["brush", "edit", "phone", "globe", "link"];
const FEED_ICON: ColorIconName[] = ["shield", "tracking", "check"];

const delay = (i: number) => ({ "--i": i }) as CSSProperties;

/**
 * Bento of what the merchant gains: the store and its editor as the big card
 * (three real templates fanned out, what it covers as chips), six gains, and automations as the wide card
 * with a feed of what happens on its own. Chips and feed rows come in one
 * after another once the card is on screen.
 */
export function Benefits({ copy }: { copy: Dictionary["benefits"] }) {
  return (
    <section className="lz-sec" id="benefits" aria-labelledby="lz-ben">
      <div className="lz-in">
        <header className="lz-head lz-r">
          <span className="lz-eye">{copy.kicker}</span>
          <h2 className="lz-h" id="lz-ben">
            {copy.heading}
          </h2>
          <p className="lz-lede">{copy.intro}</p>
        </header>

        <div className="lz-bento">
          <article className="lz-card lz-card--hero lz-r">
            <span className="lz-ico">
              <ColorIcon name="store" size={28} />
            </span>
            <h3>{copy.hero.title}</h3>
            <p>{copy.hero.body}</p>
            <div className="lz-fan" aria-hidden>
              {FAN_LOOKS.map((look) => (
                <span key={look}>
                  <img src={STORE_SHOTS[look].desk} width={960} height={900} alt="" loading="lazy" decoding="async" />
                </span>
              ))}
            </div>
            <ul className="lz-chips" aria-hidden>
              {copy.hero.chips.map((chip, i) => (
                <li key={chip} style={delay(i)}>
                  <ColorIcon name={CHIP_ICON[i]} size={18} />
                  {chip}
                  <span className="lz-done">
                    <Check size={12} />
                  </span>
                </li>
              ))}
            </ul>
          </article>

          {copy.items.map((item) => (
            <article key={item.id} className="lz-card lz-r">
              <span className="lz-ico">
                <ColorIcon name={ITEM_ICON[item.id]} size={28} />
              </span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}

          <article className="lz-card lz-card--wide lz-r">
            <div className="lz-card__split">
              <div>
                <span className="lz-ico">
                  <ColorIcon name="sync" size={28} />
                </span>
                <h3>{copy.wide.title}</h3>
                <p>{copy.wide.body}</p>
              </div>
              <ul className="lz-feed" aria-hidden>
                {copy.wide.feed.map((row, i) => (
                  <li key={row.title} style={delay(i)}>
                    <span className="lz-feed__ico">
                      <ColorIcon name={FEED_ICON[i]} size={18} />
                    </span>
                    <span>
                      <b>{row.title}</b>
                      <small>{row.detail}</small>
                    </span>
                    <em>
                      <Check size={12} />
                    </em>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
