import type { DiscountAudience, DiscountSchedule, DiscountType } from "@store-builder/api-client";
import { countOf, pluralOf } from "@/lib/plural";
import { formatCount } from "@/lib/analytics";
import { formatDate, formatDateTime, formatMinorMoney, formatPercent } from "@/lib/format";
import { fmt, getIntlLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { ALL_DAYS } from "./couponControls";
import { weekdayName } from "./CouponControlFields";

/*
 * The coupon in one plain sentence, redrawn as the form changes:
 * «خصم 10% (حتى 50 ج.م) على كل المنتجات عدا منتجين، لأول طلب فقط، أيام الجمعة
 * والسبت من 6 م إلى 11 م، بحد أدنى 300 ج.م، لأول 100 استخدام، مرة واحدة لكل عميل.»
 * Words only: the server decides what a real order gets.
 */

export const SENTENCE_STRINGS = {
  en: {
    title: "In short",
    percentOff: "{percent} off",
    someOff: "A discount",
    fixedOff: "{amount} off",
    freeShipping: "Free shipping",
    buyXGetY: "Buy X get Y",
    cap: "(up to {amount})",
    scopeAll: "on all products",
    scopeProducts_one: "on 1 chosen product",
    scopeProducts_other: "on {n} chosen products",
    scopeCollections_one: "on the products of 1 collection",
    scopeCollections_other: "on the products of {n} collections",
    withShipping: "and shipping",
    except: "except {items}",
    audience_new: "first order only",
    audience_existing: "returning customers only",
    phones: "only for the listed numbers ({count})",
    vip: "only for the chosen VIP tiers ({count})",
    everyDay: "every day",
    oneDay: "on {days}",
    someDays: "on {days}",
    hours: "from {from} to {to}",
    dates: "from {start} until {end}",
    startsOnly: "from {start}",
    endsOnly: "until {end}",
    minimum: "on orders of {amount} or more",
    minQuantity: "with at least {pieces}",
    uses_one: "for the first use only",
    uses_other: "for the first {n} uses",
    perCustomer_one: "once per customer",
    perCustomer_other: "{n} times per customer",
    noSale: "not on items already on sale",
    noOffers: "not on offers, bumps or bundles",
    paused: "paused for now",
    separator: ", ",
    end: ".",
  },
  ar: {
    title: "باختصار",
    percentOff: "خصم {percent}",
    someOff: "خصم",
    fixedOff: "خصم {amount}",
    freeShipping: "شحن مجاني",
    buyXGetY: "اشترِ X واحصل على Y",
    cap: "(حتى {amount})",
    scopeAll: "على كل المنتجات",
    scopeProducts_one: "على منتج واحد محدد",
    scopeProducts_two: "على منتجين محددين",
    scopeProducts_few: "على {n} منتجات محددة",
    scopeProducts_many: "على {n} منتجًا محددًا",
    scopeProducts_other: "على {n} منتج محدد",
    scopeCollections_one: "على منتجات مجموعة واحدة",
    scopeCollections_two: "على منتجات مجموعتين",
    scopeCollections_few: "على منتجات {n} مجموعات",
    scopeCollections_many: "على منتجات {n} مجموعة",
    scopeCollections_other: "على منتجات {n} مجموعة",
    withShipping: "والشحن",
    except: "عدا {items}",
    audience_new: "لأول طلب فقط",
    audience_existing: "للعملاء العائدين فقط",
    phones: "لأرقام الهواتف المحددة فقط ({count})",
    vip: "لمستويات VIP المختارة فقط ({count})",
    everyDay: "كل يوم",
    oneDay: "يوم {days}",
    someDays: "أيام {days}",
    hours: "من {from} إلى {to}",
    dates: "من {start} حتى {end}",
    startsOnly: "بدءًا من {start}",
    endsOnly: "حتى {end}",
    minimum: "بحد أدنى {amount}",
    minQuantity: "عند شراء {pieces} على الأقل",
    uses_one: "لاستخدام واحد فقط",
    uses_two: "لأول استخدامين",
    uses_few: "لأول {n} استخدامات",
    uses_many: "لأول {n} استخدامًا",
    uses_other: "لأول {n} استخدام",
    perCustomer_one: "مرة واحدة لكل عميل",
    perCustomer_two: "مرتين لكل عميل",
    perCustomer_few: "{n} مرات لكل عميل",
    perCustomer_many: "{n} مرة لكل عميل",
    perCustomer_other: "{n} مرة لكل عميل",
    noSale: "لا يشمل المنتجات المخفّضة",
    noOffers: "لا يشمل العروض والإضافات والباقات",
    paused: "متوقف حاليًا",
    separator: "، ",
    end: ".",
  },
} satisfies Messages;

type SentenceStrings = (typeof SENTENCE_STRINGS)["en"];

/** What the sentence says, read from the form as it stands (amounts in minor units, percent in basis points). */
export interface SentenceInput {
  type: DiscountType;
  /** Basis points or minor units; null while not typed (or not valid). */
  value: number | null;
  /** «اشترِ 2 واحصل على 1 مجانًا», for that type when its fields are valid. */
  buyXGetY: string | null;
  maxDiscount: number | null;
  scope: "all" | "products" | "collections";
  productCount: number;
  collectionCount: number;
  excludedCount: number;
  appliesToShipping: boolean;
  appliesToDiscounted: boolean;
  combinesWithOffers: boolean;
  audience: DiscountAudience;
  phoneCount: number;
  vipCount: number;
  schedule: DiscountSchedule | null;
  /** As sent: a date alone ("2026-11-01") or an ISO moment. */
  startsAt: string | null;
  endsAt: string | null;
  minimumSubtotal: number | null;
  minQuantity: number | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  paused: boolean;
}

/** "6 PM" / «٦ م», with the minutes only when there are some. */
function clock(minutes: number, intlLocale: string): string {
  const at = new Date(Date.UTC(2026, 0, 4, 0, minutes));
  return new Intl.DateTimeFormat(intlLocale, { hour: "numeric", minute: minutes % 60 ? "2-digit" : undefined, timeZone: "UTC" }).format(at);
}

function list(items: string[], intlLocale: string): string {
  try {
    return new Intl.ListFormat(intlLocale, { type: "conjunction" }).format(items);
  } catch {
    return items.join(", ");
  }
}

const isDateOnly = (stamp: string) => /^\d{4}-\d{2}-\d{2}$/.test(stamp);
const when = (stamp: string) => (isDateOnly(stamp) ? formatDate(`${stamp}T12:00:00Z`) : formatDateTime(stamp));

function head(input: SentenceInput, t: SentenceStrings, currency: string): string {
  switch (input.type) {
    case "percentage": {
      if (input.value === null) return t.someOff;
      const base = fmt(t.percentOff, { percent: formatPercent(input.value) });
      return input.maxDiscount ? `${base} ${fmt(t.cap, { amount: formatMinorMoney(input.maxDiscount, currency) })}` : base;
    }
    case "fixed":
      return input.value === null ? t.someOff : fmt(t.fixedOff, { amount: formatMinorMoney(input.value, currency) });
    case "free_shipping":
      return t.freeShipping;
    default:
      return input.buyXGetY ?? t.buyXGetY;
  }
}

/** The whole sentence, in the dashboard's language. */
export function describeDiscount(input: SentenceInput, t: SentenceStrings, currency: string): string {
  const intlLocale = getIntlLocale();
  const words: string[] = [head(input, t, currency)];
  if (input.scope === "products") words.push(pluralOf(t, "scopeProducts", input.productCount));
  else if (input.scope === "collections") words.push(pluralOf(t, "scopeCollections", input.collectionCount));
  else if (input.type !== "free_shipping") words.push(t.scopeAll);
  if (input.appliesToShipping && (input.type === "percentage" || input.type === "fixed")) words.push(t.withShipping);
  if (input.scope !== "products" && input.excludedCount > 0) words.push(fmt(t.except, { items: countOf("item", input.excludedCount) }));

  const parts: string[] = [words.join(" ")];
  if (input.audience === "new" || input.audience === "existing") parts.push(t[`audience_${input.audience}`]);
  if (input.phoneCount > 0) parts.push(fmt(t.phones, { count: formatCount(input.phoneCount) }));
  if (input.vipCount > 0) parts.push(fmt(t.vip, { count: formatCount(input.vipCount) }));

  if (input.schedule) {
    const { days, startMinute, endMinute } = input.schedule;
    const allDays = ALL_DAYS.every((day) => days.includes(day));
    // Sunday first, so a weekend reads «الجمعة والسبت».
    const named = ALL_DAYS.filter((day) => days.includes(day)).map((day) => weekdayName(day, intlLocale));
    const dayWords = allDays ? t.everyDay : fmt(named.length === 1 ? t.oneDay : t.someDays, { days: list(named, intlLocale) });
    const wholeDay = startMinute === 0 && endMinute === 1440;
    parts.push(wholeDay ? dayWords : `${dayWords} ${fmt(t.hours, { from: clock(startMinute, intlLocale), to: clock(endMinute, intlLocale) })}`);
  }

  if (input.startsAt && input.endsAt) parts.push(fmt(t.dates, { start: when(input.startsAt), end: when(input.endsAt) }));
  else if (input.startsAt) parts.push(fmt(t.startsOnly, { start: when(input.startsAt) }));
  else if (input.endsAt) parts.push(fmt(t.endsOnly, { end: when(input.endsAt) }));

  if (input.minimumSubtotal) parts.push(fmt(t.minimum, { amount: formatMinorMoney(input.minimumSubtotal, currency) }));
  if (input.minQuantity) parts.push(fmt(t.minQuantity, { pieces: countOf("piece", input.minQuantity) }));
  if (input.usageLimit) parts.push(pluralOf(t, "uses", input.usageLimit));
  if (input.perCustomerLimit) parts.push(pluralOf(t, "perCustomer", input.perCustomerLimit));
  if (!input.appliesToDiscounted) parts.push(t.noSale);
  if (!input.combinesWithOffers) parts.push(t.noOffers);
  if (input.paused) parts.push(t.paused);

  return `${parts.join(t.separator)}${t.end}`;
}

/** «باختصار»: the sentence under its small title, at the foot of the form. */
export function DiscountSentence({ input, currency }: { input: SentenceInput; currency: string }) {
  const t = useT(SENTENCE_STRINGS);
  return (
    <section aria-label={t.title} data-slot="discount-sentence" className="rounded-[1rem] bg-primary-soft/60 px-4 py-3 ring-1 ring-primary/20">
      <p className="text-xs leading-5 font-semibold text-primary-dark dark:text-primary">{t.title}</p>
      <p className="mt-0.5 text-sm leading-6 text-ink">{describeDiscount(input, t, currency)}</p>
    </section>
  );
}
