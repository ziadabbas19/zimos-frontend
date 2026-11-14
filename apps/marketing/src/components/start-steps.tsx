import type { Dictionary } from "@/i18n/dictionary";
import { REGISTER_URL } from "@/lib/urls";
import { ColorIcon, type ColorIconName } from "./color-icon";
import { Arrow } from "./duo-icons";
import { SectionLabel } from "./section-label";

/** An account, the products and the brand, the store going live. */
const STEP_ICON: ColorIconName[] = ["apps", "brush", "send"];

/** Three steps to a live store, each a card with its number large and faint behind it. */
export function StartSteps({ copy }: { copy: Dictionary["start"] }) {
  return (
    <section className="zx-sec zx-start" id="start" aria-labelledby="zx-start">
      <div className="lz-in">
        <header className="zx-head zx-head--split lz-r">
          <div>
            <SectionLabel n="07" text={copy.kicker} />
            <h2 className="zx-h2" id="zx-start">
              {copy.heading}
            </h2>
          </div>
          <a className="zx-btn zx-btn--ink" href={REGISTER_URL}>
            {copy.cta}
            <Arrow size={18} className="lz-arrow" />
          </a>
        </header>

        <ol className="zx-steps">
          {copy.steps.map((step, i) => (
            <li key={step.title} className="zx-step lz-r">
              <span className="zx-step__ico">
                <ColorIcon name={STEP_ICON[i]} size={26} />
              </span>
              <em aria-hidden>{i + 1}</em>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
