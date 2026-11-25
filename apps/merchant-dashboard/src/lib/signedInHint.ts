/**
 * Whether this browser is signed in here, for the marketing site's visit counts
 * (the console's Site visits, VITE_SITE_VISITOR_DETAILS_ENABLED): a
 * `zimos-signed-in` cookie on .zimos.co holding 1 or 0 and nothing else (no id,
 * no token). The site's beacon reads it (apps/marketing/src/lib/site-analytics.ts).
 * Written on zimos.co hosts only; anywhere else, nothing.
 */

export const SIGNED_IN_COOKIE = "zimos-signed-in";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** The `document.cookie` line, or null on a host that is not zimos.co. `Secure` over HTTPS only. */
export function signedInCookie(signedIn: boolean, where: Pick<Location, "hostname" | "protocol">): string | null {
  const host = where.hostname.toLowerCase();
  if (host !== "zimos.co" && !host.endsWith(".zimos.co")) return null;
  const secure = where.protocol === "https:" ? "; Secure" : "";
  return `${SIGNED_IN_COOKIE}=${signedIn ? "1" : "0"}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax; Domain=.zimos.co${secure}`;
}

export function writeSignedInHint(signedIn: boolean): void {
  try {
    const line = signedInCookie(signedIn, window.location);
    if (line) document.cookie = line;
  } catch {
    // Cookies blocked: the site counts the visit without it.
  }
}
