import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RealtimeMessage, RealtimeOptions, RealtimeStatus } from "@store-builder/api-client/realtime";
import { LocaleProvider } from "@/i18n/LocaleContext";
import * as notificationsApi from "@/lib/notificationsApi";
import { NotificationBell } from "./NotificationBell";

/**
 * The console bell's count: polled every 60 s with VITE_CONSOLE_REALTIME_ENABLED
 * off (as before, no connection); on, read again on a live console event,
 * every 30 s while the connection is down and every 5 minutes while it is up.
 */

const h = vi.hoisted(() => ({
  enabled: false,
  connections: [] as Array<{ options: RealtimeOptions; closed: boolean }>,
}));

vi.mock("@/lib/features", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features")>();
  return {
    ...actual,
    get CONSOLE_REALTIME_ENABLED() {
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
      status: () => "waiting" as RealtimeStatus,
    };
  },
}));

vi.mock("@/lib/notificationsApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/notificationsApi")>();
  return { ...actual, unreadCount: vi.fn(), listNotifications: vi.fn(), markRead: vi.fn() };
});

const unread = vi.mocked(notificationsApi.unreadCount);

const event = (type: string): RealtimeMessage => ({
  v: 1,
  id: `e-${type}`,
  type,
  workspaceId: null,
  entity: { type: "user", id: "u-1" },
  at: "2026-10-24T10:00:00.000Z",
});

function renderBell() {
  return render(
    <MemoryRouter>
      <LocaleProvider>
        <NotificationBell />
      </LocaleProvider>
    </MemoryRouter>
  );
}

/** Lets the count's promise settle under fake timers. */
async function flush() {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  h.enabled = false;
  h.connections.length = 0;
  unread.mockReset();
  unread.mockResolvedValue(3);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the console bell", () => {
  it("off: reads the count every 60 s and opens no connection", async () => {
    renderBell();
    await flush();
    expect(unread).toHaveBeenCalledTimes(1);
    expect(h.connections).toHaveLength(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(59_000);
    });
    expect(unread).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(unread).toHaveBeenCalledTimes(2);
  });

  it("on: a console event reads the count at once; other messages do not", async () => {
    h.enabled = true;
    renderBell();
    await flush();
    expect(h.connections).toHaveLength(1);
    const { onMessage, onStatus } = h.connections[0].options;
    act(() => onStatus?.("live"));
    await flush();
    unread.mockClear();
    unread.mockResolvedValue(4);

    act(() => onMessage(event("order.created")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(unread).not.toHaveBeenCalled();

    act(() => {
      onMessage(event("merchant.created"));
      onMessage(event("ticket.created"));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(unread).toHaveBeenCalledTimes(1);
    expect(screen.getByText("4")).toBeTruthy();
  });

  it("on: every 30 s while the connection is down, every 5 minutes while it is up", async () => {
    h.enabled = true;
    renderBell();
    await flush();
    unread.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(unread).toHaveBeenCalledTimes(1);

    act(() => h.connections[0].options.onStatus?.("live"));
    await flush();
    unread.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4 * 60_000);
    });
    expect(unread).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(unread).toHaveBeenCalledTimes(1);
  });
});
