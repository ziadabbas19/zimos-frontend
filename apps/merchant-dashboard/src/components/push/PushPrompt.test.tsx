/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { fakeBrowser, fakeDevice, fakeSubscription, pushBackend, removeBrowserFakes, setUserAgent } from "@/test/pushFakes";
import { OWNER_KEY, resetPushConfig } from "@/lib/push/pushClient";
import { MAX_DISMISSALS, PROMPT_KEY, SNOOZE_DAYS } from "@/lib/push/promptMemory";
import { PushPrompt } from "./PushPrompt";

// The home page's offer to turn device notifications on (VITE_PUSH_ENABLED on here;
// PushPrompt.off.test.tsx: off).
vi.mock("@/lib/features", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/features")>()), PUSH_ENABLED: true }));

const UA = {
  windowsChrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  iphoneSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
  iphoneOld: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.7 Mobile/15E148 Safari/604.1",
};
const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  resetPushConfig();
  setUserAgent(UA.windowsChrome);
});
afterEach(() => removeBrowserFakes());

/** A computer whose browser can take pushes, has not been asked, and is not subscribed. */
function readyBrowser(permission: NotificationPermission = "default") {
  const browser = fakeBrowser({ permission });
  browser.install();
  return browser;
}

const shown = () => screen.findByTestId("push-prompt");
/** Lets the config read and the subscription check settle, then checks the card is not there. */
async function settledAbsent() {
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(screen.queryByTestId("push-prompt")).not.toBeInTheDocument();
}

describe("when the offer shows", () => {
  it("push on, a browser that can, not asked yet, not subscribed, a teammate in a store: the card with both buttons", async () => {
    pushBackend();
    const browser = readyBrowser();
    renderWithProviders(<PushPrompt />);
    expect(await shown()).toHaveTextContent("Turn on device notifications to get new orders the moment they arrive.");
    expect(screen.getByRole("button", { name: "Turn on notifications" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Not now" })).toBeInTheDocument();
    // Showing it never asks the browser.
    expect(browser.Notification.requestPermission).not.toHaveBeenCalled();
  });

  it("in Arabic too", async () => {
    pushBackend();
    readyBrowser();
    renderWithProviders(<PushPrompt />, { locale: "ar" });
    expect(await shown()).toHaveTextContent("فعّل إشعارات الجهاز لتصلك الطلبات الجديدة فورًا.");
    expect(screen.getByRole("button", { name: "ليس الآن" })).toBeInTheDocument();
  });

  it.each([
    ["the API's push is off (404)", () => (pushBackend({ config: 404 }), readyBrowser())],
    ["the browser already allowed them (asked before)", () => (pushBackend(), readyBrowser("granted"))],
    ["the browser refused them", () => (pushBackend(), readyBrowser("denied"))],
    ["a browser without the Push API", () => pushBackend()],
    [
      "this browser already receives them",
      () => {
        pushBackend();
        fakeBrowser({ permission: "default", subscription: fakeSubscription(), registered: true }).install();
        localStorage.setItem(OWNER_KEY, "user_1");
      },
    ],
  ])("not when %s", async (_what, arrange) => {
    arrange();
    renderWithProviders(<PushPrompt />);
    await settledAbsent();
  });

  it("not outside a store", async () => {
    pushBackend();
    readyBrowser();
    renderWithProviders(<PushPrompt />, { workspace: { currentWorkspace: null } });
    await settledAbsent();
  });

  it("not when this device cannot remember a \"Not now\" (storage refused): never rather than every visit", async () => {
    pushBackend();
    readyBrowser();
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
      if (key.startsWith(PROMPT_KEY)) throw new Error("QuotaExceededError");
      return setItem.call(this, key, value);
    });
    renderWithProviders(<PushPrompt />);
    await settledAbsent();
  });
});

describe("turning them on", () => {
  it("asks the browser only on the press, subscribes as Settings does, says so and sends a test", async () => {
    const calls = pushBackend();
    const browser = readyBrowser();
    browser.Notification.requestPermission.mockImplementation(async () => {
      browser.state.permission = "granted";
      return "granted";
    });
    const { user } = renderWithProviders(<PushPrompt />);
    await shown();
    expect(browser.Notification.requestPermission).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Turn on notifications" }));
    expect(await screen.findByText("Notifications are on.")).toBeInTheDocument();
    expect(browser.Notification.requestPermission).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("push-prompt")).not.toBeInTheDocument();
    expect(calls.find((c) => c.method === "PUT")?.body).toMatchObject({ app: "dashboard", locale: "en" });
    await waitFor(() => expect(calls.find((c) => c.path === "/me/push/test")).toEqual({ path: "/me/push/test", method: "POST", body: {} }));
  });

  it("refused at the browser: the card goes and does not come back", async () => {
    const calls = pushBackend();
    const browser = readyBrowser();
    browser.Notification.requestPermission.mockImplementation(async () => {
      browser.state.permission = "denied";
      return "denied";
    });
    const { user, unmount } = renderWithProviders(<PushPrompt />);
    await user.click(await screen.findByRole("button", { name: "Turn on notifications" }));
    await waitFor(() => expect(screen.queryByTestId("push-prompt")).not.toBeInTheDocument());
    expect(calls.filter((c) => c.method === "PUT")).toEqual([]);
    unmount();
    renderWithProviders(<PushPrompt />);
    await settledAbsent();
  });
});

describe('"Not now"', () => {
  it(`hides it for ${SNOOZE_DAYS} days on this device, then it is offered again`, async () => {
    pushBackend();
    readyBrowser();
    const { user, unmount } = renderWithProviders(<PushPrompt />);
    await user.click(await screen.findByRole("button", { name: "Not now" }));
    expect(screen.queryByTestId("push-prompt")).not.toBeInTheDocument();
    const saved = JSON.parse(localStorage.getItem(PROMPT_KEY) ?? "{}");
    expect(saved.dismissals).toBe(1);
    expect(saved.until - Date.now()).toBeGreaterThan((SNOOZE_DAYS - 0.01) * DAY_MS);
    unmount();

    const again = renderWithProviders(<PushPrompt />);
    await settledAbsent();
    again.unmount();

    const later = Date.now() + (SNOOZE_DAYS + 1) * DAY_MS;
    vi.spyOn(Date, "now").mockReturnValue(later);
    renderWithProviders(<PushPrompt />);
    expect(await shown()).toBeInTheDocument();
  });

  it(`after the ${MAX_DISMISSALS}rd time it is not offered again`, async () => {
    pushBackend();
    readyBrowser();
    localStorage.setItem(PROMPT_KEY, JSON.stringify({ dismissals: MAX_DISMISSALS - 1, until: Date.now() - 1 }));
    const { user, unmount } = renderWithProviders(<PushPrompt />);
    await user.click(await screen.findByRole("button", { name: "Not now" }));
    expect(JSON.parse(localStorage.getItem(PROMPT_KEY) ?? "{}").dismissals).toBe(MAX_DISMISSALS);
    unmount();
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 100 * DAY_MS);
    renderWithProviders(<PushPrompt />);
    await settledAbsent();
  });
});

describe("an iPhone or iPad in the browser", () => {
  it("not added to the Home Screen: the steps instead of the button, and Not now", async () => {
    pushBackend({ devices: [] });
    setUserAgent(UA.iphoneSafari, 5);
    renderWithProviders(<PushPrompt />);
    expect(await shown()).toHaveTextContent("tap Share, then “Add to Home Screen”");
    expect(screen.queryByRole("button", { name: "Turn on notifications" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Not now" })).toBeInTheDocument();
  });

  it("not when the Home Screen app already receives them, nor on an iOS older than 16.4", async () => {
    pushBackend({ devices: [fakeDevice({ pushService: "apple", deviceLabel: "Safari on iOS" })] });
    setUserAgent(UA.iphoneSafari, 5);
    const { unmount } = renderWithProviders(<PushPrompt />);
    await settledAbsent();
    unmount();

    resetPushConfig();
    pushBackend();
    setUserAgent(UA.iphoneOld, 5);
    renderWithProviders(<PushPrompt />);
    await settledAbsent();
  });
});

describe("where it is", () => {
  // Under jsdom import.meta.url is not a file URL; vitest runs from the dashboard's folder.
  const SRC = join(process.cwd(), "src");
  const tsx = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return tsx(path);
      return name.endsWith(".tsx") && !name.endsWith(".test.tsx") ? [path] : [];
    });

  it("on the home page only, and the Home Screen banner steps aside there", () => {
    const users = tsx(SRC)
      .filter((path) => !path.endsWith(`${sep}PushPrompt.tsx`) && /<PushPrompt\b/.test(readFileSync(path, "utf8")))
      .map((path) => relative(SRC, path).split(sep).join("/"));
    expect(users).toEqual(["pages/DashboardHomePage.tsx"]);
    expect(readFileSync(join(SRC, "components", "DashboardLayout.tsx"), "utf8")).toContain('{location.pathname !== "/" && <PushInstallBanner />}');
    // Reads every source file: slow on a busy machine.
  }, 120_000);
});
