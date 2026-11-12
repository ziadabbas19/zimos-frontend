import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { FontCatalog, PageElement, Workspace } from "@store-builder/api-client";
import { api, fake, workspaceMock } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { resetFontCatalogForTests } from "@/lib/fontCatalog";
import { setSectionFont, withFont } from "@/pages/website/editor/canvasEdits";
import { FontsSection } from "./FontsSection";

/**
 * Store settings → Fonts: the catalog read once, the picks saved into
 * themeSettings beside everything else the blob holds — and the editors'
 * writers keep the rest of a node's settings.
 */

const CATALOG: FontCatalog = {
  version: "test",
  scripts: ["ar", "latin", "both"],
  categories: ["sans", "serif", "display", "handwriting", "mono", "kufi", "naskh", "ruqaa"],
  fonts: [
    { id: "cairo", family: "Cairo", script: "both", category: "sans", weights: [400, 700], preview: "متجرك Your store" },
    { id: "amiri", family: "Amiri", script: "ar", category: "naskh", weights: [400, 700], preview: "متجرك" },
    { id: "inter", family: "Inter", script: "latin", category: "sans", weights: [400, 700], variable: [100, 900], preview: "Your store" },
    { id: "lora", family: "Lora", script: "latin", category: "serif", weights: [400, 700], preview: "Your store" },
  ],
};

beforeEach(() => {
  resetFontCatalogForTests();
  api.request.mockImplementation(async (path: string) => {
    if (path === "/fonts") return CATALOG;
    throw new Error(`unexpected ${path}`);
  });
});

describe("FontsSection", () => {
  it("saves the store's Arabic and English fonts and the header's, keeping the rest of themeSettings", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", role: "owner", themeSettings: { primaryColor: "#123456", storeTheme: "bold" } });
    api.updateWorkspace.mockImplementation(async (_id, payload) => fake<Workspace>({ id: "ws_1", role: "owner", themeSettings: payload.themeSettings }));
    const { user } = renderWithProviders(<FontsSection />);

    // The store's own pair comes first; the header's and the products' follow in their groups.
    const [arabic] = await screen.findAllByRole("button", { name: /^Arabic font/ });
    await user.click(arabic);
    await user.click(await screen.findByRole("option", { name: /Amiri/ }));
    await user.click(screen.getAllByRole("button", { name: /^English font/ })[0]);
    await user.click(screen.getByRole("option", { name: /Inter/ }));

    const header = screen.getByRole("group", { name: "Header" });
    await user.click(within(header).getByRole("button", { name: /^English font/ }));
    await user.click(screen.getByRole("option", { name: /Lora/ }));

    await user.click(screen.getByRole("button", { name: "Save fonts" }));
    await waitFor(() =>
      expect(api.updateWorkspace).toHaveBeenCalledWith("ws_1", {
        themeSettings: {
          primaryColor: "#123456",
          storeTheme: "bold",
          fonts: { primaryAr: "amiri", primaryEn: "inter", header: { en: "lora" } },
        },
      })
    );
    expect(api.request).toHaveBeenCalledTimes(1);
  });

  it("drops the key when every font goes back to the store default", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", role: "owner", themeSettings: { fonts: { primaryAr: "cairo" }, fontFamily: "modern" } });
    api.updateWorkspace.mockImplementation(async (_id, payload) => fake<Workspace>({ id: "ws_1", role: "owner", themeSettings: payload.themeSettings }));
    const { user } = renderWithProviders(<FontsSection />);
    expect((await screen.findAllByRole("button", { name: /^Arabic font/ }))[0]).toHaveTextContent("Cairo");
    await user.click(screen.getByRole("button", { name: "Use store default — Arabic font" }));
    await user.click(screen.getByRole("button", { name: "Save fonts" }));
    await waitFor(() => expect(api.updateWorkspace).toHaveBeenCalledWith("ws_1", { themeSettings: { fontFamily: "modern" } }));
  });

  it("is in Arabic for an Arabic dashboard, and read-only for a role that cannot edit the website", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", role: "confirmation_agent", themeSettings: {} });
    renderWithProviders(<FontsSection />, { locale: "ar" });
    expect(await screen.findByText(/يمكن لمالك المتجر/)).toBeInTheDocument();
    for (const picker of screen.getAllByRole("button", { name: /^الخط العربي/ })) expect(picker).toBeDisabled();
    expect(screen.queryByRole("button", { name: "حفظ الخطوط" })).not.toBeInTheDocument();
  });
});

describe("the editors' font writers", () => {
  it("set and drop an element's font, keeping its style and named style", () => {
    const element = { id: "e1", type: "heading", settings: { style: { base: { color: "#111111" } }, styleRef: "brand" } } as PageElement;
    const withPair = withFont(element, { ar: "amiri", en: null });
    expect(withPair).toEqual({ style: { base: { color: "#111111" } }, styleRef: "brand", font: { ar: "amiri" } });
    expect(withFont({ ...element, settings: withPair }, null)).toEqual({ style: { base: { color: "#111111" } }, styleRef: "brand" });
    expect(withFont({ id: "e2", type: "text", settings: { font: { en: "lora" } } } as PageElement, null)).toBeUndefined();
  });

  it("set and drop a section's font, keeping its other settings", () => {
    const section = { id: "s1", type: "section" as const, rows: [], settings: { padding: "lg" } };
    const next = setSectionFont(section, { ar: null, en: "inter" });
    expect(next.settings).toEqual({ padding: "lg", font: { en: "inter" } });
    expect(setSectionFont(next, null).settings).toEqual({ padding: "lg" });
    expect(setSectionFont({ id: "s2", type: "section", rows: [], settings: { font: { ar: "amiri" } } }, null)).not.toHaveProperty("settings");
  });
});
