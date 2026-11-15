import { preferScheme } from "@store-builder/ui/appearance";

/**
 * The sign-in screens open in the theme the visitor chose on the marketing
 * site (zimos.co), which keeps it in a cookie on .zimos.co for this host to
 * read (apps/marketing/src/lib/theme-cookie.ts). Read only: nothing here
 * writes it, and nothing of it is kept on this device or on the account.
 *
 * What opens, on those screens:
 *   1. a look chosen in this dashboard on this device (lib/appearance.ts);
 *   2. else the site's theme, from the cookie;
 *   3. else the device's scheme; 4. light.
 * Everywhere else the dashboard is as it was: 1, 3, 4.
 *
 * The pre-paint script in index.html does the same before the first frame,
 * with the same paths and the same cookie; a test compares the two.
 */

export type SiteTheme = "light" | "dark";

export const SITE_THEME_COOKIE = "zimos-theme";

/**
 * The screens in AuthShell's split layout, for someone signed out: sign in,
 * sign up, the password and email links, a team invite, the Google landing.
 * The steps after signing in (username, plan, the store picker, which is also
 * the dashboard's store switcher) keep the dashboard's own look.
 */
export const SITE_THEMED_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/invites",
  "/auth/callback",
] as const;

/** The site's theme from a `document.cookie` string: the first `zimos-theme`, when it holds `light` or `dark`; anything else is none. */
export function readSiteTheme(cookies: string): SiteTheme | null {
  const value = /(?:^|;\s*)zimos-theme=([^;]*)/.exec(cookies)?.[1];
  return value === "light" || value === "dark" ? value : null;
}

/** Whether a path is one of those screens; as the router matches them, with a trailing slash and in any case. */
export function isSiteThemedPath(pathname: string): boolean {
  const path = pathname.toLowerCase();
  return SITE_THEMED_PATHS.some((screen) => path === screen || path === `${screen}/`);
}

function cookies(): string {
  try {
    return document.cookie;
  } catch {
    return "";
  }
}

/** On those screens, open in the site's theme while nothing was chosen here; elsewhere, let go of it. */
export function followSiteTheme(pathname: string, cookieString: string = cookies()): void {
  preferScheme(isSiteThemedPath(pathname) ? readSiteTheme(cookieString) : null);
}
