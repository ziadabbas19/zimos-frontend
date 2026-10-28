import {
  ApiError,
  pushGetConfig,
  pushRemoveDevice,
  pushSubscribe,
  type PushConfig,
  type PushDevice,
  type PushSubscriptionInput,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { PUSH_ENABLED } from "@/lib/features";

/**
 * Device notifications in this browser (VITE_PUSH_ENABLED): the service
 * worker, the browser's push subscription and the API's /me/push. The only
 * place in the dashboard that touches the service worker or the manifest
 * (push.guard.test.ts holds every other file to that).
 *
 *  - The API decides whether push is on: GET /me/push/config, read once per
 *    page load. A 404 there (the API's PUSH_ENABLED off, or no VAPID keys) is
 *    "off", and every push screen hides.
 *  - public/sw.js is registered only when the person turns notifications on,
 *    from a click (permission is asked for there, and nowhere else).
 *  - The browser's subscription is bound to the account that turned it on
 *    (OWNER_KEY): on a shared computer another account signing in does not
 *    inherit it; it is dropped instead, and that account turns it on itself.
 *  - On every page load it is sent again (syncPushHere): the API binds it to
 *    the current session and keeps it alive, and a VAPID key that changed
 *    gets a new subscription.
 *  - Signing out drops this browser's subscription (leavePushOnSignOut); the
 *    API removes the device with the session anyway.
 *  - With VITE_PUSH_ENABLED off, a worker a browser kept from an earlier build
 *    is unregistered (removeStaleWorker), so switching the flag off is a clean
 *    way back.
 */

export const SW_URL = "/sw.js";
export const MANIFEST_URL = "/manifest.webmanifest";
export const OWNER_KEY = "zimos.push.owner";

type Locale = "ar" | "en";

let configPromise: Promise<PushConfig | null> | null = null;

/** The API's push config, or null when push is off there (404) or here (VITE_PUSH_ENABLED). Once per page load. */
export function loadPushConfig(): Promise<PushConfig | null> {
  if (!PUSH_ENABLED) return Promise.resolve(null);
  if (!configPromise) {
    configPromise = pushGetConfig(apiClient).then(
      (config) => (config && config.enabled && typeof config.publicKey === "string" && config.publicKey ? config : null),
      (err: unknown) => {
        if (err instanceof ApiError && err.status === 404) return null;
        // Anything else (offline, a 5xx) is asked again next time.
        configPromise = null;
        throw err;
      }
    );
  }
  return configPromise;
}

/** Tests only: forget the config read. */
export function resetPushConfig(): void {
  configPromise = null;
}

const workerApi = () => (typeof navigator !== "undefined" && "serviceWorker" in navigator ? navigator.serviceWorker : null);

function storage(action: (store: Storage) => void) {
  try {
    action(localStorage);
  } catch {
    /* private mode: the owner mark is only a guard for shared computers */
  }
}

function ownerOfThisBrowser(): string | null {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

/** A VAPID public key (base64url) as the bytes PushManager.subscribe wants. */
export function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = base64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function sameKey(subscription: PushSubscription, publicKey: string): boolean {
  const current = subscription.options?.applicationServerKey;
  if (!current) return false;
  const wanted = keyBytes(publicKey);
  const had = new Uint8Array(current);
  return had.length === wanted.length && had.every((byte, i) => byte === wanted[i]);
}

/** PushSubscription.toJSON() as the API takes it. */
export function subscriptionInput(subscription: PushSubscription): PushSubscriptionInput {
  const json = subscription.toJSON();
  return {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime ?? null,
    keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
  };
}

const isOurs = (registration: ServiceWorkerRegistration) => {
  const worker = registration.active ?? registration.waiting ?? registration.installing;
  return Boolean(worker && new URL(worker.scriptURL, window.location.origin).pathname === SW_URL);
};

/** This dashboard's notifications worker, if this browser has it. */
export async function existingRegistration(): Promise<ServiceWorkerRegistration | null> {
  const workers = workerApi();
  if (!workers) return null;
  const registration = await workers.getRegistration("/");
  return registration && isOurs(registration) ? registration : null;
}

/** The subscription this browser holds for this dashboard, or null. */
export async function subscriptionHere(): Promise<PushSubscription | null> {
  const registration = await existingRegistration();
  return registration ? registration.pushManager.getSubscription() : null;
}

/** Whether this browser receives this account's notifications. */
export async function isOnHere(userId: string): Promise<boolean> {
  if (!PUSH_ENABLED) return false;
  const subscription = await subscriptionHere();
  return Boolean(subscription) && ownerOfThisBrowser() === userId;
}

export type EnableResult = { outcome: "on"; device: PushDevice } | { outcome: "denied" } | { outcome: "dismissed" };

/**
 * Turns notifications on for this browser. Must run from a click: the
 * permission prompt is the first thing it does (Safari refuses one that is
 * not), so `config` is the one loadPushConfig already read.
 */
export async function enablePushHere(config: PushConfig, { userId, locale }: { userId: string; locale: Locale }): Promise<EnableResult> {
  const permission = await Notification.requestPermission();
  if (permission === "denied") return { outcome: "denied" };
  if (permission !== "granted") return { outcome: "dismissed" };
  const workers = workerApi();
  if (!workers) throw new Error("Service workers are not available in this browser");
  await workers.register(SW_URL, { scope: "/", updateViaCache: "none" });
  const registration = await workers.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !sameKey(subscription, config.publicKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(config.publicKey) });
  const { subscription: device } = await pushSubscribe(apiClient, { app: "dashboard", subscription: subscriptionInput(subscription), locale });
  storage((store) => store.setItem(OWNER_KEY, userId));
  return { outcome: "on", device };
}

/** Turns notifications off for this browser: the device goes from the API, then the browser's subscription. */
export async function disablePushHere(deviceId: string | null): Promise<void> {
  if (deviceId) {
    try {
      await pushRemoveDevice(apiClient, deviceId);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) throw err;
    }
  }
  const subscription = await subscriptionHere();
  if (subscription) await subscription.unsubscribe();
  storage((store) => store.removeItem(OWNER_KEY));
}

export type SyncResult = "off" | "none" | "dropped" | "synced";

/**
 * On every page load: sends this browser's subscription to the API again (so
 * it follows this session and stays alive), renews it when the VAPID key
 * changed, and drops one that another account turned on.
 */
export async function syncPushHere({ userId, locale }: { userId: string; locale: Locale }): Promise<SyncResult> {
  if (!PUSH_ENABLED) {
    await removeStaleWorker();
    return "off";
  }
  if (typeof Notification === "undefined") return "none";
  const registration = await existingRegistration();
  const subscription = registration ? await registration.pushManager.getSubscription() : null;
  if (!registration || !subscription) return "none";
  if (ownerOfThisBrowser() !== userId || Notification.permission !== "granted") {
    await subscription.unsubscribe();
    storage((store) => store.removeItem(OWNER_KEY));
    return "dropped";
  }
  const config = await loadPushConfig();
  // Off at the API: the browser keeps its subscription for when it is on again.
  if (!config) return "none";
  let current = subscription;
  if (!sameKey(subscription, config.publicKey)) {
    await subscription.unsubscribe();
    current = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(config.publicKey) });
  }
  await pushSubscribe(apiClient, { app: "dashboard", subscription: subscriptionInput(current), locale });
  return "synced";
}

/** VITE_PUSH_ENABLED off: a notifications worker kept from an earlier build goes (and its subscription with it). */
export async function removeStaleWorker(): Promise<number> {
  const workers = workerApi();
  if (!workers || typeof workers.getRegistrations !== "function") return 0;
  const ours = (await workers.getRegistrations()).filter(isOurs);
  await Promise.all(ours.map((registration) => registration.unregister()));
  storage((store) => store.removeItem(OWNER_KEY));
  return ours.length;
}

/** Before signing out: this browser stops receiving the account's notifications. Never holds the sign-out up for long. */
export async function leavePushOnSignOut(): Promise<void> {
  if (!PUSH_ENABLED || !workerApi()) return;
  try {
    await Promise.race([
      subscriptionHere().then((subscription) => subscription?.unsubscribe()),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
  } catch {
    /* the API removes the device with the session anyway */
  } finally {
    storage((store) => store.removeItem(OWNER_KEY));
  }
}

/** The installable-app manifest, linked from here (not from index.html) once push is on. */
export function attachManifest(doc: Document = document): void {
  if (!PUSH_ENABLED || doc.querySelector('link[rel="manifest"]')) return;
  const link = doc.createElement("link");
  link.rel = "manifest";
  link.href = MANIFEST_URL;
  doc.head.appendChild(link);
}

/** A path inside the dashboard ("/orders/…"), never another site. */
export function isAppPath(url: unknown): url is string {
  return typeof url === "string" && url.length <= 300 && url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/\\");
}

/** Messages from public/sw.js: open a page (a notification was clicked), or the subscription was renewed. */
export function listenToWorker(handlers: { open: (url: string) => void; changed: () => void }): () => void {
  const workers = workerApi();
  if (!PUSH_ENABLED || !workers) return () => undefined;
  const onMessage = (event: MessageEvent) => {
    const data = event.data as { type?: unknown; url?: unknown } | null;
    if (data?.type === "zimos.push.open" && isAppPath(data.url)) handlers.open(data.url);
    else if (data?.type === "zimos.push.changed") handlers.changed();
  };
  workers.addEventListener("message", onMessage);
  workers.startMessages?.();
  return () => workers.removeEventListener("message", onMessage);
}
