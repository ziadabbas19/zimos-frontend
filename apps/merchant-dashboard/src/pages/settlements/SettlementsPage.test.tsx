import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { SettlementDetail, SettlementSummary, UnsettledOrder } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SettlementsPage } from "./SettlementsPage";

const summary = fake<SettlementSummary>({
  unsettledOrders: 1,
  dueFromCouriers: 25000,
  received: 0,
  courierFees: 0,
  draftSettlements: 0,
});

const order = fake<UnsettledOrder>({
  orderId: "ord_1",
  orderNumber: "#1001",
  customerName: "Mona Adel",
  carrierCode: "bosta",
  shipmentId: "shp_1",
  waybillNumber: "WB123",
  deliveredAt: "2026-09-10T10:00:00.000Z",
  currency: "EGP",
  totalAmount: 25000,
  amountPaid: 0,
  dueAmount: 25000,
});

const draft = fake<SettlementDetail>({
  id: "set_1",
  carrierCode: "bosta",
  reference: null,
  periodStart: null,
  periodEnd: null,
  status: "draft",
  currency: "EGP",
  collectedAmount: 25000,
  feesAmount: 3500,
  netAmount: 21500,
  notes: null,
  confirmedAt: null,
  createdAt: "2026-09-14T10:00:00.000Z",
  lines: [
    {
      orderId: "ord_1",
      orderNumber: "#1001",
      customerName: "Mona Adel",
      orderTotal: 25000,
      financialState: "pending",
      collectedAmount: 25000,
      feeAmount: 3500,
    },
  ],
});

interface Init {
  method?: string;
  body?: unknown;
}

function serveLists(carriers: Array<Record<string, unknown>>) {
  api.getSettlementSummary.mockResolvedValue(summary);
  api.listUnsettledOrders.mockResolvedValue(fake({ orders: [order], carriers }));
  api.listSettlements.mockResolvedValue({ settlements: [], nextCursor: null });
  api.createSettlement.mockResolvedValue(draft);
  api.getSettlement.mockResolvedValue(draft);
  api.confirmSettlement.mockResolvedValue(fake({ ...draft, status: "confirmed" }));
}

afterEach(() => {
  api.request.mockReset();
  api.createSettlement.mockReset();
  api.confirmSettlement.mockReset();
});

describe("SettlementsPage", () => {
  it("says nothing is waiting when nothing is due and nothing was settled", async () => {
    api.getSettlementSummary.mockResolvedValue(
      fake({ unsettledOrders: 0, dueFromCouriers: 0, received: 0, courierFees: 0, draftSettlements: 0 })
    );
    api.listUnsettledOrders.mockResolvedValue({ orders: [], carriers: [] });
    api.listSettlements.mockResolvedValue({ settlements: [], nextCursor: null });

    const { user } = renderWithProviders(<SettlementsPage />, { route: "/settlements" });

    expect(await screen.findByText("No money is waiting with the couriers right now.")).toBeInTheDocument();
    expect(await screen.findByText("No unsettled COD orders")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /^Settlements/ }));
    expect(await screen.findByText("No settlements yet")).toBeInTheDocument();
  });

  it("records what a courier paid as a draft with the fee quick-fill, then confirms it", async () => {
    serveLists([{ carrierCode: "bosta", orders: 1, dueAmount: 25000 }]);
    const { user } = renderWithProviders(<SettlementsPage />, { route: "/settlements" });

    await user.click((await screen.findAllByRole("button", { name: "Record what Bosta paid you" }))[0]);
    const sheet = await screen.findByRole("dialog", { name: "What Bosta paid you" });
    await user.click(within(sheet).getByRole("checkbox", { name: "Select order #1001" }));
    await user.type(within(sheet).getByLabelText("Fee per order"), "35");
    await user.click(within(sheet).getByRole("button", { name: "Apply to selected" }));
    await user.click(within(sheet).getByRole("button", { name: "Create draft settlement" }));

    // Major units in the inputs, minor units on the wire.
    await waitFor(() =>
      expect(api.createSettlement).toHaveBeenCalledWith("ws_1", {
        carrierCode: "bosta",
        lines: [{ orderId: "ord_1", collectedAmount: 25000, feeAmount: 3500 }],
      })
    );

    await user.click(await screen.findByRole("button", { name: "Confirm settlement" }));
    expect(await screen.findByText(/marks them paid/)).toBeInTheDocument();
    const confirmButtons = screen.getAllByRole("button", { name: "Confirm settlement" });
    await user.click(confirmButtons[confirmButtons.length - 1]);
    await waitFor(() => expect(api.confirmSettlement).toHaveBeenCalledWith("ws_1", "set_1"));
  });

  it("settles a group of the store's own courier under that courier's id", async () => {
    serveLists([{ carrierCode: "bosta", courierId: "cour_7", orders: 1, dueAmount: 25000 }]);
    const { user } = renderWithProviders(<SettlementsPage />, { route: "/settlements" });

    await user.click((await screen.findAllByRole("button", { name: "Record what Bosta paid you" }))[0]);
    const sheet = await screen.findByRole("dialog", { name: "What Bosta paid you" });
    await user.click(within(sheet).getByRole("checkbox", { name: "Select order #1001" }));
    await user.click(within(sheet).getByRole("button", { name: "Create draft settlement" }));

    await waitFor(() => expect(api.createSettlement).toHaveBeenCalledTimes(1));
    expect(api.createSettlement.mock.calls[0][1]).toMatchObject({ carrierCode: "bosta", courierId: "cour_7" });
  });

  it("matches a courier's statement as CSV text, the one form this API reads", async () => {
    serveLists([{ carrierCode: "bosta", orders: 1, dueAmount: 25000 }]);
    api.request.mockImplementation(async (path: string, init?: Init) => {
      if (path.includes("/statement") && init?.method === "POST") return { report: { matched: [], unmatched: [], missing: [], totals: { collected: 0, fees: 0, net: 0 } } };
      return new Promise(() => undefined);
    });
    const { user } = renderWithProviders(<SettlementsPage />, { route: "/settlements" });

    await user.click(await screen.findByRole("button", { name: "Settlement tools" }));
    await user.click(await screen.findByRole("menuitem", { name: /Import a courier statement/ }));
    await screen.findByRole("dialog");
    const file = new File(["waybill,collected\nWB123,250\n"], "bosta.csv", { type: "text/csv" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).toBe(".csv,text/csv");
    await user.upload(input, file);
    await user.click(await screen.findByRole("button", { name: "Match waybills" }));

    await waitFor(() => expect(api.request.mock.calls.some(([path, init]) => path.includes("/statement") && init?.method === "POST")).toBe(true));
    const call = api.request.mock.calls.find(([path, init]) => path.includes("/statement") && init?.method === "POST")!;
    expect(call[1]!.body).toEqual({ csv: "waybill,collected\nWB123,250\n", carrierCode: "bosta" });
  });

  it("reads in the dashboard's own Arabic", async () => {
    serveLists([{ carrierCode: "bosta", orders: 1, dueAmount: 25000 }]);
    renderWithProviders(<SettlementsPage />, { route: "/settlements", locale: "ar" });

    expect(await screen.findByRole("heading", { name: "تسويات شركات الشحن" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "تسجيل تحويل" }).length).toBeGreaterThan(0);
  });
});
