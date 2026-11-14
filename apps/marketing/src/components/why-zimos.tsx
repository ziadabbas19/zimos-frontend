import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import { HOME_CARD_IDS, getFeatures, type FeatureSectionId } from "@/content/features";
import { shareOf } from "@/lib/amounts";
import { REGISTER_URL } from "@/lib/urls";
import { ColorIcon } from "./color-icon";
import { Arrow, Check } from "./duo-icons";
import { HOME_CARD_SECTION, SECTION_ICON } from "./feature-section";
import { SectionLabel } from "./section-label";

/**
 * Why ZIMOS, as a merchant would ask it: the three places selling with cash
 * on delivery loses its profit — an order shipped and refused, a fake order,
 * sales whose net nobody knows — each as what goes wrong, in the warning
 * colour, then what ZIMOS does about it, with a small drawing of it. Every
 * card opens its section of /features; under them the rest of that page's
 * sections as a row of links, the way in, and the way to the whole page.
 * The drawings are decoration (aria-hidden): the words above each say the same.
 */
export function WhyZimos({ copy, locale }: { copy: Dictionary["benefits"]; locale: Locale }) {
  const { home } = getFeatures(locale);
  const to = (section: FeatureSectionId) => `/${locale}/features#${section}`;
  const { confirmation, fraud, profit } = copy;
  const pain = (text: string) => (
    <p className="zx-pain__was">
      <b>{copy.painLabel}</b>
      {text}
    </p>
  );

  return (
    <section className="zx-sec zx-why" id="benefits" aria-labelledby="zx-why">
      <div className="lz-in">
        <header className="zx-head lz-r">
          <SectionLabel n="02" text={copy.kicker} />
          <h2 className="zx-h2" id="zx-why">
            {copy.heading}
          </h2>
          <p className="zx-lede">{copy.intro}</p>
        </header>

        <div className="zx-pains">
          <a className="zx-pain lz-r" href={to("orders")}>
            {pain(confirmation.pain)}
            <h3>{confirmation.title}</h3>
            <p>{confirmation.body}</p>
            <div className="zx-queue" aria-hidden>
              <div className="zx-queue__head">
                <span>{confirmation.nextCall}</span>
                <em className="ltr">#1042</em>
              </div>
              <div className="zx-queue__meta">
                <span>{confirmation.attempt}</span>
                <span>{confirmation.lastOutcome}</span>
              </div>
              <div className="zx-queue__acts">
                {confirmation.outcomes.map((outcome, i) => (
                  <span key={outcome} className={i === 0 ? "is-go" : undefined}>
                    {i === 0 ? <Check size={12} /> : null}
                    {outcome}
                  </span>
                ))}
              </div>
            </div>
          </a>

          <a className="zx-pain lz-r" href={to("fraud")}>
            {pain(fraud.pain)}
            <h3>{fraud.title}</h3>
            <p>{fraud.body}</p>
            <div className="zx-risk" aria-hidden>
              <small>{fraud.riskLabel}</small>
              <div className="zx-risk__meter">
                {fraud.levels.map((level, i) => (
                  <span key={level} className={i === 2 ? "is-on" : undefined}>
                    {level}
                  </span>
                ))}
              </div>
              <div className="zx-risk__why">
                {fraud.reasons.map((reason) => (
                  <span key={reason}>{reason}</span>
                ))}
              </div>
            </div>
          </a>

          <a className="zx-pain lz-r" href={to("reports")}>
            {pain(profit.pain)}
            <h3>{profit.title}</h3>
            <p>{profit.body}</p>
            <div className="zx-sum" aria-hidden>
              <small>{profit.example}</small>
              {profit.rows.map((row, i) => (
                <div key={row.label} className={i === 0 ? "zx-sum__row is-whole" : "zx-sum__row"} style={shareOf(row, profit.rows[0])}>
                  <span>{row.label}</span>
                  <b className="ltr">{row.value}</b>
                  <i />
                </div>
              ))}
              <div className="zx-sum__net">
                <span>{profit.net.label}</span>
                <b>
                  <span className="ltr">{profit.net.value}</span> <small>{profit.currency}</small>
                </b>
              </div>
            </div>
          </a>
        </div>

        <div className="zx-more lz-r">
          <div className="zx-more__also">
            <span>{copy.alsoLabel}</span>
            <ul>
              {HOME_CARD_IDS.map((id) => {
                const section = HOME_CARD_SECTION[id];
                return (
                  <li key={id}>
                    <a href={to(section)}>
                      <ColorIcon name={SECTION_ICON[section]} size={18} />
                      {home.cards[id].title}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="zx-more__acts">
            <a className="zx-btn zx-btn--ink" href={REGISTER_URL}>
              {copy.startCta}
              <Arrow size={18} className="lz-arrow" />
            </a>
            <a className="lz-link" href={`/${locale}/features`}>
              {copy.cta}
              <Arrow size={18} className="lz-arrow" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
