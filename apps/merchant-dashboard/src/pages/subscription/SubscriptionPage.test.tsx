import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { BillingPaymentProof, MerchantInvoice, SubscriptionPlan, SubscriptionPlans, Workspace, WorkspaceBilling } from "@store-builder/api-client";
import { ApiError } from "@store-builder/api-client";
import { api, fake, workspaceMock } from "@/test/mocks";
import { currentPath, renderWithProviders } from "@/test/renderWithProviders";
import { NAV_ITEMS, isNavItemVisible } from "@/lib/navigation";
import { SettingsPage } from "@/pages/settings/SettingsPage";
import { SubscriptionPage } from "./SubscriptionPage";

const price = (gross: number, discount = 0) => ({ gross, discount, net: gross - discount });

function card(overrides: Partial<SubscriptionPlan> = {}): SubscriptionPlan {
  return fake<SubscriptionPlan>({
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
}

function view(overrides: Partial<SubscriptionPlans> = {}): SubscriptionPlans {
  return fake<SubscriptionPlans>({
    subscription: { status: "trialing", billingCycle: "monthly", planId: "plan_basic", trialEndsAt: null, currentPeriodEnd: "2030-01-01", draft: false },
    trial: { available: false, used: true },
    planChange: "immediate",
    referralCode: null,
    plans: [card({ isCurrent: true }), card({ id: "plan_pro", name: "Pro", monthlyPrice: 80000, yearlyPrice: 800000, prices: { monthly: price(80000), yearly: price(800000) } })],
    ...overrides,
  });
}

const billing = (overrides: Partial<WorkspaceBilling> = {}) =>
  fake<WorkspaceBilling>({
    subscription: { status: "trialing", billingCycle: "monthly", trialEndsAt: "2030-01-01", currentPeriodStart: "2029-12-18", currentPeriodEnd: "2030-01-01", plan: { id: "plan_basic", name: "Basic", currency: "EGP", monthlyPrice: 30000, yearlyPrice: 300000 } },
    referralCode: null,
    nextCharge: null,
    limits: { stores: { used: 1, max: 2 }, funnelsThisMonth: { used: 5, max: 5, resetsAt: "2030-01-01" } },
    draft: false,
    ...overrides,
  });

function setup({ plans = view(), bill = billing(), role = "owner", route = "/subscription", locale = "en" as "en" | "ar", invoices = [] as MerchantInvoice[] } = {}) {
  workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", role });
  api.getWorkspaceBilling.mockResolvedValue(bill);
  api.getSubscriptionPlans.mockResolvedValue(plans);
  api.listBillingInvoices.mockResolvedValue({ invoices, page: 1, pageSize: 10, total: invoices.length });
  return renderWithProviders(<SubscriptionPage />, { route, path: "/subscription", locale });
}

describe("SubscriptionPage", () => {
  it("is for the owner and the accountant only, and so is its sidebar entry", async () => {
    setup({ role: "order_operator" });
    expect(screen.getByText(/Only the store's owner or its accountant/)).toBeInTheDocument();
    expect(api.getSubscriptionPlans).not.toHaveBeenCalled();

    const item = NAV_ITEMS.find((i) => i.key === "subscription")!;
    expect(item.to).toBe("/subscription");
    expect(["owner", "accountant"].every((r) => isNavItemVisible(item, r))).toBe(true);
    expect(["workspace_manager", "editor", "order_operator", "confirmation_agent"].some((r) => isNavItemVisible(item, r))).toBe(false);
  });

  it("marks the current plan, shows what annual saves, and keeps pay-per-order as coming soon", async () => {
    const { user } = setup();
    const basic = await screen.findByRole("article", { name: "Basic" });
    expect(within(basic).getByText("Your current plan")).toBeInTheDocument();
    expect(within(basic).queryByRole("button", { name: "Choose this plan" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /Yearly/ }));
    const pro = screen.getByRole("article", { name: "Pro" });
    // 12 × 800 − 8,000 = 1,600 a year.
    expect(within(pro).getByText(/Save .*1,600.* a year/)).toBeInTheDocument();

    const payPerOrder = screen.getByText("Pay per order").closest("article")!;
    expect(within(payPerOrder).getByText("Coming soon")).toBeInTheDocument();
    expect(within(payPerOrder).queryByRole("button")).not.toBeInTheDocument();
  });

  it("changes plan at once during a trial, with the chosen cycle", async () => {
    api.changeSubscriptionPlan.mockResolvedValue({ changed: true, plans: view() });
    const { user } = setup();
    await user.click(await screen.findByRole("radio", { name: /Yearly/ }));
    await user.click(within(screen.getByRole("article", { name: "Pro" })).getByRole("button", { name: "Choose this plan" }));
    await waitFor(() => expect(api.changeSubscriptionPlan).toHaveBeenCalledWith("ws_1", { planId: "plan_pro", billingCycle: "yearly" }));
  });

  it("leads from the current plan to paying while its charge is due", async () => {
    setup({ bill: billing({ nextCharge: { grossAmount: 30000, discountAmount: 0, amount: 30000, currency: "EGP" } }) });
    const basic = await screen.findByRole("article", { name: "Basic" });
    expect(within(basic).getByText(/Amount due: .*300/)).toBeInTheDocument();
    expect(within(basic).getByRole("button", { name: "Pay now" })).toHaveAttribute("href", "/subscription?tab=invoices&pay=1");
    // Only the current plan's card.
    expect(within(screen.getByRole("article", { name: "Pro" })).queryByRole("button", { name: "Pay now" })).not.toBeInTheDocument();
  });

  it("offers no Pay now on the plans while a paid period runs, nor when nothing is due", async () => {
    setup({
      plans: view({ subscription: { ...view().subscription, status: "active" }, planChange: "support" }),
      bill: billing({
        subscription: { ...billing().subscription, status: "active" },
        nextCharge: { grossAmount: 30000, discountAmount: 0, amount: 30000, currency: "EGP" },
      }),
    });
    await screen.findByRole("article", { name: "Basic" });
    expect(screen.queryByRole("button", { name: "Pay now" })).not.toBeInTheDocument();
  });

  it("leads straight to paying after a priced plan is chosen", async () => {
    const proCurrent = view({
      plans: [card(), card({ id: "plan_pro", name: "Pro", isCurrent: true, monthlyPrice: 80000, yearlyPrice: 800000, prices: { monthly: price(80000), yearly: price(800000) } })],
    });
    api.changeSubscriptionPlan.mockResolvedValue({ changed: true, plans: proCurrent });
    // Before: Basic, its charge due. Nothing on Pro's card until the summary is Pro's.
    const { user } = setup({ bill: billing({ nextCharge: { grossAmount: 30000, discountAmount: 0, amount: 30000, currency: "EGP" } }) });
    const choose = within(await screen.findByRole("article", { name: "Pro" })).getByRole("button", { name: "Choose this plan" });
    // What the page reads again after the change.
    api.getSubscriptionPlans.mockResolvedValue(proCurrent);
    api.getWorkspaceBilling.mockResolvedValue(
      billing({
        subscription: { ...billing().subscription, plan: { id: "plan_pro", name: "Pro", currency: "EGP", monthlyPrice: 80000, yearlyPrice: 800000 } },
        nextCharge: { grossAmount: 80000, discountAmount: 0, amount: 80000, currency: "EGP" },
      })
    );
    await user.click(choose);

    const pro = await screen.findByRole("article", { name: "Pro" });
    expect(await within(pro).findByRole("button", { name: "Pay now" })).toHaveAttribute("href", "/subscription?tab=invoices&pay=1");
    expect(within(pro).getByText(/Amount due: .*800/)).toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: "Basic" })).queryByRole("button", { name: "Pay now" })).not.toBeInTheDocument();
  });

  it("goes from Pay now to the Invoices tab with the Pay dialog open", async () => {
    const instapay = { code: "instapay", kind: "manual" as const, label: { ar: "إنستا باي", en: "InstaPay" }, accountNumber: "zimos@instapay", note: { ar: null, en: null } };
    api.getPaymentMethods.mockResolvedValue({ methods: [instapay], currency: "EGP", contactSupport: false });
    api.listBillingPaymentProofs.mockResolvedValue({ proofs: [] });
    api.openBillingInvoice.mockResolvedValue({
      invoice: { id: "next", status: "pending", periodStart: "2030-01-01", periodEnd: "2030-02-01", grossAmount: 30000, discountAmount: 0, amountDue: 30000, amountPaid: null, currency: "EGP", paidAt: null, paymentSource: null, createdAt: null },
      created: false,
      written: false,
    });
    const { user } = setup({ bill: billing({ nextCharge: { grossAmount: 30000, discountAmount: 0, amount: 30000, currency: "EGP" } }) });
    await user.click(within(await screen.findByRole("article", { name: "Basic" })).getByRole("button", { name: "Pay now" }));

    expect(await screen.findByRole("tab", { name: "Invoices", selected: true })).toBeInTheDocument();
    const dialog = await screen.findByRole("dialog", { name: "Pay your invoice" });
    expect(await within(dialog).findByText("zimos@instapay")).toBeInTheDocument();
    await waitFor(() => expect(currentPath()).toBe("/subscription?tab=invoices"));
  });

  it("opens the Invoices tab from ?tab=invoices, and the summary links there", async () => {
    setup({ route: "/subscription?tab=invoices", bill: billing({ nextCharge: { grossAmount: 30000, discountAmount: 0, amount: 30000, currency: "EGP" } }) });
    expect(await screen.findByRole("tab", { name: "Invoices", selected: true })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pay and see invoices" })).toHaveAttribute("href", "/subscription?tab=invoices");
  });

  it("offers the free trial on every plan of a draft store whose account hasn't had one", async () => {
    api.startTrial.mockResolvedValue(fake({ started: true }));
    const { user } = setup({
      plans: view({ subscription: { ...view().subscription, status: "draft", draft: true }, trial: { available: true, used: false } }),
    });
    expect(await screen.findByText(/Your store is a draft/)).toBeInTheDocument();
    await user.click(within(screen.getByRole("article", { name: "Pro" })).getByRole("button", { name: "Start the free trial (14 days)" }));
    await waitFor(() => expect(api.startTrial).toHaveBeenCalledWith("ws_1", "plan_pro"));
  });

  it("sends a paid subscription to support instead of changing plan", async () => {
    setup({ plans: view({ subscription: { ...view().subscription, status: "active" }, planChange: "support" }) });
    const pro = await screen.findByRole("article", { name: "Pro" });
    // The UI kit's Button asChild keeps role="button" on the link it renders.
    expect(within(pro).getByRole("button", { name: "Contact support to switch" })).toHaveAttribute("href", "/support");
    expect(within(pro).queryByRole("button", { name: "Choose this plan" })).not.toBeInTheDocument();
  });

  it("checks a code on a card, then applies it to the store", async () => {
    api.previewReferralCode.mockResolvedValue({
      code: { code: "SAVE10", discountType: "percentage", discountValue: 1000, discountCurrency: null, active: true },
      plans: [{ planId: "plan_pro", prices: { monthly: price(80000, 8000), yearly: price(800000, 80000) } }],
    });
    api.attachReferralCode.mockResolvedValue(billing());
    const { user } = setup();
    const pro = await screen.findByRole("article", { name: "Pro" });
    await user.type(within(pro).getByLabelText("Discount or voucher code"), "save10");
    await user.click(within(pro).getByRole("button", { name: "Check" }));
    // Judged against the card's plan and cycle (the code's restrictions, migration 725).
    await waitFor(() => expect(api.previewReferralCode).toHaveBeenCalledWith("ws_1", "SAVE10", { planId: "plan_pro", billingCycle: "monthly" }));
    expect(await within(pro).findByText(/With SAVE10: .*720/)).toBeInTheDocument();
    await user.click(within(pro).getByRole("button", { name: "Apply to my store" }));
    await waitFor(() => expect(api.attachReferralCode).toHaveBeenCalledWith("ws_1", "SAVE10", { planId: "plan_pro", billingCycle: "monthly" }));
  });

  it("explains a code that can't be used", async () => {
    api.previewReferralCode.mockRejectedValue(new ApiError("bad", 422, "REFERRAL_CODE_INVALID", {}));
    const { user } = setup();
    const pro = await screen.findByRole("article", { name: "Pro" });
    await user.type(within(pro).getByLabelText("Discount or voucher code"), "nope99");
    await user.click(within(pro).getByRole("button", { name: "Check" }));
    expect(await within(pro).findByRole("alert")).toHaveTextContent("isn't valid");
  });

  it("shows usage against the plan's limits", async () => {
    const { user } = setup();
    await user.click(await screen.findByRole("tab", { name: "Usage" }));
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    expect(screen.getAllByRole("progressbar")).toHaveLength(2);
  });

  it("lists the invoices page by page", async () => {
    const { user } = setup();
    api.listBillingInvoices.mockResolvedValue({
      invoices: [
        fake({ id: "inv_1", status: "paid", periodStart: "2030-01-01", periodEnd: "2030-02-01", grossAmount: 30000, discountAmount: 0, amountDue: 30000, amountPaid: 30000, currency: "EGP", paidAt: "2030-01-01", paymentSource: "manual", createdAt: "2030-01-01" }),
      ],
      page: 1,
      pageSize: 10,
      total: 11,
    });
    await user.click(await screen.findByRole("tab", { name: "Invoices" }));
    expect(await screen.findByText("Paid")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(api.listBillingInvoices).toHaveBeenLastCalledWith("ws_1", { page: 2, pageSize: 10 }));
  });

  it("opens the invoices with the payment's outcome when Fawaterak sends the merchant back", async () => {
    api.getOnlinePayment.mockResolvedValue(fake({ payment: { id: "pay_1", status: "paid" } }));
    setup({ route: "/subscription?payment=pay_1&workspace=ws_1&result=success" });
    expect(await screen.findByRole("tab", { name: "Invoices", selected: true })).toBeInTheDocument();
    await waitFor(() => expect(api.getOnlinePayment).toHaveBeenCalledWith("ws_1", "pay_1"));
  });

  it("is in Arabic for an Arabic dashboard", async () => {
    setup({ locale: "ar" });
    expect(await screen.findByRole("tab", { name: "الخطط", selected: true })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "الفواتير" })).toBeInTheDocument();
    expect(await screen.findByText("خطتك الحالية")).toBeInTheDocument();
  });

  it("says Pay now in Arabic", async () => {
    setup({ locale: "ar", bill: billing({ nextCharge: { grossAmount: 30000, discountAmount: 0, amount: 30000, currency: "EGP" } }) });
    expect(await screen.findByRole("button", { name: "ادفع الآن" })).toHaveAttribute("href", "/subscription?tab=invoices&pay=1");
    expect(screen.getByRole("link", { name: "ادفع واعرض الفواتير" })).toBeInTheDocument();
  });
});

describe("cancelling a pending invoice (PLAN_SWITCH_ENABLED)", () => {
  const pending = (overrides: Partial<MerchantInvoice> = {}) =>
    fake<MerchantInvoice>({
      id: "inv_2",
      status: "pending",
      periodStart: "2030-02-01",
      periodEnd: "2030-03-01",
      grossAmount: 30000,
      discountAmount: 0,
      amountDue: 30000,
      amountPaid: null,
      currency: "EGP",
      paidAt: null,
      paymentSource: null,
      createdAt: "2030-01-25",
      cancellable: true,
      ...overrides,
    });

  function openInvoices(invoices: MerchantInvoice[], { proofs = [] as BillingPaymentProof[], locale = "en" as "en" | "ar" } = {}) {
    api.getPaymentMethods.mockResolvedValue({ methods: [], currency: "EGP", contactSupport: false });
    api.listBillingPaymentProofs.mockResolvedValue({ proofs });
    return setup({ route: "/subscription?tab=invoices", locale, invoices });
  }

  it("asks first, then cancels it and reads the list again", async () => {
    const { user } = openInvoices([pending()]);
    api.cancelBillingCharge.mockImplementation(async () => {
      api.listBillingInvoices.mockResolvedValue({ invoices: [pending({ status: "void", voidReason: "cancelled_by_merchant", cancellable: false })], page: 1, pageSize: 10, total: 1 });
      return { invoice: pending({ status: "void", voidReason: "cancelled_by_merchant", cancellable: false }), plans: view() };
    });
    await user.click(await screen.findByRole("button", { name: "Cancel invoice" }));
    const dialog = await screen.findByRole("dialog", { name: "Cancel this invoice?" });
    expect(within(dialog).getByText(/The invoice of .*300.* is cancelled and nothing is owed for it/)).toBeInTheDocument();
    expect(api.cancelBillingCharge).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Cancel invoice" }));
    await waitFor(() => expect(api.cancelBillingCharge).toHaveBeenCalledWith("ws_1", "inv_2"));
    expect(await screen.findByText("The invoice was cancelled. Nothing is owed for it.")).toBeInTheDocument();
    expect(await screen.findByText("Cancelled by you — not due")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel invoice" })).not.toBeInTheDocument();
  });

  it("Keep it closes the question with nothing sent", async () => {
    const { user } = openInvoices([pending()]);
    await user.click(await screen.findByRole("button", { name: "Cancel invoice" }));
    await user.click(within(await screen.findByRole("dialog", { name: "Cancel this invoice?" })).getByRole("button", { name: "Keep it" }));
    expect(screen.queryByRole("dialog", { name: "Cancel this invoice?" })).not.toBeInTheDocument();
    expect(api.cancelBillingCharge).not.toHaveBeenCalled();
  });

  it("is not offered when the server says no, or an older API says nothing, or a transfer for it is being checked", async () => {
    const { unmount } = openInvoices([pending({ cancellable: false })]);
    expect(await screen.findByText("Due")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel invoice" })).not.toBeInTheDocument();
    unmount();

    const older = openInvoices([pending({ cancellable: undefined })]);
    expect(await screen.findByText("Due")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel invoice" })).not.toBeInTheDocument();
    older.unmount();

    openInvoices([pending()], {
      proofs: [
        fake<BillingPaymentProof>({ id: "pp_1", status: "pending", purpose: "invoice", invoiceId: "inv_2", amount: 30000, currency: "EGP", createdAt: "2030-01-26", reviewNote: null, method: { code: "instapay", label: { ar: "إنستا باي", en: "InstaPay" } } }),
      ],
    });
    expect(await screen.findAllByText(/under review/i)).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Cancel invoice" })).not.toBeInTheDocument();
  });

  it("a refusal is worded, and the invoice stays", async () => {
    const { user } = openInvoices([pending()]);
    api.cancelBillingCharge.mockRejectedValue(new ApiError("proof", 409, "PROOF_UNDER_REVIEW", { invoiceId: "inv_2" }));
    await user.click(await screen.findByRole("button", { name: "Cancel invoice" }));
    const dialog = await screen.findByRole("dialog", { name: "Cancel this invoice?" });
    await user.click(within(dialog).getByRole("button", { name: "Cancel invoice" }));
    expect(await within(dialog).findByText("A transfer for this invoice is being checked. You can cancel it once it has been reviewed.")).toBeInTheDocument();
  });

  it("names why a charge is void", async () => {
    openInvoices([
      pending({ id: "inv_3", status: "void", voidReason: "payment_failed", cancellable: false }),
      pending({ id: "inv_4", status: "void", voidReason: "voided_by_admin", cancellable: false }),
    ]);
    expect(await screen.findByText("Payment didn't go through — not due")).toBeInTheDocument();
    expect(screen.getByText("Cancelled by Zimos — not due")).toBeInTheDocument();
  });

  it("is in Arabic", async () => {
    const { user } = openInvoices([pending()], { locale: "ar" });
    await user.click(await screen.findByRole("button", { name: "إلغاء الفاتورة" }));
    expect(await screen.findByRole("dialog", { name: "إلغاء هذه الفاتورة؟" })).toBeInTheDocument();
  });
});

describe("the tabs row", () => {
  it("scrolls sideways with no scrollbar shown, and never up and down", async () => {
    setup();
    const tablist = await screen.findByRole("tablist");
    expect(tablist).toHaveClass("overflow-x-auto", "overflow-y-hidden", "[scrollbar-width:none]");
    // Nothing hangs below the row: no negative margin on the tabs.
    for (const tab of within(tablist).getAllByRole("tab")) expect(tab.className).not.toMatch(/-mb-px/);
  });
});

describe("Settings and the old return link", () => {
  it("sends a payment return made for Settings to Subscription, with the same query", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", role: "owner" });
    renderWithProviders(<SettingsPage />, { route: "/settings?payment=pay_1&workspace=ws_1&result=success", path: "/settings" });
    await waitFor(() => expect(currentPath()).toBe("/subscription?payment=pay_1&workspace=ws_1&result=success"));
  });
});
