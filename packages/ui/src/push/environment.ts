/**
 * What this browser can do with device notifications, from what it says about
 * itself. Pure: everything is read from a `BrowserFacts` snapshot, so the
 * rules are tested with user-agent strings alone (environment.test.ts).
 *
 *   ready        the Push API is here: notifications can be turned on
 *   ios-install  an iPhone or iPad on iOS 16.4+, in the browser rather than
 *                the app added to the home screen: Apple sends notifications
 *                only to the added app
 *   ios-old      an iPhone or iPad older than iOS 16.4: no web notifications at all
 *   unsupported  anything else without the Push API (in-app browsers, old ones)
 */

export type Platform = "ios" | "android" | "windows" | "mac" | "other";

export type PushSupport = "ready" | "ios-install" | "ios-old" | "unsupported";

export interface BrowserFacts {
  userAgent: string;
  /** iPadOS says "Macintosh" in its user agent: a touch screen tells it apart. */
  maxTouchPoints: number;
  /** Opened from the home screen / as an installed app. */
  standalone: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
}

/** This browser's facts. Safe to call where a part is missing (each just reads false). */
export function readFacts(): BrowserFacts {
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  const win = typeof window === "undefined" ? undefined : window;
  const standalone =
    Boolean(nav && (nav as Navigator & { standalone?: boolean }).standalone === true) ||
    Boolean(win?.matchMedia?.("(display-mode: standalone)").matches);
  return {
    userAgent: nav?.userAgent ?? "",
    maxTouchPoints: nav?.maxTouchPoints ?? 0,
    standalone,
    hasServiceWorker: Boolean(nav && "serviceWorker" in nav),
    hasPushManager: Boolean(win && "PushManager" in win),
    hasNotification: Boolean(win && "Notification" in win),
  };
}

export function platformOf(facts: BrowserFacts): Platform {
  const ua = facts.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && facts.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Windows/.test(ua)) return "windows";
  if (/Macintosh|Mac OS X/.test(ua)) return "mac";
  return "other";
}

/**
 * [major, minor] of iOS, or null when the agent does not say. An iPhone says
 * "iPhone OS 16_4"; an iPad in desktop mode only gives Safari's "Version/16.4".
 */
export function iosVersion(userAgent: string): [number, number] | null {
  const os = /OS (\d+)[_.](\d+)/.exec(userAgent);
  if (os && /iPhone|iPad|iPod/.test(userAgent)) return [Number(os[1]), Number(os[2])];
  const version = /Version\/(\d+)\.(\d+)/.exec(userAgent);
  return version ? [Number(version[1]), Number(version[2])] : null;
}

const atLeast = (version: [number, number] | null, major: number, minor: number) =>
  version !== null && (version[0] > major || (version[0] === major && version[1] >= minor));

export function pushSupport(facts: BrowserFacts): PushSupport {
  const api = facts.hasServiceWorker && facts.hasPushManager && facts.hasNotification;
  if (platformOf(facts) === "ios") {
    const version = iosVersion(facts.userAgent);
    // An agent that does not say which iOS it is: judge by what the browser has.
    if (version !== null && !atLeast(version, 16, 4)) return "ios-old";
    if (facts.standalone) return api ? "ready" : "unsupported";
    return version === null && !api ? "unsupported" : "ios-install";
  }
  return api ? "ready" : "unsupported";
}
