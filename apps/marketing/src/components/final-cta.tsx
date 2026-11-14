/* eslint-disable @next/next/no-img-element -- the photograph is already sized and compressed for the page. */
import type { Dictionary } from "@/i18n/dictionary";
import { LOGIN_URL, REGISTER_URL } from "@/lib/urls";
import { Backdrop } from "./backdrop";
import { Arrow } from "./duo-icons";

/**
 * The night-blue closing band: the last push, the way in and the way back
 * for those who already have an account, the words in the middle. On the
 * home page (`photo`) it stands over a photograph of an order being handed
 * over (public/photos), darkened so the words read; elsewhere (the features
 * page) over the moving ground of components/backdrop.tsx.
 */
export function FinalCta({ copy, photo = false }: { copy: Dictionary["finalCta"]; photo?: boolean }) {
  return (
    <section className="lz-sec" aria-labelledby="final-cta-heading" data-section="final-cta">
      <div className="lz-in">
        <div className={photo ? "lz-end lz-end--photo lz-r" : "lz-end lz-r"}>
          {photo ? (
            <img
              className="lz-end__photo"
              src="/photos/parcel-handover-1600.webp"
              srcSet="/photos/parcel-handover-800.webp 800w, /photos/parcel-handover-1600.webp 1600w"
              sizes="(min-width: 1280px) 1216px, 100vw"
              width={1600}
              height={800}
              alt=""
              loading="lazy"
              decoding="async"
            />
          ) : (
            <Backdrop id="lz-wave-end" />
          )}
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
