/**
 * Shared class recipes for the storefront's default visual language: raised
 * paper surfaces, rounded-2xl cards, hairline borders, generous spacing. Every
 * colour is a semantic token from globals.css, so merchant branding
 * (.brand-theme) flows through and light/dark flips without `dark:` variants.
 * Tap targets are ≥ 44px (min-h-11).
 */

const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export const btnPrimary = `inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 ${focus}`;

export const btnPrimaryLg = `${btnPrimary} w-full text-base py-3.5`;

export const btnSecondary = `inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-paper-raised px-5 py-3 text-sm font-semibold text-ink transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60 ${focus}`;

export const btnGhost = `inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary-soft ${focus}`;

export const iconBtn = `relative inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-line bg-paper-raised text-ink transition-colors hover:border-primary hover:text-primary ${focus}`;

export const card = "rounded-2xl border border-line bg-paper-raised";

export const input =
  "block w-full min-h-11 rounded-xl border border-line-strong bg-paper-raised px-3.5 py-2.5 text-base text-ink placeholder:text-ink-soft outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/10";

export const label = "mb-1.5 block text-sm font-medium text-ink";

export const sectionTitle = "text-lg font-semibold text-ink";

export const container = "mx-auto w-full max-w-6xl px-4 sm:px-6";

/** A loading placeholder block; size it at the call site. Holds still under reduced motion. */
export const skeleton = "animate-pulse rounded-xl bg-line/60 motion-reduce:animate-none";
