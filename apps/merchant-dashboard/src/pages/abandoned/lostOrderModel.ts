import { useRef, useSyncExternalStore } from "react";
import {
  LOST_ORDER_TABS,
  type LostOrder,
  type LostOrderRecoveryStatus,
  type LostOrderTab,
} from "@store-builder/api-client";
import type { ContextMenuItem } from "@/components/ContextMenu";

/**
 * System role keys carrying orders.manage, which every action here needs
 * (the list itself only needs orders.view). The dashboard sees only the role
 * key, so a custom role with the permission doesn't get the buttons; one
 * without it that slips through gets the 403 toast.
 */
export const MANAGE_ROLES: ReadonlySet<string> = new Set(["owner", "workspace_manager", "order_operator"]);

export function isTab(value: unknown): value is LostOrderTab {
  return typeof value === "string" && (LOST_ORDER_TABS as readonly string[]).includes(value);
}

/** Phones are masked for roles without customers.reveal_sensitive; «اظهر الرقم» asks the server for the number (audited). */
export const isMasked = (phone: string | null | undefined): boolean => Boolean(phone && phone.includes("*"));
/** A lost order captured from a name alone has no number to reach. */
export const reachable = (phone: string | null | undefined): boolean =>
  Boolean(phone && (/\d{6,}/.test(phone) || isMasked(phone)));
/** A whole number: one that can be dialled, messaged or copied as it is. */
export const dialable = (phone: string | null | undefined): boolean => reachable(phone) && !isMasked(phone);

/** Digits with the country code, for a wa.me link. Egyptian local numbers get 20. */
export function whatsappNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return `20${digits.slice(1)}`;
  return digits;
}

export const RECOVERY_TONE: Record<LostOrderRecoveryStatus, "neutral" | "info" | "success" | "warning"> = {
  not_contacted: "warning",
  contacted: "info",
  recovered: "success",
  lost: "neutral",
};

/** Still waiting for the merchant: every other row is drawn quieter. */
export function needsAttention(session: LostOrder): boolean {
  return session.status !== "converted" && session.recoveryStatus === "not_contacted";
}

/** How the row's WhatsApp works: the store's connected number sends the template, or a wa.me link opens a chat. */
export type WhatsappMode = "unknown" | "store" | "link";

/** Everything a row, a card, Quick Look and the context menu can do — one object, built by useLostOrderActions. */
export interface LostOrderRowActions {
  /** owner / workspace_manager / order_operator: recovery status, review, convert, delete. */
  canManage: boolean;
  whatsappMode: WhatsappMode;
  isSending: (id: string) => boolean;
  isRevealing: (id: string) => boolean;
  /** Open Quick Look on this row. */
  peek: (session: LostOrder) => void;
  /** Send the store's recovery template from its WhatsApp number (asks the first time in the session). */
  sendWhatsapp: (session: LostOrder) => void;
  /** The wa.me link with the recovery message, for a store without a connected number. */
  whatsappHref: (session: LostOrder) => string;
  /** After that link was followed: a manager's untouched row becomes "contacted". */
  whatsappOpened: (session: LostOrder) => void;
  /** The audited reveal of a masked number. Resolves to the number, or null. */
  reveal: (session: LostOrder) => Promise<string | null>;
  setRecovery: (session: LostOrder, next: LostOrderRecoveryStatus) => void;
  toggleReview: (session: LostOrder) => void;
  convert: (session: LostOrder) => void;
  remove: (session: LostOrder) => void;
  recoveryLink: (session: LostOrder) => string | null;
  copy: (text: string, done: string) => void;
  menuFor: (session: LostOrder) => ContextMenuItem[];
}

/* ---------------------------------------------------------------- *
 * Dates of the filter sheet, in the device's own days.
 * ---------------------------------------------------------------- */

export function dayString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type RangePreset = "today" | "7" | "30";
const PRESETS: readonly RangePreset[] = ["today", "7", "30"];
const PRESET_DAYS: Record<RangePreset, number> = { today: 0, "7": 7, "30": 30 };

/** Today, the last 7 days or the last 30, as the two values of the date fields. */
export function rangeOf(preset: RangePreset): { from: string; to: string } {
  const days = PRESET_DAYS[preset];
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - (days === 0 ? 0 : days - 1));
  return { from: dayString(start), to: dayString(today) };
}

/** Which shortcut the two dates amount to today, if any. */
export function presetOf(from: string, to: string): RangePreset | null {
  if (!from || !to) return null;
  for (const preset of PRESETS) {
    const range = rangeOf(preset);
    if (range.from === from && range.to === to) return preset;
  }
  return null;
}

/* ---------------------------------------------------------------- *
 * Search over the rows already on screen (the API has no text search).
 * ---------------------------------------------------------------- */

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
/** The short vowels (fathatan to sukun) and the tatweel: marks people leave out when they type a name. */
const MARKS = new RegExp(`[${String.fromCharCode(0x64b)}-${String.fromCharCode(0x652)}${String.fromCharCode(0x640)}]`, "g");

/** Lower case, Latin digits, no marks, and the letters people type interchangeably folded together. */
function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/[٠-٩۰-۹]/g, (d) => {
      const i = ARABIC_DIGITS.indexOf(d);
      return String(i >= 0 ? i : PERSIAN_DIGITS.indexOf(d));
    })
    .replace(MARKS, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .trim();
}

export function matchesSearch(session: LostOrder, query: string): boolean {
  const q = fold(query);
  if (!q) return true;
  const typed = q.replace(/[\s+()-]/g, "");
  // Only digits typed: a phone number (or its last digits), or the number of the order it became.
  if (typed.length >= 3 && /^\d+$/.test(typed)) {
    const phone = fold(session.phone ?? "").replace(/\D/g, "");
    if (phone.includes(typed)) return true;
    const order = session.convertedOrder ? fold(session.convertedOrder.orderNumber).replace(/\D/g, "") : "";
    return order !== "" && order.includes(typed);
  }
  const haystack = fold(
    [
      session.customerName,
      session.email,
      session.phone,
      session.convertedOrder?.orderNumber,
      session.shippingAddress?.city,
      session.shippingAddress?.province,
      ...session.items.map((item) => item.productName),
    ]
      .filter(Boolean)
      .join(" ")
  );
  return q.split(/\s+/).every((part) => haystack.includes(part));
}

/* ---------------------------------------------------------------- *
 * Small hooks.
 * ---------------------------------------------------------------- */

/** Below Tailwind's md: where a row is a card, and where the dock is. */
const PHONE_QUERY = "(max-width: 47.99rem)";

function subscribeToPhone(onChange: () => void): () => void {
  const query = window.matchMedia?.(PHONE_QUERY);
  if (!query) return () => undefined;
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
function isPhoneNow(): boolean {
  return window.matchMedia?.(PHONE_QUERY).matches === true;
}

/** True on a phone-narrow screen, kept current on resize: the list draws cards there and a table from md. */
export function useIsPhone(): boolean {
  return useSyncExternalStore(subscribeToPhone, isPhoneNow, () => false);
}

/**
 * The last value that was not null: what a sheet or a dialog keeps showing
 * while it closes, after the thing it was about has been let go.
 */
export function useLast<T>(value: T | null): T | null {
  const last = useRef<T | null>(value);
  if (value !== null) last.current = value;
  return value ?? last.current;
}
