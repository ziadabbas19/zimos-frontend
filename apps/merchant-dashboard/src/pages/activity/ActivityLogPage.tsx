import { useMemo, useState } from "react";
import { Button, cn } from "@store-builder/ui";
import { IconActivity, IconArrowLeft, IconCaretDown, IconFilter, IconRobot } from "@/components/icons";
import { activityLogList, type ActivityLogEntry } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { fmt, getIntlLocale, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { PageHeader } from "@/components/PageHeader";
import { DataState, SkeletonBar } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { LoadMore } from "@/components/LoadMore";
import { ViewLink } from "@/components/ViewLink";
import { ChipRow, FilterChoice, FilterGroup, FilterSheet, ListToolbar, type ChipItem } from "@/components/list";
import { ActiveFilters, type ActiveFilterChip } from "@/pages/orders/list/ActiveFilters";

/**
 * Activity log: who did what in the store and when, newest
 * first, from the audit trail every change already writes.
 *
 * A timeline: the changes of a day lie on one sheet under the day's name
 * («النهارده», «امبارح», then the date), each as one sentence — who, what
 * they did — with its time at the end. The period is a row of chips; the
 * area and the person are in the one Filters sheet with it. A row that
 * touched an order, a product or a customer links to it, and a row that
 * recorded values folds them under «التفاصيل».
 */

const STRINGS = {
  en: {
    title: "Activity log",
    description: "Every change made in this store: who made it and when.",
    area: "Area",
    person: "Person",
    period: "Period",
    all: "Everything",
    everyone: "Everyone",
    anytime: "Any time",
    today: "Today",
    yesterday: "Yesterday",
    week: "Last 7 days",
    month: "Last 30 days",
    areaChip: "Area: {name}",
    personChip: "By: {name}",
    emptyTitle: "Nothing recorded yet",
    emptyBody: "Every change in the store shows here — an order confirmed, a price edited, a teammate invited — with who made it and when.",
    noMatchTitle: "No change matches these filters",
    noMatchBody: "Try a longer period, another area or another person.",
    clearFilters: "Clear the filters",
    system: "System",
    sentence: "{who} — {what}",
    details: "Details",
    hideDetails: "Hide details",
    detailsOf: "Details of: {what}",
    openOrder: "Open the order",
    openProduct: "Open the product",
    openCustomer: "Open the customer",
    before: "Before",
    after: "After",
    from: "From",
    apply_one: "Show 1 change",
    apply_other: "Show {n} changes",
    applyMore: "Show the changes",
    loading: "Loading the log…",
    "area.order": "Orders",
    "area.shipment": "Shipments",
    "area.product": "Products",
    "area.customer": "Customers",
    "area.discount": "Discounts",
    "area.membership": "Team",
    "area.role": "Roles",
    "area.workspace": "Store settings",
    "area.funnel": "Funnels",
    "area.website": "Store design",
    "area.webhook": "Webhooks",
    "area.api_key": "API keys",
    "area.app": "Apps",
    "area.support": "Support access",
    "area.automation": "Automations",
  },
  ar: {
    title: "سجل النشاط",
    description: "كل تغيير حدث في المتجر: من أجراه ومتى.",
    area: "القسم",
    person: "الشخص",
    period: "الفترة",
    all: "الكل",
    everyone: "الكل",
    anytime: "أي وقت",
    today: "النهارده",
    yesterday: "أمس",
    week: "آخر ٧ أيام",
    month: "آخر ٣٠ يوم",
    areaChip: "القسم: {name}",
    personChip: "المنفّذ: {name}",
    emptyTitle: "لا يوجد شيء مسجّل بعد",
    emptyBody: "كل تغيير في المتجر يظهر هنا — تأكيد طلب، تعديل سعر، دعوة عضو في الفريق — مع من أجراه ومتى.",
    noMatchTitle: "لا يوجد تغيير مطابق لهذه الفلاتر",
    noMatchBody: "جرّب فترة أطول، أو قسمًا آخر، أو شخصًا آخر.",
    clearFilters: "مسح الفلاتر",
    system: "النظام",
    sentence: "{who} — {what}",
    details: "التفاصيل",
    hideDetails: "إخفاء التفاصيل",
    detailsOf: "تفاصيل: {what}",
    openOrder: "فتح الطلب",
    openProduct: "فتح المنتج",
    openCustomer: "فتح صفحة العميل",
    before: "قبل",
    after: "بعد",
    from: "من",
    apply_one: "عرض تغيير واحد",
    apply_two: "عرض تغييرين",
    apply_few: "عرض {n} تغييرات",
    apply_other: "عرض {n} تغييرًا",
    applyMore: "عرض التغييرات",
    loading: "جارٍ تحميل السجل…",
    "area.order": "الطلبات",
    "area.shipment": "الشحنات",
    "area.product": "المنتجات",
    "area.customer": "العملاء",
    "area.discount": "الخصومات",
    "area.membership": "الفريق",
    "area.role": "الأدوار",
    "area.workspace": "إعدادات المتجر",
    "area.funnel": "مسارات البيع",
    "area.website": "تصميم المتجر",
    "area.webhook": "الـ Webhooks",
    "area.api_key": "مفاتيح الـ API",
    "area.app": "التطبيقات",
    "area.support": "إذن الدعم",
    "area.automation": "الأتمتة",
  },
} satisfies Messages;

const AREAS = ["order", "shipment", "product", "customer", "discount", "membership", "role", "workspace", "funnel", "website", "webhook", "api_key", "app", "support", "automation"];
const PAGE = 40;
type Period = "any" | "today" | "week" | "month";

/**
 * The records a row can open. The audit trail names the model it touched
 * (`entityType`, "Order") and that record's id; the other models have no page
 * of their own to go to.
 */
const RECORDS = new Map<string, { path: string; label: "openOrder" | "openProduct" | "openCustomer" }>([
  ["Order", { path: "/orders", label: "openOrder" }],
  ["Product", { path: "/catalog", label: "openProduct" }],
  ["Customer", { path: "/customers", label: "openCustomer" }],
]);
// A deleted record has no page left to open.
const REMOVED = /\.(delete|deleted|delete_permanent|bulk_deleted)$/;

function fromOf(period: Period): string | undefined {
  if (period === "any") return undefined;
  const now = new Date();
  if (period === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  return new Date(now.getTime() - (period === "week" ? 7 : 30) * 86400000).toISOString();
}

/** "order.status_change" → "Order · status change" */
const readable = (action: string) => {
  const [head, ...rest] = action.split(".");
  const words = (text: string) => text.replace(/_/g, " ");
  return rest.length ? `${words(head)[0].toUpperCase()}${words(head).slice(1)} · ${words(rest.join(" "))}` : words(action);
};

/**
 * Arabic names for the audit codes the backend writes ("entity.verb"): the
 * entity by the code's first part, the verb by the rest. English stays as
 * `readable` builds it, and a part missing here keeps those English words — a
 * new backend action still shows, untranslated until it is added.
 */
const ENTITIES_AR: Record<string, string> = {
  // Done by the Zimos team on this store
  admin: "إدارة المنصة",
  // Orders
  order: "الطلب",
  order_email: "إيميلات الطلبات",
  order_rules: "قواعد الطلبات",
  confirmation_task: "تأكيد الطلب",
  checkout_session: "الطلب المفقود",
  shipment: "الشحنة",
  return: "المرتجع",
  settlement: "التسوية",
  blocklist: "قائمة الحظر",
  // Products
  product: "المنتج",
  variant: "المتغير",
  inventory: "المخزون",
  collection: "المجموعة",
  bundle: "الباقة",
  review: "التقييم",
  media: "مكتبة الصور",
  digital_file: "الملف الرقمي",
  digital_delivery: "تسليم المنتج الرقمي",
  digital_grant: "صلاحية التحميل",
  license_codes: "أكواد الترخيص",
  course: "الكورس",
  subscription: "الاشتراك",
  product_economics: "تكاليف المنتج",
  product_feed: "ملف المنتجات",
  // Customers
  customer: "العميل",
  contact: "جهة الاتصال",
  segment: "الشريحة",
  newsletter: "النشرة البريدية",
  form_submission: "رسالة النموذج",
  whatsapp: "واتساب",
  whatsapp_campaign: "حملة واتساب",
  // Marketing
  discount: "الخصم",
  offer: "العرض",
  upsell_rule: "عرض بعد الشراء",
  order_bump: "العرض الإضافي",
  cross_sell: "المنتجات المقترحة",
  exit_downsell: "نافذة الخروج",
  social_proof: "إشعارات المبيعات",
  automation: "الأتمتة",
  affiliate: "المسوّق بالعمولة",
  ad_spend: "الإنفاق الإعلاني",
  tracking_pixel: "البيكسل",
  tracking: "التتبع",
  ai: "الذكاء الاصطناعي",
  // Store
  workspace: "المتجر",
  website: "الموقع",
  page: "الصفحة",
  saved_section: "القسم المحفوظ",
  funnel: "مسار البيع",
  split_test: "اختبار A/B",
  geo_redirect: "التحويل حسب الدولة",
  shoppable_image: "الصورة التفاعلية",
  domain: "الدومين",
  custom_code: "الكود المخصص",
  translation: "الترجمة",
  // Money and shipping
  payment_gateway: "بوابة الدفع",
  payment_methods: "طرق الدفع",
  payment_rules: "قواعد الدفع",
  manual_transfer: "التحويل البنكي",
  saved_payment_method: "وسيلة الدفع المحفوظة",
  currencies: "العملات",
  tax_rate: "الضريبة",
  shipping: "الشحن",
  shipping_zone: "منطقة الشحن",
  shipping_rate: "سعر الشحن",
  shipping_weight_tiers: "شرائح الوزن",
  shipping_zone_tier_prices: "أسعار شرائح الوزن",
  carrier_account: "حساب شركة الشحن",
  dropship: "مورّد الدروبشيبنج",
  billing_invoice: "فاتورة الاشتراك",
  billing_payment: "دفع الاشتراك",
  // Team, access and integrations
  membership: "عضو الفريق",
  role: "الدور",
  notification_preferences: "الإشعارات",
  api_key: "مفتاح الـ API",
  webhook: "الـ Webhooks",
  webhook_endpoint: "الـ Webhook",
  app: "التطبيق",
  integration: "الربط",
  support: "إذن الدعم",
  support_ticket: "تذكرة الدعم",
  // Areas added since the first list (re-audit N-14: no English names in the Arabic log).
  address_autocomplete: "اقتراحات العنوان",
  agent_commission: "عمولة الوكيل",
  auth: "تسجيل الدخول",
  carrier_region_map: "ربط المناطق بشركة الشحن",
  email_marketing: "التسويق بالبريد الإلكتروني",
  lost_order: "الطلب المفقود",
  product_test: "اختبار المنتج",
  referral_code: "كود الإحالة",
  referral_payout: "صرف عمولة الإحالة",
  service_listing: "الخدمة",
  sheets: "جوجل شيتس",
  shipment_batch: "الحجز الجماعي للشحن",
  shopper_accounts: "حسابات العملاء",
  shopper_returns: "مرتجعات العملاء",
  store_place: "المنطقة",
  storefront_texts: "نصوص المتجر",
  template: "القالب",
  template_version: "نسخة القالب",
  theme: "الثيم",
  plan: "الباقة",
  user: "الحساب",
};

const VERBS_AR: Record<string, string> = {
  // Any entity
  create: "إنشاء",
  update: "تعديل",
  delete: "حذف",
  deleted: "حذف",
  delete_permanent: "حذف نهائي",
  add: "إضافة",
  remove: "إزالة",
  save: "حفظ",
  replace: "استبدال",
  duplicate: "تكرار",
  duplicated: "تكرار",
  import: "استيراد",
  imported: "استيراد",
  export: "تصدير",
  upload: "رفع",
  sync: "مزامنة",
  publish: "نشر",
  unpublish: "إلغاء النشر",
  rollback: "رجوع لنسخة سابقة",
  share: "مشاركة",
  unshare: "إلغاء المشاركة",
  archive: "أرشفة",
  unarchive: "استرجاع من الأرشيف",
  restore: "استرجاع",
  reorder: "إعادة ترتيب",
  settings: "تعديل الإعدادات",
  settings_update: "تعديل الإعدادات",
  defaults_update: "تعديل القيم الافتراضية",
  status_change: "تغيير الحالة",
  bulk_create: "إنشاء بالجملة",
  bulk_update: "تعديل بالجملة",
  start: "بدء",
  pause: "إيقاف مؤقت",
  resume: "استئناف",
  cancel: "إلغاء",
  approve: "قبول",
  reject: "رفض",
  confirm: "تأكيد",
  activate: "تفعيل",
  deactivate: "إيقاف",
  suspend: "إيقاف",
  reactivate: "إعادة تفعيل",
  connect: "ربط",
  disconnect: "فصل",
  install: "تثبيت",
  uninstall: "إلغاء التثبيت",
  external_install: "تثبيت تطبيق خارجي",
  external_uninstall: "إلغاء تثبيت تطبيق خارجي",
  assign: "تعيين",
  unassign: "إلغاء التعيين",
  verify: "تحقق",
  test: "إرسال تجريبي",
  request: "طلب",
  apply: "تطبيق",
  reply: "رد",
  admin_reply: "رد من الدعم",
  submit: "إرسال",
  resubmit: "إعادة إرسال",
  subscribe: "اشتراك",
  renew: "تجديد",
  revoke: "إلغاء",
  deliver: "تسليم",
  refund: "استرداد",
  charge: "تحصيل مبلغ",
  payout: "صرف العمولة",
  winner: "اختيار الفائز",
  adjust: "تعديل الكمية",
  // Orders, shipments, returns
  confirmation_state_change: "تغيير حالة التأكيد",
  financial_state_change: "تغيير حالة الدفع",
  fulfillment_state_change: "تغيير حالة التنفيذ",
  items_update: "تعديل المنتجات",
  meta_update: "تعديل البيانات",
  note_add: "إضافة ملاحظة",
  note_delete: "حذف ملاحظة",
  reopen: "إعادة فتح",
  reopened_after_payment: "إعادة فتح بعد الدفع",
  blocked: "حظر",
  blocked_and_cancelled: "حظر وإلغاء",
  risk_approved: "قبول بعد المراجعة",
  switched_to_cod: "تحويل للدفع عند الاستلام",
  payment_link_create: "إنشاء رابط دفع",
  payment_received: "استلام الدفع",
  payment_expired: "انتهاء مهلة الدفع",
  refund_requested: "طلب استرداد",
  refund_failed: "فشل الاسترداد",
  upsell_accepted: "قبول عرض بعد الشراء",
  funnel_offer_merged: "دمج عرض مسار البيع في الطلب",
  funnel_offer_separate: "عرض مسار البيع كطلب مستقل",
  claim: "استلام",
  release: "إرجاع للقائمة",
  correct: "تصحيح النتيجة",
  lock_expired: "انتهاء مهلة الاستلام",
  recovery_update: "تعديل حالة الاسترجاع",
  converted: "تحوّل إلى طلب",
  restock: "إعادة إلى المخزون",
  booking_not_saved: "حجز لم يُحفظ",
  carrier_cancel_unconfirmed: "إلغاء لم تؤكده شركة الشحن",
  statement_import: "استيراد كشف",
  entry_added: "إضافة للقائمة",
  entry_removed: "إزالة من القائمة",
  push_order: "إرسال طلب",
  // Customers and messages
  reveal_sensitive: "عرض البيانات الحساسة",
  blacklist_change: "تغيير الحظر",
  address_add: "إضافة عنوان",
  address_update: "تعديل عنوان",
  "marketing_consent.withdrawn": "سحب الموافقة على التسويق",
  reported_spam: "بلاغ عن رسائل مزعجة",
  tags_set: "تعديل الوسوم",
  bulk_tag: "وسوم بالجملة",
  "conversation.assign": "تعيين محادثة",
  "quick_reply.create": "إنشاء رد سريع",
  "quick_reply.update": "تعديل رد سريع",
  "quick_reply.delete": "حذف رد سريع",
  // Products and what they sell
  add_product: "إضافة منتج",
  remove_product: "إزالة منتج",
  reorder_products: "إعادة ترتيب المنتجات",
  set_products: "تحديد المنتجات",
  billing_plan_set: "تحديد خطة الاشتراك",
  create_manual: "إضافة يدوية",
  delete_manual: "حذف يدوي",
  enroll_manual: "تسجيل طالب يدويًا",
  enrollment_revoke: "إلغاء تسجيل طالب",
  enrollment_restore: "استرجاع تسجيل طالب",
  outline_save: "حفظ المحتوى",
  // Store, funnels and tracking
  "step.create": "إضافة خطوة",
  "step.update": "تعديل خطوة",
  "step.delete": "حذف خطوة",
  "edge.create": "ربط خطوتين",
  "edge.update": "تعديل ربط الخطوات",
  "edge.delete": "حذف ربط الخطوات",
  "branding.update": "تعديل الشعار والهوية",
  ssl_check: "فحص شهادة SSL",
  pricing_mode: "تغيير طريقة التسعير",
  rates_refresh: "تحديث أسعار الصرف",
  test_event: "إرسال حدث تجريبي",
  "purchase_timing.update": "تعديل توقيت حدث الشراء",
  "server_pixels.connect": "ربط أحداث السيرفر",
  "server_pixels.disconnect": "فصل أحداث السيرفر",
  "whatsapp.connect": "ربط واتساب",
  "whatsapp.disconnect": "فصل واتساب",
  // Team and access
  invite: "دعوة",
  invite_resend: "إعادة إرسال الدعوة",
  role_change: "تغيير الدور",
  shortcuts_set: "تعديل الاختصارات",
  rotate_secret: "تغيير مفتاح التوقيع",
  auto_disable: "إيقاف تلقائي",
  resend_orders: "إعادة إرسال الطلبات",
  access_grant: "منح",
  access_revoke: "إنهاء",
  access_used: "استخدام",
  // The store's own subscription
  trial_start: "بدء الفترة التجريبية",
  draft_released: "بدء الاشتراك مع تشغيل المتجر",
  special_terms_grant: "منح شروط خاصة",
  free_plan_activate: "تفعيل الخطة المجانية",
  billing_cycle_change: "تغيير مدة الاشتراك",
  "subscription.update": "تعديل الاشتراك",
  cancel_by_customer: "إلغاء من العميل",
  referral_code_attach: "إضافة كود إحالة",
  record_payment: "تسجيل دفعة",
  reverse_payment: "إلغاء دفعة",
  refund_reported: "تسجيل استرداد",
  // Actions added since the first list.
  account_connect: "ربط الحساب",
  account_disconnect: "فصل الحساب",
  account_settings_update: "تعديل إعدادات الحساب",
  ai_apply: "تطبيق اقتراح الذكاء الاصطناعي",
  app_update: "تعديل التطبيق",
  apply_policies: "تطبيق السياسات",
  auto_booking_failed: "فشل الحجز التلقائي",
  auto_renew: "التجديد التلقائي",
  backfill: "استكمال البيانات",
  base_change: "تغيير الأساس",
  booking_update: "تعديل الحجز",
  bot_settings_update: "تعديل إعدادات البوت",
  bulk_deleted: "حذف جماعي",
  card_update_by_customer: "تحديث البطاقة من العميل",
  "carrier_region_map.reset": "العودة إلى الربط الافتراضي",
  "carrier_region_map.update": "تعديل الربط",
  connection_create: "إضافة ربط",
  connection_delete: "حذف ربط",
  connection_update: "تعديل ربط",
  education_links_update: "تعديل روابط التعليم",
  email_change: "تغيير البريد الإلكتروني",
  email_change_cancel: "إلغاء تغيير البريد الإلكتروني",
  email_change_request: "طلب تغيير البريد الإلكتروني",
  forward_failed: "فشل التحويل",
  html_block_update: "تعديل كود HTML",
  login: "تسجيل الدخول",
  mark_paid: "تعليم كمدفوع",
  merchant_join: "انضمام تاجر",
  options_update: "تعديل الخيارات",
  override_remove: "إلغاء التخصيص",
  password_reset: "تغيير كلمة المرور",
  password_reset_sms: "تغيير كلمة المرور برسالة",
  phone_verified: "تأكيد رقم الهاتف",
  plan_select: "اختيار الباقة",
  prices: "تعديل الأسعار",
  profile_create: "إضافة ملف",
  profile_delete: "حذف ملف",
  profile_products: "منتجات الملف",
  profile_update: "تعديل ملف",
  purchase: "شراء",
  queue_job_retry: "إعادة المحاولة",
  referral_program_update: "تعديل برنامج الإحالة",
  register: "إنشاء حساب",
  request_by_shopper: "طلب من العميل",
  reset: "العودة إلى الافتراضي",
  retry: "إعادة المحاولة",
  reveal_phone: "إظهار الرقم",
  revoke_all_sessions: "تسجيل الخروج من كل الأجهزة",
  revoke_session: "إنهاء جلسة",
  sandbox_advance: "تقديم حالة تجريبية",
  sender_update: "تعديل المرسل",
  shipment_draft: "مسودة شحنة",
  shipment_draft_discard: "إلغاء مسودة الشحنة",
  status_update: "تعديل الحالة",
  store_app_update: "تعديل تطبيق المتجر",
  trusted_devices_forget: "نسيان الأجهزة الموثوقة",
  two_factor_backup_code_used: "استخدام كود احتياطي",
  two_factor_backup_codes: "أكواد احتياطية جديدة",
  two_factor_disable: "إيقاف التحقق بخطوتين",
  two_factor_enable: "تفعيل التحقق بخطوتين",
  user_two_factor_reset: "إعادة ضبط التحقق بخطوتين",
  "verify.confirm": "تأكيد التحقق",
  "verify.fail": "فشل التحقق",
  "verify.send": "إرسال كود التحقق",
  whatsapp_confirm: "تأكيد عبر واتساب",
  whatsapp_sent: "إرسال واتساب",
};

/** "order.status_change" → "الأوردر · تغيير الحالة" */
const readableAr = (action: string) => {
  const [head, ...rest] = action.split(".");
  if (!rest.length) return ENTITIES_AR[head] ?? readable(action);
  const [entity, verb] = readable(action).split(" · ");
  return `${ENTITIES_AR[head] ?? entity} · ${VERBS_AR[rest.join(".")] ?? verb}`;
};

type T = Record<keyof (typeof STRINGS)["en"], string>;

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** «النهارده», «امبارح», then the day in words — with its year only when it is not this one. */
function dayLabel(iso: string, t: T): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const now = new Date();
  const daysAgo = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  if (daysAgo === 0) return t.today;
  if (daysAgo === 1) return t.yesterday;
  return date.toLocaleDateString(getIntlLocale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" as const } : {}),
  });
}

function timeOf(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(getIntlLocale(), { hour: "2-digit", minute: "2-digit" });
}

interface DayGroup {
  key: number;
  label: string;
  rows: ActivityLogEntry[];
}

/** The rows as they came (newest first), cut where the day changes. */
function byDay(rows: ActivityLogEntry[], t: T): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const row of rows) {
    const key = startOfDay(new Date(row.createdAt));
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.rows.push(row);
    else groups.push({ key, label: dayLabel(row.createdAt, t), rows: [row] });
  }
  return groups;
}

/** A link or a button of a row: a quiet pill, 44px under a finger. */
const ROW_ACTION =
  "inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-full px-2.5 text-[13px] font-medium text-primary transition-[background-color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 pointer-fine:min-h-8";

/** A day of the timeline while the first page loads: its name, then rows in the rows' own shape. */
function TimelineSkeleton() {
  return (
    <div aria-hidden>
      <SkeletonBar className="mx-1 mb-3 h-3 w-20" />
      <ul data-slot="activity-day" className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper-raised shadow-[var(--shadow-card)]">
        {["w-3/5", "w-2/5", "w-1/2", "w-2/3", "w-2/5", "w-1/2"].map((width, index) => (
          <li key={index} className="flex min-h-[4.25rem] items-center gap-3 px-3.5 py-3 sm:px-4">
            <SkeletonBar className="size-9 shrink-0" />
            <div className="min-w-0 flex-1">
              <SkeletonBar className={cn("h-3.5", width)} />
              <SkeletonBar className="mt-2.5 h-2.5 w-16" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ActivityRow({ row, what, open, onToggle, t }: { row: ActivityLogEntry; what: string; open: boolean; onToggle: () => void; t: T }) {
  const hasDetails = row.before !== null || row.after !== null;
  const record = row.entityId && !REMOVED.test(row.action) ? RECORDS.get(row.entityType) : undefined;
  const who = row.actor ? row.actor.fullName || row.actor.email : t.system;
  const panelId = `activity-${row.id}`;
  // The sentence is one string for a screen reader; on screen the two halves are weighted differently.
  const [beforeWho, betweenWhoAndWhat = "", afterWhat = ""] = t.sentence.split(/\{who\}|\{what\}/);

  return (
    <li className="px-3.5 py-3 sm:px-4">
      <div className="flex items-start gap-3">
        <span
          data-slot="activity-avatar"
          aria-hidden
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-paper-sunken text-sm font-semibold text-ink-soft"
        >
          {row.actor ? who.trim().charAt(0).toUpperCase() : <IconRobot className="size-[1.125rem]" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-6 break-words text-ink">
            {beforeWho}
            <bdi className="font-semibold">{who}</bdi>
            <span className="text-ink-soft">{betweenWhoAndWhat}</span>
            {what}
            {afterWhat}
          </p>
          <div className="flex flex-wrap items-center gap-x-1 text-xs leading-5 text-ink-soft">
            <time dateTime={row.createdAt} title={formatDateTime(row.createdAt)} className="me-1.5 tabular-nums">
              <bdi>{timeOf(row.createdAt)}</bdi>
            </time>
            {/* The address is for an audit at a desk; on a phone it only crowds the line. */}
            {row.ipAddress && (
              <span className="me-1.5 hidden sm:inline">
                <span aria-hidden>· </span>
                {t.from} <bdi dir="ltr" className="tabular-nums">{row.ipAddress}</bdi>
              </span>
            )}
            {record && (
              <ViewLink to={`${record.path}/${row.entityId}`} className={ROW_ACTION}>
                {t[record.label]}
                <IconArrowLeft className="size-3.5 shrink-0 rotate-180 rtl:rotate-0" aria-hidden />
              </ViewLink>
            )}
            {hasDetails && (
              <button
                type="button"
                className={ROW_ACTION}
                aria-expanded={open}
                aria-controls={panelId}
                aria-label={fmt(t.detailsOf, { what })}
                onClick={onToggle}
              >
                {open ? t.hideDetails : t.details}
                <IconCaretDown
                  className={cn(
                    "size-3.5 shrink-0 transition-[rotate] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
                    open && "rotate-180"
                  )}
                  aria-hidden
                />
              </button>
            )}
          </div>
          {open && (
            <div id={panelId} className="mt-2 grid gap-2 sm:grid-cols-2">
              {(
                [
                  [t.before, row.before],
                  [t.after, row.after],
                ] as const
              ).map(([label, value]) =>
                value === null || value === undefined ? null : (
                  <div key={label} className="min-w-0">
                    <p className="text-xs font-medium text-ink-soft">{label}</p>
                    <pre
                      dir="ltr"
                      tabIndex={0}
                      data-slot="activity-diff"
                      className="mt-1 max-h-56 overflow-auto rounded-[0.875rem] bg-paper-sunken p-3 text-start font-mono text-xs leading-5 text-ink focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      {JSON.stringify(value, null, 2)}
                    </pre>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export function ActivityLogPage() {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const labels = t as Record<string, string>;
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [area, setArea] = useState("");
  const [person, setPerson] = useState("");
  const [period, setPeriod] = useState<Period>("any");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [rows, setRows] = useState<ActivityLogEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const members = useAsync(() => apiClient.listWorkspaceMembers(workspaceId).catch(() => []), [workspaceId]);
  const query = { action: area || undefined, actorUserId: person || undefined, from: fromOf(period), limit: PAGE };

  const first = useAsync(async () => {
    const page = await activityLogList(apiClient, workspaceId, query);
    setRows(page.logs);
    setCursor(page.nextCursor);
    return page;
  }, [workspaceId, area, person, period]);

  async function loadMore() {
    if (!cursor) return;
    setMore(true);
    try {
      const page = await activityLogList(apiClient, workspaceId, { ...query, before: cursor });
      setRows((prev) => [...prev, ...page.logs]);
      setCursor(page.nextCursor);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setMore(false);
    }
  }

  const people = (members.data ?? []).filter((m) => m.user);
  const personName = (id: string) => {
    const user = people.find((member) => member.user?.id === id)?.user;
    return user ? user.fullName || user.email : id;
  };
  const days = useMemo(() => byDay(rows, t), [rows, t]);

  const periodChips: ChipItem<Period>[] = [
    { value: "any", label: t.anytime },
    { value: "today", label: t.today },
    { value: "week", label: t.week },
    { value: "month", label: t.month },
  ];
  const areaOptions = AREAS.map((key) => ({ value: key, label: labels[`area.${key}`] ?? key }));
  const personOptions = people.map((member) => ({ value: member.user?.id ?? "", label: member.user?.fullName || member.user?.email || "" }));

  // The period shows on its row of chips; the badge on Filters counts what only the sheet shows.
  const sheetOnly = (area ? 1 : 0) + (person ? 1 : 0);
  const filterCount = sheetOnly + (period !== "any" ? 1 : 0);
  const resetFilters = () => {
    setArea("");
    setPerson("");
    setPeriod("any");
  };
  const activeChips: ActiveFilterChip[] = [
    ...(area ? [{ id: "area", label: fmt(t.areaChip, { name: labels[`area.${area}`] ?? area }), onRemove: () => setArea("") }] : []),
    ...(person ? [{ id: "person", label: fmt(t.personChip, { name: personName(person) }), onRemove: () => setPerson("") }] : []),
  ];

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={<ListToolbar filters={{ count: sheetOnly, onOpen: () => setFiltersOpen(true) }} />}
      />

      <div className="flex flex-col gap-3">
        <ChipRow items={periodChips} value={period} onChange={setPeriod} label={t.period} collapseEmpty={false} />
        <ActiveFilters
          chips={activeChips}
          onClearAll={() => {
            setArea("");
            setPerson("");
          }}
        />

        <DataState
          loading={first.loading}
          error={first.error}
          onRetry={() => void first.refresh()}
          skeleton={<TimelineSkeleton />}
        >
          {rows.length === 0 ? (
            filterCount > 0 ? (
              <EmptyState
                icon={<IconFilter aria-hidden />}
                title={t.noMatchTitle}
                description={t.noMatchBody}
                action={
                  <Button variant="outline" className="rounded-full px-5" onClick={resetFilters}>
                    {t.clearFilters}
                  </Button>
                }
              />
            ) : (
              <EmptyState icon={<IconActivity aria-hidden />} title={t.emptyTitle} description={t.emptyBody} />
            )
          ) : (
            <>
              <div className="flex flex-col gap-5">
                {days.map((day) => (
                  <section key={day.key} aria-label={day.label}>
                    <h2 className="mb-2 px-1 text-[13px] leading-5 font-semibold text-ink-soft">{day.label}</h2>
                    <ul
                      data-slot="activity-day"
                      className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper-raised shadow-[var(--shadow-card)]"
                    >
                      {day.rows.map((row) => (
                        <ActivityRow
                          key={row.id}
                          row={row}
                          what={locale === "ar" ? readableAr(row.action) : readable(row.action)}
                          open={open === row.id}
                          onToggle={() => setOpen(open === row.id ? null : row.id)}
                          t={t}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
              <LoadMore hasMore={Boolean(cursor)} loading={more} onClick={loadMore} />
            </>
          )}
        </DataState>
      </div>

      <FilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        activeCount={filterCount}
        onReset={resetFilters}
        applyLabel={first.loading || cursor ? t.applyMore : pluralOf(t, "apply", rows.length)}
      >
        <FilterGroup label={t.period}>
          <FilterChoice label={t.period} options={periodChips} value={period} onChange={(value) => setPeriod(value ?? "any")} />
        </FilterGroup>
        <FilterGroup label={t.area}>
          <FilterChoice label={t.area} options={areaOptions} value={area || null} onChange={(value) => setArea(value ?? "")} allowClear />
        </FilterGroup>
        {personOptions.length > 0 && (
          <FilterGroup label={t.person}>
            <FilterChoice label={t.person} options={personOptions} value={person || null} onChange={(value) => setPerson(value ?? "")} allowClear />
          </FilterGroup>
        )}
      </FilterSheet>
    </div>
  );
}
