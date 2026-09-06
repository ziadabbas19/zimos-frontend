import type { Dictionary } from "@/i18n/dictionary";

const REGISTER_URL = "https://app.zimos.co/register";

/**
 * There is no public pricing yet, so this is one calm panel that says so
 * plainly — no invented tiers or comparison table. The single CTA is the
 * same "start your store" action as everywhere else, framed by the copy as
 * free to try during early access.
 */
export function Pricing({
  copy,
  nav,
}: {
  copy: Dictionary["pricing"];
  nav: Dictionary["nav"];
}) {
  return (
    <section id="pricing" className="border-t border-line bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto flex max-w-xl flex-col items-center rounded-[var(--radius-card)] border border-line bg-paper-raised px-6 py-12 text-center shadow-sm sm:px-10">
          <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent-dark">
            <span aria-hidden className="size-1.5 rounded-full bg-accent-dark" />
            {copy.badge}
          </span>

          <h2 className="mt-5 text-3xl font-semibold text-balance sm:text-4xl">
            {copy.heading}
          </h2>
          <p className="mt-4 max-w-md text-pretty text-ink-soft">{copy.body}</p>

          <a
            href={REGISTER_URL}
            className="mt-8 inline-flex h-12 items-center rounded-full bg-primary px-6 text-base font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            {nav.startStore}
          </a>
          <p className="mt-3 text-sm text-ink-soft">{copy.ctaNote}</p>
        </div>
      </div>
    </section>
  );
}
