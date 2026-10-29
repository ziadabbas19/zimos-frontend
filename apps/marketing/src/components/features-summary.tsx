import type { Locale } from "@/i18n/config";
import { HOME_CARD_IDS, getFeatures } from "@/content/features";
import { ColorIcon } from "./color-icon";
import { Arrow } from "./duo-icons";
import { HOME_CARD_SECTION, SECTION_ICON } from "./feature-section";

/**
 * Eight of the features page's sections on the home page, each card opening
 * its section there, and the way to the whole page.
 */
export function FeaturesSummary({ locale }: { locale: Locale }) {
  const { home } = getFeatures(locale);

  return (
    <section className="lz-sec lz-sec--line" id="features" aria-labelledby="lz-fsum">
      <div className="lz-in">
        <header className="lz-head lz-r">
          <span className="lz-eye">{home.kicker}</span>
          <h2 className="lz-h" id="lz-fsum">
            {home.heading}
          </h2>
          <p className="lz-lede">{home.intro}</p>
        </header>

        <ul className="lz-fsum">
          {HOME_CARD_IDS.map((id) => {
            const section = HOME_CARD_SECTION[id];
            return (
              <li key={id} className="lz-r">
                <a className="lz-card lz-fsum__card" href={`/${locale}/features#${section}`}>
                  <span className="lz-ico">
                    <ColorIcon name={SECTION_ICON[section]} size={26} />
                  </span>
                  <h3>{home.cards[id].title}</h3>
                  <p>{home.cards[id].body}</p>
                </a>
              </li>
            );
          })}
        </ul>

        <div className="lz-fsum__more lz-r">
          <a className="lz-btn" href={`/${locale}/features`}>
            {home.cta}
            <Arrow size={18} className="lz-arrow" />
          </a>
        </div>
      </div>
    </section>
  );
}
