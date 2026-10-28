import { afterEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { api } from "@/test/mocks";
import { fakeBrowser, removeBrowserFakes } from "@/test/pushFakes";
import { PushPrompt } from "./PushPrompt";

// VITE_PUSH_ENABLED off (the build default): no offer, no request, and the browser is never asked.

afterEach(() => removeBrowserFakes());

describe("with VITE_PUSH_ENABLED off", () => {
  it("the home page offers nothing, asks /me/push nothing and never asks the browser", async () => {
    const browser = fakeBrowser({ permission: "default" });
    browser.install();
    renderWithProviders(<PushPrompt />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByTestId("push-prompt")).not.toBeInTheDocument();
    expect(api.request).not.toHaveBeenCalled();
    expect(browser.Notification.requestPermission).not.toHaveBeenCalled();
  });
});
