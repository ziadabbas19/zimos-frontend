import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { ApiError, type ReportUtm, type ReportUtmRow } from "@store-builder/api-client";
import { api } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { UtmReportPage } from "./UtmReportPage";

function row(key: string | null, tracked: boolean, over: Partial<ReportUtmRow> = {}): ReportUtmRow {
  return {
    key,
    tracked,
    visitors: 0,
    orders: 0,
    liveOrders: 0,
    cancelledOrders: 0,
    sales: 0,
    averageOrderValue: 0,
    confirmedOrders: 0,
    deliveredOrders: 0,
    deliveredSales: 0,
    conversionRate: null,
    ...over,
  };
}

function report(over: Partial<ReportUtm> = {}): ReportUtm {
  return {
    range: { from: "2026-09-03T00:00:00.000Z", to: "2026-10-03T00:00:00.000Z", timeZone: "UTC" },
    currency: "EGP",
    groupBy: "source",
    filters: {},
    totals: {
      visitors: 120,
      orders: 9,
      trackedOrders: 7,
      sales: 270000,
      averageOrderValue: 30000,
      confirmedOrders: 6,
      deliveredOrders: 4,
      deliveredSales: 120000,
      conversionRate: 5.8,
    },
    rows: [
      row("facebook", true, { visitors: 80, orders: 5, sales: 150000, averageOrderValue: 30000, conversionRate: 6.3, confirmedOrders: 4, deliveredOrders: 3, deliveredSales: 90000 }),
      row(null, false, { orders: 2, sales: 60000, averageOrderValue: 30000 }),
      row(null, true, { visitors: 40, orders: 2, sales: 60000, averageOrderValue: 30000, conversionRate: 5 }),
    ],
    truncated: false,
    series: [],
    ...over,
  };
}

const utmCalls = () => api.request.mock.calls.filter(([path]) => String(path).startsWith("/workspaces/ws_1/analytics/utm"));
const paramsOf = (i: number) => new URL(`http://x${utmCalls()[i][0]}`).searchParams;

function serve(answer: (params: URLSearchParams) => Promise<ReportUtm>) {
  api.request.mockImplementation(async (path: string) => {
    if (path.startsWith("/workspaces/ws_1/analytics/utm")) return { report: await answer(new URL(`http://x${path}`).searchParams) };
    return new Promise(() => undefined);
  });
}

describe("UtmReportPage", () => {
  it("lists every row, direct and not tracked included, with the totals", async () => {
    serve(async () => report());
    renderWithProviders(<UtmReportPage />, { route: "/analytics/utm" });

    const table = await screen.findByRole("table", { name: "Sales by Source" });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(4);
    expect(within(rows[1]).getByRole("button", { name: "Show facebook broken down" })).toBeInTheDocument();
    expect(within(rows[2]).getByText("Not tracked")).toBeInTheDocument();
    expect(within(rows[3]).getByText("Direct (no tag)")).toBeInTheDocument();
    expect(screen.getByText(/Not tracked: orders the store saw no purchase for/)).toBeInTheDocument();
    expect(paramsOf(0).get("groupBy")).toBe("source");
  });

  it("drills a source down to its campaigns, and lifts the filter again", async () => {
    serve(async (params) =>
      params.get("source") === "facebook"
        ? report({ groupBy: "campaign", filters: { source: "facebook" }, rows: [row("launch", true, { visitors: 10, orders: 2, sales: 60000 })] })
        : report()
    );
    const { user } = renderWithProviders(<UtmReportPage />, { route: "/analytics/utm" });

    await user.click(await screen.findByRole("button", { name: "Show facebook broken down" }));
    await waitFor(() => expect(utmCalls()).toHaveLength(2));
    expect(paramsOf(1).get("source")).toBe("facebook");
    expect(paramsOf(1).get("groupBy")).toBe("campaign");
    expect(await screen.findByRole("table", { name: "Sales by Campaign" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove filter Source: facebook" }));
    await waitFor(() => expect(utmCalls()).toHaveLength(3));
    expect(paramsOf(2).get("source")).toBeNull();
  });

  it("shows an empty state for a period with nothing in it", async () => {
    serve(async () => report({ rows: [], totals: { ...report().totals, visitors: 0, orders: 0, sales: 0 } }));
    renderWithProviders(<UtmReportPage />, { route: "/analytics/utm" });
    expect(await screen.findByText("Nothing in this period yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("offers a retry when the report fails, and a plain message without permission", async () => {
    let attempt = 0;
    serve(async () => {
      attempt += 1;
      if (attempt === 1) throw new ApiError("boom", 500);
      return report();
    });
    const { user } = renderWithProviders(<UtmReportPage />, { route: "/analytics/utm" });
    await user.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });

  it("explains a refusal for a role without analytics", async () => {
    serve(async () => {
      throw new ApiError("Missing required permission: analytics.view", 403, "FORBIDDEN");
    });
    renderWithProviders(<UtmReportPage />, { route: "/analytics/utm" });
    expect(await screen.findByText(/You don't have permission to view this/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("speaks Arabic", async () => {
    serve(async () => report());
    renderWithProviders(<UtmReportPage />, { route: "/analytics/utm", locale: "ar" });
    expect(await screen.findByRole("heading", { name: "المبيعات حسب المصدر" })).toBeInTheDocument();
    expect(screen.getByText("غير متتبَّع")).toBeInTheDocument();
    expect(screen.getByText("مباشر (بدون وسم)")).toBeInTheDocument();
  });
});
