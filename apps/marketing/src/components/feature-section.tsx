/* eslint-disable @next/next/no-img-element -- the captures are already sized and compressed for the page. */
import type { Locale } from "@/i18n/config";
import type { FeaturesCopy, FeatureSectionId, HomeCardId } from "@/content/features";
import { ColorIcon, type ColorIconName } from "./color-icon";

export const SECTION_ICON: Record<FeatureSectionId, ColorIconName> = {
  products: "package",
  orders: "receipt",
  shipping: "delivery",
  payments: "card",
  fraud: "shield",
  customers: "gift",
  marketing: "megaphone",
  store: "brush",
  reports: "profit",
  notifications: "bell",
  team: "team",
  developers: "code",
};

/** The section of /features each home-page card opens. */
export const HOME_CARD_SECTION: Record<HomeCardId, FeatureSectionId> = {
  orders: "orders",
  shipping: "shipping",
  payments: "payments",
  fraud: "fraud",
  marketing: "marketing",
  store: "store",
  reports: "reports",
  loyalty: "customers",
};

/** Real dashboard captures (public/product, one per language) under two sections. */
const SECTION_SHOT: Partial<Record<FeatureSectionId, "orders" | "profit">> = {
  orders: "orders",
  reports: "profit",
};

/**
 * One section of /features: its icon, title and line, then a card per
 * feature, and under two of them a real screen of the dashboard. The `data-ft-*`
 * marks are what the bar's search (features-nav.tsx) shows and hides.
 */
export function FeatureSection({ id, copy, locale }: { id: FeatureSectionId; copy: FeaturesCopy; locale: Locale }) {
  const section = copy.sections[id];
  const shot = SECTION_SHOT[id];

  return (
    <section id={id} className="ft-sec" aria-labelledby={`ft-${id}`} data-ft-section>
      <div className="lz-in ft-sec__in">
        <header className="ft-sec__head" data-ft-head>
          <span className="lz-ico">
            <ColorIcon name={SECTION_ICON[id]} size={28} />
          </span>
          <h2 id={`ft-${id}`}>{section.title}</h2>
          <p>{section.intro}</p>
        </header>

        <div className="ft-sec__body">
          <ul className="ft-grid">
            {section.items.map((item) => (
              <li key={item.title} className="ft-card" data-ft-card>
                <ColorIcon name="check" size={18} className="ft-card__tick" />
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              </li>
            ))}
          </ul>

          {shot ? (
            <figure className="ft-shot" data-ft-extra>
              {/* 1440 wide, and the 2880 copy only for a screen that draws it that sharp;
                  `sizes` follows the shot's column (features.css, .ft-sec__in, and .lz-in in landing.css). */}
              <img
                src={`/product/${shot}-${locale}-1440.webp`}
                srcSet={`/product/${shot}-${locale}-1440.webp 1440w, /product/${shot}-${locale}.webp 2880w`}
                sizes="(min-width: 2200px) 1200px, (min-width: 1680px) 980px, (min-width: 1081px) 850px, 100vw"
                width={1440}
                height={900}
                alt={copy.shots[shot]}
                loading="lazy"
                decoding="async"
              />
              <figcaption>{copy.shots.caption}</figcaption>
            </figure>
          ) : null}
        </div>
      </div>
    </section>
  );
}
