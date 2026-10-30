import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { REVEAL_ATTRIBUTE } from "@store-builder/ui/theme-reveal";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AppearanceSection } from "./AppearanceSection";

/**
 * The toolbar's sun / moon switch and the look picker of Settings → Language
 * and look draw the new look as a circle from the press, through the helper
 * the marketing site and the stores use (@store-builder/ui/theme-reveal; its
 * own tests are in apps/marketing). The console takes the same switch and the
 * same picker.
 */

const html = document.documentElement;
// The test stands in for the browser's own method, and takes it away again.
const doc = document as unknown as { startViewTransition?: unknown };

type Update = () => void;

let reducedMotion = false;
// Every transition a test leaves running: the helper lets presses go while one runs, so each test ends them all.
const pending: Array<() => void> = [];

beforeEach(() => {
  reducedMotion = false;
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    matches: reducedMotion && query === "(prefers-reduced-motion: reduce)",
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }));
});

afterEach(async () => {
  for (const settle of pending.splice(0)) settle();
  await new Promise((resolve) => setTimeout(resolve, 0));
  delete doc.startViewTransition;
  vi.restoreAllMocks();
  html.classList.remove("dark");
  for (const name of ["data-look", "data-tone", "data-glass", REVEAL_ATTRIBUTE]) html.removeAttribute(name);
  html.style.colorScheme = "";
});

/** A browser with view transitions; the test runs the update itself. */
function withTransitions() {
  const updates: Update[] = [];
  const start = vi.fn((update: Update) => {
    updates.push(update);
    const finished = new Promise<void>((resolve) => pending.push(resolve));
    return { finished, skipTransition: vi.fn() };
  });
  doc.startViewTransition = start;
  return { start, updates };
}

/** The rules of the circle while one grows, or "" when none does. */
const circle = () =>
  [...document.head.querySelectorAll("style")]
    .map((style) => style.textContent ?? "")
    .filter((css) => css.includes("zimos-theme-reveal"))
    .join("\n");

const toolbarSwitch = () => screen.getByRole("button", { name: /Switch to (dark|light) mode/ });
const look = (name: string) => screen.getByRole("radio", { name });

/** A box for one button, where jsdom draws none. */
function placeAt(element: HTMLElement, box: { left: number; top: number; width: number; height: number }) {
  element.getBoundingClientRect = () =>
    ({ ...box, right: box.left + box.width, bottom: box.top + box.height, x: box.left, y: box.top, toJSON() {} }) as DOMRect;
}

describe("the toolbar's sun / moon switch", () => {
  it("without view transitions: switches at once, as it always did", () => {
    renderWithProviders(<ThemeToggle />);
    fireEvent.click(toolbarSwitch(), { clientX: 120, clientY: 30, detail: 1 });
    expect(html).toHaveClass("dark");
    expect(localStorage.getItem("zimos.look")).toBe("dark");
    expect(circle()).toBe("");
  });

  it("with less motion asked for: switches at once, no transition started", () => {
    const { start } = withTransitions();
    reducedMotion = true;
    renderWithProviders(<ThemeToggle />);
    fireEvent.click(toolbarSwitch(), { clientX: 120, clientY: 30, detail: 1 });
    expect(start).not.toHaveBeenCalled();
    expect(html).toHaveClass("dark");
    expect(circle()).toBe("");
  });

  it("with view transitions: the look changes inside the transition, the circle from the click", async () => {
    const { start, updates } = withTransitions();
    renderWithProviders(<ThemeToggle />);
    fireEvent.click(toolbarSwitch(), { clientX: 120, clientY: 30, detail: 1 });
    expect(start).toHaveBeenCalledTimes(1);
    // The old page is still being kept: nothing switched yet.
    expect(html).not.toHaveClass("dark");
    expect(circle()).toContain("circle(0px at 120px 30px)");

    act(() => updates[0]());
    expect(html).toHaveClass("dark");
    expect(html).toHaveAttribute("data-look", "dark");
    expect(localStorage.getItem("zimos.look")).toBe("dark");
    expect(toolbarSwitch()).toHaveAccessibleName("Switch to light mode");

    pending.splice(0).forEach((settle) => settle());
    await vi.waitFor(() => expect(circle()).toBe(""));
    expect(html).not.toHaveAttribute(REVEAL_ATTRIBUTE);
  });

  it("from the keyboard (a click with no count): the circle starts in the middle of the switch", () => {
    withTransitions();
    renderWithProviders(<ThemeToggle />);
    placeAt(toolbarSwitch(), { left: 1200, top: 12, width: 36, height: 36 });
    fireEvent.click(toolbarSwitch(), { clientX: 0, clientY: 0, detail: 0 });
    expect(circle()).toContain("circle(0px at 1218px 30px)");
  });
});

describe("Settings → Language and look: the look picker", () => {
  it("without view transitions: the chosen look is drawn at once", () => {
    renderWithProviders(<AppearanceSection />);
    fireEvent.click(look("Black"), { clientX: 300, clientY: 500, detail: 1 });
    expect(html).toHaveAttribute("data-look", "black");
    expect(circle()).toBe("");
  });

  it("with less motion asked for: drawn at once, no transition started", () => {
    const { start } = withTransitions();
    reducedMotion = true;
    renderWithProviders(<AppearanceSection />);
    fireEvent.click(look("Dark"), { clientX: 300, clientY: 500, detail: 1 });
    expect(start).not.toHaveBeenCalled();
    expect(html).toHaveAttribute("data-look", "dark");
  });

  it("with view transitions: the look grows from the segment pressed", () => {
    const { start, updates } = withTransitions();
    renderWithProviders(<AppearanceSection />);
    fireEvent.click(look("Black"), { clientX: 300, clientY: 500, detail: 1 });
    expect(start).toHaveBeenCalledTimes(1);
    expect(html).not.toHaveClass("dark");
    expect(circle()).toContain("circle(0px at 300px 500px)");

    act(() => updates[0]());
    expect(html).toHaveAttribute("data-look", "black");
    expect(look("Black")).toHaveAttribute("aria-checked", "true");
  });

  it("with an arrow key: the circle starts at the segment the key moved to", () => {
    withTransitions();
    renderWithProviders(<AppearanceSection />);
    placeAt(look("Light"), { left: 100, top: 400, width: 80, height: 36 });
    placeAt(look("Black"), { left: 180, top: 400, width: 80, height: 36 });
    fireEvent.keyDown(look("Light"), { key: "ArrowRight" });
    expect(look("Black")).toHaveFocus();
    expect(circle()).toContain("circle(0px at 220px 418px)");
  });
});
