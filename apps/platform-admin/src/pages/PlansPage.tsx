import { useId, useState, type FormEvent } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { Alert, Button } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextField } from "@/components/forms";
import { Toggle } from "@/components/Toggle";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { useAuth } from "@/context/AuthContext";
import { P } from "@/lib/permissions";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import * as adminApi from "@/lib/adminApi";
import { ANNUAL_PRICE_MONTHS } from "@/lib/billing";
import { FeaturePicker } from "@/components/FeaturePicker";
import type { AdminPlan as Plan, PlanFeatureCatalogEntry, PlanFeatureKey } from "@store-builder/api-client";
import {
  PLATFORM_CURRENCY,
  formatBp,
  formatMinorMoney,
  formatNumber,
  formatRelative,
  minorUnitDigits,
  toMajorAmount,
  toMinorAmount,
  formatMinorMoneyExact,
} from "@/lib/format";

const STRINGS = {
  en: {
    title: "Plans",
    description: "Subscription plans offered to merchants.",
    newPlan: "New plan",
    emptyMessage: "No plans yet. Create the first plan merchants can subscribe to.",
    active: "Active",
    inactive: "Inactive",
    shownAtSignup: "Shown at sign-up · #{order}",
    hiddenFromSignup: "Hidden from sign-up",
    perMonth: " / month",
    perYear: "{price} / year",
    freeTrial: "Free trial",
    trialDays: "{days} days",
    none: "None",
    storesPerOwner: "Stores per owner",
    storeOne: "store",
    storeMany: "stores",
    funnelsPerMonth: "Funnels per month",
    campaignEmailsPerMonth: "Campaign emails per month",
    campaignsPerMonth: "Campaigns per month",
    recipientsPerCampaign: "Recipients per campaign",
    perMo: "/mo",
    orderQuota: "Order quota",
    quotaPerMo: "{count}/mo",
    unlimited: "Unlimited",
    transactionFee: "Transaction fee",
    codFee: "COD fee",
    feePerOrder: "Fee per order",
    comingSoonHidden: "Coming soon · hidden from merchants",
    comingSoon: "Coming soon",
    updated: "Updated {when}",
    edit: "Edit",
    deleteNamed: "Delete {name}",
    savedToast: "Plan “{name}” saved.",
    deleteTitle: "Delete plan “{name}”?",
    deleteDescription: "Plans with active workspaces can't be deleted — mark them inactive instead.",
    deletePlan: "Delete plan",
    deletedToast: "Plan deleted.",
    errNumbers: "Prices, trial days and fees must be numbers.",
    errQuota: "Order quota must be a whole number, or empty for unlimited.",
    errTrial: "Free trial must be a whole number of days from 0 (no trial) to 90.",
    errMaxStores: "Max stores must be a whole number of at least 1 — or tick Unlimited.",
    errMaxFunnels: "Max funnels per month must be a whole number (0 or more) — or tick Unlimited.",
    errMaxCampaignEmails: "Campaign emails per month must be a whole number (0 or more) — or tick Unlimited.",
    errMaxCampaigns: "Campaigns per month must be a whole number (0 or more) — or tick Unlimited.",
    errMaxRecipients: "Recipients per campaign must be a whole number (1 or more) — or tick Unlimited.",
    errDisplayOrder: "Display order must be a whole number from 0 to 10000.",
    errFee: "The fee per order must be a number, 0 for none.",
    errFeePlan: "A fee per order is only for a plan priced 0 a month, in EGP. Set the monthly price to 0, or the fee to 0.",
    errFreeOrders: "Free orders must be a whole number, 0 for none.",
    errDebtLimit: "The debt limit must be an amount, or empty for the fixed overdraft.",
    editNamed: "Edit {name}",
    cancel: "Cancel",
    saving: "Saving…",
    savePlan: "Save plan",
    name: "Name",
    code: "Code",
    codeHint: "Lowercase identifier used by billing. Derived from the name if empty.",
    monthlyPrice: "Monthly price ({currency})",
    aMonth: "= {price} a month",
    yearlyPrice: "Yearly price ({currency})",
    yearlyHint: "Always {months} × the monthly price (two months free).",
    freeTrialDays: "Free trial (days)",
    freeTrialHint: "0 = no free trial. Up to 90.",
    orderQuotaMonth: "Order quota / month",
    orderQuotaHint: "Leave empty for unlimited.",
    transactionFeeBp: "Transaction fee (bp)",
    perOnlinePayment: "= {fee} per online payment",
    codFeeBp: "COD fee (bp)",
    perCodOrder: "= {fee} per COD order",
    limits: "Limits",
    maxStores: "Max stores",
    maxStoresHint: "Stores one owner may have. The largest limit among their current stores' plans applies.",
    maxFunnels: "Max funnels per month",
    maxFunnelsHint: "Funnels one store may create each calendar month (Cairo time), deleted ones included.",
    maxCampaignEmails: "Email campaign emails per month",
    maxCampaignEmailsHint: "Marketing emails one store may send each calendar month (Cairo time). 0 = none; plans from before email campaigns start at 0.",
    maxCampaigns: "Email campaigns per month",
    maxCampaignsHint: "Campaigns one store may send or schedule each calendar month (Cairo time). Drafts don't count; one cancelled before it starts gives its place back.",
    maxRecipients: "Recipients per campaign",
    maxRecipientsHint: "The largest audience one campaign may have. A bigger one is refused whole, never cut down.",
    limitsNote: "New limits apply to stores and funnels created from now on. Nothing that exists is removed or switched off.",
    showAtSignup: "Show at sign-up",
    showAtSignupHint: "Listed on the marketing site's pricing page and offered on the sign-up form.",
    displayOrder: "Display order",
    displayOrderHint: "Lower comes first on the pricing page.",
    feePerOrderField: "Fee per order ({currency})",
    feePerOrderHint:
      "Pay per order: taken from the store's prepaid balance for each order (WALLET_ENABLED). Only on a plan priced 0 a month, in EGP. 0 = no fee.",
    freeOrdersField: "Free orders per store",
    freeOrdersHint: "Orders a store places before any fee is taken. Extra ones can be granted per store from its page.",
    debtLimitField: "Debt limit ({currency})",
    debtLimitHint:
      "How far below zero the balance may go; past it, new orders are refused and the store stays open. Empty = the fixed overdraft (EGP 10) and the store stops selling. Suggested: 5 × the fee ({suggested}).",
    freeOrdersRow: "Free orders",
    debtLimitRow: "Debt limit",
    activeHint: "Inactive plans stay on existing workspaces but can't be chosen for new ones.",
  },
  ar: {
    title: "الخطط",
    description: "خطط الاشتراك المعروضة على التجار.",
    newPlan: "خطة جديدة",
    emptyMessage: "لا توجد خطط بعد. أنشئ أول خطة يمكن للتجار الاشتراك فيها.",
    active: "نشطة",
    inactive: "غير نشطة",
    shownAtSignup: "تظهر عند التسجيل · #{order}",
    hiddenFromSignup: "مخفية عن التسجيل",
    perMonth: " / شهريًا",
    perYear: "{price} / سنويًا",
    freeTrial: "الفترة التجريبية المجانية",
    trialDays: "{days} يومًا",
    none: "لا يوجد",
    storesPerOwner: "المتاجر لكل مالك",
    storeOne: "متجر",
    storeMany: "متاجر",
    funnelsPerMonth: "مسارات البيع شهريًا",
    campaignEmailsPerMonth: "رسائل الحملات شهريًا",
    campaignsPerMonth: "الحملات شهريًا",
    recipientsPerCampaign: "المستلمون لكل حملة",
    perMo: "/شهر",
    orderQuota: "حصة الطلبات",
    quotaPerMo: "{count}/شهر",
    unlimited: "غير محدود",
    transactionFee: "رسوم المعاملة",
    codFee: "رسوم الدفع عند الاستلام",
    feePerOrder: "رسوم لكل طلب",
    comingSoonHidden: "قريبًا · مخفية عن التجار",
    comingSoon: "قريبًا",
    updated: "حُدّثت {when}",
    edit: "تعديل",
    deleteNamed: "حذف {name}",
    savedToast: "حُفظت الخطة «{name}».",
    deleteTitle: "حذف الخطة «{name}»؟",
    deleteDescription: "لا يمكن حذف خطط عليها متاجر نشطة — اجعلها غير نشطة بدلًا من ذلك.",
    deletePlan: "حذف الخطة",
    deletedToast: "حُذفت الخطة.",
    errNumbers: "يجب أن تكون الأسعار وأيام التجربة والرسوم أرقامًا.",
    errQuota: "يجب أن تكون حصة الطلبات عددًا صحيحًا، أو فارغة لغير المحدود.",
    errTrial: "يجب أن تكون الفترة التجريبية عددًا صحيحًا من الأيام من 0 (بلا تجربة) إلى 90.",
    errMaxStores: "يجب أن يكون الحد الأقصى للمتاجر عددًا صحيحًا لا يقل عن 1 — أو حدّد «غير محدود».",
    errMaxFunnels: "يجب أن يكون الحد الأقصى لمسارات البيع شهريًا عددًا صحيحًا (0 أو أكثر) — أو حدّد «غير محدود».",
    errMaxCampaignEmails: "يجب أن تكون رسائل الحملات شهريًا عددًا صحيحًا (0 أو أكثر) — أو حدّد «غير محدود».",
    errMaxCampaigns: "يجب أن تكون الحملات شهريًا عددًا صحيحًا (0 أو أكثر) — أو حدّد «غير محدود».",
    errMaxRecipients: "يجب أن يكون المستلمون لكل حملة عددًا صحيحًا (1 أو أكثر) — أو حدّد «غير محدود».",
    errDisplayOrder: "يجب أن يكون ترتيب العرض عددًا صحيحًا من 0 إلى 10000.",
    errFee: "يجب أن تكون الرسوم لكل طلب رقمًا، و0 لعدم وجود رسوم.",
    errFeePlan: "الرسوم لكل طلب متاحة فقط لخطة سعرها 0 شهريًا بالجنيه المصري. اجعل السعر الشهري 0، أو الرسوم 0.",
    errFreeOrders: "يجب أن تكون الطلبات المجانية عددًا صحيحًا، و0 لعدم وجودها.",
    errDebtLimit: "يجب أن يكون حد المديونية مبلغًا، أو فارغًا للسحب على المكشوف الثابت.",
    editNamed: "تعديل {name}",
    cancel: "إلغاء",
    saving: "جارٍ الحفظ…",
    savePlan: "حفظ الخطة",
    name: "الاسم",
    code: "الرمز",
    codeHint: "معرّف بأحرف صغيرة تستخدمه الفوترة. يُشتق من الاسم إذا تُرك فارغًا.",
    monthlyPrice: "السعر الشهري ({currency})",
    aMonth: "= {price} شهريًا",
    yearlyPrice: "السعر السنوي ({currency})",
    yearlyHint: "دائمًا {months} × السعر الشهري (شهران مجانًا).",
    freeTrialDays: "الفترة التجريبية (أيام)",
    freeTrialHint: "0 = بلا فترة تجريبية. حتى 90.",
    orderQuotaMonth: "حصة الطلبات / شهريًا",
    orderQuotaHint: "اتركها فارغة لغير المحدود.",
    transactionFeeBp: "رسوم المعاملة (نقطة أساس)",
    perOnlinePayment: "= {fee} لكل دفعة إلكترونية",
    codFeeBp: "رسوم الدفع عند الاستلام (نقطة أساس)",
    perCodOrder: "= {fee} لكل طلب دفع عند الاستلام",
    limits: "الحدود",
    maxStores: "الحد الأقصى للمتاجر",
    maxStoresHint: "عدد المتاجر المسموح بها لمالك واحد. يُطبَّق أكبر حد بين خطط متاجره الحالية.",
    maxFunnels: "الحد الأقصى لمسارات البيع شهريًا",
    maxFunnelsHint: "مسارات البيع التي يمكن لمتجر واحد إنشاؤها كل شهر تقويمي (بتوقيت القاهرة)، بما فيها المحذوفة.",
    maxCampaignEmails: "رسائل حملات البريد شهريًا",
    maxCampaignEmailsHint: "الرسائل التسويقية التي يمكن لمتجر واحد إرسالها كل شهر تقويمي (بتوقيت القاهرة). 0 = لا شيء؛ الخطط القديمة تبدأ من 0.",
    maxCampaigns: "حملات البريد شهريًا",
    maxCampaignsHint: "الحملات التي يمكن لمتجر واحد إرسالها أو جدولتها كل شهر تقويمي (بتوقيت القاهرة). المسودات لا تُحسب، والحملة الملغاة قبل بدئها تُعيد مكانها.",
    maxRecipients: "المستلمون لكل حملة",
    maxRecipientsHint: "أكبر جمهور يمكن أن تصل إليه حملة واحدة. الأكبر يُرفض كاملًا ولا يُقتطع منه.",
    limitsNote: "تُطبَّق الحدود الجديدة على المتاجر ومسارات البيع التي تُنشأ من الآن فصاعدًا. لا يُحذف أو يُعطَّل شيء موجود.",
    showAtSignup: "الإظهار عند التسجيل",
    showAtSignupHint: "تُدرج في صفحة الأسعار على موقع التسويق وتُعرض في نموذج التسجيل.",
    displayOrder: "ترتيب العرض",
    displayOrderHint: "الأقل يظهر أولًا في صفحة الأسعار.",
    feePerOrderField: "الرسوم لكل طلب ({currency})",
    feePerOrderHint:
      "الدفع لكل طلب: تُخصم من الرصيد المدفوع مسبقًا للمتجر عن كل طلب (WALLET_ENABLED). فقط لخطة سعرها 0 شهريًا بالجنيه المصري. 0 = بلا رسوم.",
    freeOrdersField: "الطلبات المجانية لكل متجر",
    freeOrdersHint: "طلبات يضعها المتجر قبل خصم أي رسوم. يمكن منح المزيد لكل متجر من صفحته.",
    debtLimitField: "حد المديونية ({currency})",
    debtLimitHint:
      "إلى أي حد يمكن أن ينزل الرصيد تحت الصفر؛ بعده تُرفض الطلبات الجديدة ويبقى المتجر مفتوحًا. فارغ = السحب على المكشوف الثابت (10 ج.م.) ويتوقف المتجر عن البيع. المقترح: 5 × الرسوم ({suggested}).",
    freeOrdersRow: "الطلبات المجانية",
    debtLimitRow: "حد المديونية",
    activeHint: "تبقى الخطط غير النشطة على المتاجر الحالية لكن لا يمكن اختيارها لمتاجر جديدة.",
  },
} satisfies Messages;

interface PlanForm {
  id?: string;
  name: string;
  code: string;
  /** The plan's currency: prices are typed in it and sent in its minor units. */
  currency: string;
  /** Whole currency units as typed (299), not minor units. */
  monthlyPrice: string;
  yearlyPrice: string;
  trialDays: string;
  orderQuota: string;
  transactionFeeBp: string;
  codFeeBp: string;
  features: PlanFeatureKey[];
  active: boolean;
  /** Whole numbers as typed; ignored while the matching "unlimited" box is ticked. */
  maxStores: string;
  storesUnlimited: boolean;
  maxFunnels: string;
  funnelsUnlimited: boolean;
  maxCampaignEmails: string;
  campaignEmailsUnlimited: boolean;
  /** The API sent the field (an older API doesn't): only then is it saved. */
  campaignEmailsKnown: boolean;
  maxCampaigns: string;
  campaignsUnlimited: boolean;
  maxRecipients: string;
  recipientsUnlimited: boolean;
  /** The API sent both campaign limits (an older API doesn't): only then are they shown and saved. */
  campaignLimitsKnown: boolean;
  /** Listed on the marketing site and offered at sign-up. */
  isPublic: boolean;
  displayOrder: string;
  /** The pay-per-order fee in whole currency units as typed (0.50); "0" = none. */
  perOrderFee: string;
  /** Pay per order: free orders per store, as typed. */
  walletFreeOrders: string;
  /** Pay per order: the debt limit in whole currency units; "" = the fixed overdraft. */
  walletDebtLimit: string;
}

// A new plan is priced in the platform currency (EGP, also the API's default
// for plans.currency) and is saved with it, so the price the form shows is the
// one stored. An existing plan keeps its own currency.
const EMPTY: PlanForm = {
  name: "",
  code: "",
  currency: PLATFORM_CURRENCY,
  monthlyPrice: "0",
  yearlyPrice: "0",
  trialDays: "14",
  orderQuota: "",
  transactionFeeBp: "100",
  codFeeBp: "75",
  features: [],
  active: true,
  maxStores: "1",
  storesUnlimited: true,
  maxFunnels: "10",
  funnelsUnlimited: true,
  // A new plan sends no campaign emails until someone gives it a number.
  maxCampaignEmails: "0",
  campaignEmailsUnlimited: false,
  campaignEmailsKnown: true,
  // No campaign or audience limit until someone sets one (null on the server, like existing plans).
  maxCampaigns: "4",
  campaignsUnlimited: true,
  maxRecipients: "1000",
  recipientsUnlimited: true,
  campaignLimitsKnown: true,
  // Never shown to the public until someone decides it should be.
  isPublic: false,
  displayOrder: "0",
  perOrderFee: "0",
  // Used only once the plan has a fee per order.
  walletFreeOrders: "10",
  walletDebtLimit: "",
};

function toForm(p: Plan): PlanForm {
  return {
    id: p.id,
    name: p.name,
    code: p.code,
    currency: p.currency,
    monthlyPrice: String(toMajorAmount(p.monthlyPrice, p.currency)),
    yearlyPrice: String(toMajorAmount(p.yearlyPrice, p.currency)),
    trialDays: String(p.trialDays),
    orderQuota: p.orderQuota === null ? "" : String(p.orderQuota),
    transactionFeeBp: String(p.transactionFeeBp),
    codFeeBp: String(p.codFeeBp),
    features: [...p.features],
    active: p.active,
    maxStores: p.maxStores === null || p.maxStores === undefined ? "1" : String(p.maxStores),
    storesUnlimited: p.maxStores === null || p.maxStores === undefined,
    maxFunnels: p.maxFunnelsPerMonth === null || p.maxFunnelsPerMonth === undefined ? "10" : String(p.maxFunnelsPerMonth),
    funnelsUnlimited: p.maxFunnelsPerMonth === null || p.maxFunnelsPerMonth === undefined,
    maxCampaignEmails: p.maxCampaignEmailsPerMonth === null || p.maxCampaignEmailsPerMonth === undefined ? "0" : String(p.maxCampaignEmailsPerMonth),
    campaignEmailsUnlimited: p.maxCampaignEmailsPerMonth === null,
    campaignEmailsKnown: p.maxCampaignEmailsPerMonth !== undefined,
    maxCampaigns: p.maxCampaignsPerMonth === null || p.maxCampaignsPerMonth === undefined ? "4" : String(p.maxCampaignsPerMonth),
    campaignsUnlimited: p.maxCampaignsPerMonth === null || p.maxCampaignsPerMonth === undefined,
    maxRecipients: p.maxRecipientsPerCampaign === null || p.maxRecipientsPerCampaign === undefined ? "1000" : String(p.maxRecipientsPerCampaign),
    recipientsUnlimited: p.maxRecipientsPerCampaign === null || p.maxRecipientsPerCampaign === undefined,
    campaignLimitsKnown: p.maxCampaignsPerMonth !== undefined && p.maxRecipientsPerCampaign !== undefined,
    isPublic: Boolean(p.isPublic),
    displayOrder: String(p.displayOrder ?? 0),
    perOrderFee: String(toMajorAmount(p.perOrderFee ?? 0, p.currency)),
    walletFreeOrders: String(p.walletFreeOrders ?? 0),
    walletDebtLimit: p.walletDebtLimit === null || p.walletDebtLimit === undefined ? "" : String(toMajorAmount(p.walletDebtLimit, p.currency)),
  };
}

/** A whole number in [min, max] typed into a field, or null when it isn't one. */
function wholeNumber(value: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const n = Number(value.trim());
  return n >= min && n <= max ? n : null;
}

function limitLabel(value: number | null | undefined, unit: string, unlimited: string): string {
  return value === null || value === undefined ? unlimited : `${formatNumber(value)} ${unit}`;
}

export function PlansPage() {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const toast = useToast();
  const { can } = useAuth();
  const canManage = can(P.PLANS_MANAGE);
  // The plans come in the pricing page's order (display order, then price,
  // then name), with the backend's feature catalogue: names, and which
  // features exist today.
  const { data, loading, error, refresh } = useAsync(() => adminApi.listPlansWithCatalog(), []);
  const catalog = data?.featureCatalog ?? [];
  const [editing, setEditing] = useState<PlanForm | null>(null);
  const [deleting, setDeleting] = useState<Plan | null>(null);

  return (
    <div>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          canManage && (
            <Button onClick={() => setEditing({ ...EMPTY })}>
              <Plus /> {t.newPlan}
            </Button>
          )
        }
      />
      <DataState
        loading={loading}
        error={error}
        onRetry={() => void refresh()}
        empty={!!data && data.plans.length === 0}
        emptyMessage={t.emptyMessage}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(data?.plans ?? []).map((p) => (
            <article key={p.id} className="flex flex-col rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line">
              <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-ink">{p.name}</h2>
                  <p className="font-mono text-xs text-ink-soft">{p.code}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge tone={p.active ? "success" : "neutral"} dot>
                    {p.active ? t.active : t.inactive}
                  </StatusBadge>
                  <StatusBadge tone={p.isPublic ? "info" : "neutral"}>
                    {p.isPublic ? fmt(t.shownAtSignup, { order: p.displayOrder }) : t.hiddenFromSignup}
                  </StatusBadge>
                </div>
              </div>
              <div className="flex-1 space-y-4 px-4 py-4">
                <div>
                  <p className="tabular text-2xl font-semibold text-ink">
                    {formatMinorMoney(p.monthlyPrice, p.currency)}
                    <span className="text-sm font-normal text-ink-soft">{t.perMonth}</span>
                  </p>
                  <p className="tabular text-sm text-ink-soft">
                    {fmt(t.perYear, { price: formatMinorMoney(p.yearlyPrice, p.currency) })}
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-ink-soft">{t.freeTrial}</dt>
                  <dd className="text-end text-ink">{p.trialDays > 0 ? fmt(t.trialDays, { days: p.trialDays }) : t.none}</dd>
                  <dt className="text-ink-soft">{t.storesPerOwner}</dt>
                  <dd className="text-end text-ink">{limitLabel(p.maxStores, p.maxStores === 1 ? t.storeOne : t.storeMany, t.unlimited)}</dd>
                  <dt className="text-ink-soft">{t.funnelsPerMonth}</dt>
                  <dd className="text-end text-ink">{limitLabel(p.maxFunnelsPerMonth, t.perMo, t.unlimited)}</dd>
                  {p.maxCampaignEmailsPerMonth !== undefined && (
                    <>
                      <dt className="text-ink-soft">{t.campaignEmailsPerMonth}</dt>
                      <dd className="text-end text-ink">{limitLabel(p.maxCampaignEmailsPerMonth, t.perMo, t.unlimited)}</dd>
                    </>
                  )}
                  {p.maxCampaignsPerMonth !== undefined && (
                    <>
                      <dt className="text-ink-soft">{t.campaignsPerMonth}</dt>
                      <dd className="text-end text-ink">{limitLabel(p.maxCampaignsPerMonth, t.perMo, t.unlimited)}</dd>
                    </>
                  )}
                  {p.maxRecipientsPerCampaign !== undefined && (
                    <>
                      <dt className="text-ink-soft">{t.recipientsPerCampaign}</dt>
                      <dd className="text-end text-ink">{p.maxRecipientsPerCampaign === null ? t.unlimited : formatNumber(p.maxRecipientsPerCampaign)}</dd>
                    </>
                  )}
                  <dt className="text-ink-soft">{t.orderQuota}</dt>
                  <dd className="text-end text-ink">{p.orderQuota === null ? t.unlimited : fmt(t.quotaPerMo, { count: formatNumber(p.orderQuota) })}</dd>
                  <dt className="text-ink-soft">{t.transactionFee}</dt>
                  <dd className="text-end text-ink">{formatBp(p.transactionFeeBp)}</dd>
                  <dt className="text-ink-soft">{t.codFee}</dt>
                  <dd className="text-end text-ink">{formatBp(p.codFeeBp)}</dd>
                  {(p.perOrderFee ?? 0) > 0 && (
                    <>
                      <dt className="text-ink-soft">{t.feePerOrder}</dt>
                      <dd className="text-end text-ink">{formatMinorMoneyExact(p.perOrderFee ?? 0, p.currency)}</dd>
                      <dt className="text-ink-soft">{t.freeOrdersRow}</dt>
                      <dd className="text-end text-ink">{formatNumber(p.walletFreeOrders ?? 0)}</dd>
                      {p.walletDebtLimit !== null && p.walletDebtLimit !== undefined && (
                        <>
                          <dt className="text-ink-soft">{t.debtLimitRow}</dt>
                          <dd className="text-end text-ink">{formatMinorMoneyExact(p.walletDebtLimit, p.currency)}</dd>
                        </>
                      )}
                    </>
                  )}
                </dl>
                <ul className="space-y-1">
                  {catalog.map((f) => {
                    const on = p.features.includes(f.key);
                    return (
                      <li key={f.key} className={on ? "flex items-center gap-2 text-sm text-ink" : "flex items-center gap-2 text-sm text-ink-soft line-through"}>
                        <Check className={on ? "size-3.5 text-primary" : "size-3.5 opacity-30"} aria-hidden />
                        {f.label[locale]}
                        {!f.available && (
                          <span className="rounded-full border border-line px-1.5 py-px text-[11px] font-medium text-ink-soft no-underline">
                            {on ? t.comingSoonHidden : t.comingSoon}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3">
                <span className="text-xs text-ink-soft">{fmt(t.updated, { when: formatRelative(p.updatedAt) })}</span>
                {canManage && (
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => setEditing(toForm(p))}>
                      <Pencil /> {t.edit}
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label={fmt(t.deleteNamed, { name: p.name })} onClick={() => setDeleting(p)}>
                      <Trash2 className="text-danger" />
                    </Button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </DataState>

      {editing && (
        <PlanEditor
          initial={editing}
          catalog={catalog}
          onClose={() => setEditing(null)}
          onSaved={(p) => {
            toast.success(fmt(t.savedToast, { name: p.name }));
            setEditing(null);
            void refresh({ silent: true });
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={fmt(t.deleteTitle, { name: deleting?.name ?? "" })}
        description={t.deleteDescription}
        confirmLabel={t.deletePlan}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await adminApi.deletePlan(deleting.id);
          toast.success(t.deletedToast);
          setDeleting(null);
          void refresh({ silent: true });
        }}
      />
    </div>
  );
}

function PlanEditor({
  initial,
  catalog,
  onClose,
  onSaved,
}: {
  initial: PlanForm;
  catalog: readonly PlanFeatureCatalogEntry[];
  onClose: () => void;
  onSaved: (p: Plan) => void;
}) {
  const t = useT(STRINGS);
  const [form, setForm] = useState<PlanForm>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof PlanForm>(key: K, value: PlanForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    // The annual price is not sent: the API always sets it to 10 × monthly.
    const nums = [form.monthlyPrice, "0", form.trialDays, form.transactionFeeBp, form.codFeeBp].map(Number);
    if (nums.some((n) => !Number.isFinite(n))) {
      setError(t.errNumbers);
      return;
    }
    const quota = form.orderQuota.trim() === "" ? null : Number(form.orderQuota);
    if (quota !== null && (!Number.isInteger(quota) || quota < 1)) {
      setError(t.errQuota);
      return;
    }
    const trialDays = wholeNumber(form.trialDays, 0, 90);
    if (trialDays === null) {
      setError(t.errTrial);
      return;
    }
    const maxStores = form.storesUnlimited ? null : wholeNumber(form.maxStores, 1, 100000);
    if (!form.storesUnlimited && maxStores === null) {
      setError(t.errMaxStores);
      return;
    }
    const maxFunnels = form.funnelsUnlimited ? null : wholeNumber(form.maxFunnels, 0, 100000);
    if (!form.funnelsUnlimited && maxFunnels === null) {
      setError(t.errMaxFunnels);
      return;
    }
    const maxCampaignEmails = form.campaignEmailsUnlimited ? null : wholeNumber(form.maxCampaignEmails, 0, 10000000);
    if (!form.campaignEmailsUnlimited && maxCampaignEmails === null) {
      setError(t.errMaxCampaignEmails);
      return;
    }
    const maxCampaigns = form.campaignsUnlimited ? null : wholeNumber(form.maxCampaigns, 0, 100000);
    if (form.campaignLimitsKnown && !form.campaignsUnlimited && maxCampaigns === null) {
      setError(t.errMaxCampaigns);
      return;
    }
    const maxRecipients = form.recipientsUnlimited ? null : wholeNumber(form.maxRecipients, 1, 10000000);
    if (form.campaignLimitsKnown && !form.recipientsUnlimited && maxRecipients === null) {
      setError(t.errMaxRecipients);
      return;
    }
    const displayOrder = wholeNumber(form.displayOrder, 0, 10000);
    if (displayOrder === null) {
      setError(t.errDisplayOrder);
      return;
    }
    const fee = Number(form.perOrderFee.trim() === "" ? "0" : form.perOrderFee);
    if (!Number.isFinite(fee) || fee < 0) {
      setError(t.errFee);
      return;
    }
    const feeMinor = toMinorAmount(fee, form.currency);
    if (feeMinor > 0 && (toMinorAmount(nums[0], form.currency) !== 0 || form.currency !== "EGP")) {
      setError(t.errFeePlan);
      return;
    }
    const freeOrders = wholeNumber(form.walletFreeOrders.trim() === "" ? "0" : form.walletFreeOrders, 0, 100000);
    if (freeOrders === null) {
      setError(t.errFreeOrders);
      return;
    }
    const debtText = form.walletDebtLimit.trim();
    const debt = debtText === "" ? null : Number(debtText);
    if (debt !== null && (!Number.isFinite(debt) || debt < 0)) {
      setError(t.errDebtLimit);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const monthlyMinor = toMinorAmount(nums[0], form.currency);
      const saved = await adminApi.savePlan({
        id: form.id,
        name: form.name,
        code: form.code,
        ...(form.id ? {} : { currency: form.currency }),
        monthlyPrice: monthlyMinor,
        yearlyPrice: monthlyMinor * ANNUAL_PRICE_MONTHS,
        trialDays,
        orderQuota: quota,
        transactionFeeBp: Math.round(nums[3]),
        codFeeBp: Math.round(nums[4]),
        features: form.features,
        active: form.active,
        maxStores,
        maxFunnelsPerMonth: maxFunnels,
        ...(form.campaignEmailsKnown ? { maxCampaignEmailsPerMonth: maxCampaignEmails } : {}),
        // Left out for an API from before the two limits, which would refuse nothing but keep nothing either.
        ...(form.campaignLimitsKnown ? { maxCampaignsPerMonth: maxCampaigns, maxRecipientsPerCampaign: maxRecipients } : {}),
        isPublic: form.isPublic,
        displayOrder,
        perOrderFee: feeMinor,
        walletFreeOrders: freeOrders,
        walletDebtLimit: debt === null ? null : toMinorAmount(debt, form.currency),
      });
      onSaved(saved);
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={form.id ? fmt(t.editNamed, { name: initial.name }) : t.newPlan}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t.cancel}
          </Button>
          <Button type="submit" form="plan-form" disabled={busy}>
            {busy ? t.saving : t.savePlan}
          </Button>
        </>
      }
    >
      <form id="plan-form" onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label={t.name} required value={form.name} onChange={(e) => set("name", e.target.value)} />
          <TextField label={t.code} hint={t.codeHint} value={form.code} onChange={(e) => set("code", e.target.value)} />
          <TextField
            label={fmt(t.monthlyPrice, { currency: form.currency })}
            type="number"
            min={0}
            step={minorUnitDigits(form.currency) > 0 ? String(10 ** -minorUnitDigits(form.currency)) : "1"}
            required
            value={form.monthlyPrice}
            hint={
              Number.isFinite(Number(form.monthlyPrice))
                ? fmt(t.aMonth, { price: formatMinorMoney(toMinorAmount(Number(form.monthlyPrice), form.currency), form.currency) })
                : undefined
            }
            onChange={(e) => set("monthlyPrice", e.target.value)}
          />
          <TextField
            label={fmt(t.yearlyPrice, { currency: form.currency })}
            type="number"
            readOnly
            value={
              Number.isFinite(Number(form.monthlyPrice))
                ? String(toMajorAmount(toMinorAmount(Number(form.monthlyPrice), form.currency) * ANNUAL_PRICE_MONTHS, form.currency))
                : ""
            }
            hint={fmt(t.yearlyHint, { months: ANNUAL_PRICE_MONTHS })}
          />
          <TextField
            label={t.freeTrialDays}
            type="number"
            min={0}
            max={90}
            step={1}
            required
            hint={t.freeTrialHint}
            value={form.trialDays}
            onChange={(e) => set("trialDays", e.target.value)}
          />
          <TextField label={t.orderQuotaMonth} type="number" min={1} hint={t.orderQuotaHint} value={form.orderQuota} onChange={(e) => set("orderQuota", e.target.value)} />
          <TextField
            label={t.transactionFeeBp}
            type="number"
            min={0}
            required
            hint={Number.isFinite(Number(form.transactionFeeBp)) ? fmt(t.perOnlinePayment, { fee: formatBp(Number(form.transactionFeeBp)) }) : undefined}
            value={form.transactionFeeBp}
            onChange={(e) => set("transactionFeeBp", e.target.value)}
          />
          <TextField
            label={t.codFeeBp}
            type="number"
            min={0}
            required
            hint={Number.isFinite(Number(form.codFeeBp)) ? fmt(t.perCodOrder, { fee: formatBp(Number(form.codFeeBp)) }) : undefined}
            value={form.codFeeBp}
            onChange={(e) => set("codFeeBp", e.target.value)}
          />
        </div>

        <fieldset className="grid grid-cols-1 gap-4 rounded-[var(--radius-card)] border border-line p-4 sm:grid-cols-2">
          <legend className="px-1 text-sm font-semibold text-ink">{t.limits}</legend>
          <LimitField
            label={t.maxStores}
            hint={t.maxStoresHint}
            min={1}
            value={form.maxStores}
            unlimited={form.storesUnlimited}
            onValue={(v) => set("maxStores", v)}
            onUnlimited={(v) => set("storesUnlimited", v)}
          />
          <LimitField
            label={t.maxFunnels}
            hint={t.maxFunnelsHint}
            min={0}
            value={form.maxFunnels}
            unlimited={form.funnelsUnlimited}
            onValue={(v) => set("maxFunnels", v)}
            onUnlimited={(v) => set("funnelsUnlimited", v)}
          />
          {form.campaignEmailsKnown && (
            <LimitField
              label={t.maxCampaignEmails}
              hint={t.maxCampaignEmailsHint}
              min={0}
              value={form.maxCampaignEmails}
              unlimited={form.campaignEmailsUnlimited}
              onValue={(v) => set("maxCampaignEmails", v)}
              onUnlimited={(v) => set("campaignEmailsUnlimited", v)}
            />
          )}
          {form.campaignLimitsKnown && (
            <>
              <LimitField
                label={t.maxCampaigns}
                hint={t.maxCampaignsHint}
                min={0}
                value={form.maxCampaigns}
                unlimited={form.campaignsUnlimited}
                onValue={(v) => set("maxCampaigns", v)}
                onUnlimited={(v) => set("campaignsUnlimited", v)}
              />
              <LimitField
                label={t.maxRecipients}
                hint={t.maxRecipientsHint}
                min={1}
                value={form.maxRecipients}
                unlimited={form.recipientsUnlimited}
                onValue={(v) => set("maxRecipients", v)}
                onUnlimited={(v) => set("recipientsUnlimited", v)}
              />
            </>
          )}
          <p className="text-xs text-ink-soft sm:col-span-2">
            {t.limitsNote}
          </p>
        </fieldset>

        <FeaturePicker catalog={catalog} lockUnavailable value={form.features} onChange={(next) => set("features", next)} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Toggle
            label={t.showAtSignup}
            description={t.showAtSignupHint}
            checked={form.isPublic}
            onChange={(v) => set("isPublic", v)}
          />
          <TextField
            label={t.displayOrder}
            type="number"
            min={0}
            step={1}
            hint={t.displayOrderHint}
            value={form.displayOrder}
            onChange={(e) => set("displayOrder", e.target.value)}
          />
        </div>

        <TextField
          label={fmt(t.feePerOrderField, { currency: form.currency })}
          inputMode="decimal"
          hint={t.feePerOrderHint}
          value={form.perOrderFee}
          onChange={(e) => set("perOrderFee", e.target.value)}
        />
        {Number(form.perOrderFee) > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t.freeOrdersField}
              inputMode="numeric"
              hint={t.freeOrdersHint}
              value={form.walletFreeOrders}
              onChange={(e) => set("walletFreeOrders", e.target.value)}
            />
            <TextField
              label={fmt(t.debtLimitField, { currency: form.currency })}
              inputMode="decimal"
              hint={fmt(t.debtLimitHint, { suggested: String(Number(form.perOrderFee) * 5) })}
              value={form.walletDebtLimit}
              onChange={(e) => set("walletDebtLimit", e.target.value)}
            />
          </div>
        )}

        <Toggle label={t.active} description={t.activeHint} checked={form.active} onChange={(v) => set("active", v)} />
      </form>
    </Modal>
  );
}

/** A number field with an "Unlimited" box beside it; ticking the box sends null. */
function LimitField({
  label,
  hint,
  min,
  value,
  unlimited,
  onValue,
  onUnlimited,
}: {
  label: string;
  hint: string;
  min: number;
  value: string;
  unlimited: boolean;
  onValue: (next: string) => void;
  onUnlimited: (next: boolean) => void;
}) {
  const t = useT(STRINGS);
  const boxId = useId();
  return (
    <div className="space-y-2">
      <TextField
        label={label}
        type="number"
        min={min}
        step={1}
        hint={hint}
        value={unlimited ? "" : value}
        placeholder={unlimited ? t.unlimited : undefined}
        disabled={unlimited}
        onChange={(e) => onValue(e.target.value)}
      />
      <label htmlFor={boxId} className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
        <input
          id={boxId}
          type="checkbox"
          checked={unlimited}
          onChange={(e) => onUnlimited(e.target.checked)}
          className="size-4 accent-[var(--color-primary)]"
        />
        {t.unlimited}
      </label>
    </div>
  );
}
