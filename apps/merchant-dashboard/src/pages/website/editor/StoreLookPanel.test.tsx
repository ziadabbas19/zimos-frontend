import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { checkAccent } from "@/lib/contrast";
import { StoreLookPanel } from "./StoreLookPanel";
import { readStoreLook, type StoreLook } from "./storeLook";
import { accentGrounds } from "./storeThemes";

function look(themeSettings: Record<string, unknown>): StoreLook {
  return readStoreLook({ themeSettings, logoUrl: null });
}

function renderPanel(value: StoreLook) {
  const onChange = vi.fn<(next: StoreLook, historyKey?: string) => void>();
  const onPreviewMode = vi.fn();
  const utils = renderWithProviders(
    <StoreLookPanel look={value} onChange={onChange} onPreviewMode={onPreviewMode} storeName="Nile Store" />
  );
  return { ...utils, onChange, onPreviewMode };
}

describe("StoreLookPanel — theme", () => {
  it("offers the original look and the six themes, and switches between them", async () => {
    const { user, onChange } = renderPanel(look({}));
    const group = screen.getByRole("radiogroup", { name: "Theme" });
    const options = within(group).getAllByRole("radio");
    expect(options.map((o) => o.getAttribute("aria-label"))).toEqual(["Original", "Elegant", "Bold", "Minimal", "Classic", "Warm", "Glass"]);
    expect(within(group).getByRole("radio", { name: "Original" })).toHaveAttribute("aria-checked", "true");
    // Each thumbnail sets the store's own name in the theme's heading face.
    expect(within(options[1]).getByText("Nile Store")).toBeInTheDocument();

    await user.click(within(group).getByRole("radio", { name: "Glass" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ storeTheme: "glass" }));
  });

  it("keeps font, corners and the second colour for the original look only — a theme owns them", () => {
    renderPanel(look({}));
    expect(screen.getByRole("radiogroup", { name: "Font" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Corners" })).toBeInTheDocument();
    expect(screen.getByText("Second colour")).toBeInTheDocument();
  });

  it("hides them on a theme, and says what the theme sets", () => {
    renderPanel(look({ storeTheme: "elegant" }));
    expect(screen.queryByRole("radiogroup", { name: "Font" })).toBeNull();
    expect(screen.queryByRole("radiogroup", { name: "Corners" })).toBeNull();
    expect(screen.queryByText("Second colour")).toBeNull();
    expect(screen.getByText(/A theme sets the fonts, corners, buttons, cards, spacing and hero layout/)).toBeInTheDocument();
  });
});

describe("StoreLookPanel — accent per mode", () => {
  it("shows two pickers, the dark one following the light one until it is set", () => {
    renderPanel(look({ primaryColor: "#1E40AF" }));
    expect(screen.getByLabelText("Light mode colour picker")).toHaveValue("#1e40af");
    expect(screen.getByLabelText("Dark mode colour picker")).toHaveValue("#1e40af");
    expect(screen.getByText("Same as light mode until you pick one.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use the light-mode colour" })).toBeNull();
  });

  it("warns — without blocking — when a colour is hard to read in its mode, and offers a readable one", async () => {
    // One deep blue for both modes: fine on white, hard to read on the dark page.
    const { user, onChange, onPreviewMode } = renderPanel(look({ primaryColor: "#1E40AF" }));
    const warning = screen.getByRole("status");
    expect(within(warning).getByText("Hard to read in dark mode")).toBeInTheDocument();
    expect(within(warning).getByText(/This colour as text on your background: \d\.\d : 1/)).toBeInTheDocument();
    expect(within(warning).getByText("Aim for at least 4.5 : 1. You can still save it.")).toBeInTheDocument();
    // Light mode reads fine.
    expect(screen.getByText(/^Easy to read — button text/)).toBeInTheDocument();

    const use = within(warning).getByRole("button", { name: /Use the suggested colour #[0-9A-F]{6} in dark mode/ });
    await user.click(use);
    const next = onChange.mock.lastCall![0];
    expect(next.primaryColor).toBe("#1E40AF");
    expect(next.primaryColorDark).toMatch(/^#[0-9A-F]{6}$/);
    expect(checkAccent(next.primaryColorDark!, accentGrounds("original", "dark", next.primaryColorDark!)).ok).toBe(true);
    // The preview switches to the mode being fixed.
    expect(onPreviewMode).toHaveBeenLastCalledWith("dark");
  });

  it("checks each mode against the chosen theme's own grounds", () => {
    // A bright yellow reads as a button on either, but not as text on white.
    renderPanel(look({ storeTheme: "bold", primaryColor: "#FFD60A", primaryColorDark: "#FFD60A" }));
    const warnings = screen.getAllByRole("status");
    expect(warnings).toHaveLength(1);
    expect(within(warnings[0]).getByText("Hard to read in light mode")).toBeInTheDocument();
  });

  it("lets a separate dark colour go back to following light mode", async () => {
    const { user, onChange } = renderPanel(look({ primaryColor: "#1F3A5F", primaryColorDark: "#9DB9E8" }));
    expect(screen.getByLabelText("Dark mode colour picker")).toHaveValue("#9db9e8");
    await user.click(screen.getByRole("button", { name: "Use the light-mode colour" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ primaryColor: "#1F3A5F", primaryColorDark: null }), undefined);
  });

  it("says when the theme's own colour is in use", () => {
    renderPanel(look({ storeTheme: "warm" }));
    expect(screen.getAllByText("Not set yet — your store uses the theme's own colour.")).toHaveLength(2);
    // The theme's defaults show in the pickers, and read well.
    expect(screen.getByLabelText("Light mode colour picker")).toHaveValue("#a64a24");
    expect(screen.queryByRole("status")).toBeNull();
  });
});

// The choice of top bar or side bar is behind VITE_STORE_SIDEBAR_ENABLED, which is off here
// (StoreLookPanel.navLayout.test.tsx is the panel with it on).
describe("StoreLookPanel — navigation (switch off)", () => {
  it("does not offer the choice, whatever the store saved", () => {
    renderPanel(look({}));
    expect(screen.queryByRole("radiogroup", { name: "Navigation" })).toBeNull();
    expect(screen.queryByRole("radio", { name: "Side bar" })).toBeNull();
  });

  it("carries a saved side bar through any other change, untouched", async () => {
    const { user, onChange } = renderPanel(look({ header: { layout: "side" } }));
    expect(screen.queryByRole("radiogroup", { name: "Navigation" })).toBeNull();
    await user.click(within(screen.getByRole("radiogroup", { name: "Theme" })).getByRole("radio", { name: "Glass" }));
    expect(onChange.mock.calls[0][0].header.layout).toBe("side");
  });
});
