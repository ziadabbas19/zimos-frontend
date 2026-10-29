import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";
import { COLOR_MODE_COOKIE } from "@/lib/colorModeCookie";
import { ColorModeSwitch } from "./ColorModeSwitch";
import { ThemeToggle } from "./ThemeToggle";

/**
 * The stores' two light/dark buttons with their circle
 * (@store-builder/ui/theme-reveal): ThemeToggle (a store with its own header:
 * `dark` on <html>, kept in localStorage) and ColorModeSwitch (a store in an
 * imported template: a cookie and `data-color-mode` on the store wrapper).
 * Whether the circle is drawn or not, a press leaves the same page and the
 * same kept choice as before there was a circle.
 */

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const STORE = {
  workspaceId: "ws1",
  id: "ws1",
  slug: "shop",
  name: "Shop",
  currency: "EGP",
  logoUrl: null,
  phone: null,
  checkout: { email: "optional", postal_code: "hidden", notes: "optional" },
  orderBump: null,
} as unknown as StoreInfo;

const doc = document as Document & { startViewTransition?: unknown };
let reducedMotion = false;
type Way = "at once" | "less motion" | "transition";
const WAYS: Way[] = ["at once", "less motion", "transition"];

function show(ui: React.ReactNode) {
  return render(
    <StoreContextProvider locale="en" store={STORE}>
      <div className="brand-theme">{ui}</div>
    </StoreContextProvider>
  );
}

/** The browser of each way; returns the transition starter, if there is one. */
function browser(way: Way) {
  if (way === "at once") return null;
  const start = vi.fn((update: () => void) => {
    update();
    return { finished: Promise.resolve() };
  });
  doc.startViewTransition = start;
  reducedMotion = way === "less motion";
  return start;
}

function clearCookie() {
  document.cookie = `${COLOR_MODE_COOKIE}=; path=/; max-age=0`;
}

beforeEach(() => {
  reducedMotion = false;
  localStorage.clear();
  clearCookie();
  document.documentElement.classList.remove("dark");
  document.documentElement.style.colorScheme = "";
  refresh.mockClear();
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)" && reducedMotion,
    addEventListener() {},
    removeEventListener() {},
  }));
});

afterEach(async () => {
  cleanup();
  // The helper lets a press go while a transition runs: let the last one end before the next test.
  await new Promise((resolve) => setTimeout(resolve, 0));
  delete doc.startViewTransition;
  vi.unstubAllGlobals();
});

describe("ThemeToggle (a store's own header)", () => {
  for (const way of WAYS) {
    it(`${way}: dark on <html>, kept in localStorage, the button still focused`, () => {
      const start = browser(way);
      show(<ThemeToggle />);
      const button = screen.getByRole("button", { name: "Switch to dark mode" });
      button.focus();
      fireEvent.click(button, { clientX: 20, clientY: 700, detail: 1 });
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(document.documentElement.style.colorScheme).toBe("dark");
      expect(localStorage.getItem("theme")).toBe("dark");
      expect(button.getAttribute("aria-label")).toBe("Switch to light mode");
      expect(document.activeElement).toBe(button);
      if (start) expect(start).toHaveBeenCalledTimes(way === "transition" ? 1 : 0);
    });
  }
});

describe("ColorModeSwitch (a store in an imported template)", () => {
  for (const way of WAYS) {
    it(`${way}: the cookie, the wrapper's mode and the server's render, as before`, () => {
      const start = browser(way);
      show(<ColorModeSwitch mode="light" />);
      const button = screen.getByRole("button", { name: "Switch to dark mode" });
      button.focus();
      fireEvent.click(button, { detail: 0 }); // Enter / Space
      expect(document.cookie).toContain(`${COLOR_MODE_COOKIE}=dark`);
      expect(document.querySelector(".brand-theme")?.getAttribute("data-color-mode")).toBe("dark");
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "Switch to light mode" })).toBe(button);
      expect(document.activeElement).toBe(button);
      if (start) expect(start).toHaveBeenCalledTimes(way === "transition" ? 1 : 0);
    });
  }
});
