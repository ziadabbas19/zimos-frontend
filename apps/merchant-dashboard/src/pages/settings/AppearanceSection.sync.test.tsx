import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApiError, type UiAppearance, type UiAppearanceInput, type UiPreferences } from "@store-builder/api-client";
import { api, authMock, testUser } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { LocaleProvider } from "@/i18n/LocaleContext";
import { ToastProvider } from "@/components/Toast";
import { AppearanceSync } from "@/components/AppearanceSync";
import { ACCOUNT_KEY, SAVE_DELAY_MS, UPDATED_AT_KEY, startAppearanceSync, stopAppearanceSync } from "@/lib/appearanceSync";
import { AppearanceSection } from "./AppearanceSection";

// Settings → "Language and look" with the look kept on the account as well
// (lib/appearanceSync): the one new line, and what the page sends as its
// controls are used. The rules themselves are in lib/appearanceSync.test.tsx.

const PATH = "/auth/me/ui-preferences";
const SAVED = "Saved to your account";
const html = document.documentElement;

interface Account {
  held: UiPreferences | null;
  readFails: unknown;
  saveFails: unknown;
  saves: UiAppearanceInput[];
}

function account(held: UiAppearance | null = null): Account {
  const state: Account = { held: held ? { appearance: held } : null, readFails: null, saveFails: null, saves: [] };
  api.request.mockImplementation((async (path: string, opts?: { method?: string; body?: { appearance: UiAppearanceInput } }) => {
    if (path !== PATH) return new Promise<never>(() => undefined);
    if (!opts?.method) {
      if (state.readFails) throw state.readFails;
      return { uiPreferences: state.held };
    }
    state.saves.push(opts.body!.appearance);
    if (state.saveFails) throw state.saveFails;
    state.held = { appearance: { ...opts.body!.appearance, updatedAt: new Date().toISOString() } };
    return { uiPreferences: state.held };
  }) as never);
  return state;
}

const dark = (over: Partial<UiAppearance> = {}): UiAppearance => ({
  look: "dark",
  darkTone: 50,
  glass: true,
  glowLeft: null,
  glowRight: null,
  glowIntensity: 100,
  updatedAt: "2026-10-10T07:00:00.000Z",
  ...over,
});

/** Lets the calls in flight answer and the page draw what they changed. */
async function settle() {
  await act(async () => {
    for (let i = 0; i < 50; i += 1) await Promise.resolve();
  });
}

/** Lets a choice rest for as long as it takes to be saved. */
async function rest(ms = SAVE_DELAY_MS) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
  await settle();
}

async function signIn() {
  await act(async () => {
    await startAppearanceSync("user_1");
  });
  await settle();
}

const toneSlider = () => screen.getByRole("slider", { name: "Tone" });
const slide = (value: number) => fireEvent.change(toneSlider(), { target: { value: String(value) } });

afterEach(() => {
  stopAppearanceSync();
  vi.useRealTimers();
  html.classList.remove("dark");
  for (const name of ["data-look", "data-tone", "data-glass"]) html.removeAttribute(name);
  html.removeAttribute("style");
});

describe("Language and look: saved to the account", () => {
  it("shows nothing new while the look is on this device only", async () => {
    account(null);
    renderWithProviders(<AppearanceSection />);
    await signIn();
    expect(screen.getByText("These choices are kept on this device.")).toBeInTheDocument();
    expect(screen.queryByText(SAVED)).not.toBeInTheDocument();
  });

  it("says so, under the rows, once the account holds the look", async () => {
    const server = account(null);
    localStorage.setItem("zimos.look", "dark");
    renderWithProviders(<AppearanceSection />);
    expect(screen.queryByText(SAVED)).not.toBeInTheDocument();

    await signIn();
    expect(server.saves).toHaveLength(1);
    expect(screen.getByText(SAVED)).toBeInTheDocument();
    // The line it had stays as it was.
    expect(screen.getByText("These choices are kept on this device.")).toBeInTheDocument();
  });

  it("says so when the look came from the account, and shows that look", async () => {
    account(dark({ darkTone: 80 }));
    renderWithProviders(<AppearanceSection />);
    await signIn();
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
    expect(toneSlider()).toHaveValue("80");
    expect(html).toHaveAttribute("data-tone", "80");
    expect(screen.getByText(SAVED)).toBeInTheDocument();
  });

  it("says it in formal Arabic", async () => {
    account(dark());
    renderWithProviders(<AppearanceSection />, { locale: "ar" });
    await signIn();
    expect(screen.getByText("محفوظ على حسابك")).toBeInTheDocument();
    expect(screen.getByText("هذه الخيارات محفوظة على هذا الجهاز.")).toBeInTheDocument();
  });

  it("sends one save for a slider that is dragged, with where it came to rest", async () => {
    vi.useFakeTimers();
    const server = account(dark());
    renderWithProviders(<AppearanceSection />);
    await signIn();
    expect(server.saves).toEqual([]);

    for (const tone of [45, 40, 34, 27, 21, 16, 12]) {
      slide(tone);
      await rest(50);
    }
    // Drawn and kept here as it moves.
    expect(html).toHaveAttribute("data-tone", "12");
    expect(localStorage.getItem("zimos.darkTone")).toBe("12");
    expect(server.saves).toEqual([]);

    await rest();
    expect(server.saves).toEqual([{ look: "dark", darkTone: 12, glass: true, glowLeft: null, glowRight: null, glowIntensity: 100 }]);
    expect(api.request).toHaveBeenCalledTimes(2);
    expect(screen.getByText(SAVED)).toBeInTheDocument();
  });

  it("saves a choice of look, of glass and of glow colours the same way", async () => {
    vi.useFakeTimers();
    const server = account(dark());
    renderWithProviders(<AppearanceSection />);
    await signIn();

    fireEvent.click(screen.getByRole("radio", { name: "Light" }));
    fireEvent.click(screen.getByRole("button", { name: "Ocean" }));
    fireEvent.change(screen.getByRole("slider", { name: "Intensity" }), { target: { value: "40" } });
    await rest();
    expect(server.saves).toEqual([{ look: "light", darkTone: 50, glass: true, glowLeft: "#2f7bff", glowRight: "#14b8a6", glowIntensity: 40 }]);

    fireEvent.click(screen.getByRole("switch", { name: "Glass surfaces" }));
    await rest();
    expect(server.saves[1]).toEqual({ look: "light", darkTone: 50, glass: false, glowLeft: "#2f7bff", glowRight: "#14b8a6", glowIntensity: 40 });
  });

  it("takes the line away, with no error on the page, when a save fails; the choice stays", async () => {
    vi.useFakeTimers();
    const server = account(dark());
    renderWithProviders(<AppearanceSection />);
    await signIn();
    expect(screen.getByText(SAVED)).toBeInTheDocument();

    server.saveFails = new ApiError("Unexpected", 500, "INTERNAL_SERVER_ERROR");
    slide(20);
    await rest();
    expect(server.saves).toHaveLength(1);
    expect(screen.queryByText(SAVED)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/Unexpected|error|failed|try again/i)).not.toBeInTheDocument();
    expect(toneSlider()).toHaveValue("20");
    expect(html).toHaveAttribute("data-tone", "20");

    // The next choice sends the look again; saved, the line is back.
    server.saveFails = null;
    slide(25);
    await rest();
    expect(server.saves[1].darkTone).toBe(25);
    expect(screen.getByText(SAVED)).toBeInTheDocument();
  });

  it("is the page it always was with an API that has no such endpoint", async () => {
    vi.useFakeTimers();
    const server = account(dark({ darkTone: 80 }));
    server.readFails = new ApiError("Cannot GET /api/v1/auth/me/ui-preferences", 404, "ROUTE_NOT_FOUND");
    localStorage.setItem("zimos.look", "dark");
    renderWithProviders(<AppearanceSection />);
    await signIn();

    slide(20);
    fireEvent.click(screen.getByRole("switch", { name: "Glass surfaces" }));
    await rest(5000);
    expect(server.saves).toEqual([]);
    expect(api.request).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(SAVED)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // What the page keeps, and nothing else.
    const kept = Object.fromEntries(
      Object.keys(localStorage)
        .filter((key) => key !== "zimos.locale")
        .sort()
        .map((key) => [key, localStorage.getItem(key)])
    );
    expect(kept).toEqual({ "zimos.look": "dark", "zimos.darkTone": "20", "zimos.glass": "off" });
  });
});

describe("following the signed-in account", () => {
  it("reads the account's look when an account is signed in, once", async () => {
    const server = account(dark({ look: "black" }));
    const { rerender } = render(<AppearanceSync />);
    await settle();
    expect(api.request).toHaveBeenCalledTimes(1);
    expect(api.request).toHaveBeenCalledWith(PATH);
    expect(html).toHaveAttribute("data-look", "black");
    expect(localStorage.getItem(ACCOUNT_KEY)).toBe(testUser.id);

    rerender(<AppearanceSync />);
    await settle();
    expect(api.request).toHaveBeenCalledTimes(1);
    expect(server.saves).toEqual([]);
  });

  it("asks nothing while there is no account, or while it is still being read", async () => {
    account(dark());
    for (const status of ["guest", "loading", "unavailable"] as const) {
      Object.assign(authMock, { status, user: null });
      const { unmount } = render(<AppearanceSync />);
      await settle();
      unmount();
    }
    expect(api.request).not.toHaveBeenCalled();
    expect(localStorage.getItem(UPDATED_AT_KEY)).toBeNull();
  });

  it("lets go at sign-out without touching the look kept on the device, and takes up the next account", async () => {
    vi.useFakeTimers();
    localStorage.setItem("zimos.locale", "en");
    const server = account(dark({ darkTone: 80 }));
    const view = render(
      <>
        <AppearanceSync />
        <AppearanceSection />
      </>,
      { wrapper: ({ children }) => <Providers>{children}</Providers> }
    );
    await settle();
    expect(screen.getByText(SAVED)).toBeInTheDocument();
    const onDevice = { look: localStorage.getItem("zimos.look"), tone: localStorage.getItem("zimos.darkTone") };
    expect(onDevice).toEqual({ look: "dark", tone: "80" });

    Object.assign(authMock, { status: "guest", user: null });
    view.rerender(
      <>
        <AppearanceSync />
        <AppearanceSection />
      </>
    );
    await settle();
    expect(screen.queryByText(SAVED)).not.toBeInTheDocument();
    expect({ look: localStorage.getItem("zimos.look"), tone: localStorage.getItem("zimos.darkTone") }).toEqual(onDevice);
    expect(html).toHaveAttribute("data-tone", "80");

    // Signed out, a choice goes nowhere.
    slide(20);
    await rest(5000);
    expect(server.saves).toEqual([]);

    Object.assign(authMock, { status: "authenticated", user: { ...testUser, id: "user_2" } });
    view.rerender(
      <>
        <AppearanceSync />
        <AppearanceSection />
      </>
    );
    await settle();
    expect(api.request).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(ACCOUNT_KEY)).toBe("user_2");
  });
});

/** The providers the settings rows need, around a tree the test renders again. */
function Providers({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <LocaleProvider>
        <ToastProvider>{children}</ToastProvider>
      </LocaleProvider>
    </MemoryRouter>
  );
}
