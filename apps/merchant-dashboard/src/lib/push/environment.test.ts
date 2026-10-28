import { describe, expect, it } from "vitest";
import { iosVersion, platformOf, pushSupport, type BrowserFacts } from "./environment";

const UA = {
  iphone17Safari: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
  iphone164Safari: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1",
  iphone163Safari: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Mobile/15E148 Safari/604.1",
  iphone15Chrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/119.0.6045.169 Mobile/15E148 Safari/604.1",
  ipadDesktop: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  macSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  androidChrome: "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
  windowsEdge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
  androidFacebook: "Mozilla/5.0 (Linux; Android 14; SM-A546E; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.0;]",
};

const withApi = { hasServiceWorker: true, hasPushManager: true, hasNotification: true };
const withoutApi = { hasServiceWorker: true, hasPushManager: false, hasNotification: false };
const facts = (userAgent: string, over: Partial<BrowserFacts> = {}): BrowserFacts => ({
  userAgent,
  maxTouchPoints: 0,
  standalone: false,
  ...withApi,
  ...over,
});

describe("which platform", () => {
  it.each([
    [UA.iphone17Safari, 0, "ios"],
    [UA.ipadDesktop, 5, "ios"],
    [UA.macSafari, 0, "mac"],
    [UA.androidChrome, 5, "android"],
    [UA.windowsEdge, 0, "windows"],
  ] as const)("%s → %s", (ua, touch, platform) => {
    expect(platformOf(facts(ua, { maxTouchPoints: touch }))).toBe(platform);
  });

  it("reads the iOS version from an iPhone, and from Safari's version on an iPad in desktop mode", () => {
    expect(iosVersion(UA.iphone164Safari)).toEqual([16, 4]);
    expect(iosVersion(UA.iphone15Chrome)).toEqual([15, 7]);
    expect(iosVersion(UA.ipadDesktop)).toEqual([17, 2]);
  });
});

describe("what this browser can do", () => {
  it("an iPhone in Safari on iOS 16.4 or later: add to the Home Screen first", () => {
    expect(pushSupport(facts(UA.iphone17Safari, withoutApi))).toBe("ios-install");
    expect(pushSupport(facts(UA.iphone164Safari, withoutApi))).toBe("ios-install");
    expect(pushSupport(facts(UA.ipadDesktop, { maxTouchPoints: 5, ...withoutApi }))).toBe("ios-install");
  });

  it("the app added to the Home Screen: ready", () => {
    expect(pushSupport(facts(UA.iphone17Safari, { standalone: true }))).toBe("ready");
  });

  it("iOS older than 16.4: not supported on this device, added to the Home Screen or not", () => {
    expect(pushSupport(facts(UA.iphone163Safari, withoutApi))).toBe("ios-old");
    expect(pushSupport(facts(UA.iphone15Chrome, { ...withoutApi, standalone: true }))).toBe("ios-old");
  });

  it("Android, Windows and a Mac with the Push API: ready", () => {
    expect(pushSupport(facts(UA.androidChrome))).toBe("ready");
    expect(pushSupport(facts(UA.windowsEdge))).toBe("ready");
    expect(pushSupport(facts(UA.macSafari))).toBe("ready");
  });

  it("a browser inside another app, without the Push API: unsupported", () => {
    expect(pushSupport(facts(UA.androidFacebook, withoutApi))).toBe("unsupported");
  });
});
