import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary, GrowthTool } from "@/i18n/dictionary";
import { ColorIcon } from "./color-icon";
import { Check } from "./duo-icons";
import { SectionLabel } from "./section-label";

/** Each tool's drawing, around the few words the copy gives it (`tag`). */
const DRAWING: Record<GrowthTool["id"], (tag: string) => ReactNode> = {
  // A coupon with its torn edge and its code.
  coupons: (tag) => (
    <div className="zx-g zx-g--coupon">
      <b>{tag}</b>
      <i />
      <em className="ltr">WELCOME20</em>
    </div>
  ),
  // A ring three quarters full around the points.
  loyalty: (tag) => (
    <div className="zx-g zx-g--ring">
      <span>
        <b>{tag}</b>
      </span>
      <em className="ltr">VIP</em>
    </div>
  ),
  // The cart's bar on its way to the reward.
  cart: (tag) => (
    <div className="zx-g zx-g--bar">
      <span>
        <ColorIcon name="delivery" size={18} />
        {tag}
      </span>
      <i />
    </div>
  ),
  // Three products as one.
  bundles: (tag) => (
    <div className="zx-g zx-g--stack">
      <i />
      <i />
      <i />
      <b>{tag}</b>
    </div>
  ),
  // A message, its subject first.
  email: (tag) => (
    <div className="zx-g zx-g--mail">
      <span>
        <ColorIcon name="send" size={16} />
        <b>{tag}</b>
      </span>
      <u />
      <u />
      <i />
    </div>
  ),
  // The reminder that brings the order back.
  recovery: (tag) => (
    <div className="zx-g zx-g--back">
      <i>
        <ColorIcon name="package" size={22} />
      </i>
      <span>
        {tag}
        <em>
          <Check size={11} />
        </em>
      </span>
    </div>
  ),
};

/**
 * The tools that bring sales and bring customers back: six cards, each with
 * a small drawing above its name and its line. What a plan includes differs,
 * so the line under them points at the pricing page. The drawings are
 * decoration (aria-hidden).
 */
export function GrowthTools({ copy, locale }: { copy: Dictionary["growth"]; locale: Locale }) {
  return (
    <section className="zx-sec zx-growth" id="growth" aria-labelledby="zx-growth">
      <div className="lz-in">
        <header className="zx-head zx-head--center lz-r">
          <SectionLabel n="05" text={copy.kicker} />
          <h2 className="zx-h2" id="zx-growth">
            {copy.heading}
          </h2>
          <p className="zx-lede">{copy.intro}</p>
        </header>

        <ul className="zx-tools">
          {copy.tools.map((tool) => (
            <li key={tool.id} className="zx-tool lz-r">
              <div className="zx-tool__art" aria-hidden>
                {DRAWING[tool.id](tool.tag)}
              </div>
              <h3>{tool.title}</h3>
              <p>{tool.body}</p>
            </li>
          ))}
        </ul>

        <p className="zx-cap lz-r">
          {copy.note} <Link href={`/${locale}/pricing`}>{copy.pricingLink}</Link>.
        </p>
      </div>
    </section>
  );
}
