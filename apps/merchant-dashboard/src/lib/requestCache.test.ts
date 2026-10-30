import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BURST_MS, PRIMED_MS, coverWhile, forgetAll, prime, resetRequestCache, sharedGet } from "./requestCache";

/** A request the test answers by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("shared GETs", () => {
  beforeEach(() => {
    resetRequestCache();
    vi.useFakeTimers({ toFake: ["Date"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends the same GET asked twice at once only once, and gives each caller its own copy", async () => {
    const answer = deferred<{ n: number }>();
    const send = vi.fn(() => answer.promise);
    const a = sharedGet("/workspaces/w/access", send);
    const b = sharedGet("/workspaces/w/access", send);
    answer.resolve({ n: 1 });
    const [first, second] = await Promise.all([a, b]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ n: 1 });
    expect(second).toEqual({ n: 1 });
    expect(second).not.toBe(first);
  });

  it("sends again once the first answer is in, for a path that is not kept", async () => {
    const send = vi.fn(async () => ({ ok: true }));
    await sharedGet("/workspaces/w/orders?limit=6", send);
    await sharedGet("/workspaces/w/orders?limit=6", send);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("answers a primed path without a request, for the burst of reads that follows the first", async () => {
    prime("/auth/me", { user: { id: "u" } });
    const send = vi.fn(async () => ({ user: { id: "from-server" } }));

    expect(await sharedGet("/auth/me", send)).toEqual({ user: { id: "u" } });
    vi.setSystemTime(Date.now() + BURST_MS - 10);
    expect(await sharedGet("/auth/me", send)).toEqual({ user: { id: "u" } });
    expect(send).not.toHaveBeenCalled();

    // A later read (a poll, a refresh) goes to the server.
    vi.setSystemTime(Date.now() + 20);
    expect(await sharedGet("/auth/me", send)).toEqual({ user: { id: "from-server" } });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("drops a primed answer nobody read in time", async () => {
    prime("/workspaces", { workspaces: [] });
    vi.setSystemTime(Date.now() + PRIMED_MS + 1);
    const send = vi.fn(async () => ({ workspaces: [{ id: "w" }] }));
    expect(await sharedGet("/workspaces", send)).toEqual({ workspaces: [{ id: "w" }] });
  });

  it("makes a covered read wait for the bootstrap, then answers it from what was primed", async () => {
    const boot = deferred<void>();
    coverWhile(["/auth/me", "/workspaces"], boot.promise);
    const send = vi.fn(async () => ({ from: "server" }));

    const read = sharedGet("/auth/me", send);
    prime("/auth/me", { from: "bootstrap" });
    boot.resolve();
    expect(await read).toEqual({ from: "bootstrap" });
    expect(send).not.toHaveBeenCalled();
  });

  it("sends a covered read itself when the bootstrap fails or leaves it out", async () => {
    const boot = deferred<void>();
    coverWhile(["/workspaces/w/orders/pipeline"], boot.promise);
    const send = vi.fn(async () => ({ stages: {} }));
    const read = sharedGet("/workspaces/w/orders/pipeline", send);
    boot.reject(new Error("404"));
    expect(await read).toEqual({ stages: {} });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("does not make an uncovered read wait", async () => {
    coverWhile(["/auth/me"], new Promise(() => undefined));
    const send = vi.fn(async () => ({ orders: [] }));
    expect(await sharedGet("/workspaces/w/orders", send)).toEqual({ orders: [] });
  });

  it("reads the store's access once a session, so moving between pages never asks again", async () => {
    const send = vi.fn(async () => ({ access: { restricted: false } }));
    await sharedGet("/workspaces/w/access", send);
    vi.setSystemTime(Date.now() + 3 * 60 * 60 * 1000);
    expect(await sharedGet("/workspaces/w/access", send)).toEqual({ access: { restricted: false } });
    expect(send).toHaveBeenCalledTimes(1);
    // Another store's access is its own read.
    await sharedGet("/workspaces/w2/access", send);
    expect(send).toHaveBeenCalledTimes(2);
    // A save here forgets it: the next page reads it again.
    forgetAll();
    await sharedGet("/workspaces/w/access", send);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("keeps the bootstrap's access for the session too, past the first burst of reads", async () => {
    prime("/workspaces/w/access", { access: { draft: false } });
    const send = vi.fn(async () => ({ access: { draft: true } }));
    expect(await sharedGet("/workspaces/w/access", send)).toEqual({ access: { draft: false } });
    vi.setSystemTime(Date.now() + PRIMED_MS + BURST_MS + 60_000);
    expect(await sharedGet("/workspaces/w/access", send)).toEqual({ access: { draft: false } });
    expect(send).not.toHaveBeenCalled();
  });

  it("forgets everything kept after a save", async () => {
    const send = vi.fn(async () => ({ access: {} }));
    await sharedGet("/workspaces/w/access", send);
    prime("/auth/me", { user: {} });
    forgetAll();
    await sharedGet("/workspaces/w/access", send);
    expect(send).toHaveBeenCalledTimes(2);
    const me = vi.fn(async () => ({ user: { id: "fresh" } }));
    expect(await sharedGet("/auth/me", me)).toEqual({ user: { id: "fresh" } });
  });

  it("does not keep an answer that was on its way when a save forgot everything", async () => {
    const answer = deferred<{ access: string }>();
    const send = vi.fn(() => answer.promise);
    const read = sharedGet("/workspaces/w/access", send);
    forgetAll();
    answer.resolve({ access: "before the save" });
    await read;
    const again = vi.fn(async () => ({ access: "after" }));
    expect(await sharedGet("/workspaces/w/access", again)).toEqual({ access: "after" });
  });

  it("lets a failed request fail every caller, and keeps nothing", async () => {
    const answer = deferred<never>();
    const send = vi.fn(() => answer.promise);
    const a = sharedGet("/workspaces/w/access", send);
    const b = sharedGet("/workspaces/w/access", send);
    answer.reject(new Error("boom"));
    await expect(a).rejects.toThrow("boom");
    await expect(b).rejects.toThrow("boom");
    const retry = vi.fn(async () => ({ access: {} }));
    await sharedGet("/workspaces/w/access", retry);
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
