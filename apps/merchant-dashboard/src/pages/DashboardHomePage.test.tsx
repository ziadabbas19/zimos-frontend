import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import {
  ApiError,
  type ConfirmationQueueCounts,
  type FunnelAnalyticsOverview,
  type Order,
  type ReportOverview,
  type Workspace,
} from "@store-builder/api-client";
import { api, fake, testWorkspace } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { DashboardHomePage } from "./DashboardHomePage";

const metric = (value: number | null, previous: number | null = null) => ({ value, previous });

function overview(overrides: Partial<ReportOverview> = {}): ReportOverview {
  return {
    range: { from: "2026-09-03T00:00:00.000Z", to: "2026-10-03T00:00:00.000Z", timeZone: "Africa/Cairo" },
    previousRange: { from: "2026-08-04T00:00:00.000Z", to: "2026-09-03T00:00:00.000Z" },
    currency: "EGP",
    generatedAt: "2026-10-03T12:00:00.000Z",
    metrics: {
      sales: metric(250000, 200000),
      orders: metric(10, 9),
      averageOrderValue: metric(25000, 25000),
      cancelledOrders: metric(1, 2),
      collected: metric(90000, 50000),
      confirmationRate: metric(75, 60),
      deliveryRate: metric(66.7, 50),
      deliveredOrders: metric(4, 3),
      sessions: metric(400, 300),
      conversionRate: metric(2.5, 2.4),
      newCustomers: metric(6, 5),
      returningCustomers: metric(3, 2),
    },
    series: [
      { date: "2026-10-01", orders: 4, sales: 100000, sessions: 150 },
      { date: "2026-10-02", orders: 6, sales: 150000, sessions: 250 },
    ],
    previousSeries: [
      { date: "2026-09-01", orders: 3, sales: 80000, sessions: 100 },
      { date: "2026-09-02", orders: 5, sales: 120000, sessions: 200 },
    ],
    topProducts: [{ productId: "prd_1", name: "Linen shirt", quantity: 7, sales: 140000 }],
    ...overrides,
  };
}

const emptyOverview = () =>
  overview({
    metrics: {
      sales: metric(0, 0),
      orders: metric(0, 0),
      averageOrderValue: metric(0, 0),
      cancelledOrders: metric(0, 0),
      collected: metric(0, 0),
      confirmationRate: metric(null, null),
      deliveryRate: metric(null, null),
      deliveredOrders: metric(0, 0),
      sessions: metric(0, 0),
      conversionRate: metric(null, null),
      newCustomers: metric(0, 0),
      returningCustomers: metric(0, 0),
    },
    series: [],
    previousSeries: [],
    topProducts: [],
  });

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

const noFunnels = fake<FunnelAnalyticsOverview>({
  totals: { sessions: 0, completed: 0, orders: 0, revenue: 0, upsellOrders: 0, upsellRevenue: 0, conversionRate: null },
  funnels: [],
});

const overviewCalls = () =>
  api.request.mock.calls.filter(([path]) => String(path).startsWith("/workspaces/ws_1/analytics/overview"));

function serve(answer: () => Promise<unknown>) {
  api.request.mockImplementation(async (path: string) => {
    if (path.startsWith("/workspaces/ws_1/analytics/overview")) return { overview: await answer() };
    return new Promise(() => undefined);
  });
  api.getConfirmationQueueCounts.mockResolvedValue(queue);
  api.listOrders.mockResolvedValue({ orders: [order], nextCursor: null });
  api.getFunnelAnalytics.mockResolvedValue(noFunnels);
}

describe("DashboardHomePage", () => {
  it("shows the window against the one before it from one request, with the queue, recent orders and top products", async () => {
    serve(async () => overview());

    renderWithProviders(<DashboardHomePage />, { route: "/" });

    expect(await screen.findByText("Sales")).toBeInTheDocument();
    // 250000 against 200000.
    expect(screen.getByText("+25.0%", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Average order value")).toBeInTheDocument();
    expect(screen.getByText("Conversion rate")).toBeInTheDocument();
    const awaiting = screen.getByRole("link", { name: /Awaiting confirmation/ });
    expect(awaiting).toHaveAttribute("href", "/confirmation-queue");
    expect(awaiting).toHaveTextContent("5");
    expect(await screen.findByText("ORD-1001")).toBeInTheDocument();
    expect(screen.getByText("Linen shirt")).toBeInTheDocument();
    expect(screen.getByText("75.0%")).toBeInTheDocument();
    expect(screen.getByText("Returning customers")).toBeInTheDocument();
    expect(screen.getByText(/Updated/)).toBeInTheDocument();

    // One overview request, for the last 30 days; the old pair of summaries is gone.
    expect(overviewCalls()).toHaveLength(1);
    const url = new URL(`http://x${overviewCalls()[0][0]}`);
    const span = new Date(url.searchParams.get("to")!).getTime() - new Date(url.searchParams.get("from")!).getTime();
    expect(span).toBe(30 * 24 * 60 * 60 * 1000);
    expect(api.getAnalyticsSummary).not.toHaveBeenCalled();
    expect(api.listOrders.mock.calls[0][1]).toEqual({ limit: 6 });
  });

  it("asks again for the window the merchant picks", async () => {
    serve(async () => overview());
    const { user } = renderWithProviders(<DashboardHomePage />, { route: "/" });
    await screen.findByText("Sales");

    await user.selectOptions(screen.getByRole("combobox", { name: "Date range" }), "7d");

    await waitFor(() => expect(overviewCalls()).toHaveLength(2));
    const url = new URL(`http://x${overviewCalls()[1][0]}`);
    const span = new Date(url.searchParams.get("to")!).getTime() - new Date(url.searchParams.get("from")!).getTime();
    expect(span).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("says plainly when the period holds nothing, instead of drawing zeros", async () => {
    serve(async () => emptyOverview());
    renderWithProviders(<DashboardHomePage />, { route: "/" });
    expect(await screen.findByText("Nothing in this period yet")).toBeInTheDocument();
    expect(screen.queryByText("Sales per day")).not.toBeInTheDocument();
  });

  it("offers a retry when the numbers fail to load", async () => {
    let fail = true;
    serve(async () => {
      if (fail) throw new ApiError("boom", 500);
      return overview();
    });
    const { user } = renderWithProviders(<DashboardHomePage />, { route: "/" });

    expect(await screen.findByText("Couldn't load your store's numbers right now.")).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Sales")).toBeInTheDocument();
  });

  it("falls back to the order roll-up for a role without analytics, and asks for no analytics", async () => {
    serve(async () => overview());
    renderWithProviders(<DashboardHomePage />, {
      route: "/",
      workspace: { currentWorkspace: fake<Workspace>({ ...testWorkspace, role: "order_operator" }) },
    });

    expect(await screen.findByText("Total orders")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Awaiting confirmation/ })).toHaveTextContent("5");
    expect(overviewCalls()).toHaveLength(0);
    expect(api.getFunnelAnalytics).not.toHaveBeenCalled();
  });

  it("falls back to the order roll-up when the server refuses analytics to a custom role", async () => {
    serve(async () => {
      throw new ApiError("Missing required permission: analytics.view", 403, "FORBIDDEN");
    });
    renderWithProviders(<DashboardHomePage />, {
      route: "/",
      workspace: { currentWorkspace: fake<Workspace>({ ...testWorkspace, role: "custom_role" }) },
    });
    expect(await screen.findByText("Total orders")).toBeInTheDocument();
  });

  it("speaks Arabic", async () => {
    serve(async () => overview());
    renderWithProviders(<DashboardHomePage />, { route: "/", locale: "ar" });
    expect(await screen.findByText("المبيعات")).toBeInTheDocument();
    expect(screen.getByText("متوسط قيمة الطلب")).toBeInTheDocument();
    expect(screen.getByText("عملاء عائدون")).toBeInTheDocument();
  });
});
