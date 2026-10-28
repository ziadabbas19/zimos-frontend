import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import type { MerchantNotificationPreferences } from "@store-builder/api-client";
import { renderWithProviders } from "@/test/renderWithProviders";
import { api } from "@/test/mocks";
import { removeBrowserFakes, setUserAgent } from "@/test/pushFakes";
import { PushInstallBanner } from "@/components/push/PushInstallBanner";
import { NotificationPreferencesSection } from "./NotificationPreferencesSection";
import { PushDeviceSection } from "./PushDeviceSection";

// VITE_PUSH_ENABLED off (the build default): as before this existed, whatever the API says.

const PREFERENCES: MerchantNotificationPreferences = {
  soundEnabled: true,
  channels: ["inApp", "email", "push", "whatsapp"],
  types: [{ type: "order.new", inApp: true, email: false, push: true, whatsapp: false }],
};

afterEach(() => removeBrowserFakes());

describe("with VITE_PUSH_ENABLED off", () => {
  it('hides the "Push" column even when the API offers it, and never asks /me/push', async () => {
    api.request.mockImplementation((async (path: string) =>
      path.endsWith("/notifications/preferences") ? PREFERENCES : new Promise(() => undefined)) as never);
    renderWithProviders(<NotificationPreferencesSection />);
    expect(await screen.findByRole("columnheader", { name: "By email" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Push" })).not.toBeInTheDocument();
    expect(api.request.mock.calls.map(([path]) => path).filter((path) => String(path).startsWith("/me/push"))).toEqual([]);
  });

  it("shows no device section and no banner, even on an iPhone in Safari", async () => {
    setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1", 5);
    renderWithProviders(
      <>
        <PushInstallBanner />
        <PushDeviceSection />
      </>
    );
    await waitFor(() => expect(screen.queryByTestId("push-device-section")).not.toBeInTheDocument());
    expect(screen.queryByTestId("push-install-banner")).not.toBeInTheDocument();
    expect(api.request).not.toHaveBeenCalled();
  });
});
