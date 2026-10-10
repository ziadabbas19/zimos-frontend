import { useId, useState } from "react";
import { IconChecklist, IconError, IconSuccess } from "@/components/icons";
import { Button, Input, cn } from "@store-builder/ui";
import {
  FEED_CHANNELS,
  feedsChecklist,
  feedsGet,
  feedsSave,
  type FeedCheckKey,
  type FeedChecklist,
  type FeedSettings,
  type FeedState,
} from "@store-builder/api-client";
import { apiBaseUrl, apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { AccordionSection } from "@/components/Accordion";
import { DataState } from "@/components/DataState";
import { SaveBar } from "@/components/SaveBar";
import { SettingsGroup, SettingsRow, SettingsSwitch } from "@/components/settings";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { ViewLink } from "@/components/ViewLink";
import { FormProblem, OfferPage, TOUCH_FIELD } from "./OfferKit";

/**
 * The product feed: one fixed link per ad channel that always
 * holds the store's current catalog, and the Google Merchant checklist —
 * what approval needs from the store's contact details and policies. The
 * store-wide settings are one group of rows, the channels' links another, the
 * checklist a section that folds, and one save bar holds whatever changed.
 */

const STRINGS = {
  en: {
    stateOn: "Published",
    stateOff: "Off",
    checklistLeft: "{count} left before Google accepts the feed",
    checklistCount: "{count} left",
    checklistDone: "Ready",
    title: "Product feed",
    description: "A link for each ad platform's catalog. It updates by itself when you change products or prices.",
    enabled: "Publish the product feed",
    count: "{items} items from {products} products are in the feed.",
    countEmpty: "No products are in the feed yet. A product needs to be active, visible and have an image.",
    brand: "Brand",
    brandHint: "Leave blank to use your store's name.",
    category: "Google product category",
    categoryHint: "Optional, e.g. “Apparel & Accessories > Clothing”.",
    excludeOut: "Leave out sold-out items",
    save: "Save",
    saving: "Saving…",
    saved: "Feed settings saved.",
    links: "Feed links",
    linksHint: "Paste the link into the platform's catalog as a scheduled feed. Use XML unless the platform asks for CSV.",
    linksOff: "Switch the feed on and save to get working links.",
    channel_meta: "Meta (Facebook and Instagram)",
    channel_google: "Google Merchant Center",
    channel_tiktok: "TikTok",
    channel_snapchat: "Snapchat",
    copyXml: "Copy XML link",
    copyCsv: "CSV",
    copied: "Link copied.",
    checklist: "Google Merchant checklist",
    checklistReady: "Your store has what Google Merchant asks for.",
    checklistMissing: "Finish these before you submit the feed to Google Merchant:",
    check_store_info_enabled: "Store information is shown in the store",
    check_email: "A contact email",
    check_phone: "A contact phone number",
    check_address: "The business address",
    check_shipping_policy: "A shipping policy",
    check_return_policy: "A return policy",
    check_cod_policy: "A cash-on-delivery policy",
    check_privacy_policy: "A privacy policy",
    check_products: "At least one product in the feed",
    check_feed_enabled: "The feed is published",
    fix_store_info: "Store information",
    fix_legal: "Policies",
    fix_catalog: "Products",
  },
  ar: {
    stateOn: "منشور",
    stateOff: "متوقف",
    checklistLeft: "بقي {count} قبل أن يقبل Google الملف",
    checklistCount: "بقي {count}",
    checklistDone: "جاهز",
    title: "ملف المنتجات",
    description: "رابط لكتالوج كل منصة إعلانات. يتحدّث تلقائيًا عند تغيير المنتجات أو الأسعار.",
    enabled: "نشر ملف المنتجات",
    count: "{items} عنصر من {products} منتج في الملف.",
    countEmpty: "لا توجد منتجات في الملف بعد. يجب أن يكون المنتج نشطًا وظاهرًا وله صورة.",
    brand: "العلامة التجارية",
    brandHint: "اتركه فارغًا لاستخدام اسم متجرك.",
    category: "تصنيف منتجات Google",
    categoryHint: "اختياري، مثل «Apparel & Accessories > Clothing».",
    excludeOut: "استبعاد العناصر التي نفدت",
    save: "حفظ",
    saving: "جارٍ الحفظ…",
    saved: "تم حفظ إعدادات الملف.",
    links: "روابط الملف",
    linksHint: "الصق الرابط في كتالوج المنصة كملف مجدول. استخدم XML إلا إذا طلبت المنصة CSV.",
    linksOff: "فعّل الملف واحفظ لتعمل الروابط.",
    channel_meta: "Meta (فيسبوك وإنستجرام)",
    channel_google: "Google Merchant Center",
    channel_tiktok: "TikTok",
    channel_snapchat: "Snapchat",
    copyXml: "نسخ رابط XML",
    copyCsv: "CSV",
    copied: "تم نسخ الرابط.",
    checklist: "قائمة فحص Google Merchant",
    checklistReady: "متجرك فيه ما يطلبه Google Merchant.",
    checklistMissing: "أكمل هذه قبل إرسال الملف إلى Google Merchant:",
    check_store_info_enabled: "معلومات المتجر ظاهرة في المتجر",
    check_email: "بريد إلكتروني للتواصل",
    check_phone: "رقم هاتف للتواصل",
    check_address: "عنوان النشاط",
    check_shipping_policy: "سياسة الشحن",
    check_return_policy: "سياسة الاسترجاع",
    check_cod_policy: "سياسة الدفع عند الاستلام",
    check_privacy_policy: "سياسة الخصوصية",
    check_products: "منتج واحد على الأقل في الملف",
    check_feed_enabled: "الملف منشور",
    fix_store_info: "معلومات المتجر",
    fix_legal: "السياسات",
    fix_catalog: "المنتجات",
  },
} satisfies Messages;

/** Where each kind of gap is fixed. Store info and policies are on the store settings screen. */
const FIX_ROUTE: Record<string, string | null> = { store_info: "/store-settings", legal: "/store-settings", catalog: "/catalog", feed: null };

/** The API base as an absolute URL: the dashboard may be configured with a relative one. */
function absoluteApiBase(): string {
  return /^https?:\/\//i.test(apiBaseUrl) ? apiBaseUrl : `${window.location.origin}${apiBaseUrl}`;
}

/** A draft as one string: two drafts that save the same thing compare equal. */
const fingerprint = (feed: FeedSettings) => JSON.stringify(feed);

export function ProductFeedPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const ids = useId();
  const [state, setState] = useState<FeedState | null>(null);
  const [draft, setDraft] = useState<FeedSettings | null>(null);
  const [checklist, setChecklist] = useState<FeedChecklist | null>(null);
  const [checklistOpen, setChecklistOpen] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = useAsync(async () => {
    const [feed, checks] = await Promise.all([feedsGet(apiClient, workspaceId), feedsChecklist(apiClient, workspaceId)]);
    setState(feed);
    setDraft(feed.feed);
    setChecklist(checks);
    return feed;
  }, [workspaceId]);

  const set = <K extends keyof FeedSettings>(key: K, value: FeedSettings[K]) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setError(null);
  };

  const dirty = Boolean(draft && state && fingerprint(draft) !== fingerprint(state.feed));
  useReportDirty(dirty);

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await feedsSave(apiClient, workspaceId, draft);
      setState(saved);
      setDraft(saved.feed);
      setChecklist(await feedsChecklist(apiClient, workspaceId));
      toast.success(t.saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const missing = (checklist?.checks ?? []).filter((check) => !check.ok);

  async function copy(path: string) {
    try {
      await navigator.clipboard.writeText(`${absoluteApiBase()}${path}`);
      toast.success(t.copied);
    } catch {
      /* the link is on screen to select */
    }
  }

  return (
    <OfferPage
      title={t.title}
      description={t.description}
      titleBadge={
        state ? (
          <StatusBadge
            value={state.feed.enabled ? "active" : "disabled"}
            tone={state.feed.enabled ? "success" : "neutral"}
            text={state.feed.enabled ? t.stateOn : t.stateOff}
          />
        ) : undefined
      }
    >
      <DataState loading={data.loading} error={data.error} onRetry={() => data.refresh()}>
        {draft && state && (
          <div className="space-y-5">
            <SettingsGroup>
              <SettingsSwitch
                checked={draft.enabled}
                onChange={(next) => set("enabled", next)}
                label={t.enabled}
                hint={state.itemCount > 0 ? fmt(t.count, { items: state.itemCount, products: state.productCount }) : t.countEmpty}
                disabled={busy}
              />
              <SettingsRow
                label={t.brand}
                hint={t.brandHint}
                htmlFor={`${ids}-brand`}
                control={
                  <Input
                    id={`${ids}-brand`}
                    maxLength={100}
                    value={draft.brand}
                    disabled={busy}
                    onChange={(e) => set("brand", e.target.value)}
                    className={TOUCH_FIELD}
                  />
                }
              />
              <SettingsRow
                label={t.category}
                hint={t.categoryHint}
                htmlFor={`${ids}-category`}
                control={
                  <Input
                    id={`${ids}-category`}
                    dir="ltr"
                    maxLength={250}
                    value={draft.googleProductCategory}
                    disabled={busy}
                    onChange={(e) => set("googleProductCategory", e.target.value)}
                    className={TOUCH_FIELD}
                  />
                }
              />
              <SettingsSwitch checked={draft.excludeOutOfStock} onChange={(next) => set("excludeOutOfStock", next)} label={t.excludeOut} disabled={busy} />
            </SettingsGroup>

            {/* One fixed link per ad channel; the links work once the feed is published and saved. */}
            <SettingsGroup title={t.links} description={state.feed.enabled ? t.linksHint : t.linksOff}>
              {FEED_CHANNELS.map((channel) => (
                <SettingsRow
                  key={channel}
                  stacked
                  label={t[`channel_${channel}`]}
                  htmlFor={`${ids}-link-${channel}`}
                  control={
                    <div className="flex flex-wrap gap-2">
                      <Input
                        id={`${ids}-link-${channel}`}
                        dir="ltr"
                        readOnly
                        value={`${absoluteApiBase()}${state.links[channel].xml}`}
                        onFocus={(e) => e.target.select()}
                        className={cn(TOUCH_FIELD, "min-w-0 flex-1")}
                      />
                      <Button type="button" variant="outline" className="min-h-11 shrink-0" disabled={!state.feed.enabled} onClick={() => void copy(state.links[channel].xml)}>
                        {t.copyXml}
                      </Button>
                      <Button type="button" variant="ghost" className="min-h-11 shrink-0" disabled={!state.feed.enabled} onClick={() => void copy(state.links[channel].csv)}>
                        {t.copyCsv}
                      </Button>
                    </div>
                  }
                />
              ))}
            </SettingsGroup>

            {checklist && (
              <AccordionSection
                title={t.checklist}
                icon={IconChecklist}
                summary={checklist.ready ? t.checklistReady : fmt(t.checklistLeft, { count: missing.length })}
                badge={
                  <StatusBadge
                    value={checklist.ready ? "active" : "pending"}
                    tone={checklist.ready ? "success" : "warning"}
                    text={checklist.ready ? t.checklistDone : fmt(t.checklistCount, { count: missing.length })}
                  />
                }
                // Open by itself while something is missing; the merchant's own fold wins after that.
                open={checklistOpen ?? !checklist.ready}
                onOpenChange={setChecklistOpen}
                flush
              >
                <p className="px-4 pt-3 text-[13px] leading-5 text-ink-soft">{checklist.ready ? t.checklistReady : t.checklistMissing}</p>
                <ul className="mt-1 divide-y divide-line px-4 pb-2">
                  {(checklist.ready ? checklist.checks : [...missing, ...checklist.checks.filter((c) => c.ok)]).map((check) => {
                    const route = FIX_ROUTE[check.fixAt];
                    return (
                      <li key={check.key} className="flex min-h-11 items-center gap-3 py-1.5 text-sm">
                        {check.ok ? (
                          <IconSuccess className="size-5 shrink-0 text-success" aria-hidden />
                        ) : (
                          <IconError className="size-5 shrink-0 text-accent-dark" aria-hidden />
                        )}
                        <span className={check.ok ? "min-w-0 flex-1 text-ink-soft" : "min-w-0 flex-1 font-medium text-ink"}>{t[`check_${check.key as FeedCheckKey}`]}</span>
                        {!check.ok && route && (
                          <ViewLink
                            to={route}
                            className="inline-flex min-h-11 shrink-0 items-center rounded-full px-2 text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                          >
                            {t[`fix_${check.fixAt}` as "fix_store_info" | "fix_legal" | "fix_catalog"]}
                          </ViewLink>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </AccordionSection>
            )}

            <FormProblem>{error}</FormProblem>
            <SaveBar dirty={dirty} saving={busy} onSave={() => void save()} onDiscard={() => setDraft(state.feed)} />
          </div>
        )}
      </DataState>
    </OfferPage>
  );
}
