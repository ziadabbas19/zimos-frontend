import type { Dictionary } from "@/i18n/dictionary";
import { ColorIcon, type ColorIconName } from "./color-icon";

/** What you buy, what it includes, how you pay, your data — in that order. */
const POINT_ICON: ColorIconName[] = ["receipt", "store", "vault", "lock"];

/**
 * What ZIMOS is and what is sold, in plain words: a SaaS platform for
 * building online stores, paid for as a monthly or yearly subscription —
 * or per order, while the pricing page shows that plan (`payPerOrder`).
 * Under the prices on the pricing page.
 */
export function Service({ copy, payPerOrder = false }: { copy: Dictionary["service"]; payPerOrder?: boolean }) {
  return (
    <section className="lz-sec lz-sec--line" id="service" aria-labelledby="service-heading">
      <div className="lz-in">
        <header className="lz-head lz-head--center lz-r">
          <span className="lz-eye">{copy.kicker}</span>
          <h2 className="lz-h" id="service-heading">
            {copy.heading}
          </h2>
          <p className="lz-lede">{payPerOrder ? copy.bodyWithPayPerOrder : copy.body}</p>
        </header>

        <div className="lz-trust lz-r">
          {copy.points.map((point, i) => {
            return (
              <article key={point.title}>
                <span className="lz-ico">
                  <ColorIcon name={POINT_ICON[i]} size={28} />
                </span>
                <h3>{point.title}</h3>
                <p>{payPerOrder && point.withPayPerOrder ? point.withPayPerOrder : point.body}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
