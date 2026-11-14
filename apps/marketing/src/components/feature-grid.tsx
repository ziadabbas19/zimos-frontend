import type { Locale } from "@/i18n/config";
import { HOME_CARD_IDS, getFeatures, type HomeCardId } from "@/content/features";
import { REGISTER_URL } from "@/lib/urls";
import { Arrow } from "./duo-icons";
import { HOME_CARD_SECTION } from "./feature-section";
import { Icon3D, type Icon3DName } from "./icon-3d";
import { SectionLabel } from "./section-label";

/** Each card's picture. */
const CARD_ICON: Record<HomeCardId, Icon3DName> = {
  orders: "receipt",
  shipping: "truck",
  payments: "card",
  fraud: "shield",
  marketing: "megaphone",
  store: "store",
  reports: "chart",
  loyalty: "crown",
};

/**
 * What a merchant gets, said plainly: eight of the features page's sections
 * as cards — a picture, the name, one line — each opening its section of
 * /features, then the way to the whole page and the way in. The words are
 * the features page's own summary (content/features, `home`).
 */
export function FeatureGrid({ locale, startCta }: { locale: Locale; startCta: string }) {
  const { home } = getFeatures(locale);

  return (
    <section className="zx-sec zx-feats" id="benefits" aria-labelledby="zx-feats">
      <div className="lz-in">
        <header className="zx-head zx-head--center lz-r">
          <SectionLabel n="02" text={home.kicker} />
          <h2 className="zx-h2" id="zx-feats">
            {home.heading}
          </h2>
          <p className="zx-lede">{home.intro}</p>
        </header>

        <ul className="zx-feats__grid">
          {HOME_CARD_IDS.map((id) => (
            <li key={id} className="lz-r">
              <a className="zx-feat" href={`/${locale}/features#${HOME_CARD_SECTION[id]}`}>
                <Icon3D name={CARD_ICON[id]} size={64} />
                <h3>{home.cards[id].title}</h3>
                <p>{home.cards[id].body}</p>
                <Arrow size={16} className="lz-arrow zx-feat__go" />
              </a>
            </li>
          ))}
        </ul>

        <div className="zx-feats__acts lz-r">
          <a className="zx-btn zx-btn--ink" href={REGISTER_URL}>
            {startCta}
            <Arrow size={18} className="lz-arrow" />
          </a>
          <a className="zx-btn zx-btn--line" href={`/${locale}/features`}>
            {home.cta}
            <Arrow size={18} className="lz-arrow" />
          </a>
        </div>
      </div>
    </section>
  );
}
