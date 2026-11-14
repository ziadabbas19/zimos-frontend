import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary, GrowthTool } from "@/i18n/dictionary";
import { Icon3D, type Icon3DName } from "./icon-3d";
import { SectionLabel } from "./section-label";

/** Each tool's picture. */
const TOOL: Record<GrowthTool["id"], Icon3DName> = {
  coupons: "ticket",
  loyalty: "crown",
  cart: "cart",
  bundles: "gift",
  email: "mail",
  recovery: "bell",
};

/**
 * The tools that bring sales and bring customers back: six cards, each with
 * its picture and a few words of what it looks like to the customer (the
 * copy's `tag`), above its name and its line. What a plan
 * includes differs, so the line under them points at the pricing page. The
 * tile and its words are decoration (aria-hidden).
 */
export function GrowthTools({ copy, locale }: { copy: Dictionary["growth"]; locale: Locale }) {
  return (
    <section className="zx-sec zx-growth" id="growth" aria-labelledby="zx-growth">
      <div className="lz-in">
        <header className="zx-head zx-head--center lz-r">
          <SectionLabel n="06" text={copy.kicker} />
          <h2 className="zx-h2" id="zx-growth">
            {copy.heading}
          </h2>
          <p className="zx-lede">{copy.intro}</p>
        </header>

        <ul className="zx-tools">
          {copy.tools.map((tool) => (
            <li key={tool.id} className="zx-tool lz-r">
              <div className="zx-tool__art" aria-hidden>
                <Icon3D name={TOOL[tool.id]} size={80} />
                <span className="zx-tool__tag">{tool.tag}</span>
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
