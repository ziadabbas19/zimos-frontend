/* eslint-disable @next/next/no-img-element -- the captures are already sized and compressed for the page. */
import type { Dictionary } from "@/i18n/dictionary";
import { REGISTER_URL } from "@/lib/urls";
import { GALLERY_LOOKS, SHOT_CREDITS, STORE_SHOTS } from "@/lib/store-shots";
import { Arrow } from "./duo-icons";

/**
 * Stores built from the template library. On a computer each card is
 * the store's home page in a browser frame — pointing at it scrolls the page
 * — with the same store on a phone at its corner. On a phone screen the
 * cards become a row you swipe through, each one a phone showing the store
 * as a shopper sees it, scrolling slowly by itself.
 */
export function TemplatesGallery({ copy }: { copy: Dictionary["templates"] }) {
  const name = (look: string) => `${copy.categories[look]} — ${copy.templateLabel.replace("{n}", look)}`;

  return (
    <section className="lz-sec lz-sec--tint" id="templates" aria-labelledby="lz-tpl">
      <div className="lz-in">
        <header className="lz-head lz-head--center lz-r">
          <span className="lz-eye">{copy.kicker}</span>
          <h2 className="lz-h" id="lz-tpl">
            {copy.heading}
          </h2>
          <p className="lz-lede">{copy.intro}</p>
        </header>

        <ul className="lz-tpl">
          {GALLERY_LOOKS.map((look) => (
            <li key={look} className="lz-tpl__card">
              <div className="lz-tpl__media">
                <div className="lz-tpl__frame">
                  <div className="lz-frame__bar" aria-hidden>
                    <i />
                    <i />
                    <i />
                  </div>
                  <div className="lz-tpl__shot">
                    <img src={STORE_SHOTS[look].desk} width={960} height={900} alt={name(look)} loading="lazy" decoding="async" />
                  </div>
                </div>
                {/* The name is under the card, so the phone needs no alt of its own. */}
                <div className="lz-tpl__phone">
                  <div className="lz-tpl__screen">
                    <img src={STORE_SHOTS[look].phone} width={390} height={1600} alt="" loading="lazy" decoding="async" />
                  </div>
                </div>
              </div>
              <p className="lz-tpl__meta">
                <b>{copy.categories[look]}</b>
                <span className="ltr">{copy.templateLabel.replace("{n}", look)}</span>
              </p>
            </li>
          ))}
        </ul>

        <p className="lz-tpl__hint lz-tpl__hint--pointer">{copy.hoverHint}</p>
        <p className="lz-tpl__hint lz-tpl__hint--touch">{copy.swipeHint}</p>
        <p className="lz-tpl__cta">
          <a className="lz-btn" href={REGISTER_URL}>
            {copy.cta}
            <Arrow size={18} className="lz-arrow" />
          </a>
        </p>
        <p className="lz-show__cap lz-tpl__cap">{copy.caption}</p>
        {/* The designs' licences ask for this credit wherever they are shown, the hero included. */}
        <p className="lz-tpl__credits">
          {copy.creditsLead}{" "}
          {GALLERY_LOOKS.map((look, i) => {
            const { name, author, href, licence, licenceHref } = SHOT_CREDITS[look];
            return (
              <span key={look}>
                {i > 0 ? " · " : null}
                {copy.templateLabel.replace("{n}", look)}:{" "}
                <bdi lang="en" dir="ltr">
                  {name} by{" "}
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {author}
                  </a>{" "}
                  (
                  {licenceHref ? (
                    <a href={licenceHref} target="_blank" rel="noopener noreferrer">
                      {licence}
                    </a>
                  ) : (
                    licence
                  )}
                  )
                </bdi>
              </span>
            );
          })}
        </p>
      </div>
    </section>
  );
}
