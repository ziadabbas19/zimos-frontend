import { yearlyBreakdown, yearlySaves } from "@store-builder/ui/plan-pricing";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import { formatDays, formatNumber, formatOrderCount, formatPrice } from "@/lib/format";
import type { PayPerOrderPlan, PublicPlan } from "@/lib/plans";
import { REGISTER_URL, registerUrlFor, registerUrlForPayPerOrder } from "@/lib/urls";
import { CheckIcon } from "./icons";
import { btnPrimary, btnSecondary } from "./ui";

type Copy = Dictionary["pricing"];

// Written out whole so Tailwind sees them: shown while monthly is chosen (the
// default), and while yearly is — keyed on the `cycle-yearly` input inside
// the same `group/pricing`.
const WHEN_MONTHLY = "group-has-[.cycle-yearly:checked]/pricing:hidden";
const WHEN_YEARLY_BLOCK = "hidden group-has-[.cycle-yearly:checked]/pricing:block";

/** The button on a blue plan card: white, the blue its text. */
const btnOnBlue =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-white font-semibold text-[#0b46cc] shadow-sm transition-colors duration-200 hover:bg-white/90 active:bg-white/80";

/** How many of a plan's features a phone shows before "show all". */
export const FEATURES_FIRST = 6;

/**
 * The plans as cards, rendered on the server: every price — monthly and
 * yearly — is in the page's HTML, so a reader, a payment provider's reviewer
 * or a search engine sees them without JavaScript. The monthly/yearly switch
 * is two radio buttons and CSS (`group-has-[…:checked]`), so it works without
 * JavaScript too. Each "Subscribe" goes to the dashboard's sign-up with the
 * plan and the cycle chosen.
 *
 * Under a yearly price: twelve monthly payments struck out (only while the
 * yearly price is less) and what the year comes to a month — both from the
 * plan's two prices, so a price changed in the console changes them too.
 *
 * The plans' cards are ZIMOS blue (landing.css `.plan-card`), white type on
 * them, so they stand out on the page; the pay-per-order card is a soft blue.
 * With exactly three plans the middle one, by its place in the console's
 * order, carries the "Most popular" badge, a light ring and, on a computer,
 * stands a little forward (`.plan-card--hot`), as on the home page.
 *
 * `compact` leaves out the limits and features. The home page and the pricing
 * page both show everything (components/live-plans.tsx keeps it current).
 *
 * `payPerOrder`, when the API sends that plan, is one more card, last: beside
 * the others while there are fewer than three, a wide one under them after.
 */
export function PlanCards({
  plans,
  payPerOrder = null,
  copy,
  locale,
  idPrefix,
  compact = false,
  headingLevel = 3,
}: {
  plans: PublicPlan[];
  payPerOrder?: PayPerOrderPlan | null;
  copy: Copy;
  locale: Locale;
  /** Unique per instance on a page: the switch's inputs are found by id. */
  idPrefix: string;
  compact?: boolean;
  /** 2 on the pricing page, under its h1; 3 in the home page's pricing section. */
  headingLevel?: 2 | 3;
}) {
  const PlanHeading = headingLevel === 2 ? "h2" : "h3";
  const monthlyId = `${idPrefix}-monthly`;
  const yearlyId = `${idPrefix}-yearly`;
  const limit = (value: number | null) => (value === null ? copy.unlimited : formatNumber(value, locale));
  const showYearly = plans.some((plan) => plan.yearlyPrice > 0);
  const saves = yearlySaves(plans);
  // The features the console switched on, in its order, each by the name this
  // site gives it. A key the site has no name for yet (one added to the
  // platform after this page) is left out rather than shown as a raw key.
  const named = (features: readonly string[]) => features.filter((key): key is keyof Copy["features"] => key in copy.features);
  const cards = plans.length + (payPerOrder ? 1 : 0);
  // The middle of three subscription plans, by its place in the list (pay per order is not one of them).
  const hot = plans.length === 3 ? 1 : -1;

  return (
    <div className="group/pricing">
      {showYearly ? (
        <fieldset className="mx-auto flex w-fit rounded-full border border-line bg-paper-raised p-1">
          <legend className="sr-only">{copy.billingCycle}</legend>
          <label
            htmlFor={monthlyId}
            className="flex min-h-11 cursor-pointer items-center rounded-full px-5 text-sm font-semibold text-ink-soft transition-colors has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/50"
          >
            <input id={monthlyId} type="radio" name={`${idPrefix}-cycle`} defaultChecked className="sr-only" />
            {copy.monthly}
          </label>
          <label
            htmlFor={yearlyId}
            className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-5 text-sm font-semibold text-ink-soft transition-colors has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/50"
          >
            <input id={yearlyId} type="radio" name={`${idPrefix}-cycle`} className="cycle-yearly sr-only" />
            {copy.yearly}
            {/* The space is for the label's name ("Yearly · Save"); the flex gap does the spacing. */}
            {saves ? (
              <>
                {" "}
                <span className="text-xs font-medium opacity-80">· {copy.yearlySave}</span>
              </>
            ) : null}
          </label>
        </fieldset>
      ) : null}

      <ul className={`mx-auto mt-10 grid max-w-6xl gap-4 lg:gap-6 ${cards >= 3 ? "lg:grid-cols-3" : cards === 2 ? "md:grid-cols-2 md:max-w-4xl" : "max-w-md"}`}>
        {plans.map((plan, i) => {
          const free = plan.monthlyPrice === 0;
          const whenMonthly = showYearly ? WHEN_MONTHLY : "";
          const yearly = yearlyBreakdown(plan);
          return (
            <li
              key={plan.id}
              aria-labelledby={`${idPrefix}-plan-${plan.id}`}
              className={`plan-card relative flex flex-col overflow-hidden rounded-3xl p-6 text-white sm:p-8${i === hot ? " plan-card--hot" : ""}`}
            >
              {/* The badge beside the name, on the same row; a long name pushes it to the next one, never under it. */}
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <PlanHeading id={`${idPrefix}-plan-${plan.id}`} className="text-xl font-bold text-white">
                  {plan.name}
                </PlanHeading>
                {i === hot ? (
                  <span className="shrink-0 whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs font-bold text-primary-dark">{copy.mostPopular}</span>
                ) : null}
              </div>

              <div className="mt-4">
                {free ? (
                  <p className="text-3xl font-bold text-white">{copy.free}</p>
                ) : (
                  <>
                    <div className={whenMonthly}>
                      <p className="text-3xl font-bold text-white">
                        {formatPrice(plan.monthlyPrice, plan.currency, locale)}{" "}
                        <span className="text-base font-medium text-white/75">{copy.perMonth}</span>
                      </p>
                      {showYearly ? (
                        <p className="mt-1 text-sm text-white/75">
                          {copy.yearlyEquivalent.replace("{price}", formatPrice(plan.yearlyPrice, plan.currency, locale))}
                        </p>
                      ) : null}
                    </div>
                    {showYearly ? (
                      <div className={WHEN_YEARLY_BLOCK}>
                        <p className="text-3xl font-bold text-white">
                          {formatPrice(plan.yearlyPrice, plan.currency, locale)}{" "}
                          <span className="text-base font-medium text-white/75">{copy.perYear}</span>
                        </p>
                        {yearly?.fullYear != null ? (
                          <p className="mt-1.5 text-base font-medium text-white/70">
                            <span className="sr-only">{copy.fullYearLabel} </span>
                            <s className="line-through decoration-2">{formatPrice(yearly.fullYear, plan.currency, locale)}</s>
                          </p>
                        ) : null}
                        {yearly ? (
                          <p className="mt-0.5 text-sm text-white/75">
                            {copy.perMonthEquivalent.replace("{price}", formatPrice(yearly.perMonth, plan.currency, locale))}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                )}
                {/* A trial is said only when the console gives a plan one: with none on offer, a line on every card saying so is noise. */}
                {plan.trialDays > 0 ? (
                  <p className="mt-2 text-sm font-semibold text-white">
                    {copy.trial.replace("{days}", formatDays(plan.trialDays, locale))}
                  </p>
                ) : null}
              </div>

              {/* A free plan has one button, whichever cycle is chosen. */}
              <div className={`mt-6 ${free ? "" : whenMonthly}`}>
                <a href={registerUrlFor(plan.id, "monthly")} className={`${btnOnBlue} h-11 w-full px-5 text-sm`}>
                  {copy.cta}
                </a>
              </div>
              {showYearly && !free ? (
                <div className={`mt-6 ${WHEN_YEARLY_BLOCK}`}>
                  <a href={registerUrlFor(plan.id, "yearly")} className={`${btnOnBlue} h-11 w-full px-5 text-sm`}>
                    {copy.ctaYearly}
                  </a>
                </div>
              ) : null}

              {compact ? null : (
                <>
                  <dl className="mt-6 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 border-t border-white/20 pt-6 text-sm">
                    <dt className="text-white/75">{copy.stores}</dt>
                    <dd className="text-end font-semibold text-white">{limit(plan.maxStores)}</dd>
                    <dt className="text-white/75">{copy.funnels}</dt>
                    <dd className="text-end font-semibold text-white">{limit(plan.maxFunnelsPerMonth)}</dd>
                    {plan.softOrderQuota !== null ? (
                      <>
                        <dt className="text-white/75">{copy.orders}</dt>
                        <dd className="text-end font-semibold text-white">{formatNumber(plan.softOrderQuota, locale)}</dd>
                      </>
                    ) : null}
                  </dl>
                  {named(plan.features).length > 0 ? (
                    <ul className="plan-features mt-6 space-y-3 border-t border-white/20 pt-6">
                      {named(plan.features).map((feature) => (
                        <li key={feature} className="flex gap-3 text-sm text-white/90">
                          <CheckIcon width="1.1rem" height="1.1rem" className="mt-px shrink-0 text-[#9fe3ff]" />
                          <span className="leading-relaxed">{copy.features[feature]}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {/* On a phone a long list stops at six, the rest one tap away (landing.css `.plan-more`); a computer shows it whole. */}
                  {named(plan.features).length > FEATURES_FIRST ? (
                    <label className="plan-more">
                      <input type="checkbox" className="plan-more__box sr-only" />
                      {copy.moreFeatures.replace("{n}", String(named(plan.features).length - FEATURES_FIRST))}
                    </label>
                  ) : null}
                </>
              )}
            </li>
          );
        })}
        {payPerOrder ? (
          <PayPerOrderCard
            plan={payPerOrder}
            copy={copy}
            locale={locale}
            idPrefix={idPrefix}
            PlanHeading={PlanHeading}
            wide={plans.length >= 3}
          />
        ) : null}
      </ul>
    </div>
  );
}

/**
 * The pay-per-order plan: its fee for one order and the free orders a store
 * starts with, both from the plan; when the fee is taken, as the API says;
 * a balance that never expires (the API's wallet has no expiry). Its button
 * goes to the same sign-up, and the plan is chosen in My Plan after it.
 * `wide` spans the grid's row, the facts beside the price from `lg` up.
 */
function PayPerOrderCard({
  plan,
  copy,
  locale,
  idPrefix,
  PlanHeading,
  wide,
}: {
  plan: PayPerOrderPlan;
  copy: Copy;
  locale: Locale;
  idPrefix: string;
  PlanHeading: "h2" | "h3";
  wide: boolean;
}) {
  const t = copy.payPerOrder;
  const headingId = `${idPrefix}-plan-${plan.id}`;
  const facts = [plan.feeChargedAt === "confirmation" ? t.feeAtConfirmation : t.feeAtPlacement, t.noExpiry, t.topUp];

  return (
    <li
      aria-labelledby={headingId}
      className={`relative flex flex-col overflow-hidden rounded-3xl border border-primary/25 bg-primary-soft p-6 sm:p-8 ${wide ? "col-span-full lg:grid lg:grid-cols-2 lg:items-center lg:gap-x-10" : ""}`}
    >
      <div>
        <p className="inline-flex rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">{t.badge}</p>
        <PlanHeading id={headingId} className="mt-3 text-xl font-bold text-ink">
          {plan.name}
        </PlanHeading>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t.tagline}</p>

        <div className="mt-4">
          <p className="text-3xl font-bold text-ink">
            {formatPrice(plan.feePerOrder, plan.currency, locale)}{" "}
            <span className="text-base font-medium text-ink-soft">{t.perOrder}</span>
          </p>
          {plan.freeOrders > 0 ? (
            <p className="mt-2 text-sm font-medium text-primary-dark dark:text-primary">
              {t.freeOrders.replace("{orders}", formatOrderCount(plan.freeOrders, locale))}
            </p>
          ) : null}
        </div>

        <div className="mt-6">
          <a href={registerUrlForPayPerOrder(plan.id)} className={`${btnPrimary} h-11 w-full px-5 text-sm ${wide ? "lg:w-auto lg:min-w-56" : ""}`}>
            {t.cta}
          </a>
          <p className="mt-3 text-xs leading-relaxed text-ink-soft">{t.howToChoose}</p>
        </div>
      </div>

      <ul className={`mt-6 space-y-3 border-t border-primary/20 pt-6 ${wide ? "lg:mt-0 lg:border-t-0 lg:border-s lg:pt-0 lg:ps-10" : ""}`}>
        {facts.map((fact) => (
          <li key={fact} className="flex gap-3 text-sm text-ink-soft">
            <CheckIcon width="1.1rem" height="1.1rem" className="mt-px shrink-0 text-primary" />
            <span className="leading-relaxed">{fact}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}

/** The plans are not published yet (or the API is out of reach): said kindly, never as an error. */
export function PricesComingSoon({ copy }: { copy: Copy }) {
  return (
    <div className="mx-auto mt-10 max-w-xl rounded-3xl border border-line bg-paper-raised p-8 text-center">
      <p className="text-xl font-bold text-ink">{copy.comingSoon}</p>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">{copy.comingSoonBody}</p>
      <a href={REGISTER_URL} className={`${btnSecondary} mt-6 h-11 px-5 text-sm`}>
        {copy.comingSoonCta}
      </a>
    </div>
  );
}
