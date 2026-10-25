import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import type { Order, Workspace } from "@store-builder/api-client";
import { api, authMock, fake, testUser, workspaceMock } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ConfirmationPanel } from "./ConfirmationPanel";

function order(overrides: Record<string, unknown> = {}): Order {
  return fake<Order>({
    id: "o1",
    orderNumber: "ORD-1001",
    paymentMethod: "cod",
    confirmationState: "pending",
    cancelledAt: null,
    totalAmount: "25000",
    currency: "EGP",
    contactSnapshot: { fullName: "Mona Ali", phone: "01012345678" },
    items: [{ productNameSnapshot: "Mug", quantity: 1, variantOptionsSnapshot: null }],
    confirmationTask: {
      id: "task_1",
      status: "queued",
      outcome: null,
      attemptCount: 1,
      nextRetryAt: null,
      completedAt: null,
      lockedBy: null,
      lockedAt: null,
      lockExpiresAt: null,
      assignedTo: null,
      attempts: [
        {
          id: "a1",
          outcome: "unreachable",
          channel: "call",
          source: "queue",
          notes: null,
          createdAt: "2026-09-30T10:00:00Z",
          agent: { id: "agent_2", fullName: "Bassem" },
        },
      ],
    },
    ...overrides,
  });
}

function asRole(role: string) {
  authMock.user = testUser;
  workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", role, settings: {} });
}

describe("ConfirmationPanel", () => {
  it("confirms with the channel the agent picked, and lists earlier attempts with theirs", async () => {
    asRole("confirmation_agent");
    api.confirmOrder.mockResolvedValue(fake({}));
    const onChanged = vi.fn();
    const { user } = renderWithProviders(<ConfirmationPanel order={order()} onChanged={onChanged} />);

    expect(screen.getByText("via Call", { exact: false })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "WhatsApp" }));
    await user.click(screen.getByRole("button", { name: "Confirm order" }));
    await waitFor(() => expect(api.confirmOrder).toHaveBeenCalledWith("ws_1", "o1", undefined, "whatsapp"));
  });

  it("does not confirm a locked order, says why, and offers no call or message (locked orders on)", () => {
    asRole("owner");
    const locked = order({
      contactLocked: true,
      lockReason: "balance",
      contactSnapshot: { fullName: "••••", phone: "••••" },
    });
    renderWithProviders(<ConfirmationPanel order={locked} onChanged={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Confirm order" })).toBeDisabled();
    expect(screen.getByText("Can't be confirmed while its customer details are hidden.")).toBeInTheDocument();
    expect(screen.getByTestId("locked-order-notice")).toHaveTextContent("your balance can't pay its fee");
    expect(screen.queryByRole("radio", { name: "WhatsApp" })).not.toBeInTheDocument();
  });

  it("holds an agent back from a task assigned to someone else", () => {
    asRole("confirmation_agent");
    const assigned = order();
    assigned.confirmationTask = { ...assigned.confirmationTask!, assignedTo: { id: "agent_2", fullName: "Bassem" } };
    renderWithProviders(<ConfirmationPanel order={assigned} onChanged={vi.fn()} />);
    expect(screen.getByText("Assigned to Bassem. Only they or a manager can confirm it.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm order" })).toBeDisabled();
  });

  it("keeps only the history once the order is confirmed", () => {
    asRole("owner");
    renderWithProviders(<ConfirmationPanel order={order({ confirmationState: "confirmed" })} onChanged={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Confirmation history" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm order" })).not.toBeInTheDocument();
  });
});
