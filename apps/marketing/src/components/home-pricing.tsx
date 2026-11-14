import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import { getPublicOffer } from "@/lib/plans";
import { Icon3D, type Icon3DName } from "./icon-3d";
import { Arrow } from "./duo-icons";
import { PlanCards } from "./plan-cards";
import { SectionLabel } from "./section-label";

/** A clear subscription, build before you pay, your data, the payment — in that order. */
const POINT_ICON: Icon3DName[] = ["receipt", "tools", "lock", "bank"];

/**
 * What it costs, on the home page itself: the plans on offer, read from the
 * API as the pricing page reads them (lib/plans.ts) — so every figure is the
 * platform's own — with the way to the whole pricing page. While the API
 * sends none, the way to that page stands alone. Under them, what should
 * reassure a merchant about paying: what is paid for, that the store is
 * built before it is paid for, whose data it is, and how payment works; the
 * last point ends with the refund policy link.
 */
export async function HomePricing({ copy, trust, locale }: { copy: Dictionary["pricing"]; trust: Dictionary["trust"]; locale: Locale }) {
  const offer = await getPublicOffer();
  const plans = offer?.plans ?? [];
  const payPerOrder = offer?.payPerOrder ?? null;
  const last = trust.points.length - 1;

  return (
    <section className="zx-sec zx-pricing" id="pricing" aria-labelledby="zx-pricing" data-section="pricing">
      <div className="lz-in">
        <header className="zx-head zx-head--center lz-r">
          <SectionLabel n="07" text={copy.kicker} />
          <h2 className="zx-h2" id="zx-pricing">
            {copy.heading}
          </h2>
          <p className="zx-lede">{copy.intro}</p>
        </header>

        {plans.length > 0 || payPerOrder ? (
          <div className="zx-pricing__plans lz-r">
            <PlanCards plans={plans} payPerOrder={payPerOrder} copy={copy} locale={locale} idPrefix="home-pricing" compact />
          </div>
        ) : null}

        <p className="zx-pricing__all lz-r">
          <Link className="zx-btn zx-btn--line" href={`/${locale}/pricing`}>
            {copy.seeAll}
            <Arrow size={18} className="lz-arrow" />
          </Link>
        </p>

        <div className="zx-points lz-r">
          {trust.points.map((point, i) => (
            <article key={point.title}>
              <Icon3D name={POINT_ICON[i]} size={52} />
              <h3>{point.title}</h3>
              <p>
                {point.body}
                {i === last ? (
                  <>
                    {" "}
                    <Link href={`/${locale}/refund-policy`}>{trust.refundLink}</Link>.
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
