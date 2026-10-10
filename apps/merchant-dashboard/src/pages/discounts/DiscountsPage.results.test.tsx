import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { Discount } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { fakeBackend } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { DiscountsPage } from "./DiscountsPage";

vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  STORE_REPORTS_ENABLED: true,
}));

/** With the store reports switch on, each discount says what it brought in the window. */

const discount = fake<Discount>({
  id: "d1",
  workspaceId: "ws_1",
  code: "SAVE10",
  type: "percentage",
  value: "1000",
  buyXGetYConfig: null,
  minimumSubtotal: null,
  productRestrictions: [],
  collectionRestrictions: [],
  customerRestrictions: [],
  funnelRestrictions: [],
  startsAt: null,
  endsAt: null,
  usageLimit: null,
  perCustomerLimit: null,
  usageCount: 3,
  stackable: false,
  status: "active",
  createdAt: "2026-10-01T10:00:00Z",
  updatedAt: "2026-10-01T10:00:00Z",
});

const row = {
  discountId: "d1",
  code: "SAVE10",
  automatic: false,
  type: "percentage",
  orders: 4,
  cancelled: 1,
  cancelRate: 25,
  revenue: "120000",
  deliveredRevenue: "90000",
  discountGiven: "12000",
  averageOrder: "30000",
  newCustomers: 3,
  returningCustomers: 1,
};

describe("discount results", () => {
  it("reads the discounts report once and shows its figures in the discount's sheet", async () => {
    api.listDiscounts.mockResolvedValue([discount]);
    api.listProducts.mockResolvedValue(fake({ products: [], nextCursor: null }));
    const calls = fakeBackend({ "GET /store-reports/discounts": { from: "2026-09-11", to: "2026-10-10", currency: "EGP", discounts: [row] } });
    const { user } = renderWithProviders(<DiscountsPage />, { route: "/discounts" });
    await screen.findByText("SAVE10");

    await waitFor(() => expect(calls.filter((c) => c.path.includes("/store-reports/discounts"))).toHaveLength(1));
    expect(await screen.findByText(/Results for/)).toBeInTheDocument();

    await user.click(screen.getByText("SAVE10").closest('[data-slot="list-row-card"]')?.querySelector("[data-row-open]") as HTMLElement);
    const dialog = await screen.findByRole("dialog", { name: "Edit discount" });
    const panel = within(dialog).getByRole("region", { name: "Results" });
    expect(within(panel).getByText("New customers")).toBeInTheDocument();
    expect(within(panel).getByText(/^25(\.0)?%$/)).toBeInTheDocument();
  });

  it("keeps the list as it is for a role that may not read reports", async () => {
    const { ApiError } = await import("@store-builder/api-client");
    api.listDiscounts.mockResolvedValue([discount]);
    api.listProducts.mockResolvedValue(fake({ products: [], nextCursor: null }));
    fakeBackend({ "GET /store-reports/discounts": new ApiError("Not allowed", 403, "FORBIDDEN") });
    renderWithProviders(<DiscountsPage />, { route: "/discounts" });

    expect(await screen.findByText("SAVE10")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/Results for/)).not.toBeInTheDocument());
  });
});
