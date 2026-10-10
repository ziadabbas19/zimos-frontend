import { useMemo } from "react";
import type {
  LostOrder,
  LostOrderReason,
  LostOrderRecoveryStatus,
  LostOrderReviewStatus,
  LostOrderTab,
} from "@store-builder/api-client";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { formatDate } from "@/lib/format";
import { countOf } from "@/lib/plural";

const STRINGS = {
  en: {
    unnamed: "No name yet",
    reason_incomplete: "Left before finishing",
    reason_invalid_data: "Wrong details",
    reason_integrity_check: "Failed the bot check",
    reason_otp_unverified: "Phone not verified",
    reason_outside_country: "Outside the allowed countries",
    reason_vpn: "VPN or server address",
    reason_blocked: "Blocked customer",
    reason_limit_exceeded: "Over a limit",
    reason_payment_failed: "Payment failed",
    status_awaiting_otp: "Waiting for the code",
    status_in_progress: "Still at checkout",
    status_converted: "Became an order",
    recovery_not_contacted: "Not contacted",
    recovery_contacted: "Contacted",
    recovery_recovered: "Won back",
    recovery_lost: "Gave up",
    review_under_review: "Under review",
    review_completed: "Reviewed",
    source_store: "Store",
    source_funnel: "Funnel",
    tab_all: "All",
    tab_under_review: "Under review",
    tab_completed: "Reviewed",
    tab_recovered: "Won back",
    ago: "{span} ago",
    agoNow: "Just now",
    line: "{name} × {qty}",
    more: "+{n} more",
  },
  ar: {
    unnamed: "بدون اسم بعد",
    reason_incomplete: "ترك صفحة الطلب",
    reason_invalid_data: "بيانات غير صحيحة",
    reason_integrity_check: "فشل فحص البوتات",
    reason_otp_unverified: "الرقم لم يُؤكَّد",
    reason_outside_country: "خارج الدول المسموح بها",
    reason_vpn: "عنوان VPN أو سيرفر",
    reason_blocked: "عميل محظور",
    reason_limit_exceeded: "تجاوز حدًّا",
    reason_payment_failed: "فشل الدفع",
    status_awaiting_otp: "بانتظار الكود",
    status_in_progress: "ما زال في صفحة الطلب",
    status_converted: "تحوّل إلى طلب",
    recovery_not_contacted: "لم يتم التواصل",
    recovery_contacted: "تم التواصل",
    recovery_recovered: "تم الاسترجاع",
    recovery_lost: "لن يكمل",
    review_under_review: "تحت المراجعة",
    review_completed: "تمت مراجعته",
    source_store: "المتجر",
    source_funnel: "مسار بيع",
    tab_all: "الكل",
    tab_under_review: "تحت المراجعة",
    tab_completed: "مكتملة",
    tab_recovered: "مسترجَعة",
    ago: "منذ {span}",
    agoNow: "الآن",
    line: "{name} × {qty}",
    more: "+{n} أخرى",
  },
} satisfies Messages;

export interface LostOrderLabels {
  /** The customer's name; the phone when there is no name; "No name yet" when there is neither. */
  name: (session: LostOrder) => string;
  reason: (reason: LostOrderReason) => string;
  /** Why it is here, in words: the lost reason, or where the checkout stands when there is none. */
  why: (session: LostOrder) => { text: string; warn: boolean } | null;
  /** A second fact beside the reason: still at checkout, or waiting for the code. Null when the reason says it all. */
  stage: (session: LostOrder) => string | null;
  recovery: (status: LostOrderRecoveryStatus) => string;
  review: (status: LostOrderReviewStatus) => string;
  source: (source: "store" | "funnel") => string;
  tab: (tab: LostOrderTab) => string;
  /** «من ٣ ساعات»; the date once it is a month old. */
  ago: (iso: string) => string;
  /** «تيشيرت أبيض × ٢ · +١ كمان»: the first line of the basket and how many more there are. */
  basket: (session: LostOrder) => string;
}

const MINUTE = 60_000;

/** The words every part of the lost orders page shares, so a reason reads the same in the row, the sheet and the menu. */
export function useLostOrderLabels(): LostOrderLabels {
  const t = useT(STRINGS);
  return useMemo<LostOrderLabels>(() => {
    const reason = (key: LostOrderReason) => t[`reason_${key}`];
    return {
      name: (session) => session.customerName?.trim() || session.phone?.trim() || t.unnamed,
      reason,
      why: (session) => {
        if (session.lostReason) return { text: reason(session.lostReason), warn: session.lostReason !== "incomplete" };
        if (session.status === "converted") return { text: t.status_converted, warn: false };
        if (session.status === "awaiting_otp") return { text: t.status_awaiting_otp, warn: false };
        if (session.status === "in_progress") return { text: t.status_in_progress, warn: false };
        return null;
      },
      stage: (session) => {
        // Without a reason, `why` already says where the checkout stands.
        if (!session.lostReason) return null;
        if (session.status === "awaiting_otp") return t.status_awaiting_otp;
        if (session.status === "in_progress") return t.status_in_progress;
        return null;
      },
      recovery: (status) => t[`recovery_${status}`],
      review: (status) => t[`review_${status}`],
      source: (source) => t[`source_${source}`],
      tab: (tab) => t[`tab_${tab}`],
      ago: (iso) => {
        const elapsed = Date.now() - new Date(iso).getTime();
        if (!Number.isFinite(elapsed)) return "—";
        const minutes = Math.floor(elapsed / MINUTE);
        if (minutes < 1) return t.agoNow;
        if (minutes < 60) return fmt(t.ago, { span: countOf("minute", minutes) });
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return fmt(t.ago, { span: countOf("hour", hours) });
        const days = Math.floor(hours / 24);
        if (days < 30) return fmt(t.ago, { span: countOf("day", days) });
        return formatDate(iso);
      },
      basket: (session) => {
        const first = session.items[0];
        if (!first) return "";
        const line = fmt(t.line, { name: first.productName, qty: first.quantity });
        return session.items.length > 1 ? `${line} · ${fmt(t.more, { n: session.items.length - 1 })}` : line;
      },
    };
  }, [t]);
}
