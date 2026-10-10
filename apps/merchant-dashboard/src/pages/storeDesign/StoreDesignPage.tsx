import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@store-builder/ui";
import {
  IconAccount,
  IconClipboard,
  IconDocument,
  IconEye,
  IconGift,
  IconGlobe,
  IconHeart,
  IconLanguage,
  IconPage,
  IconPhone,
  IconSearch,
  IconShuffle,
  IconStoreSettings,
  type IconComponent,
} from "@/components/icons";
import { SettingsLayout, SettingsPane, type SettingsSectionDef, type SettingsTone } from "@/components/settings";
import { Sheet } from "@/components/Sheet";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { UnsavedGuardProvider, useUnsavedGuard } from "@/lib/useUnsavedGuard";
import { CUSTOM_DOMAINS_ENABLED, GIFT_OPTIONS_ENABLED, SHOPPER_ACCOUNTS_ENABLED, URL_REDIRECTS_ENABLED } from "@/lib/features";
import { StoreLivePreview } from "./StoreLivePreview";
import { CheckoutFormTab } from "./CheckoutFormTab";
import { ThankYouTab } from "./ThankYouTab";
import { StoreInfoTab } from "./StoreInfoTab";
import { PoliciesTab } from "./PoliciesTab";
import { PagesTab } from "./PagesTab";
import { GeneralTab } from "./GeneralTab";
import { SeoTab } from "./SeoTab";
import { DomainsTab } from "./DomainsTab";
import { LanguagesTab } from "./LanguagesTab";
import { GiftOptionsTab } from "./GiftOptionsTab";
import { RedirectsTab } from "./redirects/RedirectsTab";
import { CustomerAccountsTab } from "./CustomerAccountsTab";

/**
 * Store settings the shopper sees, laid out like System Settings: a searchable
 * list of sections and ONE section in the pane (on a phone the list is the
 * page and pushes to a section). The section stays in the path
 * (/store-settings/:tab) with the values it always had, so every link keeps
 * landing where it did. Each section is a self-contained form over the
 * workspace settings; a new area is a new file plus one entry in SECTIONS.
 */
const ALL_TABS = ["general", "store-info", "policies", "checkout-form", "gift-options", "thank-you", "pages", "seo", "redirects", "languages", "domains", "customer-accounts"] as const;
type TabKey = (typeof ALL_TABS)[number];
type GroupKey = "basics" | "buying" | "showing" | "access";

// Domains, gift options, redirects and customer accounts only while each is switched on (lib/features); off, its address opens the first section.
const OFF_TABS: ReadonlySet<TabKey> = new Set<TabKey>([
  ...(CUSTOM_DOMAINS_ENABLED ? [] : (["domains"] as const)),
  ...(GIFT_OPTIONS_ENABLED ? [] : (["gift-options"] as const)),
  ...(URL_REDIRECTS_ENABLED ? [] : (["redirects"] as const)),
  ...(SHOPPER_ACCOUNTS_ENABLED ? [] : (["customer-accounts"] as const)),
]);
const TABS: readonly TabKey[] = ALL_TABS.filter((tab) => !OFF_TABS.has(tab));

interface SectionMeta {
  id: TabKey;
  group: GroupKey;
  icon: IconComponent;
  tone: SettingsTone;
  /** What the search also finds the section by, in both languages. */
  keywords: string[];
}

/** The list, in the order it is read. The first one is what a desktop opens when the path names none. */
const ALL_SECTIONS: ReadonlyArray<SectionMeta> = [
  { id: "general", group: "basics", icon: IconStoreSettings, tone: "gray", keywords: ["favicon", "icon", "country", "أيقونة", "الدولة", "البلد"] },
  { id: "store-info", group: "basics", icon: IconPhone, tone: "green", keywords: ["contact", "email", "phone", "address", "trust", "هاتف", "بريد", "عنوان", "بطاقات الثقة"] },
  { id: "policies", group: "basics", icon: IconDocument, tone: "gray", keywords: ["legal", "refund", "privacy policy", "terms", "shipping policy", "سياسة الشحن", "سياسة الاسترجاع", "سياسة الخصوصية", "الشروط"] },
  { id: "checkout-form", group: "buying", icon: IconClipboard, tone: "blue", keywords: ["checkout", "purchase form", "order form", "fields", "custom field", "نموذج الشراء", "نموذج الطلب", "الحقول"] },
  { id: "gift-options", group: "buying", icon: IconGift, tone: "pink", keywords: ["gift", "wrap", "message", "هدية", "هدايا", "تغليف", "رسالة إهداء"] },
  { id: "thank-you", group: "buying", icon: IconHeart, tone: "red", keywords: ["thank you", "after order", "شكرًا", "بعد الطلب", "رسالة الشكر"] },
  { id: "pages", group: "showing", icon: IconPage, tone: "blue", keywords: ["pages", "header", "footer", "menu", "صفحات", "الترويسة", "التذييل", "القائمة"] },
  { id: "seo", group: "showing", icon: IconSearch, tone: "teal", keywords: ["seo", "google", "search", "meta", "title", "description", "share image", "جوجل", "محركات البحث", "وصف المتجر", "صورة المشاركة"] },
  { id: "redirects", group: "showing", icon: IconShuffle, tone: "orange", keywords: ["redirects", "301", "302", "old link", "csv", "تحويل الروابط", "رابط قديم", "روابط"] },
  { id: "languages", group: "showing", icon: IconLanguage, tone: "purple", keywords: ["languages", "translation", "english", "arabic", "french", "لغات", "ترجمة", "الإنجليزية", "العربية"] },
  { id: "domains", group: "showing", icon: IconGlobe, tone: "blue", keywords: ["domain", "dns", "ssl", "www", "دومين", "نطاق", "شهادة"] },
  { id: "customer-accounts", group: "access", icon: IconAccount, tone: "green", keywords: ["accounts", "sign in", "login", "sms", "otp", "تسجيل الدخول", "كود", "حساب العميل"] },
];
const SECTIONS: ReadonlyArray<SectionMeta> = ALL_SECTIONS.filter((section) => !OFF_TABS.has(section.id));

const FIRST: TabKey = SECTIONS[0].id;

const STRINGS = {
  en: {
    title: "Store settings",
    search: "Search store settings…",
    seeStore: "See the store",
    previewTitle: "Your published store",
    previewDescription: "What shoppers see right now — not the changes you have not saved yet.",
    group_basics: "Basics",
    group_buying: "Buying",
    group_showing: "Showing up",
    group_access: "Access",
    "checkout-form": "Purchase form",
    "thank-you": "Thank-you page",
    "store-info": "Store information",
    policies: "Policies",
    pages: "Pages",
    general: "General",
    seo: "SEO",
    domains: "Domains",
    languages: "Languages",
    "gift-options": "Gift options",
    redirects: "Redirects",
    "customer-accounts": "Customer accounts",
  },
  ar: {
    title: "إعدادات المتجر",
    search: "ابحث في إعدادات المتجر…",
    seeStore: "عرض المتجر",
    previewTitle: "متجرك المنشور",
    previewDescription: "ما يراه العميل الآن — لا التعديلات التي لم تُحفظ بعد.",
    group_basics: "الأساسيات",
    group_buying: "الشراء",
    group_showing: "الظهور",
    group_access: "الوصول",
    "checkout-form": "نموذج الشراء",
    "thank-you": "صفحة الشكر",
    "store-info": "بيانات المتجر",
    policies: "السياسات",
    pages: "الصفحات",
    general: "عام",
    seo: "SEO",
    domains: "الدومينات",
    languages: "اللغات",
    "gift-options": "خيارات الهدايا",
    redirects: "تحويل الروابط",
    "customer-accounts": "حسابات العملاء",
  },
} satisfies Messages;

/** One line per section: under its name in the phone list, and under the pane's title. */
const DESCRIPTIONS = {
  en: {
    general: "The store's tab icon and its country.",
    "store-info": "Your phone, email and address, and the trust cards on product pages.",
    policies: "Shipping, refund, privacy and terms — written once, linked everywhere.",
    "checkout-form": "What the shopper fills in to order, and what is required.",
    "gift-options": "“Is this a gift?” at checkout: gift wrap and a message.",
    "thank-you": "What the shopper sees right after placing the order.",
    pages: "Which pages show in the header and footer, and which are open.",
    seo: "How the store looks on Google and when its link is shared.",
    redirects: "Send an old address to a new one so no link breaks.",
    languages: "Offer the store in more languages and translate your content.",
    domains: "Connect your own domain, with its certificate.",
    "customer-accounts": "Let customers sign in with a code to see their orders.",
  },
  ar: {
    general: "أيقونة تبويب المتجر ودولته.",
    "store-info": "هاتفك وبريدك وعنوانك، وبطاقات الثقة في صفحات المنتجات.",
    policies: "الشحن والاسترجاع والخصوصية والشروط — تُكتب مرة واحدة وتظهر في كل مكان.",
    "checkout-form": "ما يملؤه العميل ليطلب، وما هو المطلوب منه.",
    "gift-options": "«هل هذا الطلب هدية؟» عند إتمام الشراء: تغليف ورسالة إهداء.",
    "thank-you": "ما يراه العميل فور تسجيل الطلب.",
    pages: "أي الصفحات تظهر في الترويسة والتذييل، وأيها مفتوح.",
    seo: "كيف يظهر متجرك في Google وعند مشاركة رابطه.",
    redirects: "حوّل الرابط القديم إلى الجديد حتى لا ينقطع أي رابط.",
    languages: "اعرض متجرك بأكثر من لغة وترجم محتواك.",
    domains: "اربط الدومين الخاص بك مع شهادته.",
    "customer-accounts": "اسمح للعميل بالدخول بكود ليرى طلباته.",
  },
} satisfies Messages;

/** Tailwind's `lg`, where SettingsLayout puts the list beside the pane. */
function isDesktopNow(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 64rem)").matches;
}

const pathOf = (tab: TabKey | null) => (tab === null ? "/store-settings" : `/store-settings/${tab}`);

export function StoreDesignPage() {
  // The guard is what a switch of section asks before dropping a section's
  // unsaved draft; a section that reports its draft (useReportDirty) is asked about.
  return (
    <UnsavedGuardProvider>
      <StoreDesignBody />
    </UnsavedGuardProvider>
  );
}

function StoreDesignBody() {
  const t = useT(STRINGS);
  const d = useT(DESCRIPTIONS);
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  // No section in the path (or one that does not exist, or is switched off): a phone shows the list, a desktop opens the first.
  const urlTab: TabKey | null = TABS.includes(tab as TabKey) ? (tab as TabKey) : null;
  // The section on screen. It follows the URL — but with an unsaved draft open,
  // only once the merchant has said so, since switching unmounts the section.
  const [active, setActive] = useState<TabKey | null>(urlTab);
  const { dirty, confirmLeave } = useUnsavedGuard();
  // The switch the merchant has just agreed to (SettingsLayout asked `canLeave` first).
  const approved = useRef<{ tab: TabKey | null } | null>(null);
  // The section was opened from the phone list in this visit: its back row can step back in history.
  const pushedFromList = useRef(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // SettingsLayout has already asked `canLeave` when it calls this.
  function select(id: string | null) {
    const next = id !== null && TABS.includes(id as TabKey) ? (id as TabKey) : null;
    if (next === urlTab) return;
    approved.current = { tab: next };
    if (next === null) {
      // Back to the list (phone). Opened from the list: step back, so the browser's Back does not return here.
      if (pushedFromList.current) {
        pushedFromList.current = false;
        navigate(-1);
      } else {
        navigate(pathOf(null), { replace: true });
      }
      return;
    }
    if (urlTab === null) {
      if (isDesktopNow()) {
        // The desktop opening its first section by itself: the address is corrected, not added to.
        navigate(pathOf(next), { replace: true });
      } else {
        // List → section on a phone is a push: the browser's Back returns to the list.
        pushedFromList.current = true;
        navigate(pathOf(next));
      }
      return;
    }
    navigate(pathOf(next));
  }

  // The URL can change without the list (a link into /store-settings/…,
  // back/forward). Nothing unsaved, or just approved above: follow it.
  // Otherwise ask, and on "keep editing" put the URL back where the screen is.
  useEffect(() => {
    if (urlTab === active) return;
    const wasApproved = approved.current !== null && approved.current.tab === urlTab;
    // With no section in the path a desktop already shows the first one: naming it in the address unmounts nothing.
    const sameScreen = active === null && urlTab === FIRST && isDesktopNow();
    if (!dirty || wasApproved || sameScreen) {
      approved.current = null;
      if (urlTab === null) pushedFromList.current = false;
      setActive(urlTab);
      return;
    }
    let stale = false;
    void confirmLeave().then((leave) => {
      if (stale) return;
      if (leave) {
        if (urlTab === null) pushedFromList.current = false;
        setActive(urlTab);
      } else {
        // The entry we stand on is no longer the one pushed from the list: the back row must not step out of the page.
        pushedFromList.current = false;
        navigate(pathOf(active), { replace: true });
      }
    });
    return () => {
      stale = true;
    };
  }, [urlTab, active, dirty, confirmLeave, navigate]);

  const sections = useMemo<SettingsSectionDef[]>(
    () =>
      SECTIONS.map((section) => ({
        id: section.id,
        label: t[section.id],
        description: d[section.id],
        icon: section.icon,
        tone: section.tone,
        group: t[`group_${section.group}`],
        keywords: section.keywords,
      })),
    [t, d]
  );

  // What the pane holds: the chosen section, or — with none chosen, on a desktop — the first.
  const shown: TabKey = active ?? FIRST;
  const meta = SECTIONS.find((section) => section.id === shown) ?? SECTIONS[0];

  return (
    <>
      <SettingsLayout title={t.title} sections={sections} current={active} onSelect={select} canLeave={confirmLeave} searchPlaceholder={t.search}>
        <SettingsPane
          title={t[shown]}
          description={d[shown]}
          icon={meta.icon}
          tone={meta.tone}
          actions={
            <Button type="button" variant="outline" className="min-h-11 rounded-full px-4 lg:min-h-9" onClick={() => setPreviewOpen(true)}>
              <IconEye className="size-4" aria-hidden />
              {t.seeStore}
            </Button>
          }
        >
          {/* Keyed by workspace so a store switch never shows the previous store's draft. */}
          {shown === "general" && <GeneralTab key={workspaceId} />}
          {shown === "store-info" && <StoreInfoTab key={workspaceId} />}
          {shown === "policies" && <PoliciesTab key={workspaceId} />}
          {shown === "checkout-form" && <CheckoutFormTab key={workspaceId} />}
          {shown === "gift-options" && <GiftOptionsTab key={workspaceId} />}
          {shown === "thank-you" && <ThankYouTab key={workspaceId} />}
          {shown === "pages" && <PagesTab key={workspaceId} />}
          {shown === "seo" && <SeoTab key={workspaceId} />}
          {shown === "redirects" && <RedirectsTab key={workspaceId} />}
          {shown === "languages" && <LanguagesTab key={workspaceId} />}
          {shown === "domains" && <DomainsTab key={workspaceId} />}
          {shown === "customer-accounts" && <CustomerAccountsTab key={workspaceId} />}
        </SettingsPane>
      </SettingsLayout>

      {/* The real store, to check the settings against: what is published, opened on request. */}
      <Sheet open={previewOpen} onOpenChange={setPreviewOpen} title={t.previewTitle} description={t.previewDescription} size="lg">
        <StoreLivePreview workspaceId={workspaceId} />
      </Sheet>
    </>
  );
}
