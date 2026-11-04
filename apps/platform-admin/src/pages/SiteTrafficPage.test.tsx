import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@store-builder/api-client";
import { LocaleProvider } from "@/i18n/LocaleContext";
import type { SiteDetailsSummary, SiteProtectionSummary, SiteTrafficSummary, SiteVisitPage, SiteVisitTimeline } from "@/lib/siteTrafficApi";
import * as api from "@/lib/siteTrafficApi";
import { SiteTrafficPage } from "./SiteTrafficPage";

/**
 * The console's Site traffic page with the API mocked. VITE_SITE_TRAFFIC_DETAILS_ENABLED
 * off: the summary it always was. On: the tabs modeled on Store traffic — the
 * filters in the address, the visits and one visit in order with its account,
 * the campaigns, the protection counts — in English and Arabic (right to left),
 * and with the theme's colours only, so the dark look draws it too.
 */

const flags = vi.hoisted(() => ({ details: true }));

vi.mock("@/lib/features", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features")>();
  return {
    ...actual,
    get SITE_TRAFFIC_DETAILS_ENABLED() {
      return flags.details;
    },
  };
});

vi.mock("@/lib/siteTrafficApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/siteTrafficApi")>();
  return {
    ...actual,
    getSummary: vi.fn(),
    getDetailsSummary: vi.fn(),
    getCampaigns: vi.fn(),
    getVisits: vi.fn(),
    getVisit: vi.fn(),
    getProtection: vi.fn(),
  };
});

vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ can: () => true }) }));

const mocked = vi.mocked(api);

const OLD_SUMMARY: SiteTrafficSummary = {
  enabled: true,
  range: "7d",
  since: "2026-10-17T00:00:00.000Z",
  visits: 40,
  uniqueVisitors: 12,
  avgSecondsOnSite: 75,
  topPages: [{ path: "/pricing", visits: 9 }],
  topSources: [{ source: "facebook", sessions: 6 }],
  funnel: { visit: 15, ctaClick: 4, signup: 2 },
  daily: [{ day: "2026-10-22", visits: 40, uniqueVisitors: 12 }],
};

const SUMMARY: SiteDetailsSummary = {
  range: "7d",
  from: "2026-10-17T00:00:00.000Z",
  to: "2026-10-23T10:00:00.000Z",
  sessions: 15,
  views: 40,
  visitors: 12,
  avgSecondsPerSession: 75,
  signups: 2,
  conversionRate: 13.3,
  funnel: [
    { key: "visit", sessions: 15, dropRate: null },
    { key: "signup_click", sessions: 4, dropRate: 73.3 },
    { key: "signup", sessions: 2, dropRate: 50 },
  ],
  daily: [{ day: "2026-10-22", views: 40, visitors: 12 }],
  pages: [{ path: "/pricing", views: 9, seconds: 270, avgSecondsPerView: 30 }],
  sources: [
    { source: "facebook", sessions: 6, signups: 2 },
    { source: "direct", sessions: 9, signups: 0 },
  ],
  countries: [{ country: "EG", sessions: 15 }],
  governorates: [{ governorate: "giza", sessions: 5 }],
  devices: [{ device: "mobile", sessions: 11 }],
  browsers: [{ browser: "Chrome", sessions: 15 }],
};

const VISITS: SiteVisitPage = {
  range: "7d",
  page: 1,
  pageSize: 25,
  total: 1,
  sessions: [
    {
      sessionId: "site-session-1",
      startedAt: "2026-10-22T09:00:00.000Z",
      lastSeenAt: "2026-10-22T09:02:00.000Z",
      source: "facebook",
      utmSource: "facebook",
      utmMedium: "cpc",
      utmCampaign: "eid",
      referrerHost: null,
      landingPath: "/ar/pricing",
      locale: "ar",
      country: "EG",
      governorate: "giza",
      device: "mobile",
      browser: "Chrome",
      pages: 2,
      seconds: 45,
      ctaClicks: 1,
      signedUp: true,
      userId: "user-1",
    },
  ],
};

const TIMELINE: SiteVisitTimeline = {
  session: {
    sessionId: "site-session-1",
    startedAt: "2026-10-22T09:00:00.000Z",
    lastSeenAt: "2026-10-22T09:02:00.000Z",
    utmSource: "facebook",
    utmMedium: "cpc",
    utmCampaign: "eid",
    referrerHost: null,
    landingPath: "/ar/pricing",
    locale: "ar",
    country: "EG",
    governorate: "giza",
    device: "mobile",
    browser: "Chrome",
    seconds: 45,
    userId: "user-1",
  },
  events: [
    { at: "2026-10-22T09:00:00.000Z", type: "view", path: "/ar/pricing", seconds: 0, userId: null },
    { at: "2026-10-22T09:00:15.000Z", type: "ping", path: "/ar/pricing", seconds: 15, userId: null },
    { at: "2026-10-22T09:01:00.000Z", type: "cta_register", path: "/ar/pricing", seconds: 0, userId: null },
    { at: "2026-10-22T09:02:00.000Z", type: "signup", path: null, seconds: 0, userId: "user-1" },
  ],
};

const PROTECTION: SiteProtectionSummary = {
  scope: "site",
  enabled: true,
  originCheck: "allowlist",
  range: "30d",
  totals: { bot: 7, rejected: 3, suspicious: 0, capped: 0 },
  byReason: [
    { kind: "bot", reason: "bad_bot", count: 7 },
    { kind: "rejected", reason: "origin_mismatch", count: 3 },
  ],
  bySource: [{ kind: "rejected", reason: "origin_mismatch", label: "evil.example", count: 3 }],
  byCountry: [{ country: "US", bot: 7, rejected: 3, suspicious: 0, capped: 0 }],
  daily: [{ day: "2026-10-22", bot: 7, rejected: 3, suspicious: 0, capped: 0 }],
};

const FIXED_COLOURS = /\b(?:bg|text|border|ring|fill|stroke)-(?:white|black|(?:gray|slate|zinc|neutral|stone|red|green|blue|yellow)-\d{2,3})\b|#[0-9a-f]{3,8}\b/i;

function renderPage(query = "") {
  return render(
    <LocaleProvider>
      <MemoryRouter initialEntries={[`/site-traffic${query}`]}>
        <SiteTrafficPage />
      </MemoryRouter>
    </LocaleProvider>
  );
}

beforeEach(() => {
  flags.details = true;
  vi.clearAllMocks();
  mocked.getSummary.mockResolvedValue(OLD_SUMMARY);
  mocked.getDetailsSummary.mockResolvedValue(SUMMARY);
  mocked.getVisits.mockResolvedValue(VISITS);
  mocked.getVisit.mockResolvedValue(TIMELINE);
  mocked.getCampaigns.mockResolvedValue({
    range: "7d",
    from: SUMMARY.from,
    to: SUMMARY.to,
    campaigns: [{ source: "facebook", medium: "cpc", campaign: "eid", sessions: 6, ctaClicks: 3, signups: 2, conversionRate: 33.3 }],
  });
  mocked.getProtection.mockResolvedValue(PROTECTION);
  document.documentElement.classList.remove("dark");
});
afterEach(() => document.documentElement.classList.remove("dark"));

describe("VITE_SITE_TRAFFIC_DETAILS_ENABLED off", () => {
  it("is the summary page it was, and asks nothing of the detail endpoints", async () => {
    flags.details = false;
    renderPage();
    expect(await screen.findByText("Avg. time on site")).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "Visits" })).toBeNull();
    expect(mocked.getSummary).toHaveBeenCalledWith("7d");
    expect(mocked.getDetailsSummary).not.toHaveBeenCalled();
  });
});

describe("the detailed page", () => {
  it("overview: the numbers, the funnel to an account, places, devices and time per page", async () => {
    renderPage();
    expect(await screen.findByText("Sessions")).toBeTruthy();
    expect(screen.getAllByRole("radio").map((r) => r.textContent)).toEqual(expect.arrayContaining(["Overview", "Visits", "Campaigns", "Protection", "Today", "7 days", "30 days", "90 days"]));
    expect(screen.getByText("13.3%")).toBeTruthy();
    expect(screen.getByText("Clicked sign up")).toBeTruthy();
    expect(screen.getByText("Created an account")).toBeTruthy();
    expect(screen.getByText("73.3% dropped")).toBeTruthy();
    expect(screen.getAllByText("Giza").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mobile").length).toBeGreaterThan(0);
    expect(screen.getByText("/pricing")).toBeTruthy();
    expect(screen.getByText("4m 30s")).toBeTruthy();
    expect(mocked.getDetailsSummary).toHaveBeenCalledWith({ range: "7d", country: undefined, governorate: undefined, device: undefined, source: undefined });
  });

  it("the filters come from the address, and picking a source filters by it", async () => {
    renderPage("?range=90d&country=EG&governorate=giza&device=mobile");
    await screen.findByText("Sessions");
    expect(mocked.getDetailsSummary).toHaveBeenLastCalledWith({ range: "90d", country: "EG", governorate: "giza", device: "mobile", source: undefined });
    fireEvent.click(screen.getByRole("button", { name: /facebook/ }));
    await waitFor(() => expect(mocked.getDetailsSummary).toHaveBeenLastCalledWith(expect.objectContaining({ range: "90d", source: "facebook" })));
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(mocked.getDetailsSummary).toHaveBeenLastCalledWith({ range: "90d", country: undefined, governorate: undefined, device: undefined, source: undefined }));
  });

  it("visits: one page sorted as asked; a visit opens its events in order with a link to its account", async () => {
    renderPage("?tab=visits&sort=pages");
    expect(await screen.findByText("/ar/pricing")).toBeTruthy();
    expect(mocked.getVisits).toHaveBeenCalledWith(expect.objectContaining({ range: "7d", page: 1, pageSize: 25, sort: "pages" }));
    expect(screen.getByText("eid")).toBeTruthy();
    // The column's head and the visit's badge.
    expect(screen.getAllByText("Signed up")).toHaveLength(2);
    fireEvent.click(screen.getByText("/ar/pricing"));
    const drawer = await screen.findByRole("dialog");
    await within(drawer).findByText("What they did");
    expect(mocked.getVisit).toHaveBeenCalledWith("site-session-1");
    const steps = within(drawer).getAllByRole("listitem").map((li) => li.querySelector("span")?.textContent);
    expect(steps).toEqual(["Viewed a page", "Still on the page", "Clicked sign up", "Created an account"]);
    expect(within(drawer).getByText("facebook / cpc / eid")).toBeTruthy();
    const links = within(drawer).getAllByRole("link", { name: "Open the account" });
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/users/user-1", "/users/user-1"]);
  });

  it("campaigns: sessions, sign-up clicks, sign-ups and conversion per UTM source / medium / campaign", async () => {
    renderPage("?tab=campaigns");
    expect(await screen.findByText("Sign-up / sign-in clicks")).toBeTruthy();
    const row = screen.getByText("eid").closest("tr");
    expect(row && within(row).getAllByRole("cell").map((c) => c.textContent)).toEqual(["facebook", "cpc", "eid", "6", "3", "2", "33.3%"]);
  });

  it("protection: bots and refusals by reason; 90 days says counts are kept 30", async () => {
    renderPage("?tab=protection&range=90d");
    expect(await screen.findByText("Bots · Script or scanner")).toBeTruthy();
    expect(screen.getByText("Refused · Origin not allowed")).toBeTruthy();
    expect(screen.getByText("Counts are kept 30 days, so this covers the last 30 days only.")).toBeTruthy();
    expect(screen.getByText(/Allowed origins only/)).toBeTruthy();
    expect(mocked.getProtection).toHaveBeenCalledWith("90d");
  });

  it("says plainly when the API's SITE_TRAFFIC_DETAILS_ENABLED is off (404)", async () => {
    mocked.getDetailsSummary.mockRejectedValue(new ApiError("Not found", 404, "NOT_FOUND"));
    renderPage();
    expect(await screen.findByText("Site visit details are off on the API (SITE_TRAFFIC_DETAILS_ENABLED).")).toBeTruthy();
  });
});

describe("Arabic and the dark look", () => {
  it("draws the tabs, the filters and a visit in Arabic, right to left", async () => {
    localStorage.setItem("zimos.console.locale", "ar");
    renderPage("?tab=visits");
    expect(await screen.findByRole("heading", { name: "زيارات الموقع" })).toBeTruthy();
    await waitFor(() => expect(document.documentElement.dir).toBe("rtl"));
    for (const label of ["نظرة عامة", "الزيارات", "الحملات", "الحماية", "90 يومًا"]) expect(screen.getByRole("radio", { name: label })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "المحافظة" })).toBeTruthy();
    await screen.findByText("/ar/pricing");
    fireEvent.click(screen.getByText("/ar/pricing"));
    const drawer = await screen.findByRole("dialog");
    expect(await within(drawer).findByText("ضغط على التسجيل")).toBeTruthy();
    expect(within(drawer).getAllByRole("link", { name: "فتح الحساب" }).length).toBeGreaterThan(0);
  });

  it("uses only the theme's colours, in every tab and in a visit", async () => {
    document.documentElement.classList.add("dark");
    for (const tab of ["", "?tab=campaigns", "?tab=protection"]) {
      const { unmount } = renderPage(tab);
      await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
      expect(document.body.innerHTML).not.toMatch(FIXED_COLOURS);
      unmount();
    }
    renderPage("?tab=visits");
    fireEvent.click(await screen.findByText("/ar/pricing"));
    const drawer = await screen.findByRole("dialog");
    await within(drawer).findByText("What they did");
    // The sheet itself; its backdrop is the console's shared Drawer (dark:bg-black/55 by design).
    expect(drawer.outerHTML).not.toMatch(FIXED_COLOURS);
  });
});
