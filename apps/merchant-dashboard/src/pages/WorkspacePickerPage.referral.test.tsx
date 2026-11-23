import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { api, fake, workspaceMock } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { WorkspacePickerPage } from "./WorkspacePickerPage";

/**
 * The referral code on the store setup: a link that opens the field, closed
 * until asked for, and the code goes with the new store as before.
 */

function setUp(locale?: "ar") {
  api.getSignupOptions.mockResolvedValue(fake({}));
  api.listPublicPlans.mockResolvedValue([]);
  api.checkWorkspaceSlug.mockResolvedValue(fake({ available: true }));
  renderWithProviders(<WorkspacePickerPage />, { route: "/workspaces", locale });
}

describe("the referral code on the store setup", () => {
  it("stays behind a link until asked for, and the link opens and closes it", async () => {
    setUp();
    const toggle = await screen.findByRole("button", { name: "Do you have a referral code?" });
    const field = screen.getByLabelText("Referral code (optional)");

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", field.closest("[id]:not(input)")?.id);
    expect(field).not.toBeVisible();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(field).toBeVisible();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(field).not.toBeVisible();
  });

  it("sends the code with the new store, as before", async () => {
    setUp();
    fireEvent.change(await screen.findByLabelText("Store name"), { target: { value: "Nile Shop" } });
    fireEvent.click(screen.getByRole("button", { name: "Do you have a referral code?" }));
    fireEvent.change(screen.getByLabelText("Referral code (optional)"), { target: { value: "cairo10" } });

    const create = screen.getByRole("button", { name: "Create store" });
    await waitFor(() => expect(create).toBeEnabled());
    fireEvent.click(create);

    await waitFor(() => expect(workspaceMock.createWorkspace).toHaveBeenCalled());
    expect(workspaceMock.createWorkspace).toHaveBeenCalledWith("Nile Shop", "nile-shop", "CAIRO10", undefined);
  });

  it("reads in Arabic without the word for an agent", async () => {
    setUp("ar");
    const toggle = await screen.findByRole("button", { name: "هل لديك كود إحالة؟" });
    fireEvent.click(toggle);
    expect(screen.getByText("أدخله الآن، أو أضفه لاحقا من الإعدادات.")).toBeVisible();
    expect(document.body.textContent).not.toMatch(/مندوب|Zimos/);
  });
});
