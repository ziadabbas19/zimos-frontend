/* eslint-disable @next/next/no-img-element -- small 3D icons, already sized and compressed. */
import type { CSSProperties } from "react";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary, GrowthTool } from "@/i18n/dictionary";
import type { Icon3DName } from "./icon-3d";
import { SectionLabel } from "./section-label";

/** Each tool's picture, and how it moves. */
const TOOL: Record<GrowthTool["id"], { icon: Icon3DName; motion: string }> = {
  coupons: { icon: "ticket", motion: "a-tick" },
  loyalty: { icon: "crown", motion: "a-float" },
  cart: { icon: "cart", motion: "a-roll" },
  bundles: { icon: "gift", motion: "a-float" },
  email: { icon: "mail", motion: "a-tick" },
  recovery: { icon: "bell", motion: "a-ring" },
};

/**
 * The tools that bring sales and bring customers back: six cards, each with
 * its picture moving its own way and a few words of what it looks like to
 * the customer (the copy's `tag`; the cart's with a bar that fills), above
 * its name and its line. What a plan includes differs, so the line under
 * them points at the pricing page. The tile and its words are decoration.
 */
export function GrowthTools({ copy, locale }: { copy: Dictionary["growth"]; locale: Locale }) {
  return (
    <section className="zm-sec" id="growth" aria-labelledby="zm-growth" data-section="growth">
      <div className="zm-in">
        <header className="zm-sh rv">
          <SectionLabel n="06" text={copy.kicker} />
          <h2 id="zm-growth">{copy.heading}</h2>
          <p>{copy.intro}</p>
        </header>

        <ul className="zm-ggrid">
          {copy.tools.map((tool, i) => (
            <li key={tool.id} className="zm-gc rv" style={{ "--d": i % 3 } as CSSProperties}>
              <div className="zm-gpic" aria-hidden>
                <img className={`zm-i3 ${TOOL[tool.id].motion}`} src={`/icons/3d/${TOOL[tool.id].icon}.webp`} width={78} height={78} alt="" loading="lazy" decoding="async" />
                {tool.id === "cart" ? (
                  <span className="prog">
                    <i />
                  </span>
                ) : null}
                <span className="zm-tag">{tool.tag}</span>
              </div>
              <h3>{tool.title}</h3>
              <p>{tool.body}</p>
            </li>
          ))}
        </ul>

        <p className="zm-gnote rv">
          {copy.note} <Link href={`/${locale}/pricing`}>{copy.pricingLink}</Link>.
        </p>
      </div>
    </section>
  );
}
