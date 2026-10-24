// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Where the storefront server's API calls go (lib/serverApiBase.ts): the
 * public address exactly as before while INTERNAL_API_BASE_URL is unset; the
 * private one when it is set, read at run time; and one more try on the
 * public address only when the private one could not be reached at all —
 * never after an answer, whatever its status.
 */

const PUBLIC = "https://api.example.test/api/v1";
const PRIVATE = "http://backend.railway.internal:8080/api/v1";
const PATH = "/store/ws-1/pages/home?draft=secret-query";

let mod: typeof import("./serverApiBase");
let fetchMock: ReturnType<typeof vi.fn>;
let warn: ReturnType<typeof vi.spyOn>;
let info: ReturnType<typeof vi.spyOn>;

/** Node's fetch when it can't connect: a TypeError whose cause carries the socket error's code. */
function unreachable(code: string) {
  return Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error(`connect ${code}`), { code }) });
}

const answer = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function load(internal: string | undefined) {
  vi.stubEnv("INTERNAL_API_BASE_URL", internal);
  vi.resetModules();
  mod = await import("./serverApiBase");
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", PUBLIC);
  vi.stubEnv("NEXT_PHASE", undefined);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  info = vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("without INTERNAL_API_BASE_URL — the old behaviour", () => {
  it("uses the public address and logs nothing", async () => {
    await load(undefined);
    expect(mod.serverApiBase()).toBe(PUBLIC);
    expect(mod.internalApiBase()).toBeNull();
    await load("   ");
    expect(mod.serverApiBase()).toBe(PUBLIC);
    expect(info).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("falls back to the local API when the public variable is unset too, as before", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", undefined);
    await load(undefined);
    expect(mod.serverApiBase()).toBe("http://localhost:4000/api/v1");
  });

  it("is a plain fetch with the caller's own arguments", async () => {
    await load(undefined);
    const init = { method: "GET", headers: { accept: "application/json" } };
    const res = answer(200);
    fetchMock.mockResolvedValueOnce(res);
    expect(await mod.serverApiFetch(`${PUBLIC}${PATH}`, init)).toBe(res);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${PUBLIC}${PATH}`);
    expect(fetchMock.mock.calls[0][1]).toBe(init);
  });

  it("never sends a call again, even when the API can't be reached", async () => {
    await load(undefined);
    fetchMock.mockRejectedValue(unreachable("ECONNREFUSED"));
    await expect(mod.serverApiFetch(`${PUBLIC}${PATH}`)).rejects.toThrow("fetch failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("with INTERNAL_API_BASE_URL", () => {
  it("uses the private address, trimmed of spaces and its trailing slash, and says so once", async () => {
    await load(`  ${PRIVATE}/  `);
    expect(mod.serverApiBase()).toBe(PRIVATE);
    expect(mod.serverApiBase()).toBe(PRIVATE);
    expect(mod.publicApiBase()).toBe(PUBLIC);
    expect(info).toHaveBeenCalledTimes(1);
    expect(String(info.mock.calls[0][0])).toContain(PRIVATE);
  });

  it("is read when the server runs, not when the module loads", async () => {
    await load(undefined);
    expect(mod.serverApiBase()).toBe(PUBLIC);
    vi.stubEnv("INTERNAL_API_BASE_URL", PRIVATE);
    expect(mod.serverApiBase()).toBe(PRIVATE);
    vi.stubEnv("INTERNAL_API_BASE_URL", "");
    expect(mod.serverApiBase()).toBe(PUBLIC);
  });

  it("is ignored while `next build` runs: the private network only exists at run time", async () => {
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    await load(PRIVATE);
    expect(mod.serverApiBase()).toBe(PUBLIC);
  });

  it("ignores a value that isn't a plain http(s) URL, without repeating it", async () => {
    for (const bad of [
      "backend.railway.internal:8080/api/v1",
      "ftp://backend.railway.internal/api/v1",
      "http://admin:hunter2@backend.railway.internal:8080/api/v1",
      "http://backend.railway.internal:8080/api/v1?key=hunter2",
      "http://backend.railway.internal:8080/api/v1#x",
      "not a url",
    ]) {
      warn.mockClear();
      await load(bad);
      expect(mod.serverApiBase()).toBe(PUBLIC);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).not.toContain("hunter2");
      expect(String(warn.mock.calls[0][0])).not.toContain(bad);
    }
  });

  it("sends the call to the private address", async () => {
    await load(PRIVATE);
    fetchMock.mockResolvedValueOnce(answer(200));
    await mod.serverApiFetch(`${mod.serverApiBase()}${PATH}`);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${PRIVATE}${PATH}`);
  });

  it("leaves a URL that isn't on the private address alone", async () => {
    await load(PRIVATE);
    fetchMock.mockRejectedValue(unreachable("ECONNREFUSED"));
    await expect(mod.serverApiFetch(`${PUBLIC}${PATH}`)).rejects.toThrow("fetch failed");
    await expect(mod.serverApiFetch("http://backend.railway.internal:8080/api/v10/x")).rejects.toThrow("fetch failed");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("when the private address can't be reached", () => {
  for (const code of ["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT", "ETIMEDOUT"]) {
    it(`sends the call once more to the public address (${code})`, async () => {
      await load(PRIVATE);
      const res = answer(200, { ok: true });
      fetchMock.mockRejectedValueOnce(unreachable(code)).mockResolvedValueOnce(res);
      const init = { method: "POST", headers: { "X-Storefront-Secret": "s3cret-value" }, body: '{"a":1}' };
      expect(await mod.serverApiFetch(`${PRIVATE}${PATH}`, init)).toBe(res);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][0]).toBe(`${PRIVATE}${PATH}`);
      expect(fetchMock.mock.calls[1][0]).toBe(`${PUBLIC}${PATH}`);
      // The same call: method, headers and body unchanged.
      expect(fetchMock.mock.calls[1][1]).toBe(init);
    });
  }

  it("also when every address of the host refused (an AggregateError)", async () => {
    await load(PRIVATE);
    const cause = Object.assign(new AggregateError([Object.assign(new Error("v6"), { code: "ECONNREFUSED" }), Object.assign(new Error("v4"), { code: "ECONNREFUSED" })]), {});
    fetchMock.mockRejectedValueOnce(Object.assign(new TypeError("fetch failed"), { cause })).mockResolvedValueOnce(answer(200));
    await mod.serverApiFetch(`${PRIVATE}${PATH}`);
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([`${PRIVATE}${PATH}`, `${PUBLIC}${PATH}`]);
  });

  it("logs a warning naming the host and the reason, never the path, a query or a header", async () => {
    await load(PRIVATE);
    fetchMock.mockRejectedValueOnce(unreachable("ENOTFOUND")).mockResolvedValueOnce(answer(200));
    await mod.serverApiFetch(`${PRIVATE}${PATH}`, { headers: { Authorization: "Bearer staff-token", "X-Storefront-Secret": "s3cret-value" } });
    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0][0]);
    expect(line).toContain("backend.railway.internal:8080");
    expect(line).toContain("ENOTFOUND");
    expect(line).toContain("INTERNAL_API_BASE_URL");
    for (const hidden of ["/store/ws-1", "secret-query", "staff-token", "s3cret-value"]) expect(line).not.toContain(hidden);
  });

  it("tries only once: the public address failing too is the call's failure", async () => {
    await load(PRIVATE);
    const publicFailure = unreachable("ENOTFOUND");
    fetchMock.mockRejectedValueOnce(unreachable("ECONNREFUSED")).mockRejectedValueOnce(publicFailure);
    await expect(mod.serverApiFetch(`${PRIVATE}${PATH}`)).rejects.toBe(publicFailure);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("warns at most once a minute, counting the calls in between", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-24T10:00:00Z"));
    await load(PRIVATE);
    fetchMock.mockImplementation((url: string) => (url.startsWith(PRIVATE) ? Promise.reject(unreachable("ECONNREFUSED")) : Promise.resolve(answer(200))));
    for (let i = 0; i < 3; i += 1) await mod.serverApiFetch(`${PRIVATE}${PATH}`);
    expect(warn).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date("2026-10-24T10:01:01Z"));
    await mod.serverApiFetch(`${PRIVATE}${PATH}`);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(String(warn.mock.calls[1][0])).toContain("2 more since the last warning");
    expect(fetchMock).toHaveBeenCalledTimes(8);
  });
});

describe("when the API answered", () => {
  for (const status of [400, 401, 403, 404, 409, 422, 429, 500, 502, 503]) {
    it(`never sends the call again (${status})`, async () => {
      await load(PRIVATE);
      const res = answer(status, { error: { code: "X" } });
      fetchMock.mockResolvedValueOnce(res);
      expect(await mod.serverApiFetch(`${PRIVATE}${PATH}`)).toBe(res);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(warn).not.toHaveBeenCalled();
    });
  }

  it("never sends the call again after a failure that came once connected, or one with no socket code", async () => {
    await load(PRIVATE);
    fetchMock.mockRejectedValueOnce(unreachable("ECONNRESET"));
    await expect(mod.serverApiFetch(`${PRIVATE}${PATH}`)).rejects.toThrow("fetch failed");
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(mod.serverApiFetch(`${PRIVATE}${PATH}`)).rejects.toThrow("fetch failed");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never sends again a call its caller called off", async () => {
    await load(PRIVATE);
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockRejectedValueOnce(controller.signal.reason);
    await expect(mod.serverApiFetch(`${PRIVATE}${PATH}`, { signal: controller.signal }, { timeoutMs: 1000 })).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("a call with a time limit", () => {
  /** Never answers: fails when its signal gives up, the way fetch does. */
  const hang = (_url: string, init: RequestInit) =>
    new Promise<Response>((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(init.signal?.reason)));

  it("keeps the old single attempt and its timer while the variable is unset", async () => {
    await load(undefined);
    fetchMock.mockImplementation(hang);
    await expect(mod.serverApiFetch(`${PUBLIC}${PATH}`, {}, { timeoutMs: 30 })).rejects.toMatchObject({ name: "TimeoutError" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("sends a GET that ran out of time once more, with a fresh timer", async () => {
    await load(PRIVATE);
    fetchMock.mockImplementationOnce(hang).mockResolvedValueOnce(answer(200));
    const res = await mod.serverApiFetch(`${PRIVATE}${PATH}`, { headers: { accept: "application/json" } }, { timeoutMs: 200 });
    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([`${PRIVATE}${PATH}`, `${PUBLIC}${PATH}`]);
    const [first, second] = fetchMock.mock.calls.map((call) => call[1].signal as AbortSignal);
    expect(first.aborted).toBe(true);
    expect(second.aborted).toBe(false);
    expect(String(warn.mock.calls[0][0])).toContain("timeout");
  });

  it("does not send again a POST that ran out of time: the API may have acted on it", async () => {
    await load(PRIVATE);
    fetchMock.mockImplementation(hang);
    await expect(mod.serverApiFetch(`${PRIVATE}${PATH}`, { method: "POST" }, { timeoutMs: 30 })).rejects.toMatchObject({ name: "TimeoutError" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
