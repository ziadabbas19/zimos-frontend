import { socialLinksOf, textIn } from "@store-builder/ui/platform-info";
import { SocialLinks } from "@store-builder/ui/social-links";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import { getPlatformSettings } from "@/lib/platform-settings";
import { companyDetails } from "@/lib/policies";
import { LocaleSwitcher } from "./locale-switcher";
import { ThemeToggle } from "./theme-toggle";
import { ZimosLogo } from "./zimos-logo";

/**
 * The home page's footer, in its look (site-footer.tsx is every other
 * page's), with the same facts from the same places: the tagline, the
 * links, the © line, the legal entity, ZIMOS's social accounts, the
 * language and the theme. With PLATFORM_SETTINGS_ENABLED on, the tagline,
 * the accounts, the name and the legal entity come from the console
 * (lib/platform-settings.ts), each falling back when never saved.
 */
export async function HomeFooter({ copy, brand, locale }: { copy: Dictionary["footer"]; brand: Dictionary["brand"]; locale: Locale }) {
  const year = new Date().getFullYear();
  const settings = await getPlatformSettings();
  const company = companyDetails(locale, settings);
  const tagline = textIn(settings?.footer?.tagline, locale, brand.tomorrow);
  const rights = textIn(settings?.footer?.rights, locale, copy.rights);
  const name = settings?.company?.platformName ?? brand.name;

  return (
    <footer className="zm-ft">
      <div className="zm-in">
        <div className="zm-ft-r">
          <ZimosLogo height={28} />
          <span className="t">{tagline}</span>
          <nav aria-label={copy.navLabel}>
            <ul>
              {copy.links.map((link) => (
                <li key={link.href}>
                  <a href={`/${locale}${link.href}`}>{link.label}</a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="zm-ft-b">
          <p>
            © {year} {name} · {rights} · {company.legalName} · {copy.registration}: <span dir="ltr">{company.registration}</span> · {copy.taxRegistration}:{" "}
            <span dir="ltr">{company.taxRegistration}</span>
          </p>
          <div>
            <SocialLinks locale={locale} links={socialLinksOf(settings)} />
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </footer>
  );
}
