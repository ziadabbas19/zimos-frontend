import { describe, expect, it } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { LOCKED_MASK, type LockedOrdersSummary, type Order, type Workspace, type WorkspaceAccess } from "@store-builder/api-client";
import { api, fake, workspaceMock } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { publishWorkspaceAccess } from "@/lib/workspaceAccess";
import { BalanceWidget, HiddenValue, LockedOrderNotice, LockedOrdersBanner } from "./OrdersLock";

// Locked orders (components/OrdersLock.tsx): the toolbar's balance, the
// locked-orders banner and how a hidden field reads — only while the API says
// locked orders are on.

const FEE = 75;

function accessWith(fields: Partial<WorkspaceAccess>): WorkspaceAccess {
  return fake<WorkspaceAccess>({
    restricted: false,
    reasons: [],
    billing: { phase: "ok", status: "active", trialing: false, periodEnd: "2090-01-01", restrictsAt: null, enforced: true },
    suspension: { suspended: false, since: null },
    wallet: null,
    ordersLock: true,
    storefrontClosed: false,
    ...fields,
  });
}

const wallet = (balance: number, freeOrdersLeft = 0) => ({
  phase: "ok" as const,
  balance,
  fee: FEE,
  ordersLeft: null,
  ordersBeforeOverdraft: null,
  overdraft: 0,
  freeOrdersLeft,
  currency: "EGP",
});

function inStore(id: string, role = "owner", access?: WorkspaceAccess) {
  workspaceMock.currentWorkspace = fake<Workspace>({ id, name: "Nile Store", role });
  if (access) act(() => publishWorkspaceAccess(id, access));
}

describe("BalanceWidget", () => {
  it("shows the balance and the orders it covers (free orders + whole fees), with Top up for the owner", () => {
    inStore("ws_ok", "owner", accessWith({ wallet: wallet(1000, 2) }));
    renderWithProviders(<BalanceWidget />);
    const pill = screen.getByRole("link", { name: /Top up/ });
    expect(pill).toHaveAttribute("href", "/subscription?tab=usage&wallet=topup");
    expect(pill).toHaveAttribute("data-tone", "ok");
    // 2 free + floor(1000 / 75) = 15.
    expect(pill).toHaveTextContent("Covers 15 orders");
    // EGP 10 (1000 minor units).
    expect(pill).toHaveTextContent(/10/);
  });

  it("turns to a warning below 10 orders and to an alert at zero, in Arabic", () => {
    inStore("ws_low", "owner", accessWith({ wallet: wallet(FEE * 3) }));
    const { unmount } = renderWithProviders(<BalanceWidget />, { locale: "ar" });
    expect(screen.getByRole("link")).toHaveAttribute("data-tone", "low");
    // Arabic plural: 3 → "طلبات" (lib/plural).
    expect(screen.getByRole("link")).toHaveTextContent(/يكفي .*طلبات/);
    unmount();

    inStore("ws_empty", "owner", accessWith({ wallet: wallet(FEE - 1) }));
    renderWithProviders(<BalanceWidget />, { locale: "ar" });
    const pill = screen.getByRole("link");
    expect(pill).toHaveAttribute("data-tone", "danger");
    expect(pill).toHaveTextContent("نفد الرصيد");
    expect(pill).toHaveTextContent("اشحن الرصيد");
  });

  it("is not a link for a role that can't top up, and is absent off a fee plan or with the switch off", () => {
    inStore("ws_staff", "order_operator", accessWith({ wallet: wallet(1000) }));
    const { unmount } = renderWithProviders(<BalanceWidget />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Covers 13 orders");
    unmount();

    inStore("ws_monthly", "owner", accessWith({ wallet: null }));
    const second = renderWithProviders(<BalanceWidget />);
    expect(second.container.querySelector('[data-slot="balance"]')).toBeNull();
    second.unmount();

    inStore("ws_off", "owner", accessWith({ wallet: wallet(1000), ordersLock: false }));
    expect(renderWithProviders(<BalanceWidget />).container.querySelector('[data-slot="balance"]')).toBeNull();
  });
});

const summary = (fields: Partial<LockedOrdersSummary>): LockedOrdersSummary => ({
  enabled: true,
  mode: "pay_per_order",
  reason: "balance",
  canPay: false,
  count: 3,
  due: 0,
  totals: [{ currency: "EGP", amount: 45000, count: 3 }],
  ...fields,
});

describe("LockedOrdersBanner", () => {
  it("says how many orders are locked and what they are worth, with Top up", async () => {
    inStore("ws_banner", "owner", accessWith({ wallet: wallet(0) }));
    api.getLockedOrdersSummary.mockResolvedValue(summary({}));
    renderWithProviders(<LockedOrdersBanner />);
    const banner = await screen.findByTestId("locked-orders-banner");
    expect(banner).toHaveTextContent("You have 3 orders worth");
    expect(banner).toHaveTextContent(/450/);
    expect(screen.getByRole("link", { name: "Top up" })).toHaveAttribute("href", "/subscription?tab=usage&wallet=topup");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("sends a lapsed subscription to renew, in Arabic", async () => {
    inStore("ws_lapsed", "owner", accessWith({ billing: { phase: "restricted", status: "past_due", trialing: false, periodEnd: "2020-01-01", restrictsAt: null, enforced: true } }));
    api.getLockedOrdersSummary.mockResolvedValue(summary({ mode: "lapsed", reason: "subscription", count: 2 }));
    renderWithProviders(<LockedOrdersBanner />, { locale: "ar" });
    const banner = await screen.findByTestId("locked-orders-banner");
    expect(banner).toHaveTextContent("لديك طلبان");
    expect(banner).toHaveTextContent("جدّد اشتراكك");
    expect(screen.getByRole("link", { name: "جدّد الاشتراك" })).toHaveAttribute("href", "/subscription?tab=plans");
  });

  it("offers to pay the fees due when the balance can, and refreshes", async () => {
    inStore("ws_due", "owner", accessWith({ wallet: wallet(500) }));
    api.getLockedOrdersSummary.mockResolvedValue(summary({ canPay: true, count: 1, due: 1 }));
    api.settleLockedOrders.mockResolvedValue({ settled: 1, left: 0, locked: summary({ canPay: true, count: 0, due: 0, totals: [] }) });
    renderWithProviders(<LockedOrdersBanner />);
    fireEvent.click(await screen.findByRole("button", { name: "Pay the fees and open them" }));
    await waitFor(() => expect(api.settleLockedOrders).toHaveBeenCalledWith("ws_due"));
    await waitFor(() => expect(screen.queryByTestId("locked-orders-banner")).not.toBeInTheDocument());
  });

  it("asks nothing while locked orders are off", () => {
    inStore("ws_quiet", "owner", accessWith({ ordersLock: false }));
    renderWithProviders(<LockedOrdersBanner />);
    expect(api.getLockedOrdersSummary).not.toHaveBeenCalled();
  });
});

describe("a hidden field and a locked order", () => {
  it("reads as hidden, never as empty, and the notice names the way to open it", () => {
    inStore("ws_notice", "owner");
    renderWithProviders(
      <>
        <HiddenValue />
        <LockedOrderNotice order={fake<Order>({ contactLocked: true, lockReason: "balance" })} />
      </>
    );
    expect(screen.getByText("Hidden")).toBeInTheDocument();
    expect(screen.getByTestId("locked-order-notice")).toHaveTextContent("your balance can't pay its fee");
    expect(screen.getByRole("link", { name: "Top up" })).toBeInTheDocument();
    expect(LOCKED_MASK).toBe("••••");
  });
});
