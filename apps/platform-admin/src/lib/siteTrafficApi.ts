import { apiClient } from "@/lib/apiClient";
import { trafficQuery } from "@/lib/storeTrafficApi";

/** Anonymous visits to the marketing site (backend siteAnalytics/siteTrafficService). */
export type SiteTrafficRange = "today" | "7d" | "30d";
export const SITE_TRAFFIC_RANGES: SiteTrafficRange[] = ["today", "7d", "30d"];

export interface SiteTrafficSummary {
  /** Whether the API is collecting (SITE_ANALYTICS_ENABLED); the numbers are shown either way. */
  enabled: boolean;
  range: SiteTrafficRange;
  since: string;
  visits: number;
  /** A visitor's id changes every UTC day, so over several days this is the sum of each day's. */
  uniqueVisitors: number;
  avgSecondsOnSite: number;
  topPages: Array<{ path: string; visits: number }>;
  topSources: Array<{ source: string; sessions: number }>;
  /** Sessions that viewed a page, clicked sign-up / sign-in, and signed up. */
  funnel: { visit: number; ctaClick: number; signup: number };
  /** One row per UTC day, oldest first. */
  daily: Array<{ day: string; visits: number; uniqueVisitors: number }>;
}

export function getSummary(range: SiteTrafficRange) {
  return apiClient.request<SiteTrafficSummary>(`/admin/site-traffic/summary?range=${encodeURIComponent(range)}`);
}

/**
 * zimos.co visits in detail (SITE_TRAFFIC_DETAILS_ENABLED on the API,
 * /admin/site-traffic/{details/summary,campaigns,sessions,protection},
 * overview.view). A session is described by its first view: source (UTM,
 * else the referring host, else direct), first page, place, device. The
 * filters apply to that. Days are UTC days; time is pings × 15 s.
 */
export type SiteDetailsRange = "today" | "7d" | "30d" | "90d";
export const SITE_DETAILS_RANGES: SiteDetailsRange[] = ["today", "7d", "30d", "90d"];
export type SiteVisitSort = "recent" | "started" | "pages";
export const SITE_VISIT_SORTS: SiteVisitSort[] = ["recent", "started", "pages"];
/** The beacon's device classes (backend siteTrafficService.deviceClass). */
export const SITE_DEVICES = ["mobile", "tablet", "desktop", "unknown"] as const;

export interface SiteFilters {
  range: SiteDetailsRange;
  country?: string;
  governorate?: string;
  device?: string;
  source?: string;
}

export interface SiteFunnelStep {
  key: "visit" | "signup_click" | "signup";
  sessions: number;
  /** Percent of the step before that did not reach this one (null on the first). */
  dropRate: number | null;
}

export interface SiteDetailsSummary {
  range: SiteDetailsRange;
  from: string;
  to: string;
  sessions: number;
  views: number;
  /** A visitor's id changes every UTC day: over several days, the sum of each day's. */
  visitors: number;
  avgSecondsPerSession: number | null;
  signups: number;
  conversionRate: number | null;
  funnel: SiteFunnelStep[];
  daily: Array<{ day: string; views: number; visitors: number }>;
  pages: Array<{ path: string; views: number; seconds: number; avgSecondsPerView: number | null }>;
  sources: Array<{ source: string; sessions: number; signups: number }>;
  countries: Array<{ country: string | null; sessions: number }>;
  /** Only from Cloudflare's region header (ANALYTICS_GEO_HEADERS); other visits have none. */
  governorates: Array<{ governorate: string; sessions: number }>;
  devices: Array<{ device: string; sessions: number }>;
  browsers: Array<{ browser: string; sessions: number }>;
}

export interface SiteCampaignRow {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  sessions: number;
  ctaClicks: number;
  signups: number;
  conversionRate: number | null;
}

export interface SiteVisitRow {
  sessionId: string;
  startedAt: string;
  lastSeenAt: string;
  source: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrerHost: string | null;
  landingPath: string | null;
  locale: string | null;
  country: string | null;
  governorate: string | null;
  device: string;
  browser: string | null;
  pages: number;
  seconds: number;
  ctaClicks: number;
  signedUp: boolean;
  /** The account the visit created (the console's /users/<id>). */
  userId: string | null;
}

export interface SiteVisitPage {
  range: SiteDetailsRange;
  page: number;
  pageSize: number;
  total: number;
  sessions: SiteVisitRow[];
}

export interface SiteVisitTimeline {
  session: Omit<SiteVisitRow, "source" | "pages" | "ctaClicks" | "signedUp">;
  /** view, ping, cta_register, cta_login, cta_click (kind not recorded), signup. */
  events: Array<{ at: string; type: string; path: string | null; seconds: number; userId: string | null }>;
}

/** What the guard kept out of the beacon, per day; nothing of it is stored but the counts. */
export interface SiteProtectionSummary {
  scope: "site";
  enabled: boolean;
  originCheck: "allowlist";
  range: "today" | "7d" | "30d";
  totals: { bot: number; rejected: number; suspicious: number; capped: number };
  byReason: Array<{ kind: string; reason: string; count: number }>;
  bySource: Array<{ kind: string; reason: string; label: string; count: number }>;
  byCountry: Array<{ country: string | null; bot: number; rejected: number; suspicious: number; capped: number }>;
  daily: Array<{ day: string; bot: number; rejected: number; suspicious: number; capped: number }>;
}

const getDetail = <T>(path: string, params: Record<string, string | number | undefined | null> = {}) =>
  apiClient.request<T>(`/admin/site-traffic/${path}${trafficQuery(params)}`);

export const getDetailsSummary = (f: SiteFilters) => getDetail<SiteDetailsSummary>("details/summary", { ...f });
export const getCampaigns = (f: SiteFilters) => getDetail<{ range: SiteDetailsRange; from: string; to: string; campaigns: SiteCampaignRow[] }>("campaigns", { ...f });
export const getVisits = (f: SiteFilters & { page: number; pageSize: number; sort: SiteVisitSort }) => getDetail<SiteVisitPage>("sessions", { ...f });
export const getVisit = (sessionId: string) => getDetail<SiteVisitTimeline>(`sessions/${encodeURIComponent(sessionId)}`);
/** Counts are kept 30 days: a 90-day view asks for 30. */
export const getProtection = (range: SiteDetailsRange) => getDetail<SiteProtectionSummary>("protection", { range: range === "90d" ? "30d" : range });

/**
 * The Live view (VITE_SITE_LIVE_ENABLED; the API's /admin/site-traffic/live,
 * behind its SITE_LIVE_ENABLED): the sessions seen in the last five
 * minutes, newest first, asked again every 15 seconds. A session is a browser
 * tab; the visitor's id changes every UTC day, so nothing ties it to another day.
 */
export interface SiteLiveVisitor {
  sessionId: string;
  lastSeenAt: string;
  startedAt: string | null;
  /** Seen within `activeSeconds` (the beacon pings every 15 s while the tab shows). */
  active: boolean;
  country: string | null;
  governorate: string | null;
  source: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrerHost: string | null;
  device: string | null;
  browser: string | null;
  /** Kept since migration 709; null on visits from before. */
  os: string | null;
  locale: string | null;
  currentPath: string | null;
  /** kind null: which link it was is kept only with the API's SITE_TRAFFIC_DETAILS_ENABLED. */
  lastCta: { kind: "register" | "login" | null; at: string } | null;
}

export interface SiteLive {
  at: string;
  windowSeconds: number;
  activeSeconds: number;
  active: number;
  visitors: SiteLiveVisitor[];
}

export const SITE_LIVE_POLL_MS = 15_000;
export const getLive = () => getDetail<SiteLive>("live");
