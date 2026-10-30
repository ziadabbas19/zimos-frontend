import { storefrontDesignMeta, storefrontGeneralMeta, type StorefrontMeta } from "@store-builder/api-client";
import type { ReactNode } from "react";
import { PoweredByZimos, brandingRemoved } from "@/components/PoweredByZimos";
import { ShellLink } from "@/components/ShellLink";
import { StoreLink } from "@/components/StoreRoute";
import { StoreRatingBadge } from "@/components/reviews/StoreRatingBadge";
import { getDictionary, type Locale } from "@/lib/i18n";
import { resolveShellLinks, type FooterShell } from "@/lib/storeShell";
import { pageAndPolicyGroups } from "@/lib/footerLinks";

/**
 * The fuller footer (`themeSettings.footer.layout: "rich"`): the store's logo
 * with how to reach it and its social accounts, then the merchant's link
 * groups, over the same rights line every footer ends with.
 *
 * How to reach the store and its social accounts are the store's own settings
 * (Store info, Social links) — never values a template carried in its theme
 * settings, which once put another store's details on every store that used
 * it (migration 430). The link groups come through lib/storeShell like the
 * plain footer's.
 */

const text = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

const SOCIAL: Record<string, { label: string; icon: ReactNode }> = {
  facebook: { label: "Facebook", icon: <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.6-1.5h1.4V4.4a18 18 0 0 0-2.1-.1c-2.1 0-3.5 1.3-3.5 3.6v2.6H8.5v3h2.4V21h2.6Z" /> },
  instagram: {
    label: "Instagram",
    icon: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="4.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="12" cy="12" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="16.7" cy="7.3" r="1" />
      </>
    ),
  },
  tiktok: { label: "TikTok", icon: <path d="M14.5 4c.3 2 1.5 3.3 3.5 3.5v2.6a6 6 0 0 1-3.4-1.1v5.6a4.9 4.9 0 1 1-4.9-4.9c.3 0 .5 0 .8.1v2.7a2.3 2.3 0 1 0 1.5 2.1V4h2.5Z" /> },
  youtube: { label: "YouTube", icon: <path d="M21 8.2a2.5 2.5 0 0 0-1.8-1.8C17.6 6 12 6 12 6s-5.6 0-7.2.4A2.5 2.5 0 0 0 3 8.2 26 26 0 0 0 2.6 12c0 1.3.1 2.6.4 3.8a2.5 2.5 0 0 0 1.8 1.8c1.6.4 7.2.4 7.2.4s5.6 0 7.2-.4a2.5 2.5 0 0 0 1.8-1.8c.3-1.2.4-2.5.4-3.8s-.1-2.6-.4-3.8ZM10.2 14.7V9.3l4.7 2.7-4.7 2.7Z" /> },
  whatsapp: { label: "WhatsApp", icon: <path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.8L3.5 20.5l4.3-1.1A8.5 8.5 0 1 0 12 3.5Zm4.2 11.7c-.2.5-1 1-1.4 1-.9.2-3.3-.8-5.2-3.3-1.1-1.5-1.2-2.7-.5-3.5.4-.5 1-.5 1.2-.1l.6 1.4c.1.3 0 .5-.2.8l-.3.4c.5.9 1.3 1.7 2.3 2.2l.5-.6c.2-.2.4-.3.7-.2l1.4.7c.3.1.4.5.3.8Z" /> },
};

export function RichFooter({
  store,
  locale,
  year,
  footer,
}: {
  store: StorefrontMeta;
  locale: Locale;
  year: number;
  footer: FooterShell;
}) {
  const t = getDictionary(locale);
  const info = storefrontDesignMeta(store).storeInfo;
  const address = text(info?.address);
  const email = text(info?.email, 120);
  const phone = text(info?.phone, 40);
  const social = Object.entries(storefrontGeneralMeta(store).social)
    .map(([platform, url]) => ({ platform, url: text(url, 500) }))
    .filter((item) => /^https?:\/\//i.test(item.url) && SOCIAL[item.platform])
    .slice(0, 6);
  const groups = [
    ...(footer.showLinks ? (footer.groups ?? []).map((group) => ({ title: group.title, links: resolveShellLinks(group.links, t.common) })) : []),
    // The footer pages and the store's policies, as the plain footer shows them (lib/footerLinks).
    ...pageAndPolicyGroups(store, t),
  ];

  return (
    <footer data-zimos-shell="footer" className="zs-footer mt-auto">
      <div className="zs-footer__inner">
        {footer.showBrand && (
          <div className="zs-footer__brand">
            <StoreLink href="/" aria-label={store.name} className="zs-footer__logo">
              {store.logoUrl ? (
                // Merchant logos are arbitrary remote URLs (no next/image allowlist).
                // eslint-disable-next-line @next/next/no-img-element
                <img src={store.logoUrl} alt="" width={120} height={120} loading="lazy" />
              ) : (
                <span>{store.name}</span>
              )}
            </StoreLink>
            <ul className="zs-footer__contact">
              {address && (
                <li>
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z" />
                    <circle cx="12" cy="10" r="2.3" />
                  </svg>
                  <span>{address}</span>
                </li>
              )}
              {email && (
                <li>
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <rect x="3.5" y="6" width="17" height="12" rx="1.5" />
                    <path d="m4 7 8 6 8-6" />
                  </svg>
                  <a href={`mailto:${email}`} dir="ltr">
                    {email}
                  </a>
                </li>
              )}
              {phone && (
                <li>
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <path d="M6.5 4h3l1.5 4-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16 16 0 0 1 4.5 6.2 2 2 0 0 1 6.5 4Z" />
                  </svg>
                  <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} dir="ltr">
                    {phone}
                  </a>
                </li>
              )}
            </ul>
            {social.length > 0 && (
              <div className="zs-footer__social">
                {social.map((item) => (
                  <a key={item.platform} href={item.url} target="_blank" rel="noopener noreferrer nofollow" aria-label={SOCIAL[item.platform].label}>
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      {SOCIAL[item.platform].icon}
                    </svg>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {groups.map((group, i) => (
          <nav key={i} aria-label={group.title || t.footer.links} className="zs-footer__group">
            {group.title && <h3>{group.title}</h3>}
            <ul>
              {group.links.map((item) => (
                <li key={item.key}>
                  {item.external ? <ShellLink link={item} className="" /> : <StoreLink href={item.href}>{item.label}</StoreLink>}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="zs-footer__bottom">
        <p>{t.footer.rights(store.name, year)}</p>
        {/* The social accounts sit with the brand; without it, here. */}
        {!footer.showBrand && social.length > 0 && (
          <div className="zs-footer__social">
            {social.map((item) => (
              <a key={item.platform} href={item.url} target="_blank" rel="noopener noreferrer nofollow" aria-label={SOCIAL[item.platform].label}>
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  {SOCIAL[item.platform].icon}
                </svg>
              </a>
            ))}
          </div>
        )}
        {/* The store's own stars, to its reviews page; nothing before its first counted review. */}
        <StoreRatingBadge store={store} locale={locale} className="transition-colors hover:text-primary" starClass="text-primary" />
        {!brandingRemoved(store) && <PoweredByZimos label={t.footer.poweredBy} />}
      </div>
    </footer>
  );
}
