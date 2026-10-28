import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminPlan, AdminReferralCodeDetail, AdminReferralCodeRow, AdminReferralSimulation } from "@store-builder/api-client";
import { ToastProvider } from "@/components/Toast";
import { LocaleProvider } from "@/i18n/LocaleContext";
import * as adminApi from "@/lib/adminApi";
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

  it("the simulator shows the first payments of the unsaved settings", async () => {
    const sim: AdminReferralSimulation = {
      plan: { id: "p1", name: "Basic", currency: "EGP" },
      cycle: "monthly",
      currency: "EGP",
      commissionBasis: "paid",
      rows: Array.from({ length: 12 }, (_, i) => ({
        paymentNo: i + 1,
        listPrice: 30000,
        discount: i === 0 ? 30000 : 0,
        merchantPays: i === 0 ? 0 : 30000,
        commissionRateBp: null,
        commission: 0,
        platformNet: i === 0 ? 0 : 30000,
      })),
      totals: { listPrice: 360000, discount: 30000, merchantPays: 330000, commission: 0, platformNet: 330000 },
    };
    mocked.simulateReferralCode.mockResolvedValue(sim);
    renderAt("/referral-codes");
    fireEvent.click(await screen.findByRole("button", { name: /New code/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Percent"), { target: { value: "100" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Show payments" }));
    await waitFor(() => expect(mocked.simulateReferralCode).toHaveBeenCalled());
    expect(mocked.simulateReferralCode.mock.calls[0][0]).toMatchObject({ planId: "p1", billingCycle: "monthly", hasAgent: false });
    const table = within(within(dialog).getByRole("region", { name: "Simulator" })).getByRole("table");
    // A header, twelve payments and the total.
    expect(within(table).getAllByRole("row")).toHaveLength(14);
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
