import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import type { TrackingPixelDto, TrackingPixelPlatformInfo, Workspace } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { MarketingPage } from "./MarketingPage";

const workspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", slug: "nile-store" });

const PLATFORMS: TrackingPixelPlatformInfo[] = [
  { name: "meta", capi: true, testEventCode: true, serverMode: "live" },
  { name: "tiktok", capi: true, testEventCode: true, serverMode: "live" },
  { name: "snapchat", capi: true, testEventCode: false, serverMode: "live" },
  { name: "google", capi: true, testEventCode: false, serverMode: "live" },
  { name: "gtm", capi: false, testEventCode: false, serverMode: null },
  { name: "clarity", capi: false, testEventCode: false, serverMode: null },
];

const pixel = fake<TrackingPixelDto>({
  id: "px_1",
  platform: "meta",
  pixelId: "123456789012345",
  label: "Main ad account",
  capiEnabled: false,
  capiSupported: true,
  capiTokenSet: false,
  capiTokenMask: null,
  testEventCode: null,
  scope: { type: "all", ids: [] },
  config: {},
  isActive: true,
  lastSentAt: null,
  lastError: null,
  createdAt: "2026-09-01T09:00:00.000Z",
  updatedAt: "2026-09-01T09:00:00.000Z",
});

/**
 * The pixels, the purchase timing and the event log come through api.request
 * (/tracking-pixels, /settings, /events): answers each "METHOD path" given,
 * the query left out, and leaves anything else pending.
 */
function serve(routes: Record<string, unknown> = {}) {
  const all: Record<string, unknown> = {
    "GET /workspaces/ws_1/tracking-pixels": { pixels: [pixel], platforms: PLATFORMS, limit: 20 },
    "GET /workspaces/ws_1/tracking-pixels/settings": {
      purchaseEventTiming: "on_order",
      options: ["on_order", "on_confirmed", "on_delivered"],
    },
    "GET /workspaces/ws_1/tracking-pixels/events": { events: [], nextCursor: null, keep: 500 },
    ...routes,
  };
  api.request.mockImplementation(((path: string, opts?: { method?: string }) => {
    const key = `${opts?.method ?? "GET"} ${String(path).split("?")[0]}`;
    return key in all ? Promise.resolve(all[key]) : new Promise<never>(() => undefined);
  }) as never);
}

const render = () =>
  renderWithProviders(<MarketingPage />, {
    route: "/marketing",
    workspace: { currentWorkspace: workspace, workspaces: [workspace] },
  });

/** The calls that wrote something (anything but a GET). */
const writes = () => api.request.mock.calls.filter(([, opts]) => opts?.method && opts.method !== "GET");

/** The Platform field is a list with the platforms' icons (components/IconSelect), not a native select. */
async function pickPlatform(user: UserEvent, dialog: HTMLElement, name: string) {
  await user.click(within(dialog).getByRole("combobox", { name: "Platform" }));
  await user.click(screen.getByRole("option", { name }));
}

describe("MarketingPage", () => {
  it("lists the store's pixels with their platform, ID, scope and status", async () => {
    serve();
    render();

    expect(await screen.findByText("Meta (Facebook & Instagram)")).toBeInTheDocument();
    expect(screen.getByText("123456789012345")).toBeInTheDocument();
    expect(screen.getByText("Main ad account")).toBeInTheDocument();
    expect(screen.getByText("Whole store")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add pixel" })).toBeEnabled();
    expect(await screen.findByText("When to report a purchase")).toBeInTheDocument();
    expect(await screen.findByText("No server events yet")).toBeInTheDocument();
  });

  it("draws each platform's icon in the table and in the Platform list", async () => {
    serve();
    const { user } = render();

    const row = (await screen.findByText("Meta (Facebook & Instagram)")).closest("tr") as HTMLElement;
    expect(row.querySelector('[data-platform-icon="meta"][data-mark="brand"]')).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Add pixel" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a pixel" });
    const field = within(dialog).getByRole("combobox", { name: "Platform" });
    // The chosen platform's icon is on the field itself.
    expect(field).toHaveTextContent("Meta (Facebook & Instagram)");
    expect(field.querySelector('[data-platform-icon="meta"]')).not.toBeNull();

    await user.click(field);
    const list = screen.getByRole("listbox", { name: "Platform" });
    const names = ["Meta (Facebook & Instagram)", "TikTok", "Snapchat", "Google (GA4 / Ads)", "Google Tag Manager", "Microsoft Clarity"];
    expect(within(list).getAllByRole("option")).toHaveLength(names.length);
    for (const name of names) {
      expect(within(list).getByRole("option", { name }).querySelector("[data-platform-icon]")).not.toBeNull();
    }
    // Clarity has no logo in simple-icons: the circle with its letter, hidden from screen readers like the logos.
    expect(within(list).getByRole("option", { name: "Microsoft Clarity" }).querySelector('[data-mark="letter"]')).toHaveTextContent("C");
  });

  it("adds a pixel for another platform, for the whole store", async () => {
    serve({ "POST /workspaces/ws_1/tracking-pixels": { pixel: { ...pixel, id: "px_2", platform: "tiktok" } } });
    const { user } = render();

    await user.click(await screen.findByRole("button", { name: "Add pixel" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a pixel" });
    await pickPlatform(user, dialog, "TikTok");
    await user.type(within(dialog).getByLabelText(/Pixel \/ tag ID/), "C4ABCDEF1234567890");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(api.request).toHaveBeenCalledWith("/workspaces/ws_1/tracking-pixels", {
      method: "POST",
      body: {
        platform: "tiktok",
        pixelId: "C4ABCDEF1234567890",
        label: null,
        capiEnabled: false,
        testEventCode: null,
        scope: { type: "all", ids: [] },
      },
    });
    expect(await screen.findByText("Pixel added. It is live on your store now.")).toBeInTheDocument();
  });

  it("refuses to save an ID the platform would reject", async () => {
    serve();
    const { user } = render();

    await user.click(await screen.findByRole("button", { name: "Add pixel" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a pixel" });
    await pickPlatform(user, dialog, "TikTok");
    await user.type(within(dialog).getByLabelText(/Pixel \/ tag ID/), "nope");

    expect(within(dialog).getByText("That doesn't look like a valid ID for this platform.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled();
    expect(writes()).toHaveLength(0);
  });

  it("saves a change to an existing pixel", async () => {
    serve({ "PATCH /workspaces/ws_1/tracking-pixels/px_1": { pixel: { ...pixel, label: "Spring campaign" } } });
    const { user } = render();

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit pixel" });
    // The platform of a saved pixel is fixed.
    expect(within(dialog).getByRole("combobox", { name: "Platform" })).toBeDisabled();
    const note = within(dialog).getByLabelText("Note");
    await user.clear(note);
    await user.type(note, "Spring campaign");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(api.request).toHaveBeenCalledWith("/workspaces/ws_1/tracking-pixels/px_1", {
      method: "PATCH",
      body: {
        pixelId: "123456789012345",
        label: "Spring campaign",
        capiEnabled: false,
        testEventCode: null,
        scope: { type: "all", ids: [] },
      },
    });
    expect(await screen.findByText("Pixel saved.")).toBeInTheDocument();
  });

  it("builds a tracked store link from the UTM fields", async () => {
    serve();
    const { user } = render();

    await user.type(await screen.findByRole("textbox", { name: "Campaign (utm_campaign)" }), "eid");

    expect(
      screen.getByText(
        "http://localhost:3000/store/nile-store?utm_source=facebook&utm_medium=paid_social&utm_campaign=eid"
      )
    ).toBeInTheDocument();
  });
});
