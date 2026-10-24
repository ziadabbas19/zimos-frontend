import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@store-builder/ui";
import { IconEye } from "@/components/icons";
import { SettingsLayout, SettingsPane, type SettingsSectionDef } from "@/components/settings";
import { Sheet } from "@/components/Sheet";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { UnsavedGuardProvider, useUnsavedGuard } from "@/lib/useUnsavedGuard";
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
import {
  STORE_SETTINGS_DESCRIPTIONS,
  STORE_SETTINGS_SECTIONS,
  STORE_SETTINGS_SECTION_STRINGS,
  STORE_SETTINGS_TABS,
  storeSettingsPath,
  type StoreSettingsTab,
} from "./storeSettingsSections";

/**
 * Store settings the shopper sees, laid out like System Settings: a searchable
 * list of sections and ONE section in the pane (on a phone the list is the
 * page and pushes to a section). The section stays in the path
 * (/store-settings/:tab) with the values it always had, so every link keeps
 * landing where it did. Each section is a self-contained form over the
 * workspace settings; a new area is a new file plus one entry in
 * storeSettingsSections.ts (the dashboard's search reads the same list).
 */
type TabKey = StoreSettingsTab;
const TABS = STORE_SETTINGS_TABS;
const SECTIONS = STORE_SETTINGS_SECTIONS;

const FIRST: TabKey = SECTIONS[0].id;

const STRINGS = {
  en: {
    ...STORE_SETTINGS_SECTION_STRINGS.en,
    search: "Search store settings…",
    seeStore: "See the store",
    previewTitle: "Your published store",
    previewDescription: "What shoppers see right now — not the changes you have not saved yet.",
  },
  ar: {
    ...STORE_SETTINGS_SECTION_STRINGS.ar,
    search: "ابحث في إعدادات المتجر…",
    seeStore: "عرض المتجر",
    previewTitle: "متجرك المنشور",
    previewDescription: "ما يراه العميل الآن — لا التعديلات التي لم تُحفظ بعد.",
  },
} satisfies Messages;

const DESCRIPTIONS = STORE_SETTINGS_DESCRIPTIONS;

/** Tailwind's `lg`, where SettingsLayout puts the list beside the pane. */
function isDesktopNow(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 64rem)").matches;
}

const pathOf = storeSettingsPath;

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
      <SettingsLayout title={t.title} sections={sections} current={active} onSelect={select} canLeave={confirmLeave} searchPlaceholder={t.search} searchScope="store-settings">
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
