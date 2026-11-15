import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import type { WebAnalyticsMetricType } from "@store-builder/api-client";
import { api } from "@/test/mocks";
import { currentPath, renderWithProviders } from "@/test/renderWithProviders";
import { WebAnalyticsPage } from "./WebAnalyticsPage";
import { RealtimePage } from "./RealtimePage";

const stats = {
  pageviews: 320,
  visitors: 120,
  visits: 150,
  bounces: 60,
  totaltime: 9000,
  bounceRate: 40,
  avgVisitTime: 60,
  comparison: { pageviews: 160, visitors: 100, visits: 120, bounces: 60, totaltime: 6000, bounceRate: 50, avgVisitTime: 50 },
};

function serveMetrics() {
  api.getWebAnalyticsMetrics.mockImplementation(async (_ws: string, type: WebAnalyticsMetricType) => ({
    type,
    rows:
      type === "path"
        ? [
            { x: "/", y: 80 },
            { x: "/products/linen-shirt", y: 40 },
          ]
        : type === "country"
          ? [{ x: "EG", y: 110 }]
          : type === "referrer"
            ? [{ x: "facebook.com", y: 30 }]
            : [{ x: "Chrome", y: 90 }],
  }));
}

describe("WebAnalyticsPage", () => {
  it("shows the metric bar with deltas, panels with shares, and turns a row into a filter chip", async () => {
    api.getWebAnalyticsStats.mockResolvedValue(stats);
    api.getWebAnalyticsSeries.mockResolvedValue({ unit: "hour", series: [{ t: "2026-09-27T10:00:00.000Z", pageviews: 20, visitors: 10 }], comparison: [{ t: "2026-09-26T10:00:00.000Z", pageviews: 10, visitors: 5 }] });
    api.getWebAnalyticsWeekly.mockResolvedValue({ rows: [{ dow: 0, hour: 10, visitors: 5 }] });
    serveMetrics();

    const { user } = renderWithProviders(<WebAnalyticsPage />, { route: "/analytics/web?compare=prev", path: "/analytics/web" });

    expect(await screen.findByText("Visitors")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    // 120 vs 100 visitors => +20% (bounce rate 40 vs 50 is −20% too).
    expect(screen.getAllByText("20.0%").length).toBeGreaterThan(0);
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText("1m 0s")).toBeInTheDocument();
    expect(await screen.findByText("/products/linen-shirt")).toBeInTheDocument();
    // 80 of 120 visitors => 67%.
    expect(screen.getByText("67%")).toBeInTheDocument();
    expect(screen.getByText("Egypt")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /\/products\/linen-shirt/ }));
    expect(currentPath()).toContain("url=%2Fproducts%2Flinen-shirt");
    await waitFor(() => expect(api.getWebAnalyticsStats).toHaveBeenLastCalledWith("ws_1", expect.objectContaining({ url: "/products/linen-shirt" })));
    expect(screen.getByRole("button", { name: /Page:/ })).toBeInTheDocument();
  });

  it("says there were no visits instead of empty panels", async () => {
    api.getWebAnalyticsStats.mockResolvedValue({ ...stats, pageviews: 0, visitors: 0, visits: 0, bounces: 0, totaltime: 0, bounceRate: null, avgVisitTime: null, comparison: undefined });
    api.getWebAnalyticsSeries.mockResolvedValue({ unit: "hour", series: [] });
    api.getWebAnalyticsWeekly.mockResolvedValue({ rows: [] });

    renderWithProviders(<WebAnalyticsPage />, { route: "/analytics/web", path: "/analytics/web" });

    expect(await screen.findByText("No visits in this period")).toBeInTheDocument();
    expect(api.getWebAnalyticsMetrics).not.toHaveBeenCalled();
  });
});

describe("RealtimePage", () => {
  it("lists the last half hour's activity with a type filter", async () => {
    api.getWebAnalyticsRealtime.mockResolvedValue({
      totals: { views: 12, visitors: 4, events: 2, countries: 1 },
      series: [{ t: "2026-09-27T10:00:00.000Z", pageviews: 3, visitors: 2 }],
      activity: [
        { sessionId: "s1", visitId: "v1", type: "pageview", eventName: null, urlPath: "/products/linen-shirt", referrerDomain: null, browser: "Chrome", os: "Android", device: "mobile", country: "EG", createdAt: new Date().toISOString() },
        { sessionId: "s2", visitId: "v2", type: "event", eventName: "add_to_cart", urlPath: "/products/linen-shirt", referrerDomain: "facebook.com", browser: "Safari", os: "iOS", device: "mobile", country: "EG", createdAt: new Date().toISOString() },
      ],
      urls: [{ x: "/products/linen-shirt", y: 3 }],
      referrers: [{ x: "facebook.com", y: 1 }],
      countries: [{ x: "EG", y: 4 }],
      activeVisitors: 2,
    });

    const { user } = renderWithProviders(<RealtimePage />, { route: "/analytics/realtime" });

    expect(await screen.findByText("viewed /products/linen-shirt")).toBeInTheDocument();
    expect(screen.getByText("fired add_to_cart")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Events" }));
    expect(screen.queryByText("viewed /products/linen-shirt")).not.toBeInTheDocument();
    expect(screen.getByText("fired add_to_cart")).toBeInTheDocument();
  });
});
