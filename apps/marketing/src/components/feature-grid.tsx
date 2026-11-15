/* eslint-disable @next/next/no-img-element -- small 3D icons, already sized and compressed. */
import type { CSSProperties } from "react";
import type { Locale } from "@/i18n/config";
import { HOME_CARD_IDS, getFeatures, type HomeCardId } from "@/content/features";
import { REGISTER_URL } from "@/lib/urls";
import { Arrow } from "./duo-icons";
import { HOME_CARD_SECTION } from "./feature-section";
import type { Icon3DName } from "./icon-3d";
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
 * /features, then the way in and the way to the whole page. The words are
 * the features page's own summary (content/features, `home`). A light
 * follows the pointer over a card (`.zm-spot`, home-effects.tsx).
 */
export function FeatureGrid({ locale, startCta }: { locale: Locale; startCta: string }) {
  const { home } = getFeatures(locale);

  return (
    <section className="zm-sec zm-sec--tight" id="benefits" aria-labelledby="zm-feats" data-section="features">
      <div className="zm-in">
        <header className="zm-sh rv">
          <SectionLabel n="02" text={home.kicker} />
          <h2 id="zm-feats">{home.heading}</h2>
          <p>{home.intro}</p>
        </header>

        <ul className="zm-fgrid">
          {HOME_CARD_IDS.map((id, i) => (
            <li key={id} className="rv" style={{ "--d": i % 4 } as CSSProperties}>
              <a className="zm-fc zm-spot" href={`/${locale}/features#${HOME_CARD_SECTION[id]}`}>
                <Arrow size={18} className="zm-go" />
                <img className="zm-i3" src={`/icons/3d/${CARD_ICON[id]}.webp`} width={64} height={64} alt="" loading="lazy" decoding="async" />
                <h3>{home.cards[id].title}</h3>
                <p>{home.cards[id].body}</p>
              </a>
            </li>
          ))}
        </ul>

        <div className="zm-ctas rv">
          <a className="zm-btn zm-btn--blue" href={REGISTER_URL} data-mag="">
            {startCta}
            <Arrow size={18} className="zm-arr" />
          </a>
          <a className="zm-btn zm-btn--line" href={`/${locale}/features`} data-mag="">
            {home.cta}
            <Arrow size={18} className="zm-arr" />
          </a>
        </div>
      </div>
    </section>
  );
}
