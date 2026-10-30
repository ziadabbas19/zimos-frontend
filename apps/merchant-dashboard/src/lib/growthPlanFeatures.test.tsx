import { beforeEach, describe, expect, it } from "vitest";
import { renderHook, screen, waitFor, within } from "@testing-library/react";
import { ApiError, planFeatureGated, type Discount } from "@store-builder/api-client";
import { api, fake, testWorkspace, workspaceMock } from "@/test/mocks";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { visibleNavItems } from "@/components/shell/SidebarNav";
import { NAV_GROUPS } from "@/lib/navigation";
import { refreshWorkCounts, useWorkCounts } from "@/lib/workCounts";
import { GALLERY_TYPES, LIBRARY_PRESETS, offeredPresets } from "@/pages/website/editor/library/purposes";
import { ReviewsPage } from "@/pages/reviews/ReviewsPage";
import { CombosPage } from "@/pages/offers/CombosPage";
import { DiscountsPage } from "@/pages/discounts/DiscountsPage";

/**
 * reviews, about_gallery, combos and advanced_coupons as plan features
 * (GET /plan-features `growthEnforced`, backend GROWTH_REQUIRE_PLAN_FEATURE):
 * hidden from a store whose plan lacks them while the server refuses them,
 * and never hidden by an API that doesn't send the switch.
 */

const LOCKED = { planFeatures: { features: [], enforced: true, growthEnforced: true } };

beforeEach(() => {
  Object.assign(workspaceMock, { currentWorkspace: { ...testWorkspace, slug: "nile", defaultCurrency: "EGP", settings: {} } });
});

describe("which keys are locked", () => {
  it("the four only with growthEnforced; the older keys as before", () => {
    const state = { features: [], enforced: true };
    expect(planFeatureGated(state, "reviews")).toBe(false);
    expect(planFeatureGated({ ...state, growthEnforced: true }, "reviews")).toBe(true);
    expect(planFeatureGated({ ...state, growthEnforced: true, features: ["reviews"] }, "reviews")).toBe(false);
    expect(planFeatureGated({ ...state, enforced: false, growthEnforced: true }, "advanced_coupons")).toBe(false);
    expect(planFeatureGated(state, "api_access")).toBe(true);
  });

  it("leaves the reviews entry out of the menu, and the gallery out of the block library", () => {
    const group = NAV_GROUPS.find((g) => g.items.some((item) => item.key === "reviews"))!;
    expect(visibleNavItems(group, undefined).map((item) => item.key)).toContain("reviews");
    expect(visibleNavItems(group, undefined, undefined, (feature) => feature === "reviews").map((item) => item.key)).not.toContain("reviews");

    expect(offeredPresets(LIBRARY_PRESETS, false).some((preset) => preset.elements.includes("story_gallery"))).toBe(true);
    expect(offeredPresets(LIBRARY_PRESETS, false, GALLERY_TYPES).some((preset) => preset.elements.includes("story_gallery"))).toBe(false);
  });
});

describe("the waiting-reviews badge", () => {
  it("stops asking once the plan refuses it", async () => {
    const refused = new ApiError("Your plan doesn't include Product and store reviews. Upgrade your plan to use it.", 403, "PLAN_FEATURE_REQUIRED", {});
    const calls = fakeBackend({ "GET /workspaces/ws_9/reviews/summary": refused, "GET /workspaces/ws_9/inbox/conversations": { conversations: [], nextCursor: null } });
    api.getConfirmationQueueCounts.mockResolvedValue(fake({ dueNow: 0 }));
    api.getOrderPipeline.mockResolvedValue(fake({}));
    renderHook(() => useWorkCounts("ws_9"));
    await waitFor(() => expect(callsTo(calls, "GET", "/reviews/summary")).toHaveLength(1));
    refreshWorkCounts();
    await waitFor(() => expect(api.getConfirmationQueueCounts.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(callsTo(calls, "GET", "/reviews/summary")).toHaveLength(1);
  });
});

describe("pages of a store without the key", () => {
  it("reviews: the page names the feature and points to the plans", async () => {
    fakeBackend({ "GET /workspaces/ws_1/plan-features": LOCKED });
    api.listReviews.mockResolvedValue([]);
    renderWithProviders(<ReviewsPage />, { route: "/reviews" });
    expect(await screen.findByText("Your plan doesn't include Product and store reviews. Upgrade your plan to use it.")).toBeInTheDocument();
    expect(screen.getByText("See the plans").closest("a")).toHaveAttribute("href", "/subscription");
    expect(screen.queryByRole("button", { name: /Add a review/ })).not.toBeInTheDocument();
  });

  it("combos: the page names the feature", async () => {
    fakeBackend({ "GET /workspaces/ws_1/plan-features": LOCKED, "GET /workspaces/ws_1/combos": { combos: [] } });
    renderWithProviders(<CombosPage />, { route: "/offers/combos" });
    expect(await screen.findByText("Your plan doesn't include Product combos. Upgrade your plan to use it.")).toBeInTheDocument();
  });

  it("coupons: a plain coupon without the controls, and none of them sent", async () => {
    fakeBackend({ "GET /workspaces/ws_1/plan-features": LOCKED });
    api.listDiscounts.mockResolvedValue([]);
    api.listProducts.mockResolvedValue(fake({ products: [], nextCursor: null }));
    api.listCollections.mockResolvedValue([]);
    api.createDiscount.mockResolvedValue(fake<Discount>({ id: "d9", code: "PLAIN", type: "percentage", value: "1000", status: "active" }));
    const { user } = renderWithProviders(<DiscountsPage />, { route: "/discounts" });

    await user.click(await screen.findByRole("button", { name: "New code" }));
    const dialog = await screen.findByRole("dialog", { name: "New discount" });
    await waitFor(() => expect(within(dialog).queryByText("For whom")).not.toBeInTheDocument());
    expect(within(dialog).queryByLabelText(/^Minimum quantity/)).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/^Code/), "plain");
    await user.type(within(dialog).getByLabelText(/^Percentage/), "10");
    await user.click(within(dialog).getByRole("button", { name: "Create discount" }));

    await waitFor(() => expect(api.createDiscount).toHaveBeenCalledTimes(1));
    const payload = api.createDiscount.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).toMatchObject({ code: "PLAIN", type: "percentage", value: 1000 });
    for (const key of ["audience", "customerPhones", "vipTierIds", "schedule", "maxDiscountAmount", "minQuantity", "excludedProductIds", "appliesToShipping", "appliesToDiscounted", "combinesWithOffers", "strictCustomerLimit"]) {
      expect(payload).not.toHaveProperty(key);
    }
  });
});
