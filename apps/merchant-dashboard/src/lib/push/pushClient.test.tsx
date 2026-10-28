import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser, fakeSubscription, OTHER_KEY, pushBackend, removeBrowserFakes, VAPID_KEY } from "@/test/pushFakes";
import {
  attachManifest,
  disablePushHere,
  enablePushHere,
  leavePushOnSignOut,
  listenToWorker,
  loadPushConfig,
  OWNER_KEY,
  resetPushConfig,
  syncPushHere,
} from "./pushClient";

// lib/push with VITE_PUSH_ENABLED on (pushClient.off.test.tsx: off), against
// the /me/push double and a stand-in browser (test/pushFakes.ts).
vi.mock("@/lib/features", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/features")>()), PUSH_ENABLED: true }));

const CONFIG = { enabled: true as const, publicKey: VAPID_KEY };

beforeEach(() => {
  resetPushConfig();
});
afterEach(() => {
  removeBrowserFakes();
  document.head.querySelectorAll('link[rel="manifest"]').forEach((link) => link.remove());
});

describe("whether push is on", () => {
  it("is the API's config, read once per page", async () => {
    const calls = pushBackend();
    expect(await loadPushConfig()).toEqual(CONFIG);
    expect(await loadPushConfig()).toEqual(CONFIG);
    expect(calls.filter((c) => c.path === "/me/push/config")).toHaveLength(1);
  });

  it("a 404 from the API (its PUSH_ENABLED off, or no VAPID keys) is off", async () => {
    pushBackend({ config: 404 });
    expect(await loadPushConfig()).toBeNull();
  });
});

describe("turning notifications on in this browser", () => {
  it("asks for permission, registers /sw.js, subscribes with the API's key and sends the subscription", async () => {
    const calls = pushBackend();
    const browser = fakeBrowser({ permission: "granted" });
    browser.install();
    const result = await enablePushHere(CONFIG, { userId: "user_1", locale: "ar" });

    expect(browser.Notification.requestPermission).toHaveBeenCalledTimes(1);
    expect(browser.serviceWorker.register).toHaveBeenCalledWith("/sw.js", { scope: "/", updateViaCache: "none" });
    const [options] = browser.pushManager.subscribe.mock.calls[0];
    expect(options.userVisibleOnly).toBe(true);
    expect(options.applicationServerKey).toHaveLength(65);
    const put = calls.find((c) => c.method === "PUT");
    expect(put?.body).toEqual({
      app: "dashboard",
      locale: "ar",
      subscription: { endpoint: browser.state.subscription?.endpoint, expirationTime: null, keys: browser.state.subscription?.toJSON().keys },
    });
    expect(result.outcome).toBe("on");
    expect(localStorage.getItem(OWNER_KEY)).toBe("user_1");
  });

  it("refused: nothing is registered or sent", async () => {
    const calls = pushBackend();
    const browser = fakeBrowser({ permission: "denied" });
    browser.install();
    expect(await enablePushHere(CONFIG, { userId: "user_1", locale: "en" })).toEqual({ outcome: "denied" });
    expect(browser.serviceWorker.register).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });

  it("a subscription made with an older key is replaced", async () => {
    pushBackend();
    const old = fakeSubscription(OTHER_KEY);
    const browser = fakeBrowser({ permission: "granted", subscription: old, registered: true });
    browser.install();
    await enablePushHere(CONFIG, { userId: "user_1", locale: "en" });
    expect(old.unsubscribe).toHaveBeenCalled();
    expect(browser.pushManager.subscribe).toHaveBeenCalledTimes(1);
  });

  it("turning off removes the device from the API, then the browser's subscription", async () => {
    const calls = pushBackend();
    const subscription = fakeSubscription();
    fakeBrowser({ permission: "granted", subscription, registered: true }).install();
    localStorage.setItem(OWNER_KEY, "user_1");
    await disablePushHere("dev_9");
    expect(calls).toEqual([{ path: "/me/push/subscriptions/dev_9", method: "DELETE", body: undefined }]);
    expect(subscription.unsubscribe).toHaveBeenCalled();
    expect(localStorage.getItem(OWNER_KEY)).toBeNull();
  });
});

describe("on every page load", () => {
  it("sends this browser's subscription again (the current session, the language)", async () => {
    const calls = pushBackend();
    const subscription = fakeSubscription();
    fakeBrowser({ permission: "granted", subscription, registered: true }).install();
    localStorage.setItem(OWNER_KEY, "user_1");
    expect(await syncPushHere({ userId: "user_1", locale: "en" })).toBe("synced");
    expect(calls.find((c) => c.method === "PUT")?.body).toMatchObject({ locale: "en", subscription: { endpoint: subscription.endpoint } });
  });

  it("drops a subscription another account turned on (a shared computer), and sends nothing", async () => {
    const calls = pushBackend();
    const subscription = fakeSubscription();
    fakeBrowser({ permission: "granted", subscription, registered: true }).install();
    localStorage.setItem(OWNER_KEY, "someone_else");
    expect(await syncPushHere({ userId: "user_1", locale: "en" })).toBe("dropped");
    expect(subscription.unsubscribe).toHaveBeenCalled();
    expect(calls.filter((c) => c.method === "PUT")).toEqual([]);
  });

  it("renews a subscription when the API's key changed", async () => {
    const calls = pushBackend();
    const old = fakeSubscription(OTHER_KEY);
    const browser = fakeBrowser({ permission: "granted", subscription: old, registered: true });
    browser.install();
    localStorage.setItem(OWNER_KEY, "user_1");
    expect(await syncPushHere({ userId: "user_1", locale: "en" })).toBe("synced");
    expect(old.unsubscribe).toHaveBeenCalled();
    expect(calls.find((c) => c.method === "PUT")?.body).toMatchObject({ subscription: { endpoint: browser.state.subscription?.endpoint } });
  });

  it("with push off at the API, keeps the browser's subscription and sends nothing", async () => {
    const calls = pushBackend({ config: 404 });
    const subscription = fakeSubscription();
    fakeBrowser({ permission: "granted", subscription, registered: true }).install();
    localStorage.setItem(OWNER_KEY, "user_1");
    expect(await syncPushHere({ userId: "user_1", locale: "en" })).toBe("none");
    expect(subscription.unsubscribe).not.toHaveBeenCalled();
    expect(calls.filter((c) => c.method === "PUT")).toEqual([]);
  });

  it("a browser that never turned them on: nothing at all", async () => {
    const calls = pushBackend();
    fakeBrowser().install();
    expect(await syncPushHere({ userId: "user_1", locale: "en" })).toBe("none");
    expect(calls).toEqual([]);
  });
});

describe("signing out", () => {
  it("drops this browser's subscription", async () => {
    const subscription = fakeSubscription();
    fakeBrowser({ permission: "granted", subscription, registered: true }).install();
    localStorage.setItem(OWNER_KEY, "user_1");
    await leavePushOnSignOut();
    expect(subscription.unsubscribe).toHaveBeenCalled();
    expect(localStorage.getItem(OWNER_KEY)).toBeNull();
  });
});

describe("the worker's messages and the manifest", () => {
  it("opens a dashboard page from a clicked notification, never another site", () => {
    const browser = fakeBrowser();
    browser.install();
    const open = vi.fn();
    const changed = vi.fn();
    const stop = listenToWorker({ open, changed });
    browser.post({ type: "zimos.push.open", url: "/orders/1?workspace=ws_2" });
    browser.post({ type: "zimos.push.open", url: "//evil.example/x" });
    browser.post({ type: "zimos.push.open", url: "https://evil.example/x" });
    browser.post({ type: "zimos.push.changed" });
    expect(open.mock.calls).toEqual([["/orders/1?workspace=ws_2"]]);
    expect(changed).toHaveBeenCalledTimes(1);
    stop();
    browser.post({ type: "zimos.push.changed" });
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it("links the manifest once", () => {
    attachManifest();
    attachManifest();
    const links = document.head.querySelectorAll('link[rel="manifest"]');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("/manifest.webmanifest");
  });
});
