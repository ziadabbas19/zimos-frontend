import type { SettingsTone } from "@/components/settings";
import { IconCard, IconChecklist, IconWallet, type IconComponent } from "@/components/icons";
import type { Messages } from "@/i18n/LocaleContext";

/**
 * Role keys that manage payments: the backend gates every /payments call on
 * workspace.manage, which only the owner ("*") and the workspace manager hold
 * among the system roles. A custom role reads as view-only here, and a 403
 * flips the page to view-only.
 */
export const PAYMENT_ROLES: ReadonlySet<string> = new Set(["owner", "workspace_manager"]);

/**
 * The sections of Payments (/payments?tab=<id>): what the page lists and what
 * the dashboard's search finds (lib/search/siteIndex.ts) — one list for both.
 */
export const PAYMENT_SECTION_STRINGS = {
  en: {
    gatewaysTitle: "Gateways",
    secManual: "InstaPay and wallets",
    secManualHint: "Your own InstaPay address and wallet numbers, paid to directly.",
    secGatewaysHint: "The payment gateways connected to this store, and their keys.",
    secMethodsHint: "Which ways to pay shoppers see at checkout, and in which order.",
    methodListTitle: "Checkout methods",
  },
  ar: {
    gatewaysTitle: "البوابات",
    secManual: "إنستاباي والمحافظ",
    secManualHint: "عنوان إنستاباي وأرقام المحافظ الخاصة بك، ويُدفع إليها مباشرة.",
    secGatewaysHint: "بوابات الدفع المربوطة بهذا المتجر ومفاتيحها.",
    secMethodsHint: "طرق الدفع التي يراها العملاء عند إتمام الشراء وترتيبها.",
    methodListTitle: "طرق الدفع في صفحة الدفع",
  },
} satisfies Messages;

type PaymentText = keyof (typeof PAYMENT_SECTION_STRINGS)["en"];

export const PAYMENT_SECTIONS: ReadonlyArray<{
  id: "manual" | "gateways" | "methods";
  label: PaymentText;
  hint: PaymentText;
  icon: IconComponent;
  tone: SettingsTone;
  /** What the search also finds the section by, in both languages. */
  keywords: readonly string[];
}> = [
  { id: "manual", label: "secManual", hint: "secManualHint", icon: IconWallet, tone: "green", keywords: ["instapay", "wallet", "vodafone cash", "manual payment", "transfer", "إنستاباي", "محفظة", "فودافون كاش", "تحويل"] },
  { id: "gateways", label: "gatewaysTitle", hint: "secGatewaysHint", icon: IconCard, tone: "blue", keywords: ["gateway", "fawaterak", "paymob", "card", "online payment", "بوابة الدفع", "فواتيرك", "كارت", "دفع إلكتروني"] },
  { id: "methods", label: "methodListTitle", hint: "secMethodsHint", icon: IconChecklist, tone: "purple", keywords: ["cash on delivery", "cod", "payment methods", "checkout", "الدفع عند الاستلام", "طرق الدفع", "صفحة الدفع"] },
];
