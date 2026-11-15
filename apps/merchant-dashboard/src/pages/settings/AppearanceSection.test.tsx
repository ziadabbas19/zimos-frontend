import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { GlassToggle } from "@/components/GlassToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { restoreAppearance, setGlow } from "@/lib/appearance";
import { AppearanceSection } from "./AppearanceSection";

const html = document.documentElement;

const VARIABLES = ["--zimos-tone-mid", "--zimos-tone-slate", "--zimos-glow-left", "--zimos-glow-right", "--zimos-glow-strength"];

/** The device's own settings, for every media query the page reads. */
function device({ dark = false, solid = false }: { dark?: boolean; solid?: boolean }) {
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    matches: (dark && query.includes("prefers-color-scheme: dark")) || (solid && query.includes("prefers-reduced-transparency")),
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }));
}

/** <html> as a page that was never drawn. */
function blankPage() {
  html.classList.remove("dark");
  for (const name of ["data-look", "data-tone", "data-glass"]) html.removeAttribute(name);
  for (const name of VARIABLES) html.style.removeProperty(name);
  html.style.colorScheme = "";
}

/** Everything the look leaves on <html>. */
function drawn() {
  return {
    dark: html.classList.contains("dark"),
    scheme: html.style.colorScheme,
    look: html.getAttribute("data-look"),
    tone: html.getAttribute("data-tone"),
    glass: html.getAttribute("data-glass"),
    variables: Object.fromEntries(VARIABLES.map((name) => [name, html.style.getPropertyValue(name)])),
  };
}

const variable = (name: string) => html.style.getPropertyValue(name);

/** Storage holding only what the look keeps (renderWithProviders adds the language). */
function kept() {
  return Object.fromEntries(
    Object.keys(localStorage)
      .filter((key) => key !== "zimos.locale")
      .sort()
      .map((key) => [key, localStorage.getItem(key)])
  );
}

const look = (name: string) => screen.getByRole("radio", { name });
const glassSwitch = () => screen.getByRole("switch", { name: "Glass surfaces" });
const toneSlider = () => screen.queryByRole("slider", { name: "Tone" });
const palette = (name: string) => screen.getByRole("button", { name });
const slide = (slider: HTMLElement, value: number) => fireEvent.change(slider, { target: { value: String(value) } });

afterEach(() => {
  vi.restoreAllMocks();
  blankPage();
});

describe("Language and look: the three looks", () => {
  it("starts as it always did: light, glass on, nothing kept and nothing but the look's name on the page", () => {
    renderWithProviders(<AppearanceSection />);
    expect(look("Light")).toHaveAttribute("aria-checked", "true");
    expect(drawn()).toEqual({
      dark: false,
      scheme: "light",
      look: "light",
      tone: null,
      glass: null,
      variables: Object.fromEntries(VARIABLES.map((name) => [name, ""])),
    });
    expect(kept()).toEqual({});
  });

  it("follows the device while nothing was chosen here", () => {
    device({ dark: true });
    renderWithProviders(<AppearanceSection />);
    expect(look("Dark")).toHaveAttribute("aria-checked", "true");
    expect(html).toHaveClass("dark");
    expect(html).toHaveAttribute("data-look", "dark");
    expect(html).not.toHaveAttribute("data-tone");
    expect(kept()).toEqual({});
  });

  it("offers Light, Black and Dark, and each one marks the page and is remembered", async () => {
    const { user } = renderWithProviders(<AppearanceSection />);
    expect(screen.getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["عربي", "English", "Light", "Black", "Dark"]);

    await user.click(look("Black"));
    expect(look("Black")).toHaveAttribute("aria-checked", "true");
    expect(html).toHaveClass("dark");
    expect(html).toHaveAttribute("data-look", "black");
    expect(html.style.colorScheme).toBe("dark");
    expect(kept()).toEqual({ "zimos.look": "black", "zimos.darkLook": "black", theme: "dark" });

    await user.click(look("Dark"));
    expect(look("Dark")).toHaveAttribute("aria-checked", "true");
    expect(html).toHaveClass("dark");
    expect(html).toHaveAttribute("data-look", "dark");
    expect(kept()).toEqual({ "zimos.look": "dark", "zimos.darkLook": "dark", theme: "dark" });

    await user.click(look("Light"));
    expect(look("Light")).toHaveAttribute("aria-checked", "true");
    expect(html).not.toHaveClass("dark");
    expect(html).toHaveAttribute("data-look", "light");
    expect(html.style.colorScheme).toBe("light");
    // The dark look chosen last stays known: the toolbar's switch goes back to it.
    expect(kept()).toEqual({ "zimos.look": "light", "zimos.darkLook": "dark", theme: "light" });
  });

  it("opens in the look that was chosen before", () => {
    localStorage.setItem("zimos.look", "black");
    renderWithProviders(<AppearanceSection />);
    expect(look("Black")).toHaveAttribute("aria-checked", "true");
    expect(html).toHaveAttribute("data-look", "black");
    expect(html).toHaveClass("dark");
  });

  it("carries a choice kept under the old key over to the look of the same name", () => {
    device({ dark: false });
    localStorage.setItem("theme", "dark");
    restoreAppearance();
    expect(kept()).toEqual({ "zimos.look": "dark", theme: "dark" });
    expect(html).toHaveClass("dark");
    expect(html).toHaveAttribute("data-look", "dark");
    // The dark look exactly as it was: no tone, glass as it stood.
    expect(html).not.toHaveAttribute("data-tone");
    expect(html).not.toHaveAttribute("data-glass");

    renderWithProviders(<AppearanceSection />);
    expect(look("Dark")).toHaveAttribute("aria-checked", "true");
  });

  it("keeps an old light choice light on a device that asks for dark", () => {
    device({ dark: true });
    localStorage.setItem("theme", "light");
    restoreAppearance();
    expect(kept()).toEqual({ "zimos.look": "light", theme: "light" });
    expect(html).not.toHaveClass("dark");
    expect(html).toHaveAttribute("data-look", "light");
  });

  it("has nothing to carry over for a merchant who never chose: the device is still followed", () => {
    device({ dark: true });
    restoreAppearance();
    expect(kept()).toEqual({});
    expect(html).toHaveAttribute("data-look", "dark");
  });
});

describe("Language and look: the tone of the Dark look", () => {
  it("shows the tone slider in Dark only", async () => {
    const { user } = renderWithProviders(<AppearanceSection />);
    expect(toneSlider()).not.toBeInTheDocument();

    await user.click(look("Black"));
    expect(toneSlider()).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Midnight" })).not.toBeInTheDocument();

    await user.click(look("Dark"));
    expect(toneSlider()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Midnight" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Slate" })).toBeInTheDocument();
  });

  it("starts in the middle, which is the dark look as it always was: nothing written, nothing kept", async () => {
    const { user } = renderWithProviders(<AppearanceSection />);
    await user.click(look("Dark"));
    expect(toneSlider()).toHaveValue("50");
    expect(toneSlider()).toHaveAttribute("aria-valuetext", "The dark look as it always was");
    expect(html).not.toHaveAttribute("data-tone");
    expect(variable("--zimos-tone-mid")).toBe("");
    expect(variable("--zimos-tone-slate")).toBe("");
    expect(localStorage.getItem("zimos.darkTone")).toBeNull();
  });

  it("writes the tone on the page as it moves, and remembers it", async () => {
    const { user } = renderWithProviders(<AppearanceSection />);
    await user.click(look("Dark"));
    const slider = toneSlider()!;

    // Toward midnight: a share of the middle look against midnight, none of slate.
    slide(slider, 20);
    expect(html).toHaveAttribute("data-tone", "20");
    expect(variable("--zimos-tone-mid")).toBe("40%");
    expect(variable("--zimos-tone-slate")).toBe("0%");
    expect(localStorage.getItem("zimos.darkTone")).toBe("20");
    expect(slider).toHaveValue("20");
    expect(slider).toHaveAttribute("aria-valuetext", "20 of 100");

    // Toward slate: all of the middle look, a share of slate.
    slide(slider, 80);
    expect(html).toHaveAttribute("data-tone", "80");
    expect(variable("--zimos-tone-mid")).toBe("100%");
    expect(variable("--zimos-tone-slate")).toBe("60%");
    expect(localStorage.getItem("zimos.darkTone")).toBe("80");

    // Back in the middle: the page is as if the slider was never touched.
    slide(slider, 50);
    expect(html).not.toHaveAttribute("data-tone");
    expect(variable("--zimos-tone-mid")).toBe("");
    expect(variable("--zimos-tone-slate")).toBe("");
    expect(localStorage.getItem("zimos.darkTone")).toBeNull();
  });

  it("jumps to either end from its two buttons", async () => {
    const { user } = renderWithProviders(<AppearanceSection />);
    await user.click(look("Dark"));

    await user.click(screen.getByRole("button", { name: "Midnight" }));
    expect(toneSlider()).toHaveValue("0");
    expect(html).toHaveAttribute("data-tone", "0");
    expect(variable("--zimos-tone-mid")).toBe("0%");
    expect(variable("--zimos-tone-slate")).toBe("0%");
    expect(localStorage.getItem("zimos.darkTone")).toBe("0");
    expect(screen.getByRole("button", { name: "Midnight" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Midnight blue")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Slate" }));
    expect(toneSlider()).toHaveValue("100");
    expect(html).toHaveAttribute("data-tone", "100");
    expect(variable("--zimos-tone-mid")).toBe("100%");
    expect(variable("--zimos-tone-slate")).toBe("100%");
    expect(localStorage.getItem("zimos.darkTone")).toBe("100");
    expect(screen.getByRole("button", { name: "Slate" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Midnight" })).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps the tone for Dark while another look is on, and draws it again on the way back", async () => {
    const { user } = renderWithProviders(<AppearanceSection />);
    await user.click(look("Dark"));
    slide(toneSlider()!, 20);

    await user.click(look("Black"));
    expect(html).not.toHaveAttribute("data-tone");
    expect(variable("--zimos-tone-mid")).toBe("");
    expect(localStorage.getItem("zimos.darkTone")).toBe("20");

    await user.click(look("Light"));
    expect(html).not.toHaveAttribute("data-tone");

    await user.click(look("Dark"));
    expect(html).toHaveAttribute("data-tone", "20");
    expect(variable("--zimos-tone-mid")).toBe("40%");
    expect(toneSlider()).toHaveValue("20");
  });
});

describe("Language and look: glass", () => {
  it("starts with glass on: nothing stored, no attribute on the page", () => {
    renderWithProviders(<AppearanceSection />);
    expect(glassSwitch()).toHaveAttribute("aria-checked", "true");
    expect(html).not.toHaveAttribute("data-glass");
    expect(localStorage.getItem("zimos.glass")).toBeNull();
  });

  it("turns glass off on this device, and on again", async () => {
    const { user } = renderWithProviders(<AppearanceSection />);
    const glass = glassSwitch();

    await user.click(glass);
    expect(glass).toHaveAttribute("aria-checked", "false");
    expect(html).toHaveAttribute("data-glass", "off");
    expect(localStorage.getItem("zimos.glass")).toBe("off");

    await user.click(glass);
    expect(glass).toHaveAttribute("aria-checked", "true");
    expect(html).not.toHaveAttribute("data-glass");
    expect(localStorage.getItem("zimos.glass")).toBeNull();
  });

  it("opens with glass off when it was turned off before", () => {
    localStorage.setItem("zimos.glass", "off");
    renderWithProviders(<AppearanceSection />);
    expect(glassSwitch()).toHaveAttribute("aria-checked", "false");
    expect(html).toHaveAttribute("data-glass", "off");
  });

  it("keeps glass off, and says why, when the device asks for solid surfaces", () => {
    device({ solid: true });
    renderWithProviders(<AppearanceSection />);
    const glass = glassSwitch();
    expect(glass).toBeDisabled();
    expect(glass).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("Your device asks for solid surfaces, so glass stays off here.")).toBeInTheDocument();
    expect(html).toHaveAttribute("data-glass", "off");
  });

  it("has no glass in the Black look, says why, and gives it back in Dark and in Light", async () => {
    const { user } = renderWithProviders(<AppearanceSection />);
    await user.click(look("Black"));
    expect(glassSwitch()).toBeDisabled();
    expect(glassSwitch()).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("The Black look is plain: no glass and no glows. Choose Light or Dark to turn glass on.")).toBeInTheDocument();
    expect(html).toHaveAttribute("data-glass", "off");
    // Held off by the look, not turned off by the merchant.
    expect(localStorage.getItem("zimos.glass")).toBeNull();

    await user.click(look("Dark"));
    expect(glassSwitch()).toBeEnabled();
    expect(glassSwitch()).toHaveAttribute("aria-checked", "true");
    expect(html).not.toHaveAttribute("data-glass");

    await user.click(look("Light"));
    expect(glassSwitch()).toHaveAttribute("aria-checked", "true");
    expect(html).not.toHaveAttribute("data-glass");
  });

  it("leaves glass off after Black when the merchant had turned it off", async () => {
    const { user } = renderWithProviders(<AppearanceSection />);
    await user.click(glassSwitch());
    await user.click(look("Black"));
    await user.click(look("Dark"));
    expect(glassSwitch()).toBeEnabled();
    expect(glassSwitch()).toHaveAttribute("aria-checked", "false");
    expect(html).toHaveAttribute("data-glass", "off");
  });

  it("works with the tone: in Dark the glass switch and the slider change one page", async () => {
    const { user } = renderWithProviders(<AppearanceSection />);
    await user.click(look("Dark"));
    slide(toneSlider()!, 100);
    expect(html).not.toHaveAttribute("data-glass");
    expect(html).toHaveAttribute("data-tone", "100");

    await user.click(glassSwitch());
    expect(html).toHaveAttribute("data-glass", "off");
    expect(html).toHaveAttribute("data-tone", "100");
    expect(toneSlider()).toHaveValue("100");
  });
});

describe("Language and look: glow colours", () => {
  const glow = () => screen.queryByRole("group", { name: "Glow colours" });
  const leftPicker = () => screen.getByLabelText("Left glow");
  const rightPicker = () => screen.getByLabelText("Right glow");
  const intensity = () => screen.getByRole("slider", { name: "Intensity" });
  const reset = () => screen.getByRole("button", { name: "Reset" });
  const pick = (picker: HTMLElement, colour: string) => fireEvent.change(picker, { target: { value: colour } });
  const pressed = () =>
    ["Original", "Ocean", "Emerald", "Violet", "Sunset", "Grey", "No glows"].filter((name) => palette(name).getAttribute("aria-pressed") === "true");

  it("is there while glass is on, in Light and in Dark", async () => {
    const { user } = renderWithProviders(<AppearanceSection />);
    expect(glow()).toBeInTheDocument();
    await user.click(look("Dark"));
    expect(glow()).toBeInTheDocument();
  });

  it("is hidden without glass: turned off in Light, and in the Black look", async () => {
    const { user } = renderWithProviders(<AppearanceSection />);
    await user.click(glassSwitch());
    expect(glow()).not.toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: "Intensity" })).not.toBeInTheDocument();

    await user.click(glassSwitch());
    expect(glow()).toBeInTheDocument();

    await user.click(look("Black"));
    expect(glow()).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Left glow")).not.toBeInTheDocument();
  });

  it("is hidden when the device holds glass off", () => {
    device({ solid: true });
    renderWithProviders(<AppearanceSection />);
    expect(glow()).not.toBeInTheDocument();
  });

  it("starts on the glows the backdrop always had: nothing written, nothing kept, nothing to reset", () => {
    renderWithProviders(<AppearanceSection />);
    expect(pressed()).toEqual(["Original"]);
    expect(leftPicker()).toHaveValue("#ff7c30");
    expect(rightPicker()).toHaveValue("#f03ab8");
    expect(intensity()).toHaveValue("100");
    expect(reset()).toBeDisabled();
    expect(variable("--zimos-glow-left")).toBe("");
    expect(variable("--zimos-glow-right")).toBe("");
    expect(variable("--zimos-glow-strength")).toBe("");
    expect(kept()).toEqual({});
  });

  it("offers seven ready palettes, the original one first", () => {
    renderWithProviders(<AppearanceSection />);
    const names = Array.from(screen.getByRole("group", { name: "Ready palettes" }).querySelectorAll("button")).map((button) =>
      button.getAttribute("aria-label")
    );
    expect(names).toEqual(["Original", "Ocean", "Emerald", "Violet", "Sunset", "Grey", "No glows"]);
  });

  it("paints both sides from a palette, and remembers it", async () => {
    const { user } = renderWithProviders(<AppearanceSection />);
    await user.click(palette("Ocean"));
    expect(pressed()).toEqual(["Ocean"]);
    expect(variable("--zimos-glow-left")).toBe("#2f7bff");
    expect(variable("--zimos-glow-right")).toBe("#14b8a6");
    expect(variable("--zimos-glow-strength")).toBe("");
    expect(kept()).toEqual({ "zimos.glowLeft": "#2f7bff", "zimos.glowRight": "#14b8a6" });
    expect(leftPicker()).toHaveValue("#2f7bff");
    expect(rightPicker()).toHaveValue("#14b8a6");
    expect(reset()).toBeEnabled();

    // The original palette is the absence of a choice.
    await user.click(palette("Original"));
    expect(pressed()).toEqual(["Original"]);
    expect(variable("--zimos-glow-left")).toBe("");
    expect(variable("--zimos-glow-right")).toBe("");
    expect(kept()).toEqual({});
  });

  it("takes a colour of the merchant's own for each side", () => {
    renderWithProviders(<AppearanceSection />);
    pick(leftPicker(), "#00FF88");
    expect(variable("--zimos-glow-left")).toBe("#00ff88");
    // The other side keeps the colours it always had.
    expect(variable("--zimos-glow-right")).toBe("");
    expect(kept()).toEqual({ "zimos.glowLeft": "#00ff88" });
    expect(pressed()).toEqual([]);

    pick(rightPicker(), "#123456");
    expect(variable("--zimos-glow-right")).toBe("#123456");
    expect(kept()).toEqual({ "zimos.glowLeft": "#00ff88", "zimos.glowRight": "#123456" });
    expect(leftPicker()).toHaveValue("#00ff88");
    expect(rightPicker()).toHaveValue("#123456");
  });

  it("takes nothing that is not a six-digit hex colour, from the page or from storage", () => {
    renderWithProviders(<AppearanceSection />);
    for (const bad of ["red", "#fff", "#12345g", "rgb(1,2,3)", "#1234567", "#00ff88; background: red", ""]) setGlow({ left: bad, right: bad });
    expect(variable("--zimos-glow-left")).toBe("");
    expect(variable("--zimos-glow-right")).toBe("");
    expect(kept()).toEqual({});

    localStorage.setItem("zimos.glowLeft", "url(https://example.com/x.png)");
    localStorage.setItem("zimos.glowRight", "#ABCDEF");
    localStorage.setItem("zimos.glowIntensity", "250");
    restoreAppearance();
    expect(variable("--zimos-glow-left")).toBe("");
    expect(variable("--zimos-glow-right")).toBe("#abcdef");
    expect(variable("--zimos-glow-strength")).toBe("");
  });

  it("fades the glows with the intensity, down to none", () => {
    renderWithProviders(<AppearanceSection />);
    slide(intensity(), 40);
    expect(variable("--zimos-glow-strength")).toBe("40%");
    expect(localStorage.getItem("zimos.glowIntensity")).toBe("40");
    expect(intensity()).toHaveAttribute("aria-valuetext", "40%");
    expect(pressed()).toEqual(["Original"]);

    slide(intensity(), 0);
    expect(variable("--zimos-glow-strength")).toBe("0%");
    expect(localStorage.getItem("zimos.glowIntensity")).toBe("0");
    expect(intensity()).toHaveAttribute("aria-valuetext", "Off");
    expect(pressed()).toEqual(["No glows"]);

    // Full strength is the absence of a choice.
    slide(intensity(), 100);
    expect(variable("--zimos-glow-strength")).toBe("");
    expect(localStorage.getItem("zimos.glowIntensity")).toBeNull();
  });

  it("turns the glows off from the last palette, and a palette picked after brings them back", async () => {
    const { user } = renderWithProviders(<AppearanceSection />);
    await user.click(palette("Violet"));
    await user.click(palette("No glows"));
    expect(pressed()).toEqual(["No glows"]);
    expect(variable("--zimos-glow-strength")).toBe("0%");
    expect(intensity()).toHaveValue("0");
    // The colours are kept under it.
    expect(variable("--zimos-glow-left")).toBe("#8b5cf6");

    await user.click(palette("Sunset"));
    expect(pressed()).toEqual(["Sunset"]);
    expect(variable("--zimos-glow-strength")).toBe("");
    expect(intensity()).toHaveValue("100");
    expect(variable("--zimos-glow-left")).toBe("#ef4444");
    expect(variable("--zimos-glow-right")).toBe("#f59e0b");
  });

  it("keeps a chosen strength when another palette is picked", async () => {
    const { user } = renderWithProviders(<AppearanceSection />);
    slide(intensity(), 60);
    await user.click(palette("Emerald"));
    expect(variable("--zimos-glow-strength")).toBe("60%");
    expect(kept()).toEqual({ "zimos.glowLeft": "#10b981", "zimos.glowRight": "#a3e635", "zimos.glowIntensity": "60" });
  });

  it("goes back to the original glows with Reset", async () => {
    const { user } = renderWithProviders(<AppearanceSection />);
    await user.click(palette("Grey"));
    slide(intensity(), 30);
    pick(leftPicker(), "#00ff88");
    expect(Object.keys(kept())).toEqual(["zimos.glowIntensity", "zimos.glowLeft", "zimos.glowRight"]);

    await user.click(reset());
    expect(kept()).toEqual({});
    expect(variable("--zimos-glow-left")).toBe("");
    expect(variable("--zimos-glow-right")).toBe("");
    expect(variable("--zimos-glow-strength")).toBe("");
    expect(pressed()).toEqual(["Original"]);
    expect(leftPicker()).toHaveValue("#ff7c30");
    expect(intensity()).toHaveValue("100");
    expect(reset()).toBeDisabled();
  });

  it("keeps the colours while the Black look hides them, and shows them again in Dark", async () => {
    const { user } = renderWithProviders(<AppearanceSection />);
    await user.click(palette("Ocean"));
    await user.click(look("Black"));
    expect(glow()).not.toBeInTheDocument();
    expect(html).toHaveAttribute("data-glass", "off");
    expect(localStorage.getItem("zimos.glowLeft")).toBe("#2f7bff");

    await user.click(look("Dark"));
    expect(pressed()).toEqual(["Ocean"]);
    expect(variable("--zimos-glow-left")).toBe("#2f7bff");
  });
});

describe("Language and look: words", () => {
  it("switches the whole dashboard to Arabic, in formal Arabic", async () => {
    const { user } = renderWithProviders(<AppearanceSection />);
    await user.click(look("Dark"));
    await user.click(screen.getByRole("radio", { name: "عربي" }));
    expect(localStorage.getItem("zimos.locale")).toBe("ar");
    expect(screen.getByRole("switch", { name: "الأسطح الزجاجية" })).toBeInTheDocument();
    expect(screen.getByText("هذه الخيارات محفوظة على هذا الجهاز.")).toBeInTheDocument();
    expect(screen.getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["عربي", "English", "فاتح", "أسود", "داكن"]);
    expect(screen.getByRole("slider", { name: "درجة اللون" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ليلي" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "أردوازي" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "ألوان التوهّج" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "الشدّة" })).toBeInTheDocument();
    expect(screen.getByLabelText("التوهّج الأيسر")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "إعادة الضبط" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "بلا توهّج" })).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "أسود" }));
    expect(screen.getByText("المظهر الأسود بلا زجاج ولا توهّج. اختر الفاتح أو الداكن لتشغيل الزجاج.")).toBeInTheDocument();
  });
});

describe("the glass switch on its own", () => {
  it("follows the same choice as the settings row", async () => {
    const { user } = renderWithProviders(
      <>
        <GlassToggle />
        <AppearanceSection />
      </>
    );
    const [toggle, row] = screen.getAllByRole("switch", { name: "Glass surfaces" });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(row).toHaveAttribute("aria-checked", "false");
    expect(html).toHaveAttribute("data-glass", "off");

    await user.click(row);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(html).not.toHaveAttribute("data-glass");
  });
});

describe("the toolbar's sun and moon switch", () => {
  const toolbar = () => screen.getByRole("button", { name: /Switch to (light|dark) mode/ });

  it("goes between Light and Dark for a merchant who chose nothing else, as it always did", async () => {
    const { user } = renderWithProviders(<ThemeToggle />);
    expect(toolbar()).toHaveAccessibleName("Switch to dark mode");

    await user.click(toolbar());
    expect(html).toHaveClass("dark");
    expect(html).toHaveAttribute("data-look", "dark");
    expect(html).not.toHaveAttribute("data-tone");
    expect(toolbar()).toHaveAccessibleName("Switch to light mode");
    expect(kept()).toEqual({ "zimos.look": "dark", "zimos.darkLook": "dark", theme: "dark" });

    await user.click(toolbar());
    expect(html).not.toHaveClass("dark");
    expect(html).toHaveAttribute("data-look", "light");
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("goes back to the dark look chosen last in Settings: Black, then Dark", async () => {
    const { user } = renderWithProviders(
      <>
        <ThemeToggle />
        <AppearanceSection />
      </>
    );
    await user.click(look("Black"));
    expect(toolbar()).toHaveAccessibleName("Switch to light mode");

    await user.click(toolbar());
    expect(look("Light")).toHaveAttribute("aria-checked", "true");
    expect(html).toHaveAttribute("data-look", "light");

    await user.click(toolbar());
    expect(look("Black")).toHaveAttribute("aria-checked", "true");
    expect(html).toHaveAttribute("data-look", "black");
    expect(html).toHaveAttribute("data-glass", "off");

    await user.click(look("Dark"));
    slide(toneSlider()!, 20);
    await user.click(toolbar());
    await user.click(toolbar());
    expect(look("Dark")).toHaveAttribute("aria-checked", "true");
    expect(html).toHaveAttribute("data-look", "dark");
    // With its tone.
    expect(html).toHaveAttribute("data-tone", "20");
  });
});

describe("before the first paint", () => {
  // The script the page runs in <head>, as it is in index.html.
  const page = readFileSync(join(__dirname, "../../../index.html"), "utf8");
  const script = /<script>([\s\S]*?)<\/script>/.exec(page)?.[1] ?? "";
  const firstPaint = () => new Function(script)();

  function open(storage: Record<string, string>, settings: { dark?: boolean; solid?: boolean } = {}) {
    blankPage();
    localStorage.clear();
    for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, value);
    device(settings);
  }

  it("is one inline script, with nothing fetched", () => {
    expect(script).toContain('get("zimos.look")');
    expect(page.match(/<script>/g)).toHaveLength(1);
  });

  it("draws light, and nothing else, for a merchant who kept nothing", () => {
    open({});
    firstPaint();
    expect(drawn()).toEqual({
      dark: false,
      scheme: "light",
      look: "light",
      tone: null,
      glass: null,
      variables: Object.fromEntries(VARIABLES.map((name) => [name, ""])),
    });
  });

  it("opens an old dark choice in Dark as it always was", () => {
    open({ theme: "dark" });
    firstPaint();
    expect(drawn()).toMatchObject({ dark: true, scheme: "dark", look: "dark", tone: null, glass: null });
    expect(variable("--zimos-tone-mid")).toBe("");
  });

  it("opens Black with glass off", () => {
    open({ "zimos.look": "black", theme: "dark" });
    firstPaint();
    expect(drawn()).toMatchObject({ dark: true, scheme: "dark", look: "black", tone: null, glass: "off" });
  });

  it("opens Dark at its tone", () => {
    open({ "zimos.look": "dark", "zimos.darkTone": "80" });
    firstPaint();
    expect(drawn()).toMatchObject({ dark: true, look: "dark", tone: "80", glass: null });
    expect(variable("--zimos-tone-mid")).toBe("100%");
    expect(variable("--zimos-tone-slate")).toBe("60%");
  });

  it("opens the glow colours and their strength", () => {
    open({ "zimos.glowLeft": "#2F7BFF", "zimos.glowRight": "#14b8a6", "zimos.glowIntensity": "40" });
    firstPaint();
    expect(variable("--zimos-glow-left")).toBe("#2f7bff");
    expect(variable("--zimos-glow-right")).toBe("#14b8a6");
    expect(variable("--zimos-glow-strength")).toBe("40%");
  });

  it("draws every kept state exactly as the app does after it", () => {
    const cases: Array<[Record<string, string>, { dark?: boolean; solid?: boolean }?]> = [
      [{}],
      [{}, { dark: true }],
      [{}, { solid: true }],
      [{}, { dark: true, solid: true }],
      [{ theme: "dark" }],
      [{ theme: "light" }, { dark: true }],
      [{ theme: "system" }, { dark: true }],
      [{ "zimos.look": "light", theme: "dark" }],
      [{ "zimos.look": "black" }],
      [{ "zimos.look": "black", "zimos.darkTone": "20", "zimos.glowLeft": "#2f7bff" }],
      [{ "zimos.look": "dark" }],
      [{ "zimos.look": "dark", "zimos.darkTone": "0" }],
      [{ "zimos.look": "dark", "zimos.darkTone": "20" }],
      [{ "zimos.look": "dark", "zimos.darkTone": "50" }],
      [{ "zimos.look": "dark", "zimos.darkTone": "075" }],
      [{ "zimos.look": "dark", "zimos.darkTone": "100" }],
      [{ "zimos.look": "dark", "zimos.darkTone": "101" }],
      [{ "zimos.look": "dark", "zimos.darkTone": "-5" }],
      [{ "zimos.look": "dark", "zimos.darkTone": "12.5" }],
      [{ "zimos.look": "dark", "zimos.darkTone": "midnight" }],
      [{ "zimos.look": "light", "zimos.darkTone": "20" }],
      [{ "zimos.look": "sepia", "zimos.darkTone": "20" }, { dark: true }],
      [{ "zimos.darkLook": "black" }, { dark: true }],
      [{ "zimos.darkLook": "black" }],
      [{ "zimos.darkLook": "purple", "zimos.darkTone": "30" }, { dark: true }],
      [{ "zimos.glass": "off" }],
      [{ "zimos.glass": "on" }],
      [{ "zimos.look": "dark", "zimos.glass": "off", "zimos.darkTone": "90" }],
      [{ "zimos.glowLeft": "#2F7BFF", "zimos.glowRight": "#14b8a6", "zimos.glowIntensity": "40" }],
      [{ "zimos.glowLeft": "red", "zimos.glowRight": "#fff", "zimos.glowIntensity": "100" }],
      [{ "zimos.glowLeft": "#12345g", "zimos.glowRight": "#abcdef" }],
      [{ "zimos.glowIntensity": "0" }],
      [{ "zimos.glowIntensity": "250" }],
      [{ "zimos.glowIntensity": "40%" }],
      [{ "zimos.look": "black", "zimos.glowIntensity": "10" }, { solid: true }],
    ];
    for (const [storage, settings] of cases) {
      open(storage, settings);
      firstPaint();
      const byThePage = drawn();

      blankPage();
      restoreAppearance();
      expect(drawn(), JSON.stringify([storage, settings ?? {}])).toEqual(byThePage);
    }
  });
});
