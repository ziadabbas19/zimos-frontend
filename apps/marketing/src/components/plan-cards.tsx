import { yearlyBreakdown, yearlySaves } from "@store-builder/ui/plan-pricing";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import { formatDays, formatNumber, formatOrderCount, formatPrice, priceParts } from "@/lib/format";
import type { PayPerOrderPlan, PublicPlan } from "@/lib/plans";
import { REGISTER_URL, registerUrlFor, registerUrlForPayPerOrder } from "@/lib/urls";
import { Arrow } from "./duo-icons";
import { CheckIcon } from "./icons";
import { btnSecondary } from "./ui";

type Copy = Dictionary["pricing"];

// Written out whole so Tailwind sees them: shown while monthly is chosen (the
// default), and while yearly is — keyed on the `cycle-yearly` input inside
// the same `group/pricing`.
const WHEN_MONTHLY = "group-has-[.cycle-yearly:checked]/pricing:hidden";
const WHEN_YEARLY_BLOCK = "hidden group-has-[.cycle-yearly:checked]/pricing:block";

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
 * The cards look as on the home page (app/plans.css, inside `.zp`): a large
 * rounded card on a soft gradient, the price large, the limits as chips, the
 * features ticked and the button at the foot, so a row's cards are one
 * height; the pay-per-order card is a soft blue. With exactly three plans
 * the middle one, by its place in the console's order, has the glowing blue
 * edge, the "Most popular" badge over its top edge and the sky button
 * (`.zp-plan--hot`).
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
    <div className="group/pricing zp">
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

      {/* Below a computer's width the cards stand one under the other at a width that reads. */}
      <ul className={`mx-auto mt-10 grid gap-6 ${cards >= 3 ? "max-w-xl lg:max-w-6xl lg:grid-cols-3" : cards === 2 ? "max-w-xl md:max-w-4xl md:grid-cols-2" : "max-w-md"}`}>
        {plans.map((plan, i) => {
          const free = plan.monthlyPrice === 0;
          const whenMonthly = showYearly ? WHEN_MONTHLY : "";
          const yearly = yearlyBreakdown(plan);
          const features = named(plan.features);
          const button = i === hot ? "zp-btn zp-btn--hot" : "zp-btn";
          return (
            <li key={plan.id} aria-labelledby={`${idPrefix}-plan-${plan.id}`} className={`zp-plan${i === hot ? " zp-plan--hot" : ""}`}>
              <PlanHeading id={`${idPrefix}-plan-${plan.id}`} className="zp-name">
                {plan.name}
              </PlanHeading>
              {/* Over the card's top edge (plans.css), after the name for a reader. */}
              {i === hot ? <span className="zp-badge">{copy.mostPopular}</span> : null}

              {free ? (
                <p className="zp-price">
                  <strong>{copy.free}</strong>
                </p>
              ) : (
                <>
                  <div className={whenMonthly}>
                    <Price minor={plan.monthlyPrice} currency={plan.currency} locale={locale} per={copy.perMonth} />
                    <p className="zp-psub">{copy.billedMonthly}</p>
                  </div>
                  {showYearly ? (
                    <div className={WHEN_YEARLY_BLOCK}>
                      <Price minor={plan.yearlyPrice} currency={plan.currency} locale={locale} per={copy.perYear} />
                      {yearly?.fullYear != null ? (
                        <p className="zp-psub">
                          <span className="sr-only">{copy.fullYearLabel} </span>
                          <s>{formatPrice(yearly.fullYear, plan.currency, locale)}</s>
                        </p>
                      ) : null}
                      {yearly ? <p className="zp-psub">{copy.perMonthEquivalent.replace("{price}", formatPrice(yearly.perMonth, plan.currency, locale))}</p> : null}
                    </div>
                  ) : null}
                </>
              )}
              {/* A trial is said only when the console gives a plan one: with none on offer, a line on every card saying so is noise. */}
              {plan.trialDays > 0 ? <p className="zp-trial">{copy.trial.replace("{days}", formatDays(plan.trialDays, locale))}</p> : null}

              {compact ? null : (
                <>
                  <div className="zp-lim">
                    <span>
                      {copy.stores}: {limit(plan.maxStores)}
                    </span>
                    <span>
                      {copy.funnels}: {limit(plan.maxFunnelsPerMonth)}
                    </span>
                    {plan.softOrderQuota !== null ? (
                      <span>
                        {copy.orders}: {formatNumber(plan.softOrderQuota, locale)}
                      </span>
                    ) : null}
                  </div>
                  {features.length > 0 ? (
                    <ul className="zp-feats plan-features">
                      {features.map((feature) => (
                        <li key={feature}>
                          <CheckIcon width="1rem" height="1rem" />
                          <span>{copy.features[feature]}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {/* On a phone a long list stops at six, the rest one tap away (landing.css `.plan-more`); a computer shows it whole. */}
                  {features.length > FEATURES_FIRST ? (
                    <label className="plan-more">
                      <input type="checkbox" className="plan-more__box sr-only" />
                      {copy.moreFeatures.replace("{n}", String(features.length - FEATURES_FIRST))}
                    </label>
                  ) : null}
                </>
              )}

              {/* At the card's foot, so the cards of a row are one height. A free plan has one button, whichever cycle is chosen. */}
              <div className={`zp-buy ${free ? "" : whenMonthly}`}>
                <a href={registerUrlFor(plan.id, "monthly")} className={button}>
                  {copy.cta}
                  <Arrow size={16} className="zp-arr" />
                </a>
              </div>
              {showYearly && !free ? (
                <div className={`zp-buy ${WHEN_YEARLY_BLOCK}`}>
                  <a href={registerUrlFor(plan.id, "yearly")} className={button}>
                    {copy.ctaYearly}
                    <Arrow size={16} className="zp-arr" />
                  </a>
                </div>
              ) : null}
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

/** A plan's price as the card draws it: the currency small, on the side Intl writes it, the number large, the period small. */
function Price({ minor, currency, locale, per }: { minor: number; currency: string; locale: Locale; per: string }) {
  const parts = priceParts(minor, currency, locale);
  return (
    <p className="zp-price">
      {parts.before ? (
        <>
          <small>{parts.symbol}</small>{" "}
        </>
      ) : null}
      <strong>{parts.number(parts.value)}</strong>
      {parts.before ? null : (
        <>
          {" "}
          <small>{parts.symbol}</small>
        </>
      )}{" "}
      <small>{per}</small>
    </p>
  );
}

/**
 * The pay-per-order plan: its fee for one order and the free orders a store
 * starts with, both from the plan; when the fee is taken, as the API says;
 * a balance that never expires (the API's wallet has no expiry). Its button
 * goes to the same sign-up, and the plan is chosen in My Plan after it.
 * `wide` spans the grid's row: on a computer the fee, what the plan is and
 * the button stand side by side (plans.css `.zp-ppo--wide`).
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
    <li aria-labelledby={headingId} className={`zp-ppo${wide ? " zp-ppo--wide col-span-full" : ""}`}>
      <p className="zp-ppo-price">
        {formatPrice(plan.feePerOrder, plan.currency, locale)} <small>{t.perOrder}</small>
      </p>

      <div className="zp-ppo-body">
        <span className="zp-ppo-tag">{t.badge}</span>
        <PlanHeading id={headingId} className="zp-ppo-name">
          {plan.name}
        </PlanHeading>
        <p>{t.tagline}</p>
        {plan.freeOrders > 0 ? <p className="zp-ppo-free">{t.freeOrders.replace("{orders}", formatOrderCount(plan.freeOrders, locale))}</p> : null}
        <ul className="zp-ppo-facts">
          {facts.map((fact) => (
            <li key={fact}>
              <CheckIcon width="1rem" height="1rem" />
              <span>{fact}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="zp-ppo-buy">
        <a href={registerUrlForPayPerOrder(plan.id)} className="zp-btn zp-btn--dark">
          {t.cta}
          <Arrow size={16} className="zp-arr" />
        </a>
        <small>{t.howToChoose}</small>
      </div>
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
