import { beforeEach, describe, expect, it } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import { ApiError, CART_SHEET_DEFAULTS, type Workspace } from "@store-builder/api-client";
import { fake, workspaceMock } from "@/test/mocks";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SETTINGS_SECTIONS } from "@/pages/settings/settingsSections";
import { STORE_SETTINGS_SECTIONS, STORE_SETTINGS_SECTION_STRINGS, STORE_SETTINGS_TABS } from "./storeSettingsSections";
import { CartTab } from "./CartTab";
import { SEARCH_INDEX, searchEntries } from "@/lib/search/siteIndex";

// Store settings → Buying → Cart behavior: when the store's cart sheet opens,
// how it appears and how fast it moves, for every store (no plan, no switch).
// Saved whole as settings.cart_sheet through the store settings' PATCH.

function storeWith(settings: Record<string, unknown> = {}, role = "owner") {
  workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", role, settings });
}
/** GET /workspaces/:id/cart-sheet as the server answers it (the defaults, no lines, unless told). */
const view = (change: Record<string, unknown> = {}) => ({ cartSheet: { ...CART_SHEET_DEFAULTS, trustItems: [], trustItemsFrom: "cart_sheet", ...change } });

beforeEach(() => storeWith());

describe("the cart behavior section", () => {
  it("starts from the defaults for a store that never chose, and says so", async () => {
    fakeBackend({ "GET /cart-sheet": view() });
    renderWithProviders(<CartTab />);
    expect(await screen.findByText(/Your store uses the default cart/)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /After “Add to cart”/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /When the shopper taps the cart icon/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /From the “Order now” button/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Off for all/ })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: /Automatic/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Fast" })).toBeChecked();
  });

  it("saves the merchant's choices whole through the store settings", async () => {
    const calls = fakeBackend({ "GET /cart-sheet": view(), "PATCH /workspaces/ws_1": { workspace: { id: "ws_1", settings: { cart_sheet: { ...CART_SHEET_DEFAULTS, presentation: "popup", trustItems: [] } } } } });
    const { user } = renderWithProviders(<CartTab />);
    await user.click(await screen.findByRole("checkbox", { name: /After “Add to cart”/ }));
    await user.click(screen.getByRole("checkbox", { name: /From the “Order now” button/ }));
    await user.click(screen.getByRole("radio", { name: /Centered popup/ }));
    await user.click(screen.getByRole("radio", { name: "None" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(callsTo(calls, "PATCH", "/workspaces/ws_1")).toHaveLength(1));
    expect(callsTo(calls, "PATCH", "/workspaces/ws_1")[0].body).toEqual({
      settings: { cart_sheet: { enabled: true, openOn: { addToCart: true, cartIcon: true, quickOrder: true }, presentation: "popup", speed: "none", trustItems: [] } },
    });
  });

  it("off for all keeps the choices underneath, greyed, and the preview says the sheet is off", async () => {
    fakeBackend({ "GET /cart-sheet": view() });
    const { user } = renderWithProviders(<CartTab />);
    await user.click(await screen.findByRole("checkbox", { name: /Off for all/ }));
    expect(screen.getByRole("checkbox", { name: /When the shopper taps the cart icon/ })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /When the shopper taps the cart icon/ })).toBeChecked();
    expect(screen.getByText(/The cart sheet is off/)).toBeInTheDocument();
  });

  it("previews each presentation on a phone and a computer, opening at the chosen speed", async () => {
    fakeBackend({ "GET /cart-sheet": view() });
    storeWith({ cart_sheet: { ...CART_SHEET_DEFAULTS, speed: "normal" } });
    const { user } = renderWithProviders(<CartTab />);
    const variants = () => Array.from(document.querySelectorAll("[data-preview-screen]")).map((el) => `${el.getAttribute("data-preview-screen")}:${el.getAttribute("data-preview-variant")}`);
    await screen.findByText("Preview");
    // Automatic: a bottom sheet on the phone, a side drawer on the computer.
    expect(variants()).toEqual(["phone:bottom_sheet", "computer:side_drawer"]);
    const panel = () => document.querySelector("[data-preview-panel]") as HTMLElement;
    expect(panel().style.transitionDuration).toBe("400ms");
    expect(panel().className).toContain("translate-y-full");
    await waitFor(() => expect(panel().className).toContain("translate-y-0"));
    await user.click(screen.getByRole("radio", { name: /Side drawer/ }));
    expect(variants()).toEqual(["phone:side_drawer", "computer:side_drawer"]);
    // Mirrored with the language, as in the store: the inline end, parked off it (to the left in Arabic).
    const side = document.querySelector("[data-preview-panel]") as HTMLElement;
    expect(side.className).toMatch(/(^|\s)end-0(\s|$)/);
    expect(side.className).not.toMatch(/(^|\s)right-0(\s|$)/);
    await user.click(screen.getByRole("radio", { name: /Centered popup/ }));
    expect(variants()).toEqual(["phone:popup", "computer:popup"]);
  });

  it("no speed: the preview is open at once", async () => {
    fakeBackend({ "GET /cart-sheet": view() });
    storeWith({ cart_sheet: { ...CART_SHEET_DEFAULTS, speed: "none" } });
    renderWithProviders(<CartTab />);
    await screen.findByText("Preview");
    const panel = document.querySelector("[data-preview-panel]") as HTMLElement;
    expect(panel.style.transitionDuration).toBe("0ms");
    expect(panel.className).toContain("translate-y-0");
  });

  it("previews in Arabic and in English, whatever the dashboard's language", async () => {
    fakeBackend({ "GET /cart-sheet": view() });
    const { user } = renderWithProviders(<CartTab />, { locale: "ar" });
    expect(await screen.findByRole("heading", { name: "متى تفتح السلة" })).toBeInTheDocument();
    const screens = () => document.querySelector("[data-preview-screen]")!.closest("[dir]")!;
    expect(screens().getAttribute("dir")).toBe("rtl");
    expect(within(screens() as HTMLElement).getAllByText("سلة المشتريات").length).toBe(2);
    await user.click(screen.getByRole("radio", { name: "English" }));
    expect(screens().getAttribute("dir")).toBe("ltr");
    expect(within(screens() as HTMLElement).getAllByText("Shopping cart").length).toBe(2);
  });

  it("is read only for a role that cannot edit the store settings", async () => {
    fakeBackend({ "GET /cart-sheet": view() });
    storeWith({}, "accountant");
    renderWithProviders(<CartTab />);
    expect(await screen.findByText("View only")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Off for all/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
  });

  it("shows the server's refusal and keeps the draft", async () => {
    fakeBackend({ "GET /cart-sheet": view(), "PATCH /workspaces/ws_1": new ApiError("Invalid body", 422, "VALIDATION_ERROR") });
    const { user } = renderWithProviders(<CartTab />);
    await user.click(await screen.findByRole("radio", { name: /^Bottom sheet/ }));
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Save changes" }));
    });
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^Bottom sheet/ })).toBeChecked();
  });

  it("shows a skeleton while the settings load, and the error with a retry if they do not", async () => {
    fakeBackend({});
    const { container, unmount } = renderWithProviders(<CartTab />);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(container.querySelector("[aria-hidden='true'] .h-10, [aria-busy='true']")).not.toBeNull();
    unmount();
    fakeBackend({ "GET /cart-sheet": new ApiError("Server error", 500, "INTERNAL") });
    renderWithProviders(<CartTab />);
    expect(await screen.findByRole("button", { name: /Try again|Retry/ })).toBeInTheDocument();
  });
});

describe("the lines under the checkout button", () => {
  const OLD = [{ text: { ar: "شحن سريع", en: "Fast delivery" }, enabled: true }];

  it("shows the lines written on the cart rewards page before, says they live here now, and saves them here", async () => {
    const calls = fakeBackend({
      "GET /cart-sheet": view({ trustItems: OLD, trustItemsFrom: "cart_rewards" }),
      "PATCH /workspaces/ws_1": { workspace: { id: "ws_1", settings: { cart_sheet: { ...CART_SHEET_DEFAULTS, trustItems: OLD } } } },
    });
    const { user } = renderWithProviders(<CartTab />);
    expect(await screen.findByText(/were written on the Cart rewards page/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Fast delivery")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add a line" }));
    const arabic = screen.getAllByRole("textbox", { name: "In Arabic" });
    await user.type(arabic[1], "الدفع عند الاستلام");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(callsTo(calls, "PATCH", "/workspaces/ws_1")).toHaveLength(1));
    expect((callsTo(calls, "PATCH", "/workspaces/ws_1")[0].body as { settings: { cart_sheet: { trustItems: unknown } } }).settings.cart_sheet.trustItems).toEqual([
      { text: { ar: "شحن سريع", en: "Fast delivery" }, enabled: true },
      { text: { ar: "الدفع عند الاستلام", en: "" }, enabled: true },
    ]);
  });

  it("will not save a line with no text, and stops at four", async () => {
    const calls = fakeBackend({ "GET /cart-sheet": view() });
    const { user } = renderWithProviders(<CartTab />);
    const add = await screen.findByRole("button", { name: "Add a line" });
    for (let i = 0; i < 4; i++) await user.click(add);
    expect(add).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getAllByText("Write the line in Arabic or English, or remove it.")).toHaveLength(4);
    expect(callsTo(calls, "PATCH", "/workspaces/ws_1")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Remove line 1" }));
    expect(screen.getAllByRole("textbox", { name: "In Arabic" })).toHaveLength(3);
  });

  it("shows a switched-on line under the button in the preview", async () => {
    fakeBackend({ "GET /cart-sheet": view({ trustItems: [{ text: { ar: "", en: "Cash on delivery" }, enabled: true }] }) });
    renderWithProviders(<CartTab />);
    await screen.findByText("Preview");
    expect(screen.getAllByText(/Cash on delivery/).length).toBeGreaterThan(1);
  });
});

describe("where it is found", () => {
  it("is a section of Store settings, under Buying, and Ctrl K finds “Cart behavior”", () => {
    const section = STORE_SETTINGS_SECTIONS.find((s) => s.id === "cart");
    expect(section?.group).toBe("buying");
    expect(STORE_SETTINGS_TABS).toContain("cart");
    expect(STORE_SETTINGS_SECTION_STRINGS.en.cart).toBe("Cart behavior");
    expect(STORE_SETTINGS_SECTION_STRINGS.ar.cart).toBe("سلوك السلة");
    // Not a Settings section of its own.
    expect(SETTINGS_SECTIONS.some((s) => s.id === ("cart" as string))).toBe(false);
    for (const query of ["Cart behavior", "سلوك السلة", "cart drawer"]) {
      const [first] = searchEntries(query, SEARCH_INDEX);
      expect({ query, to: first?.entry.to }).toEqual({ query, to: "/store-settings/cart" });
    }
  });
});
