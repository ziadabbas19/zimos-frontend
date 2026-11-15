/* eslint-disable @next/next/no-img-element -- the photograph is already sized and compressed for the page. */
import type { Dictionary } from "@/i18n/dictionary";
import { LOGIN_URL, REGISTER_URL } from "@/lib/urls";
import { Arrow } from "./duo-icons";

/**
 * The night-blue closing band over a photograph of an order being handed
 * over (public/photos), darkened so the words read: the last push, the way
 * in and the way back for those who already have an account. Two dashed
 * orbits turn behind the words, and the photograph moves a little slower
 * than the page (home-effects.tsx). No script of its own.
 */
export function HomeFinal({ copy }: { copy: Dictionary["finalCta"] }) {
  return (
    <section className="zm-end" aria-labelledby="final-cta-heading" data-section="final-cta">
      <img
        className="zm-end-photo"
        src="/photos/parcel-handover-1600.webp"
        srcSet="/photos/parcel-handover-800.webp 800w, /photos/parcel-handover-1600.webp 1600w"
        sizes="100vw"
        width={1600}
        height={800}
        alt=""
        loading="lazy"
        decoding="async"
      />
      <span className="zm-orbit zm-orbit--1" aria-hidden>
        <i />
      </span>
      <span className="zm-orbit zm-orbit--2" aria-hidden>
        <i />
      </span>
      <div className="zm-end-c rv">
        <h2 id="final-cta-heading">{copy.heading}</h2>
        <p>{copy.body}</p>
        <div className="zm-ctas">
          <a className="zm-btn zm-btn--volt" href={REGISTER_URL} data-mag="">
            {copy.primaryCta}
            <Arrow size={18} className="zm-arr" />
          </a>
          <a className="zm-btn zm-btn--glass" href={LOGIN_URL} data-mag="">
            {copy.secondaryCta}
          </a>
        </div>
      </div>
    </section>
  );
}
