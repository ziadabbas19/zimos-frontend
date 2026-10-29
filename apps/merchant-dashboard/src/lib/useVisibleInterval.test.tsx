import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useVisibleInterval } from "./useVisibleInterval";

let visibility: DocumentVisibilityState = "visible";

function setVisibility(next: DocumentVisibilityState) {
  visibility = next;
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers();
  visibility = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useVisibleInterval", () => {
  it("ticks every interval while the tab is in view", () => {
    const tick = vi.fn();
    renderHook(() => useVisibleInterval(tick, 2000));
    vi.advanceTimersByTime(6000);
    expect(tick).toHaveBeenCalledTimes(3);
  });

  it("asks nothing while the tab is hidden, and once on coming back", () => {
    const tick = vi.fn();
    renderHook(() => useVisibleInterval(tick, 2000));
    setVisibility("hidden");
    vi.advanceTimersByTime(20_000);
    expect(tick).not.toHaveBeenCalled();
    setVisibility("visible");
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it("stops when switched off and when unmounted", () => {
    const tick = vi.fn();
    const { rerender, unmount } = renderHook(({ on }) => useVisibleInterval(tick, 2000, on), { initialProps: { on: true } });
    vi.advanceTimersByTime(2000);
    rerender({ on: false });
    vi.advanceTimersByTime(10_000);
    expect(tick).toHaveBeenCalledTimes(1);
    rerender({ on: true });
    unmount();
    vi.advanceTimersByTime(10_000);
    expect(tick).toHaveBeenCalledTimes(1);
  });
});
