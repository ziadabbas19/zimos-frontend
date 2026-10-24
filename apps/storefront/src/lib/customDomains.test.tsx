// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The proxy's custom-domain lookup (lib/customDomains.ts) on the API's
 * private address: the public one while INTERNAL_API_BASE_URL is unset, the
 * private one when set, the public one again when the private one refused,
 * and no second try once the API has answered — a 404 is remembered as an
 * unknown host, as before.
 */

const PUBLIC = "https://api.example.test/api/v1";
const PRIVATE = "http://backend.railway.internal:8080/api/v1";
const LOOKUP = "/store/resolve-host?host=shop.example.com";
let fetchMock: ReturnType<typeof vi.fn>;

const answer = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const found = () => answer(200, { store: { slug: "shop", homeFunnel: null, primaryHost: null } });
const refused = () => Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }) });
const SHOP = { slug: "shop", homeFunnelRef: null, primaryHost: null };

async function load(internal: string | undefined) {
  vi.stubEnv("INTERNAL_API_BASE_URL", internal);
  vi.resetModules();
  return import("./customDomains");
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", PUBLIC);
  vi.stubEnv("NEXT_PHASE", undefined);
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

describe("resolveCustomHost", () => {
  it("asks the public address while INTERNAL_API_BASE_URL is unset, with its time limit, as before", async () => {
    const { resolveCustomHost } = await load(undefined);
    fetchMock.mockResolvedValueOnce(found());
    expect(await resolveCustomHost("shop.example.com")).toEqual(SHOP);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${PUBLIC}${LOOKUP}`);
    expect(init.headers).toEqual({ accept: "application/json" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("asks the private address when it is set", async () => {
    const { resolveCustomHost } = await load(PRIVATE);
    fetchMock.mockResolvedValueOnce(found());
    expect(await resolveCustomHost("shop.example.com")).toEqual(SHOP);
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([`${PRIVATE}${LOOKUP}`]);
  });

  it("asks the public address once when the private one refused, and remembers the answer", async () => {
    const { resolveCustomHost } = await load(PRIVATE);
    fetchMock.mockRejectedValueOnce(refused()).mockResolvedValueOnce(found());
    expect(await resolveCustomHost("shop.example.com")).toEqual(SHOP);
    expect(await resolveCustomHost("shop.example.com")).toEqual(SHOP);
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([`${PRIVATE}${LOOKUP}`, `${PUBLIC}${LOOKUP}`]);
  });

  it("does not ask again after a 404, which stays an unknown host", async () => {
    const { resolveCustomHost } = await load(PRIVATE);
    fetchMock.mockResolvedValueOnce(answer(404, { error: { code: "NOT_FOUND" } }));
    expect(await resolveCustomHost("shop.example.com")).toBeNull();
    expect(await resolveCustomHost("shop.example.com")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
