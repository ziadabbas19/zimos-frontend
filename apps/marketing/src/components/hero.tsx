import type { Dictionary } from "@/i18n/dictionary";
import { OrderLifecycle } from "./order-lifecycle";

const REGISTER_URL = "https://app.zimos.co/register";

export function Hero({ copy }: { copy: Dictionary["hero"] }) {
  return (
    <section className="mx-auto grid max-w-6xl gap-12 px-4 pt-14 pb-20 sm:px-6 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:items-center lg:gap-16 lg:pt-24">
      <div className="max-w-xl">
        <p className="flex items-center gap-2 text-sm font-medium text-primary-dark">
          <span aria-hidden className="h-px w-6 bg-accent-dark" />
          {copy.kicker}
        </p>

        <h1 className="mt-4 text-4xl font-semibold text-balance sm:text-5xl lg:text-[3.25rem]">
          {copy.headline}
        </h1>

        <p className="mt-5 text-lg text-pretty text-ink-soft">{copy.subheadline}</p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href={REGISTER_URL}
            className="inline-flex h-12 items-center rounded-full bg-primary px-5 text-base font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            {copy.startStore}
          </a>
          <a
            href="#how-it-works"
            className="inline-flex h-12 items-center rounded-full border border-line bg-paper-raised px-5 text-base font-medium text-ink transition-colors hover:border-ink-soft"
          >
            {copy.seeHow}
          </a>
        </div>
      </div>

      <div className="lg:justify-self-end">
        <OrderLifecycle />
      </div>
    </section>
  );
}
