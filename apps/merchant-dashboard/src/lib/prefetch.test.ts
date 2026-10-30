import { beforeEach, describe, expect, it, vi } from "vitest";

// The registry is a module's own state: each test starts from an empty one.
async function fresh() {
  vi.resetModules();
  return import("./prefetch");
}

describe("prefetching a page's code", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("loads the page whose address is the longest match, once", async () => {
    const { registerPrefetch, prefetchRoute } = await fresh();
    const list = vi.fn(() => Promise.resolve());
    const vip = vi.fn(() => Promise.resolve());
    registerPrefetch("/loyalty", list);
    registerPrefetch("/loyalty/vip", vip);

    prefetchRoute("/loyalty/vip?tab=levels");
    prefetchRoute("/loyalty/vip");
    expect(vip).toHaveBeenCalledTimes(1);
    expect(list).not.toHaveBeenCalled();

    prefetchRoute("/loyalty/anything");
    expect(list).toHaveBeenCalledTimes(1);
  });

  it("does nothing for a page that is not code-split, or whose switch left it unregistered", async () => {
    const { registerPrefetch, prefetchRoute } = await fresh();
    const orders = vi.fn(() => Promise.resolve());
    registerPrefetch("/orders-archive", orders);
    prefetchRoute("/orders");
    prefetchRoute("/blog");
    expect(orders).not.toHaveBeenCalled();
  });

  it("tries again after a load that failed", async () => {
    const { registerPrefetch, prefetchRoute } = await fresh();
    const load = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    registerPrefetch("/inbox", load);
    prefetchRoute("/inbox");
    await Promise.resolve();
    await Promise.resolve();
    prefetchRoute("/inbox");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("loads only the page registered for that very address when asked for an exact match", async () => {
    const { registerPrefetch, prefetchRoute } = await fresh();
    const list = vi.fn(() => Promise.resolve());
    registerPrefetch("/orders", list);
    prefetchRoute("/orders/123", { exact: true });
    expect(list).not.toHaveBeenCalled();
    prefetchRoute("/orders?stage=new", { exact: true });
    expect(list).toHaveBeenCalledTimes(1);
  });

  it("warms the given pages up once the page has loaded and the browser is idle, a few at a time", async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal("window", { setTimeout, requestIdleCallback: undefined, addEventListener: vi.fn() });
      vi.stubGlobal("document", { readyState: "complete" });
      vi.stubGlobal("navigator", {});
      const { warmUpWhenIdle, WARM_UP_DELAY_MS } = await fresh();
      const pages = Array.from({ length: 5 }, () => vi.fn(() => Promise.resolve()));
      warmUpWhenIdle(pages);
      expect(pages[0]).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(WARM_UP_DELAY_MS + 200);
      expect(pages.filter((p) => p.mock.calls.length > 0).length).toBe(3);
      await vi.advanceTimersByTimeAsync(1000);
      for (const page of pages) expect(page).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it("warms nothing up on a connection that asks to save data", async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal("window", { setTimeout, addEventListener: vi.fn() });
      vi.stubGlobal("document", { readyState: "complete" });
      vi.stubGlobal("navigator", { connection: { saveData: true } });
      const { warmUpWhenIdle, WARM_UP_DELAY_MS } = await fresh();
      const page = vi.fn(() => Promise.resolve());
      warmUpWhenIdle([page]);
      await vi.advanceTimersByTimeAsync(WARM_UP_DELAY_MS + 5000);
      expect(page).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it.each([
    ["slow-2g", false],
    ["2g", false],
    ["3g", false],
    ["4g", true],
  ])("on a %s connection, warms up: %s", async (effectiveType, warms) => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal("window", { setTimeout, addEventListener: vi.fn() });
      vi.stubGlobal("document", { readyState: "complete" });
      vi.stubGlobal("navigator", { connection: { saveData: false, effectiveType } });
      const { warmUpWhenIdle, WARM_UP_DELAY_MS } = await fresh();
      const page = vi.fn(() => Promise.resolve());
      warmUpWhenIdle([page]);
      await vi.advanceTimersByTimeAsync(WARM_UP_DELAY_MS + 5000);
      expect(page.mock.calls.length > 0).toBe(warms);
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it("gives a link the three moments a page is warmed at", async () => {
    const { registerPrefetch, prefetchProps } = await fresh();
    const load = vi.fn(() => Promise.resolve());
    registerPrefetch("/media", load);
    const props = prefetchProps("/media");
    expect(Object.keys(props).sort()).toEqual(["onFocus", "onPointerEnter", "onTouchStart"]);
    props.onPointerEnter();
    expect(load).toHaveBeenCalledTimes(1);
  });
});
