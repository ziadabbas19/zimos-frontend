/* eslint-disable @next/next/no-img-element -- small 3D icons, already sized and compressed. */
import type { CSSProperties } from "react";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import { getPublicOffer } from "@/lib/plans";
import { HomePlans } from "./home-lazy";
import type { Icon3DName } from "./icon-3d";
import { SectionLabel } from "./section-label";

/** A clear subscription, build before you pay, your data, the payment — in that order. */
const POINT_ICON: Icon3DName[] = ["receipt", "tools", "lock", "bank"];

/**
 * What it costs, on the home page itself: the plans on offer with their
 * prices, limits and features, read from the API as the pricing page reads
 * them and read again in the browser on every visit (home-plans.tsx, its
 * own chunk) — so every figure is the platform's own — and a line under
 * them: how payment works, the refund policy and the way to the whole
 * pricing page. Under that, what should reassure a merchant about
 * paying: what is paid for, that the store is built before it is paid for,
 * whose data it is, and how payment works; the last point ends with the
 * refund policy link.
 */
export async function HomePricing({ copy, trust, locale }: { copy: Dictionary["pricing"]; trust: Dictionary["trust"]; locale: Locale }) {
  const offer = await getPublicOffer();
  const last = trust.points.length - 1;

  return (
    <section className="zm-sec zm-sec--tight zm-pricing" id="pricing" aria-labelledby="zm-pricing" data-section="pricing">
      <div className="zm-in">
        <header className="zm-sh rv">
          <SectionLabel n="07" text={copy.kicker} />
          <h2 id="zm-pricing">{copy.heading}</h2>
          <p>{copy.intro}</p>
        </header>

        <div className="zm-pwrap zp rv">
          <HomePlans initial={offer} copy={copy} locale={locale} />
        </div>

        {/* How payment works, the refund policy, and every plan on the pricing page. */}
        <p className="zm-pnote rv">
          {copy.paymentNote} <Link href={`/${locale}/refund-policy`}>{copy.refundLink}</Link>.{" "}
          <Link href={`/${locale}/pricing`}>{copy.seeAll}</Link>
        </p>

        <div className="zm-trust">
          {trust.points.map((point, i) => (
            <article key={point.title} className="zm-tp rv" style={{ "--d": i } as CSSProperties}>
              <img className="zm-i3" src={`/icons/3d/${POINT_ICON[i]}.webp`} width={48} height={48} alt="" loading="lazy" decoding="async" />
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
