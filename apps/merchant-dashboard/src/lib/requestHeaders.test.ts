import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { ApiClient, createMemoryTokenStorage } from "@store-builder/api-client";

/**
 * The shared client says what a body is only when it sends one: a GET with
 * no header of its own is a "simple" cross-origin request (no CORS
 * preflight), which is what the storefront's public reads are.
 */

const BASE = "http://api.test/api/v1";
let fetchMock: Mock<(url: string, init?: RequestInit) => Promise<Response>>;

const sent = () => new Headers(fetchMock.mock.calls[0][1]?.headers);

beforeEach(() => {
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the request headers", () => {
  it("sends no Content-Type with a GET", async () => {
    const client = new ApiClient({ baseUrl: BASE, tokenStorage: createMemoryTokenStorage() });
    await client.request("/store/ws/products");
    expect(sent().has("Content-Type")).toBe(false);
    expect([...sent().keys()]).toEqual([]);
  });

  it("sends application/json with a body", async () => {
    const client = new ApiClient({ baseUrl: BASE, tokenStorage: createMemoryTokenStorage() });
    await client.request("/store/ws/cart", { method: "POST", body: { variantId: "v" } });
    expect(sent().get("Content-Type")).toBe("application/json");
    expect(fetchMock.mock.calls[0][1]?.body).toBe(JSON.stringify({ variantId: "v" }));
  });

  it("sends no Content-Type with a DELETE that has no body", async () => {
    const client = new ApiClient({ baseUrl: BASE, tokenStorage: createMemoryTokenStorage() });
    await client.request("/workspaces/ws/discounts/d", { method: "DELETE" });
    expect(sent().has("Content-Type")).toBe(false);
  });

  it("keeps the client's own headers, the caller's and the session's", async () => {
    const storage = createMemoryTokenStorage({ accessToken: "access-1", refreshToken: "refresh-1" });
    const client = new ApiClient({ baseUrl: BASE, tokenStorage: storage, defaultHeaders: { "X-Store-Locale": "ar" } });
    await client.request("/store/ws/cart", { headers: { "X-Cart-Token": "c1" } });
    expect(sent().get("X-Store-Locale")).toBe("ar");
    expect(sent().get("X-Cart-Token")).toBe("c1");
    expect(sent().get("Authorization")).toBe("Bearer access-1");
    expect(sent().has("Content-Type")).toBe(false);
  });

  it("lets a caller still name a Content-Type itself", async () => {
    const client = new ApiClient({ baseUrl: BASE, tokenStorage: createMemoryTokenStorage() });
    await client.request("/x", { headers: { "Content-Type": "text/plain" } });
    expect(sent().get("Content-Type")).toBe("text/plain");
  });
});
