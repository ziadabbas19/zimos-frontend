import { API_BASE_URL, DASHBOARD_URL } from "@/lib/urls";

/**
 * Anonymous visit counting for this site, shown in the platform console.
 * No cookies and no third-party code: a random id in localStorage (the API
 * keeps only a daily hash of it), a random id per tab session in
 * sessionStorage, and nothing at all when the browser asks not to be tracked
 * (Do Not Track or Global Privacy Control). Every failure is silent.
 *
 * Off unless NEXT_PUBLIC_SITE_ANALYTICS_ENABLED is exactly "true".
 */

export const SITE_ANALYTICS_ENABLED = process.env.NEXT_PUBLIC_SITE_ANALYTICS_ENABLED === "true";

/**
 * A sign-up / sign-in click says which of the two it was (`cta`), so the
 * console's funnel counts sign-up clicks only. Turn it on after the API's
 * SITE_TRAFFIC_DETAILS_ENABLED: an API without it refuses the field, and the
 * click would not be counted at all.
 */
export const SITE_TRAFFIC_DETAILS_ENABLED = process.env.NEXT_PUBLIC_SITE_TRAFFIC_DETAILS_ENABLED === "true";

/**
 * Who the visitor is, for the console: each page view also sends the screen
 * size, the browser's language, the model and OS version from Client Hints
 * (Chromium only; others send none) and whether the dashboard says this
 * browser is signed in (its `zimos-signed-in` cookie on .zimos.co); and the
 * sign-in link carries this session too (?sv=), so the account is tied to the
 * visits. Turn it on after the API's SITE_VISITOR_DETAILS_ENABLED.
 */
export const SITE_VISITOR_DETAILS_ENABLED = process.env.NEXT_PUBLIC_SITE_VISITOR_DETAILS_ENABLED === "true";

const VISITOR_KEY = "zimos.site.visitor";
const SESSION_KEY = "zimos.site.session";
export const PING_MS = 15_000;

type SiteEvent = "view" | "ping" | "cta_click";

type Payload = {
  visitorId: string;
  sessionId: string;
  event: SiteEvent;
  path: string;
  locale?: "ar" | "en";
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  cta?: "register" | "login";
  screen?: string;
  language?: string;
  signedIn?: boolean;
  uaModel?: string;
  uaPlatformVersion?: string;
};

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function stored(storage: Storage, key: string): string {
  const existing = storage.getItem(key);
  if (existing && /^[A-Za-z0-9-]{8,64}$/.test(existing)) return existing;
  const fresh = randomId();
  storage.setItem(key, fresh);
  return fresh;
}

/** Do Not Track or Global Privacy Control: the visitor asked not to be counted. */
export function trackingRefused(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  const win = window as Window & { doNotTrack?: string };
  const dnt = nav.doNotTrack ?? win.doNotTrack ?? nav.msDoNotTrack;
  return nav.globalPrivacyControl === true || dnt === "1" || dnt === "yes";
}

let ids: { visitorId: string; sessionId: string } | null = null;

/** The visitor and session ids, or null when counting is off or refused. */
export function siteIds(): { visitorId: string; sessionId: string } | null {
  if (!SITE_ANALYTICS_ENABLED || typeof window === "undefined") return null;
  if (ids) return ids;
  try {
    if (trackingRefused()) return null;
    ids = { visitorId: stored(window.localStorage, VISITOR_KEY), sessionId: stored(window.sessionStorage, SESSION_KEY) };
    return ids;
  } catch {
    return null;
  }
}

const clip = (value: string | null | undefined, max: number) => (value ? value.slice(0, max) : undefined);

function localeOf(path: string): "ar" | "en" | undefined {
  const first = path.split("/")[1];
  return first === "ar" || first === "en" ? first : undefined;
}

let firstViewSent = false;

/** The dashboard's sign-in hint: "1" signed in, "0" signed out; none (never opened here) is unknown. */
export function readSignedIn(cookies: string): boolean | undefined {
  const value = /(?:^|;\s*)zimos-signed-in=([^;]*)/.exec(cookies)?.[1];
  return value === "1" ? true : value === "0" ? false : undefined;
}

type HighEntropy = { model?: string; platformVersion?: string };
type UserAgentData = { getHighEntropyValues?: (hints: string[]) => Promise<HighEntropy> };

let hints: HighEntropy = {};
let hintsReady: Promise<void> | null = null;

/** Client Hints, asked once; waited for at most 300 ms so a view is never held back long. */
function clientHints(): Promise<void> {
  if (hintsReady) return hintsReady;
  const data = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData;
  if (!data?.getHighEntropyValues) return (hintsReady = Promise.resolve());
  const ask = data.getHighEntropyValues(["model", "platformVersion"]).then(
    (v) => {
      hints = { model: v.model || undefined, platformVersion: v.platformVersion || undefined };
    },
    () => undefined
  );
  hintsReady = Promise.race([ask, new Promise<void>((resolve) => window.setTimeout(resolve, 300))]);
  return hintsReady;
}

/** What a page view says about the visitor (SITE_VISITOR_DETAILS_ENABLED); anything unreadable is left out. */
function visitorFields(): Partial<Payload> {
  const out: Partial<Payload> = {};
  try {
    const w = Math.round(window.screen.width);
    const h = Math.round(window.screen.height);
    if (w > 0 && h > 0 && w < 100000 && h < 100000) out.screen = `${w}x${h}`;
  } catch {
    // No screen: left out.
  }
  if (navigator.language && /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8}){0,2}$/.test(navigator.language)) out.language = navigator.language;
  try {
    out.signedIn = readSignedIn(document.cookie);
  } catch {
    // Cookies blocked: unknown.
  }
  if (hints.model) out.uaModel = hints.model.slice(0, 60);
  if (hints.platformVersion) out.uaPlatformVersion = hints.platformVersion.slice(0, 20);
  return out;
}

function post(body: Payload): void {
  try {
    // text/plain keeps this a simple request: no CORS preflight.
    void fetch(`${API_BASE_URL}/public/site-events`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(body),
      keepalive: true,
      credentials: "omit",
      mode: "cors",
    }).catch(() => undefined);
  } catch {
    // Never surfaces.
  }
}

export function sendSiteEvent(event: SiteEvent, path = window.location.pathname, cta?: "register" | "login"): void {
  const current = siteIds();
  if (!current) return;
  const body: Payload = { ...current, event, path: clip(path, 300) || "/", locale: localeOf(path) };
  if (event === "cta_click" && cta && SITE_TRAFFIC_DETAILS_ENABLED) body.cta = cta;

  // Where the visit came from goes with the session's first view only.
  if (event === "view" && !firstViewSent) {
    firstViewSent = true;
    const params = new URLSearchParams(window.location.search);
    body.utmSource = clip(params.get("utm_source"), 100);
    body.utmMedium = clip(params.get("utm_medium"), 100);
    body.utmCampaign = clip(params.get("utm_campaign"), 100);
    try {
      if (document.referrer && new URL(document.referrer).host !== window.location.host) {
        body.referrer = clip(document.referrer, 500);
      }
    } catch {
      // An unreadable referrer is left out.
    }
  }

  if (SITE_VISITOR_DETAILS_ENABLED && event === "view") {
    void clientHints().then(() => post({ ...body, ...visitorFields() }));
    return;
  }
  post(body);
}

/** A sign-up or sign-in link into the dashboard, or null for any other link. */
export function dashboardCta(href: string): "register" | "login" | null {
  if (href.startsWith(`${DASHBOARD_URL}/register`)) return "register";
  if (href.startsWith(`${DASHBOARD_URL}/login`)) return "login";
  return null;
}

/** The sign-up link with this session's id as ?sv=, so the account links to it. */
export function withSiteSession(href: string, sessionId: string): string {
  try {
    const url = new URL(href);
    url.searchParams.set("sv", sessionId);
    return url.toString();
  } catch {
    return href;
  }
}
