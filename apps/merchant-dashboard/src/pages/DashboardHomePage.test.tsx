import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import type {
  AnalyticsSummary,
  ConfirmationQueueCounts,
  InsightsMetricKey,
  InsightsOverview,
  Order,
  SetupGuide,
  Workspace,
} from "@store-builder/api-client";
import { api, fake, testWorkspace } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { DashboardHomePage } from "./DashboardHomePage";

const summary = (gross: number) =>
  fake<AnalyticsSummary>({
    range: { from: "2026-08-22T00:00:00.000Z", to: "2026-09-21T00:00:00.000Z", timeZone: "UTC" },
    currency: "EGP",
    orders: { placed: 10, pending: 2, confirmed: 6, rejected: 1, unreachable: 1, postponed: 0, cancelled: 0, delivered: 4, returned: 1 },
    rates: { confirmation: 75, delivery: 66.7, return: 20 },
    revenue: { gross, delivered: 100000, collected: 90000, refunded: 0, shippingCharged: 5000, discounts: 2000, averageOrderValue: 25000 },
    profit: { deliveredItemsRevenue: 95000, discounts: 2000, productCost: 40000, refunded: 0, grossProfit: 53000, costCoverage: 100 },
    series: [],
    topProducts: [{ productId: "prd_1", name: "Linen shirt", quantity: 7, revenue: 140000 }],
    newCustomers: 3,
  });

const METRIC_KEYS: InsightsMetricKey[] = [
  "visits",
  "orders",
  "sales",
  "averageOrderValue",
  "addToCart",
  "checkouts",
  "crossSellAdds",
  "newOrders",
  "lostOrders",
  "conversionRate",
  "lostRate",
  "netProfit",
  "newCustomers",
  "returningCustomers",
  "leads",
  "confirmationRate",
  "deliveryRate",
];

// The home page's KPIs (StoreOverview), from /analytics/overview.
const overview = fake<InsightsOverview>({
  range: { from: "2026-09-14T00:00:00.000Z", to: "2026-09-21T00:00:00.000Z", timeZone: "UTC" },
  previousRange: { from: "2026-09-07T00:00:00.000Z", to: "2026-09-14T00:00:00.000Z" },
  funnelId: null,
  currency: "EGP",
  moneyMetrics: ["sales", "averageOrderValue", "netProfit"],
  metrics: {
    ...Object.fromEntries(METRIC_KEYS.map((key) => [key, { value: 0, previous: 0 }])),
    sales: { value: 250000, previous: 200000 },
    confirmationRate: { value: 75, previous: null },
  },
  series: [],
  funnel: [],
  offers: [],
  topSources: [],
  topGovernorates: [],
  devices: [],
  topProducts: [{ productId: "prd_1", name: "Linen shirt", quantity: 7, sales: 140000 }],
  topFunnels: [],
});

const guide: SetupGuide = {
  steps: [
    { key: "product", done: true, optional: false },
    { key: "website", done: false, optional: false },
  ],
  completed: 1,
  total: 2,
  percent: 50,
  done: false,
};

const webStats = {
  pageviews: 320,
  visitors: 120,
  visits: 150,
  bounces: 60,
  totaltime: 9000,
  bounceRate: 40,
  avgVisitTime: 60,
  comparison: { pageviews: 160, visitors: 100, visits: 120, bounces: 60, totaltime: 6000, bounceRate: 50, avgVisitTime: 50 },
};

/** Answers the calls the home page makes through api.request, by path; anything else stays pending. */
function serveRequests() {
  api.request.mockImplementation(((path: string) => {
    const route = String(path).split("?")[0];
    if (route === "/workspaces/ws_1/analytics/overview") return Promise.resolve({ overview });
    if (route === "/workspaces/ws_1/setup-guide") return Promise.resolve(guide);
    if (route === "/workspaces/ws_1/funnels") return Promise.resolve({ funnels: [] });
    return new Promise<never>(() => undefined);
  }) as never);
}

// Awaiting = waiting for a call (pending) + someone on it (inProgress).
const queue: ConfirmationQueueCounts = {
  pending: 3,
  pendingDue: 3,
  inProgress: 2,
  inProgressMine: 0,
  done: 9,
  assignedToMe: 0,
  unassigned: 5,
};

const order = fake<Order>({
  id: "o1",
  orderNumber: "ORD-1001",
  confirmationState: "pending",
  totalAmount: "25000",
  currency: "EGP",
  contactSnapshot: { fullName: "Mona Ali" },
  funnelId: null,
  createdAt: "2026-09-14T10:00:00.000Z",
  items: [],
});

describe("DashboardHomePage", () => {
  it("shows the store overview with deltas, the setup guide, the queue's count, recent orders and site analytics", async () => {
    api.getAnalyticsSummary.mockResolvedValue(summary(250000));
    api.getConfirmationQueueCounts.mockResolvedValue(queue);
    api.listOrders.mockResolvedValue({ orders: [order], nextCursor: null });
    serveRequests();
    api.getWebAnalyticsStats.mockResolvedValue(fake(webStats));
    api.getWebAnalyticsSeries.mockResolvedValue(fake({ unit: "day", series: [] }));
    api.getWebAnalyticsMetrics.mockImplementation(async (_ws, type) =>
      fake({ type, rows: type === "path" ? [{ x: "/products/linen-shirt", y: 40 }] : [] })
    );
    api.getWebAnalyticsRealtime.mockResolvedValue(fake({ activeVisitors: 2 }));

    renderWithProviders(<DashboardHomePage />, { route: "/" });

    // 250,000 against 200,000 the period before: +25%.
    const sales = await screen.findByRole("link", { name: /Total sales/ });
    expect(sales).toHaveAttribute("href", "/analytics");
    expect(sales).toHaveTextContent("25.0%");
    expect(screen.getByRole("link", { name: /Confirmation rate/ })).toHaveTextContent("75.0%");
    expect(screen.getByText("Linen shirt")).toBeInTheDocument();
    expect(api.request).toHaveBeenCalledWith(expect.stringMatching(/^\/workspaces\/ws_1\/analytics\/overview\?.*compare=previous/));

    expect(await screen.findByText("Get your store ready")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 steps done")).toBeInTheDocument();

    const confirm = screen.getByRole("link", { name: /Confirm orders/ });
    expect(confirm).toHaveAttribute("href", "/confirmation-queue");
    expect(confirm).toHaveTextContent("5");

    expect(await screen.findByText("ORD-1001")).toBeInTheDocument();
    // The order roll-up the page used to walk is not needed any more.
    expect(api.listOrders).toHaveBeenCalledTimes(1);
    expect(api.listOrders.mock.calls[0][1]).toEqual({ limit: 6 });

    expect(await screen.findByText("/products/linen-shirt")).toBeInTheDocument();
    expect(screen.getByText("Website analytics")).toBeInTheDocument();
  });

  it("falls back to the order roll-up for a role without analytics, and asks for no analytics", async () => {
    api.getConfirmationQueueCounts.mockResolvedValue(queue);
    api.listOrders.mockResolvedValue({ orders: [order], nextCursor: null });

    renderWithProviders(<DashboardHomePage />, {
      route: "/",
      workspace: { currentWorkspace: fake<Workspace>({ ...testWorkspace, role: "order_operator" }) },
    });

    expect(await screen.findByText("Total orders")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Awaiting confirmation/ })).toHaveTextContent("5");
    expect(api.getAnalyticsSummary).not.toHaveBeenCalled();
    expect(api.getFunnelAnalytics).not.toHaveBeenCalled();
    // Nor what the overview's parts would read.
    expect(api.request).not.toHaveBeenCalledWith(expect.stringMatching(/\/setup-guide$|\/funnels$|\/analytics\/overview\?/));
    expect(api.listOrders).not.toHaveBeenCalledWith("ws_1", { limit: 6 });
  });

  it("asks for what the overview's parts read while the summary is still on its way", async () => {
    api.getAnalyticsSummary.mockReturnValue(new Promise<never>(() => undefined));
    api.getConfirmationQueueCounts.mockResolvedValue(queue);
    api.listOrders.mockResolvedValue({ orders: [order], nextCursor: null });
    serveRequests();

    renderWithProviders(<DashboardHomePage />, { route: "/" });

    await vi.waitFor(() => {
      expect(api.listOrders).toHaveBeenCalledWith("ws_1", { limit: 6 });
      expect(api.request).toHaveBeenCalledWith("/workspaces/ws_1/setup-guide");
      expect(api.request).toHaveBeenCalledWith("/workspaces/ws_1/funnels");
      expect(api.request).toHaveBeenCalledWith(expect.stringMatching(/^\/workspaces\/ws_1\/analytics\/overview\?.*compare=previous/));
    });
    // The overview itself still waits for the summary.
    expect(screen.queryByText("Get your store ready")).not.toBeInTheDocument();
  });
});
