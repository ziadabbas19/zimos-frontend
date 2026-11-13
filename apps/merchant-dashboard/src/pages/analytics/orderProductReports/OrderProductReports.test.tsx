import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { ApiError, type OrdersReport, type ProductsReport } from "@store-builder/api-client";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ORDER_PRODUCT_REPORTS_ENABLED } from "@/lib/features";
import app from "../../../App.tsx?raw";
import navigation from "../../../lib/navigation.ts?raw";
import { OrdersReportPage } from "./OrdersReportPage";
import { ProductsReportPage } from "./ProductsReportPage";

const BASE = "/workspaces/ws_1/analytics/reports";
const STAGES = ["awaiting_payment", "pending_confirmation", "needs_follow_up", "ready_to_ship", "shipped", "out_for_delivery", "delivery_failed", "delivered", "returned", "cancelled"] as const;

const group = (name: string | null, orders: number, revenue: number, extra = {}) => ({
  name,
  orders,
  revenue,
  averageOrderValue: 0,
  cancellationRate: null,
  returnRate: null,
  deliveryRate: 50,
  cancelled: 0,
  shipped: 2,
  delivered: 1,
  returned: 1,
  ...extra,
});

function ordersReport(over: Partial<OrdersReport> = {}): OrdersReport {
  return {
    range: { from: "2026-10-15T00:00:00.000Z", to: "2026-11-14T00:00:00.000Z", timeZone: "Africa/Cairo" },
    previousRange: { from: "2026-09-15T00:00:00.000Z", to: "2026-10-15T00:00:00.000Z" },
    compare: "previous",
    unit: "day",
    currency: "EGP",
    kpis: {
      orders: { value: 6, previous: 4 },
      revenue: { value: 125000, previous: 100000 },
      averageOrderValue: { value: 25000, previous: 25000 },
      cancellationRate: { value: 16.7, previous: 0 },
      returnRate: { value: 50, previous: null },
      deliveryRate: { value: 50, previous: null },
    },
    counts: { cancelled: 1, shipped: 4, delivered: 2, returned: 2 },
    series: [
      { bucket: "2026-11-12T00:00", orders: 2, revenue: 40000 },
      { bucket: "2026-11-13T00:00", orders: 4, revenue: 85000 },
    ],
    previousSeries: [
      { bucket: "2026-10-13T00:00", orders: 1, revenue: 20000 },
      { bucket: "2026-10-14T00:00", orders: 3, revenue: 80000 },
    ],
    byStatus: STAGES.map((status) => ({ status, orders: status === "delivered" ? 2 : status === "cancelled" ? 1 : status === "returned" ? 1 : status === "pending_confirmation" ? 1 : status === "delivery_failed" ? 1 : 0, revenue: 0 })),
    byGovernorate: [group("القاهرة (Cairo)", 4, 85000), group("الجيزة (Giza)", 2, 40000)],
    byPaymentMethod: [group("cod", 6, 125000)],
    byCarrier: [group("bosta", 2, 30000), group(null, 2, 75000, { shipped: 0 })],
    ...over,
  };
}

const ORDERS = {
  currency: "EGP",
  timeZone: "Africa/Cairo",
  nextCursor: null,
  orders: [
    { id: "o1", orderNumber: "1001", createdAt: "2026-11-13T10:00:00.000Z", status: "delivered", paymentMethod: "cod", governorate: "القاهرة (Cairo)", carrier: "bosta", items: 2, total: 20000, countsAsRevenue: true, customerName: "Mona Adel", contactLocked: false },
    { id: "o2", orderNumber: "1002", createdAt: "2026-11-13T11:00:00.000Z", status: "cancelled", paymentMethod: "cod", governorate: "الجيزة (Giza)", carrier: null, items: 1, total: 10000, countsAsRevenue: false, customerName: null, contactLocked: true },
  ],
};

describe("the orders report", () => {
  it("draws the skeleton while loading, then the KPIs, the breakdowns and the orders", async () => {
    let answer!: (v: unknown) => void;
    fakeBackend({
      [`GET ${BASE}/orders-overview`]: () => new Promise((r) => (answer = r)),
      [`GET ${BASE}/orders-overview/orders`]: ORDERS,
    });
    renderWithProviders(<OrdersReportPage />, { route: "/analytics/orders" });
    expect(screen.getByText("Loading the report…")).toBeInTheDocument();
    answer({ report: ordersReport() });

    expect(await screen.findByRole("heading", { name: "Orders report" })).toBeInTheDocument();
    expect(screen.getByText("Cancellation rate")).toBeInTheDocument();
    expect(screen.getByText("Delivery rate")).toBeInTheDocument();
    expect(screen.getByText("Orders and revenue by day")).toBeInTheDocument();
    // The status rows are the Orders page stages, filters for the table.
    const delivered = screen.getByRole("button", { name: /^Delivered/ });
    expect(delivered).toHaveAttribute("aria-pressed", "false");
    expect(await screen.findByRole("link", { name: "#1001" })).toHaveAttribute("href", "/orders/o1");
    expect(screen.getByText("Mona Adel")).toBeInTheDocument();
    expect(screen.getByText("Hidden")).toBeInTheDocument();
    expect(screen.getByText("Not shipped yet")).toBeInTheDocument();
  });

  it("filters the orders by a breakdown row, and clears it", async () => {
    const calls = fakeBackend({
      [`GET ${BASE}/orders-overview`]: { report: ordersReport() },
      [`GET ${BASE}/orders-overview/orders`]: ORDERS,
    });
    renderWithProviders(<OrdersReportPage />, { route: "/analytics/orders" });
    fireEvent.click(await screen.findByRole("button", { name: /^Giza/ }));
    await waitFor(() => expect(callsTo(calls, "GET", "/orders-overview/orders").some((c) => c.path.includes("governorate=%D8%A7%D9%84%D8%AC%D9%8A%D8%B2%D8%A9"))).toBe(true));
    expect(screen.getByRole("button", { name: /^Giza/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Show all orders" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /^Giza/ })).toHaveAttribute("aria-pressed", "false"));
    const last = callsTo(calls, "GET", "/orders-overview/orders").at(-1)!;
    expect(last.path).not.toContain("governorate");
  });

  it("says when there were no orders, and offers the way to the Orders page", async () => {
    fakeBackend({
      [`GET ${BASE}/orders-overview`]: {
        report: ordersReport({ kpis: { ...ordersReport().kpis, orders: { value: 0, previous: 0 } } }),
      },
      [`GET ${BASE}/orders-overview/orders`]: { ...ORDERS, orders: [] },
    });
    renderWithProviders(<OrdersReportPage />, { route: "/analytics/orders" });
    expect(await screen.findByText("No orders in these dates")).toBeInTheDocument();
    // The design system's button-as-link (Button asChild) is an <a role="button">.
    expect(screen.getByRole("button", { name: "Open the Orders page" })).toHaveAttribute("href", "/orders");
  });

  it("shows the error with a way to try again", async () => {
    let fail = true;
    fakeBackend({
      [`GET ${BASE}/orders-overview`]: () => (fail ? new ApiError("boom", 500, "INTERNAL", {}) : { report: ordersReport() }),
      [`GET ${BASE}/orders-overview/orders`]: ORDERS,
    });
    renderWithProviders(<OrdersReportPage />, { route: "/analytics/orders" });
    const retry = await screen.findByRole("button", { name: "Try again" });
    fail = false;
    fireEvent.click(retry);
    expect(await screen.findByText("Cancellation rate")).toBeInTheDocument();
  });

  it("reads right to left in Arabic, with Arabic labels and place names", async () => {
    fakeBackend({
      [`GET ${BASE}/orders-overview`]: { report: ordersReport() },
      [`GET ${BASE}/orders-overview/orders`]: ORDERS,
    });
    renderWithProviders(<OrdersReportPage />, { route: "/analytics/orders", locale: "ar" });
    expect(await screen.findByRole("heading", { name: "تقرير الطلبات" })).toBeInTheDocument();
    expect(document.documentElement.dir).toBe("rtl");
    expect(screen.getByText("نسبة الإلغاء")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^الجيزة/ })).toBeInTheDocument();
  });
});

const product = (productId: string, name: string, units: number, revenue: number, extra = {}) => ({
  productId,
  name,
  imageUrl: null,
  status: "active",
  units,
  revenue,
  orders: units,
  returnedUnits: 0,
  share: 50,
  stock: 3,
  ...extra,
});

function productsReport(over: Partial<ProductsReport> = {}): ProductsReport {
  const rows = [product("p1", "Linen shirt", 5, 50000), product("p2", "Leather belt", 3, 75000)];
  return {
    range: { from: "2026-10-15T00:00:00.000Z", to: "2026-11-14T00:00:00.000Z", timeZone: "Africa/Cairo" },
    currency: "EGP",
    totals: { revenue: 125000, units: 8, productsSold: 2, productsUnsold: 1 },
    topByRevenue: [rows[1], rows[0]],
    topByUnits: rows,
    lowestSellers: [rows[1], rows[0]],
    noSales: [product("p3", "Wool scarf", 0, 0, { share: null })],
    stock: [
      { productId: "p2", name: "Leather belt", imageUrl: null, available: 0, state: "out" },
      { productId: "p1", name: "Linen shirt", imageUrl: null, available: 2, state: "low" },
    ],
    rows,
    lowStockFallback: 5,
    ...over,
  };
}

describe("the products report", () => {
  it("shows the top products, the ones with no sales, the stock running out and a product's trend", async () => {
    fakeBackend({
      [`GET ${BASE}/products-overview`]: { report: productsReport() },
      [`GET ${BASE}/products-overview/p1/trend`]: { trend: { productId: "p1", name: "Linen shirt", unit: "day", currency: "EGP", series: [{ bucket: "2026-11-13T00:00", units: 5, revenue: 50000 }] } },
    });
    renderWithProviders(<ProductsReportPage />, { route: "/analytics/products" });
    expect(await screen.findByText("Top by revenue")).toBeInTheDocument();
    expect(screen.getByText("Top by units")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Wool scarf" })).toHaveAttribute("href", "/catalog/p3");
    expect(screen.getByText("Out of stock")).toBeInTheDocument();
    expect(screen.getByText("Low")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Linen shirt" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Linen shirt — trend")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("says nothing sold, and still lists the products with no sales", async () => {
    fakeBackend({
      [`GET ${BASE}/products-overview`]: {
        report: productsReport({ totals: { revenue: 0, units: 0, productsSold: 0, productsUnsold: 1 }, rows: [], topByRevenue: [], topByUnits: [], lowestSellers: [], stock: [] }),
      },
    });
    renderWithProviders(<ProductsReportPage />, { route: "/analytics/products" });
    expect(await screen.findByText("No products sold in these dates")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Wool scarf" })).toBeInTheDocument();
    expect(screen.getByText("Nothing is running out.")).toBeInTheDocument();
  });

  it("loads with a skeleton and recovers from an error", async () => {
    let fail = true;
    fakeBackend({ [`GET ${BASE}/products-overview`]: () => (fail ? new ApiError("boom", 500, "INTERNAL", {}) : { report: productsReport() }) });
    renderWithProviders(<ProductsReportPage />, { route: "/analytics/products" });
    expect(screen.getByText("Loading the report…")).toBeInTheDocument();
    const retry = await screen.findByRole("button", { name: "Try again" });
    fail = false;
    fireEvent.click(retry);
    expect(await screen.findByText("Top by revenue")).toBeInTheDocument();
  });

  it("reads right to left in Arabic", async () => {
    fakeBackend({ [`GET ${BASE}/products-overview`]: { report: productsReport() } });
    renderWithProviders(<ProductsReportPage />, { route: "/analytics/products", locale: "ar" });
    expect(await screen.findByRole("heading", { name: "تقرير المنتجات" })).toBeInTheDocument();
    expect(document.documentElement.dir).toBe("rtl");
    expect(screen.getByText("الأعلى إيرادًا")).toBeInTheDocument();
    expect(screen.getByText("نفد")).toBeInTheDocument();
  });
});

describe("with the switch off", () => {
  it("is off unless the build turns it on: no menu entries, and the addresses go to /analytics", () => {
    expect(ORDER_PRODUCT_REPORTS_ENABLED).toBe(false);
    expect(app).toContain('<Route path="/analytics/orders" element={ORDER_PRODUCT_REPORTS_ENABLED ? <LazyRoute><OrdersReportPage /></LazyRoute> : <Navigate to="/analytics" replace />} />');
    expect(app).toContain('<Route path="/analytics/products" element={ORDER_PRODUCT_REPORTS_ENABLED ? <LazyRoute><ProductsReportPage /></LazyRoute> : <Navigate to="/analytics" replace />} />');
    expect(navigation).toContain("...(ORDER_PRODUCT_REPORTS_ENABLED");
  });
});
