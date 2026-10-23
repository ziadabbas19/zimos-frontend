/* eslint-disable @next/next/no-img-element -- the captures are already sized and compressed for the page. */
import type { Dictionary } from "@/i18n/dictionary";
import { END_LOOKS, STORE_SHOTS } from "@/lib/store-shots";
import { LOGIN_URL, REGISTER_URL } from "@/lib/urls";
import { Backdrop } from "./backdrop";
import { Arrow } from "./duo-icons";

/**
 * The navy closing band: the last push, the way in and the way back for
 * those who already have an account. Its ground moves like the hero's
 * (components/backdrop.tsx), and on the plain side three real stores stand
 * on phones, gently bobbing — decoration only.
 */
export function FinalCta({ copy }: { copy: Dictionary["finalCta"] }) {
  return (
    <section className="lz-sec" aria-labelledby="final-cta-heading">
      <div className="lz-in">
        <div className="lz-end lz-r">
          <Backdrop id="lz-wave-end" />
          <div className="lz-end__phones" aria-hidden>
            {END_LOOKS.map((look) => (
              <span key={look} className="lz-end__phone">
                <img src={STORE_SHOTS[look].phone} width={390} height={1600} alt="" loading="lazy" decoding="async" />
              </span>
            ))}
          </div>
          <div className="lz-end__copy">
            <h2 id="final-cta-heading">{copy.heading}</h2>
            <p>{copy.body}</p>
            <div className="lz-ctas">
              <a className="lz-btn lz-btn--light" href={REGISTER_URL}>
                {copy.primaryCta}
                <Arrow size={18} className="lz-arrow" />
              </a>
              <a className="lz-link lz-link--light" href={LOGIN_URL}>
                {copy.secondaryCta}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
