import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type {
  MerchantReferralCode,
  PlanSwitchPreview,
  PlanSwitchSummary,
  ReferralSchedulePayment,
  SubscriptionPlan,
  SubscriptionPlans,
  Workspace,
  WorkspaceBilling,
} from "@store-builder/api-client";
import { ApiError } from "@store-builder/api-client";
import { api, fake, workspaceMock } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SubscriptionPage } from "./SubscriptionPage";

// A paid store entering a referral code (migration 725, REFERRAL_CODES_V2_ENABLED):
// in the plan change's dialog (the payment it applies to, before and after,
// sent with the confirmation) and on its current plan's card, with the
// server's refusals worded beside the field. Without `referralCodeEntry` the
// page is as before.

const plan = (id: string, name: string, monthly: number, extra: Partial<SubscriptionPlan> = {}) =>
  fake<SubscriptionPlan>({
    id,
    name,
    currency: "EGP",
    monthlyPrice: monthly,
    yearlyPrice: monthly * 10,
    trialDays: 14,
    maxStores: 1,
    maxFunnelsPerMonth: 5,
    softOrderQuota: null,
    features: [],
    isCurrent: false,
    isPublic: true,
    prices: { monthly: { gross: monthly, discount: 0, net: monthly }, yearly: { gross: monthly * 10, discount: 0, net: monthly * 10 } },
    ...extra,
  });

const billing = fake<WorkspaceBilling>({
  subscription: {
    status: "active",
    billingCycle: "monthly",
    trialEndsAt: null,
    currentPeriodStart: "2030-01-01T00:00:00Z",
    currentPeriodEnd: "2030-02-01T00:00:00Z",
    plan: { id: "plan_starter", name: "Starter", currency: "EGP", monthlyPrice: 30000, yearlyPrice: 300000 },
  },
  referralCode: null,
  nextCharge: { grossAmount: 30000, discountAmount: 0, amount: 30000, currency: "EGP" },
  limits: { stores: { used: 1, max: 2 }, funnelsThisMonth: { used: 0, max: 5, resetsAt: "2030-02-01" } },
  draft: false,
});

const ON: PlanSwitchSummary = { enabled: true, mode: "switch", reason: null, open: null };

function setup({ entry = true }: { entry?: boolean } = {}) {
  workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", role: "owner" });
  const view = fake<SubscriptionPlans>({
    subscription: { status: "active", billingCycle: "monthly", planId: "plan_starter", trialEndsAt: null, currentPeriodEnd: "2030-02-01T00:00:00Z", draft: false },
    trial: { available: false, used: true },
    planChange: "support",
    referralCode: null,
    plans: [plan("plan_starter", "Starter", 30000, { isCurrent: true }), plan("plan_pro", "Pro", 60000)],
    payPerOrder: { available: false, current: false, plan: null },
    move: null,
    planSwitch: ON,
    ...(entry ? { referralCodeEntry: { enabled: true } } : {}),
  });
  api.getWorkspaceBilling.mockResolvedValue(billing);
  api.getSubscriptionPlans.mockResolvedValue(view);
  api.listBillingInvoices.mockResolvedValue({ invoices: [], page: 1, pageSize: 10, total: 0 });
  return renderWithProviders(<SubscriptionPage />, { route: "/subscription", path: "/subscription" });
}

const cardOf = async (name: string) => (await screen.findByRole("heading", { name })).closest("article")!;

const CODE = fake<MerchantReferralCode>({
  code: "UPGRADE50",
  discountType: "none",
  discountValue: null,
  discountCurrency: null,
  active: true,
  discountSchedule: { monthly: [{ count: 1, type: "percentage", value: 5000 }], yearly: [] },
});

const schedule: ReferralSchedulePayment[] = [
  { paymentNo: 1, listPrice: 60000, discount: 30000, merchantPays: 30000 },
  { paymentNo: 2, listPrice: 60000, discount: 0, merchantPays: 60000 },
  { paymentNo: 3, listPrice: 60000, discount: 0, merchantPays: 60000 },
];

const upgrade = (withCode: boolean): PlanSwitchPreview =>
  fake<PlanSwitchPreview>({
    kind: "upgrade",
    reason: null,
    effective: "on_payment",
    effectiveAt: null,
    from: { planId: "plan_starter", planName: "Starter", billingCycle: "monthly", currency: "EGP" },
    to: { planId: "plan_pro", planName: "Pro", billingCycle: "monthly", currency: "EGP" },
    amountDue: 60000,
    currency: "EGP",
    proration: null,
    trial: false,
    nextRenewal: { at: null, amount: 60000, currency: "EGP", billingCycle: "monthly" },
    payable: true,
    blockedBy: null,
    replaces: null,
    ...(withCode ? { referralCode: { code: CODE, appliesTo: "charge_now", before: 60000, after: 30000, currency: "EGP", schedule: { monthly: schedule, yearly: schedule } } } : {}),
  });

describe("a code entered with a plan change", () => {
  it("previews the payment before and after, then sends the code and the price after it", async () => {
    const { user } = setup();
    api.previewPlanSwitch.mockImplementation(async (_ws, payload) => ({ preview: upgrade(Boolean(payload.referralCode)) }));
    api.startPlanSwitch.mockResolvedValue(fake({ kind: "upgrade", created: true, changed: false, switch: null, invoice: null, plans: await api.getSubscriptionPlans("ws_1") }));

    await user.click(within(await cardOf("Pro")).getByRole("button", { name: "Switch to this plan" }));
    const dialog = await screen.findByRole("dialog", { name: "Switch to Pro" });
    await user.type(await within(dialog).findByLabelText("Discount code"), "upgrade50");
    await user.click(within(dialog).getByRole("button", { name: "Check" }));

    await waitFor(() =>
      expect(api.previewPlanSwitch).toHaveBeenLastCalledWith("ws_1", { planId: "plan_pro", billingCycle: "monthly", referralCode: "UPGRADE50" })
    );
    expect(await within(dialog).findByText(/With UPGRADE50: .*300/)).toBeInTheDocument();
    expect(within(dialog).getByText("This payment")).toBeInTheDocument();
    // The schedule: the discounted payment and the first one back at the full price.
    expect(within(dialog).getByRole("columnheader", { name: "You pay" })).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: /Switch and pay/ }));
    await waitFor(() =>
      expect(api.startPlanSwitch).toHaveBeenCalledWith("ws_1", expect.objectContaining({ planId: "plan_pro", referralCode: "UPGRADE50", expectedAmount: 30000 }))
    );
  });

  it("a refused code is told beside the field and the change stays as it was", async () => {
    const { user } = setup();
    api.previewPlanSwitch.mockImplementation(async (_ws, payload) => {
      if (payload.referralCode) throw new ApiError("new only", 422, "REFERRAL_CODE_NEW_MERCHANTS_ONLY");
      return { preview: upgrade(false) };
    });
    await user.click(within(await cardOf("Pro")).getByRole("button", { name: "Switch to this plan" }));
    const dialog = await screen.findByRole("dialog", { name: "Switch to Pro" });
    await user.type(await within(dialog).findByLabelText("Discount code"), "NEWBIE");
    await user.click(within(dialog).getByRole("button", { name: "Check" }));
    expect(await within(dialog).findByText("This code is for new merchants only.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Switch and pay/ })).toBeEnabled();
  });

  it("without the server's referralCodeEntry, no code field: the dialog as before", async () => {
    const { user } = setup({ entry: false });
    api.previewPlanSwitch.mockResolvedValue({ preview: upgrade(false) });
    await user.click(within(await cardOf("Pro")).getByRole("button", { name: "Switch to this plan" }));
    const dialog = await screen.findByRole("dialog", { name: "Switch to Pro" });
    await within(dialog).findByRole("button", { name: /Switch and pay/ });
    expect(within(dialog).queryByLabelText("Discount code")).not.toBeInTheDocument();
    expect(within(await cardOf("Starter")).queryByRole("button", { name: "Check" })).not.toBeInTheDocument();
  });
});

describe("a code on the current plan's card", () => {
  it("is judged against that plan and cycle, and shows its first payments", async () => {
    const { user } = setup();
    api.previewReferralCode.mockResolvedValue({
      code: CODE,
      plans: [{ planId: "plan_starter", prices: { monthly: { gross: 30000, discount: 15000, net: 15000 }, yearly: { gross: 300000, discount: 0, net: 300000 } }, schedule: { monthly: schedule, yearly: [] } }],
    });
    const card = await cardOf("Starter");
    await user.type(within(card).getByRole("textbox"), "upgrade50");
    await user.click(within(card).getByRole("button", { name: "Check" }));
    await waitFor(() => expect(api.previewReferralCode).toHaveBeenCalledWith("ws_1", "UPGRADE50", { planId: "plan_starter", billingCycle: "monthly" }));
    expect(await within(card).findByRole("columnheader", { name: "You pay" })).toBeInTheDocument();
    // The discounted payment and the first one back at the full price; header row included.
    expect(within(card).getAllByRole("row")).toHaveLength(3);
  });
});
