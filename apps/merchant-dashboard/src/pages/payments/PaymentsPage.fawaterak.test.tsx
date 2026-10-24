import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import type { PaymentGatewayInfo } from "@store-builder/api-client";
import { api, fake, testWorkspace } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { PaymentsPage } from "./PaymentsPage";

/**
 * Fawaterak on Payments > Gateways: the connect form and its steps come from
 * the server, like Paymob's and Kashier's; what this page adds is the fees
 * warning and the line that refunds are made in Fawaterak's dashboard.
 */

const owner = { currentWorkspace: { ...testWorkspace, role: "owner" } };

const fawaterak = (connection: PaymentGatewayInfo["connection"] = null) =>
  fake<PaymentGatewayInfo>({
    code: "fawaterak",
    name: "Fawaterak",
    methods: ["card"],
    currencies: ["EGP"],
    credentialFields: [
      { key: "clientId", secret: false, label: { en: "Client ID", ar: "معرّف العميل (Client ID)" } },
      { key: "clientSecret", secret: true, label: { en: "Client secret", ar: "السر الخاص بالعميل (Client secret)" } },
      { key: "vendorKey", secret: true, label: { en: "API key (vendor key)", ar: "مفتاح الـ API ‏(API key)" } },
    ],
    settingFields: [],
    setupSteps: {
      en: ["Switch on Visa / Mastercard in Fawaterak.", "Copy the Client ID and the Client secret."],
      ar: ["فعّل Visa / Mastercard في Fawaterak.", "انسخ الـ Client ID والـ Client secret."],
    },
    helpLinks: [{ label: { en: "Fawaterak API documentation", ar: "توثيق Fawaterak للمطورين" }, url: "https://app.fawaterk.com/documentation" }],
    webhookSetup: { field: "Webhook", perIntegration: false, automatic: true },
    methodsFromAccount: true,
    refundsInGatewayDashboard: true,
    connection,
  });

const connected = {
  status: "active" as const,
  mode: "live" as const,
  settings: { cardMethodId: 2, customerPaysFees: true },
  methods: ["card" as const],
  notices: ["customer_pays_fees"],
  webhookUrl: "https://api.zimos.test/api/v1/webhooks/payments/fawaterak/tok",
  lastVerifiedAt: "2026-10-23T10:00:00Z",
  lastWebhookAt: null,
  connectedAt: "2026-10-23T10:00:00Z",
  updatedAt: "2026-10-23T10:00:00Z",
};

function serve(gateway: PaymentGatewayInfo) {
  api.listPaymentGateways.mockResolvedValue(fake({ configured: true, onlineEnabled: true, gateways: [gateway] }));
  api.listPaymentMethods.mockResolvedValue(fake({ onlineEnabled: true, methods: [] }));
}

describe("Fawaterak on the payments page", () => {
  it("shows how to connect it and asks for exactly its three keys, two of them hidden", async () => {
    serve(fawaterak());
    api.connectPaymentGateway.mockResolvedValue(fake({}));
    const { user } = renderWithProviders(<PaymentsPage />, { route: "/payments?tab=gateways", workspace: owner });

    expect(await screen.findByText("How to connect Fawaterak")).toBeInTheDocument();
    expect(screen.getByText("Switch on Visa / Mastercard in Fawaterak.")).toBeInTheDocument();
    // Its logo, not the initials badge.
    expect(screen.getByRole("img", { name: "Fawaterak" })).toHaveAttribute("data-variant", "light");
    expect(screen.queryByText("FA")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Connect Fawaterak" }));
    await user.type(screen.getByLabelText("Client ID"), "client-1");
    await user.type(screen.getByLabelText("Client secret"), "secret-1");
    await user.type(screen.getByLabelText("API key (vendor key)"), "vendor-1");
    expect(screen.getByLabelText("Client secret")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("API key (vendor key)")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Client ID")).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "Check keys and connect" }));
    expect(api.connectPaymentGateway).toHaveBeenCalledWith("ws_1", "fawaterak", {
      credentials: { clientId: "client-1", clientSecret: "secret-1", vendorKey: "vendor-1" },
    });
  });

  it("once connected: warns that the shopper pays the fees, says where refunds are made, and needs nothing pasted", async () => {
    serve(fawaterak(connected));
    renderWithProviders(<PaymentsPage />, { route: "/payments?tab=gateways", workspace: owner });

    expect(await screen.findByText(/adds its fees to what the shopper pays/)).toBeInTheDocument();
    expect(screen.getByText("Refunds of Fawaterak payments are made in your Fawaterak dashboard, not from here.")).toBeInTheDocument();
    expect(screen.getByText("Nothing to paste: Fawaterak is given this URL with every payment.")).toBeInTheDocument();
    expect(screen.queryByText(/partial_refund/)).not.toBeInTheDocument();
  });

  it("speaks the dashboard's Arabic", async () => {
    serve(fawaterak(connected));
    renderWithProviders(<PaymentsPage />, { route: "/payments?tab=gateways", workspace: owner, locale: "ar" });

    const status = await screen.findByText(/يضيف رسومه على ما يدفعه العميل/);
    expect(status).toHaveAttribute("role", "status");
    expect(screen.getByText("استرداد مدفوعات Fawaterak يتم من لوحة تحكم Fawaterak، وليس من هنا.")).toBeInTheDocument();
  });

  it("a connection from an older server (no notices, no refund flag) shows neither line", async () => {
    serve(fake<PaymentGatewayInfo>({ ...fawaterak({ ...connected, notices: undefined }), refundsInGatewayDashboard: undefined }));
    renderWithProviders(<PaymentsPage />, { route: "/payments?tab=gateways", workspace: owner });

    const webhook = await screen.findByText("Webhook URL");
    expect(within(webhook.parentElement!).getByText(/To also see refunds/)).toBeInTheDocument();
    expect(screen.queryByText(/adds its fees/)).not.toBeInTheDocument();
    expect(screen.queryByText(/made in your Fawaterak dashboard/)).not.toBeInTheDocument();
  });
});
