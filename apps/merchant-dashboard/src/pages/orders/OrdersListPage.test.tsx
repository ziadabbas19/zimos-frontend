import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { Order, OrderPipeline } from "@store-builder/api-client";
import { api, authMock, fake, testUser, testWorkspace, workspaceMock } from "@/test/mocks";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { OrdersListPage } from "./OrdersListPage";

/**
 * The orders list: one toolbar, the stages as chips with their counts, rows
 * that open a quick look, and a bar of actions for the ticked orders. It reads
 * the same two things the old page read (`listOrders`, `getOrderPipeline`) and
 * sends the same bulk payloads — with the store's own courier on a shipping
 * stage, as before, and nothing the API does not take.
 */

function order(id: string, overrides: Record<string, unknown> = {}): Order {
  return fake<Order>({
    id,
    orderNumber: `ORD-${id}`,
    customerId: `c_${id}`,
    stage: "pending_confirmation",
    totalAmount: "25000",
    currency: "EGP",
    paymentMethod: "cod",
    paymentProvider: null,
    riskFlags: [],
    items: [{ id: `i_${id}`, productNameSnapshot: "Mug", quantity: 2, variantOptionsSnapshot: null }],
    contactSnapshot: { fullName: `Customer ${id}`, phone: "01012345678" },
    shippingAddressSnapshot: { province: "Cairo", city: "Nasr City", addressLine: "1 Nile St" },
    deliveryMethod: "delivery",
    createdAt: "2026-10-10T09:00:00Z",
    ...overrides,
  });
}

const pipeline: OrderPipeline = fake<OrderPipeline>({
  total: 3,
  stages: {
    awaiting_payment: 0,
    pending_confirmation: 2,
    needs_follow_up: 0,
    ready_to_ship: 1,
    shipped: 0,
    out_for_delivery: 0,
    delivery_failed: 0,
    delivered: 0,
    returned: 0,
    cancelled: 0,
  },
});

function serve(orders: Order[], routes: Record<string, unknown> = {}) {
  api.listOrders.mockResolvedValue(fake({ orders, nextCursor: null }));
  api.getOrderPipeline.mockResolvedValue(pipeline);
  api.listCarriers.mockResolvedValue(fake({ carriers: [] }));
  return fakeBackend({
    "POST /network-scores": { enabled: false, scores: {} },
    "GET /saved-views": { views: [] },
    ...routes,
  });
}

const bar = () => screen.getByRole("toolbar", { name: "Actions for what you selected" });

beforeEach(() => {
  authMock.user = testUser;
  Object.assign(workspaceMock, { currentWorkspace: { ...testWorkspace, role: "owner", slug: "nile", settings: {} } });
});

describe("OrdersListPage", () => {
  it("lists the orders under the stage chips, and asks the server for the stage that is chosen", async () => {
    serve([order("a1"), order("a2")]);
    const { user } = renderWithProviders(<OrdersListPage />);

    expect(await screen.findByText("Customer a1")).toBeInTheDocument();
    expect(screen.getByText("Customer a2")).toBeInTheDocument();
    expect(api.listOrders.mock.calls[0][1]?.stage).toBeUndefined();
    // The same two reads the list always made.
    expect(api.getOrderPipeline).toHaveBeenCalledWith("ws_1", expect.anything());

    const stages = screen.getByRole("group", { name: "Filter orders by stage" });
    await user.click(within(stages).getByRole("button", { name: /Ready to ship/ }));
    await waitFor(() =>
      expect(api.listOrders).toHaveBeenLastCalledWith("ws_1", expect.objectContaining({ stage: "ready_to_ship" }))
    );
  });

  it("says a pickup order is picked up, where its place would be", async () => {
    serve([order("p1", { deliveryMethod: "pickup", shippingAddressSnapshot: null })]);
    renderWithProviders(<OrdersListPage />);

    await screen.findByText("Customer p1");
    expect(screen.getByText("Pickup from the store")).toBeInTheDocument();
  });

  it("changes the status of the ticked orders with the store's own courier, and sends nothing the API does not take", async () => {
    const calls = serve([order("a1"), order("a2")], {
      "GET /couriers": { couriers: [{ id: "cr_1", name: "Hany", active: true }, { id: "cr_2", name: "Gone", active: false }] },
      "POST /orders/bulk": { total: 1, succeeded: 1, failed: 0, results: [{ orderId: "a1", ok: true }] },
    });
    const { user } = renderWithProviders(<OrdersListPage />);

    await user.click(await screen.findByRole("checkbox", { name: "Select order ORD-a1" }));
    expect(within(bar()).getByText("1 order selected")).toBeInTheDocument();
    await user.click(within(bar()).getByRole("button", { name: "Change status" }));

    const dialog = await screen.findByRole("dialog", { name: "Change status — 1 order" });
    // Not a stage a courier takes an order in: no courier is asked for.
    expect(within(dialog).queryByLabelText("Courier (optional)")).not.toBeInTheDocument();
    await user.selectOptions(within(dialog).getByLabelText("New status"), "out_for_delivery");
    const courier = await within(dialog).findByLabelText("Courier (optional)");
    // Only the couriers still working for the store.
    expect(within(courier).queryByRole("option", { name: "Gone" })).not.toBeInTheDocument();
    await user.selectOptions(courier, "cr_1");
    // The bulk route takes no "tell the customer" switch, so none is offered.
    expect(within(dialog).queryByRole("checkbox")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(callsTo(calls, "POST", "/orders/bulk")).toHaveLength(1));
    const body = callsTo(calls, "POST", "/orders/bulk")[0].body as { action: string; orderIds: string[]; payload: Record<string, unknown> };
    expect(body.action).toBe("set_status");
    expect(body.orderIds).toEqual(["a1"]);
    expect(JSON.parse(JSON.stringify(body.payload))).toEqual({ status: "out_for_delivery", courierId: "cr_1" });
    expect(await screen.findByText("1 order updated.")).toBeInTheDocument();
  });

  it("books a courier only for the one the merchant chose: nothing is picked for them", async () => {
    const calls = serve([order("a1")], { "POST /orders/bulk": { total: 1, succeeded: 1, failed: 0, results: [{ orderId: "a1", ok: true }] } });
    api.listCarriers.mockResolvedValue(fake({ carriers: [{ code: "bosta", name: "Bosta", connection: { id: "k1" } }] }));
    const { user } = renderWithProviders(<OrdersListPage />);

    await user.click(await screen.findByRole("checkbox", { name: "Select order ORD-a1" }));
    await user.click(within(bar()).getByRole("button", { name: "Book the courier" }));
    const dialog = await screen.findByRole("dialog", { name: "Book the courier — 1 order" });

    // The connected courier is offered, not chosen: the form starts on a name typed by hand.
    const select = within(dialog).getByLabelText("Courier") as HTMLSelectElement;
    await waitFor(() => expect(within(select).getByRole("option", { name: "Bosta" })).toBeInTheDocument());
    expect(select.value).toBe("");
    expect(within(dialog).getByRole("button", { name: "Apply" })).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/Courier name/), "Uncle Samir");
    await user.click(within(dialog).getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(callsTo(calls, "POST", "/orders/bulk")).toHaveLength(1));
    expect(callsTo(calls, "POST", "/orders/bulk")[0].body).toMatchObject({ action: "ship", orderIds: ["a1"], payload: { carrierCode: "Uncle Samir" } });
  });

  it("lets go of the selection without touching the orders", async () => {
    const calls = serve([order("a1"), order("a2")]);
    const { user } = renderWithProviders(<OrdersListPage />);

    const one = await screen.findByRole("checkbox", { name: "Select order ORD-a1" });
    const two = screen.getByRole("checkbox", { name: "Select order ORD-a2" });
    await user.click(one);
    await user.click(two);
    expect(within(bar()).getByText("2 orders selected")).toBeInTheDocument();

    await user.click(within(bar()).getByRole("button", { name: "Clear selection" }));
    expect(one).not.toBeChecked();
    expect(two).not.toBeChecked();
    expect(screen.getByText("Customer a1")).toBeInTheDocument();
    expect(screen.getByText("Customer a2")).toBeInTheDocument();
    expect(callsTo(calls, "POST", "/orders/bulk")).toHaveLength(0);
  });

  it("keeps the Tools menu to what the store has: no packing, delivery schedule or pickups queue", async () => {
    serve([order("a1")]);
    const { user } = renderWithProviders(<OrdersListPage />);

    await screen.findByText("Customer a1");
    await user.click(screen.getByRole("button", { name: "Tools" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Refresh",
      "Board",
      "Today's manifest",
      "Sync from file",
      "Export",
    ]);

    // The courier's sheet is CSV, as the API reads it.
    await user.click(within(menu).getByRole("menuitem", { name: "Sync from file" }));
    const dialog = await screen.findByRole("dialog", { name: "Update tracking from a file" });
    expect(within(dialog).getByText(/Upload the CSV file your courier sent/)).toBeInTheDocument();
    expect(dialog.querySelector('input[type="file"]')).toHaveAttribute("accept", ".csv,text/csv");
  });

  it("guides a store with no orders at all, and speaks formal Arabic", async () => {
    api.listOrders.mockResolvedValue(fake({ orders: [], nextCursor: null }));
    api.getOrderPipeline.mockResolvedValue(fake<OrderPipeline>({ ...pipeline, total: 0 }));
    fakeBackend({ "GET /saved-views": { views: [] } });
    renderWithProviders(<OrdersListPage />, { locale: "ar" });

    expect(await screen.findByText("لا توجد طلبات بعد")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "الطلبات" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "مشاركة رابط المتجر" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/أوردر/);
  });
});
