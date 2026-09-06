import type { Dictionary, FeatureStage } from "@/i18n/dictionary";
import { PhoneIcon, RepeatIcon, StorefrontIcon } from "./icons";

/**
 * The three moments a merchant lives through, strung along one path — the
 * same rail idea as the hero's order lifecycle, turned horizontal. It is a
 * real sequence (set up -> sell -> aftercare), so it renders as an ordered
 * list; the middle moment does the most work, so it gets the wider column
 * and a framed panel while the two ends sit open on the section.
 */

const STAGE_ICON: Record<FeatureStage["id"], typeof PhoneIcon> = {
  setup: StorefrontIcon,
  order: PhoneIcon,
  aftercare: RepeatIcon,
};

export function Features({ copy }: { copy: Dictionary["features"] }) {
  return (
    <section id="features" className="border-t border-line bg-paper-raised">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-sm font-medium text-primary-dark">
            <span aria-hidden className="h-px w-6 bg-accent-dark" />
            {copy.kicker}
          </p>
          <h2 className="mt-4 text-3xl font-semibold text-balance sm:text-4xl">
            {copy.heading}
          </h2>
          <p className="mt-4 text-lg text-pretty text-ink-soft">{copy.intro}</p>
        </div>

        <div className="relative mt-14 lg:mt-16">
          {/* The connecting rail. Block-axis position isn't mirrored by `dir`;
              the inline inset is logical and lines up with the two end nodes.
              Shown from lg up, where the stages sit side by side. */}
          <span
            aria-hidden
            className="absolute start-[14%] end-[14%] top-[1.375rem] hidden h-px bg-line lg:block"
          />

          <ol className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.25fr)_minmax(0,0.9fr)] lg:gap-8">
            {copy.stages.map((stage) => {
              const Icon = STAGE_ICON[stage.id];
              const primary = stage.id === "order";
              return (
                <li key={stage.id} className="relative flex flex-col">
                  <span
                    className={`relative z-10 mb-5 flex size-11 items-center justify-center rounded-full border ${
                      primary
                        ? "border-primary bg-primary text-white"
                        : "border-line bg-paper-raised text-primary-dark"
                    }`}
                  >
                    <Icon width="1.25rem" height="1.25rem" />
                  </span>

                  <div
                    className={
                      primary
                        ? "flex-1 rounded-[var(--radius-card)] border border-line bg-paper p-6"
                        : "flex-1 pe-2"
                    }
                  >
                    <h3 className="text-xl font-semibold text-balance">{stage.title}</h3>
                    <p className="mt-2 text-pretty text-ink-soft">{stage.summary}</p>

                    <ul className="mt-4 space-y-2.5">
                      {stage.points.map((point) => (
                        <li
                          key={point}
                          className="flex gap-3 text-sm leading-relaxed text-ink-soft"
                        >
                          <span
                            aria-hidden
                            className="mt-2 h-px w-3 shrink-0 bg-accent-dark"
                          />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
