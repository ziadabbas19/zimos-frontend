import { existsSync, readFileSync } from "node:fs";
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

/** The 3D icons around the scene's phone, copied from the marketing site (public/icons/3d). */
const ICONS = ["package", "truck", "money", "chart", "check", "rocket"];

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

  it("lays sign in beside an animated scene, with the way back to the site", () => {
    const { container } = renderWithProviders(<LoginPage />, { route: "/login", auth: { status: "guest", user: null } });
    const frame = container.querySelector(".auth-glass[data-split]")!;
    expect(frame).not.toBeNull();
    expect(screen.getByRole("link", { name: "Home page" })).toHaveAttribute("href", expect.stringMatching(/^https:\/\/[^/]+\/en$/));
    const panel = frame.querySelector("aside")!;
    // The background first, the one picture fetched early; the phone and the icons only when shown.
    const pictures = [...panel.querySelectorAll("img")];
    expect(pictures[0]).toHaveAttribute("src", "/photos/auth-bg-1080.webp");
    expect(pictures[0]).toHaveAttribute("srcset", "/photos/auth-bg-720.webp 720w, /photos/auth-bg-1080.webp 1080w");
    expect(pictures[0]).toHaveAttribute("fetchpriority", "high");
    expect(pictures.slice(1).map((img) => img.getAttribute("loading"))).toEqual(Array(pictures.length - 1).fill("lazy"));
    expect(pictures.map((img) => img.getAttribute("src"))).toEqual(
      expect.arrayContaining(["/photos/auth-phone.webp", ...ICONS.map((name) => `/icons/3d/${name}.webp`)]),
    );
    // Decoration: every picture is silent, the scene is hidden from screen readers, and the page keeps one title.
    for (const img of pictures) expect(img).toHaveAttribute("alt", "");
    for (const layer of panel.querySelectorAll(".auth-scene__back, .auth-scene__stage")) expect(layer).toHaveAttribute("aria-hidden", "true");
    expect(panel).toHaveTextContent("Your store, from the first product to the profit");
    expect(panel.querySelectorAll("li")).toHaveLength(3);
    expect(panel.querySelector("h1, h2")).toBeNull();
    // The words come before the stage, so the scene stands under them.
    const words = panel.querySelector(".auth-split__words")!;
    expect(words.compareDocumentPosition(panel.querySelector(".auth-scene__stage")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("says what happens to an order on the scene's cards, in English and in Arabic", () => {
    const en = renderWithProviders(<LoginPage />, { route: "/login", auth: { status: "guest", user: null } });
    const cards = () => [...document.querySelectorAll(".auth-scene__card")].map((card) => card.textContent);
    expect(cards()).toEqual(["New orderIn the confirmation queue", "Order confirmedTracking code ready", "DeliveredCounted in your profit"]);
    en.unmount();
    renderWithProviders(<LoginPage />, { route: "/login", locale: "ar", auth: { status: "guest", user: null } });
    expect(cards()).toEqual(["طلب جديددخل قائمة التأكيد", "تم تأكيد الطلبرقم التتبع جاهز", "تم التسليمدخل في حساب أرباحك"]);
  });

  it("has the pictures it shows on disk", () => {
    const pub = join(dirname(fileURLToPath(import.meta.url)), "../../public");
    for (const file of ["photos/auth-bg-720.webp", "photos/auth-bg-1080.webp", "photos/auth-phone.webp", "photos/auth-phone-400.webp", ...ICONS.map((name) => `icons/3d/${name}.webp`)]) {
      expect(existsSync(join(pub, file)), file).toBe(true);
    }
  });

  it("moves only by transform and opacity, and not at all for someone who asked for less motion", () => {
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "auth-scene.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const keyframes = [...css.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)];
    expect(keyframes.length).toBeGreaterThanOrEqual(8);
    const other = keyframes.flatMap(([, name, body]) =>
      [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]).filter((prop) => !["transform", "opacity"].includes(prop)).map((prop) => `${name}: ${prop}`),
    );
    expect(other).toEqual([]);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.auth-split__photo \*,[^{]*\{\s*animation: none !important;/);
    expect(css).toMatch(/\.auth-split__photo\[data-paused\] \*[^{]*\{\s*animation-play-state: paused !important;/);
    // No picture fetched from the stylesheet: the scene's pictures are the page's own <img>s.
    expect(css).not.toMatch(/url\(/);
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
