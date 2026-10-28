import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { MerchantNotificationPreferences } from "@store-builder/api-client";
import { renderWithProviders } from "@/test/renderWithProviders";
import { fakeBrowser, fakeDevice, fakeSubscription, pushBackend, removeBrowserFakes, setUserAgent } from "@/test/pushFakes";
import { workspaceMock } from "@/test/mocks";
import { OWNER_KEY, resetPushConfig } from "@/lib/push/pushClient";
import { PushInstallBanner, INSTALL_HINT_KEY } from "@/components/push/PushInstallBanner";
import { RequireWorkspace } from "@/routes/RequireWorkspace";
import { NotificationPreferencesSection } from "./NotificationPreferencesSection";
import { PushDeviceSection } from "./PushDeviceSection";

// Device notifications on screen with VITE_PUSH_ENABLED on (PushDeviceSection.off.test.tsx: off).
vi.mock("@/lib/features", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/features")>()), PUSH_ENABLED: true }));

const UA = {
  windowsChrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  iphoneSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
  iphoneOld: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.7 Mobile/15E148 Safari/604.1",
};

const PREFERENCES: MerchantNotificationPreferences = {
  soundEnabled: true,
  channels: ["inApp", "email", "push", "whatsapp"],
  types: [{ type: "order.new", inApp: true, email: false, push: true, whatsapp: false }],
};
const preferences = (path: string) => (path.endsWith("/notifications/preferences") ? Promise.resolve(PREFERENCES) : new Promise(() => undefined));

beforeEach(() => {
  resetPushConfig();
  setUserAgent(UA.windowsChrome);
});
afterEach(() => removeBrowserFakes());

describe('the "Push" column of My notifications', () => {
  it("is shown while the API's push is on", async () => {
    pushBackend({ other: preferences });
    renderWithProviders(<NotificationPreferencesSection />);
    expect(await screen.findByRole("columnheader", { name: "Push" })).toBeInTheDocument();
  });

  it("a push-only type (WhatsApp messages) has only its Push box", async () => {
    const withWhatsapp: MerchantNotificationPreferences = {
      ...PREFERENCES,
      types: [...PREFERENCES.types, { type: "whatsapp.message", inApp: false, email: false, push: true, whatsapp: false, only: ["push"] }],
    };
    pushBackend({ other: (path) => (path.endsWith("/notifications/preferences") ? Promise.resolve(withWhatsapp) : new Promise(() => undefined)) });
    renderWithProviders(<NotificationPreferencesSection />);
    const row = (await screen.findByRole("rowheader", { name: "New WhatsApp messages" })).closest("tr") as HTMLElement;
    const boxes = within(row).getAllByRole("checkbox");
    expect(boxes).toHaveLength(1);
    expect(boxes[0]).toHaveAccessibleName("Push: New WhatsApp messages");
    expect(boxes[0]).toBeChecked();
  });

  it("is hidden when the API answers 404 for /me/push/config, even if it offers the channel", async () => {
    pushBackend({ config: 404, other: preferences });
    renderWithProviders(<NotificationPreferencesSection />);
    expect(await screen.findByRole("columnheader", { name: "By email" })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("columnheader", { name: "Push" })).not.toBeInTheDocument());
  });
});

describe("Notifications on this device", () => {
  it("turns notifications on for this browser from the button, then shows them on", async () => {
    const calls = pushBackend({ devices: [] });
    const browser = fakeBrowser({ permission: "default" });
    browser.Notification.requestPermission.mockImplementation(async () => {
      browser.state.permission = "granted";
      return "granted";
    });
    browser.install();
    const { user } = renderWithProviders(<PushDeviceSection />);

    await user.click(await screen.findByRole("button", { name: "Turn on for this device" }));
    expect(await screen.findByText("On for this device.")).toBeInTheDocument();
    expect(calls.find((c) => c.method === "PUT")?.body).toMatchObject({ app: "dashboard", locale: "en" });
    expect(localStorage.getItem(OWNER_KEY)).toBe("user_1");
  });

  it("try a notification: POST /me/push/test, and says it was sent", async () => {
    const calls = pushBackend({ devices: [fakeDevice({ id: "dev_here", current: true })] });
    fakeBrowser({ permission: "granted", subscription: fakeSubscription(), registered: true }).install();
    localStorage.setItem(OWNER_KEY, "user_1");
    const { user } = renderWithProviders(<PushDeviceSection />);

    await user.click(await screen.findByRole("button", { name: "Try a notification" }));
    expect(await screen.findByText("Test notification sent. It should appear within a few seconds.")).toBeInTheDocument();
    expect(calls.find((c) => c.path === "/me/push/test")).toEqual({ path: "/me/push/test", method: "POST", body: {} });
  });

  it("lists my devices; one of them is tried, switched off or removed by its own buttons", async () => {
    const calls = pushBackend({
      devices: [fakeDevice({ id: "dev_here", current: true }), fakeDevice({ id: "dev_phone", deviceLabel: "Chrome on Android", lastSuccessAt: new Date().toISOString() })],
    });
    fakeBrowser({ permission: "default" }).install();
    const { user } = renderWithProviders(<PushDeviceSection />);

    const list = await screen.findByTestId("push-devices");
    expect(within(list).getAllByTestId("push-device")).toHaveLength(2);
    expect(within(list).getByText("This device")).toBeInTheDocument();
    await user.click(within(list).getByRole("button", { name: "Try a notification on Chrome on Android" }));
    await waitFor(() => expect(calls.find((c) => c.path === "/me/push/test")?.body).toEqual({ id: "dev_phone" }));
    await user.click(within(list).getByRole("switch", { name: "Notifications on Chrome on Android" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PATCH")).toEqual({ path: "/me/push/subscriptions/dev_phone", method: "PATCH", body: { enabled: false } }));
    await user.click(within(list).getByRole("button", { name: "Remove Chrome on Android" }));
    await waitFor(() => expect(calls.find((c) => c.method === "DELETE")?.path).toBe("/me/push/subscriptions/dev_phone"));
  });

  it("blocked notifications: the steps to allow them again, no button", async () => {
    pushBackend();
    fakeBrowser({ permission: "denied" }).install();
    renderWithProviders(<PushDeviceSection />);
    expect(await screen.findByTestId("push-blocked")).toHaveTextContent("Notifications are blocked for this site");
    expect(screen.queryByRole("button", { name: "Turn on for this device" })).not.toBeInTheDocument();
  });

  it("an iPhone in Safari: the Home Screen steps with the drawing, no button", async () => {
    pushBackend();
    setUserAgent(UA.iphoneSafari, 5);
    renderWithProviders(<PushDeviceSection />);
    expect(await screen.findByTestId("push-ios-steps")).toHaveTextContent("Add to Home Screen");
    expect(screen.getByTestId("push-ios-illustration")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Turn on for this device" })).not.toBeInTheDocument();
  });

  it("an iPhone older than iOS 16.4: says the device cannot, in Arabic too", async () => {
    pushBackend();
    setUserAgent(UA.iphoneOld, 5);
    renderWithProviders(<PushDeviceSection />, { locale: "ar" });
    expect(await screen.findByText(/تحتاج إلى iOS 16.4 أو أحدث/)).toBeInTheDocument();
  });

  it("a browser without the Push API: says so", async () => {
    pushBackend();
    renderWithProviders(<PushDeviceSection />);
    expect(await screen.findByText(/This browser cannot receive device notifications/)).toBeInTheDocument();
  });

  it("is not there at all when the API answers 404", async () => {
    const calls = pushBackend({ config: 404 });
    fakeBrowser().install();
    renderWithProviders(<PushDeviceSection />);
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(screen.queryByTestId("push-device-section")).not.toBeInTheDocument();
  });
});

describe("the Home Screen banner", () => {
  it("shows on an iPhone in Safari, and once closed stays closed", async () => {
    pushBackend({ devices: [] });
    setUserAgent(UA.iphoneSafari, 5);
    const { user, unmount } = renderWithProviders(<PushInstallBanner />);
    const banner = await screen.findByTestId("push-install-banner");
    await user.click(within(banner).getByRole("button", { name: "Show me how" }));
    expect(screen.getByTestId("push-ios-illustration")).toBeInTheDocument();
    await user.click(within(banner).getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByTestId("push-install-banner")).not.toBeInTheDocument();
    expect(localStorage.getItem(INSTALL_HINT_KEY)).toBe("dismissed");
    unmount();
    renderWithProviders(<PushInstallBanner />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByTestId("push-install-banner")).not.toBeInTheDocument();
  });

  it("is not shown once the Home Screen app receives notifications", async () => {
    const calls = pushBackend({ devices: [fakeDevice({ pushService: "apple", deviceLabel: "Safari on iOS" })] });
    setUserAgent(UA.iphoneSafari, 5);
    renderWithProviders(<PushInstallBanner />);
    await waitFor(() => expect(calls.some((c) => c.path.startsWith("/me/push/subscriptions"))).toBe(true));
    expect(screen.queryByTestId("push-install-banner")).not.toBeInTheDocument();
  });

  it("is not shown on a computer, or when the API's push is off", async () => {
    pushBackend();
    renderWithProviders(<PushInstallBanner />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByTestId("push-install-banner")).not.toBeInTheDocument();

    resetPushConfig();
    const calls = pushBackend({ config: 404 });
    setUserAgent(UA.iphoneSafari, 5);
    renderWithProviders(<PushInstallBanner />);
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(screen.queryByTestId("push-install-banner")).not.toBeInTheDocument();
  });
});

describe("?workspace= on any page", () => {
  const second = { id: "ws_2", name: "Second Store" } as (typeof workspaceMock.workspaces)[number];

  it("opens that store when it is one of the user's", () => {
    renderWithProviders(<RequireWorkspace />, { route: "/orders/1?workspace=ws_2", workspace: { workspaces: [...workspaceMock.workspaces, second] } });
    expect(workspaceMock.selectWorkspace).toHaveBeenCalledWith("ws_2");
  });

  it("leaves the current store when it is not", () => {
    renderWithProviders(<RequireWorkspace />, { route: "/orders/1?workspace=ws_other" });
    expect(workspaceMock.selectWorkspace).not.toHaveBeenCalled();
  });
});
