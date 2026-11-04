import { getTrackingContext, setPixelInfoProvider } from "./analyticsEvents";
// X, Taboola, Outbrain, Kwai, Reddit and Microsoft Ads: their tags and event wording.
import {
  AD_TAG_PLATFORMS,
  adTagEventsOf,
  sendAdTagPageView,
  sendToAdPlatformTags,
  type AdTagEvent,
  type AdTagEvents,
  type AdTagPlatform,
} from "./adPlatformTags";
import { AD_PIXELS_ENABLED, PIXELS_DEFER_ENABLED } from "./features";
import type { TrackData, TrackEvent } from "./track";

/**
 * The merchant's tracking pixels (dashboard → Marketing → Tracking tools),
 * loaded by components/TrackingPixels.tsx. `track()` in lib/track.ts hands
 * every commerce event here.
 *
 * A store can have several pixels per platform, and each pixel has a scope:
 * the whole store, some funnels, or some products. All of a store's pixels
 * are initialised on load, but an event only goes to the pixels whose scope
 * covers the page — the store-wide ones, the pixels of the funnel being
 * walked, and the pixels of a product the shopper viewed in this visit (so
 * its add-to-cart, checkout and purchase reach the same pixel).
 *
 * Each platform is only called if its script is on the page, so a store with
 * no pixels sends nothing.
 */

export type PixelPlatform = "meta" | "tiktok" | "snapchat" | "google" | "gtm" | "clarity" | "pinterest" | AdTagPlatform;

export interface StorePixel {
  platform: PixelPlatform;
  pixelId: string;
  scope: { type: "all" | "funnels" | "products"; ids: string[] };
  /** Google Ads conversion label, for an `AW-` id. */
  adsConversionLabel?: string;
  /**
   * For X, Taboola, Outbrain, Kwai, Reddit and Microsoft Ads: our event → the
   * platform's name for it (GET /store/:ws). An event without one is not sent.
   */
  events?: AdTagEvents;
}

/** Our event names as the `events` of those pixels key them. */
const AD_TAG_EVENT: Record<TrackEvent, AdTagEvent> = {
  PageView: "page_view",
  ViewContent: "view_content",
  AddToCart: "add_to_cart",
  InitiateCheckout: "begin_checkout",
  AddPaymentInfo: "add_payment_info",
  Purchase: "purchase",
  Lead: "lead",
};

type Fn = (...args: unknown[]) => void;
type TikTokInstance = { track: Fn; page: Fn };
type PixelWindow = Window & {
  fbq?: Fn;
  ttq?: TikTokInstance & { instance?: (id: string) => TikTokInstance };
  snaptr?: Fn;
  pintrk?: Fn;
  gtag?: Fn;
  dataLayer?: unknown[];
};

const TIKTOK: Record<TrackEvent, string> = {
  PageView: "Pageview",
  ViewContent: "ViewContent",
  AddToCart: "AddToCart",
  InitiateCheckout: "InitiateCheckout",
  AddPaymentInfo: "AddPaymentInfo",
  Purchase: "CompletePayment",
  Lead: "SubmitForm",
};
const SNAP: Record<TrackEvent, string> = {
  PageView: "PAGE_VIEW",
  ViewContent: "VIEW_CONTENT",
  AddToCart: "ADD_CART",
  InitiateCheckout: "START_CHECKOUT",
  AddPaymentInfo: "ADD_BILLING",
  Purchase: "PURCHASE",
  Lead: "SIGN_UP",
};
// Pinterest's standard events; a page view is its own call (pintrk("page")), and
// checkout steps before the purchase have no Pinterest event.
const PINTEREST: Partial<Record<TrackEvent, string>> = {
  ViewContent: "pagevisit",
  AddToCart: "addtocart",
  Purchase: "checkout",
  Lead: "lead",
};
const GOOGLE: Record<TrackEvent, string> = {
  PageView: "page_view",
  ViewContent: "view_item",
  AddToCart: "add_to_cart",
  InitiateCheckout: "begin_checkout",
  AddPaymentInfo: "add_payment_info",
  Purchase: "purchase",
  Lead: "generate_lead",
};

// ---------------------------------------------------------------- registry --

let registry: StorePixel[] = [];
/**
 * False when the merchant reports Purchase only once an order is confirmed or
 * delivered (dashboard → Tracking tools): the server sends it then, and the
 * browser pixels must not report it at checkout.
 */
let browserPurchase = true;

export type PurchaseTiming = "on_order" | "on_confirmed" | "on_delivered";

/** `purchaseEventTiming` of GET /store/:workspaceId, defaulting to the usual on_order. */
export function purchaseTimingOf(store: unknown): PurchaseTiming {
  const v = (store as { purchaseEventTiming?: unknown } | null)?.purchaseEventTiming;
  return v === "on_confirmed" || v === "on_delivered" ? v : "on_order";
}
/** Scoped Snap pixels already initialised (Snap has no per-pixel send, so they are added on first match). */
const snapInitialised = new Set<string>();
/** Pinterest tags loaded so far: like Snap, an event goes to every loaded tag, so scoped ones load on first match. */
const pinterestLoaded = new Set<string>();

const VIEWED_KEY = "zimos_pixel_products";

function viewedProducts(): string[] {
  try {
    const raw = window.sessionStorage.getItem(VIEWED_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** components/TrackingPixels calls this with the store's pixels before any event is sent. */
export function registerPixels(pixels: StorePixel[], purchaseTiming: PurchaseTiming = "on_order"): void {
  registry = pixels;
  browserPurchase = purchaseTiming === "on_order";
  // The store-wide Pinterest tags are loaded by the tag script itself (components/TrackingPixels).
  for (const p of pixels) if (p.platform === "pinterest" && p.scope.type === "all") pinterestLoaded.add(p.pixelId);
  setPixelInfoProvider(pixels.length ? pixelInfo : null);
}

function cookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]).slice(0, 400) : undefined;
}

/** A click id from the landing URL, remembered for the visit. */
function clickId(param: string): string | undefined {
  try {
    const key = "zimos_click_" + param;
    const fromUrl = new URLSearchParams(window.location.search).get(param);
    if (fromUrl) window.sessionStorage.setItem(key, fromUrl.slice(0, 400));
    return window.sessionStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * What the API needs to send the same event server-side and have the platform
 * match it: the platforms' own browser ids (set by their scripts) and the
 * products viewed this visit, for product-scoped pixels. No personal data.
 */
function pixelInfo(): Record<string, unknown> | undefined {
  if (typeof window === "undefined" || registry.length === 0) return undefined;
  const fbclid = clickId("fbclid");
  const info: Record<string, unknown> = {
    fbp: cookie("_fbp"),
    fbc: cookie("_fbc") ?? (fbclid ? "fb.1." + Date.now() + "." + fbclid : undefined),
    ttp: cookie("_ttp"),
    ttclid: clickId("ttclid"),
    scCid: clickId("ScCid"),
  };
  const products = viewedProducts().filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (products.length) info.productIds = products;
  for (const key of Object.keys(info)) if (info[key] === undefined) delete info[key];
  return info;
}

function inScope(pixel: StorePixel): boolean {
  if (pixel.scope.type === "all") return true;
  if (pixel.scope.type === "funnels") {
    const funnelId = getTrackingContext()?.funnelId;
    return Boolean(funnelId) && pixel.scope.ids.includes(funnelId as string);
  }
  const viewed = viewedProducts();
  return pixel.scope.ids.some((id) => viewed.includes(id));
}

// ---------------------------------------------------------------- holding --

/*
 * NEXT_PUBLIC_PIXELS_DEFER_ENABLED: the pixels' scripts are the heaviest thing
 * on a shopper's phone, so components/TrackingPixels puts them on the page once
 * the page has loaded and settled, not during hydration. Until then an event
 * waits here, with the id it already has, so the server's copy (sent at once by
 * lib/track.ts, with the same id) still dedups with it on the platform.
 *
 * Only a page view and a product view wait. Anything else (add to cart, checkout,
 * payment info, purchase, lead) puts the scripts on the page right away.
 *
 * Off (the default), nothing waits, and the scripts load as they always did.
 */
const MAY_WAIT: ReadonlySet<TrackEvent> = new Set<TrackEvent>(["PageView", "ViewContent"]);
const SETTLE_IDLE_TIMEOUT_MS = 2000;
const SETTLE_MAX_WAIT_MS = 5000;

let holding = PIXELS_DEFER_ENABLED;
let held: Array<() => void> = [];
let openNow: (() => void) | null = null;
let openAsked = false;

function askToOpen(): void {
  openAsked = true;
  openNow?.();
}

/**
 * Calls `open` once the page has loaded and gone idle (at most
 * SETTLE_MAX_WAIT_MS from now), or as soon as an event that cannot wait asks.
 * Returns the way to stop waiting.
 */
export function whenPixelsMayLoad(open: () => void): () => void {
  if (openAsked) {
    open();
    return () => undefined;
  }
  let idle: number | undefined;
  const stop = () => {
    openNow = null;
    clearTimeout(timer);
    if (idle !== undefined) window.cancelIdleCallback?.(idle);
    window.removeEventListener("load", settle);
  };
  const go = () => {
    stop();
    open();
  };
  function settle() {
    if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(go, { timeout: SETTLE_IDLE_TIMEOUT_MS });
    else go();
  }
  openNow = go;
  const timer = setTimeout(go, SETTLE_MAX_WAIT_MS);
  if (document.readyState === "complete") settle();
  else window.addEventListener("load", settle, { once: true });
  return stop;
}

/** The scripts are on the page (components/TrackingPixels): what waited goes out, in order. */
export function releasePixelEvents(): void {
  holding = false;
  const waiting = held;
  held = [];
  for (const send of waiting) send();
}

/**
 * A product page is on screen (components/PixelScope): its product-scoped
 * pixels join this visit and get the page view they missed on load.
 */
export function enterProductScope(productIds: string[]): void {
  if (typeof window === "undefined" || productIds.length === 0) return;
  const before = new Set(viewedProducts());
  const fresh = productIds.filter((id) => !before.has(id));
  if (fresh.length === 0) return;
  try {
    window.sessionStorage.setItem(VIEWED_KEY, JSON.stringify([...before, ...fresh].slice(-50)));
  } catch {
    return; // storage blocked: product-scoped pixels stay out rather than guess
  }
  const joined = registry.filter((p) => p.scope.type === "products" && p.scope.ids.some((id) => fresh.includes(id)));
  if (joined.length === 0) return;
  if (holding) held.push(() => sendPageViewTo(joined));
  else sendPageViewTo(joined);
}

function sendPageViewTo(pixels: StorePixel[]): void {
  const w = window as PixelWindow;
  try {
    for (const p of pixels) {
      if (p.platform === "meta" && w.fbq) w.fbq("trackSingle", p.pixelId, "PageView");
      if (p.platform === "tiktok" && w.ttq?.instance) w.ttq.instance(p.pixelId).page();
      if (p.platform === "snapchat" && w.snaptr) {
        initSnap(w, p.pixelId);
        w.snaptr("track", "PAGE_VIEW");
      }
      if (p.platform === "google" && w.gtag) w.gtag("event", "page_view", { send_to: p.pixelId });
      if (p.platform === "pinterest" && w.pintrk) {
        loadPinterest(w, p.pixelId);
        w.pintrk("page");
      }
    }
    sendAdTagPageView(pixels);
  } catch {
    /* a broken third-party script must never break the store */
  }
}

function loadPinterest(w: PixelWindow, tagId: string): void {
  if (pinterestLoaded.has(tagId) || !w.pintrk) return;
  pinterestLoaded.add(tagId);
  w.pintrk("load", tagId);
}

function initSnap(w: PixelWindow, pixelId: string): void {
  if (snapInitialised.has(pixelId) || !w.snaptr) return;
  snapInitialised.add(pixelId);
  w.snaptr("init", pixelId, {});
}

// ------------------------------------------------------------------ events --

export function sendToAdPixels(event: TrackEvent, data: TrackData = {}): void {
  if (typeof window === "undefined") return;
  if (event === "Purchase" && !browserPurchase) return;
  // Who the event is for and which page it is about are decided now, even when it goes out a moment later.
  const scoped = registry.filter(inScope);
  const pagePath = window.location.pathname;
  if (holding && registry.length > 0) {
    held.push(() => sendNow(event, data, scoped, pagePath));
    if (!MAY_WAIT.has(event)) askToOpen();
    return;
  }
  sendNow(event, data, scoped, pagePath);
}

function sendNow(event: TrackEvent, data: TrackData, scoped: StorePixel[], pagePath: string): void {
  const active = (platform: PixelPlatform) => scoped.filter((p) => p.platform === platform);
  const w = window as PixelWindow;
  const value = data.valueMinor !== undefined ? Math.round(data.valueMinor) / 100 : undefined;
  const common = { value, currency: data.currency };
  // The order id for a Purchase, a per-event UUID otherwise — the same id the
  // API sends with its server-side copy (backend marketing/pixelEvents.js and
  // browserEventRelay.js), so the two dedup into one event.
  const dedupeId = data.orderId ?? data.eventId;

  try {
    const meta = active("meta");
    if (w.fbq && meta.length) {
      for (const p of meta) {
        if (event === "PageView") w.fbq("trackSingle", p.pixelId, "PageView");
        else
          w.fbq(
            "trackSingle",
            p.pixelId,
            event,
            {
              ...common,
              content_ids: data.contentIds,
              content_name: data.contentName,
              content_type: "product",
              num_items: data.numItems,
            },
            // Same id as the server-side Conversions API event for this order
            // (backend marketing/pixelEvents.js sends order.id verbatim as
            // event_id), so browser and server events dedup into one
            // conversion — on every Meta pixel the event goes to.
            dedupeId ? { eventID: dedupeId } : undefined
          );
      }
    }

    const tiktok = active("tiktok");
    if (w.ttq && tiktok.length) {
      for (const p of tiktok) {
        const ttq = w.ttq.instance ? w.ttq.instance(p.pixelId) : w.ttq;
        if (event === "PageView") ttq.page();
        // Third argument is TikTok's own dedup contract: the same event_id the
        // server-side Events API call carries for this order.
        else
          ttq.track(
            TIKTOK[event],
            { ...common, content_id: data.contentIds?.[0], content_type: "product", quantity: data.numItems },
            dedupeId ? { event_id: dedupeId } : undefined
          );
      }
    }

    const snap = active("snapchat");
    if (w.snaptr && snap.length) {
      for (const p of snap) initSnap(w, p.pixelId);
      // event_id is Snap Conversions API v3's dedup field — same order id sent server-side.
      w.snaptr("track", SNAP[event], {
        price: value,
        currency: data.currency,
        item_ids: data.contentIds,
        number_items: data.numItems,
        transaction_id: data.orderId,
        event_id: dedupeId,
      });
    }

    const pinterest = active("pinterest");
    if (w.pintrk && pinterest.length) {
      for (const p of pinterest) loadPinterest(w, p.pixelId);
      if (event === "PageView") w.pintrk("page");
      else if (PINTEREST[event]) {
        // event_id: the same id a server-side copy would carry, for Pinterest to dedup.
        w.pintrk("track", PINTEREST[event], {
          value,
          currency: data.currency,
          order_quantity: data.numItems,
          order_id: data.orderId,
          event_id: dedupeId,
          line_items: data.contentIds?.map((id) => ({ product_id: id })),
        });
      }
    }

    const google = active("google");
    if (w.gtag && google.length) {
      // send_to keeps the event off the Google tags whose scope does not cover this page.
      w.gtag("event", GOOGLE[event], {
        ...(event === "PageView" ? { page_path: pagePath } : common),
        transaction_id: data.orderId,
        items: data.contentIds?.map((id) => ({ item_id: id })),
        send_to: google.map((p) => p.pixelId),
      });
      if (event === "Purchase") {
        for (const p of google) {
          if (!p.adsConversionLabel || !/^AW-/i.test(p.pixelId)) continue;
          w.gtag("event", "conversion", { ...common, transaction_id: data.orderId, send_to: `${p.pixelId}/${p.adsConversionLabel}` });
        }
      }
    }

    // Tag Manager gets every event on its dataLayer; the merchant's own tags decide what to do with it.
    if (w.dataLayer && active("gtm").length && event !== "PageView") {
      w.dataLayer.push({
        event: GOOGLE[event],
        ecommerce: { ...common, transaction_id: data.orderId, items: data.contentIds?.map((id) => ({ item_id: id })) },
      });
    }

    // X, Taboola, Outbrain, Kwai, Reddit, Microsoft Ads: the in-scope pixels, under the platform's own
    // name for the event, with the same id.
    sendToAdPlatformTags(scoped, AD_TAG_EVENT[event], { value, currency: data.currency, orderId: data.orderId, dedupeId });
  } catch {
    /* a broken third-party script must never break the store */
  }
}

// ------------------------------------------------------------- store pixels --

const PLATFORMS: readonly PixelPlatform[] = [
  "meta",
  "tiktok",
  "snapchat",
  "google",
  "gtm",
  "clarity",
  // The extra ad platforms only while their switch is on (lib/features): off, such a pixel is dropped here, never loaded.
  ...(AD_PIXELS_ENABLED ? (["pinterest", ...AD_TAG_PLATFORMS] as const) : []),
];
// IDs are validated by the backend; re-checked here because they are placed in inline scripts.
const SAFE = /^[A-Za-z0-9_-]{4,64}$/;

/**
 * The pixels from store metadata. GET /store/:workspaceId sends
 * `trackingPixels` (and, from older backends, only the one-ID-per-platform
 * `tracking` block); neither is named by StorefrontMeta, so both are read
 * defensively. Plain module code, so server components can call it.
 */
export function storePixelsOf(store: unknown): StorePixel[] {
  const list = (store as { trackingPixels?: unknown } | null)?.trackingPixels;
  if (Array.isArray(list)) {
    const out: StorePixel[] = [];
    for (const raw of list) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      const platform = r.platform as PixelPlatform;
      const pixelId = typeof r.pixelId === "string" ? r.pixelId.trim() : "";
      if (!PLATFORMS.includes(platform) || !SAFE.test(pixelId)) continue;
      const scope = (r.scope ?? {}) as { type?: unknown; ids?: unknown };
      const type = scope.type === "funnels" || scope.type === "products" ? scope.type : "all";
      const ids = Array.isArray(scope.ids) ? scope.ids.filter((x): x is string => typeof x === "string") : [];
      const label = typeof r.adsConversionLabel === "string" && SAFE.test(r.adsConversionLabel) ? r.adsConversionLabel : undefined;
      const events = adTagEventsOf(platform, r.events);
      out.push({ platform, pixelId, scope: { type, ids }, ...(label ? { adsConversionLabel: label } : {}), ...(events ? { events } : {}) });
    }
    return out;
  }

  const tracking = (store as { tracking?: unknown } | null)?.tracking;
  if (!tracking || typeof tracking !== "object") return [];
  const legacy: Array<[string, PixelPlatform]> = [
    ["meta", "meta"],
    ["tiktok", "tiktok"],
    ["snapchat", "snapchat"],
    ["googleTag", "google"],
  ];
  const out: StorePixel[] = [];
  for (const [key, platform] of legacy) {
    const v = (tracking as Record<string, unknown>)[key];
    if (typeof v === "string" && SAFE.test(v.trim())) out.push({ platform, pixelId: v.trim(), scope: { type: "all", ids: [] } });
  }
  return out;
}
