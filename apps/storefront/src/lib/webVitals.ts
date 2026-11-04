/**
 * Core Web Vitals from a small sample of real visits, for the API to keep per
 * store (POST /store/:id/vitals, WEB_VITALS_ENABLED on the API). The sample is
 * NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE, a share from 0 to 1 read at build time;
 * unset or 0, components/StoreWebVitals loads nothing and sends nothing.
 *
 * What goes out: the metric, its value, which kind of page and whether it is a
 * phone. No address, no id, nothing about the visitor.
 */

export type VitalName = "LCP" | "INP" | "CLS" | "TTFB";
export type RouteKind = "home" | "listing" | "product" | "cart" | "checkout" | "page" | "other";
const VITALS: readonly string[] = ["LCP", "INP", "CLS", "TTFB"];

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";

/** A share between 0 and 1; anything else means none. */
export function parseSampleRate(raw: string | undefined): number {
  const rate = Number(raw);
  return raw !== undefined && raw !== "" && Number.isFinite(rate) && rate > 0 && rate <= 1 ? rate : 0;
}

export const WEB_VITALS_SAMPLE_RATE = parseSampleRate(process.env.NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE);

/** Which kind of page an address is, on a store's own host or under /store/<ref>. */
export function routeKindOf(pathname: string): RouteKind {
  const path = pathname.replace(/^\/store\/[^/]+/, "").replace(/\/+$/, "") || "/";
  if (path === "/") return "home";
  if (path === "/products") return "listing";
  if (/^\/products\/[^/]+$/.test(path)) return "product";
  if (path === "/cart") return "cart";
  if (path === "/checkout") return "checkout";
  if (/^\/(account|orders|track|f|pay|r|offer)(\/|$)/.test(path)) return "other";
  return "page";
}

export function isVital(name: string): name is VitalName {
  return VITALS.includes(name);
}

/**
 * Keeps the metrics as they come and sends what it has once the page goes out of
 * sight: INP and CLS only have their final value then, and after it they may
 * still arrive one by one, so each is sent on its own from there on.
 */
export function createVitalsSender(storeId: string, describe: () => { route: RouteKind; device: "mobile" | "desktop" }) {
  const url = `${baseUrl}/store/${encodeURIComponent(storeId)}/vitals`;
  const pending = new Map<VitalName, number>();

  const flush = () => {
    if (pending.size === 0) return;
    const metrics = [...pending].map(([name, value]) => ({ name, value: Math.round(value * 10000) / 10000 }));
    pending.clear();
    const body = JSON.stringify({ ...describe(), metrics });
    try {
      // As plain text: a beacon with no preflight of its own.
      navigator.sendBeacon?.(url, new Blob([body], { type: "text/plain" }));
    } catch {
      /* a measurement never breaks the store */
    }
  };

  return {
    add(name: string, value: number) {
      if (!isVital(name) || !Number.isFinite(value) || value < 0) return;
      pending.set(name, value);
      if (document.visibilityState === "hidden") flush();
    },
    flush,
  };
}
