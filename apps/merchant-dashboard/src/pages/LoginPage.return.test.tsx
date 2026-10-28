import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LocaleProvider } from "@/i18n/LocaleContext";
import { ToastProvider } from "@/components/Toast";
import { LocationProbe } from "@/test/LocationProbe";
import { authMock } from "@/test/mocks";
import { currentPath } from "@/test/renderWithProviders";
import { LoginPage } from "./LoginPage";

describe("LoginPage, sent from another page", () => {
  it("goes back to that page with its query (the invite link's token)", async () => {
    Object.assign(authMock, { user: null, status: "guest" });
    localStorage.setItem("zimos.locale", "en");
    const token = "cd".repeat(32);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[{ pathname: "/login", state: { from: { pathname: "/invites", search: `?token=${token}` } } }]}>
        <LocaleProvider>
          <ToastProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="*" element={null} />
            </Routes>
            <LocationProbe />
          </ToastProvider>
        </LocaleProvider>
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText("Email or username"), "new@zimos.test");
    await user.type(screen.getByLabelText("Password"), "Passw0rd!123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(currentPath()).toBe(`/invites?token=${token}`));
  });
});
