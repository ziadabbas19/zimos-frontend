// @vitest-environment node
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * The dashboard preview's staff check (preview/route.ts) on the API's private
 * address: the public one while INTERNAL_API_BASE_URL is unset, the private
 * one when set, the public one again — the staff token still attached — when
 * the private one refused, and no second try after a 401.
 */

const PUBLIC = "https://api.example.test/api/v1";
const PRIVATE = "http://backend.railway.internal:8080/api/v1";
const WS = "11111111-2222-4333-8444-555555555555";
const TOKEN = "66666666-7777-4888-8999-aaaaaaaaaaaa";
let fetchMock: ReturnType<typeof vi.fn>;

const answer = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const refused = () => Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" }) });

function previewPost() {
  const form = new FormData();
  form.set("token", TOKEN);
  form.set("accessToken", "staff-access-token");
  form.set("tree", JSON.stringify({ sections: [] }));
  return new NextRequest(`http://localhost:3000/store/${WS}/preview`, { method: "POST", body: form });
}

async function post(internal: string | undefined) {
  vi.stubEnv("INTERNAL_API_BASE_URL", internal);
  vi.resetModules();
  const { POST } = await import("./route");
  return POST(previewPost(), { params: Promise.resolve({ workspaceId: WS }) });
}

const urls = () => fetchMock.mock.calls.map((call) => String(call[0]));

// The first load transforms the API client (a large file); the tests reload it per case.
beforeAll(async () => {
  await import("./route");
}, 60_000);

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

describe("POST /store/:workspaceId/preview", () => {
  it("checks the staff token on the public address while INTERNAL_API_BASE_URL is unset, as before", async () => {
    fetchMock.mockResolvedValueOnce(answer(200, { websites: [] })).mockResolvedValueOnce(answer(200, { token: "view" }));
    const res = await post(undefined);
    expect(res.status).toBe(303);
    expect(urls()).toEqual([`${PUBLIC}/workspaces/${WS}/websites`, `${PUBLIC}/workspaces/${WS}/store-preview-token`]);
  });

  it("checks it on the private address when it is set", async () => {
    fetchMock.mockResolvedValueOnce(answer(200, { websites: [] })).mockResolvedValueOnce(answer(200, { token: "view" }));
    const res = await post(PRIVATE);
    expect(res.status).toBe(303);
    expect(urls()).toEqual([`${PRIVATE}/workspaces/${WS}/websites`, `${PRIVATE}/workspaces/${WS}/store-preview-token`]);
  });

  it("asks the public address once when the private one can't be found, the token still attached", async () => {
    fetchMock
      .mockRejectedValueOnce(refused())
      .mockResolvedValueOnce(answer(200, { websites: [] }))
      .mockResolvedValueOnce(answer(200, { token: "view" }));
    const res = await post(PRIVATE);
    expect(res.status).toBe(303);
    expect(urls()).toEqual([
      `${PRIVATE}/workspaces/${WS}/websites`,
      `${PUBLIC}/workspaces/${WS}/websites`,
      `${PRIVATE}/workspaces/${WS}/store-preview-token`,
    ]);
    expect(fetchMock.mock.calls[1][1].headers).toEqual({ Authorization: "Bearer staff-access-token" });
  });

  it("does not try again after a 401: the session is refused", async () => {
    fetchMock.mockResolvedValueOnce(answer(401, { error: { code: "UNAUTHORIZED" } }));
    const res = await post(PRIVATE);
    expect(res.status).toBe(403);
    expect(urls()).toEqual([`${PRIVATE}/workspaces/${WS}/websites`]);
  });
});
