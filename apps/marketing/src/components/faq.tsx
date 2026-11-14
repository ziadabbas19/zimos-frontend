import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import { Plus } from "./duo-icons";
import { SectionLabel } from "./section-label";

/**
 * The questions as native disclosures: each opens on its own, no script.
 * With `n` (the home page) the line above the title is the section's number.
 */
export function Faq({ copy, locale, n }: { copy: Dictionary["faq"]; locale: Locale; n?: string }) {
  return (
    <section className="lz-sec lz-sec--line" id="faq" aria-labelledby="faq-heading">
      <div className="lz-in lz-faqwrap">
        <header className="lz-head lz-r">
          {n ? <SectionLabel n={n} text={copy.kicker} /> : <span className="lz-eye">{copy.kicker}</span>}
          <h2 className="lz-h" id="faq-heading">
            {copy.heading}
          </h2>
          <p className="lz-faq__more">
            <Link className="lz-link" href={`/${locale}/contact`}>
              {copy.contactLink}
            </Link>
          </p>
        </header>

        <div className="lz-faq lz-r">
          {copy.items.map((item) => (
            <details key={item.question}>
              <summary>
                <span>{item.question}</span>
                <i aria-hidden>
                  <Plus size={16} />
                </i>
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
