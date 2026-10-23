import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import type { Order, PaymentTimeline } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { PaymentsSection } from "./PaymentsSection";

/**
 * A Fawaterak payment is refunded in Fawaterak's own dashboard (stage 1): the
 * refund dialog says so and its button sends nothing. Paymob's still refunds.
 */

const order = fake<Order>({
  id: "ord_1",
  currency: "EGP",
  financialState: "paid",
  customerId: null,
  items: [],
  updatedAt: "2026-10-23T10:00:00Z",
});

function timeline(providerCode: string, refundInGatewayDashboard?: boolean) {
  return fake<PaymentTimeline>({
    orderId: "ord_1",
    currency: "EGP",
    totalAmount: 20000,
    amountPaid: 20000,
    amountRefunded: 0,
    pendingRefunds: 0,
    refundable: 20000,
    refundVia: "gateway",
    perPayment: [{ paymentId: "pay_1", refundable: 20000, ...(refundInGatewayDashboard === undefined ? {} : { refundInGatewayDashboard }) }],
    alerts: [],
    paymentExpiresAt: null,
    attempts: [
      {
        id: "pay_1",
        providerCode,
        method: "card",
        mode: "live",
        status: "captured",
        amount: 20000,
        createdAt: "2026-10-23T10:00:00Z",
        maskedDisplay: "Visa-Mastercard",
        failureReason: null,
      },
    ],
    events: [],
    refunds: [],
  });
}

describe("refunding an order paid through Fawaterak", () => {
  it("points to the Fawaterak dashboard and sends nothing", async () => {
    api.getPaymentTimeline.mockResolvedValue(timeline("fawaterak", true));
    const { user } = renderWithProviders(<PaymentsSection order={order} onChanged={() => undefined} />);

    await user.click(await screen.findByRole("button", { name: "Refund" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Fawaterak payments are refunded in your Fawaterak dashboard/)).toBeInTheDocument();
    const button = within(dialog).getByRole("button", { name: "Refund in the Fawaterak dashboard" });
    expect(button).toBeDisabled();
    expect(within(dialog).queryByText(/through the gateway/)).not.toBeInTheDocument();
    await user.click(button);
    expect(api.request).not.toHaveBeenCalled();
  });

  it("in the dashboard's Arabic", async () => {
    api.getPaymentTimeline.mockResolvedValue(timeline("fawaterak", true));
    const { user } = renderWithProviders(<PaymentsSection order={order} onChanged={() => undefined} />, { locale: "ar" });

    await user.click(await screen.findByRole("button", { name: "استرداد" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "الاسترداد من لوحة Fawaterak" })).toBeDisabled();
  });

  it("a Paymob payment (or an older server without the flag) refunds as before", async () => {
    api.getPaymentTimeline.mockResolvedValue(timeline("paymob"));
    const { user } = renderWithProviders(<PaymentsSection order={order} onChanged={() => undefined} />);

    await user.click(await screen.findByRole("button", { name: "Refund" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: /^Refund EGP|^Refund .*200/ })).toBeEnabled();
    expect(within(dialog).queryByText(/dashboard/)).not.toBeInTheDocument();
  });
});
