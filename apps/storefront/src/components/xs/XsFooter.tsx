"use client";

import { storefrontGeneralMeta, type StorefrontMeta } from "@store-builder/api-client";
import { Fragment, cloneElement, isValidElement, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { footerSizeCss, footerWidthCss } from "./shellSizes";
import { XsNewsletterForm } from "@/components/page-renderer/xs/XsNewsletterForm";
import { useStore } from "@/lib/StoreContext";
import { DEFAULT_FOOTER_BOTTOM, defaultFooterColumns, readFooterBottom, readFooterColumns, type FooterColumn } from "@/lib/xsLayout";
import { PoweredByZimos, brandingRemoved } from "@/components/PoweredByZimos";
import { ShellLink } from "@/components/ShellLink";
import { SocialLinks } from "@/components/SocialLinks";
import { StoreLink } from "@/components/StoreRoute";
import { pageAndPolicyGroups } from "@/lib/footerLinks";
import { getDictionary, type Locale } from "@/lib/i18n";
import { resolveShellLinks, type ResolvedShellLink } from "@/lib/storeShell";
import { useStoreShell } from "@/lib/StoreShellContext";
import { XS_CREDITS, XS_LOGOS } from "@/lib/xsShell";

/**
 * The footer of an imported template (an "xs" look), drawn in place of the
 * store's own (StoreFooter) on a store whose themeSettings name that look.
 * Styles: app/xs-shell.css.
 *
 * The template's layout — link columns, then a "get in touch" column with the
 * social accounts — filled with the store's own footer, edited in the website
 * editor's Footer panel (`themeSettings.footer`): its link groups, the line
 * under the store's name, and which blocks show. Pages and policies flagged
 * "show in footer" join as columns, as in the store's own footer.
 *
 * The bottom line carries the rights notice and the attribution the
 * template's licence asks for, which is why that part is not a setting.
 *
 * Which columns, in which order, how wide and lined up how — and what the
 * bottom line holds besides the credit — is the merchant's to arrange
 * (`footer.columns` / `footer.bottom`, lib/xsLayout); with nothing arranged
 * it is the template's own footer, exactly as above.
 */
export function XsFooter({ store, locale, year, look }: { store: StorefrontMeta; locale: Locale; year: number; look: string }) {
  const t = getDictionary(locale);
  const { footer } = useStoreShell(store);
  const { store: info } = useStore();

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
  const pageGroups = pageAndPolicyGroups(store, t);
  const about = footer.text ?? store.tagline;
  const social = storefrontGeneralMeta(store).social;
  const credit = XS_CREDITS[look];
  const creditLine = credit ? (
    <p data-xs-credit="">
      Design: {credit.name} by{" "}
      <a href={credit.href} target="_blank" rel="noopener">
        {credit.author}
      </a>{" "}
      ({credit.licence})
    </p>
  ) : null;
  // The footer's logo: its own picture, else the store's logo (the one the header shows too), else the template's
  // light one, else the name. Where it came from tells the editor's preview whether a new store logo shows here.
  const templateFooterLogo = XS_LOGOS[look]?.footer ?? null;
  const footerLogo = footer.logoAsName ? null : (footer.logoImage ?? store.logoUrl ?? templateFooterLogo);
  const footerLogoSource = footer.logoAsName ? "name" : footer.logoImage ? "own" : store.logoUrl ? "store" : templateFooterLogo ? "template" : "none";
  // The footer's own colours (the editor's Footer panel), as properties app/xs-shell.css reads.
  const own: Record<string, string> = {};
  if (footer.colors?.background) own["--xs-own-foot"] = footer.colors.background;
  if (footer.colors?.text) own["--xs-own-foot-text"] = footer.colors.text;
  if (footer.colors?.heading) own["--xs-own-foot-heading"] = footer.colors.heading;
  // The columns and the bottom line as arranged, else the template's own.
  const columns = readFooterColumns(footer.columns) ?? defaultFooterColumns(groups.length, footer.showBrand);
  const bottom = readFooterBottom(footer.bottom) ?? DEFAULT_FOOTER_BOTTOM;
  // Its own sizes and column widths, per screen: a small stylesheet of their own (./shellSizes).
  const sizeCss = footerSizeCss(footer.sizes) + footerWidthCss(columns, pageGroups.length);
  const ar = locale === "ar";

  const linkList = (links: ResolvedShellLink[]) => (
    <ul>
      {links.map((item) => (
        <li key={item.key}>
          {item.external ? (
            <ShellLink link={item} className="xs-footer__link" />
          ) : (
            <StoreLink href={item.href} className="xs-footer__link">
              {item.label}
            </StoreLink>
          )}
        </li>
      ))}
    </ul>
  );

  /** One column of the footer, as the template draws a column. */
  function column(col: FooterColumn): ReactNode {
    const style = col.align ? ({ textAlign: col.align } as CSSProperties) : undefined;
    const lines = (col.text ?? "").split(/\n/).map((line) => line.trim()).filter(Boolean);
    switch (col.type) {
      case "group": {
        const group = groups[col.at ?? -1];
        if (!group) return null;
        return (
          <nav key={col.id} className="xs-footer__col" aria-label={group.title || t.footer.links} data-xs-col={col.id} style={style}>
            {group.title && <h4 className="xs-footer__title">{group.title}</h4>}
            {linkList(group.links)}
          </nav>
        );
      }
      case "pages":
        return (
          <Fragment key={col.id}>
            {pageGroups.map((group, i) => (
              <nav key={i} className="xs-footer__col" aria-label={group.title || t.footer.links} data-xs-col={col.id} style={style}>
                {group.title && <h4 className="xs-footer__title">{group.title}</h4>}
                {linkList(group.links)}
              </nav>
            ))}
          </Fragment>
        );
      case "brand":
        return (
          <div key={col.id} className="xs-footer__col" data-xs-col={col.id} style={style}>
            <h4
              className="xs-footer__title"
              data-store-logo=""
              data-logo-source={footerLogoSource}
              data-logo-class="xs-footer__logo"
              data-template-logo={templateFooterLogo ?? undefined}
            >
              {footerLogo ? (
                // A picture on this storefront or the store's media.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={footerLogo} alt={store.name} className="xs-footer__logo" data-xs-logo={footerLogoSource === "template" ? "template" : undefined} data-xs-pic="logo" />
              ) : (
                <span className="xs-footer__name" data-xs-pic="logo">
                  {store.name}
                </span>
              )}
            </h4>
            {about && <p className="xs-footer__text">{about}</p>}
            {Object.keys(social).length > 0 && (
              <div className="xs-footer__social">
                <SocialLinks links={social} />
              </div>
            )}
          </div>
        );
      case "contact":
        return (
          <div key={col.id} className="xs-footer__col" data-xs-col={col.id} style={style}>
            <h4 className="xs-footer__title">{col.title ?? (ar ? "تواصل معنا" : "Get in touch")}</h4>
            {info?.phone && (
              <p className="xs-footer__text">
                <a href={`tel:${info.phone}`} className="xs-footer__link" dir="ltr">
                  {info.phone}
                </a>
              </p>
            )}
            {lines.map((line, i) => (
              <p key={i} className="xs-footer__text">
                {line}
              </p>
            ))}
          </div>
        );
      case "newsletter":
        return (
          <div key={col.id} className="xs-footer__col" data-xs-col={col.id} style={style}>
            <h4 className="xs-footer__title">{col.title ?? (ar ? "النشرة البريدية" : "Newsletter")}</h4>
            {lines.length > 0 && <p className="xs-footer__text">{lines.join(" ")}</p>}
            <XsNewsletterForm
              workspaceId={store.id}
              elementId={`footer-${col.id}`}
              formName={col.title ?? (ar ? "النشرة البريدية" : "Newsletter")}
              placeholder={ar ? "بريدك الإلكتروني" : "Your email address"}
              buttonLabel={ar ? "اشترك" : "Subscribe"}
              disabled={false}
              copy={
                ar
                  ? { sending: "جارٍ الإرسال…", sent: "تم اشتراكك. شكرًا لك.", error: "تعذّر الاشتراك. حاول مرة أخرى.", needEmail: "اكتب بريدًا إلكترونيًا صحيحًا." }
                  : { sending: "Sending…", sent: "You are subscribed. Thank you.", error: "Could not subscribe. Please try again.", needEmail: "Enter a valid email address." }
              }
            />
          </div>
        );
      case "social":
        return (
          <div key={col.id} className="xs-footer__col" data-xs-col={col.id} style={style}>
            <h4 className="xs-footer__title">{col.title ?? (ar ? "تابعنا" : "Follow us")}</h4>
            <div className="xs-footer__social">
              <SocialLinks links={social} />
            </div>
          </div>
        );
      case "payments": {
        // The ways a shopper can pay, as the merchant names them, one a line; the common ones in Egypt until then.
        const methods = lines.length > 0 ? lines : ar ? ["الدفع عند الاستلام", "فيزا", "ماستركارد", "ميزة", "فودافون كاش", "إنستاباي"] : ["Cash on delivery", "Visa", "Mastercard", "Meeza", "Vodafone Cash", "InstaPay"];
        return (
          <div key={col.id} className="xs-footer__col" data-xs-col={col.id} style={style}>
            <h4 className="xs-footer__title">{col.title ?? (ar ? "طرق الدفع" : "We accept")}</h4>
            <ul className="xs-footer__pay">
              {methods.map((method) => (
                <li key={method}>{method}</li>
              ))}
            </ul>
          </div>
        );
      }
    }
  }

  return (
    <footer className="xs-footer" data-xs-look={look} data-zimos-shell="footer" style={own as CSSProperties}>
      {/* Whole numbers only, clamped by lib/storeShell (./shellSizes). */}
      {sizeCss ? <style dangerouslySetInnerHTML={{ __html: sizeCss }} /> : null}
      <div className="xs-footer__grid">
        {columns.map((col) => {
          // A column left off some screens (xs-shell.css [data-xs-hide]).
          const node = column(col);
          return col.hide && isValidElement(node) ? cloneElement(node as ReactElement<Record<string, unknown>>, { "data-xs-hide": col.hide.join(" ") }) : node;
        })}
      </div>

      <div className="xs-footer__bottom" data-xs-zone="bottom">
        {/* The licence's credit stays whatever the merchant arranges: after the rights line, else first. */}
        {!bottom.some((part) => part.type === "rights") && creditLine}
        {bottom.map((part) =>
          part.type === "rights" ? (
            <Fragment key={part.id}>
              <p data-xs-part={part.id}>{t.footer.rights(store.name, year)}</p>
              {creditLine}
            </Fragment>
          ) : part.type === "powered" ? (
            !brandingRemoved(store) && (
              <span key={part.id} className="xs-part" data-xs-part={part.id}>
                <PoweredByZimos label={t.footer.poweredBy} />
              </span>
            )
          ) : (
            <p key={part.id} data-xs-part={part.id}>
              {part.label}
            </p>
          )
        )}
      </div>
    </footer>
  );
}
