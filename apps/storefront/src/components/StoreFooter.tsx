"use client";

import { storefrontGeneralMeta, type StorefrontMeta } from "@store-builder/api-client";
import { SocialLinks } from "./SocialLinks";
import { StoreLink } from "@/components/StoreRoute";
import { getDictionary, type Locale } from "@/lib/i18n";
import { useStoreShell } from "@/lib/StoreShellContext";
import { resolveShellLinks, type ResolvedShellLink } from "@/lib/storeShell";
import { PoweredByZimos, brandingRemoved } from "./PoweredByZimos";
import { cardTitle, storeCards } from "@/lib/storePromises";
import { pageAndPolicyGroups } from "@/lib/footerLinks";
import { RichFooter } from "./shell/RichFooter";
import { StoreRatingBadge } from "./reviews/StoreRatingBadge";
import { ShellLink } from "./ShellLink";
import { container } from "./ui";

/**
 * The store's footer, rendered once by the store layout under every page.
 *
 * What the merchant can change — their own link groups, a line of text under
 * the store name, and which of the three columns show — comes from
 * `themeSettings.footer` (lib/storeShell.ts), read through useStoreShell so
 * the editor's preview can show unsaved changes. Every default is the footer
 * as it was before those settings existed, down to the markup. The bottom
 * rule (rights line and "Powered by") always shows.
 *
 * A client component only so the preview can swap settings in without a
 * reload; `year` comes from the server so the rights line can't disagree
 * between the server render and hydration.
 */

/** Grid columns by how many blocks show. Three is the original footer. */
const GRID_COLS: Record<number, string> = {
  1: "",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-5",
  6: "sm:grid-cols-3 lg:grid-cols-6",
};

export function StoreFooter({ store, locale, year }: { store: StorefrontMeta; locale: Locale; year: number }) {
  const t = getDictionary(locale);
  const { footer } = useStoreShell(store);
  // The fuller footer a store can ask for: logo, contact, social accounts (shell/RichFooter).
  const layout = (store.themeSettings?.footer as { layout?: unknown } | undefined)?.layout;
  if (layout === "rich") return <RichFooter store={store} locale={locale} year={year} footer={footer} />;

  const link =
    "inline-flex min-h-11 min-w-11 items-center text-sm text-ink-soft transition-colors hover:text-primary lg:min-h-9";

  const builtIn: ResolvedShellLink[] = [
    { key: "home", label: t.common.home, href: "/", external: false },
    { key: "cart", label: t.common.cart, href: "/cart", external: false },
    { key: "track", label: t.common.trackOrder, href: "/track", external: false },
  ];
  const groups = footer.showLinks
    ? (footer.groups?.map((group) => ({ title: group.title, links: resolveShellLinks(group.links, t.common) })) ?? [
        { title: t.footer.links, links: builtIn },
      ])
    : [];
  // Settings → store settings: the pages flagged "show in footer" and the
  // legal policies the store has written, each as its own column (lib/footerLinks).
  groups.push(...pageAndPolicyGroups(store, t));
  const about = footer.text ?? store.tagline;
  const blocks = (footer.showBrand ? 1 : 0) + groups.length + (footer.showHelp ? 1 : 0);

  return (
    <footer data-zimos-shell="footer" className="mt-auto border-t border-line bg-paper-raised">
      {blocks > 0 && (
        <div className={`${container} grid gap-8 py-10 ${GRID_COLS[blocks] ?? GRID_COLS[6]}`.trimEnd()}>
          {footer.showBrand && (
            <div>
              <p className="font-display text-base font-bold text-ink">{store.name}</p>
              {about && (
                <p
                  className={`mt-2 max-w-xs text-sm leading-relaxed text-ink-soft${footer.text ? " whitespace-pre-line" : ""}`}
                >
                  {about}
                </p>
              )}
            </div>
          )}

          {groups.map((group, i) => (
            <nav key={i} aria-label={group.title || t.footer.links}>
              {group.title && <p className="text-sm font-semibold text-ink">{group.title}</p>}
              <ul className="mt-2">
                {group.links.map((item) => (
                  <li key={item.key}>
                    {item.external ? (
                      <ShellLink link={item} className={link} />
                    ) : (
                      <StoreLink href={item.href} className={link}>
                        {item.label}
                      </StoreLink>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          {/* The store's own shipping / returns / COD cards (lib/storePromises.ts), never invented ones. */}
          {footer.showHelp && storeCards(store).length > 0 && (
            <div>
              <p className="text-sm font-semibold text-ink">{t.footer.help}</p>
              <ul className="mt-2 space-y-2 text-sm text-ink-soft">
                {storeCards(store).map((card) => (
                  <li key={card.key}>{cardTitle(card, locale)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {Object.keys(storefrontGeneralMeta(store).social).length > 0 && (
        <div className={`${container} pb-6`}>
          <SocialLinks links={storefrontGeneralMeta(store).social} />
        </div>
      )}

      <div className="border-t border-line">
        <div className={`${container} flex flex-col items-center justify-between gap-2 py-4 sm:flex-row`}>
          <p className="text-xs text-ink-soft">{t.footer.rights(store.name, year)}</p>
          {/* The store's own stars, to its reviews page; nothing before its first counted review. */}
          <StoreRatingBadge store={store} locale={locale} className="text-xs text-ink-soft transition-colors hover:text-primary" starClass="text-primary" />
          {/* Removed for stores whose plan includes it (Plan.features.remove_branding). */}
          {!brandingRemoved(store) && <PoweredByZimos label={t.footer.poweredBy} />}
        </div>
      </div>
    </footer>
  );
}
