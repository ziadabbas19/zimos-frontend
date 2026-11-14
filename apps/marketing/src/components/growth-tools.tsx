import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary, GrowthTool } from "@/i18n/dictionary";
import { ColorIcon, type ColorIconName } from "./color-icon";
import { SectionLabel } from "./section-label";

/** Each tool's icon and the colour of its tile. */
const TOOL: Record<GrowthTool["id"], [ColorIconName, string]> = {
  coupons: ["ticket", "blue"],
  loyalty: ["crown", "amber"],
  cart: ["cart", "green"],
  bundles: ["stack", "violet"],
  email: ["mail", "sky"],
  recovery: ["recover", "rose"],
};

/**
 * The tools that bring sales and bring customers back: six cards, each with
 * its icon on a coloured tile and a few words of what it looks like to the
 * customer (the copy's `tag`), above its name and its line. What a plan
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
          {copy.tools.map((tool) => {
            const [icon, colour] = TOOL[tool.id];
            return (
              <li key={tool.id} className="zx-tool lz-r">
                <div className="zx-tool__art" aria-hidden>
                  <span className={`zx-tile zx-tile--xl zx-tile--${colour}`}>
                    <ColorIcon name={icon} size={34} fill />
                  </span>
                  <span className="zx-tool__tag">{tool.tag}</span>
                </div>
                <h3>{tool.title}</h3>
                <p>{tool.body}</p>
              </li>
            );
          })}
        </ul>

        <p className="zx-cap lz-r">
          {copy.note} <Link href={`/${locale}/pricing`}>{copy.pricingLink}</Link>.
        </p>
      </div>
    </section>
  );
}
