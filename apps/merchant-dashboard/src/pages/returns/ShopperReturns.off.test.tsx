import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import type { Order, ReturnRequest } from "@store-builder/api-client";
import { fakeBackend } from "@/test/fakeBackend";
import { api, fake } from "@/test/mocks";
import { currentPath, renderWithProviders } from "@/test/renderWithProviders";
import { ReturnsPage } from "./ReturnsPage";

// No switch is mocked here: this is the dashboard as it ships, shopper returns off.
describe("Returns while shopper returns are switched off", () => {
  const order = fake<Order>({ id: "ord_1", orderNumber: "#1024", currency: "EGP", contactSnapshot: { fullName: "Mona Ali" }, items: [{ id: "item_1", productNameSnapshot: "Linen shirt", quantity: 1 }] });
  const ret = fake<ReturnRequest>({
    id: "ret_1",
    orderId: "ord_1",
    status: "requested",
    reason: "damaged",
    items: [{ orderItemId: "item_1", quantity: 1 }],
    restockedAt: null,
    createdAt: "2026-10-01T10:00:00.000Z",
    // What a newer API may send: none of it is drawn while the switch is off.
    source: "shopper",
    resolution: "exchange",
    photos: [{ uploadId: "up_1", url: "https://files.example/p1.jpg", expiresAt: "2026-10-01T10:05:00.000Z" }],
  });

  it("is the page it was: no setting, no badge, no photos, and approving is one tap", async () => {
    api.listReturns.mockResolvedValue([ret]);
    api.getOrder.mockResolvedValue(order);
    api.moderateReturn.mockResolvedValue({ ...ret, status: "approved" });
    const calls = fakeBackend({});
    const { user } = renderWithProviders(<ReturnsPage />);

    await user.click(await screen.findByRole("button", { name: "Approve" }));
    await waitFor(() => expect(api.moderateReturn).toHaveBeenCalledWith("ws_1", "ret_1", "approve"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("From customer")).not.toBeInTheDocument();
    expect(screen.queryByText("Exchange")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Returns from customers/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Open photo/ })).not.toBeInTheDocument();
    // Neither the shopper-returns setting nor a decision goes to the API.
    expect(calls).toHaveLength(0);
  });

  it("has «View order» beside the return's buttons: the order's page, in the same tab", async () => {
    api.listReturns.mockResolvedValue([ret]);
    api.getOrder.mockResolvedValue(order);
    const { user } = renderWithProviders(<ReturnsPage />, { route: "/returns", path: "/returns" });

    const link = await screen.findByRole("link", { name: "View order #1024" });
    expect(link).toHaveAttribute("href", "/orders/ord_1");
    expect(link).not.toHaveAttribute("target");
    await user.click(link);
    expect(currentPath()).toBe("/orders/ord_1");
    expect(api.moderateReturn).not.toHaveBeenCalled();
  });
});
