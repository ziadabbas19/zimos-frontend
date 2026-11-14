import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import { ColorIcon, type ColorIconName } from "./color-icon";
import { Arrow } from "./duo-icons";
import { SectionLabel } from "./section-label";

/** A clear subscription, build before you pay, your data, the payment — in that order. */
const POINT_ICON: [ColorIconName, string][] = [
  ["receipt", "blue"],
  ["store", "green"],
  ["lock", "violet"],
  ["wallet", "teal"],
];

/**
 * "What should reassure you": what ZIMOS sells and what it doesn't, what a
 * plan costs and how it is paid, and whose data it is — the words on one
 * side, the four points in a ruled grid on the other. The payment point
 * ends with the refund policy link, and the way to the plans stands under
 * the words.
 */
export function Trust({ copy, locale }: { copy: Dictionary["trust"]; locale: Locale }) {
  const last = copy.points.length - 1;

  return (
    <section className="zx-sec zx-trust" id="trust" aria-labelledby="zx-trust">
      <div className="lz-in zx-trust__in">
        <header className="zx-head lz-r">
          <SectionLabel n="08" text={copy.kicker} />
          <h2 className="zx-h2" id="zx-trust">
            {copy.heading}
          </h2>
          <p className="zx-lede">{copy.intro}</p>
          <Link className="zx-btn zx-btn--line" href={`/${locale}/pricing`}>
            {copy.pricingCta}
            <Arrow size={18} className="lz-arrow" />
          </Link>
        </header>

        <div className="zx-points lz-r">
          {copy.points.map((point, i) => (
            <article key={point.title}>
              <span className={`zx-tile zx-tile--${POINT_ICON[i][1]}`}>
                <ColorIcon name={POINT_ICON[i][0]} size={22} fill />
              </span>
              <h3>{point.title}</h3>
              <p>
                {point.body}
                {i === last ? (
                  <>
                    {" "}
                    <Link href={`/${locale}/refund-policy`}>{copy.refundLink}</Link>.
                  </>
                ) : null}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
