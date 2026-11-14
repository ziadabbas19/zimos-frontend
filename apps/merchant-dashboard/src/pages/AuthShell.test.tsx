import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AuthCallbackPage } from "./AuthCallbackPage";
import { ForgotPasswordPage } from "./ForgotPasswordPage";
import { LoginPage } from "./LoginPage";
import { ResetPasswordPage } from "./ResetPasswordPage";
import shell from "./AuthShell.tsx?raw";

/** The one frame of every screen outside the dashboard: our mark, the language switch, one card. */
function expectShell(container: HTMLElement) {
  const frame = container.querySelector(".auth-glass")!;
  expect(frame).not.toBeNull();
  // Our logo, at the top.
  const logo = frame.querySelector("header .zimos-logo");
  expect(logo).not.toBeNull();
  expect(logo!.querySelector("img")).toHaveAttribute("src", "/brand/zimos-logo-light.png");
  // The language can be chosen before signing in.
  expect(frame.querySelector('[data-slot="auth-corner"] button')).not.toBeNull();
  // One card, and the page's title is its h1.
  expect(frame.querySelectorAll('[data-slot="auth-card"]')).toHaveLength(1);
  expect(frame.querySelectorAll("h1")).toHaveLength(1);
}

describe("the frame of the sign-in screens", () => {
  it("frames sign in, with the form it always had", () => {
    const { container } = renderWithProviders(<LoginPage />, { route: "/login", auth: { status: "guest", user: null } });
    expectShell(container);
    expect(screen.getByRole("heading", { level: 1, name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email or username")).toHaveAttribute("autocomplete", "username");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: /Google/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Forgot/ })).toHaveAttribute("href", "/forgot-password");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("shows what was typed in the password when asked", async () => {
    const { user } = renderWithProviders(<LoginPage />, { route: "/login", auth: { status: "guest", user: null } });
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");
  });

  it("frames forgot password and the new-password page", () => {
    const forgot = renderWithProviders(<ForgotPasswordPage />, { route: "/forgot-password", auth: { status: "guest", user: null } });
    expectShell(forgot.container);
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
    forgot.unmount();

    const reset = renderWithProviders(<ResetPasswordPage />, { route: "/reset-password?token=abc", auth: { status: "guest", user: null } });
    expectShell(reset.container);
    expect(screen.getByLabelText("New password")).toHaveAttribute("autocomplete", "new-password");
  });

  it("is in formal Arabic on an Arabic dashboard", async () => {
    const { user } = renderWithProviders(<LoginPage />, { route: "/login", locale: "ar", auth: { status: "guest", user: null } });
    await user.click(screen.getByRole("button", { name: "إظهار كلمة المرور" }));
    expect(screen.getByRole("button", { name: "إخفاء كلمة المرور" })).toBeInTheDocument();
  });

  it("lays sign in beside a photograph of a shop, with the way back to the site", () => {
    const { container } = renderWithProviders(<LoginPage />, { route: "/login", auth: { status: "guest", user: null } });
    const frame = container.querySelector(".auth-glass[data-split]")!;
    expect(frame).not.toBeNull();
    expect(screen.getByRole("link", { name: "Home page" })).toHaveAttribute("href", expect.stringMatching(/^https:\/\/[^/]+\/en$/));
    const panel = frame.querySelector("aside")!;
    expect(panel.querySelector("img")).toHaveAttribute("src", "/photos/store-racks-1080.webp");
    // Decoration: the words beside it say what ZIMOS does, and the page keeps one title.
    expect(panel.querySelector("img")).toHaveAttribute("alt", "");
    expect(panel).toHaveTextContent("Your store, from the first product to the profit");
    expect(panel.querySelectorAll("li")).toHaveLength(3);
    expect(panel.querySelector("h1, h2")).toBeNull();
  });

  it("has the photograph it shows on disk", () => {
    for (const file of ["store-racks-720.webp", "store-racks-1080.webp"]) {
      expect(existsSync(join(dirname(fileURLToPath(import.meta.url)), "../../public/photos", file)), file).toBe(true);
    }
  });

  it("draws our mark and nothing of another brand", () => {
    expect(shell).toContain('import { ZimosLogo } from "@/components/ZimosLogo";');
    expect(shell).not.toMatch(/from "@\/brand|design-system|phosphor/i);
  });
});

describe("a Google sign-in that did not go through", () => {
  it("says why and offers to try again", () => {
    const { container } = renderWithProviders(<AuthCallbackPage />, { route: "/auth/callback?error=GOOGLE_STATE_MISMATCH", auth: { status: "guest", user: null } });
    expectShell(container);
    expect(screen.getByRole("heading", { level: 1, name: "Couldn't sign in with Google" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("The Google sign-in expired. Please try again");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/login");
  });

  it("does not offer another try to an account that is closed", () => {
    renderWithProviders(<AuthCallbackPage />, { route: "/auth/callback?error=ACCOUNT_SUSPENDED", auth: { status: "guest", user: null } });
    expect(screen.getByRole("alert")).toHaveTextContent("This account has been suspended");
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("reads a reason it does not know as the general one, in formal Arabic", () => {
    renderWithProviders(<AuthCallbackPage />, { route: "/auth/callback?error=title", locale: "ar", auth: { status: "guest", user: null } });
    expect(screen.getByRole("heading", { level: 1, name: "تعذّر تسجيل الدخول بجوجل" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("حدث خطأ أثناء تسجيل الدخول بحساب جوجل. حاول مرة أخرى.");
    expect(screen.getByRole("link", { name: "العودة إلى تسجيل الدخول" })).toBeInTheDocument();
  });
});
