/**
 * Ad-pixel events (Meta, TikTok, Snapchat, Google). Not wired yet — pixels
 * come after launch — so both calls are no-ops. The signatures are the real
 * ones, so the call sites in the funnel stay as they are and start reporting
 * the day this file sends events.
 */

export type TrackEvent = "PageView" | "ViewContent" | "AddToCart" | "InitiateCheckout" | "Purchase";

export interface TrackData {
  /** Integer minor units, like every amount the API returns. */
  valueMinor?: number;
  currency?: string;
  contentIds?: string[];
  contentName?: string;
  numItems?: number;
  orderId?: string;
}

export function track(event: TrackEvent, data: TrackData = {}): void {
  void event;
  void data;
}

/** A Purchase that must be reported once per order, however often the page renders. */
export function trackPurchaseOnce(orderId: string, data: TrackData): void {
  void orderId;
  void data;
}
