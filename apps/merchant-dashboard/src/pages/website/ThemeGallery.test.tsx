import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { api, fake, workspaceMock, type ListedWorkspace } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { Workspace } from "@store-builder/api-client";
import { ThemeGallery } from "./ThemeGallery";

let submit: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  submit = vi.fn<() => void>();
  vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(submit);
  api.me.mockResolvedValue(fake({}));
});

function store(themeSettings: Record<string, unknown>) {
  workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", tagline: null, themeSettings });
}

/** The store as GET /workspaces returns it now — what a save builds on. */
function onServer(themeSettings: Record<string, unknown>) {
  api.listWorkspaces.mockResolvedValue([fake<ListedWorkspace>({ id: "ws_1", name: "Nile Store", themeSettings })]);
}

/** The last form the live preview posted, as the storefront would read it. */
function lastPost() {
  const form = document.querySelector<HTMLFormElement>("form[target]")!;
  const field = (name: string) => (form.elements.namedItem(name) as HTMLInputElement).value;
  return { tree: JSON.parse(field("tree")), theme: field("theme") ? JSON.parse(field("theme")) : null, colorMode: field("colorMode") };
}

describe("ThemeGallery", () => {
  it("offers the original look and six themes, each named and described, and marks the store's own", () => {
    store({ storeTheme: "warm" });
    renderWithProviders(<ThemeGallery />);

    const cards = screen.getAllByRole("listitem");
    expect(cards).toHaveLength(7);
    // The store's own card also has a Reset button (ThemeResetButton).
    expect(cards.map((card) => within(card).getByRole("button", { name: /^Try the / }).getAttribute("aria-label"))).toEqual([
      "Try the Original theme",
      "Try the Elegant theme",
      "Try the Bold theme",
      "Try the Minimal theme",
      "Try the Classic theme",
      "Try the Warm theme",
      "Try the Glass theme",
    ]);
    expect(within(cards[5]).getByText("Current")).toBeInTheDocument();
    expect(within(cards[6]).getByText("Frosted see-through panels floating over a soft colour glow.")).toBeInTheDocument();
    // Drawings only: no storefront render until one is opened.
    expect(document.querySelectorAll("iframe")).toHaveLength(0);
  });

  it("names and describes them in Arabic for an Arabic dashboard", () => {
    store({});
    renderWithProviders(<ThemeGallery />, { locale: "ar" });
    expect(screen.getByRole("button", { name: "جرّب ثيم زجاجي" })).toBeInTheDocument();
    expect(screen.getByText("ألواح شفافة كالزجاج تطفو فوق توهج لوني ناعم.")).toBeInTheDocument();
    expect(screen.getByText("الأصلي")).toBeInTheDocument();
  });

  it("renders the store's own page in the theme, keeping the merchant's accents, in either mode", async () => {
    store({ primaryColor: "#1E40AF", primaryColorDark: "#93C5FD", fontFamily: "modern" });
    const { user } = renderWithProviders(<ThemeGallery />);

    await user.click(screen.getByRole("button", { name: "Try the Glass theme" }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    const first = lastPost();
    expect(first.theme).toMatchObject({ storeTheme: "glass", primaryColor: "#1E40AF", primaryColorDark: "#93C5FD" });
    expect(first.colorMode).toBe("light");
    // The page opens with the store's own name, and shows no picture of anyone's.
    expect(JSON.stringify(first.tree)).toContain("Nile Store");
    expect(JSON.stringify(first.tree)).not.toMatch(/https?:\/\//);

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Dark mode" }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
    expect(lastPost().colorMode).toBe("dark");
  });

  it("saves the theme onto the store's latest themeSettings without touching the rest", async () => {
    store({ primaryColor: "#1E40AF", productCountdownHours: 6 });
    // The dark accent was saved from another tab after this one loaded.
    onServer({ primaryColor: "#1E40AF", productCountdownHours: 6, primaryColorDark: "#93C5FD" });
    const saved = fake<Workspace>({ id: "ws_1", themeSettings: { storeTheme: "bold" } });
    api.updateWorkspace.mockResolvedValue(saved);
    const { user } = renderWithProviders(<ThemeGallery />);

    await user.click(screen.getByRole("button", { name: "Try the Bold theme" }));
    await user.click(screen.getByRole("button", { name: "Use this theme" }));
    await waitFor(() => expect(api.updateWorkspace).toHaveBeenCalledTimes(1));
    expect(api.updateWorkspace).toHaveBeenCalledWith("ws_1", {
      themeSettings: { primaryColor: "#1E40AF", productCountdownHours: 6, primaryColorDark: "#93C5FD", storeTheme: "bold" },
    });
    await waitFor(() => expect(workspaceMock.applySavedWorkspace).toHaveBeenCalledWith(saved));
    expect(await screen.findByText("Bold is now your store's theme.")).toBeInTheDocument();
  });

  it("goes back to the original look by dropping the key", async () => {
    store({ storeTheme: "minimal", primaryColor: "#2F4BFF" });
    onServer({ storeTheme: "minimal", primaryColor: "#2F4BFF" });
    api.updateWorkspace.mockResolvedValue(fake({}));
    const { user } = renderWithProviders(<ThemeGallery />);

    await user.click(screen.getByRole("button", { name: "Try the Original theme" }));
    await user.click(screen.getByRole("button", { name: "Use this theme" }));
    await waitFor(() => expect(api.updateWorkspace).toHaveBeenCalled());
    expect(api.updateWorkspace).toHaveBeenCalledWith("ws_1", { themeSettings: { primaryColor: "#2F4BFF" } });
  });

  it("saves nothing, and says why, when the store's latest settings can't be loaded", async () => {
    store({ primaryColor: "#1E40AF" });
    api.listWorkspaces.mockRejectedValue(new TypeError("Failed to fetch"));
    const { user } = renderWithProviders(<ThemeGallery />);

    await user.click(screen.getByRole("button", { name: "Try the Bold theme" }));
    await user.click(screen.getByRole("button", { name: "Use this theme" }));
    expect(
      await screen.findByText(
        "Couldn't load your store's latest settings, so nothing was saved. Check your connection and try again."
      )
    ).toBeInTheDocument();
    expect(api.updateWorkspace).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("says so when the theme is already the store's", async () => {
    store({ storeTheme: "classic" });
    const { user } = renderWithProviders(<ThemeGallery />);
    await user.click(screen.getByRole("button", { name: "Try the Classic theme" }));
    expect(screen.getByRole("button", { name: "This is your store's theme" })).toBeDisabled();
  });
});
