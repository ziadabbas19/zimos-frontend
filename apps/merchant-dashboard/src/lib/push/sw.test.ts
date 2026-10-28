/// <reference types="node" />
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

// public/sw.js as shipped: the guard (decision 1: notifications only — no
// fetch handler, no cache, no precache, no imported scripts) and what it does,
// run in a stand-in for the service worker's global scope.

const SOURCE = readFileSync(fileURLToPath(new URL("../../../public/sw.js", import.meta.url)), "utf8");
const ORIGIN = "https://app.zimos.test";

describe("public/sw.js stays a notifications-only worker", () => {
  // Comments may say what is not there; the code may not do it.
  const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  it("has no fetch handler", () => {
    expect(code).not.toMatch(/addEventListener\(\s*["'`]fetch["'`]/);
    expect(code).not.toMatch(/\bonfetch\b/);
    expect(code).not.toMatch(/respondWith/);
  });

  it("touches no cache, precaches nothing and imports no scripts", () => {
    expect(code).not.toMatch(/\bcaches\b/);
    expect(code).not.toMatch(/\bCache\b|cache\.(put|add|addAll|match)/);
    expect(code).not.toMatch(/precache|workbox/i);
    expect(code).not.toMatch(/importScripts|\bimport\s*\(/);
  });

  it("listens to push, notificationclick and pushsubscriptionchange (and install/activate only to take over)", () => {
    const events = [...code.matchAll(/addEventListener\(\s*["'`](\w+)["'`]/g)].map(([, name]) => name).sort();
    expect(events).toEqual(["activate", "install", "notificationclick", "push", "pushsubscriptionchange"]);
  });
});

type Listener = (event: Record<string, unknown>) => void;

interface FakeClient {
  focused: boolean;
  visibilityState: string;
  focus: ReturnType<typeof vi.fn>;
  postMessage: ReturnType<typeof vi.fn>;
}

function client(over: Partial<FakeClient> = {}): FakeClient {
  const c: FakeClient = { focused: false, visibilityState: "hidden", focus: vi.fn(), postMessage: vi.fn(), ...over };
  c.focus.mockImplementation(async () => c);
  return c;
}

/** Loads sw.js into a stand-in global scope; returns its listeners and the doubles they call. */
function load(windows: FakeClient[] = []) {
  const listeners: Record<string, Listener> = {};
  const showNotification = vi.fn(async (_title: string, _options: Record<string, unknown>) => undefined);
  const subscribe = vi.fn(async () => ({ endpoint: "https://fcm.googleapis.com/fcm/send/new" }));
  const clients = {
    matchAll: vi.fn(async () => windows),
    openWindow: vi.fn(async () => null),
    claim: vi.fn(async () => undefined),
  };
  const self = {
    location: { origin: ORIGIN },
    clients,
    registration: { showNotification, pushManager: { subscribe } },
    skipWaiting: vi.fn(),
    addEventListener: (name: string, listener: Listener) => {
      listeners[name] = listener;
    },
  };
  vm.runInNewContext(SOURCE, { self, URL, Promise });
  /** Fires `name` and waits for what it handed to waitUntil. */
  async function fire(name: string, event: Record<string, unknown>) {
    let work: Promise<unknown> = Promise.resolve();
    listeners[name]({ ...event, waitUntil: (p: Promise<unknown>) => (work = p) });
    await work;
  }
  return { fire, showNotification, subscribe, clients };
}

const pushOf = (payload: unknown) => ({ data: { json: () => (typeof payload === "string" ? JSON.parse(payload) : payload) } });

describe("a push", () => {
  it("shows the payload's title and body, with its tag and the page to open", async () => {
    const sw = load();
    await sw.fire("push", pushOf({ v: 1, type: "push.test", title: "Zimos", body: "Test", url: "/settings?tab=notifications", tag: "push.test", count: 1 }));
    expect(sw.showNotification).toHaveBeenCalledWith(
      "Zimos",
      expect.objectContaining({ body: "Test", tag: "push.test", silent: false, data: { url: "/settings?tab=notifications", type: "push.test", count: 1 } })
    );
  });

  it.each(["https://evil.example/x", "//evil.example/x", "/\\evil.example", "javascript:alert(1)"])("never keeps a link to another site (%s)", async (url) => {
    const sw = load();
    await sw.fire("push", pushOf({ title: "Zimos", body: "", url }));
    expect(sw.showNotification.mock.calls[0][1]).toMatchObject({ data: { url: "/" } });
  });

  it("is shown without a sound while a dashboard window is in front, with a sound otherwise", async () => {
    const front = load([client({ focused: true, visibilityState: "visible" })]);
    await front.fire("push", pushOf({ title: "Zimos" }));
    expect(front.showNotification.mock.calls[0][1]).toMatchObject({ silent: true });

    const behind = load([client({ focused: false, visibilityState: "hidden" })]);
    await behind.fire("push", pushOf({ title: "Zimos" }));
    expect(behind.showNotification.mock.calls[0][1]).toMatchObject({ silent: false });
  });

  it("still shows something for a payload it cannot read (Safari ends silent subscriptions)", async () => {
    const sw = load();
    await sw.fire("push", { data: { json: () => JSON.parse("not json") } });
    expect(sw.showNotification).toHaveBeenCalledWith("Zimos", expect.objectContaining({ data: expect.objectContaining({ url: "/" }) }));
  });
});

describe("a click on the notification", () => {
  const clickOf = (url: unknown) => ({ notification: { close: vi.fn(), data: { url } } });

  it("brings an open dashboard window forward and tells it which page to open", async () => {
    const open = client();
    const sw = load([open]);
    await sw.fire("notificationclick", clickOf("/orders/1?workspace=ws_2"));
    expect(open.focus).toHaveBeenCalled();
    expect(open.postMessage).toHaveBeenCalledWith({ type: "zimos.push.open", url: "/orders/1?workspace=ws_2" });
    expect(sw.clients.openWindow).not.toHaveBeenCalled();
  });

  it("opens a new window on the page when none is open, and the dashboard's home for a foreign link", async () => {
    const sw = load([]);
    await sw.fire("notificationclick", clickOf("/orders/1"));
    expect(sw.clients.openWindow).toHaveBeenCalledWith("/orders/1");
    const other = load([]);
    await other.fire("notificationclick", clickOf("https://evil.example"));
    expect(other.clients.openWindow).toHaveBeenCalledWith("/");
  });
});

describe("a renewed subscription", () => {
  it("subscribes again with the same key and tells open windows to send it", async () => {
    const open = client();
    const sw = load([open]);
    const key = new Uint8Array([4, 1, 2]);
    await sw.fire("pushsubscriptionchange", { oldSubscription: { options: { applicationServerKey: key } } });
    expect(sw.subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: key });
    expect(open.postMessage).toHaveBeenCalledWith({ type: "zimos.push.changed" });
  });
});
