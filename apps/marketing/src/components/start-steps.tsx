/* eslint-disable @next/next/no-img-element -- small 3D icons, already sized and compressed. */
import type { CSSProperties } from "react";
import type { Dictionary } from "@/i18n/dictionary";
import { REGISTER_URL } from "@/lib/urls";
import { Arrow } from "./duo-icons";
import type { Icon3DName } from "./icon-3d";
import { SectionLabel } from "./section-label";

/** An account, the products and the brand, the store going live. */
const STEP_ICON: Icon3DName[] = ["memo", "palette", "rocket"];

/**
 * Three steps to a live store, each a card with its number large and faint
 * behind it and its picture bobbing; a line runs through the three as the
 * section comes into view.
 */
export function StartSteps({ copy }: { copy: Dictionary["start"] }) {
  return (
    <section className="zm-sec zm-sec--tight" id="start" aria-labelledby="zm-start" data-section="start">
      <div className="zm-in">
        <header className="zm-sh zm-sh--split rv">
          <div>
            <SectionLabel n="03" text={copy.kicker} />
            <h2 id="zm-start">{copy.heading}</h2>
          </div>
          <div className="zm-ctas">
            <a className="zm-btn zm-btn--blue" href={REGISTER_URL} data-mag="">
              {copy.cta}
              <Arrow size={18} className="zm-arr" />
            </a>
          </div>
        </header>

        <div className="zm-steps-wrap">
          <i className="zm-stepline rv" aria-hidden />
          <ol className="zm-steps">
            {copy.steps.map((step, i) => (
              <li key={step.title} className="zm-step rv" style={{ "--d": i } as CSSProperties}>
                <em className="n ltr" aria-hidden>
                  {i + 1}
                </em>
                <img className="zm-i3" src={`/icons/3d/${STEP_ICON[i]}.webp`} width={64} height={64} alt="" loading="lazy" decoding="async" />
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
