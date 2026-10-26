import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { ApiError, type WhatsappIntegrationConnected } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { WhatsappSection } from "./WhatsappSection";

const connected = (overrides: Partial<WhatsappIntegrationConnected> = {}) =>
  fake<WhatsappIntegrationConnected>({
    connected: true,
    status: "connected",
    phoneNumberId: "1122334455",
    businessAccountId: null,
    displayPhoneNumber: "+20 10 0000 1111",
    verifiedName: "Nile Store",
    accessTokenMask: "••••7890",
    appSecretSet: true,
    webhook: { url: "https://api.test/api/v1/webhooks/whatsapp/ws_1", verifyToken: "verify-token" },
    lastVerifiedAt: null,
    lastError: null,
    planLocked: false,
    ...overrides,
  });

// 403 from the plan gate (WHATSAPP_REQUIRE_PLAN_FEATURE with PLAN_FEATURE_ENFORCEMENT).
const planRefusal = () =>
  new ApiError("Your plan doesn't include WhatsApp order confirmation. Upgrade your plan to use it.", 403, "PLAN_FEATURE_REQUIRED", {
    error: {
      code: "PLAN_FEATURE_REQUIRED",
      message: "Your plan doesn't include WhatsApp order confirmation. Upgrade your plan to use it.",
      details: { feature: "whatsapp_confirmation", label: { en: "WhatsApp order confirmation", ar: "تأكيد الطلبات عبر واتساب" } },
    },
  });

async function fillRequired(user: ReturnType<typeof renderWithProviders>["user"]) {
  await user.type(await screen.findByLabelText(/Phone number ID/), "1122334455");
  await user.type(screen.getByLabelText(/Permanent access token/), "EAAG-test-access-token-1234567890");
}

describe("WhatsappSection: the App Secret", () => {
  it("asks for it on a first connection, and says why", async () => {
    api.getWhatsappIntegration.mockResolvedValue({ connected: false, planLocked: false });
    api.connectWhatsapp.mockResolvedValue(connected());
    const { user } = renderWithProviders(<WhatsappSection />);

    await fillRequired(user);
    const connect = screen.getByRole("button", { name: "Connect" });
    expect(connect).toBeDisabled();
    expect(screen.getByText(/without it we refuse them all — no customer reply or Confirm \/ Cancel tap would reach you/)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^App Secret/), "meta-app-secret-for-tests");
    expect(connect).toBeEnabled();
    await user.click(connect);
    expect(api.connectWhatsapp).toHaveBeenCalledWith("ws_1", {
      phoneNumberId: "1122334455",
      accessToken: "EAAG-test-access-token-1234567890",
      appSecret: "meta-app-secret-for-tests",
    });
  });

  it("puts the server's WHATSAPP_APP_SECRET_REQUIRED on the field", async () => {
    api.getWhatsappIntegration.mockResolvedValue({ connected: false });
    api.connectWhatsapp.mockRejectedValue(
      new ApiError("The App Secret is required", 422, "WHATSAPP_APP_SECRET_REQUIRED", { error: { code: "WHATSAPP_APP_SECRET_REQUIRED", message: "The App Secret is required" } })
    );
    const { user } = renderWithProviders(<WhatsappSection />);
    await fillRequired(user);
    await user.type(screen.getByLabelText(/^App Secret/), "meta-app-secret-for-tests");
    await user.click(screen.getByRole("button", { name: "Connect" }));
    expect(await screen.findByText("The App Secret is required: without it no customer reply reaches you.")).toBeInTheDocument();
  });

  it("tells a store connected without one what it is missing, and opens the form to add it", async () => {
    api.getWhatsappIntegration.mockResolvedValue(connected({ appSecretSet: false }));
    const { user } = renderWithProviders(<WhatsappSection />);

    expect(await screen.findByText("Add your App Secret")).toBeInTheDocument();
    expect(screen.getByText("Not set — no customer reply reaches you")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add App Secret" }));

    await fillRequired(user);
    // None saved: still required.
    expect(screen.getByRole("button", { name: "Connect" })).toBeDisabled();
  });

  it("lets a reconnect keep the saved one", async () => {
    api.getWhatsappIntegration.mockResolvedValue(connected());
    api.connectWhatsapp.mockResolvedValue(connected());
    const { user } = renderWithProviders(<WhatsappSection />);

    expect(screen.queryByText("Add your App Secret")).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Reconnect" }));
    await fillRequired(user);
    expect(screen.getByText("Leave it empty to keep the saved App Secret.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Connect" }));
    expect(api.connectWhatsapp).toHaveBeenCalledWith("ws_1", { phoneNumberId: "1122334455", accessToken: "EAAG-test-access-token-1234567890" });
  });
});

describe("WhatsappSection: the plan", () => {
  it("shows the plan notice instead of the form when a new connection would be refused", async () => {
    api.getWhatsappIntegration.mockResolvedValue({ connected: false, planLocked: true });
    renderWithProviders(<WhatsappSection />);

    expect(await screen.findByText("Your plan doesn't include WhatsApp order confirmation. Upgrade your plan to use it.")).toBeInTheDocument();
    // PlanFeatureNotice's link is drawn as a button.
    expect(screen.getByText("See the plans").closest("a")).toHaveAttribute("href", "/subscription");
    expect(screen.queryByLabelText(/Phone number ID/)).not.toBeInTheDocument();
  });

  it("says it in Arabic too", async () => {
    api.getWhatsappIntegration.mockResolvedValue({ connected: false, planLocked: true });
    renderWithProviders(<WhatsappSection />, { locale: "ar" });
    expect(await screen.findByText("خطتك الحالية لا تشمل تأكيد الطلبات عبر واتساب. رقِّ خطتك لاستخدامها.")).toBeInTheDocument();
    expect(screen.getByText("عرض الخطط").closest("a")).toHaveAttribute("href", "/subscription");
  });

  it("names the plan, not the member's role, when the server refuses the connection for the plan", async () => {
    api.getWhatsappIntegration.mockResolvedValue({ connected: false });
    api.connectWhatsapp.mockRejectedValue(planRefusal());
    const { user } = renderWithProviders(<WhatsappSection />);
    await fillRequired(user);
    await user.type(screen.getByLabelText(/^App Secret/), "meta-app-secret-for-tests");
    await user.click(screen.getByRole("button", { name: "Connect" }));

    expect(await screen.findByText("Your plan doesn't include WhatsApp order confirmation. Upgrade your plan to use it.")).toBeInTheDocument();
    expect(screen.queryByText("Only store owners/managers can change integrations.")).not.toBeInTheDocument();
  });

  it("keeps a connected number on a plan without the feature, and warns before disconnecting it", async () => {
    api.getWhatsappIntegration.mockResolvedValue(connected({ planLocked: true }));
    const { user } = renderWithProviders(<WhatsappSection />);

    expect(await screen.findByText("+20 10 0000 1111")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Disconnect" }));
    const dialog = await screen.findByRole("dialog", { name: "Disconnect WhatsApp?" });
    expect(within(dialog).getByText(/once disconnected, you can only connect again after upgrading your plan/)).toBeInTheDocument();
  });
});
