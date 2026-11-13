import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { CART_REWARDS_INHERITED_LOOK, type CartRewardsSettings } from "@store-builder/api-client";
import { testWorkspace, workspaceMock } from "@/test/mocks";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { CartRewardsPage } from "./CartRewardsPage";

// Offers → Cart rewards → Bar appearance: the store's style (controls greyed
// with the theme's values) or a custom look; switching keeps the custom
// values; failing contrast is named, fixable, and not saved; reset asks first;
// each reward's icon; the preview follows, in Arabic from the start side.

vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  CART_REWARDS_ENABLED: true,
}));

const URL = "/workspaces/ws_1/cart-rewards";
const SAVED: CartRewardsSettings = {
  enabled: true,
  allowCouponStacking: false,
  currency: "EGP",
  tiers: [
    { thresholdAmount: 50000, type: "free_shipping", label: null, autoLabel: { en: "Free shipping", ar: "شحن مجاني" }, icon: null, shownIcon: "truck" },
    { thresholdAmount: 100000, type: "percent", value: 5, label: null, autoLabel: { en: "5% off", ar: "خصم 5%" }, icon: "crown", shownIcon: "crown" },
  ],
  trustItems: [],
  appearance: { mode: "inherit", custom: null },
  cartSpeed: "normal",
};
const CUSTOM = { ...CART_REWARDS_INHERITED_LOOK, shape: "segmented" as const, fillColor: "#1d4ed8", trackColor: "#e5e7eb", marker: "rounded_square" as const };

beforeEach(() => {
  Object.assign(workspaceMock, { currentWorkspace: { ...testWorkspace, defaultCurrency: "EGP", settings: {} } });
});

function open(saved: CartRewardsSettings = SAVED, locale: "en" | "ar" = "en") {
  const calls = fakeBackend({
    "GET /plan-features": { planFeatures: { features: [], enforced: false } },
    [`GET ${URL}`]: { cartRewards: saved },
    [`PUT ${URL}`]: (call: { body: unknown }) => ({ cartRewards: { ...saved, appearance: (call.body as { appearance: unknown }).appearance } }),
  });
  const view = renderWithProviders(<CartRewardsPage />, { route: "/offers/cart-rewards", locale });
  return { calls, ...view };
}
const controls = () => document.querySelector("[data-look-controls]") as HTMLFieldSetElement;
const save = () => fireEvent.click(screen.getByRole("button", { name: /^Save/ }));
const putBody = (calls: ReturnType<typeof open>["calls"]) => callsTo(calls, "PUT", URL).at(-1)!.body as { appearance: unknown; tiers: Array<{ icon: unknown }> };

describe("match the store style", () => {
  it("is the default: the controls are greyed and show what the theme gives", async () => {
    open();
    expect(await screen.findByRole("radio", { name: "Match the store style" })).toBeChecked();
    expect(controls()).toBeDisabled();
    expect(within(controls()).getByRole("radio", { name: "Thick bar" })).toBeChecked();
    expect(within(controls()).getByRole("radio", { name: "Circle" })).toBeChecked();
    expect(within(controls()).getByRole("radio", { name: "Medium" })).toBeChecked();
    // The preview draws the theme's bar: no colour of its own.
    const bar = await screen.findByRole("progressbar", { name: "Rewards progress" });
    expect(bar.className).toContain("bg-line");
    expect(bar.getAttribute("style")).toBeNull();
  });
});

describe("the store's accent", () => {
  it("is what the preview fills with, in the light and the dark look", async () => {
    Object.assign(workspaceMock, { currentWorkspace: { ...testWorkspace, defaultCurrency: "EGP", settings: {}, themeSettings: { primaryColor: "#C2410C", primaryColorDark: "#FB923C" } } });
    open();
    const bar = await screen.findByRole("progressbar", { name: "Rewards progress" });
    expect(bar.closest("[data-store-accent]")).not.toBeNull();
    const css = Array.from(document.querySelectorAll("style")).map((el) => el.textContent).join("");
    expect(css).toContain("[data-store-accent]{--color-primary:#c2410c");
    expect(css).toContain(".dark [data-store-accent]{--color-primary:#fb923c");
    // The fill draws with the accent's class, not the old green.
    expect((bar.querySelector("div") as HTMLElement).className).toContain("bg-primary");
  });

  it("stands for a fill left to the theme in the contrast check", async () => {
    Object.assign(workspaceMock, { currentWorkspace: { ...testWorkspace, defaultCurrency: "EGP", settings: {}, themeSettings: { primaryColor: "#ffe066" } } });
    open({ ...SAVED, appearance: { mode: "custom", custom: { ...CART_REWARDS_INHERITED_LOOK, trackColor: "#ffffff" } } });
    const alert = await screen.findByText("These colors are too close to tell apart");
    expect(alert.closest("[role='alert']")?.textContent).toMatch(/The fill #FFE066 \(store theme\) and the track #FFFFFF/);
  });
});

describe("customize", () => {
  it("starts from the store's look, then applies each choice to the preview", async () => {
    const { user } = open();
    await user.click(await screen.findByRole("radio", { name: "Customize" }));
    expect(controls()).not.toBeDisabled();
    expect(within(controls()).getByRole("radio", { name: "Thick bar" })).toBeChecked();
    await user.click(within(controls()).getByRole("radio", { name: "Segmented" }));
    await user.click(within(controls()).getByRole("radio", { name: "Rounded square" }));
    await user.click(within(controls()).getByRole("radio", { name: "Large" }));
    const preview = (await screen.findByRole("progressbar", { name: "Rewards progress" })).parentElement as HTMLElement;
    expect(preview.getAttribute("data-bar-shape")).toBe("segmented");
    expect(preview.querySelector(".rounded-lg.h-9")).not.toBeNull();
  });

  it("keeps the custom values when going back to the store style, and finds them again", async () => {
    const { user, calls } = open({ ...SAVED, appearance: { mode: "custom", custom: CUSTOM } });
    expect(await screen.findByRole("radio", { name: "Customize" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Match the store style" }));
    save();
    await waitFor(() => expect(callsTo(calls, "PUT", URL)).toHaveLength(1));
    expect(putBody(calls).appearance).toEqual({ mode: "inherit", custom: CUSTOM });
    await user.click(screen.getByRole("radio", { name: "Customize" }));
    expect(within(controls()).getByRole("radio", { name: "Segmented" })).toBeChecked();
  });

  it("names colours that do not read apart, will not save them, and the auto-fix makes them pass", async () => {
    const { user, calls } = open({ ...SAVED, appearance: { mode: "custom", custom: { ...CART_REWARDS_INHERITED_LOOK, fillColor: "#e0e0e0", trackColor: "#eeeeee" } } });
    const alert = await screen.findByText("These colors are too close to tell apart");
    expect(alert.closest("[role='alert']")?.textContent).toMatch(/The fill #E0E0E0 and the track #EEEEEE: 1\.\d+:1, needs at least 3:1/);
    await user.click(screen.getByRole("switch", { name: /Show the amount under each marker/ }));
    save();
    expect(await screen.findByText(/custom colors need a fix before saving/)).toBeInTheDocument();
    expect(callsTo(calls, "PUT", URL)).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Auto-fix the color" }));
    expect(screen.queryByText("These colors are too close to tell apart")).toBeNull();
    save();
    await waitFor(() => expect(callsTo(calls, "PUT", URL)).toHaveLength(1));
  });

  it("does not check the colours while the store style is used", async () => {
    const { user, calls } = open({ ...SAVED, appearance: { mode: "inherit", custom: { ...CART_REWARDS_INHERITED_LOOK, fillColor: "#e0e0e0", trackColor: "#eeeeee" } } });
    await screen.findByRole("radio", { name: "Match the store style" });
    expect(screen.queryByText("These colors are too close to tell apart")).toBeNull();
    await user.click(screen.getByRole("switch", { name: /Combine with coupon codes/ }));
    save();
    await waitFor(() => expect(callsTo(calls, "PUT", URL)).toHaveLength(1));
  });

  it("refuses a colour that is not a #rrggbb", async () => {
    const { user, calls } = open({ ...SAVED, appearance: { mode: "custom", custom: CUSTOM } });
    const hex = await screen.findByRole("textbox", { name: "Fill color: hex value" });
    await user.clear(hex);
    await user.type(hex, "blue");
    expect(screen.getByText(/Enter a color as # and six hex digits/)).toBeInTheDocument();
    // The last valid colour stays in the look; the box says what is wrong.
    await user.click(screen.getByRole("switch", { name: /Show the amount under each marker/ }));
    save();
    await waitFor(() => expect(callsTo(calls, "PUT", URL)).toHaveLength(1));
    expect((putBody(calls).appearance as { custom: { fillColor: string } }).custom.fillColor).toBe("#1d4ed8");
  });

  it("reset asks first, then goes back to the store style with nothing custom", async () => {
    const { user, calls } = open({ ...SAVED, appearance: { mode: "custom", custom: CUSTOM } });
    await user.click(await screen.findByRole("button", { name: "Reset to default" }));
    const dialog = await screen.findByRole("dialog", { name: "Reset the bar to the store style?" });
    await user.click(within(dialog).getByRole("button", { name: "Reset" }));
    expect(screen.getByRole("radio", { name: "Match the store style" })).toBeChecked();
    save();
    await waitFor(() => expect(callsTo(calls, "PUT", URL)).toHaveLength(1));
    expect(putBody(calls).appearance).toEqual({ mode: "inherit", custom: null });
  });
});

describe("each reward's icon", () => {
  it("defaults by kind, and the merchant picks another, kept with the reward in either style", async () => {
    const { user, calls } = open();
    await screen.findByText("Reward 1");
    expect(screen.getAllByRole("radio", { name: "By its kind (Truck)" })[0]).toBeChecked();
    expect(screen.getAllByRole("radio", { name: "Crown" })[1]).toBeChecked();
    await user.click(screen.getAllByRole("radio", { name: "Gift" })[0]);
    // The preview's marker follows.
    expect(document.querySelector('[role="progressbar"] ~ span [data-reward-icon="gift"]')).not.toBeNull();
    save();
    await waitFor(() => expect(callsTo(calls, "PUT", URL)).toHaveLength(1));
    expect(putBody(calls).tiers.map((t) => t.icon)).toEqual(["gift", "crown"]);
  });
});

describe("in Arabic", () => {
  it("labels every control, and the preview fills from the start side", async () => {
    const { user } = open({ ...SAVED, appearance: { mode: "custom", custom: CUSTOM } }, "ar");
    expect(await screen.findByRole("radio", { name: "مطابقة نمط المتجر" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "مقسّم" })).toBeChecked();
    expect(screen.getByRole("textbox", { name: "لون الامتلاء: قيمة اللون" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "العربية" }));
    const bar = await screen.findByRole("progressbar", { name: "التقدم نحو المكافآت" });
    expect(bar.closest("[dir]")).toHaveAttribute("dir", "rtl");
    expect((bar.querySelector("[data-segment] > span") as HTMLElement).className).toContain("rtl:origin-right");
  });
});
