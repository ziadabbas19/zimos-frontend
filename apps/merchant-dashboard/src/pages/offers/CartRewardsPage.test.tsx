import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { cartRewardsValidate, type CartRewardsSettings } from "@store-builder/api-client";
import { testWorkspace, workspaceMock } from "@/test/mocks";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { CartRewardsPage } from "./CartRewardsPage";
import { draftOf, payloadOf } from "./cartRewardsForm";
import { OffersPage } from "./OffersPage";

// This file runs with cart rewards switched on.
vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  CART_REWARDS_ENABLED: true,
}));

const SAVED: CartRewardsSettings = {
  enabled: true,
  allowCouponStacking: false,
  currency: "EGP",
  tiers: [
    { thresholdAmount: 50000, type: "free_shipping", label: null, autoLabel: { en: "Free shipping", ar: "شحن مجاني" } },
    { thresholdAmount: 100000, type: "percent", value: 5, label: null, autoLabel: { en: "5% off", ar: "خصم 5%" } },
  ],
  trustItems: [{ text: { ar: "الدفع عند الاستلام", en: "Cash on delivery" }, enabled: true }],
};

const URL = "/workspaces/ws_1/cart-rewards";

beforeEach(() => {
  Object.assign(workspaceMock, { currentWorkspace: { ...testWorkspace, defaultCurrency: "EGP", settings: {} } });
});

const field = (name: RegExp, scope: HTMLElement = document.body) => within(scope).getAllByLabelText(name)[0] as HTMLInputElement;
const tierCards = () => screen.getAllByText(/^Reward \d$/).map((title) => title.closest("li") as HTMLElement);

describe("the checks the form makes before saving (the server's own)", () => {
  const payload = (tiers: Parameters<typeof cartRewardsValidate>[0]["tiers"], extra = {}) =>
    cartRewardsValidate({ enabled: true, allowCouponStacking: false, tiers, trustItems: [], ...extra });

  it("accepts rising thresholds per kind, and a discount and free shipping on the same threshold", () => {
    expect(payload([{ thresholdAmount: 50000, type: "free_shipping" }, { thresholdAmount: 50000, type: "percent", value: 5 }, { thresholdAmount: 90000, type: "fixed", value: 1000 }])).toEqual({});
  });

  it("refuses a threshold that does not rise within its kind, in the order listed", () => {
    expect(payload([{ thresholdAmount: 90000, type: "percent", value: 10 }, { thresholdAmount: 50000, type: "fixed", value: 500 }])).toEqual({ "tiers.1.thresholdAmount": "notRising" });
    expect(payload([{ thresholdAmount: 1000, type: "free_shipping" }, { thresholdAmount: 1000, type: "free_shipping" }])).toEqual({ "tiers.1.thresholdAmount": "notRising" });
  });

  it("refuses a bad percent, a missing amount, a zero threshold, too many tiers and an empty trust line", () => {
    expect(payload([{ thresholdAmount: 1000, type: "percent", value: 101 }])).toEqual({ "tiers.0.value": "percent" });
    expect(payload([{ thresholdAmount: 1000, type: "percent", value: 2.5 }])).toEqual({ "tiers.0.value": "percent" });
    expect(payload([{ thresholdAmount: 1000, type: "fixed", value: NaN }])).toEqual({ "tiers.0.value": "amount" });
    expect(payload([{ thresholdAmount: 0, type: "free_shipping" }])).toEqual({ "tiers.0.thresholdAmount": "threshold" });
    const seven = Array.from({ length: 7 }, (_, i) => ({ thresholdAmount: (i + 1) * 100, type: "fixed" as const, value: i + 1 }));
    expect(payload(seven)).toEqual({ tiers: "tooMany" });
    expect(payload([])).toEqual({ tiers: "noTiers" });
    expect(cartRewardsValidate({ enabled: false, allowCouponStacking: false, tiers: [], trustItems: [] })).toEqual({});
    expect(payload([{ thresholdAmount: 1000, type: "free_shipping" }], { trustItems: [{ text: { ar: " ", en: "" }, enabled: true }] })).toEqual({ "trustItems.0.text": "trustText" });
  });

  it("turns the saved settings into the form and back without change", () => {
    expect(payloadOf(draftOf(SAVED))).toEqual({
      enabled: true,
      allowCouponStacking: false,
      tiers: [
        { thresholdAmount: 50000, type: "free_shipping", label: null, icon: null },
        { thresholdAmount: 100000, type: "percent", value: 5, label: null, icon: null },
      ],
      trustItems: [{ text: { ar: "الدفع عند الاستلام", en: "Cash on delivery" }, enabled: true }],
      // An API from before the bar's look: the store's style, nothing custom.
      appearance: { mode: "inherit", custom: null },
    });
  });
});

describe("the page", () => {
  it("shows the saved rewards, refuses a falling threshold with its message, and saves the fixed one", async () => {
    const calls = fakeBackend({
      "GET /plan-features": { planFeatures: { features: [], enforced: false } },
      [`GET ${URL}`]: { cartRewards: SAVED },
      [`PUT ${URL}`]: { cartRewards: SAVED },
    });
    renderWithProviders(<CartRewardsPage />, { route: "/offers/cart-rewards" });
    await screen.findByText("Reward 2");

    // A third reward, a discount under the 5% one's threshold: discounts must rise in the order listed.
    fireEvent.click(screen.getByRole("button", { name: "Add a reward" }));
    const third = tierCards()[2];
    fireEvent.change(field(/When the cart reaches/, third), { target: { value: "800" } });
    fireEvent.change(field(/Percent off/, third), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save/ }));
    expect(await screen.findByText("Must be higher than the threshold before it for the same kind of reward.")).toBeInTheDocument();
    expect(callsTo(calls, "PUT", URL)).toHaveLength(0);

    fireEvent.change(field(/When the cart reaches/, third), { target: { value: "2000" } });
    fireEvent.change(field(/Percent off/, third), { target: { value: "150" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save/ }));
    expect(await screen.findByText("A whole percent from 1 to 100.")).toBeInTheDocument();
    expect(callsTo(calls, "PUT", URL)).toHaveLength(0);

    fireEvent.change(field(/Percent off/, third), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save/ }));
    await waitFor(() => expect(callsTo(calls, "PUT", URL)).toHaveLength(1));
    expect(callsTo(calls, "PUT", URL)[0].body).toEqual({
      enabled: true,
      allowCouponStacking: false,
      tiers: [
        { thresholdAmount: 50000, type: "free_shipping", label: null, icon: null },
        { thresholdAmount: 100000, type: "percent", value: 5, label: null, icon: null },
        { thresholdAmount: 200000, type: "percent", value: 10, label: null, icon: null },
      ],
      trustItems: [{ text: { ar: "الدفع عند الاستلام", en: "Cash on delivery" }, enabled: true }],
      appearance: { mode: "inherit", custom: null },
    });
  });

  it("shows the shoppers' bar in the preview, in the language chosen for it", async () => {
    fakeBackend({ "GET /plan-features": { planFeatures: { features: [], enforced: false } }, [`GET ${URL}`]: { cartRewards: SAVED } });
    renderWithProviders(<CartRewardsPage />, { route: "/offers/cart-rewards" });
    const bar = await screen.findByRole("progressbar", { name: "Rewards progress" });
    // The slider starts half way along: 600 of 1,200.
    expect(bar.getAttribute("aria-valuetext")).toMatch(/^Free shipping applied automatically, EGP\s400(\.00)? more for 5% off$/);
    fireEvent.click(screen.getByRole("radio", { name: "العربية" }));
    const arabic = await screen.findByRole("progressbar", { name: "التقدم نحو المكافآت" });
    expect(arabic.closest("[dir]")).toHaveAttribute("dir", "rtl");
    expect(arabic.getAttribute("aria-valuetext")).toContain("شحن مجاني اتطبّق تلقائيًا");
  });

  it("names the plan when the store's plan lacks cart rewards", async () => {
    fakeBackend({ "GET /plan-features": { planFeatures: { features: [], enforced: true, growthEnforced: true } } });
    renderWithProviders(<CartRewardsPage />, { route: "/offers/cart-rewards" });
    expect(await screen.findByText("Your plan doesn't include Cart rewards. Upgrade your plan to use it.")).toBeInTheDocument();
    expect(screen.queryByText("Rewards")).not.toBeInTheDocument();
  });

  it("is a card on the offers hub, unless the plan lacks it", async () => {
    fakeBackend({ "GET /plan-features": { planFeatures: { features: ["cart_rewards"], enforced: true, growthEnforced: true } } });
    const view = renderWithProviders(<OffersPage />, { route: "/offers" });
    expect(await screen.findByRole("link", { name: /Cart rewards/ })).toHaveAttribute("href", "/offers/cart-rewards");
    view.unmount();
    fakeBackend({ "GET /plan-features": { planFeatures: { features: [], enforced: true, growthEnforced: true } } });
    renderWithProviders(<OffersPage />, { route: "/offers" });
    await waitFor(() => expect(screen.queryByRole("link", { name: /Cart rewards/ })).not.toBeInTheDocument());
  });
});
