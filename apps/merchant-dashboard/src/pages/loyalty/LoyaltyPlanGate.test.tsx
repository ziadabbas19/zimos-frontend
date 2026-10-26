import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import type { LoyaltyOverview } from "@store-builder/api-client";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { LoyaltyProgramPage } from "./LoyaltyProgramPage";

vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  LOYALTY_ENABLED: true,
}));

const base: LoyaltyOverview = {
  settings: { enabled: false, earnPointsPerUnit: 1, pointValue: 10, minRedeemPoints: 100, maxRedeemPercent: 50, maxRedeemPointsPerOrder: null, expiryDays: null },
  active: false,
  planLocked: false,
  frozen: false,
  frozenReason: null,
  currency: "EGP",
  customersWithPoints: 3,
  outstandingPoints: 900,
  outstandingWorth: "9000",
};
const accountsOn = { enabled: true, channels: ["sms"] };

describe("Loyalty programme and the plan (LOYALTY_REQUIRE_PLAN_FEATURE)", () => {
  it("a plan without loyalty points: the plan notice, and the switch can't go on", async () => {
    fakeBackend({ "GET /loyalty": { ...base, planLocked: true, frozen: true, frozenReason: "plan" }, "GET /shopper-accounts": accountsOn });
    renderWithProviders(<LoyaltyProgramPage />);
    expect(await screen.findByText("Your plan doesn't include Loyalty points. Upgrade your plan to use it.")).toBeInTheDocument();
    expect(screen.getByText("See the plans").closest("a")).toHaveAttribute("href", "/subscription");
    expect(screen.getByRole("switch", { name: /Turn on the loyalty programme/ })).toBeDisabled();
    // The balances customers hold still show.
    expect(screen.getByText("Customers with points")).toBeInTheDocument();
  });

  it("a programme left on after a downgrade: frozen, said so, and it can still be switched off", async () => {
    const on = { ...base, settings: { ...base.settings, enabled: true }, active: true, planLocked: true, frozen: true, frozenReason: "plan" as const };
    const calls = fakeBackend({
      "GET /loyalty": on,
      "GET /shopper-accounts": accountsOn,
      "PUT /loyalty": { settings: { ...on.settings, enabled: false }, active: false },
    });
    const { user } = renderWithProviders(<LoyaltyProgramPage />);
    expect(await screen.findByText(/Your customers' points are frozen because your current plan doesn't include loyalty points/)).toBeInTheDocument();
    expect(screen.getByText("Frozen")).toBeInTheDocument();
    const toggle = screen.getByRole("switch", { name: /Turn on the loyalty programme/ });
    expect(toggle).toBeEnabled();
    await user.click(toggle);
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(callsTo(calls, "PUT", "/loyalty")).toHaveLength(1));
    expect(callsTo(calls, "PUT", "/loyalty")[0].body).toMatchObject({ enabled: false });
  });

  it("an unpaid subscription: the balances wait, with a way to the subscription", async () => {
    fakeBackend({
      "GET /loyalty": { ...base, settings: { ...base.settings, enabled: true }, active: true, frozen: true, frozenReason: "subscription" },
      "GET /shopper-accounts": accountsOn,
    });
    renderWithProviders(<LoyaltyProgramPage />);
    expect(await screen.findByText(/Your customers' points are frozen while your subscription is unpaid/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the subscription" })).toHaveAttribute("href", "/subscription");
    expect(screen.queryByText("See the plans")).not.toBeInTheDocument();
  });

  it("a store with the feature shows neither notice", async () => {
    fakeBackend({ "GET /loyalty": { ...base, settings: { ...base.settings, enabled: true }, active: true }, "GET /shopper-accounts": accountsOn });
    renderWithProviders(<LoyaltyProgramPage />);
    expect(await screen.findByText("Customers with points")).toBeInTheDocument();
    expect(screen.queryByText("See the plans")).not.toBeInTheDocument();
    expect(screen.queryByText(/are frozen/)).not.toBeInTheDocument();
  });

  it("reads the frozen notice in formal Arabic", async () => {
    fakeBackend({
      "GET /loyalty": { ...base, settings: { ...base.settings, enabled: true }, active: true, planLocked: true, frozen: true, frozenReason: "plan" },
      "GET /shopper-accounts": accountsOn,
    });
    renderWithProviders(<LoyaltyProgramPage />, { locale: "ar" });
    expect(await screen.findByText(/نقاط عملائك مجمّدة لأن خطتك الحالية لا تشمل نقاط الولاء/)).toBeInTheDocument();
    expect(screen.getByText("عرض الخطط").closest("a")).toHaveAttribute("href", "/subscription");
  });
});

describe("Most points on one order", () => {
  const on = { ...base, settings: { ...base.settings, enabled: true }, active: true };

  it("saves the cap, and an empty field as no cap", async () => {
    const calls = fakeBackend({ "GET /loyalty": on, "GET /shopper-accounts": accountsOn, "PUT /loyalty": { settings: on.settings, active: true } });
    const { user } = renderWithProviders(<LoyaltyProgramPage />);
    const cap = await screen.findByLabelText("Most points on one order");
    await user.type(cap, "250");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(callsTo(calls, "PUT", "/loyalty")).toHaveLength(1));
    expect(callsTo(calls, "PUT", "/loyalty")[0].body).toMatchObject({ maxRedeemPointsPerOrder: 250 });
  });

  it("refuses 0 before sending anything", async () => {
    const calls = fakeBackend({ "GET /loyalty": on, "GET /shopper-accounts": accountsOn });
    const { user } = renderWithProviders(<LoyaltyProgramPage />);
    await user.type(await screen.findByLabelText("Most points on one order"), "0");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Enter a whole number from 1, or leave it empty.")).toBeInTheDocument();
    expect(callsTo(calls, "PUT", "/loyalty")).toHaveLength(0);
  });
});
