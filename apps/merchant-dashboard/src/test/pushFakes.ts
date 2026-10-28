import { vi } from "vitest";
import { ApiError, type PushDevice, type PushTestResult } from "@store-builder/api-client";
import { api } from "./mocks";

/**
 * Tests only: a browser's service worker, Push API and Notification, enough
 * for src/lib/push. `install()` puts them on navigator and window; `remove()`
 * takes them away again.
 */

export const VAPID_KEY = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";
export const OTHER_KEY = "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM";

const bytes = (base64url: string) => Uint8Array.from(atob(base64url.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

export interface FakeSubscription {
  endpoint: string;
  expirationTime: number | null;
  options: { applicationServerKey: ArrayBuffer };
  toJSON: () => { endpoint: string; keys: { p256dh: string; auth: string } };
  unsubscribe: ReturnType<typeof vi.fn>;
}

let counter = 0;
export function fakeSubscription(key = VAPID_KEY): FakeSubscription {
  counter += 1;
  const endpoint = `https://fcm.googleapis.com/fcm/send/device-${counter}`;
  return {
    endpoint,
    expirationTime: null,
    options: { applicationServerKey: bytes(key).buffer },
    toJSON: () => ({ endpoint, keys: { p256dh: `p256dh-${counter}`, auth: `auth-${counter}` } }),
    unsubscribe: vi.fn(async () => true),
  };
}

export function fakeBrowser({ permission = "default" as NotificationPermission, subscription = null as FakeSubscription | null, registered = false } = {}) {
  const state = { permission, subscription, registered };
  const pushManager = {
    getSubscription: vi.fn(async () => state.subscription),
    subscribe: vi.fn(async (options: { userVisibleOnly?: boolean; applicationServerKey: Uint8Array }) => {
      const key = btoa(String.fromCharCode(...options.applicationServerKey)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      state.subscription = fakeSubscription(key);
      return state.subscription;
    }),
  };
  const registration = {
    active: { scriptURL: `${window.location.origin}/sw.js` },
    waiting: null,
    installing: null,
    pushManager,
    unregister: vi.fn(async () => true),
  };
  const messageListeners = new Set<(event: MessageEvent) => void>();
  const serviceWorker = {
    register: vi.fn(async () => {
      state.registered = true;
      return registration;
    }),
    get ready() {
      return Promise.resolve(registration);
    },
    getRegistration: vi.fn(async () => (state.registered ? registration : undefined)),
    getRegistrations: vi.fn(async () => (state.registered ? [registration] : [])),
    addEventListener: vi.fn((name: string, listener: (event: MessageEvent) => void) => {
      if (name === "message") messageListeners.add(listener);
    }),
    removeEventListener: vi.fn((name: string, listener: (event: MessageEvent) => void) => {
      if (name === "message") messageListeners.delete(listener);
    }),
    startMessages: vi.fn(),
  };
  const Notification = {
    get permission() {
      return state.permission;
    },
    requestPermission: vi.fn(async () => state.permission),
  };
  return {
    state,
    registration,
    pushManager,
    serviceWorker,
    Notification,
    /** A message from public/sw.js to this page. */
    post(data: unknown) {
      messageListeners.forEach((listener) => listener({ data } as MessageEvent));
    },
    install() {
      Object.defineProperty(navigator, "serviceWorker", { value: serviceWorker, configurable: true });
      Object.defineProperty(window, "PushManager", { value: function PushManager() {}, configurable: true });
      Object.defineProperty(window, "Notification", { value: Notification, configurable: true });
    },
  };
}

export function removeBrowserFakes() {
  for (const [target, name] of [
    [navigator, "serviceWorker"],
    [navigator, "userAgent"],
    [navigator, "maxTouchPoints"],
    [window, "PushManager"],
    [window, "Notification"],
  ] as const) {
    if (Object.prototype.hasOwnProperty.call(target, name)) delete (target as unknown as Record<string, unknown>)[name];
  }
}

export function fakeDevice(over: Partial<PushDevice> = {}): PushDevice {
  return {
    id: "dev_1",
    app: "dashboard",
    deviceLabel: "Chrome on Windows",
    pushService: "fcm",
    locale: "en",
    enabled: true,
    current: false,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastSeenAt: "2026-10-28T10:00:00.000Z",
    createdAt: "2026-10-28T10:00:00.000Z",
    ...over,
  };
}

export interface PushCall {
  path: string;
  method: string;
  body?: unknown;
}

/**
 * The API's /me/push on the `api` double. `config: 404` is the API with push
 * off. Answers every other request with a promise that never settles, like
 * the double does by default. Returns the /me/push requests made.
 */
export function pushBackend({
  config = { enabled: true, publicKey: VAPID_KEY } as { enabled: true; publicKey: string } | 404,
  devices = [] as PushDevice[],
  test = { sent: 1, results: [{ id: "dev_1", outcome: "sent" }] } as PushTestResult,
  other = (() => new Promise<never>(() => undefined)) as (path: string, opts?: { method?: string; body?: unknown }) => unknown,
} = {}): PushCall[] {
  const calls: PushCall[] = [];
  api.request.mockImplementation((async (path: string, opts?: { method?: string; body?: unknown }) => {
    if (!path.startsWith("/me/push")) return other(path, opts);
    const method = opts?.method ?? "GET";
    calls.push({ path, method, body: opts?.body });
    if (path === "/me/push/config") {
      if (config === 404) throw new ApiError("Cannot GET /api/v1/me/push/config", 404, "ROUTE_NOT_FOUND");
      return config;
    }
    if (path === "/me/push/subscriptions" && method === "PUT") return { subscription: fakeDevice({ current: true }) };
    if (path.startsWith("/me/push/subscriptions") && method === "GET") return { subscriptions: devices };
    if (path === "/me/push/test") return test;
    if (method === "PATCH") return { subscription: fakeDevice() };
    if (method === "DELETE") return { success: true };
    throw new Error(`Unexpected request ${method} ${path}`);
  }) as never);
  return calls;
}

export function setUserAgent(userAgent: string, maxTouchPoints = 0) {
  Object.defineProperty(navigator, "userAgent", { value: userAgent, configurable: true });
  Object.defineProperty(navigator, "maxTouchPoints", { value: maxTouchPoints, configurable: true });
}
