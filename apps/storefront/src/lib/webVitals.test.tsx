import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createVitalsSender, isVital, parseSampleRate, routeKindOf } from "./webVitals";

describe("the sample", () => {
  it("is none unless it is a share from 0 to 1", () => {
    for (const raw of [undefined, "", "0", "-1", "1.5", "abc", "NaN"]) expect(parseSampleRate(raw)).toBe(0);
    expect(parseSampleRate("0.05")).toBe(0.05);
    expect(parseSampleRate("1")).toBe(1);
  });
});

describe("which kind of page", () => {
  it.each([
    ["/", "home"],
    ["/store/my-shop", "home"],
    ["/store/my-shop/", "home"],
    ["/products", "listing"],
    ["/store/my-shop/products", "listing"],
    ["/products/lamp", "product"],
    ["/store/00000000-0000-4000-8000-000000000001/products/lamp", "product"],
    ["/cart", "cart"],
    ["/checkout", "checkout"],
    ["/account/orders", "other"],
    ["/orders/123", "other"],
    ["/about-us", "page"],
    ["/help/shipping", "page"],
  ])("%s is %s", (path, kind) => {
    expect(routeKindOf(path)).toBe(kind);
  });
});

describe("what goes out", () => {
  const beacon = vi.fn((_url: string, _body: Blob) => true);
  let hidden = false;

  beforeEach(() => {
    beacon.mockClear();
    hidden = false;
    vi.stubGlobal("navigator", { sendBeacon: beacon });
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => (hidden ? "hidden" : "visible"));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const sender = () => createVitalsSender("store-1", () => ({ route: "product", device: "mobile" }));
  const sent = async (call = 0) => JSON.parse(await (beacon.mock.calls[call][1] as Blob).text());

  it("is only the four metrics, the kind of page and the device, under the store", async () => {
    const s = sender();
    expect(isVital("FCP")).toBe(false);
    s.add("LCP", 2100.123456);
    s.add("CLS", 0.0412345);
    s.add("FCP", 900);
    s.add("TTFB", -1);
    s.add("INP", Number.NaN);
    expect(beacon).not.toHaveBeenCalled();
    s.flush();
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(beacon.mock.calls[0][0]).toMatch(/\/store\/store-1\/vitals$/);
    expect(beacon.mock.calls[0][1].type).toContain("text/plain");
    expect(await sent()).toEqual({
      route: "product",
      device: "mobile",
      metrics: [
        { name: "LCP", value: 2100.1235 },
        { name: "CLS", value: 0.0412 },
      ],
    });
  });

  it("keeps a metric's last value, and sends nothing when it has nothing", async () => {
    const s = sender();
    s.flush();
    expect(beacon).not.toHaveBeenCalled();
    s.add("LCP", 1000);
    s.add("LCP", 1500);
    s.flush();
    expect((await sent()).metrics).toEqual([{ name: "LCP", value: 1500 }]);
    s.flush();
    expect(beacon).toHaveBeenCalledTimes(1);
  });

  it("sends a metric at once when the page is already out of sight", async () => {
    const s = sender();
    hidden = true;
    s.add("INP", 180);
    expect(beacon).toHaveBeenCalledTimes(1);
    expect((await sent()).metrics).toEqual([{ name: "INP", value: 180 }]);
  });

  it("a browser with no beacon, or one that throws, breaks nothing", () => {
    vi.stubGlobal("navigator", {});
    const s = sender();
    s.add("LCP", 1);
    expect(() => s.flush()).not.toThrow();
    vi.stubGlobal("navigator", {
      sendBeacon: () => {
        throw new Error("refused");
      },
    });
    s.add("LCP", 1);
    expect(() => s.flush()).not.toThrow();
  });
});

describe("the switch at the build", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("off, the reporter is never drawn", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE", "");
    expect((await import("./webVitals")).WEB_VITALS_SAMPLE_RATE).toBe(0);
  });
});
