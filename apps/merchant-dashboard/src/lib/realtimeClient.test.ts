import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClient, createMemoryTokenStorage } from "@store-builder/api-client";
import { connectRealtime, isRealtimeMessage, realtimeEndpoint, tokenLifeMs, type RealtimeMessage } from "@store-builder/api-client/realtime";

/** A token whose payload says it expires `inSeconds` from now (the signature is never checked here). */
function token(inSeconds: number): string {
  const payload = btoa(JSON.stringify({ sub: "u1", exp: Math.floor(Date.now() / 1000) + inSeconds })).replace(/=+$/, "");
  return `h.${payload}.s`;
}

/** Stands in for socket.io-client's Socket: records what was asked, fires what the server would. */
function fakeSocket() {
  const handlers = new Map<string, Array<(...args: unknown[]) => void>>();
  let any: ((name: string, ...args: unknown[]) => void) | null = null;
  const socket = {
    active: false,
    options: null as null | Record<string, unknown>,
    connects: 0,
    disconnects: 0,
    on(name: string, fn: (...args: unknown[]) => void) {
      handlers.set(name, [...(handlers.get(name) ?? []), fn]);
      return socket;
    },
    onAny(fn: (name: string, ...args: unknown[]) => void) {
      any = fn;
      return socket;
    },
    offAny() {
      any = null;
      return socket;
    },
    connect() {
      socket.connects += 1;
      return socket;
    },
    disconnect() {
      socket.disconnects += 1;
      socket.active = false;
      (handlers.get("disconnect") ?? []).forEach((fn) => fn("io client disconnect"));
      return socket;
    },
    fire(name: string, ...args: unknown[]) {
      (handlers.get(name) ?? []).forEach((fn) => fn(...args));
    },
    message(name: string, body: unknown) {
      any?.(name, body);
    },
  };
  return socket;
}

/** Lets the connection's own awaits (the refresh probe) run. */
async function settle() {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

const MESSAGE: RealtimeMessage = {
  v: 1,
  id: "e1",
  type: "order.created",
  workspaceId: "w1",
  entity: { type: "order", id: "o1" },
  at: "2026-10-24T10:00:00.000Z",
};

describe("where the socket is", () => {
  it("is the API base's origin and path + /realtime/socket.io, absolute or relative", () => {
    expect(realtimeEndpoint("https://api.zimos.co/api/v1")).toEqual({ url: "https://api.zimos.co", path: "/api/v1/realtime/socket.io" });
    expect(realtimeEndpoint("https://api.zimos.co/api/v1/")).toEqual({ url: "https://api.zimos.co", path: "/api/v1/realtime/socket.io" });
    expect(realtimeEndpoint("/api/v1", "https://console.zimos.co")).toEqual({ url: "https://console.zimos.co", path: "/api/v1/realtime/socket.io" });
  });

  it("reads how long a token has left; none or unreadable is already over", () => {
    expect(tokenLifeMs(token(600))).toBeGreaterThan(590_000);
    expect(tokenLifeMs(null)).toBeLessThan(0);
    expect(tokenLifeMs("not-a-token")).toBeLessThan(0);
  });

  it("takes only messages of the API's shape", () => {
    expect(isRealtimeMessage(MESSAGE)).toBe(true);
    expect(isRealtimeMessage({ type: "order.created" })).toBe(false);
    expect(isRealtimeMessage("order.created")).toBe(false);
  });
});

describe("connectRealtime", () => {
  let client: ApiClient;
  let socket: ReturnType<typeof fakeSocket>;
  const create = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    client = new ApiClient({ baseUrl: "https://api.zimos.co/api/v1", tokenStorage: createMemoryTokenStorage() });
    socket = fakeSocket();
    create.mockReset();
    create.mockImplementation((url: string, options: Record<string, unknown>) => {
      socket.options = { url, ...options };
      return socket;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function start(over: Partial<Parameters<typeof connectRealtime>[0]> = {}) {
    const onMessage = vi.fn();
    const onStatus = vi.fn();
    const refreshProbe = vi.fn().mockResolvedValue(undefined);
    const connection = connectRealtime({
      client,
      baseUrl: "https://api.zimos.co/api/v1",
      refreshProbe,
      onMessage,
      onStatus,
      createSocket: create as never,
      ...over,
    });
    return { connection, onMessage, onStatus, refreshProbe };
  }

  it("asks for websocket only, sends the stored token in auth, never in the URL", async () => {
    client.setTokens({ accessToken: token(600), refreshToken: "r1" });
    const { refreshProbe } = start();
    await settle();
    expect(socket.options).toMatchObject({ url: "https://api.zimos.co", path: "/api/v1/realtime/socket.io", transports: ["websocket"], autoConnect: false });
    const auth = socket.options?.auth as (cb: (data: object) => void) => void;
    const sent = vi.fn();
    auth(sent);
    expect(sent).toHaveBeenCalledWith({ token: client.tokens.accessToken });
    expect(String(socket.options?.url)).not.toContain("token");
    expect(refreshProbe).not.toHaveBeenCalled();
    expect(socket.connects).toBe(1);
  });

  it("renews a token about to expire before connecting", async () => {
    client.setTokens({ accessToken: token(20), refreshToken: "r1" });
    const { refreshProbe } = start();
    await settle();
    expect(refreshProbe).toHaveBeenCalledTimes(1);
    expect(socket.connects).toBe(1);
  });

  it("does not connect once signed out", async () => {
    const { refreshProbe } = start();
    await settle();
    expect(refreshProbe).toHaveBeenCalledTimes(1);
    expect(socket.connects).toBe(0);
  });

  it("is live on connect and waiting on a drop; passes on messages of the API's shape only", async () => {
    client.setTokens({ accessToken: token(600), refreshToken: "r1" });
    const { connection, onMessage, onStatus } = start();
    await settle();
    socket.fire("connect");
    expect(connection.status()).toBe("live");
    socket.message("order.created", MESSAGE);
    socket.message("order.created", { nope: true });
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith(MESSAGE);

    socket.active = true;
    socket.fire("disconnect", "transport close");
    expect(onStatus).toHaveBeenLastCalledWith("waiting");
    // The client reconnects by itself after a transport drop: nothing scheduled here.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(socket.connects).toBe(1);
  });

  it("after a refusal or the server ending it, tries again later and waits longer each time", async () => {
    client.setTokens({ accessToken: token(600), refreshToken: "r1" });
    start();
    await settle();
    expect(socket.connects).toBe(1);

    socket.fire("connect_error", new Error("unauthorized"));
    await vi.advanceTimersByTimeAsync(4_999);
    expect(socket.connects).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(socket.connects).toBe(2);

    socket.fire("disconnect", "io server disconnect");
    await vi.advanceTimersByTimeAsync(9_999);
    expect(socket.connects).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(socket.connects).toBe(3);
  });

  it("close() disconnects and schedules nothing more", async () => {
    client.setTokens({ accessToken: token(600), refreshToken: "r1" });
    const { connection, onStatus } = start();
    await settle();
    socket.fire("connect");
    onStatus.mockClear();
    connection.close();
    expect(socket.disconnects).toBe(1);
    expect(onStatus).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(600_000);
    expect(socket.connects).toBe(1);
  });
});
