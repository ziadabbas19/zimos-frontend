// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPublicOffer, getPublicPlans } from "./plans";

/**
 * GET /plans/public as the pricing page reads it (lib/plans): the list as
 * before, and the pay-per-order plan beside it — kept only when it is what
 * the card can show (a fee, a count of free orders, when the fee is taken),
 * null when the API leaves it out (switched off, or an API from before it).
 */

const PLAN = { id: "p1", name: "Basic", currency: "EGP", monthlyPrice: 10000, yearlyPrice: 100000, trialDays: 14, maxStores: 1, maxFunnelsPerMonth: null, softOrderQuota: null, features: [] };
const PPO = { id: "ppo", name: "Pay per order", currency: "EGP", feePerOrder: 500, freeOrders: 10, feeChargedAt: "confirmation" };

let fetchMock: ReturnType<typeof vi.fn>;
const answer = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test/api/v1");
  vi.stubEnv("INTERNAL_API_BASE_URL", undefined);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("getPublicOffer", () => {
  it("reads the pay-per-order plan beside the list", async () => {
    fetchMock.mockResolvedValueOnce(answer({ plans: [PLAN], payPerOrder: PPO }));
    expect(await getPublicOffer()).toEqual({ plans: [PLAN], payPerOrder: PPO });
  });

  it("has no pay-per-order plan when the API sends null (inactive, hidden, or the balance switched off)", async () => {
    fetchMock.mockResolvedValueOnce(answer({ plans: [PLAN], payPerOrder: null }));
    expect(await getPublicOffer()).toEqual({ plans: [PLAN], payPerOrder: null });
  });

  it("has none from an API that predates it", async () => {
    fetchMock.mockResolvedValueOnce(answer({ plans: [PLAN] }));
    expect(await getPublicOffer()).toEqual({ plans: [PLAN], payPerOrder: null });
  });

  it.each([
    ["no fee", { ...PPO, feePerOrder: 0 }],
    ["a fee that isn't a whole number of minor units", { ...PPO, feePerOrder: 4.5 }],
    ["free orders that aren't a count", { ...PPO, freeOrders: -1 }],
    ["no word on when the fee is taken", { ...PPO, feeChargedAt: undefined }],
    ["no id", { ...PPO, id: undefined }],
  ])("drops a pay-per-order plan with %s", async (_label, payPerOrder) => {
    fetchMock.mockResolvedValueOnce(answer({ plans: [PLAN], payPerOrder }));
    expect((await getPublicOffer())?.payPerOrder).toBeNull();
  });

  it("keeps only the fields the card shows", async () => {
    fetchMock.mockResolvedValueOnce(answer({ plans: [], payPerOrder: { ...PPO, walletDebtLimitAmount: 2500, key: "ppo" } }));
    expect((await getPublicOffer())?.payPerOrder).toEqual(PPO);
  });

  it("is null when the API answers an error, as before", async () => {
    fetchMock.mockResolvedValueOnce(answer({ error: { code: "X" } }, 500));
    expect(await getPublicOffer()).toBeNull();
  });
});

describe("getPublicPlans", () => {
  it("is still the list alone", async () => {
    fetchMock.mockResolvedValueOnce(answer({ plans: [PLAN], payPerOrder: PPO }));
    expect(await getPublicPlans()).toEqual([PLAN]);
  });
});
