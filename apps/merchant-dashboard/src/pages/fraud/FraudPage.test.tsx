import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { PROTECTION_NUMBER_RULES, PROTECTION_SWITCH_RULES } from "@store-builder/api-client";
import { api, testWorkspace } from "@/test/mocks";
import { currentPath, renderWithProviders } from "@/test/renderWithProviders";
import { FraudPage } from "./FraudPage";

/**
 * The protection page: the rules that hold or refuse an order, saved whole
 * from one bar; the flagged orders, the blocked list and the figures behind
 * chips that keep their place in the address.
 */

interface Init {
  method?: string;
  body?: unknown;
}

const owner = { currentWorkspace: { ...testWorkspace, role: "owner", settings: {} } };

function serve() {
  api.listFlaggedOrders.mockResolvedValue({ orders: [], nextCursor: null });
  api.request.mockImplementation(async (path: string, init?: Init) => {
    // The rules are saved on the workspace; the answer is the workspace back.
    if (init?.method === "PATCH" && path === "/workspaces/ws_1") return { workspace: { ...testWorkspace, settings: { fraud_rules: (init.body as { settings: { fraud_rules: unknown } }).settings.fraud_rules } } };
    return new Promise(() => undefined);
  });
}

const saves = () => api.request.mock.calls.filter(([, init]) => init?.method).map(([path, init]) => ({ path, method: init?.method, body: init?.body }));

afterEach(() => {
  api.request.mockReset();
});

describe("the protection page", () => {
  it("keeps its four sections behind chips, each at its own address", async () => {
    serve();
    const { user } = renderWithProviders(<FraudPage />, { route: "/fraud", workspace: owner });

    expect(await screen.findByRole("heading", { name: "Protection" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Flagged/ }));
    expect(currentPath()).toBe("/fraud?tab=flagged");
    await user.click(screen.getByRole("button", { name: /^Rules/ }));
    expect(currentPath()).toBe("/fraud");
  });

  it("saves the whole rule set from one bar once a rule changes", async () => {
    serve();
    const { user } = renderWithProviders(<FraudPage />, { route: "/fraud", workspace: owner });

    expect(screen.queryByRole("button", { name: "Save rules" })).not.toBeInTheDocument();
    await screen.findByRole("heading", { name: "Protection" });
    // The rules are folded into sections: open them all, then change one.
    for (const fold of Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-expanded="false"]'))) await user.click(fold);
    await user.click(await screen.findByRole("switch", { name: /Only accept real mobile numbers/ }));
    await user.click(await screen.findByRole("button", { name: "Save rules" }));

    await waitFor(() => expect(saves()).toHaveLength(1));
    const body = saves()[0].body as { settings: { fraud_rules: Record<string, unknown> } };
    const rules = body.settings.fraud_rules;
    expect(rules.phone_validation).toBe("strict");
    // Every rule goes with the save, as it always did: nothing is left to a default on the server.
    for (const key of [...PROTECTION_NUMBER_RULES, ...PROTECTION_SWITCH_RULES]) expect(JSON.stringify(rules)).toContain(key);
  });

  it("says which rules have no effect, keeps them from being switched on, and shows the real bot guard default", async () => {
    api.listFlaggedOrders.mockResolvedValue({ orders: [], nextCursor: null });
    api.request.mockImplementation(async (path: string, init?: Init) => {
      if (path === "/workspaces/ws_1/fraud/capabilities")
        return {
          botProtection: { platformDefault: true },
          ipIntel: { provider: null },
          captcha: { provider: null },
          visitorGate: { enabled: false },
          networkDeliveryRate: { available: false },
          checkoutOtp: { guard: true, whatsapp: false, sms: false },
        };
      if (init?.method === "PATCH" && path === "/workspaces/ws_1") return { workspace: { ...testWorkspace, settings: { fraud_rules: (init.body as { settings: { fraud_rules: unknown } }).settings.fraud_rules } } };
      return new Promise(() => undefined);
    });
    const { user } = renderWithProviders(<FraudPage />, { route: "/fraud", workspace: owner });
    await screen.findByRole("heading", { name: "Protection" });
    for (const fold of Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-expanded="false"]'))) await user.click(fold);

    // No IP lookup: the VPN rule says so and cannot be switched on; the delivery rate likewise.
    const vpn = await screen.findByRole("switch", { name: /VPN and server addresses/ });
    await waitFor(() => expect(vpn).toBeDisabled());
    expect(vpn).toHaveAccessibleDescription(expect.stringContaining("No effect for now"));
    expect(screen.getByRole("switch", { name: /Low delivery rate/ })).toBeDisabled();
    // Unset, the bot guard follows the platform default, here on — and says so.
    const bot = screen.getByRole("switch", { name: /Bot protection/ });
    expect(bot).toBeChecked();
    expect(bot).toHaveAccessibleDescription(expect.stringContaining("platform default: on"));
    expect(screen.getByRole("switch", { name: /invisible challenge/ })).toBeDisabled();
    // Codes cannot be delivered, and the platform refuses switching them on.
    expect(screen.getByRole("switch", { name: /Ask for a code/ })).toHaveAccessibleDescription(expect.stringContaining("refused until one is set up"));

    // Saving another rule leaves the bot guard unset, so it keeps following the platform.
    await user.click(screen.getByRole("switch", { name: /Only accept real mobile numbers/ }));
    await user.click(await screen.findByRole("button", { name: "Save rules" }));
    await waitFor(() => expect(saves()).toHaveLength(1));
    const rules = (saves()[0].body as { settings: { fraud_rules: Record<string, unknown> } }).settings.fraud_rules;
    expect(rules.bot_protection).toBeNull();
  });

  it("only shows the rules to a role that cannot change them", async () => {
    serve();
    renderWithProviders(<FraudPage />, { route: "/fraud", workspace: { currentWorkspace: { ...testWorkspace, role: "confirmation_agent", settings: {} } }, locale: "ar" });

    expect(await screen.findByRole("heading", { name: "الحماية من الاحتيال" })).toBeInTheDocument();
    for (const control of screen.getAllByRole("switch", { hidden: true })) expect(control).toBeDisabled();
    expect(screen.queryByRole("button", { name: /حفظ/ })).not.toBeInTheDocument();
  });
});
