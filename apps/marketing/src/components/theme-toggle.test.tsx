import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { I18nProvider } from "@/i18n/provider";
import { ThemeToggle } from "./theme-toggle";

/**
 * The header's light/dark switch with its circle (@store-builder/ui/theme-reveal):
 * whether the circle is drawn or not, a press leaves the same theme on <html>
 * and the same choice in localStorage as before there was a circle — and in
 * the cookie the dashboard's sign-in screens read (lib/theme-cookie.ts).
 */

const dict = getDictionary("en");
const doc = document as Document & { startViewTransition?: unknown };
let reducedMotion = false;

const renderToggle = () =>
  render(createElement(I18nProvider, { value: { locale: "en", dir: "ltr", dict } }, createElement(ThemeToggle)));
const html = () => document.documentElement;

beforeEach(() => {
  reducedMotion = false;
  localStorage.clear();
  document.cookie = "zimos-theme=; Max-Age=0; Path=/";
  html().classList.remove("dark");
  html().style.colorScheme = "";
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)" && reducedMotion,
    addEventListener() {},
    removeEventListener() {},
  }));
});

afterEach(() => {
  cleanup();
  delete doc.startViewTransition;
  vi.unstubAllGlobals();
});

function pressAndCheck() {
  renderToggle();
  const button = screen.getByRole("button", { name: dict.nav.switchToDark });
  button.focus();
  fireEvent.click(button, { clientX: 40, clientY: 30, detail: 1 });
  expect(html().classList.contains("dark")).toBe(true);
  expect(html().style.colorScheme).toBe("dark");
  expect(localStorage.getItem("theme")).toBe("dark");
  expect(document.cookie).toBe("zimos-theme=dark");
  // Same button, still focused, now offering the way back.
  expect(button.getAttribute("aria-label")).toBe(dict.nav.switchToLight);
  expect(document.activeElement).toBe(button);
}

describe("the theme switch", () => {
  it("without view transitions: switches and remembers at once", () => {
    pressAndCheck();
  });

  it("with less motion asked for: switches and remembers at once, no transition", () => {
    const start = vi.fn();
    doc.startViewTransition = start;
    reducedMotion = true;
    pressAndCheck();
    expect(start).not.toHaveBeenCalled();
  });

  it("with view transitions: the same theme and the same stored choice, switched inside the transition", () => {
    const start = vi.fn((update: () => void) => {
      update();
      return { finished: Promise.resolve() };
    });
    doc.startViewTransition = start;
    pressAndCheck();
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("writes the way back to light to the cookie too", () => {
    pressAndCheck();
    fireEvent.click(screen.getByRole("button", { name: dict.nav.switchToLight }), { clientX: 40, clientY: 30, detail: 1 });
    expect(localStorage.getItem("theme")).toBe("light");
    expect(document.cookie).toBe("zimos-theme=light");
  });
});
