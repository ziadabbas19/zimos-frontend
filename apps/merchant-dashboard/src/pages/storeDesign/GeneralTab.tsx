import {
  SOCIAL_LINK_KEYS,
  resolveGeneralStoreSettings,
  storeDesignSaveGeneral,
  type GeneralStoreSettings,
  type SocialLinkKey,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { usePlanFeatures } from "@/lib/usePlanFeatures";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { StoreAppSection } from "./StoreAppSection";
import { DataState } from "@/components/DataState";
import { PlanFeatureNotice } from "@/components/PlanFeatureNotice";
import { Section } from "@/components/Section";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { ReadOnlyNotice, SettingsFormFooter, ToggleRow } from "./SettingsFormFooter";
import { useSettingsEditor } from "./useSettingsEditor";
import { FaviconField } from "./FaviconField";

const COUNTRIES = ["EG", "SA", "AE", "KW", "QA", "BH", "OM", "JO", "IQ", "LY", "MA", "DZ", "TN"] as const;

const STRINGS = {
  en: {
    identity: "Store identity",
    identityDescription: "The small icon browsers show on the tab, and the country your store sells in.",
    country: "Country",
    countryNone: "Not set",
    EG: "Egypt",
    SA: "Saudi Arabia",
    AE: "United Arab Emirates",
    KW: "Kuwait",
    QA: "Qatar",
    BH: "Bahrain",
    OM: "Oman",
    JO: "Jordan",
    IQ: "Iraq",
    LY: "Libya",
    MA: "Morocco",
    DZ: "Algeria",
    TN: "Tunisia",
    social: "Social links",
    socialDescription: "Shown in the store footer. Leave a field empty to hide that link.",
    facebook: "Facebook",
    instagram: "Instagram",
    tiktok: "TikTok",
    whatsapp: "WhatsApp",
    youtube: "YouTube",
    snapchat: "Snapchat",
    x: "X",
    linkHint: "A full link starting with https://",
    whatsappButton: "Floating WhatsApp button",
    whatsappDescription: "A chat button pinned to the corner of every store page.",
    whatsappEnabled: "Show the button",
    whatsappPhone: "WhatsApp number",
    whatsappPhoneHint: "With the country code, digits only — for example 201001234567.",
    whatsappMessage: "Opening message",
    whatsappMessageHint: "What the shopper's chat starts with. Optional.",
    branding: "ZIMOS branding",
    brandingDescription:
      "The small “Powered by ZIMOS” line in your store's footer, and the ZIMOS mark shown where your store has no logo.",
    hideBranding: "Hide ZIMOS branding",
    hideBrandingHint:
      "Your emails to shoppers are then sent under your store's name too. In effect only while your plan includes it: if your plan changes, the branding shows again until it does.",
    saved: "General settings saved.",
  },
  ar: {
    identity: "هوية المتجر",
    identityDescription: "الأيقونة الصغيرة التي تظهر في تبويب المتصفح، والدولة التي يبيع فيها متجرك.",
    country: "الدولة",
    countryNone: "غير محددة",
    EG: "مصر",
    SA: "السعودية",
    AE: "الإمارات",
    KW: "الكويت",
    QA: "قطر",
    BH: "البحرين",
    OM: "عُمان",
    JO: "الأردن",
    IQ: "العراق",
    LY: "ليبيا",
    MA: "المغرب",
    DZ: "الجزائر",
    TN: "تونس",
    social: "روابط التواصل",
    socialDescription: "تظهر في فوتر المتجر. اترك الحقل فارغًا لإخفاء الرابط.",
    facebook: "فيسبوك",
    instagram: "إنستجرام",
    tiktok: "تيك توك",
    whatsapp: "واتساب",
    youtube: "يوتيوب",
    snapchat: "سناب شات",
    x: "إكس",
    linkHint: "رابط كامل يبدأ بـ https://",
    whatsappButton: "زر واتساب العائم",
    whatsappDescription: "زر محادثة ثابت في ركن كل صفحات المتجر.",
    whatsappEnabled: "إظهار الزر",
    whatsappPhone: "رقم واتساب",
    whatsappPhoneHint: "بكود الدولة وأرقام فقط — مثال 201001234567.",
    whatsappMessage: "رسالة البداية",
    whatsappMessageHint: "ما تبدأ به محادثة المشتري. اختياري.",
    branding: "شعار ZIMOS",
    brandingDescription: "سطر «مدعوم من ZIMOS» الصغير في فوتر متجرك، وعلامة ZIMOS التي تظهر حيث لا يوجد شعار لمتجرك.",
    hideBranding: "إخفاء شعار ZIMOS",
    hideBrandingHint:
      "تُرسل رسائلك الإلكترونية إلى المشترين باسم متجرك أيضًا. يسري فقط ما دامت خطتك تشمله: إذا تغيّرت خطتك يظهر الشعار من جديد حتى تشمله.",
    saved: "تم حفظ الإعدادات العامة.",
  },
} satisfies Messages;

export function GeneralTab() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const editor = useSettingsEditor<GeneralStoreSettings>(
    (settings) => resolveGeneralStoreSettings(settings),
    (draft) => storeDesignSaveGeneral(apiClient, workspaceId, draft),
    t.saved
  );
  const { draft, setDraft, editable, saving } = editor;
  const locked = !editable || saving;
  // "Hide ZIMOS branding" is saved on any plan but only works with remove_branding;
  // without it the switch shows what is stored and can't be flipped.
  const plan = usePlanFeatures();
  const brandingHeld = plan.held("remove_branding");
  const setLink = (key: SocialLinkKey, value: string) =>
    setDraft((prev) => ({ ...prev, social_links: { ...prev.social_links, [key]: value } }));
  const setWhatsapp = (patch: Partial<GeneralStoreSettings["floating_whatsapp"]>) =>
    setDraft((prev) => ({ ...prev, floating_whatsapp: { ...prev.floating_whatsapp, ...patch } }));

  return (
    <DataState loading={!editor.ready} error={null}>
      <div className="space-y-5">
        <ReadOnlyNotice editable={editable} />

        <Section title={t.identity} description={t.identityDescription} searchAnchor="store-identity">
          <div className="grid gap-4 sm:grid-cols-2">
            <FaviconField
              value={draft.favicon_url}
              disabled={locked}
              onChange={(favicon_url) => setDraft((prev) => ({ ...prev, favicon_url }))}
            />
            <Field label={t.country}>
              {({ id }) => (
                <Select
                  id={id}
                  value={draft.country}
                  disabled={locked}
                  onChange={(e) => setDraft((prev) => ({ ...prev, country: e.target.value }))}
                >
                  <option value="">{t.countryNone}</option>
                  {COUNTRIES.map((code) => (
                    <option key={code} value={code}>
                      {t[code]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </Section>

        <Section title={t.social} description={t.socialDescription} searchAnchor="social-links">
          <div className="grid gap-4 sm:grid-cols-2">
            {SOCIAL_LINK_KEYS.map((key) => (
              <TextField
                key={key}
                label={t[key]}
                type="url"
                dir="ltr"
                maxLength={500}
                placeholder="https://"
                value={draft.social_links[key]}
                disabled={locked}
                onChange={(e) => setLink(key, e.target.value)}
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-soft">{t.linkHint}</p>
        </Section>

        <Section title={t.whatsappButton} description={t.whatsappDescription} searchAnchor="whatsapp-button">
          <div className="space-y-4">
            <ToggleRow
              label={t.whatsappEnabled}
              checked={draft.floating_whatsapp.enabled}
              disabled={locked}
              onChange={(enabled) => setWhatsapp({ enabled })}
            />
            <TextField
              label={t.whatsappPhone}
              hint={t.whatsappPhoneHint}
              type="tel"
              dir="ltr"
              maxLength={20}
              value={draft.floating_whatsapp.phone}
              disabled={locked || !draft.floating_whatsapp.enabled}
              onChange={(e) => setWhatsapp({ phone: e.target.value })}
            />
            <Field label={t.whatsappMessage} hint={t.whatsappMessageHint}>
              {({ id }) => (
                <Textarea
                  id={id}
                  rows={2}
                  maxLength={300}
                  disabled={locked || !draft.floating_whatsapp.enabled}
                  value={draft.floating_whatsapp.message}
                  onChange={(e) => setWhatsapp({ message: e.target.value })}
                />
              )}
            </Field>
          </div>
        </Section>

        <Section title={t.branding} description={t.brandingDescription} searchAnchor="remove-branding">
          <ToggleRow
            label={t.hideBranding}
            hint={t.hideBrandingHint}
            checked={draft.hide_platform_branding}
            disabled={locked || !brandingHeld}
            onChange={(hide_platform_branding) => setDraft((prev) => ({ ...prev, hide_platform_branding }))}
          />
          {!brandingHeld && <PlanFeatureNotice feature="remove_branding" className="mt-3" />}
        </Section>

        <SettingsFormFooter
          editable={editable}
          dirty={editor.dirty}
          saving={saving}
          error={editor.error}
          onSave={() => void editor.save()}
          onReset={editor.reset}
        />

        <StoreAppSection />
      </div>
    </DataState>
  );
}
