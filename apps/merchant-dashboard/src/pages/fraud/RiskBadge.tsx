import { useSearchParams } from "react-router-dom";
import type { Order } from "@store-builder/api-client";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { FilterTabs } from "@/components/FilterTabs";
import { StatusBadge } from "@/components/StatusBadge";

export const RISK_LEVELS = ["low", "moderate", "high"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

/** What risk/riskService stored on an order; not in the shared Order type yet. */
export interface OrderRiskFields {
  riskScore?: number | null;
  riskLevel?: RiskLevel | null;
  riskReasons?: string[];
  dataQuality?: "good" | "low" | null;
}

const STRINGS = {
  en: {
    level_low: "Low risk",
    level_moderate: "Moderate risk",
    level_high: "High risk",
    filterLabel: "Filter orders by risk",
    all: "Any risk",
    lowQuality: "Poor data",
    reason_invalid_phone: "Phone is not a valid mobile number",
    reason_suspicious_name: "Name looks fake or too short",
    reason_weak_address: "Address is too short or repeats itself",
    reason_foreign_ip: "Ordered from another country",
    reason_vpn_ip: "VPN or server address",
    reason_too_fast: "Ordered within seconds of opening the page",
    reason_ip_burst: "Several orders from the same address or device within an hour",
    reason_low_delivery_rate: "Low delivery rate across stores",
    reason_spam_report: "Reported as spam by other stores",
    reason_disposable_email: "Temporary email address",
    reason_ai_gibberish: "AI check: the name or address looks made up",
    reason_ai_abusive: "AI check: abusive words",
    reason_ai_incomplete_address: "AI check: the address is not enough to deliver",
    reason_otp_unavailable: "The phone code reached the customer on no channel, so the order was placed unverified",
  },
  ar: {
    level_low: "خطورة منخفضة",
    level_moderate: "خطورة متوسطة",
    level_high: "خطورة عالية",
    filterLabel: "تصفية الأوردرات حسب الخطورة",
    all: "أي خطورة",
    lowQuality: "بيانات ضعيفة",
    reason_invalid_phone: "الرقم ليس رقم موبايل صحيحًا",
    reason_suspicious_name: "الاسم يبدو وهميًا أو قصيرًا جدًا",
    reason_weak_address: "العنوان قصير جدًا أو مكرر",
    reason_foreign_ip: "طلب من دولة أخرى",
    reason_vpn_ip: "عنوان VPN أو سيرفر",
    reason_too_fast: "طلب بعد ثوانٍ من فتح الصفحة",
    reason_ip_burst: "عدة أوردرات من نفس العنوان أو الجهاز خلال ساعة",
    reason_low_delivery_rate: "نسبة استلام منخفضة على مستوى المتاجر",
    reason_spam_report: "بلّغت عنه متاجر أخرى كسبام",
    reason_disposable_email: "بريد إلكتروني مؤقت",
    reason_ai_gibberish: "فحص الذكاء الاصطناعي: الاسم أو العنوان يبدو مختلقًا",
    reason_ai_abusive: "فحص الذكاء الاصطناعي: ألفاظ مسيئة",
    reason_ai_incomplete_address: "فحص الذكاء الاصطناعي: العنوان لا يكفي للتوصيل",
    reason_otp_unavailable: "لم يصل رمز التحقق إلى العميل عبر أي قناة، فقُبل الطلب دون تحقق",
  },
} satisfies Messages;

const TONE: Record<RiskLevel, "success" | "warning" | "danger"> = { low: "success", moderate: "warning", high: "danger" };

function isRiskLevel(value: unknown): value is RiskLevel {
  return typeof value === "string" && (RISK_LEVELS as readonly string[]).includes(value);
}

/** Readable risk reasons, for the order page and the badge's tooltip. */
export function useRiskReasonLabel() {
  const t = useT(STRINGS);
  return (reason: string) => (t as Record<string, string>)[`reason_${reason}`] ?? reason;
}

export function useRiskLevelLabel() {
  const t = useT(STRINGS);
  return (level: RiskLevel) => t[`level_${level}`];
}

/**
 * The order's risk level as a badge. Low risk shows nothing in a list (most
 * orders are low, and a row of green badges is noise) unless `showLow`.
 */
export function RiskBadge({ order, showLow = false }: { order: Order; showLow?: boolean }) {
  const t = useT(STRINGS);
  const reasonLabel = useRiskReasonLabel();
  const risk = order as Order & OrderRiskFields;
  const level = risk.riskLevel;
  if (!isRiskLevel(level)) return null;
  const lowQuality = risk.dataQuality === "low";
  if (level === "low" && !showLow && !lowQuality) return null;
  const title = (risk.riskReasons ?? []).map(reasonLabel).join(" · ") || undefined;
  return (
    <span title={title} className="inline-flex flex-wrap items-center gap-1">
      {(level !== "low" || showLow) && <StatusBadge value={level} tone={TONE[level]} text={t[`level_${level}`]} />}
      {lowQuality && <StatusBadge value="low_quality" tone="warning" text={t.lowQuality} />}
    </span>
  );
}

/** The `?risk=` filter of the orders list, as the query the API takes. */
export function useRiskParam(): { risk: RiskLevel | null; query: { riskLevel?: RiskLevel } } {
  const [params] = useSearchParams();
  const raw = params.get("risk");
  const risk = isRiskLevel(raw) ? raw : null;
  return { risk, query: risk ? { riskLevel: risk } : {} };
}

/** Orders list → the risk tabs. The choice lives in `?risk=` next to the page's other filters. */
export function RiskFilter({ counts }: { counts?: Record<RiskLevel, number> | null } = {}) {
  const t = useT(STRINGS);
  const [params, setParams] = useSearchParams();
  const raw = params.get("risk");
  const value: "all" | RiskLevel = isRiskLevel(raw) ? raw : "all";
  const tabs = [
    { value: "all" as const, label: t.all },
    { value: "high" as const, label: t.level_high },
    { value: "moderate" as const, label: t.level_moderate },
    { value: "low" as const, label: t.level_low },
  ].map((tab) => (counts && tab.value !== "all" ? { ...tab, label: `${tab.label} (${counts[tab.value]})` } : tab));
  return (
    <FilterTabs
      tabs={tabs}
      value={value}
      label={t.filterLabel}
      className="mb-3"
      onChange={(next) =>
        setParams(
          (prev) => {
            const out = new URLSearchParams(prev);
            if (next === "all") out.delete("risk");
            else out.set("risk", next);
            return out;
          },
          { replace: true }
        )
      }
    />
  );
}
