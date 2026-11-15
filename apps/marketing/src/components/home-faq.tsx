import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import { Plus } from "./duo-icons";
import { SectionLabel } from "./section-label";

/**
 * The questions, the home page's way: the title and the way to ask on one
 * side, the questions on the other. Native disclosures sharing one `name`,
 * so one is open at a time with no script; the first starts open. Where the
 * browser can animate to `auto`, an answer slides open (home.css). Each
 * question is a <summary>, so the keyboard and screen readers know it.
 */
export function HomeFaq({ copy, locale }: { copy: Dictionary["faq"]; locale: Locale }) {
  return (
    <section className="zm-sec zm-sec--tight" id="faq" aria-labelledby="faq-heading" data-section="faq">
      <div className="zm-in zm-faqg">
        <header className="rv">
          <SectionLabel n="08" text={copy.kicker} />
          <h2 id="faq-heading">{copy.heading}</h2>
          <Link className="t" href={`/${locale}/contact`}>
            {copy.contactLink}
          </Link>
        </header>

        <div className="zm-faq rv">
          {copy.items.map((item, i) => (
            <details key={item.question} className="zm-fq" name="zm-faq" open={i === 0}>
              <summary>
                <span>{item.question}</span>
                <span className="pm" aria-hidden>
                  <Plus size={17} />
                </span>
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
