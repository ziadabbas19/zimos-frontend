import { afterEach, describe, expect, it } from "vitest";
import { api } from "@/test/mocks";
import { fakeBrowser, fakeSubscription, removeBrowserFakes } from "@/test/pushFakes";
import { attachManifest, leavePushOnSignOut, loadPushConfig, OWNER_KEY, syncPushHere } from "./pushClient";

// VITE_PUSH_ENABLED off (the build default): no request to /me/push, no
// manifest, nothing registered; a worker an earlier build left is unregistered.

afterEach(() => removeBrowserFakes());

describe("with VITE_PUSH_ENABLED off", () => {
  it("push is off without asking the API, and no manifest is linked", async () => {
    expect(await loadPushConfig()).toBeNull();
    attachManifest();
    expect(document.head.querySelector('link[rel="manifest"]')).toBeNull();
    expect(api.request).not.toHaveBeenCalled();
  });

  it("a notifications worker kept from an earlier build is unregistered, and nothing is sent", async () => {
    const browser = fakeBrowser({ permission: "granted", subscription: fakeSubscription(), registered: true });
    browser.install();
    localStorage.setItem(OWNER_KEY, "user_1");
    expect(await syncPushHere({ userId: "user_1", locale: "en" })).toBe("off");
    expect(browser.registration.unregister).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(OWNER_KEY)).toBeNull();
    expect(api.request).not.toHaveBeenCalled();
  });

  it("signing out does not touch the browser at all", async () => {
    const subscription = fakeSubscription();
    const browser = fakeBrowser({ permission: "granted", subscription, registered: true });
    browser.install();
    await leavePushOnSignOut();
    expect(browser.serviceWorker.getRegistration).not.toHaveBeenCalled();
    expect(subscription.unsubscribe).not.toHaveBeenCalled();
  });
});
