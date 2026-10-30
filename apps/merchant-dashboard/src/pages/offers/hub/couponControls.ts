import type { Discount, DiscountAudience, DiscountControlsPayload, DiscountSchedule, DiscountType } from "@store-builder/api-client";
import { majorToMinor, minorToMajorInput } from "@/lib/format";

/*
 * The merchant's controls on a coupon, as the form holds them and as they are
 * sent (DiscountControlsPayload): who may use it, the weekly hours, what it
 * leaves out, its cap and its minimum quantity. Shared by the coupon form and
 * the bulk codes dialog. A control left as it starts is the server's old
 * behaviour, except the strict per-customer count, which a NEW coupon starts
 * with on.
 */

/** Days 0–6 (0 = Sunday), in the order an Egyptian week is read: Saturday first. */
export const WEEK_DAYS: readonly number[] = [6, 0, 1, 2, 3, 4, 5];
export const ALL_DAYS: readonly number[] = [0, 1, 2, 3, 4, 5, 6];

/** The most numbers a coupon may be limited to (the server's own limit). */
export const MAX_PHONES = 500;
const MIN_PHONE_DIGITS = 8;

/** Arabic-Indic and Persian digits as ASCII ones. */
export function asciiDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** Phone numbers typed one per line or separated by commas, without blanks or repeats. */
export function parsePhones(text: string): string[] {
  const seen = new Set<string>();
  for (const part of asciiDigits(text).split(/[\n,،;]+/)) {
    const phone = part.trim();
    if (phone) seen.add(phone);
  }
  return [...seen];
}

const digitCount = (phone: string) => phone.replace(/\D/g, "").length;

/** "HH:MM" -> minutes since midnight; null when it is not a time. */
export function timeToMinutes(text: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(asciiDigits(text.trim()));
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Minutes since midnight -> "HH:MM" (1440, the end of the day, is "00:00"). */
export function minutesToTime(total: number): string {
  const minutes = ((Math.round(total) % 1440) + 1440) % 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** A stored start or end, split for a date field and an optional time field (the browser's own time zone). */
export function splitStamp(stamp: string | null | undefined): { date: string; time: string } {
  if (!stamp) return { date: "", time: "" };
  // Saved from a date alone (midnight UTC, as the form always sent it): the date, with no time.
  if (/^\d{4}-\d{2}-\d{2}(T00:00(:00(\.0+)?)?(Z|[+-]00:?00)?)?$/.test(stamp)) return { date: stamp.slice(0, 10), time: "" };
  const when = new Date(stamp);
  if (Number.isNaN(when.getTime())) return { date: stamp.slice(0, 10), time: "" };
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`,
    time: `${pad(when.getHours())}:${pad(when.getMinutes())}`,
  };
}

/**
 * A date and an optional time back to what is sent: the date alone as before
 * ("2026-11-01"), or the moment in the browser's time zone as ISO. Null for no
 * date; undefined when the pair is not a moment.
 */
export function joinStamp(date: string, time: string): string | null | undefined {
  if (!date) return null;
  if (!time) return date;
  const when = new Date(`${date}T${time}`);
  return Number.isNaN(when.getTime()) ? undefined : when.toISOString();
}

export interface ControlsDraft {
  audience: DiscountAudience;
  /** As typed: one per line or comma separated. */
  phones: string;
  vipTierIds: string[];
  scheduleOn: boolean;
  days: number[];
  /** "HH:MM", Cairo time. */
  from: string;
  /** "HH:MM"; "00:00" is the end of the day. */
  to: string;
  /** Major units as typed; a percentage's cap. */
  maxDiscount: string;
  minQuantity: string;
  excludeOn: boolean;
  excludedIds: string[];
  appliesToShipping: boolean;
  appliesToDiscounted: boolean;
  combinesWithOffers: boolean;
  strictCustomerLimit: boolean;
}

/** What the form starts with: the stored controls, or for a new coupon the defaults (strict on). */
export function controlsDraftOf(discount?: Discount): ControlsDraft {
  const schedule = discount?.schedule ?? null;
  const excluded = discount?.excludedProductIds ?? [];
  return {
    audience: discount?.audience ?? "any",
    phones: (discount?.customerPhones ?? []).join("\n"),
    vipTierIds: discount?.vipTierIds ?? [],
    scheduleOn: Boolean(schedule),
    days: schedule ? [...schedule.days] : [...ALL_DAYS],
    from: schedule ? minutesToTime(schedule.startMinute) : "00:00",
    to: schedule ? minutesToTime(schedule.endMinute) : "00:00",
    maxDiscount: minorToMajorInput(discount?.maxDiscountAmount ?? null),
    minQuantity: discount?.minQuantity != null ? String(discount.minQuantity) : "",
    excludeOn: excluded.length > 0,
    excludedIds: excluded,
    appliesToShipping: discount?.appliesToShipping ?? false,
    appliesToDiscounted: discount?.appliesToDiscounted ?? true,
    combinesWithOffers: discount?.combinesWithOffers ?? true,
    strictCustomerLimit: discount ? (discount.strictCustomerLimit ?? false) : true,
  };
}

/** Why a control cannot be sent: the key of its message in CONTROL_STRINGS, and the bad phone when there is one. */
export type ControlsProblem =
  | { field: "maxDiscountAmount"; message: "maxInvalid" }
  | { field: "minQuantity"; message: "minQuantityInvalid" }
  | { field: "customerPhones"; message: "phoneInvalid"; phone: string }
  | { field: "customerPhones"; message: "phonesTooMany" }
  | { field: "schedule"; message: "daysRequired" | "timeInvalid" | "sameTimes" }
  | { field: "excludedProductIds"; message: "excludedRequired" };

/** The weekly hours the draft holds, or null when it has none or they are not valid yet. */
export function scheduleOf(draft: ControlsDraft): DiscountSchedule | null {
  if (!draft.scheduleOn || draft.days.length === 0) return null;
  const start = timeToMinutes(draft.from);
  const end = timeToMinutes(draft.to);
  if (start === null || end === null) return null;
  const endMinute = end === 0 ? 1440 : end;
  if (endMinute === start) return null;
  return { days: [...draft.days].sort((a, b) => a - b), startMinute: start, endMinute };
}

/** Whether a coupon of this type can take the delivery fee too. */
export const takesShipping = (type: DiscountType) => type === "percentage" || type === "fixed";

/**
 * The controls to send, or the problems that stop them. `onlyChosenProducts`:
 * the coupon covers a list of products already, so nothing is left out of it.
 */
export function readControls(
  draft: ControlsDraft,
  type: DiscountType,
  onlyChosenProducts: boolean
): { payload: DiscountControlsPayload; problems: ControlsProblem[] } {
  const problems: ControlsProblem[] = [];

  let maxDiscountAmount: number | null = null;
  if (type === "percentage" && draft.maxDiscount.trim() !== "") {
    maxDiscountAmount = majorToMinor(asciiDigits(draft.maxDiscount));
    if (!Number.isFinite(maxDiscountAmount) || maxDiscountAmount < 1) problems.push({ field: "maxDiscountAmount", message: "maxInvalid" });
  }

  let minQuantity: number | null = null;
  if (draft.minQuantity.trim() !== "") {
    const text = asciiDigits(draft.minQuantity.trim());
    minQuantity = /^\d{1,5}$/.test(text) ? Number(text) : Number.NaN;
    if (!(minQuantity >= 1 && minQuantity <= 10000)) problems.push({ field: "minQuantity", message: "minQuantityInvalid" });
  }

  const customerPhones = parsePhones(draft.phones);
  const badPhone = customerPhones.find((phone) => digitCount(phone) < MIN_PHONE_DIGITS || /[^\d+\s()-]/.test(phone));
  if (badPhone) problems.push({ field: "customerPhones", message: "phoneInvalid", phone: badPhone });
  else if (customerPhones.length > MAX_PHONES) problems.push({ field: "customerPhones", message: "phonesTooMany" });

  let schedule: DiscountSchedule | null = null;
  if (draft.scheduleOn) {
    const start = timeToMinutes(draft.from);
    const end = timeToMinutes(draft.to);
    if (draft.days.length === 0) problems.push({ field: "schedule", message: "daysRequired" });
    else if (start === null || end === null) problems.push({ field: "schedule", message: "timeInvalid" });
    else {
      schedule = scheduleOf(draft);
      if (!schedule) problems.push({ field: "schedule", message: "sameTimes" });
    }
  }

  const excluding = draft.excludeOn && !onlyChosenProducts;
  if (excluding && draft.excludedIds.length === 0) problems.push({ field: "excludedProductIds", message: "excludedRequired" });

  return {
    payload: {
      audience: draft.audience,
      customerPhones,
      vipTierIds: draft.vipTierIds,
      schedule,
      maxDiscountAmount,
      minQuantity,
      excludedProductIds: excluding ? draft.excludedIds : [],
      appliesToShipping: takesShipping(type) && draft.appliesToShipping,
      appliesToDiscounted: draft.appliesToDiscounted,
      combinesWithOffers: draft.combinesWithOffers,
      strictCustomerLimit: draft.strictCustomerLimit,
    },
    problems,
  };
}
