import type { PlanFeatureKey } from "@store-builder/api-client";
import type { Messages } from "@/i18n/LocaleContext";

/**
 * How a plan reads in the dashboard: its feature keys (the backend's
 * billing/featureCatalog) by name, and its limits. Shared by the sign-up plan
 * step, the Google plan page and the subscribe dialog.
 */
export const PLAN_STRINGS = {
  en: {
    perMonth: "/ month",
    perYear: "/ year",
    monthly: "Monthly",
    yearly: "Yearly",
    yearlySave: "Save",
    fullYearLabel: "Instead of paying monthly for a year:",
    perMonthEquivalent: "= {price} / month",
    billingCycle: "Billing cycle",
    trialDays: "Free trial: {days}",
    noTrial: "No free trial",
    storesLabel: "Stores",
    funnelsLabel: "Funnels a month",
    ordersLabel: "Orders a month",
    unlimited: "Unlimited",
    free: "Free",
    custom_domain: "Custom domain",
    funnelsFeature: "Sales funnels",
    whatsapp_confirmation: "WhatsApp order confirmation",
    abandoned_cart: "Abandoned cart recovery",
    multi_warehouse: "Multiple warehouses",
    api_access: "API access",
    staff_accounts: "Staff accounts",
    advanced_analytics: "Advanced analytics",
    visitor_insights: "Visitor insights",
    remove_branding: "Remove platform branding",
    priority_support: "Priority support",
    loyalty: "Loyalty points",
    reviews: "Product and store reviews",
    about_gallery: "About page photo gallery",
    combos: "Product combos",
    advanced_coupons: "Advanced coupons",
  },
  ar: {
    perMonth: "/ شهريًا",
    perYear: "/ سنويًا",
    monthly: "شهري",
    yearly: "سنوي",
    yearlySave: "وفّر",
    fullYearLabel: "بدلًا من الدفع الشهري لمدة سنة:",
    perMonthEquivalent: "= {price} / شهر",
    billingCycle: "دورة الفوترة",
    trialDays: "فترة تجريبية مجانية: {days}",
    noTrial: "بدون فترة تجريبية",
    storesLabel: "المتاجر",
    funnelsLabel: "مسارات البيع شهريًا",
    ordersLabel: "الطلبات شهريًا",
    unlimited: "غير محدود",
    free: "مجانًا",
    custom_domain: "نطاق خاص",
    funnelsFeature: "مسارات البيع",
    whatsapp_confirmation: "تأكيد الطلبات عبر واتساب",
    abandoned_cart: "استرجاع السلات المتروكة",
    multi_warehouse: "مستودعات متعددة",
    api_access: "الوصول عبر API",
    staff_accounts: "حسابات الفريق",
    advanced_analytics: "تحليلات متقدمة",
    visitor_insights: "تحليلات الزوار المفصّلة",
    remove_branding: "إزالة شعار المنصة",
    priority_support: "دعم ذو أولوية",
    loyalty: "نقاط الولاء",
    reviews: "تقييمات المنتجات والمتجر",
    about_gallery: "معرض صور صفحة من نحن",
    combos: "باقات المنتجات",
    advanced_coupons: "كوبونات متقدمة",
  },
} satisfies Messages;

export type PlanText = Record<keyof (typeof PLAN_STRINGS)["en"], string>;

export function featureLabel(key: PlanFeatureKey, t: PlanText): string {
  return key === "funnels" ? t.funnelsFeature : (t[key as keyof PlanText] ?? key);
}

/** "14 days" / "١٤ يومًا", with the Arabic number agreeing with its count. */
export function formatDays(days: number, locale: "ar" | "en"): string {
  if (locale === "en") return days === 1 ? "1 day" : `${days} days`;
  const n = new Intl.NumberFormat("ar-EG").format(days);
  if (days === 1) return "يوم واحد";
  if (days === 2) return "يومان";
  if (days >= 3 && days <= 10) return `${n} أيام`;
  return `${n} يومًا`;
}
