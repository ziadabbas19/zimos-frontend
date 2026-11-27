import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminAgentLinkRequest, AdminPlan, AdminReferralCodeDetail, AdminReferralCodeRow, AdminReferralSimulation } from "@store-builder/api-client";
import { ToastProvider } from "@/components/Toast";
import { LocaleProvider, useLocale } from "@/i18n/LocaleContext";
import * as adminApi from "@/lib/adminApi";
import { ApiError } from "@/lib/errors";
import { ReferralCodesPage } from "./ReferralCodesPage";
import { ReferralCodeDetailPage } from "./ReferralCodeDetailPage";

/**
 * Agents → Referral codes with the API mocked (migration 725): the list with
 * its uses and audience, a new code from the form in the API's units, the
 * simulator on unsaved values, and the warning before a code in use is
 * switched off.
 */

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ can: () => true, user: { id: "me" } }),
}));

vi.mock("@/lib/adminApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/adminApi")>();
  return {
    ...actual,
    listReferralCodes: vi.fn(),
    listAgents: vi.fn(),
    listPlans: vi.fn(),
    createStandaloneReferralCode: vi.fn(),
    simulateReferralCode: vi.fn(),
    getReferralCode: vi.fn(),
    listCodeRedemptions: vi.fn(),
    updateReferralCode: vi.fn(),
    listAgentLinkRequests: vi.fn(),
  };
});

const mocked = vi.mocked(adminApi);

const CODE: AdminReferralCodeRow = {
  id: "c1",
  agentId: null,
  agent: null,
  code: "WELCOME",
  label: "Launch",
  discountType: "none",
  discountValue: null,
  discountCurrency: null,
  commissionRateBp: null,
  effectiveCommissionRateBp: 3000,
  active: true,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  kind: "schedule",
  state: "active",
  audience: "new",
  startsAt: null,
  endsAt: null,
  maxUses: 100,
  usesCount: 12,
  allowedPlanIds: [],
  allowedCycles: [],
  minPrice: null,
  terms: {
    monthly: { discount: [{ count: 1, type: "percentage", value: 10000 }], commission: [] },
    yearly: { discount: [{ count: 1, type: "percentage", value: 10000 }], commission: [] },
  },
  commissionBasis: "paid",
  linksAgent: true,
  grant: null,
  merchantsReferred: 12,
  commission: [],
};

const PLAN = { id: "p1", name: "Basic", monthlyPrice: 30000, yearlyPrice: 300000, currency: "EGP" } as unknown as AdminPlan;

function renderAt(path: string) {
  return render(
    <LocaleProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/referral-codes" element={<ReferralCodesPage />} />
            <Route path="/referral-codes/:id" element={<ReferralCodeDetailPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </LocaleProvider>
  );
}

beforeEach(() => {
  mocked.listReferralCodes.mockResolvedValue({ codes: [CODE], total: 1, limit: 50, offset: 0, defaultCommissionRateBp: 3000, v2Enabled: true });
  mocked.listAgents.mockResolvedValue({ agents: [], defaultCommissionRateBp: 3000 });
  mocked.listPlans.mockResolvedValue([PLAN]);
  mocked.listCodeRedemptions.mockResolvedValue({ redemptions: [], total: 0, limit: 50, offset: 0 });
  mocked.listAgentLinkRequests.mockResolvedValue({ requests: [], total: 0, limit: 50, offset: 0 });
  mocked.simulateReferralCode.mockResolvedValue({
    plan: { id: "p1", name: "Basic", currency: "EGP" },
    cycle: "monthly",
    currency: "EGP",
    commissionBasis: "paid",
    rows: [],
    totals: { listPrice: 0, discount: 0, merchantPays: 0, commission: 0, platformNet: 0 },
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("the list", () => {
  it("shows each code's discount, who can enter it, its uses of its limit and its state", async () => {
    renderAt("/referral-codes");
    const row = (await screen.findByText("WELCOME")).closest("tr")!;
    expect(within(row).getByText("No agent")).toBeTruthy();
    expect(within(row).getByText("100% off on the first payment")).toBeTruthy();
    expect(within(row).getByText("New merchants only")).toBeTruthy();
    expect(within(row).getByText("12 / 100")).toBeTruthy();
    expect(within(row).getByText("Active")).toBeTruthy();
  });

  it("with the flag off: no New code, and a notice", async () => {
    mocked.listReferralCodes.mockResolvedValue({ codes: [CODE], total: 1, limit: 50, offset: 0, defaultCommissionRateBp: 3000, v2Enabled: false });
    renderAt("/referral-codes");
    expect(await screen.findByText(/REFERRAL_CODES_V2_ENABLED/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /New code/ })).toBeNull();
  });
});

// The mocked viewer ("me") holds every key and is not a creator.
describe("the review (migration 743)", () => {
  const detail = (authorIds: string[]): AdminReferralCodeDetail => ({
    code: { ...CODE, active: false, approvalStatus: "pending", authorIds },
    impact: { currentStores: 0, trialingUnpaid: 0 },
    defaultCommissionRateBp: 3000,
    v2Enabled: true,
  });
  const linkRequest = (id: string, name: string, authorIds: string[]): AdminAgentLinkRequest => ({
    id,
    workspaceId: `w-${id}`,
    workspace: { id: `w-${id}`, name },
    linkId: null,
    kind: "link",
    changes: {},
    agent: { id: "a1", fullName: "An Agent" },
    status: "pending",
    reason: null,
    requestedBy: null,
    reviewedBy: null,
    reviewedAt: null,
    authorIds,
    createdAt: "2026-10-01T00:00:00.000Z",
  });

  it("offers Approve and Reject on someone else's code", async () => {
    mocked.getReferralCode.mockResolvedValue(detail(["someone"]));
    renderAt("/referral-codes/c1");
    expect(await screen.findByRole("button", { name: /^Approve$/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Reject$/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Edit and approve/ })).toBeTruthy();
  });

  it("takes them away on a code the viewer made or changed, and says why", async () => {
    mocked.getReferralCode.mockResolvedValue(detail(["someone", "me"]));
    renderAt("/referral-codes/c1");
    expect(await screen.findByText(/someone else has to review it/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Approve$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Reject$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Edit and approve/ })).toBeNull();
  });

  it("offers review on a store's agent change only when the viewer didn't ask for it", async () => {
    mocked.listAgentLinkRequests.mockResolvedValue({
      requests: [linkRequest("r1", "Theirs", ["someone"]), linkRequest("r2", "Mine", ["me"])],
      total: 2,
      limit: 50,
      offset: 0,
    });
    renderAt("/referral-codes");
    const row = (name: string) => screen.getByText(name).closest("li")!;
    await screen.findByText("Theirs");
    expect(within(row("Theirs")).getByRole("button", { name: "Approve" })).toBeTruthy();
    expect(within(row("Theirs")).getByRole("button", { name: "Reject" })).toBeTruthy();
    expect(within(row("Mine")).queryByRole("button", { name: "Approve" })).toBeNull();
    expect(within(row("Mine")).queryByRole("button", { name: "Reject" })).toBeNull();
    expect(within(row("Mine")).getByText(/someone else has to review it/)).toBeTruthy();
  });
});

describe("a new code", () => {
  it("sends the form in the API's units: no agent, first payment only, a use limit", async () => {
    mocked.createStandaloneReferralCode.mockResolvedValue({ ...CODE, id: "c2", code: "SPRING" });
    renderAt("/referral-codes");
    fireEvent.click(await screen.findByRole("button", { name: /New code/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/^Code/), { target: { value: "spring" } });
    fireEvent.change(within(dialog).getByLabelText(/Use limit/), { target: { value: "50" } });
    fireEvent.change(within(dialog).getByLabelText("Percent"), { target: { value: "25" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create code" }));
    await waitFor(() => expect(mocked.createStandaloneReferralCode).toHaveBeenCalled());
    const input = mocked.createStandaloneReferralCode.mock.calls[0][0];
    expect(input).toMatchObject({ code: "SPRING", agentId: null, audience: "new", maxUses: 50, commissionBasis: "paid" });
    expect(input.terms?.monthly.discount).toEqual([{ count: 1, type: "percentage", value: 2500 }]);
    expect(input.terms?.yearly).toEqual(input.terms?.monthly);
  });

  // The period chosen at the top is the one previewed: a yearly code is priced on the yearly price.
  const simulation = (cycle: "monthly" | "yearly", list: number, discount: number): AdminReferralSimulation => ({
    plan: { id: "p1", name: "Basic", currency: "EGP" },
    cycle,
    currency: "EGP",
    commissionBasis: "paid",
    rows: Array.from({ length: 12 }, (_, i) => ({
      paymentNo: i + 1,
      listPrice: list,
      discount: i === 0 ? discount : 0,
      merchantPays: i === 0 ? list - discount : list,
      commissionRateBp: null,
      commission: 0,
      platformNet: i === 0 ? list - discount : list,
    })),
    totals: { listPrice: list * 12, discount, merchantPays: list * 12 - discount, commission: 0, platformNet: list * 12 - discount },
  });

  it("puts the period first and previews what the customer pays on that period, live", async () => {
    mocked.simulateReferralCode.mockImplementation(async (body) =>
      body.billingCycle === "yearly" ? simulation("yearly", 300000, 75000) : simulation("monthly", 30000, 7500)
    );
    renderAt("/referral-codes");
    fireEvent.click(await screen.findByRole("button", { name: /New code/ }));
    const dialog = await screen.findByRole("dialog");
    const period = within(dialog).getByRole("group", { name: "Billing period" });
    // First in the form.
    expect(dialog.querySelector("form fieldset")).toBe(period);
    expect((within(period).getByRole("radio", { name: "Monthly" }) as HTMLInputElement).checked).toBe(true);

    const preview = within(dialog).getByRole("region", { name: "What the customer pays" });
    expect(within(preview).getByText("Fill in the discount to see what the customer pays.")).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText("Percent"), { target: { value: "25" } });
    expect(await within(preview).findByText(/The customer pays EGP\s?225(\.00)? instead of EGP\s?300(\.00)? on the first payment \(Monthly\)\./)).toBeTruthy();

    fireEvent.click(within(period).getByRole("radio", { name: "Yearly" }));
    expect(await within(preview).findByText(/The customer pays EGP\s?2,250(\.00)? instead of EGP\s?3,000(\.00)? on the first payment \(Yearly\)\./)).toBeTruthy();
    const last = mocked.simulateReferralCode.mock.calls.at(-1)![0];
    expect(last).toMatchObject({ planId: "p1", billingCycle: "yearly", hasAgent: false });
    // The same schedule is sent for both periods while they share one.
    expect(last.terms.yearly).toEqual(last.terms.monthly);

    // All twelve payments on demand: a header, twelve payments and the total.
    fireEvent.click(within(preview).getByText("All 12 payments"));
    expect(within(within(preview).getByRole("table")).getAllByRole("row")).toHaveLength(14);
  });

  it("shows only the chosen period's discount once the periods differ, and saves each", async () => {
    mocked.simulateReferralCode.mockResolvedValue(simulation("monthly", 30000, 0));
    mocked.createStandaloneReferralCode.mockResolvedValue({ ...CODE, id: "c3", code: "YEARLY" });
    renderAt("/referral-codes");
    fireEvent.click(await screen.findByRole("button", { name: /New code/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/^Code/), { target: { value: "yearly" } });
    fireEvent.click(within(dialog).getByRole("switch", { name: "Same for monthly and yearly" }));
    fireEvent.change(within(dialog).getByLabelText("Percent"), { target: { value: "10" } });
    fireEvent.click(within(dialog).getByRole("radio", { name: "Yearly" }));
    expect(within(dialog).getByRole("heading", { name: "Discount · Yearly" })).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText("Percent"), { target: { value: "30" } });
    // Limited to yearly from "Who can use it".
    fireEvent.change(within(dialog).getByLabelText("Periods it works on"), { target: { value: "yearly" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create code" }));
    await waitFor(() => expect(mocked.createStandaloneReferralCode).toHaveBeenCalled());
    const input = mocked.createStandaloneReferralCode.mock.calls[0][0];
    expect(input.allowedCycles).toEqual(["yearly"]);
    expect(input.terms?.monthly.discount).toEqual([{ count: 1, type: "percentage", value: 1000 }]);
    expect(input.terms?.yearly.discount).toEqual([{ count: 1, type: "percentage", value: 3000 }]);
  });

  it("keeps the rarely used fields under Advanced options", async () => {
    renderAt("/referral-codes");
    fireEvent.click(await screen.findByRole("button", { name: /New code/ }));
    const dialog = await screen.findByRole("dialog");
    const advanced = within(dialog).getByText("Advanced options").closest("details")!;
    expect(advanced.open).toBe(false);
    expect(within(advanced).getByLabelText("Minimum plan price")).toBeTruthy();
    expect(within(advanced).getByLabelText("One-time benefit")).toBeTruthy();
  });
});

describe("the code page", () => {
  it("warns how many trials lose the discount before switching a code in use off", async () => {
    const detail: AdminReferralCodeDetail = { code: CODE, impact: { currentStores: 5, trialingUnpaid: 3 }, defaultCommissionRateBp: 3000, v2Enabled: true };
    mocked.getReferralCode.mockResolvedValue(detail);
    renderAt("/referral-codes/c1");
    expect(await screen.findByText(/3 on a trial haven't paid yet/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Edit/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("switch", { name: "Active" }));
    expect(within(dialog).getByRole("alert").textContent).toContain("3 store(s) on a trial entered this code and haven't paid yet");
  });
});

describe("in Arabic", () => {
  const LOCALE_KEY = "zimos.console.locale";
  beforeEach(() => localStorage.setItem(LOCALE_KEY, "ar"));
  afterEach(() => {
    localStorage.removeItem(LOCALE_KEY);
    document.documentElement.dir = "ltr";
    document.documentElement.lang = "en";
  });

  it("the list reads right to left: its helpers' words, the code kept left to right, the arrow turned", async () => {
    const dated = { ...CODE, startsAt: "2026-10-01T00:00:00.000Z", endsAt: "2026-12-01T00:00:00.000Z" };
    mocked.listReferralCodes.mockResolvedValue({ codes: [dated], total: 1, limit: 50, offset: 0, defaultCommissionRateBp: 3000, v2Enabled: true });
    renderAt("/referral-codes");
    const code = await screen.findByText("WELCOME");
    expect(code.getAttribute("dir")).toBe("ltr");
    const row = code.closest("tr")!;
    expect(within(row).getByText("بلا وكيل")).toBeTruthy();
    expect(within(row).getByText("خصم 100% على الدفعة الأولى")).toBeTruthy();
    expect(within(row).getByText("التجار الجدد فقط")).toBeTruthy();
    expect(within(row).getByText("نشط")).toBeTruthy();
    expect(row.textContent).toContain("←");
    expect(row.textContent).not.toContain("→");
    expect(document.documentElement.dir).toBe("rtl");
  });

  it("a waiting change lists only what it alters, by its Arabic labels", async () => {
    const proposed = { ...CODE, audience: "any" as const };
    const detail: AdminReferralCodeDetail = {
      code: { ...CODE, approvalStatus: "pending", proposed },
      impact: { currentStores: 0, trialingUnpaid: 0 },
      defaultCommissionRateBp: 3000,
      v2Enabled: true,
    };
    mocked.getReferralCode.mockResolvedValue(detail);
    renderAt("/referral-codes/c1");
    const heading = await screen.findByRole("heading", { name: "يوجد تعديل بانتظار المراجعة" });
    const rows = within(heading.parentElement!.querySelector("dl")!).getAllByRole("definition");
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toBe("\u2068التجار الجدد فقط\u2069 ← \u2068التجار الجدد والحاليون\u2069");
  });

  it("a validation message and a refusal from the API arrive in Arabic", async () => {
    mocked.createStandaloneReferralCode.mockRejectedValue(new ApiError("The code SPRING is already taken.", 409, "REFERRAL_CODE_TAKEN"));
    renderAt("/referral-codes");
    fireEvent.click(await screen.findByRole("button", { name: /كود جديد/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/^الكود/), { target: { value: "spring" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "إنشاء الكود" }));
    expect(await within(dialog).findByText("الخصم (شهري)، المرحلة 1: أدخل خصمًا أكبر من صفر.")).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText("النسبة"), { target: { value: "25" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "إنشاء الكود" }));
    expect(await within(dialog).findByText("هذا الكود مستخدم بالفعل.")).toBeTruthy();
  });

  it("switching language in place changes what the plain helpers say", async () => {
    localStorage.removeItem(LOCALE_KEY);
    function Switch() {
      const { toggleLocale } = useLocale();
      return <button onClick={toggleLocale}>switch</button>;
    }
    render(
      <LocaleProvider>
        <ToastProvider>
          <Switch />
          <MemoryRouter>
            <ReferralCodesPage />
          </MemoryRouter>
        </ToastProvider>
      </LocaleProvider>
    );
    const row = (await screen.findByText("WELCOME")).closest("tr")!;
    expect(within(row).getByText("New merchants only")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "switch" }));
    expect(await within(row).findByText("التجار الجدد فقط")).toBeTruthy();
    expect(within(row).getByText("خصم 100% على الدفعة الأولى")).toBeTruthy();
    expect(within(row).queryByText("New merchants only")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "switch" }));
    expect(await within(row).findByText("New merchants only")).toBeTruthy();
  });
});
