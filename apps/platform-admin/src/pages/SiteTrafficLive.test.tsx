import { act, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@store-builder/api-client";
import { LocaleProvider } from "@/i18n/LocaleContext";
import type { SiteLive } from "@/lib/siteTrafficApi";
import * as api from "@/lib/siteTrafficApi";
import { SiteTrafficPage } from "./SiteTrafficPage";

/**
 * The Live tab of Site traffic (VITE_SITE_LIVE_ENABLED, inside the detailed
 * page): who is on zimos.co in the last five minutes, read again every 15
 * seconds — place, source and UTM, device, browser and system, page now and
 * last click. Off, there is no such tab and the API is never asked.
 */

const flags = vi.hoisted(() => ({ live: true }));

vi.mock("@/lib/features", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features")>();
  return {
    ...actual,
    SITE_TRAFFIC_DETAILS_ENABLED: true,
    get SITE_LIVE_ENABLED() {
      return flags.live;
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
    getLive: vi.fn(),
  };
});

const mocked = vi.mocked(api);

const LIVE: SiteLive = {
  at: "2026-10-24T10:00:00.000Z",
  windowSeconds: 300,
  activeSeconds: 45,
  active: 1,
  visitors: [
    {
      sessionId: "session-live-0001",
      lastSeenAt: new Date().toISOString(),
      startedAt: new Date(Date.now() - 120_000).toISOString(),
      active: true,
      country: "EG",
      governorate: "alexandria",
      source: "facebook",
      utmSource: "facebook",
      utmMedium: "cpc",
      utmCampaign: "launch",
      referrerHost: null,
      device: "mobile",
      browser: "Safari",
      os: "iOS",
      locale: "ar",
      currentPath: "/pricing",
      lastCta: { kind: "register", at: new Date().toISOString() },
    },
    {
      sessionId: "session-live-quiet",
      lastSeenAt: new Date(Date.now() - 120_000).toISOString(),
      startedAt: null,
      active: false,
      country: "SA",
      governorate: null,
      source: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      referrerHost: null,
      device: "desktop",
      browser: null,
      os: null,
      locale: null,
      currentPath: "/blog",
      lastCta: null,
    },
  ],
};

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
  flags.live = true;
  vi.clearAllMocks();
  // The other tabs are not under test here: their reads never answer.
  mocked.getDetailsSummary.mockReturnValue(new Promise(() => undefined));
  mocked.getLive.mockResolvedValue(LIVE);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("VITE_SITE_LIVE_ENABLED off", () => {
  it("has no Live tab, a ?tab=live link opens the overview, and nothing asks for it", async () => {
    flags.live = false;
    renderPage("?tab=live");
    expect(await screen.findByRole("radio", { name: "Overview" })).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "Live" })).toBeNull();
    expect(mocked.getLive).not.toHaveBeenCalled();
  });
});

describe("the Live tab", () => {
  it("lists each session: place, source and UTM, device, browser and system, page now, last click; no period or filters", async () => {
    renderPage("?tab=live");
    const table = await screen.findByRole("table");
    const [, first, second] = within(table).getAllByRole("row");
    expect(first.textContent).toContain("Active");
    expect(first.textContent).toContain("Egypt");
    expect(first.textContent).toContain("Alexandria");
    expect(first.textContent).toContain("facebook");
    expect(first.textContent).toContain("cpc / launch");
    expect(first.textContent).toContain("Mobile");
    expect(first.textContent).toContain("Safari · iOS");
    expect(first.textContent).toContain("/pricing");
    expect(first.textContent).toContain("Sign up");
    expect(second.textContent).toContain("Idle");
    expect(second.textContent).toContain("Direct");
    expect(second.textContent).toContain("/blog");
    expect(screen.getByText("Active now")).toBeTruthy();
    // Always the last five minutes: the period and the filters are not offered.
    expect(screen.queryByRole("radio", { name: "90 days" })).toBeNull();
  });

  it("reads again every 15 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPage("?tab=live");
    await screen.findByRole("table");
    expect(mocked.getLive).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(mocked.getLive).toHaveBeenCalledTimes(2);
  });

  it("says plainly when the API's details switch is off", async () => {
    mocked.getLive.mockRejectedValue(new ApiError("Not found", 404));
    renderPage("?tab=live");
    expect(await screen.findByText("Site visit details are off on the API (SITE_TRAFFIC_DETAILS_ENABLED).")).toBeTruthy();
  });

  it("speaks Arabic", async () => {
    localStorage.setItem("zimos.console.locale", "ar");
    renderPage("?tab=live");
    expect(await screen.findByRole("radio", { name: "مباشر" })).toBeTruthy();
    expect(await screen.findByText("نشط الآن")).toBeTruthy();
  });
});
