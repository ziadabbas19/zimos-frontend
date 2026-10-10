import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";

// The Store look's "Navigation" choice is offered only with this switch on;
// StoreLookPanel.test.tsx covers the panel with it off (the real module).
vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  STORE_SIDEBAR_ENABLED: true,
}));

import { EditorLocaleContext } from "./editorLocale";
import { StoreLookPanel } from "./StoreLookPanel";
import { lookToWorkspacePatch, readStoreLook, type StoreLook } from "./storeLook";

function look(themeSettings: Record<string, unknown>): StoreLook {
  return readStoreLook({ themeSettings, logoUrl: null });
}

function renderPanel(value: StoreLook, locale: "en" | "ar" = "en") {
  const onChange = vi.fn<(next: StoreLook, historyKey?: string) => void>();
  const utils = renderWithProviders(
    <EditorLocaleContext value={locale}>
      <StoreLookPanel look={value} onChange={onChange} storeName="Nile Store" />
    </EditorLocaleContext>,
    { locale }
  );
  return { ...utils, onChange };
}

describe("StoreLookPanel — navigation (switch on)", () => {
  it("offers top bar or side bar, with the top bar chosen for a store that saved nothing", () => {
    renderPanel(look({}));
    const group = screen.getByRole("radiogroup", { name: "Navigation" });
    expect(within(group).getAllByRole("radio").map((r) => r.textContent)).toEqual(["Top bar", "Side bar"]);
    expect(within(group).getByRole("radio", { name: "Top bar" })).toHaveAttribute("aria-checked", "true");
    expect(within(group).getByRole("radio", { name: "Side bar" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText(/On a phone the store keeps the top bar and its menu\./)).toBeInTheDocument();
  });

  it("changes only the header's layout when the merchant picks the side bar", async () => {
    const before = look({ primaryColor: "#1E40AF", header: { sticky: false, menu: [{ label: "Shop", href: "/products" }] } });
    const { user, onChange } = renderPanel(before);
    await user.click(screen.getByRole("radio", { name: "Side bar" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0];
    expect(next).toEqual({ ...before, header: { ...before.header, layout: "side" } });
    // What a save would send: the one new key, inside the header.
    expect(lookToWorkspacePatch({}, next).themeSettings.header).toMatchObject({ layout: "side", sticky: false });
  });

  it("shows a saved side bar as chosen, and goes back to the top bar", async () => {
    const { user, onChange } = renderPanel(look({ header: { layout: "side" } }));
    expect(screen.getByRole("radio", { name: "Side bar" })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("radio", { name: "Top bar" }));
    const next = onChange.mock.calls[0][0];
    expect(next.header.layout).toBe("top");
    expect(lookToWorkspacePatch({ header: { layout: "side" } }, next).themeSettings.header).not.toHaveProperty("layout");
  });

  it("is worded in formal Arabic", () => {
    renderPanel(look({}), "ar");
    const group = screen.getByRole("radiogroup", { name: "التنقّل" });
    expect(within(group).getAllByRole("radio").map((r) => r.textContent)).toEqual(["شريط علوي", "شريط جانبي"]);
    expect(screen.getByText(/على الهاتف يبقى الشريط العلوي وقائمته كما هما\./)).toBeInTheDocument();
  });
});
