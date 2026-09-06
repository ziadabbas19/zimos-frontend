import type { Dictionary } from "@/i18n/dictionary";

const REGISTER_URL = "https://app.zimos.co/register";
const LOGIN_URL = "https://app.zimos.co/login";

/**
 * Wordmark, tagline, and the same handful of links the header carries.
 * No contact address or social links — none exist yet. Never links to
 * platform-admin. The © year is computed at render, not hardcoded.
 */
export function SiteFooter({
  copy,
  nav,
}: {
  copy: Dictionary["footer"];
  nav: Dictionary["nav"];
}) {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-line bg-paper-raised">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <div className="flex items-center gap-2 font-heading text-lg font-semibold tracking-tight text-ink">
              <span aria-hidden className="size-2.5 rounded-[3px] bg-primary" />
              {nav.brand}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              {copy.tagline}
            </p>
          </div>

          <nav
            aria-label={copy.navLabel}
            className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-ink-soft"
          >
            <a href="#features" className="transition-colors hover:text-ink">
              {nav.features}
            </a>
            <a href="#pricing" className="transition-colors hover:text-ink">
              {nav.pricing}
            </a>
            <a href={LOGIN_URL} className="transition-colors hover:text-ink">
              {nav.login}
            </a>
            <a href={REGISTER_URL} className="transition-colors hover:text-ink">
              {nav.startStore}
            </a>
          </nav>
        </div>

        <p className="mt-10 text-sm text-ink-soft">
          © {year} {nav.brand} · {copy.rights}
        </p>
      </div>
    </footer>
  );
}
