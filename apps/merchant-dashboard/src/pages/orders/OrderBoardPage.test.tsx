import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { Order, OrderPipeline } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { moveNeedsDialog, movesBackQuietly } from "./detail/orderMoves";
import { OrderBoardPage } from "./OrderBoardPage";

/**
 * The orders board: every stage a column, an order moved from its card. A
 * move can be taken back only where the way back tells the customer nothing.
 */

function order(id: string, stage: string, name: string, nextStages: string[]): Order {
  return fake<Order>({
    id,
    orderNumber: `#10${id}`,
    stage,
    nextStages,
    currency: "EGP",
    totalAmount: "45000",
    createdAt: "2026-10-09T10:00:00Z",
    updatedAt: "2026-10-09T10:00:00Z",
    contactSnapshot: { fullName: name, phone: "01012345678" },
    shippingAddress: { city: "Cairo", province: "Cairo", addressLine: "12 Street" },
    items: [{ id: "i" + id, productNameSnapshot: "Headphones", quantity: 1, lineTotalAmount: "45000" }],
    shipments: [],
    riskFlags: [],
    riskLevel: "low",
    paymentMethod: "cod",
  });
}

const fresh = order("1", "pending_confirmation", "Mona Adel", ["ready_to_ship", "cancelled", "needs_follow_up"]);
const confirmed = order("2", "ready_to_ship", "Omar Ali", ["pending_confirmation", "shipped", "cancelled"]);

function serve() {
  api.getOrderPipeline.mockResolvedValue(fake<OrderPipeline>({ stages: { pending_confirmation: 1, ready_to_ship: 1 }, total: 2 }));
  api.listOrders.mockImplementation(async (_ws: string, params?: { stage?: string }) => {
    if (params?.stage === "pending_confirmation") return fake({ orders: [fresh], nextCursor: null });
    if (params?.stage === "ready_to_ship") return fake({ orders: [confirmed], nextCursor: null });
    return fake({ orders: [], nextCursor: null });
  });
  api.request.mockImplementation(async (path: string, init?: { method?: string; body?: unknown }) => {
    const status = (init?.body as { status?: string } | undefined)?.status;
    if (path === "/workspaces/ws_1/orders/1/status" && init?.method === "PATCH") {
      return { order: { ...fresh, stage: status, nextStages: status === "ready_to_ship" ? ["pending_confirmation", "shipped", "cancelled"] : ["ready_to_ship", "cancelled", "needs_follow_up"] } };
    }
    if (path === "/workspaces/ws_1/orders/2/status" && init?.method === "PATCH") {
      return { order: { ...confirmed, stage: status, nextStages: ["ready_to_ship", "cancelled", "needs_follow_up"] } };
    }
    return new Promise(() => undefined);
  });
}

const moves = () => api.request.mock.calls.filter(([, init]) => init?.method === "PATCH").map(([path, init]) => ({ path, body: init?.body }));

afterEach(() => {
  api.request.mockReset();
});

describe("the orders board", () => {
  it("draws a column per stage, with its count on the chip that jumps to it", async () => {
    serve();
    renderWithProviders(<OrderBoardPage />, { route: "/orders/board", path: "/orders/board" });

    expect(await screen.findByRole("link", { name: "Open order #101" })).toHaveAttribute("href", "/orders/1");
    const chips = screen.getByRole("group", { name: "Jump to a stage" });
    expect(within(chips).getByRole("button", { name: /^New/ })).toHaveTextContent("New1");
    expect(within(chips).getByRole("button", { name: /^Ready to ship/ })).toHaveTextContent("Ready to ship1");
    expect(within(chips).getByRole("button", { name: /^Shipped/ })).toHaveTextContent("Shipped0");
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(
      expect.arrayContaining(["New", "Follow up", "Ready to ship", "Shipped", "Out for delivery", "Delivered", "Returned"])
    );
  });

  it("moves an order from its card and takes the move back when the way back is quiet", async () => {
    serve();
    const { user } = renderWithProviders(<OrderBoardPage />, { route: "/orders/board", path: "/orders/board" });

    await user.click(await screen.findByRole("button", { name: "Move order #101 to another stage" }));
    const sheet = screen.getByRole("dialog");
    await user.click(within(sheet).getByRole("button", { name: /^Ready to ship/ }));

    await waitFor(() => expect(moves()).toEqual([{ path: "/workspaces/ws_1/orders/1/status", body: { status: "ready_to_ship" } }]));
    // Back to "New" tells the customer nothing: the toast offers Undo, and Undo sends the plain move back.
    await user.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() => expect(moves()).toHaveLength(2));
    expect(moves()[1]).toEqual({ path: "/workspaces/ws_1/orders/1/status", body: { status: "pending_confirmation" } });
  });

  it("offers no Undo when putting the order back would tell the customer again", async () => {
    serve();
    const { user } = renderWithProviders(<OrderBoardPage />, { route: "/orders/board", path: "/orders/board" });

    await user.click(await screen.findByRole("button", { name: "Move order #102 to another stage" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^New/ }));

    await waitFor(() => expect(moves()).toEqual([{ path: "/workspaces/ws_1/orders/2/status", body: { status: "pending_confirmation" } }]));
    expect(await screen.findByText("#102 moved to “New”.")).toBeInTheDocument();
    // "Ready to ship" is the confirmation the customer is told about.
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });

  it("reads in the dashboard's own Arabic", async () => {
    serve();
    renderWithProviders(<OrderBoardPage />, { route: "/orders/board", path: "/orders/board", locale: "ar" });

    expect(await screen.findByRole("link", { name: "فتح الطلب #101" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "الانتقال إلى مرحلة" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "نقل الطلب #101 إلى مرحلة أخرى" })).toBeInTheDocument();
  });
});

describe("an order's moves", () => {
  const plain = { stage: "pending_confirmation" as const, shipments: [] };

  it("asks first before a cancellation, a follow-up, a reopening and a shipping stage with no shipment", () => {
    expect(moveNeedsDialog(plain, "ready_to_ship")).toBe(false);
    expect(moveNeedsDialog(plain, "cancelled")).toBe(true);
    expect(moveNeedsDialog(plain, "needs_follow_up")).toBe(true);
    expect(moveNeedsDialog(plain, "shipped")).toBe(true);
    expect(moveNeedsDialog({ stage: "cancelled", shipments: [] }, "pending_confirmation")).toBe(true);
    expect(moveNeedsDialog(fake({ stage: "ready_to_ship", shipments: [{ status: "created" }] }), "shipped")).toBe(false);
  });

  it("knows which stages reach the customer when an order arrives in them", () => {
    expect(movesBackQuietly("pending_confirmation")).toBe(true);
    for (const stage of ["ready_to_ship", "needs_follow_up", "shipped", "out_for_delivery", "delivered", "returned", "cancelled"] as const) {
      expect(movesBackQuietly(stage)).toBe(false);
    }
  });
});
