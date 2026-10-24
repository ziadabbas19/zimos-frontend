// @vitest-environment node
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The server components' API client (lib/serverApiClient.ts) on the API's
 * private address: the public one while INTERNAL_API_BASE_URL is unset, the
 * private one when set, the public one again for a call the private address
 * couldn't take — with the same headers, the shopper's IP and the storefront's
 * secret included — and no second try once the API has answered.
 */

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": "203.0.113.7" }),
  cookies: async () => ({ get: () => undefined }),
}));

const PUBLIC = "https://api.example.test/api/v1";
const PRIVATE = "http://backend.railway.internal:8080/api/v1";
let fetchMock: ReturnType<typeof vi.fn>;

const answer = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const refused = () => Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }) });

async function client(internal: string | undefined) {
  vi.stubEnv("INTERNAL_API_BASE_URL", internal);
  vi.resetModules();
  const { createServerStorefrontApiClient } = await import("./serverApiClient");
  return createServerStorefrontApiClient();
}

// The first load transforms the API client (a large file); the tests reload it per case.
beforeAll(async () => {
  await import("./serverApiClient");
}, 60_000);

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", PUBLIC);
  vi.stubEnv("NEXT_PHASE", undefined);
  vi.stubEnv("STOREFRONT_PROXY_SECRET", "proxy-secret");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("createServerStorefrontApiClient", () => {
  it("calls the public address while INTERNAL_API_BASE_URL is unset, as before", async () => {
    fetchMock.mockResolvedValueOnce(answer(200, { ok: true }));
    const api = await client(undefined);
    expect(await api.request("/store/ws-1/meta", { auth: false })).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${PUBLIC}/store/ws-1/meta`);
    expect(fetchMock.mock.calls[0][1].headers["X-Storefront-Secret"]).toBe("proxy-secret");
  });

  it("calls the private address when it is set", async () => {
    fetchMock.mockResolvedValueOnce(answer(200, { ok: true }));
    const api = await client(PRIVATE);
    await api.request("/store/ws-1/meta", { auth: false });
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([`${PRIVATE}/store/ws-1/meta`]);
  });

  it("sends a call the private address refused once more to the public one, headers and all", async () => {
    fetchMock.mockRejectedValueOnce(refused()).mockResolvedValueOnce(answer(200, { ok: true }));
    const api = await client(PRIVATE);
    expect(await api.request("/store/ws-1/meta", { auth: false })).toEqual({ ok: true });
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([`${PRIVATE}/store/ws-1/meta`, `${PUBLIC}/store/ws-1/meta`]);
    const sent = fetchMock.mock.calls[1][1].headers;
    expect(sent["X-Storefront-Secret"]).toBe("proxy-secret");
    expect(sent["X-Storefront-Client-IP"]).toBe("203.0.113.7");
  });

  it("does not try again after a 404 or a 403: the API's answer stands", async () => {
    const api = await client(PRIVATE);
    fetchMock.mockResolvedValueOnce(answer(404, { error: { code: "NOT_FOUND", message: "No such page" } }));
    await expect(api.request("/store/ws-1/pages/x", { auth: false })).rejects.toMatchObject({ status: 404 });
    fetchMock.mockResolvedValueOnce(answer(403, { error: { code: "FORBIDDEN" } }));
    await expect(api.request("/store/ws-1/pages/y", { auth: false })).rejects.toMatchObject({ status: 403 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every((call) => String(call[0]).startsWith(PRIVATE))).toBe(true);
  });
});
