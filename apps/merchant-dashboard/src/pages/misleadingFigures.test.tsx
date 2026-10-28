import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { Customer, Order } from "@store-builder/api-client";
import { fakeBackend } from "@/test/fakeBackend";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { CustomerDetailPage } from "@/pages/customers/CustomerDetailPage";
import { ReturnsPage } from "@/pages/returns/ReturnsPage";
import { OrderProtectionSection } from "@/pages/fraud/OrderProtectionSection";
import { CustomerHistory } from "@/pages/confirmation/station/CustomerHistory";

/**
 * Figures and controls the server never fills, kept off the screen until it
 * does: the customer's reliability score (never computed, always 100), the
 * returns' "Refunded" tab (no return ever reaches that status), and the
 * delivery rate across stores with "Report as spam" (no such endpoints).
 */

const customer = fake<Customer>({
  id: "cus_1",
  fullName: "Mona Ali",
  phoneNormalized: "+201000000001",
  phoneRaw: "01000000001",
  totalOrders: 3,
  totalRejectedOrders: 0,
  reliabilityScore: 40,
  isBlacklisted: false,
  addresses: [],
  tags: [],
});

describe("figures the server does not compute", () => {
  it("leaves the reliability score out of the customer's page", async () => {
    api.getCustomer.mockResolvedValue(customer);
    fakeBackend({});
    renderWithProviders(<CustomerDetailPage />, { route: "/customers/cus_1", path: "/customers/:customerId" });
    expect(await screen.findByText("3 orders")).toBeInTheDocument();
    expect(screen.queryByText(/reliability/i)).not.toBeInTheDocument();
  });

  it("leaves the reliability score out of the calling station, and asks for no delivery rate", async () => {
    api.getCustomer.mockResolvedValue(customer);
    const calls = fakeBackend({});
    renderWithProviders(<CustomerHistory customerId="cus_1" countsThisOrder riskFlags={[]} />);
    const list = await screen.findByRole("list");
    await waitFor(() => expect(within(list).getAllByRole("listitem").length).toBeGreaterThan(0));
    expect(list).not.toHaveTextContent(/Reliability|delivery|deposit|report/i);
    expect(calls).toHaveLength(0);
  });
});

describe("the returns' tabs", () => {
  it("has no Refunded tab", async () => {
    api.listReturns.mockResolvedValue([]);
    renderWithProviders(<ReturnsPage />, { route: "/returns", path: "/returns" });
    expect(await screen.findByRole("button", { name: /^Received/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Refunded/ })).not.toBeInTheDocument();
  });
});

describe("the order page's risk section", () => {
  it("shows the risk and the origin, with no delivery rate across stores and no Report as spam", async () => {
    const calls = fakeBackend({});
    const order = fake<Order>({
      id: "ord_1",
      orderNumber: "#1001",
      customerId: "cus_1",
      ipAddress: "41.33.1.2",
      ipCountry: "EG",
      riskLevel: "high",
      riskScore: 70,
      riskReasons: ["duplicate_phone"],
    });
    renderWithProviders(<OrderProtectionSection order={order} />);
    expect(await screen.findByText("Risk and origin")).toBeInTheDocument();
    expect(screen.getByText("41.33.1.2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Report as spam" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Delivery rate across/)).not.toBeInTheDocument();
    expect(calls.filter((call) => /network-score|report-spam/.test(call.path))).toHaveLength(0);
  });
});
