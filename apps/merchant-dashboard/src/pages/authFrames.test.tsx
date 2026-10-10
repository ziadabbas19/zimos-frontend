import { afterEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { ApiError } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ChoosePlanPage } from "./ChoosePlanPage";
import { ChooseUsernamePage } from "./ChooseUsernamePage";
import { VerifyEmailPage } from "./VerifyEmailPage";
import { WorkspacePickerPage } from "./WorkspacePickerPage";

/**
 * The pages a merchant meets before the dashboard share the sign-in frame:
 * one card, the logo over it, the language switch in the corner.
 */

const card = () => document.querySelector('[data-slot="auth-card"]');

afterEach(() => {
  api.verifyEmail.mockReset();
});

describe("the email confirmation link", () => {
  it("confirms the address once and offers the way to sign in", async () => {
    api.verifyEmail.mockResolvedValue(fake({}));
    renderWithProviders(<VerifyEmailPage />, { route: "/verify-email?token=abc" });

    expect(await screen.findByRole("heading", { name: "Your email is confirmed" })).toBeInTheDocument();
    expect(api.verifyEmail).toHaveBeenCalledTimes(1);
    expect(api.verifyEmail).toHaveBeenCalledWith("abc");
    expect(screen.getByText("Sign in").closest("a")).toHaveAttribute("href", "/login");
    expect(card()).toContainElement(screen.getByRole("heading", { name: "Your email is confirmed" }));
  });

  it("says a link with no token cannot work, without asking the server", () => {
    renderWithProviders(<VerifyEmailPage />, { route: "/verify-email" });

    expect(screen.getByRole("heading", { name: "We couldn't confirm your email" })).toBeInTheDocument();
    expect(screen.getByText("This link isn't valid. It may be incomplete or copied wrongly.")).toBeInTheDocument();
    expect(api.verifyEmail).not.toHaveBeenCalled();
  });

  it("repeats the server's own reason for a refused link", async () => {
    api.verifyEmail.mockRejectedValue(new ApiError("This link was already used.", 400, "INVALID_VERIFICATION_TOKEN"));
    renderWithProviders(<VerifyEmailPage />, { route: "/verify-email?token=old" });

    expect(await screen.findByText("This link was already used.")).toBeInTheDocument();
    expect(screen.getByText("Back to sign in").closest("a")).toHaveAttribute("href", "/login");
  });

  it("reads in the dashboard's own Arabic", async () => {
    api.verifyEmail.mockResolvedValue(fake({}));
    renderWithProviders(<VerifyEmailPage />, { route: "/verify-email?token=abc", locale: "ar" });
    expect(await screen.findByRole("heading", { name: "تم تأكيد بريدك الإلكتروني" })).toBeInTheDocument();
  });
});

describe("the pages before the dashboard", () => {
  it("put the username choice in the sign-in card", async () => {
    api.getUsernameSuggestion.mockResolvedValue("nile-store");
    renderWithProviders(<ChooseUsernamePage />, { route: "/choose-username", locale: "ar" });

    const title = await screen.findByRole("heading", { name: "اختر اسم المستخدم" });
    expect(card()).toContainElement(title);
    expect(screen.getByRole("button", { name: "متابعة" })).toBeInTheDocument();
  });

  it("put the plan choice in the sign-in card, with the plans and the terms as before", async () => {
    api.listPublicPlans.mockResolvedValue([]);
    renderWithProviders(<ChoosePlanPage />, { route: "/choose-plan" });

    const title = await screen.findByRole("heading", { name: "Choose your plan" });
    expect(card()).toContainElement(title);
    expect(api.listPublicPlans).toHaveBeenCalled();
  });

  it("put the store choice in the sign-in card", async () => {
    api.getSignupOptions.mockResolvedValue(fake({}));
    api.listPublicPlans.mockResolvedValue([]);
    renderWithProviders(<WorkspacePickerPage />, { route: "/workspaces" });

    const title = await screen.findByRole("heading", { name: "Choose a store" });
    expect(card()).toContainElement(title);
  });
});
