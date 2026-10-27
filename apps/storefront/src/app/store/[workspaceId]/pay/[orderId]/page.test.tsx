import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError } from "@store-builder/api-client";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";

// Paying an online order on delivery instead, when the store wants the phone
// verified first: the switch answers 428 OTP_REQUIRED and a code goes to the
// order's phone; the code comes back in the same switch.

const getOrderPayment = vi.fn();
const switchOrderToCod = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceId: "ws1", orderId: "o1" }),
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/StoreRoute", () => ({
  StoreLink: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useStoreBasePath: () => "/store/ws1",
}));

vi.mock("@/lib/payments", () => ({
  getPaymentToken: () => "pay-token",
  paymentPageUrl: () => "/store/ws1/pay/o1",
  usePreviewToken: () => undefined,
}));

vi.mock("@/lib/apiClient", () => ({
  createStorefrontApiClient: () => ({ getOrderPayment, switchOrderToCod }),
}));

const { default: PayPage } = await import("./page");

const STORE: StoreInfo = {
  workspaceId: "ws1",
  id: "ws1",
  slug: "shop",
  name: "Shop",
  currency: "EGP",
  logoUrl: null,
  phone: null,
  checkout: { email: "optional", postal_code: "hidden", notes: "optional" },
  orderBump: null,
};

const awaiting = {
  orderId: "o1",
  orderNumber: "1001",
  status: "awaiting_payment",
  financialState: "pending",
  paymentMethod: "card",
  totalAmount: 20000,
  amountPaid: 0,
  currency: "EGP",
  expiresAt: null,
  testMode: false,
  attempt: { id: "a1", status: "failed", provider: "paymob", method: "card", mode: "live", redirectUrl: null, failureReason: null, createdAt: "2026-10-26T10:00:00Z" },
  canRetry: false,
  retriesLeft: 0,
  canSwitchToCod: true,
  methods: [],
};

const otpRequired = () =>
  new ApiError("Enter the code we sent to your phone to place the order", 428, "OTP_REQUIRED", {
    error: { code: "OTP_REQUIRED", details: { channel: "whatsapp", codeLength: 4, resendAfterSeconds: 60, phoneHint: "•••••••5678" } },
  });

afterEach(() => {
  cleanup();
  getOrderPayment.mockReset();
  switchOrderToCod.mockReset();
});

function renderPage() {
  return render(
    <StoreContextProvider locale="en" store={STORE}>
      <PayPage />
    </StoreContextProvider>
  );
}

describe("switching to cash on delivery", () => {
  it("asks for the code the store sent, then switches with it", async () => {
    getOrderPayment.mockResolvedValue(awaiting);
    switchOrderToCod.mockRejectedValueOnce(otpRequired()).mockResolvedValueOnce({ ...awaiting, status: "cod", paymentMethod: "cod" });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Pay cash on delivery instead" }));
    expect(await screen.findByText("Confirm your phone number first")).toBeTruthy();
    expect(screen.getByText(/ending •••••••5678/)).toBeTruthy();
    expect(switchOrderToCod).toHaveBeenLastCalledWith("ws1", "o1", "pay-token", undefined, undefined);

    fireEvent.change(screen.getByLabelText("Code"), { target: { value: "12a34" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm and pay on delivery" }));
    await waitFor(() => expect(switchOrderToCod).toHaveBeenLastCalledWith("ws1", "o1", "pay-token", undefined, "1234"));
    expect(await screen.findByText("Done — you'll pay cash on delivery.")).toBeTruthy();
  });

  it("says when the code is wrong, and keeps the code step open", async () => {
    getOrderPayment.mockResolvedValue(awaiting);
    switchOrderToCod
      .mockRejectedValueOnce(otpRequired())
      .mockRejectedValueOnce(new ApiError("That code is not valid", 422, "INVALID_CODE", { error: { code: "INVALID_CODE" } }));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Pay cash on delivery instead" }));
    fireEvent.change(await screen.findByLabelText("Code"), { target: { value: "0000" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm and pay on delivery" }));
    expect((await screen.findByRole("alert")).textContent).toContain("That code isn't right");
    expect(screen.getByRole("button", { name: "Send the code again" })).toBeTruthy();
  });
});
