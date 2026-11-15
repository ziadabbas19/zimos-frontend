/**
 * The site's light / dark choice, shared with the dashboard's sign-in screens.
 *
 * The choice itself stays in localStorage ("theme"), as it always was. The
 * dashboard lives on another host (app.zimos.co), which cannot read this
 * site's storage, so the same choice is also written to a cookie on the
 * parent domain: its sign-in and sign-up screens open in it
 * (apps/merchant-dashboard/src/lib/siteTheme.ts). The cookie holds the theme
 * and nothing else, and is written only for a choice the visitor made: with
 * none, both sites follow the device.
 */

export type SiteTheme = "light" | "dark";

export const THEME_COOKIE = "zimos-theme";
/** A year, renewed on every visit that finds a choice (lib/theme-script.ts). */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * `.zimos.co` on this site and its subdomains, so app.zimos.co reads it.
 * Anywhere else (localhost, a preview host) none: the cookie stays on that host.
 */
export function themeCookieDomain(hostname: string): string | null {
  const host = hostname.toLowerCase();
  return host === "zimos.co" || host.endsWith(".zimos.co") ? ".zimos.co" : null;
}

/** The `document.cookie` line for a choice. `Secure` over HTTPS only: a page served over HTTP could not set it. */
export function themeCookie(theme: SiteTheme, where: { hostname: string; protocol: string }): string {
  const domain = themeCookieDomain(where.hostname);
  return [
    `${THEME_COOKIE}=${theme}`,
    "Path=/",
    `Max-Age=${THEME_COOKIE_MAX_AGE}`,
    "SameSite=Lax",
    ...(domain ? [`Domain=${domain}`] : []),
    ...(where.protocol === "https:" ? ["Secure"] : []),
  ].join("; ");
}

export function writeThemeCookie(theme: SiteTheme): void {
  try {
    document.cookie = themeCookie(theme, window.location);
  } catch {
    /* cookies blocked: the dashboard's sign-in screens follow the device */
  }
}
