import { act, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RealtimeMessage, RealtimeOptions } from "@store-builder/api-client/realtime";
import { renderWithProviders, currentPath } from "@/test/renderWithProviders";
import { workspaceMock } from "@/test/mocks";
import { LiveUpdates } from "./LiveUpdates";

const h = vi.hoisted(() => ({
  enabled: true,
  connections: [] as Array<{ options: RealtimeOptions; closed: boolean }>,
  refreshWorkCounts: vi.fn(),
  playChime: vi.fn(),
  sound: true,
}));

vi.mock("@/lib/features", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    get REALTIME_ENABLED() {
      return h.enabled;
    },
  };
});

vi.mock("@store-builder/api-client/realtime", () => ({
  connectRealtime: (options: RealtimeOptions) => {
    const entry = { options, closed: false };
    h.connections.push(entry);
    return {
      close: () => {
        entry.closed = true;
      },
      status: () => "waiting",
    };
  },
}));

vi.mock("@/lib/workCounts", () => ({ refreshWorkCounts: h.refreshWorkCounts }));
vi.mock("@/lib/newOrderChime", () => ({ playChime: h.playChime, soundSetting: () => h.sound }));

const message = (type: string, id: string, workspaceId = workspaceMock.currentWorkspace?.id ?? null): RealtimeMessage => ({
  v: 1,
  id: `e-${id}`,
  type,
  workspaceId,
  entity: { type: "order", id },
  at: "2026-10-24T10:00:00.000Z",
});

function send(...messages: RealtimeMessage[]) {
  const live = h.connections.at(-1);
  if (!live) throw new Error("no connection was opened");
  act(() => messages.forEach((m) => live.options.onMessage(m)));
}

beforeEach(() => {
  h.enabled = true;
  h.connections.length = 0;
  h.sound = true;
  h.refreshWorkCounts.mockClear();
  h.playChime.mockClear();
});

describe("live updates in the shell", () => {
  it("off: opens no connection and shows nothing", async () => {
    h.enabled = false;
    renderWithProviders(<LiveUpdates />);
    expect(h.connections).toHaveLength(0);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("a new order of this store: a toast with no customer detail, the counts, the sound, and View opens it", async () => {
    const { user } = renderWithProviders(<LiveUpdates />, { route: "/home" });
    expect(h.connections).toHaveLength(1);
    send(message("order.created", "o-1"));

    const toast = await screen.findByRole("status", {}, { timeout: 3000 });
    expect(toast).toHaveTextContent("New order");
    expect(toast.textContent).not.toMatch(/o-1|EGP|\d{3,}/);
    await waitFor(() => expect(h.refreshWorkCounts).toHaveBeenCalled(), { timeout: 3000 });
    expect(h.playChime).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "View" }));
    expect(currentPath()).toBe("/orders/o-1");
  });

  it("orders of another store, and events that are not about orders, do nothing", async () => {
    renderWithProviders(<LiveUpdates />);
    send(message("order.created", "o-2", "another-store"), message("stock.low", "p-1"));
    await new Promise((resolve) => setTimeout(resolve, 1600));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(h.refreshWorkCounts).not.toHaveBeenCalled();
    expect(h.playChime).not.toHaveBeenCalled();
  });

  it("a burst is one toast; a moved order says so without the sound; no sound when the teammate turned it off", async () => {
    h.sound = false;
    renderWithProviders(<LiveUpdates />, { locale: "ar" });
    send(message("order.created", "a"), message("order.created", "b"), message("order.created", "c"));
    expect(await screen.findByText("طلبات جديدة: 3", {}, { timeout: 3000 })).toBeInTheDocument();
    send(message("order.status_changed", "a"));
    expect(await screen.findByText("تغيّرت مرحلة طلب", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(h.playChime).not.toHaveBeenCalled();
  });

  it("a connection back after a drop reads the counts again: what was sent meanwhile is not sent again", () => {
    renderWithProviders(<LiveUpdates />);
    const live = h.connections.at(-1);
    act(() => live?.options.onReconnect?.());
    expect(h.refreshWorkCounts).toHaveBeenCalledTimes(1);
  });

  it("closes its connection when the shell goes", () => {
    const { unmount } = renderWithProviders(<LiveUpdates />);
    unmount();
    expect(h.connections[0].closed).toBe(true);
  });
});
