import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient, createMemoryTokenStorage } from "@store-builder/api-client";

// What the shared API client sends for "Pay the fees and open them"
// (POST /orders/locked/settle). The API's JSON parser is strict: a body that
// is a JSON string ("{}" serialized twice) is refused with 400, so the body
// on the wire must be the object itself.

afterEach(() => vi.unstubAllGlobals());

describe("settling the locked orders' fees through the API client", () => {
  it("POSTs an empty JSON object, serialized once", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ settled: 1, left: 0, locked: { enabled: true, count: 0, due: 0, totals: [] } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient({ baseUrl: "http://api.test/api/v1", tokenStorage: createMemoryTokenStorage() });

    const result = await client.settleLockedOrders("ws-1");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://api.test/api/v1/workspaces/ws-1/orders/locked/settle");
    expect(init.method).toBe("POST");
    expect(init.body).toBe("{}");
    expect(JSON.parse(String(init.body))).toEqual({});
    expect(result.settled).toBe(1);
  });
});
