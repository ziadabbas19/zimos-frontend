import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type {
  MerchantInvoice,
  PlanSwitch,
  PlanSwitchPreview,
  PlanSwitchSummary,
  SubscriptionPlan,
  SubscriptionPlans,
  Workspace,
  WorkspaceBilling,
} from "@store-builder/api-client";
import { ApiError } from "@store-builder/api-client";
import { api, fake, workspaceMock } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SubscriptionPage } from "./SubscriptionPage";
import { PLAN_SWITCH_STRINGS } from "./planSwitchStrings";

// A paid store changing plan by itself (the backend's /billing/plan-switch,
// PLAN_SWITCH_ENABLED): the switch button on each card, the confirmation
// with the server's preview, the banner of the switch waiting, and today's
// "Contact support" page while the server says so.

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

function setup(planSwitch?: PlanSwitchSummary, { locale = "en" as "en" | "ar", view: extraView = {} as Partial<SubscriptionPlans> } = {}) {
  workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", role: "owner" });
  const view = fake<SubscriptionPlans>({
    subscription: { status: "active", billingCycle: "monthly", planId: "plan_starter", trialEndsAt: null, currentPeriodEnd: "2030-02-01T00:00:00Z", draft: false },
    trial: { available: false, used: true },
    planChange: "support",
    referralCode: null,
    plans: [plan("plan_basic", "Basic", 15000), plan("plan_starter", "Starter", 30000, { isCurrent: true }), plan("plan_pro", "Pro", 60000)],
    payPerOrder: { available: false, current: false, plan: null },
    move: null,
    ...(planSwitch ? { planSwitch } : {}),
    ...extraView,
  });
  api.getWorkspaceBilling.mockResolvedValue(billing);
  api.getSubscriptionPlans.mockResolvedValue(view);
  api.listBillingInvoices.mockResolvedValue({ invoices: [], page: 1, pageSize: 10, total: 0 });
  return { ...renderWithProviders(<SubscriptionPage />, { route: "/subscription", path: "/subscription", locale }), view };
}

const cardOf = async (name: string) => (await screen.findByRole("heading", { name })).closest("article")!;

const upgrade = (overrides: Partial<PlanSwitchPreview> = {}): PlanSwitchPreview => ({
  kind: "upgrade",
  reason: null,
  effective: "on_payment",
  effectiveAt: null,
  from: { planId: "plan_starter", planName: "Starter", billingCycle: "monthly", currency: "EGP" },
  to: { planId: "plan_pro", planName: "Pro", billingCycle: "monthly", currency: "EGP" },
  amountDue: 14500,
  currency: "EGP",
  proration: { remainingDays: 15, cycleDays: 31, periodCycle: "monthly", standardPeriod: true, fromPrice: 30000, toPrice: 60000, difference: 30000, amount: 14500, currency: "EGP" },
  trial: false,
  nextRenewal: { at: "2030-02-01T00:00:00.000Z", amount: 60000, currency: "EGP", billingCycle: "monthly" },
  payable: true,
  blockedBy: null,
  replaces: null,
  ...overrides,
});

const downgrade = (): PlanSwitchPreview =>
  upgrade({
    kind: "scheduled",
    reason: "downgrade",
    effective: "period_end",
    effectiveAt: "2030-02-01T00:00:00.000Z",
    to: { planId: "plan_basic", planName: "Basic", billingCycle: "monthly", currency: "EGP" },
    amountDue: 0,
    proration: null,
    nextRenewal: { at: "2030-02-01T00:00:00.000Z", amount: 15000, currency: "EGP", billingCycle: "monthly" },
    payable: null,
  });

const openSwitch = (overrides: Partial<PlanSwitch> = {}): PlanSwitch => ({
  id: "sw_1",
  kind: "upgrade",
  status: "pending",
  from: { planId: "plan_starter", planName: "Starter", billingCycle: "monthly" },
  to: { planId: "plan_pro", planName: "Pro", billingCycle: "monthly" },
  effectiveAt: null,
  appliedAt: null,
  endedAt: null,
  endReason: null,
  invoiceId: "inv_1",
  amountDue: 14500,
  currency: "EGP",
  expiresAt: "2030-01-19T12:00:00.000Z",
  proration: { remainingDays: 15, cycleDays: 31, fromPrice: 30000, toPrice: 60000, amount: 14500, currency: "EGP" },
  createdAt: "2030-01-17T12:00:00.000Z",
  ...overrides,
});

describe("with the switch off, or support deciding: today's page", () => {
  it("an older API and PLAN_SWITCH_ENABLED off both show Contact support, the paid note and the billing cycle choice", async () => {
    for (const summary of [undefined, { enabled: false, mode: null, reason: null, open: null } satisfies PlanSwitchSummary]) {
      const { unmount } = setup(summary);
      expect(await screen.findByText("To switch plan while your paid subscription runs, contact Zimos support.")).toBeInTheDocument();
      expect(within(await cardOf("Pro")).getByRole("button", { name: "Contact support to switch" })).toHaveAttribute("href", "/support");
      expect(within(await cardOf("Basic")).getByRole("button", { name: "Contact support to switch" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Switch to this plan" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Plan change" })).not.toBeInTheDocument();
      expect(screen.getByText(/Annual — .* a year · Save$/)).toBeInTheDocument();
      expect(api.previewPlanSwitch).not.toHaveBeenCalled();
      unmount();
    }
  });

  it("support deciding says why, and keeps Contact support", async () => {
    setup({ enabled: true, mode: "support", reason: "MANUAL_PRICING", open: null });
    expect(await screen.findByText("Your plan's price was set by Zimos, so your plan is changed through Zimos support.")).toBeInTheDocument();
    expect(within(await cardOf("Pro")).getByRole("button", { name: "Contact support to switch" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Switch to this plan" })).not.toBeInTheDocument();
  });
});

/** An upgrade inside a paid period as the server sends it now: the full price now, or nothing until the period ends. */
const fullUpgrade = (overrides: Partial<PlanSwitchPreview> = {}): PlanSwitchPreview =>
  upgrade({
    reason: "upgrade",
    timing: "now",
    timings: ["now", "period_end"],
    amountDue: 60000,
    proration: null,
    currentPeriod: { endsAt: "2030-02-01T00:00:00.000Z", remainingDays: 15 },
    chargeExpiry: { hours: 48, expiresAt: "2030-01-19T12:00:00.000Z" },
    nextRenewal: { at: null, amount: 60000, currency: "EGP", billingCycle: "monthly" },
    options: {
      now: {
        effective: "on_payment",
        effectiveAt: null,
        amountDue: 60000,
        currency: "EGP",
        chargeExpiry: { hours: 48, expiresAt: "2030-01-19T12:00:00.000Z" },
        nextRenewal: { at: null, amount: 60000, currency: "EGP", billingCycle: "monthly" },
        payable: true,
        blockedBy: null,
      },
      period_end: {
        effective: "period_end",
        effectiveAt: "2030-02-01T00:00:00.000Z",
        amountDue: 0,
        currency: "EGP",
        chargeExpiry: null,
        nextRenewal: { at: "2030-02-01T00:00:00.000Z", amount: 60000, currency: "EGP", billingCycle: "monthly" },
        payable: null,
        blockedBy: null,
      },
    },
    ...overrides,
  });

describe("an upgrade: now at the full price, or at the end of the subscription", () => {
  it("shows the days left and both choices; now pays the full price, then opens Pay", async () => {
    const { user, view } = setup(ON);
    api.previewPlanSwitch.mockResolvedValue({ preview: fullUpgrade() });
    const invoice = fake<MerchantInvoice>({ id: "inv_1", status: "pending", amountDue: 60000, currency: "EGP", targetPlanId: "plan_pro", targetBillingCycle: "monthly" });
    api.startPlanSwitch.mockImplementation(async () => {
      api.listBillingInvoices.mockResolvedValue({ invoices: [invoice], page: 1, pageSize: 10, total: 1 });
      return { kind: "upgrade", created: true, changed: false, switch: openSwitch({ amountDue: 60000, proration: null }), invoice, plans: { ...view, planSwitch: { ...ON, open: openSwitch() } } };
    });
    api.getPaymentMethods.mockResolvedValue({ methods: [fake({ code: "instapay", kind: "manual", label: { ar: "إنستا باي", en: "InstaPay" } })], currency: "EGP", contactSupport: false });
    api.listBillingPaymentProofs.mockResolvedValue({ proofs: [] });

    expect(await screen.findByText(/an upgrade starts a new full period at the new plan's price/)).toBeInTheDocument();
    await user.click(within(await cardOf("Pro")).getByRole("button", { name: "Switch to this plan" }));
    const dialog = await screen.findByRole("dialog", { name: "Switch to Pro" });
    expect(await within(dialog).findByText(/15 days left in your current subscription \(ends on .*2030\)/)).toBeInTheDocument();
    const now = within(dialog).getByRole("radio", { name: /Upgrade now/ });
    const later = within(dialog).getByRole("radio", { name: /Wait for the end of the subscription/ });
    expect(now).toBeChecked();
    expect(later).not.toBeChecked();
    expect(within(dialog).getByText(/You pay the full price of Pro for a new full period/)).toBeInTheDocument();
    expect(within(dialog).getByText(/one period after the payment/)).toBeInTheDocument();
    expect(within(dialog).queryByText("Left in this period")).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: /Switch and pay .*600/ }));
    await waitFor(() =>
      expect(api.startPlanSwitch).toHaveBeenCalledWith("ws_1", { planId: "plan_pro", billingCycle: "monthly", timing: "now", expectedAmount: 60000 })
    );
    await waitFor(() => expect(api.openBillingInvoice).toHaveBeenCalled());
  });

  it("waiting for the end of the subscription: nothing to pay now, the renewal at the new price, sent as period_end", async () => {
    const { user, view } = setup(ON);
    api.previewPlanSwitch.mockResolvedValue({ preview: fullUpgrade() });
    const scheduled = openSwitch({
      kind: "scheduled",
      status: "scheduled",
      reason: "upgrade",
      timing: "period_end",
      effectiveAt: "2030-02-01T00:00:00.000Z",
      invoiceId: null,
      amountDue: null,
      currency: null,
      expiresAt: null,
      proration: null,
    });
    api.startPlanSwitch.mockImplementation(async () => {
      api.getSubscriptionPlans.mockResolvedValue({ ...view, planSwitch: { ...ON, open: scheduled } });
      return { kind: "scheduled", created: true, changed: false, switch: scheduled, invoice: null, plans: { ...view, planSwitch: { ...ON, open: scheduled } } };
    });
    await user.click(within(await cardOf("Pro")).getByRole("button", { name: "Switch to this plan" }));
    const dialog = await screen.findByRole("dialog", { name: "Switch to Pro" });
    await user.click(await within(dialog).findByRole("radio", { name: /Wait for the end of the subscription/ }));
    expect(within(dialog).getByText(/You keep Starter until .*2030, when your current subscription ends. Then Pro starts, and its renewal invoice of .*600/)).toBeInTheDocument();
    expect(within(dialog).queryByText("Due now")).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/If it isn't paid/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /Upgrade on .*2030/ }));
    await waitFor(() =>
      expect(api.startPlanSwitch).toHaveBeenCalledWith("ws_1", { planId: "plan_pro", billingCycle: "monthly", timing: "period_end", expectedAmount: 0 })
    );
    // The deferred banner, with Cancel and no Pay.
    expect(await screen.findByRole("heading", { name: "Deferred change" })).toBeInTheDocument();
    expect(screen.getByText(/Your upgrade to Pro \(monthly\) takes effect on .*2030, when your current subscription ends/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel this change" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pay now" })).not.toBeInTheDocument();
  });

  it("a timing no longer on offer: reads the preview again", async () => {
    const { user } = setup(ON);
    api.previewPlanSwitch.mockResolvedValue({ preview: fullUpgrade() });
    api.startPlanSwitch.mockRejectedValueOnce(new ApiError("timing", 409, "SWITCH_TIMING_NOT_AVAILABLE", { timing: "period_end", available: ["now"] }));
    await user.click(within(await cardOf("Pro")).getByRole("button", { name: "Switch to this plan" }));
    const dialog = await screen.findByRole("dialog", { name: "Switch to Pro" });
    await user.click(await within(dialog).findByRole("radio", { name: /Wait for the end/ }));
    await user.click(within(dialog).getByRole("button", { name: /Upgrade on/ }));
    expect(await within(dialog).findByText(/That timing isn't available for this change any more/)).toBeInTheDocument();
    await waitFor(() => expect(api.previewPlanSwitch).toHaveBeenCalledTimes(2));
  });

  it("is in Arabic", async () => {
    const dialog = await confirmationFor("Pro", fullUpgrade(), { locale: "ar" });
    expect(within(dialog).getByText(/متبقٍ .* في اشتراكك الحالي \(ينتهي في/)).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: /الترقية الآن/ })).toBeChecked();
    expect(within(dialog).getByRole("radio", { name: /الانتظار حتى نهاية الاشتراك/ })).toBeInTheDocument();
  });
});

describe("an upgrade from an older API (priced for the days left)", () => {
  it("previews the difference before anything is written, starts it with the amount shown, then opens Pay", async () => {
    const { user, view } = setup(ON);
    api.previewPlanSwitch.mockResolvedValue({ preview: upgrade() });
    const invoice = fake<MerchantInvoice>({ id: "inv_1", status: "pending", amountDue: 14500, currency: "EGP", targetPlanId: "plan_pro", targetBillingCycle: "monthly" });
    api.startPlanSwitch.mockImplementation(async () => {
      api.listBillingInvoices.mockResolvedValue({ invoices: [invoice], page: 1, pageSize: 10, total: 1 });
      return { kind: "upgrade", created: true, changed: false, switch: openSwitch(), invoice, plans: { ...view, planSwitch: { ...ON, open: openSwitch() } } };
    });
    api.getPaymentMethods.mockResolvedValue({ methods: [fake({ code: "instapay", kind: "manual", label: { ar: "إنستا باي", en: "InstaPay" } })], currency: "EGP", contactSupport: false });
    api.listBillingPaymentProofs.mockResolvedValue({ proofs: [] });

    await user.click(within(await cardOf("Pro")).getByRole("button", { name: "Switch to this plan" }));
    await waitFor(() => expect(api.previewPlanSwitch).toHaveBeenCalledWith("ws_1", { planId: "plan_pro", billingCycle: "monthly" }));
    const dialog = await screen.findByRole("dialog", { name: "Switch to Pro" });
    expect(within(dialog).getByText(/You pay only the difference for the days left in your current period \(15 days\)/)).toBeInTheDocument();
    expect(within(dialog).getByText("15 days of 31 days")).toBeInTheDocument();
    expect(within(dialog).getByText("As soon as the payment is confirmed")).toBeInTheDocument();
    expect(within(dialog).getByText("Next renewal")).toBeInTheDocument();
    expect(api.startPlanSwitch).not.toHaveBeenCalled();

    // No timings from an older API: no choice, and none sent.
    expect(within(dialog).queryByRole("radio", { name: /Upgrade now/ })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /Switch and pay/ }));
    await waitFor(() => expect(api.startPlanSwitch).toHaveBeenCalledWith("ws_1", { planId: "plan_pro", billingCycle: "monthly", expectedAmount: 14500 }));
    // The usual Pay dialog, which pays the charge waiting.
    await waitFor(() => expect(api.openBillingInvoice).toHaveBeenCalled());
  });
});

describe("an upgrade, whatever its price", () => {

  it("reads the preview again when the amount changed, and confirms the new one", async () => {
    const { user } = setup(ON);
    api.previewPlanSwitch.mockResolvedValueOnce({ preview: upgrade() }).mockResolvedValueOnce({ preview: upgrade({ amountDue: 14000 }) });
    api.startPlanSwitch.mockRejectedValueOnce(new ApiError("changed", 409, "SWITCH_AMOUNT_CHANGED", { amountDue: 14000, currency: "EGP" }));
    await user.click(within(await cardOf("Pro")).getByRole("button", { name: "Switch to this plan" }));
    const dialog = await screen.findByRole("dialog", { name: "Switch to Pro" });
    await user.click(await within(dialog).findByRole("button", { name: /Switch and pay/ }));
    expect(await within(dialog).findByText(/The amount changed since it was shown/)).toBeInTheDocument();
    await waitFor(() => expect(api.previewPlanSwitch).toHaveBeenCalledTimes(2));
    expect(await within(dialog).findByRole("button", { name: /Switch and pay .*140/ })).toBeEnabled();
  });

  it("shows what blocks it in words, with the confirm button off", async () => {
    const { user } = setup(ON);
    api.previewPlanSwitch.mockResolvedValue({ preview: upgrade({ blockedBy: "PROOF_UNDER_REVIEW" }) });
    await user.click(within(await cardOf("Pro")).getByRole("button", { name: "Switch to this plan" }));
    const dialog = await screen.findByRole("dialog", { name: "Switch to Pro" });
    expect(await within(dialog).findByText(/A transfer for the charge waiting is being checked/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Switch and pay/ })).toBeDisabled();
  });

  it("no way to pay the currency: says so, with the way to support", async () => {
    const { user } = setup(ON);
    api.previewPlanSwitch.mockResolvedValue({ preview: upgrade({ currency: "USD", payable: false, blockedBy: "NO_PAYMENT_METHOD" }) });
    await user.click(within(await cardOf("Pro")).getByRole("button", { name: "Switch to this plan" }));
    const dialog = await screen.findByRole("dialog", { name: "Switch to Pro" });
    const alert = (await within(dialog).findByText(/There's no way to pay in USD/)).closest("[role=alert]")!;
    expect(within(alert as HTMLElement).getByRole("link", { name: "Contact support" })).toHaveAttribute("href", "/support");
  });

  it("a refusal from the preview is worded, not raw", async () => {
    const { user } = setup(ON);
    api.previewPlanSwitch.mockRejectedValue(new ApiError("Special terms", 409, "SPECIAL_TERMS_ACTIVE"));
    await user.click(within(await cardOf("Pro")).getByRole("button", { name: "Switch to this plan" }));
    expect(await screen.findByText(/Your plan has special terms agreed with Zimos/)).toBeInTheDocument();
    expect(screen.queryByText("Special terms")).not.toBeInTheDocument();
  });
});

describe("a downgrade, and the cycle", () => {
  it("is scheduled for the end of the paid period, with its date", async () => {
    const { user, view } = setup(ON);
    api.previewPlanSwitch.mockResolvedValue({ preview: downgrade() });
    const scheduled = openSwitch({ kind: "scheduled", status: "scheduled", to: { planId: "plan_basic", planName: "Basic", billingCycle: "monthly" }, effectiveAt: "2030-02-01T00:00:00.000Z", invoiceId: null, amountDue: null, currency: null, expiresAt: null, proration: null });
    api.startPlanSwitch.mockImplementation(async () => {
      // From here the server lists the plans with the change waiting.
      api.getSubscriptionPlans.mockResolvedValue({ ...view, planSwitch: { ...ON, open: scheduled } });
      return { kind: "scheduled", created: true, changed: false, switch: scheduled, invoice: null, plans: { ...view, planSwitch: { ...ON, open: scheduled } } };
    });
    await user.click(within(await cardOf("Basic")).getByRole("button", { name: "Switch to this plan" }));
    const dialog = await screen.findByRole("dialog", { name: "Switch to Basic" });
    expect(await within(dialog).findByText(/Basic starts on .*2030, when your paid period ends\. Nothing is refunded/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Schedule the change" }));
    await waitFor(() => expect(api.startPlanSwitch).toHaveBeenCalledWith("ws_1", { planId: "plan_basic", billingCycle: "monthly", expectedAmount: 0 }));
    expect(await screen.findByText(/Scheduled: Basic starts on/)).toBeInTheDocument();
    // The banner, and the card saying when.
    expect(await screen.findByRole("heading", { name: "Plan change" })).toBeInTheDocument();
    expect(within(await cardOf("Basic")).getByText(/Starts on/)).toBeInTheDocument();
  });

  it("the current plan on the other cycle offers the change of billing", async () => {
    const { user } = setup(ON);
    api.previewPlanSwitch.mockResolvedValue({ preview: downgrade() });
    await user.click(await screen.findByRole("radio", { name: /Yearly/ }));
    await user.click(within(await cardOf("Starter")).getByRole("button", { name: "Switch to annual billing" }));
    await waitFor(() => expect(api.previewPlanSwitch).toHaveBeenCalledWith("ws_1", { planId: "plan_starter", billingCycle: "yearly" }));
  });
});

describe("the banner of the switch waiting", () => {
  it("an upgrade waiting: its amount, Pay now, when it lapses, and Cancel", async () => {
    const { user, view } = setup({ ...ON, open: openSwitch() });
    expect(await screen.findByText(/Your switch to Pro \(monthly\) is waiting for its payment of .*145.*You stay on Starter until it's paid\./)).toBeInTheDocument();
    expect(screen.getByText(/If it isn't paid by .*, it's cancelled by itself/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay now" })).toHaveAttribute("href", "/subscription?tab=invoices&pay=1");
    expect(within(await cardOf("Pro")).getByRole("button", { name: "Pay to switch" })).toHaveAttribute("href", "/subscription?tab=invoices&pay=1");
    api.cancelPlanSwitch.mockImplementation(async () => {
      api.getSubscriptionPlans.mockResolvedValue({ ...view, planSwitch: ON });
      return { cancelled: true, switch: openSwitch({ status: "cancelled" }), plans: { ...view, planSwitch: ON } };
    });
    await user.click(screen.getByRole("button", { name: "Cancel this change" }));
    await waitFor(() => expect(api.cancelPlanSwitch).toHaveBeenCalledWith("ws_1"));
    expect(await screen.findByText("The change was cancelled. Nothing is due, and your plan stays as it is.")).toBeInTheDocument();
    expect(screen.queryByText(/is waiting for its payment/)).not.toBeInTheDocument();
  });

  it("a scheduled change: its date and Cancel; a refused cancel is worded", async () => {
    const { user } = setup({
      ...ON,
      open: openSwitch({ kind: "scheduled", status: "scheduled", to: { planId: "plan_basic", planName: "Basic", billingCycle: "monthly" }, effectiveAt: "2030-02-01T00:00:00.000Z", invoiceId: null, amountDue: null, currency: null, expiresAt: null, proration: null }),
    });
    expect(await screen.findByText(/Your switch to Basic \(monthly\) takes effect on .*2030, when your paid period ends/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pay now" })).not.toBeInTheDocument();
    api.cancelPlanSwitch.mockRejectedValue(new ApiError("billed", 409, "PLAN_SWITCH_ALREADY_BILLED", { invoiceId: "inv_2", effectiveAt: "2030-02-01T00:00:00.000Z" }));
    await user.click(screen.getByRole("button", { name: "Cancel this change" }));
    expect(await screen.findByText(/already paid at its price, so that change stays/)).toBeInTheDocument();
  });

  it("still shows, and cancels, with the switch off", async () => {
    setup({ enabled: false, mode: null, reason: null, open: openSwitch() });
    expect(await screen.findByRole("button", { name: "Cancel this change" })).toBeInTheDocument();
    expect(screen.getByText("To switch plan while your paid subscription runs, contact Zimos support.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Switch to this plan" })).not.toBeInTheDocument();
  });

  it("is in Arabic", async () => {
    setup({ ...ON, open: openSwitch() }, { locale: "ar" });
    expect(await screen.findByText(/تبديلك إلى Pro \(شهري\) في انتظار دفع/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "إلغاء هذا التغيير" })).toBeInTheDocument();
  });
});

/** Opens the confirmation for `planName` with `next` as the server's preview; resolves the dialog. */
async function confirmationFor(planName: string, next: PlanSwitchPreview, options: { locale?: "en" | "ar" } = {}) {
  const { user } = setup(ON, options);
  api.previewPlanSwitch.mockResolvedValue({ preview: next });
  const label = options.locale === "ar" ? "بدّل إلى هذه الخطة" : "Switch to this plan";
  await user.click(within(await cardOf(planName)).getByRole("button", { name: label }));
  const title = options.locale === "ar" ? `التبديل إلى ${planName}` : `Switch to ${planName}`;
  const dialog = await screen.findByRole("dialog", { name: title });
  await within(dialog).findByRole("button", { name: options.locale === "ar" ? "إغلاق" : "Close" });
  return dialog;
}

describe("how long the charge lives (preview.chargeExpiry)", () => {
  it("present: the date and the hours", async () => {
    const dialog = await confirmationFor("Pro", upgrade({ chargeExpiry: { hours: 48, expiresAt: "2030-01-19T12:00:00.000Z" } }));
    expect(within(dialog).getByText(/If it isn't paid by .*2030.* \(48 hours from now\), the change is cancelled by itself/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/If it isn't paid in time/)).not.toBeInTheDocument();
  });

  it("absent (an older API): the words without a date", async () => {
    const absent = await confirmationFor("Pro", upgrade());
    expect(within(absent).getByText(/If it isn't paid in time, the change is cancelled by itself/)).toBeInTheDocument();
    expect(within(absent).queryByText(/hours from now/)).not.toBeInTheDocument();
  });

  it("null: the words without a date", async () => {
    const dialog = await confirmationFor("Pro", upgrade({ chargeExpiry: null }));
    expect(within(dialog).getByText(/If it isn't paid in time/)).toBeInTheDocument();
  });

  it("nothing to pay: no such line at all", async () => {
    const dialog = await confirmationFor("Basic", downgrade());
    expect(within(dialog).queryByText(/If it isn't paid/)).not.toBeInTheDocument();
  });

  it("in Arabic", async () => {
    const dialog = await confirmationFor("Pro", upgrade({ chargeExpiry: { hours: 48, expiresAt: "2030-01-19T12:00:00.000Z" } }), { locale: "ar" });
    expect(within(dialog).getByText(/\(خلال ٤٨ ساعة من الآن\)/)).toBeInTheDocument();
  });
});

describe("the next renewal in the confirmation (preview.nextRenewal)", () => {
  const rowOf = (dialog: HTMLElement) => within(dialog).queryByText("Next renewal")?.closest("div") ?? null;

  it("a move (at null): it follows the payment, with no date", async () => {
    const dialog = await confirmationFor(
      "Pro",
      upgrade({
        kind: "move",
        reason: "from_free",
        proration: null,
        amountDue: 60000,
        nextRenewal: { at: null, amount: 60000, currency: "EGP", billingCycle: "monthly" },
      })
    );
    const row = rowOf(dialog)!;
    expect(within(row).getByText(/one period after the payment/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/Invalid date/)).not.toBeInTheDocument();
    expect(within(row).queryByText(/—/)).not.toBeInTheDocument();
  });

  it("a free plan (nextRenewal null): no renewal row at all", async () => {
    const dialog = await confirmationFor("Basic", upgrade({ kind: "immediate", reason: "free_plan", effective: "now", amountDue: 0, proration: null, nextRenewal: null, payable: null }));
    expect(within(dialog).getByText(/is free and starts now/)).toBeInTheDocument();
    expect(rowOf(dialog)).toBeNull();
  });

  it("the plan the store is on (none): reads as its renewal as it stands", async () => {
    const none = upgrade({
      kind: "none",
      reason: null,
      effective: null,
      to: { planId: "plan_starter", planName: "Starter", billingCycle: "monthly", currency: "EGP" },
      amountDue: 0,
      proration: null,
      nextRenewal: { at: "2030-02-01T00:00:00.000Z", amount: 30000, currency: "EGP", billingCycle: "monthly" },
      payable: null,
    });
    const dialog = await confirmationFor("Basic", none);
    expect(within(dialog).getByText("This is already your plan.")).toBeInTheDocument();
    expect(within(rowOf(dialog)!).getByText(/300 on .*2030/)).toBeInTheDocument();
    // Nothing starts and nothing is due.
    expect(within(dialog).queryByText("Starts")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Due now")).not.toBeInTheDocument();
  });

  it("the plan the store is on, from an older API (at null): no renewal row", async () => {
    const dialog = await confirmationFor(
      "Basic",
      upgrade({ kind: "none", reason: null, effective: null, amountDue: 0, proration: null, nextRenewal: { at: null, amount: 30000, currency: "EGP", billingCycle: "monthly" }, payable: null })
    );
    expect(within(dialog).getByText("This is already your plan.")).toBeInTheDocument();
    expect(rowOf(dialog)).toBeNull();
  });
});

describe("a transfer under review (open.proofUnderReview)", () => {
  it("true: says so, and offers neither Cancel nor Pay now, on the banner or the card", async () => {
    setup({ ...ON, open: openSwitch({ proofUnderReview: true }) });
    expect(await screen.findByText(/A transfer for this charge is being reviewed\. Wait for the review/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel this change" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pay now" })).not.toBeInTheDocument();
    // It doesn't lapse while reviewed, so no date for that either.
    expect(screen.queryByText(/If it isn't paid by/)).not.toBeInTheDocument();
    const pro = await cardOf("Pro");
    expect(within(pro).getByText("Transfer under review")).toBeInTheDocument();
    expect(within(pro).queryByRole("button", { name: "Pay to switch" })).not.toBeInTheDocument();
  });

  it("false: Cancel and Pay now as before", async () => {
    setup({ ...ON, open: openSwitch({ proofUnderReview: false }) });
    expect(await screen.findByRole("button", { name: "Cancel this change" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Pay now" })).toBeInTheDocument();
    expect(screen.queryByText(/is being reviewed/)).not.toBeInTheDocument();
  });

  it("absent (an older API): Cancel stays, and the server's refusal is still worded", async () => {
    const { user } = setup({ ...ON, open: openSwitch() });
    api.cancelPlanSwitch.mockRejectedValue(new ApiError("proof", 409, "PROOF_UNDER_REVIEW", { invoiceId: "inv_1" }));
    await user.click(await screen.findByRole("button", { name: "Cancel this change" }));
    expect(await screen.findByText("A transfer for this charge is being checked. You can cancel once it has been reviewed.")).toBeInTheDocument();
  });

  it("a scheduled change never has one: Cancel stays", async () => {
    setup({
      ...ON,
      open: openSwitch({ kind: "scheduled", status: "scheduled", effectiveAt: "2030-02-01T00:00:00.000Z", invoiceId: null, amountDue: null, currency: null, expiresAt: null, proration: null, proofUnderReview: false }),
    });
    expect(await screen.findByRole("button", { name: "Cancel this change" })).toBeInTheDocument();
  });

  it("in Arabic", async () => {
    setup({ ...ON, open: openSwitch({ proofUnderReview: true }) }, { locale: "ar" });
    expect(await screen.findByText(/تجري مراجعة تحويل لهذه الدفعة/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "إلغاء هذا التغيير" })).not.toBeInTheDocument();
  });
});

describe("a move to pay per order", () => {
  const ppoPlan = { id: "plan_ppo", name: "Pay per order", fee: 400, currency: "EGP" };
  const ppoPreview = (): PlanSwitchPreview =>
    upgrade({
      kind: "scheduled",
      reason: "to_pay_per_order",
      timing: "period_end",
      timings: ["period_end"],
      effective: "period_end",
      effectiveAt: "2030-02-01T00:00:00.000Z",
      to: { planId: "plan_ppo", planName: "Pay per order", billingCycle: "monthly", currency: "EGP" },
      amountDue: 0,
      proration: null,
      currentPeriod: { endsAt: "2030-02-01T00:00:00.000Z", remainingDays: 15 },
      chargeExpiry: null,
      nextRenewal: null,
      payable: false,
    });
  const deferred = openSwitch({
    kind: "scheduled",
    status: "scheduled",
    reason: "to_pay_per_order",
    to: { planId: "plan_ppo", planName: "Pay per order", billingCycle: "monthly" },
    effectiveAt: "2030-02-01T00:00:00.000Z",
    invoiceId: null,
    amountDue: null,
    currency: null,
    expiresAt: null,
    proration: null,
  });

  it("its card opens the confirmation like the others: at the end of the period, nothing paid, nothing refunded", async () => {
    const { user, view: withPpo } = setup(ON, { view: { payPerOrder: { available: true, current: false, plan: ppoPlan } } });
    api.previewPlanSwitch.mockResolvedValue({ preview: ppoPreview() });
    api.startPlanSwitch.mockImplementation(async () => {
      api.getSubscriptionPlans.mockResolvedValue({ ...withPpo, planSwitch: { ...ON, open: deferred } });
      return { kind: "scheduled", created: true, changed: false, switch: deferred, invoice: null, plans: { ...withPpo, planSwitch: { ...ON, open: deferred } } };
    });
    await user.click(await screen.findByRole("button", { name: "Switch to pay per order" }));
    await waitFor(() => expect(api.previewPlanSwitch).toHaveBeenCalledWith("ws_1", { planId: "plan_ppo", billingCycle: "monthly" }));
    const dialog = await screen.findByRole("dialog", { name: "Switch to Pay per order" });
    expect(await within(dialog).findByText(/15 days left in your current subscription/)).toBeInTheDocument();
    expect(within(dialog).getByText(/You move to pay per order on .*2030, when your paid period ends, and keep Starter until then. Nothing is paid now and nothing is refunded/)).toBeInTheDocument();
    expect(within(dialog).queryByRole("radio")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Due now")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Next renewal")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /Move to pay per order on .*2030/ }));
    await waitFor(() => expect(api.startPlanSwitch).toHaveBeenCalledWith("ws_1", { planId: "plan_ppo", billingCycle: "monthly", expectedAmount: 0 }));
    expect(api.choosePayPerOrder).not.toHaveBeenCalled();
    // The deferred banner, and the card saying when.
    expect(await screen.findByRole("heading", { name: "Deferred change" })).toBeInTheDocument();
    expect(screen.getByText(/You move to pay per order on .*2030, when your paid period ends. You keep Starter until then; nothing is refunded./)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Switch to pay per order" })).not.toBeInTheDocument();
  });

  it("the deferred move is cancelled from its banner", async () => {
    const { user, view } = setup({ ...ON, open: deferred });
    api.cancelPlanSwitch.mockImplementation(async () => {
      api.getSubscriptionPlans.mockResolvedValue({ ...view, planSwitch: ON });
      return { cancelled: true, switch: { ...deferred, status: "cancelled" }, plans: { ...view, planSwitch: ON } };
    });
    expect(await screen.findByRole("heading", { name: "Deferred change" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel this change" }));
    await waitFor(() => expect(api.cancelPlanSwitch).toHaveBeenCalledWith("ws_1"));
    expect(await screen.findByText("The change was cancelled. Nothing is due, and your plan stays as it is.")).toBeInTheDocument();
  });

  it("with the switch off, the card is as before: support once paid", async () => {
    setup({ enabled: false, mode: null, reason: null, open: null }, { view: { payPerOrder: { available: true, current: false, plan: ppoPlan } } });
    expect(within(await cardOf("Pay per order")).getByRole("button", { name: "Contact support to switch" })).toHaveAttribute("href", "/support");
    expect(screen.queryByRole("button", { name: "Switch to pay per order" })).not.toBeInTheDocument();
  });

  it("the deferred move is in Arabic", async () => {
    setup({ ...ON, open: deferred }, { locale: "ar" });
    expect(await screen.findByRole("heading", { name: "تغيير مؤجَّل" })).toBeInTheDocument();
    expect(screen.getByText(/تنتقل إلى الدفع لكل طلب في .* عند انتهاء فترتك المدفوعة/)).toBeInTheDocument();
  });
});

describe("the words", () => {
  it("say the same things in both languages", () => {
    expect(Object.keys(PLAN_SWITCH_STRINGS.ar).sort()).toEqual(Object.keys(PLAN_SWITCH_STRINGS.en).sort());
  });
});
