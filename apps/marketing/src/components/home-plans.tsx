"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { yearlyBreakdown, yearlySaves } from "@store-builder/ui/plan-pricing";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import { formatDays, formatNumber, formatOrderCount, formatPrice } from "@/lib/format";
import type { PublicOffer } from "@/lib/plan-offer";
import type { PublicPlan } from "@/lib/plans";
import { REGISTER_URL, registerUrlFor, registerUrlForPayPerOrder } from "@/lib/urls";
import { Arrow, Check } from "./duo-icons";
import { useLiveOffer } from "./use-live-offer";

type Copy = Dictionary["pricing"];
type Cycle = "monthly" | "yearly";

const intlLocale = (locale: Locale) => (locale === "ar" ? "ar-EG" : "en-US");

/** A price from the API (minor units) split the way the card draws it: the currency small, the number large. */
function priceParts(minor: number, currency: string, locale: Locale) {
  let digits = 2;
  try {
    digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    /* an unknown currency: two decimals */
  }
  const value = minor / 10 ** digits;
  const fraction = Number.isInteger(value) ? 0 : digits;
  let symbol = currency;
  let before = true;
  try {
    const parts = new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency, maximumFractionDigits: fraction }).formatToParts(value);
    const at = parts.findIndex((part) => part.type === "currency");
    symbol = at >= 0 ? parts[at].value.trim() : currency;
    before = at >= 0 && at < parts.findIndex((part) => part.type === "integer");
  } catch {
    /* keep the code */
  }
  const number = (n: number) => new Intl.NumberFormat(intlLocale(locale), { minimumFractionDigits: fraction, maximumFractionDigits: fraction }).format(n);
  return { value, symbol, before, number };
}

/**
 * A number that counts to its value when its cycle is switched on (`turn`
 * changes): from the other cycle's figure, in about two thirds of a second.
 * Before any switch, and under reduced motion, it is simply the value.
 */
function Count({ value, from, turn, format }: { value: number; from: number; turn: number; format: (n: number) => string }) {
  const [shown, setShown] = useState<number | null>(null);

  useEffect(() => {
    if (!turn || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t0 = performance.now();
    let frame = window.requestAnimationFrame(function tick(now) {
      const p = Math.min(1, (now - t0) / 650);
      setShown(p < 1 ? from + (value - from) * (1 - (1 - p) ** 3) : null);
      if (p < 1) frame = window.requestAnimationFrame(tick);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [turn, from, value]);

  return <>{format(shown ?? value)}</>;
}

/**
 * The home page's plans, read from the API like the pricing page's
 * (use-live-offer.ts): the monthly / yearly switch over them, a card for
 * each plan with its price, limits and features, then the pay-per-order
 * plan as a wide strip when the API offers it.
 *
 * Every price of both cycles is in the HTML: the switch is two radio inputs
 * and the cards show one cycle or the other with CSS (home.css
 * `.zm-m`/`.zm-y`), so it works, and reads, without script. With script the
 * number that comes into view counts to its value. Each "Subscribe" goes to
 * the sign-up with the plan and the cycle chosen.
 */
export function HomePlans({ initial, copy, locale }: { initial: PublicOffer | null; copy: Copy; locale: Locale }) {
  const offer = useLiveOffer(initial);
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [turn, setTurn] = useState(0);
  const plans = offer?.plans ?? [];
  const payPerOrder = offer?.payPerOrder ?? null;
  const showYearly = plans.some((plan) => plan.yearlyPrice > 0);
  const saves = yearlySaves(plans);
  const pick = (next: Cycle) => {
    setCycle(next);
    setTurn((n) => n + 1);
  };

  if (plans.length === 0 && !payPerOrder) {
    return (
      <div className="zm-plan zm-soon">
        <h3>{copy.comingSoon}</h3>
        <p className="zm-psub">{copy.comingSoonBody}</p>
        <div className="zm-ctas">
          <a className="zm-btn zm-btn--blue" href={REGISTER_URL}>
            {copy.comingSoonCta}
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      {showYearly ? (
        <fieldset className="zm-tog">
          <legend>{copy.billingCycle}</legend>
          <i className="pill" aria-hidden />
          <label>
            <input type="radio" name="home-pricing-cycle" defaultChecked onChange={() => pick("monthly")} />
            {copy.monthly}
          </label>
          <label>
            <input type="radio" name="home-pricing-cycle" className="cycle-yearly" onChange={() => pick("yearly")} />
            {copy.yearly}
            {saves ? <em>{copy.yearlySave}</em> : null}
          </label>
        </fieldset>
      ) : null}

      {plans.length > 0 ? (
        <ul className="zm-plans" style={{ "--cols": Math.min(3, plans.length) } as CSSProperties}>
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} copy={copy} locale={locale} showYearly={showYearly} turn={turn} cycle={cycle} />
          ))}
        </ul>
      ) : null}

      {payPerOrder ? (
        <ul>
          <li className="zm-ppo" aria-labelledby={`home-plan-${payPerOrder.id}`}>
            <strong className="ltr">
              {formatPrice(payPerOrder.feePerOrder, payPerOrder.currency, locale)} <small>{copy.payPerOrder.perOrder}</small>
            </strong>
            <div>
              <span className="badge">{copy.payPerOrder.badge}</span>
              <h3 id={`home-plan-${payPerOrder.id}`}>{payPerOrder.name}</h3>
              <p>{copy.payPerOrder.tagline}</p>
              <p>
                {payPerOrder.freeOrders > 0 ? `${copy.payPerOrder.freeOrders.replace("{orders}", formatOrderCount(payPerOrder.freeOrders, locale))} · ` : ""}
                {payPerOrder.feeChargedAt === "confirmation" ? copy.payPerOrder.feeAtConfirmation : copy.payPerOrder.feeAtPlacement}. {copy.payPerOrder.noExpiry}.
              </p>
            </div>
            <div className="zm-buy">
              <a className="zm-btn zm-btn--line" href={registerUrlForPayPerOrder(payPerOrder.id)}>
                {copy.payPerOrder.cta}
                <Arrow size={16} className="zm-arr" />
              </a>
              <small>{copy.payPerOrder.howToChoose}</small>
            </div>
          </li>
        </ul>
      ) : null}
    </>
  );
}

function PlanCard({
  plan,
  copy,
  locale,
  showYearly,
  turn,
  cycle,
}: {
  plan: PublicPlan;
  copy: Copy;
  locale: Locale;
  showYearly: boolean;
  turn: number;
  cycle: Cycle;
}) {
  const headingId = `home-plan-${plan.id}`;
  const free = plan.monthlyPrice === 0;
  const both = showYearly && !free;
  const yearly = yearlyBreakdown(plan);
  const month = priceParts(plan.monthlyPrice, plan.currency, locale);
  const year = priceParts(plan.yearlyPrice, plan.currency, locale);
  const limit = (value: number | null) => (value === null ? copy.unlimited : formatNumber(value, locale));
  const features = plan.features.filter((key): key is keyof Copy["features"] => key in copy.features);

  const price = (parts: typeof month, from: number, on: boolean, per: string) => (
    <div className="zm-price">
      {parts.before ? <small>{parts.symbol}</small> : null}
      <strong>
        <Count value={parts.value} from={from} turn={on ? turn : 0} format={parts.number} />
      </strong>
      {parts.before ? null : <small>{parts.symbol}</small>}
      <small>{per}</small>
    </div>
  );

  return (
    <li className="zm-plan" aria-labelledby={headingId}>
      <h3 id={headingId}>{plan.name}</h3>

      {free ? (
        <div className="zm-price">
          <strong>{copy.free}</strong>
        </div>
      ) : (
        <>
          <div className={both ? "zm-m" : undefined}>
            {price(month, year.value, cycle === "monthly", copy.perMonth)}
            <p className="zm-psub">{both ? copy.yearlyEquivalent.replace("{price}", formatPrice(plan.yearlyPrice, plan.currency, locale)) : " "}</p>
          </div>
          {both ? (
            <div className="zm-y">
              {price(year, month.value, cycle === "yearly", copy.perYear)}
              <p className="zm-psub">
                {yearly?.fullYear != null ? (
                  <>
                    <span className="sr-only">{copy.fullYearLabel} </span>
                    <s>{formatPrice(yearly.fullYear, plan.currency, locale)}</s>{" "}
                  </>
                ) : null}
                {yearly ? copy.perMonthEquivalent.replace("{price}", formatPrice(yearly.perMonth, plan.currency, locale)) : null}
              </p>
            </div>
          ) : null}
        </>
      )}

      {plan.trialDays > 0 ? <p className="zm-trial">{copy.trial.replace("{days}", formatDays(plan.trialDays, locale))}</p> : null}

      <div className="zm-lim">
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
        <ul>
          {features.map((feature) => (
            <li key={feature}>
              <Check size={16} />
              {copy.features[feature]}
            </li>
          ))}
        </ul>
      ) : null}

      <div className={both ? "zm-buy zm-m" : "zm-buy"}>
        <a className="zm-btn zm-btn--blue" href={registerUrlFor(plan.id, "monthly")}>
          {copy.cta}
          <Arrow size={16} className="zm-arr" />
        </a>
      </div>
      {both ? (
        <div className="zm-buy zm-y">
          <a className="zm-btn zm-btn--blue" href={registerUrlFor(plan.id, "yearly")}>
            {copy.ctaYearly}
            <Arrow size={16} className="zm-arr" />
          </a>
        </div>
      ) : null}
    </li>
  );
}
