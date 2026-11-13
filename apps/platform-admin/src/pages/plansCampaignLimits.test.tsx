import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@store-builder/api-client";
import { ToastProvider } from "@/components/Toast";
import { LocaleProvider } from "@/i18n/LocaleContext";
import * as adminApi from "@/lib/adminApi";
import { hasPermission, type PermissionCheck } from "@/lib/permissions";
import { PlansPage } from "./PlansPage";

/**
 * The plan editor's campaigns per month and recipients per campaign (backend
 * migration 749, emailCampaigns/campaignQuota.js): shown on the card and in
 * the editor beside the campaign emails per month, saved like the other
 * limits (null for Unlimited), in English and Arabic, and left out when an
 * API from before them sends nothing.
 */

const h = vi.hoisted(() => ({ user: { id: "me", email: "me@example.com", platformRole: "creator", platformPermissions: [] } as unknown as AuthUser }));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: h.user, can: (permission: PermissionCheck) => hasPermission(h.user, permission) }),
}));

vi.mock("@/lib/adminApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/adminApi")>();
  return { ...actual, listPlansWithCatalog: vi.fn(), savePlan: vi.fn() };
});

const api = vi.mocked(adminApi);

const PLAN = {
  id: "p1",
  code: "pro",
  name: "Pro",
  active: true,
  isPublic: true,
  displayOrder: 1,
  monthlyPrice: 100000,
  yearlyPrice: 1000000,
  currency: "EGP",
  trialDays: 0,
  maxStores: 1,
  maxFunnelsPerMonth: 10,
  orderQuota: null,
  transactionFeeBp: 0,
  codFeeBp: 0,
  features: [],
  updatedAt: "2026-11-01T00:00:00Z",
};

function show() {
  render(
    <LocaleProvider>
      <ToastProvider>
        <MemoryRouter>
          <PlansPage />
        </MemoryRouter>
      </ToastProvider>
    </LocaleProvider>
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const LIMITS = { maxCampaignEmailsPerMonth: 2500, maxCampaignsPerMonth: 4, maxRecipientsPerCampaign: 2000 };
const unlimitedBoxOf = (field: HTMLElement) => field.closest("div.space-y-2")!.querySelector('input[type="checkbox"]') as HTMLInputElement;

describe("campaign limits on a plan", () => {
  it("shows both on the card and in the editor, and saves a change", async () => {
    api.listPlansWithCatalog.mockResolvedValue({ plans: [{ ...PLAN, ...LIMITS }], featureCatalog: [] } as never);
    api.savePlan.mockImplementation(async (input) => ({ ...PLAN, ...input, id: "p1" }) as never);
    show();
    expect(await screen.findByText("Campaigns per month")).toBeTruthy();
    expect(screen.getByText("Recipients per campaign")).toBeTruthy();
    expect(screen.getByText("2,000")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Edit/ }));
    const campaigns = (await screen.findByLabelText("Email campaigns per month")) as HTMLInputElement;
    const recipients = screen.getByLabelText("Recipients per campaign", { selector: "input" }) as HTMLInputElement;
    expect(campaigns.value).toBe("4");
    expect(recipients.value).toBe("2000");
    fireEvent.change(campaigns, { target: { value: "8" } });
    fireEvent.change(recipients, { target: { value: "5000" } });
    fireEvent.click(screen.getByRole("button", { name: "Save plan" }));
    await waitFor(() => expect(api.savePlan).toHaveBeenCalledTimes(1));
    expect(api.savePlan.mock.calls[0][0]).toEqual(expect.objectContaining({ maxCampaignEmailsPerMonth: 2500, maxCampaignsPerMonth: 8, maxRecipientsPerCampaign: 5000 }));
  });

  it("saves null for Unlimited, and shows Unlimited for null", async () => {
    api.listPlansWithCatalog.mockResolvedValue({ plans: [{ ...PLAN, ...LIMITS, maxRecipientsPerCampaign: null }], featureCatalog: [] } as never);
    api.savePlan.mockImplementation(async (input) => ({ ...PLAN, ...input, id: "p1" }) as never);
    show();
    fireEvent.click(await screen.findByRole("button", { name: /Edit/ }));
    const campaigns = (await screen.findByLabelText("Email campaigns per month")) as HTMLInputElement;
    const recipientsBox = unlimitedBoxOf(screen.getByLabelText("Recipients per campaign", { selector: "input" }));
    expect(recipientsBox.checked).toBe(true);
    fireEvent.click(unlimitedBoxOf(campaigns));
    fireEvent.click(screen.getByRole("button", { name: "Save plan" }));
    await waitFor(() => expect(api.savePlan).toHaveBeenCalledTimes(1));
    expect(api.savePlan.mock.calls[0][0]).toEqual(expect.objectContaining({ maxCampaignsPerMonth: null, maxRecipientsPerCampaign: null }));
  });

  it("refuses a recipients limit under 1", async () => {
    api.listPlansWithCatalog.mockResolvedValue({ plans: [{ ...PLAN, ...LIMITS }], featureCatalog: [] } as never);
    show();
    fireEvent.click(await screen.findByRole("button", { name: /Edit/ }));
    const recipients = screen.getByLabelText("Recipients per campaign", { selector: "input" }) as HTMLInputElement;
    fireEvent.change(recipients, { target: { value: "0" } });
    // The browser's own check stops it first (min 1)…
    expect(recipients.validity.rangeUnderflow).toBe(true);
    // …and the form's own, should a browser let it through.
    fireEvent.submit(document.getElementById("plan-form")!);
    expect(await screen.findByText("Recipients per campaign must be a whole number (1 or more) — or tick Unlimited.")).toBeTruthy();
    expect(api.savePlan).not.toHaveBeenCalled();
  });

  it("leaves both out with an API from before them", async () => {
    api.listPlansWithCatalog.mockResolvedValue({ plans: [{ ...PLAN, maxCampaignEmailsPerMonth: 2500 }], featureCatalog: [] } as never);
    api.savePlan.mockImplementation(async (input) => ({ ...PLAN, ...input, id: "p1" }) as never);
    show();
    expect(await screen.findByText("Campaign emails per month")).toBeTruthy();
    expect(screen.queryByText("Campaigns per month")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Edit/ }));
    expect(screen.queryByLabelText("Email campaigns per month")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save plan" }));
    await waitFor(() => expect(api.savePlan).toHaveBeenCalledTimes(1));
    const sent = api.savePlan.mock.calls[0][0];
    expect("maxCampaignsPerMonth" in sent).toBe(false);
    expect("maxRecipientsPerCampaign" in sent).toBe(false);
    expect(sent).toEqual(expect.objectContaining({ maxCampaignEmailsPerMonth: 2500 }));
  });

  it("speaks Arabic, right to left", async () => {
    localStorage.setItem("zimos.console.locale", "ar");
    try {
      api.listPlansWithCatalog.mockResolvedValue({ plans: [{ ...PLAN, ...LIMITS }], featureCatalog: [] } as never);
      show();
      expect(await screen.findByText("الحملات شهريًا")).toBeTruthy();
      expect(screen.getByText("المستلمون لكل حملة")).toBeTruthy();
      expect(document.documentElement.dir).toBe("rtl");
    } finally {
      localStorage.removeItem("zimos.console.locale");
    }
  });
});
