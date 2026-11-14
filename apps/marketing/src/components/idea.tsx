import type { Dictionary } from "@/i18n/dictionary";
import { ColorIcon, type ColorIconName } from "./color-icon";
import { SectionLabel } from "./section-label";

/** What the merchant juggles today: the ad, the call, the parcel. */
const MARKS: ColorIconName[] = ["megaphone", "phone", "delivery"];

/**
 * "The idea", said once in large type: what selling online takes today, in
 * the muted ink, then what ZIMOS does about it, in the full ink — three small
 * tiles between the two. Under it four facts, each a figure over its line.
 */
export function Idea({ copy }: { copy: Dictionary["idea"] }) {
  return (
    <section className="zx-sec zx-idea" id="idea" aria-labelledby="zx-idea">
      <div className="lz-in">
        <SectionLabel n="01" text={copy.kicker} />
        <h2 className="zx-statement lz-r" id="zx-idea">
          <span className="zx-statement__dim">{copy.problem}</span>{" "}
          <span className="zx-statement__marks" aria-hidden>
            {MARKS.map((name) => (
              <i key={name}>
                <ColorIcon name={name} size={20} />
              </i>
            ))}
          </span>{" "}
          {copy.answer}
        </h2>

        <ul className="zx-stats lz-r">
          {copy.stats.map((stat) => (
            <li key={stat.label}>
              <b>{stat.value}</b>
              <span>{stat.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
