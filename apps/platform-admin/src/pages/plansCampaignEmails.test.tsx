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
 * The plan editor's campaign emails per month (backend migration 748,
 * emailCampaigns/campaignQuota.js): shown and saved like the other limits,
 * and left alone when an API from before it sends nothing.
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

describe("campaign emails per month on a plan", () => {
  it("shows the number on the card and in the editor, and saves a change", async () => {
    api.listPlansWithCatalog.mockResolvedValue({ plans: [{ ...PLAN, maxCampaignEmailsPerMonth: 2500 }], featureCatalog: [] } as never);
    api.savePlan.mockImplementation(async (input) => ({ ...PLAN, ...input, id: "p1" }) as never);
    show();
    expect(await screen.findByText("Campaign emails per month")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Edit/ }));
    const field = (await screen.findByLabelText("Email campaign emails per month")) as HTMLInputElement;
    expect(field.value).toBe("2500");
    fireEvent.change(field, { target: { value: "5000" } });
    fireEvent.click(screen.getByRole("button", { name: "Save plan" }));
    await waitFor(() => expect(api.savePlan).toHaveBeenCalledTimes(1));
    expect(api.savePlan.mock.calls[0][0]).toEqual(expect.objectContaining({ maxCampaignEmailsPerMonth: 5000 }));
  });

  it("saves null for unlimited", async () => {
    api.listPlansWithCatalog.mockResolvedValue({ plans: [{ ...PLAN, maxCampaignEmailsPerMonth: 0 }], featureCatalog: [] } as never);
    api.savePlan.mockImplementation(async (input) => ({ ...PLAN, ...input, id: "p1" }) as never);
    show();
    fireEvent.click(await screen.findByRole("button", { name: /Edit/ }));
    const field = (await screen.findByLabelText("Email campaign emails per month")) as HTMLInputElement;
    const box = field.closest("div.space-y-2")!.querySelector('input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(box);
    fireEvent.click(screen.getByRole("button", { name: "Save plan" }));
    await waitFor(() => expect(api.savePlan).toHaveBeenCalledTimes(1));
    expect(api.savePlan.mock.calls[0][0]).toEqual(expect.objectContaining({ maxCampaignEmailsPerMonth: null }));
  });

  it("leaves it out with an API from before it", async () => {
    api.listPlansWithCatalog.mockResolvedValue({ plans: [PLAN], featureCatalog: [] } as never);
    api.savePlan.mockImplementation(async (input) => ({ ...PLAN, ...input, id: "p1" }) as never);
    show();
    expect(await screen.findByText("Pro")).toBeTruthy();
    expect(screen.queryByText("Campaign emails per month")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Edit/ }));
    expect(screen.queryByLabelText("Email campaign emails per month")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save plan" }));
    await waitFor(() => expect(api.savePlan).toHaveBeenCalledTimes(1));
    expect("maxCampaignEmailsPerMonth" in api.savePlan.mock.calls[0][0]).toBe(false);
  });
});
