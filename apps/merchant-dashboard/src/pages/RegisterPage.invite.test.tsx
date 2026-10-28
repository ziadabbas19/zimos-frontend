import { afterEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { rememberPendingInvite } from "@/lib/pendingInvite";
import type { PublicPlan, SignupOptions } from "@store-builder/api-client";
import { RegisterPage } from "./RegisterPage";

const plansRequired = () => {
  api.getSignupOptions.mockResolvedValue(fake<SignupOptions>({ planRequired: true, termsRequired: true, termsVersion: "1", verificationRequired: false }));
  api.listPublicPlans.mockResolvedValue([fake<PublicPlan>({ id: "plan_1", name: "Basic", monthlyPriceAmount: 29900, yearlyPriceAmount: 299000, currency: "EGP", features: [] })]);
};

afterEach(() => sessionStorage.clear());

describe("sign-up sent from a team invite", () => {
  it("fills in the invited address and asks for no plan, as the server asks none of an invitee", async () => {
    plansRequired();
    rememberPendingInvite({ token: "ef".repeat(32), email: "new@zimos.test" });
    renderWithProviders(<RegisterPage />, { route: "/register", path: "/register", auth: { user: null, status: "guest" } });

    expect(await screen.findByLabelText("Email")).toHaveValue("new@zimos.test");
    expect(screen.queryByRole("heading", { name: "Choose your plan" })).not.toBeInTheDocument();
  });

  it("still starts with the plan for anyone else", async () => {
    plansRequired();
    renderWithProviders(<RegisterPage />, { route: "/register", path: "/register", auth: { user: null, status: "guest" } });
    expect(await screen.findByRole("heading", { name: "Choose your plan" })).toBeInTheDocument();
  });
});
