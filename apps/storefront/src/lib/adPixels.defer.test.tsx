import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const flags = vi.hoisted(() => ({ defer: false }));
vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  get PIXELS_DEFER_ENABLED() {
    return flags.defer;
  },
}));
const noParams = vi.hoisted(() => new URLSearchParams());
vi.mock("next/navigation", () => ({ usePathname: () => "/", useSearchParams: () => noParams }));
// The inline snippets stand for the scripts: mounted, the platform's function is on the page.
vi.mock("next/script", () => ({
  default: function Script({ id }: { id?: string }) {
    if (id === "zimos-meta-pixel") (window as unknown as { fbq: unknown }).fbq = fbq;
    return <span data-testid="script" data-id={id} />;
  },
}));

const fbq = vi.hoisted(() => vi.fn());
const PIXELS = [{ platform: "meta" as const, pixelId: "123456789012345", scope: { type: "all" as const, ids: [] } }];

async function load(defer: boolean) {
  flags.defer = defer;
  vi.resetModules();
  const [pixels, component] = await Promise.all([import("./adPixels"), import("@/components/TrackingPixels")]);
  return { ...pixels, TrackingPixels: component.TrackingPixels };
}

/** The platform's own calls, as [event, options] (`fbq("trackSingle", id, event, data, options)`). */
const sent = () => fbq.mock.calls.map((call) => [call[2], call[4]]);

beforeEach(() => {
  fbq.mockClear();
  delete (window as unknown as { fbq?: unknown }).fbq;
});

/** The clock in the test's hands, and "idle" a moment after the page has loaded. */
function fakeClock() {
  vi.useFakeTimers();
  vi.stubGlobal("requestIdleCallback", (cb: () => void) => setTimeout(cb, 10) as unknown as number);
  vi.stubGlobal("cancelIdleCallback", (id: number) => clearTimeout(id));
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("with the switch off (the default)", () => {
  it("the scripts are on the page from the first render and every event goes straight out", async () => {
    const { TrackingPixels, sendToAdPixels } = await load(false);
    const { queryAllByTestId } = render(<TrackingPixels pixels={PIXELS} />);
    expect(queryAllByTestId("script").map((el) => el.getAttribute("data-id"))).toEqual(["zimos-meta-pixel"]);

    sendToAdPixels("ViewContent", { eventId: "ev-1", contentIds: ["p1"] });
    sendToAdPixels("PageView");
    expect(fbq.mock.calls.map((call) => call[2])).toEqual(["ViewContent", "PageView"]);
    expect(sent()[0][1]).toEqual({ eventID: "ev-1" });
  });

  it("the switch itself reads off unless the build variable is exactly \"true\"", async () => {
    const actual = await vi.importActual<typeof import("@/lib/features")>("@/lib/features");
    expect(actual.PIXELS_DEFER_ENABLED).toBe(false);
  });
});

describe("with the switch on", () => {
  it("a page view and a product view wait for the page to settle, in order and with their ids", async () => {
    fakeClock();
    const { TrackingPixels, sendToAdPixels } = await load(true);
    const { queryAllByTestId } = render(<TrackingPixels pixels={PIXELS} />);
    expect(queryAllByTestId("script")).toEqual([]);

    sendToAdPixels("ViewContent", { eventId: "ev-1" });
    sendToAdPixels("PageView");
    expect(fbq).not.toHaveBeenCalled();

    // jsdom has already loaded: the idle callback is what is left.
    await act(async () => {
      vi.advanceTimersByTime(20);
    });
    expect(queryAllByTestId("script").map((el) => el.getAttribute("data-id"))).toEqual(["zimos-meta-pixel"]);
    expect(fbq.mock.calls.map((call) => call[2])).toEqual(["ViewContent", "PageView"]);
    expect(sent()[0][1]).toEqual({ eventID: "ev-1" });
  });

  it("does not wait past the longest wait when the page never goes idle", async () => {
    fakeClock();
    vi.stubGlobal("requestIdleCallback", () => 1);
    const { TrackingPixels } = await load(true);
    const { queryAllByTestId } = render(<TrackingPixels pixels={PIXELS} />);
    await act(async () => {
      vi.advanceTimersByTime(4999);
    });
    expect(queryAllByTestId("script")).toEqual([]);
    await act(async () => {
      vi.advanceTimersByTime(2);
    });
    expect(queryAllByTestId("script")).toHaveLength(1);
  });

  it.each([
    ["Purchase", { orderId: "order-1" }, "order-1"],
    ["AddToCart", { eventId: "ev-2" }, "ev-2"],
    ["InitiateCheckout", { eventId: "ev-3" }, "ev-3"],
    ["AddPaymentInfo", { eventId: "ev-4" }, "ev-4"],
    ["Lead", { eventId: "ev-5" }, "ev-5"],
  ] as const)("%s does not wait: the scripts go on the page at once, keeping its dedup id", async (event, data, id) => {
    fakeClock();
    const { TrackingPixels, sendToAdPixels } = await load(true);
    const { queryAllByTestId } = render(<TrackingPixels pixels={PIXELS} />);
    sendToAdPixels("PageView");
    await act(async () => {
      sendToAdPixels(event, data);
    });
    // No timer has run: what opened the scripts is the event.
    expect(queryAllByTestId("script")).toHaveLength(1);
    expect(fbq.mock.calls.map((call) => call[2])).toEqual(["PageView", event]);
    expect(sent()[1][1]).toEqual({ eventID: id });
  });

  it("an event sent before the component is listening still opens the scripts", async () => {
    fakeClock();
    const { TrackingPixels, registerPixels, sendToAdPixels } = await load(true);
    registerPixels(PIXELS);
    sendToAdPixels("Purchase", { orderId: "order-2" });
    const { queryAllByTestId } = render(<TrackingPixels pixels={PIXELS} />);
    await act(async () => {});
    expect(queryAllByTestId("script")).toHaveLength(1);
    expect(sent()[0]).toEqual(["Purchase", { eventID: "order-2" }]);
  });

  it("a Purchase the merchant reports from the server only stays out of the browser, held or not", async () => {
    fakeClock();
    const { TrackingPixels, sendToAdPixels } = await load(true);
    const { queryAllByTestId } = render(<TrackingPixels pixels={PIXELS} purchaseTiming="on_delivered" />);
    await act(async () => {
      sendToAdPixels("Purchase", { orderId: "order-3" });
    });
    expect(queryAllByTestId("script")).toEqual([]);
    expect(fbq).not.toHaveBeenCalled();
  });

  it("a product's own pixels get the page view they missed, once the scripts are there", async () => {
    fakeClock();
    const { TrackingPixels, enterProductScope } = await load(true);
    window.sessionStorage.clear();
    const pixels = [{ platform: "meta" as const, pixelId: "999999999999999", scope: { type: "products" as const, ids: ["p-1"] } }];
    render(<TrackingPixels pixels={pixels} />);
    enterProductScope(["p-1"]);
    expect(fbq).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(20);
    });
    expect(fbq.mock.calls[0].slice(0, 3)).toEqual(["trackSingle", "999999999999999", "PageView"]);
  });
});
