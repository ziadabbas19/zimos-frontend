import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { Workspace } from "@store-builder/api-client";
import { fake, workspaceMock } from "@/test/mocks";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { DevelopersSection } from "./DevelopersSection";

// The switch is a build constant; the tests turn it on and off.
const flags = vi.hoisted(() => ({ ack: false }));
vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  get PUBLIC_API_ACK_ENABLED() {
    return flags.ack;
  },
}));

const EVENTS = [
  { name: "order.created", description: "A new order was placed." },
  { name: "order.accepted", description: "An order was accepted." },
];
const ENDPOINT = {
  id: "wh_1",
  url: "https://hooks.example.com/zimos",
  events: ["*", "order.accepted"],
  isActive: true,
  secretHint: "whsec_…Ab12",
  createdAt: "2026-09-29T10:00:00.000Z",
  updatedAt: "2026-09-29T10:00:00.000Z",
};
const KEY = {
  id: "key_1",
  name: "Till",
  keyPrefix: "zk_7Hq2mP9xa",
  scopes: ["orders:read", "orders:pos_status"],
  rateLimitPerMinute: 60,
  lastUsedAt: null,
  revokedAt: null,
  createdAt: "2026-09-29T10:00:00.000Z",
  createdBy: { id: "user_1", fullName: "Amr Hassan" },
};

function serve(endpoints: unknown[] = [ENDPOINT]) {
  workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", role: "owner" });
  return fakeBackend({
    "GET /plan-features": { features: ["api_access"], enforced: false },
    "GET /api-keys": { apiKeys: [], scopes: [] },
    "GET /webhooks": { endpoints, events: EVENTS, wildcard: "*", explicitOnly: ["order.accepted"] },
    "GET /webhooks/deliveries": { deliveries: [], nextCursor: null },
    "POST /webhooks": { endpoint: { ...ENDPOINT, id: "wh_2" }, signingSecret: "whsec_new" },
    "POST /api-keys": { apiKey: KEY, secret: "zk_7Hq2mP9xa_SECRETSECRETSECRETSECRETSECRETSECRE" },
  });
}

describe("order.accepted beside “All events”", () => {
  it("names an endpoint listening to everything and to order.accepted", async () => {
    serve();
    renderWithProviders(<DevelopersSection />);
    expect(await screen.findByText(/All events \+ order\.accepted/)).toBeInTheDocument();
  });

  it("offers order.accepted under “All events”, and sends it beside “*” when ticked", async () => {
    const calls = serve([]);
    const { user } = renderWithProviders(<DevelopersSection />);
    await screen.findByText("No webhook endpoints yet.");
    await user.click(screen.getByRole("button", { name: "Add endpoint" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/“All events” leaves these out/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/URL/), "https://example.com/hook");
    await user.click(within(dialog).getByRole("checkbox", { name: /order\.accepted/ }));
    await user.click(within(dialog).getByRole("button", { name: "Create" }));
    await waitFor(() => expect(callsTo(calls, "POST", "/webhooks")).toHaveLength(1));
    expect(callsTo(calls, "POST", "/webhooks")[0].body).toEqual({ url: "https://example.com/hook", events: ["*", "order.accepted"] });
  });
});

describe("the kitchen-status scope of an API key", () => {
  it("is not offered while the switch is off", async () => {
    flags.ack = false;
    serve([]);
    const { user } = renderWithProviders(<DevelopersSection />);
    await user.click(await screen.findByRole("button", { name: "New API key" }));
    const dialog = screen.getByRole("dialog", { name: "New API key" });
    expect(within(dialog).queryByText("Kitchen status (till system)")).not.toBeInTheDocument();
  });

  it("adds orders:pos_status when ticked, with the switch on", async () => {
    flags.ack = true;
    const calls = serve([]);
    const { user } = renderWithProviders(<DevelopersSection />);
    await user.click(await screen.findByRole("button", { name: "New API key" }));
    const dialog = screen.getByRole("dialog", { name: "New API key" });
    await user.type(within(dialog).getByLabelText(/Name/), "Till");
    await user.click(within(dialog).getByRole("checkbox", { name: /Kitchen status/ }));
    await user.click(within(dialog).getByRole("button", { name: "Create" }));
    await waitFor(() => expect(callsTo(calls, "POST", "/api-keys")).toHaveLength(1));
    expect(callsTo(calls, "POST", "/api-keys")[0].body).toEqual({ name: "Till", scopes: ["orders:read", "orders:write", "orders:pos_status"] });
  });
});
