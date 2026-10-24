// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * This site's server calls to the API (lib/server-api.ts, used by lib/plans
 * and lib/platform-settings): the public address exactly as before while
 * INTERNAL_API_BASE_URL is unset; the private one when it is set (but never
 * during `next build`); one more try on the public address only when the
 * private one could not be reached — never after an answer, whatever its
 * status.
 */

const PUBLIC = "https://api.example.test/api/v1";
const PRIVATE = "http://backend.railway.internal:8080/api/v1";
let fetchMock: ReturnType<typeof vi.fn>;
let warn: ReturnType<typeof vi.spyOn>;

const answer = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
function unreachable(code: string) {
  return Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error(`connect ${code}`), { code }) });
}
const PLANS = { plans: [{ id: "p1", name: "Basic", currency: "EGP", monthlyPrice: 10000, yearlyPrice: 100000, trialDays: 14, maxStores: 1, maxFunnelsPerMonth: null, softOrderQuota: null, features: [] }] };

async function load(internal: string | undefined) {
  vi.stubEnv("INTERNAL_API_BASE_URL", internal);
  vi.resetModules();
  return {
    api: await import("./server-api"),
    plans: await import("./plans"),
    settings: await import("./platform-settings"),
  };
}

const urls = () => fetchMock.mock.calls.map((call) => String(call[0]));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", PUBLIC);
  vi.stubEnv("NEXT_PHASE", undefined);
  vi.stubEnv("PLATFORM_SETTINGS_ENABLED", "true");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("without INTERNAL_API_BASE_URL — the old behaviour", () => {
  it("reads the plans and the platform details on the public address, once each", async () => {
    const { api, plans, settings } = await load(undefined);
    expect(api.serverApiBase()).toBe(PUBLIC);
    fetchMock.mockResolvedValueOnce(answer(200, PLANS)).mockResolvedValueOnce(answer(200, { settings: {} }));
    expect(await plans.getPublicPlans()).toEqual(PLANS.plans);
    await settings.getPlatformSettings();
    expect(urls()).toEqual([`${PUBLIC}/plans/public`, `${PUBLIC}/platform-settings/public`]);
    for (const [, init] of fetchMock.mock.calls) expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(fetchMock.mock.calls[0][1].next).toEqual({ revalidate: plans.PLANS_REVALIDATE_SECONDS });
  });

  it("never sends a call again, even when the API can't be reached", async () => {
    const { plans } = await load(undefined);
    fetchMock.mockRejectedValue(unreachable("ECONNREFUSED"));
    expect(await plans.getPublicPlans()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("with INTERNAL_API_BASE_URL", () => {
  it("reads them on the private address", async () => {
    const { api, plans, settings } = await load(`${PRIVATE}/`);
    expect(api.serverApiBase()).toBe(PRIVATE);
    fetchMock.mockResolvedValueOnce(answer(200, PLANS)).mockResolvedValueOnce(answer(200, { settings: {} }));
    expect(await plans.getPublicPlans()).toEqual(PLANS.plans);
    await settings.getPlatformSettings();
    expect(urls()).toEqual([`${PRIVATE}/plans/public`, `${PRIVATE}/platform-settings/public`]);
  });

  it("reads the public address while `next build` runs: the private network only exists at run time", async () => {
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    const { plans } = await load(PRIVATE);
    fetchMock.mockResolvedValueOnce(answer(200, PLANS));
    await plans.getPublicPlans();
    expect(urls()).toEqual([`${PUBLIC}/plans/public`]);
  });

  it("ignores a value that isn't a plain http(s) URL", async () => {
    const { api } = await load("backend.railway.internal:8080");
    expect(api.serverApiBase()).toBe(PUBLIC);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  for (const code of ["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT"]) {
    it(`asks the public address once when the private one can't be reached (${code})`, async () => {
      const { plans } = await load(PRIVATE);
      fetchMock.mockRejectedValueOnce(unreachable(code)).mockResolvedValueOnce(answer(200, PLANS));
      expect(await plans.getPublicPlans()).toEqual(PLANS.plans);
      expect(urls()).toEqual([`${PRIVATE}/plans/public`, `${PUBLIC}/plans/public`]);
      expect(fetchMock.mock.calls[1][1].next).toEqual({ revalidate: plans.PLANS_REVALIDATE_SECONDS });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain(code);
      expect(String(warn.mock.calls[0][0])).not.toContain("/plans/public");
    });
  }

  it("tries only once: the public address failing too gives the page's usual null", async () => {
    const { plans } = await load(PRIVATE);
    fetchMock.mockRejectedValue(unreachable("ECONNREFUSED"));
    expect(await plans.getPublicPlans()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  for (const status of [403, 404, 500, 503]) {
    it(`does not ask again after the API answered ${status}`, async () => {
      const { plans, settings } = await load(PRIVATE);
      fetchMock.mockImplementation(async () => answer(status, { error: { code: "X" } }));
      expect(await plans.getPublicPlans()).toBeNull();
      expect(await settings.getPlatformSettings()).toBeNull();
      expect(urls()).toEqual([`${PRIVATE}/plans/public`, `${PRIVATE}/platform-settings/public`]);
      expect(warn).not.toHaveBeenCalled();
    });
  }

  it("asks the public address again for a GET that ran out of time, with a fresh timer", async () => {
    const { api } = await load(PRIVATE);
    fetchMock
      .mockImplementationOnce(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(init.signal?.reason)))
      )
      .mockResolvedValueOnce(answer(200));
    const res = await api.serverApiFetch(`${PRIVATE}/plans/public`, {}, { timeoutMs: 200 });
    expect(res.status).toBe(200);
    expect(urls()).toEqual([`${PRIVATE}/plans/public`, `${PUBLIC}/plans/public`]);
    expect((fetchMock.mock.calls[1][1].signal as AbortSignal).aborted).toBe(false);
  });

  it("does not send again a POST that ran out of time", async () => {
    const { api } = await load(PRIVATE);
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(init.signal?.reason)))
    );
    await expect(api.serverApiFetch(`${PRIVATE}/x`, { method: "POST" }, { timeoutMs: 30 })).rejects.toMatchObject({ name: "TimeoutError" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
