import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { SubscriptionPlan, SubscriptionPlans, Workspace, WorkspaceBilling } from "@store-builder/api-client";
import { api, fake, testWorkspace, workspaceMock } from "@/test/mocks";
import { currentPath, renderWithProviders } from "@/test/renderWithProviders";
import { WorkspacePickerPage } from "./WorkspacePickerPage";

/**
 * The store setup: no referral code any more (a discount code is entered on
 * the plans), "what does your store sell?" as one optional tap, then the
 * plans with "Explore first, decide later".
 */

const price = (gross: number) => ({ gross, discount: 0, net: gross });
const card = (overrides: Partial<SubscriptionPlan> = {}) =>
  fake<SubscriptionPlan>({
    id: "plan_basic",
    name: "Basic",
    currency: "EGP",
    monthlyPrice: 30000,
    yearlyPrice: 300000,
    trialDays: 14,
    maxStores: 1,
    maxFunnelsPerMonth: 5,
    softOrderQuota: null,
    features: [],
    isCurrent: false,
    isPublic: true,
    prices: { monthly: price(30000), yearly: price(300000) },
    ...overrides,
  });
const plansView = fake<SubscriptionPlans>({
  subscription: { status: "draft", billingCycle: "monthly", planId: "plan_basic", trialEndsAt: null, currentPeriodEnd: null, draft: true },
  trial: { available: true, used: false },
  planChange: "immediate",
  referralCode: null,
  plans: [card(), card({ id: "plan_pro", name: "Pro", monthlyPrice: 80000, yearlyPrice: 800000, prices: { monthly: price(80000), yearly: price(800000) } })],
});

function setUp(locale?: "ar") {
  workspaceMock.workspaces = [];
  api.getSignupOptions.mockResolvedValue(fake({}));
  api.listPublicPlans.mockResolvedValue([]);
  api.checkWorkspaceSlug.mockResolvedValue(fake({ available: true }));
  api.getWorkspaceAccess.mockResolvedValue(fake({ draft: true }));
  api.getWorkspaceBilling.mockResolvedValue(fake<WorkspaceBilling>({ subscription: { status: "draft", billingCycle: "monthly", plan: null }, nextCharge: null, limits: null }));
  return renderWithProviders(<WorkspacePickerPage />, { route: "/workspaces", locale });
}

async function create(name = "Nile Shop") {
  fireEvent.change(await screen.findByLabelText("Store name"), { target: { value: name } });
  const button = screen.getByRole("button", { name: "Create store" });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  await waitFor(() => expect(workspaceMock.createWorkspace).toHaveBeenCalled());
}

describe("the store setup", () => {
  it("has no referral code, in either language", async () => {
    setUp();
    await screen.findByLabelText("Store name");
    expect(screen.queryByText(/referral/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/code/i)).not.toBeInTheDocument();
  });

  it("has no referral code in Arabic either, and asks what the store sells", async () => {
    setUp("ar");
    expect(await screen.findByRole("group", { name: "ماذا يبيع متجرك؟" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/إحالة/);
    // The address field speaks Arabic too, and the address itself stays left to right.
    const address = screen.getByLabelText("عنوان المتجر");
    expect(address.closest("[dir]")).toHaveAttribute("dir", "ltr");
  });

  it("sends the business type picked with one tap, and nothing when skipped", async () => {
    setUp();
    const group = await screen.findByRole("group", { name: "What does your store sell?" });
    const tiles = within(group).getAllByRole("radio");
    expect(tiles).toHaveLength(10);
    fireEvent.click(within(group).getByRole("radio", { name: "Beauty & care" }));
    await create();
    expect(workspaceMock.createWorkspace).toHaveBeenCalledWith("Nile Shop", "nile-shop", {
      plan: undefined,
      businessType: "beauty",
      businessTypeOther: null,
    });
  });

  it("opens a short text for Other and sends it", async () => {
    setUp();
    const group = await screen.findByRole("group", { name: "What does your store sell?" });
    expect(screen.queryByLabelText("What do you sell?")).not.toBeInTheDocument();
    fireEvent.click(within(group).getByRole("radio", { name: "Other" }));
    fireEvent.change(screen.getByLabelText("What do you sell?"), { target: { value: " handmade candles " } });
    await create();
    expect(workspaceMock.createWorkspace).toHaveBeenCalledWith("Nile Shop", "nile-shop", {
      plan: undefined,
      businessType: "other",
      businessTypeOther: "handmade candles",
    });
  });
});

describe("the plans after the store is made", () => {
  it("shows the store's real plans without trial wording, with a discount code field, and Explore first goes to the dashboard", async () => {
    api.getSubscriptionPlans.mockResolvedValue(plansView);
    workspaceMock.createWorkspace.mockResolvedValue({ workspace: fake<Workspace>({ ...testWorkspace, slug: "nile-shop" }) });
    setUp();
    await create();

    const basic = await screen.findByRole("article", { name: "Basic" });
    expect(screen.getByRole("article", { name: "Pro" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Choose your plan" })).toBeInTheDocument();
    // The same action as My Plan, without the trial's length (or any trial note).
    expect(within(basic).getByRole("button", { name: "Start with this plan" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/14|trial/i);
    // The discount code goes in on the plans, as on My Plan.
    expect(within(basic).getByRole("button", { name: "Check" })).toBeInTheDocument();

    const explore = screen.getAllByRole("button", { name: "Explore first, decide later" });
    expect(explore.length).toBeGreaterThan(0);
    fireEvent.click(explore[0]);
    expect(workspaceMock.selectWorkspace).toHaveBeenCalledWith(testWorkspace.id);
    await waitFor(() => expect(currentPath()).toBe("/"));
  });

  it("says when the plans can't load, offers a retry, and still lets the merchant go on", async () => {
    api.getSubscriptionPlans.mockRejectedValue(new Error("network"));
    setUp();
    await create();

    expect(await screen.findByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Explore first, decide later" })).toBeInTheDocument();
  });
});
