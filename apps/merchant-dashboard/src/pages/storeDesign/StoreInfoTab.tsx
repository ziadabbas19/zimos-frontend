import {
  STORE_INFO_CARD_KEYS,
  resolveStoreInfo,
  storeDesignSaveStoreInfo,
  type StoreInfoCard,
  type StoreInfoCardKey,
  type StoreInfoSettings,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { Section } from "@/components/Section";
import { Field, TextField } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { ReadOnlyNotice, SettingsFormFooter, ToggleRow } from "./SettingsFormFooter";
import { useSettingsEditor } from "./useSettingsEditor";

const STRINGS = {
  en: {
    title: "Store information",
    description: "Contact details shoppers and ad platforms can see, and short policies shown as trust cards under the buy button.",
    enabled: "Show store information in the store",
    enabledHint: "When off, product pages show the generic trust badges instead.",
    email: "Store email",
    phone: "Store phone",
    address: "Company address",
    shipping_policy: "Shipping policy",
    return_policy: "Return policy",
    cod_policy: "Cash-on-delivery policy",
    cardShown: "Show this card",
    cardTitle: "Title",
    cardPoints: "Points (one per line)",
    cardPointsHint: "Up to eight short lines, for example: Delivery within 2-5 business days.",
    saved: "Store information saved.",
  },
  ar: {
    title: "بيانات المتجر",
    description: "بيانات التواصل التي يراها المشتري ومنصات الإعلانات، وسياسات قصيرة تظهر ككروت ثقة تحت زر الشراء.",
    enabled: "إظهار بيانات المتجر في المتجر",
    enabledHint: "عند الإيقاف تعرض صفحات المنتجات شارات الثقة العامة.",
    email: "بريد المتجر",
    phone: "هاتف المتجر",
    address: "عنوان الشركة",
    shipping_policy: "سياسة الشحن",
    return_policy: "سياسة الاسترجاع",
    cod_policy: "سياسة الدفع عند الاستلام",
    cardShown: "إظهار هذا الكارت",
    cardTitle: "العنوان",
    cardPoints: "النقاط (نقطة في كل سطر)",
    cardPointsHint: "حتى ثمانية أسطر قصيرة، مثال: التوصيل خلال 2-5 أيام عمل.",
    saved: "تم حفظ بيانات المتجر.",
  },
} satisfies Messages;

export function StoreInfoTab() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const editor = useSettingsEditor<StoreInfoSettings>(
    (settings) => resolveStoreInfo(settings.store_info),
    (draft) => storeDesignSaveStoreInfo(apiClient, workspaceId, draft),
    t.saved
  );
  const { draft, setDraft, editable, saving } = editor;
  const locked = !editable || saving;
  const patchCard = (key: StoreInfoCardKey, patch: Partial<StoreInfoCard>) =>
    setDraft((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  return (
    <DataState loading={!editor.ready} error={null}>
      <div className="space-y-5">
        <ReadOnlyNotice editable={editable} />

        <Section title={t.title} description={t.description} searchAnchor="store-contact">
          <div className="space-y-4">
            <ToggleRow
              label={t.enabled}
              hint={t.enabledHint}
              checked={draft.enabled}
              disabled={locked}
              onChange={(enabled) => setDraft((prev) => ({ ...prev, enabled }))}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label={t.email}
                type="email"
                dir="ltr"
                maxLength={200}
                value={draft.email}
                disabled={locked}
                onChange={(e) => setDraft((prev) => ({ ...prev, email: e.target.value }))}
              />
              <TextField
                label={t.phone}
                type="tel"
                dir="ltr"
                maxLength={32}
                value={draft.phone}
                disabled={locked}
                onChange={(e) => setDraft((prev) => ({ ...prev, phone: e.target.value }))}
              />
              <TextField
                label={t.address}
                className="sm:col-span-2"
                maxLength={300}
                value={draft.address}
                disabled={locked}
                onChange={(e) => setDraft((prev) => ({ ...prev, address: e.target.value }))}
              />
            </div>
          </div>
        </Section>

        {STORE_INFO_CARD_KEYS.map((key, index) => {
          const card = draft[key];
          return (
            <Section key={key} title={t[key]} searchAnchor={index === 0 ? "trust-cards" : undefined}>
              <div className="space-y-4">
                <ToggleRow
                  label={t.cardShown}
                  checked={card.enabled}
                  disabled={locked}
                  onChange={(enabled) => patchCard(key, { enabled })}
                />
                <TextField
                  label={t.cardTitle}
                  maxLength={120}
                  value={card.title}
                  disabled={locked || !card.enabled}
                  onChange={(e) => patchCard(key, { title: e.target.value })}
                />
                <Field label={t.cardPoints} hint={t.cardPointsHint}>
                  {({ id }) => (
                    <Textarea
                      id={id}
                      rows={4}
                      disabled={locked || !card.enabled}
                      value={card.points.join("\n")}
                      onChange={(e) => patchCard(key, { points: e.target.value.split("\n").slice(0, 8) })}
                    />
                  )}
                </Field>
              </div>
            </Section>
          );
        })}

        <SettingsFormFooter
          editable={editable}
          dirty={editor.dirty}
          saving={saving}
          error={editor.error}
          onSave={() => void editor.save()}
          onReset={editor.reset}
        />
      </div>
    </DataState>
  );
}
