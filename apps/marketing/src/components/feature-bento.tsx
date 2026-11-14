import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import { HOME_CARD_IDS, getFeatures, type FeatureSectionId } from "@/content/features";
import { shareOf } from "@/lib/amounts";
import { ColorIcon } from "./color-icon";
import { Arrow, Check } from "./duo-icons";
import { HOME_CARD_SECTION, SECTION_ICON } from "./feature-section";
import { SectionLabel } from "./section-label";

/**
 * Six features, each a card with a small drawing of it: an order's real
 * profit as a sum, the confirmation queue, a shipment's road, the payment
 * methods, an order's risk level and the visual editor. Every card opens its
 * section of /features; under them, the rest of that page's sections as a
 * row of links, and the way to the whole page. The drawings are decoration
 * (aria-hidden): the title and the line above each say the same.
 */
export function FeatureBento({ copy, locale }: { copy: Dictionary["benefits"]; locale: Locale }) {
  const { home } = getFeatures(locale);
  const to = (section: FeatureSectionId) => `/${locale}/features#${section}`;
  const { profit, confirmation, shipping, payments, fraud, editor } = copy;

  return (
    <section className="zx-sec zx-feats" id="benefits" aria-labelledby="zx-feats">
      <div className="lz-in">
        <header className="zx-head lz-r">
          <SectionLabel n="03" text={copy.kicker} />
          <h2 className="zx-h2" id="zx-feats">
            {copy.heading}
          </h2>
          <p className="zx-lede">{copy.intro}</p>
        </header>

        <div className="zx-bento">
          <a className="zx-card zx-card--profit lz-r" href={to("reports")}>
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

          <a className="zx-card lz-r" href={to("orders")}>
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

          <a className="zx-card lz-r" href={to("fraud")}>
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

          <a className="zx-card lz-r" href={to("shipping")}>
            <h3>{shipping.title}</h3>
            <p>{shipping.body}</p>
            <div className="zx-road" aria-hidden>
              <div className="zx-road__code">
                <span>{shipping.trackingLabel}</span>
                <em className="ltr">ZM-4821-3907</em>
              </div>
              <ol>
                {shipping.statuses.map((status, i) => (
                  <li key={status} className={i < 2 ? "is-done" : "is-next"}>
                    <i>{i < 2 ? <Check size={11} /> : null}</i>
                    {status}
                  </li>
                ))}
              </ol>
            </div>
          </a>

          <a className="zx-card lz-r" href={to("payments")}>
            <h3>{payments.title}</h3>
            <p>{payments.body}</p>
            <ul className="zx-pays" aria-hidden>
              {payments.methods.map((method) => (
                <li key={method}>
                  <Check size={12} />
                  {method}
                </li>
              ))}
            </ul>
          </a>

          <a className="zx-card zx-card--wide lz-r" href={to("store")}>
            <div>
              <h3>{editor.title}</h3>
              <p>{editor.body}</p>
            </div>
            <div className="zx-edit" aria-hidden>
              <div className="zx-edit__bar">
                {editor.tools.map((tool, i) => (
                  <span key={tool} className={i === 0 ? "is-on" : undefined}>
                    {tool}
                  </span>
                ))}
                <em>{editor.draft}</em>
                <strong>{editor.publish}</strong>
              </div>
              <div className="zx-edit__canvas">
                <i className="zx-edit__img" />
                <div className="zx-edit__box">
                  <b>{editor.sample}</b>
                  <u />
                  <u />
                </div>
              </div>
            </div>
          </a>
        </div>

        <div className="zx-more lz-r">
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
          <a className="zx-btn zx-btn--ink" href={`/${locale}/features`}>
            {copy.cta}
            <Arrow size={18} className="lz-arrow" />
          </a>
        </div>
      </div>
    </section>
  );
}
