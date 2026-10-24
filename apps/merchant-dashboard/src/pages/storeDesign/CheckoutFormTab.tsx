import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Lock, Plus, Trash2 } from "lucide-react";
import { Alert, Badge, Button, Input, cn } from "@store-builder/ui";
import {
  CHECKOUT_FORM_CUSTOM_KEYS,
  CHECKOUT_FORM_LOCKED_KEYS,
  resolveCheckoutForm,
  storeDesignSaveCheckoutForm,
  type CheckoutForm,
  type CheckoutFormField,
  type CheckoutFormLayout,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { Section } from "@/components/Section";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { ReadOnlyNotice, SettingsFormFooter, ToggleRow } from "./SettingsFormFooter";
import { useSettingsEditor } from "./useSettingsEditor";

const STRINGS = {
  en: {
    tip: "The fewer the fields, the higher the sales.",
    fieldsTitle: "Form fields",
    fieldsDescription:
      "Choose what shoppers fill in, in which order, and what they must not skip. Name and mobile number are always asked.",
    full_name: "Full name",
    phone: "Mobile number",
    phone_alt: "Alternative number",
    email: "Email",
    country: "Country",
    government: "Governorate",
    city: "City / area",
    address: "Detailed address",
    postal_code: "Postal code",
    sa_national_address: "Saudi national address",
    note: "Order note",
    customField: "Custom field",
    shown: "Shown",
    required: "Required",
    always: "Always asked",
    moveUp: "Move up",
    moveDown: "Move down",
    edit: "Label and help text",
    remove: "Remove field",
    labelAr: "Label (Arabic)",
    labelEn: "Label (English)",
    labelHint: "Leave empty to use the store's built-in label.",
    helpAr: "Help text (Arabic)",
    helpEn: "Help text (English)",
    type: "Answer type",
    typeText: "Free text",
    typeChoice: "Choose from a list",
    options: "Choices (one per line)",
    optionsHint: "A list field with no choices is not shown.",
    addCustom: "Add a custom field",
    customLimit: "You can add up to five custom fields.",
    customNeedsLabel: "Give every custom field a label before saving.",
    optionsTitle: "Form options",
    layout: "Where shoppers fill in the form",
    inline_on_product: "On the product page (fastest for one-product stores)",
    one_step: "On the checkout page only",
    allowCodes: "Discount codes",
    allowCodesHint: "Show the discount code box at checkout.",
    trust: "Trust badges",
    trustHint: "Show the cash-on-delivery, delivery and returns badges on product pages.",
    autoRegion: "Pre-select the shipping region",
    autoRegionHint: "Start the form on the region the shopper chose earlier.",
    autoVariant: "Pre-select a product variant",
    autoVariantHint: "Open product pages with the first available variant chosen.",
    thankYouMessage: "Short thank-you message",
    thankYouMessageHint: "One line shown right after the order is placed. Leave empty for none.",
    saved: "Purchase form saved.",
  },
  ar: {
    tip: "كلما قلّت الحقول، زادت المبيعات.",
    fieldsTitle: "حقول النموذج",
    fieldsDescription: "اختر ما يملؤه المشتري وترتيبه وما لا يمكن تخطيه. الاسم ورقم الموبايل يُطلبان دائمًا.",
    full_name: "الاسم بالكامل",
    phone: "رقم الموبايل",
    phone_alt: "رقم بديل",
    email: "البريد الإلكتروني",
    country: "الدولة",
    government: "المحافظة",
    city: "المدينة / المنطقة",
    address: "العنوان بالتفصيل",
    postal_code: "الرمز البريدي",
    sa_national_address: "العنوان الوطني السعودي",
    note: "ملاحظة الطلب",
    customField: "حقل مخصص",
    shown: "ظاهر",
    required: "مطلوب",
    always: "يُطلب دائمًا",
    moveUp: "تحريك لأعلى",
    moveDown: "تحريك لأسفل",
    edit: "العنوان والنص المساعد",
    remove: "حذف الحقل",
    labelAr: "العنوان (عربي)",
    labelEn: "العنوان (إنجليزي)",
    labelHint: "اتركه فارغًا لاستخدام العنوان الافتراضي للمتجر.",
    helpAr: "النص المساعد (عربي)",
    helpEn: "النص المساعد (إنجليزي)",
    type: "نوع الإجابة",
    typeText: "نص حر",
    typeChoice: "اختيار من قائمة",
    options: "الاختيارات (اختيار في كل سطر)",
    optionsHint: "حقل القائمة بدون اختيارات لا يظهر.",
    addCustom: "إضافة حقل مخصص",
    customLimit: "يمكنك إضافة خمسة حقول مخصصة على الأكثر.",
    customNeedsLabel: "اكتب عنوانًا لكل حقل مخصص قبل الحفظ.",
    optionsTitle: "خيارات النموذج",
    layout: "أين يملأ المشتري النموذج",
    inline_on_product: "في صفحة المنتج (الأسرع لمتاجر المنتج الواحد)",
    one_step: "في صفحة إتمام الطلب فقط",
    allowCodes: "أكواد الخصم",
    allowCodesHint: "إظهار خانة كود الخصم عند إتمام الطلب.",
    trust: "شارات الثقة",
    trustHint: "إظهار شارات الدفع عند الاستلام والتوصيل والاسترجاع في صفحات المنتجات.",
    autoRegion: "اختيار منطقة الشحن تلقائيًا",
    autoRegionHint: "يبدأ النموذج بالمنطقة التي اختارها المشتري من قبل.",
    autoVariant: "اختيار نوع المنتج تلقائيًا",
    autoVariantHint: "تفتح صفحة المنتج وأول نوع متاح مختار.",
    thankYouMessage: "رسالة شكر قصيرة",
    thankYouMessageHint: "سطر واحد يظهر بعد تسجيل الطلب مباشرة. اتركه فارغًا لعدم الإظهار.",
    saved: "تم حفظ نموذج الشراء.",
  },
} satisfies Messages;

const LAYOUTS: CheckoutFormLayout[] = ["inline_on_product", "one_step"];

export function CheckoutFormTab() {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const editor = useSettingsEditor<CheckoutForm>(
    (settings) => resolveCheckoutForm(settings.checkout_settings),
    (draft) => storeDesignSaveCheckoutForm(apiClient, workspaceId, draft),
    t.saved
  );
  const { draft, setDraft, editable, saving } = editor;
  const [open, setOpen] = useState<string | null>(null);
  const locked = !editable || saving;

  const patchField = (key: string, patch: Partial<CheckoutFormField>) =>
    setDraft((prev) => ({ ...prev, fields: prev.fields.map((f) => (f.key === key ? { ...f, ...patch } : f)) }));

  function move(index: number, delta: number) {
    setDraft((prev) => {
      const fields = [...prev.fields];
      const target = index + delta;
      if (target < 0 || target >= fields.length) return prev;
      [fields[index], fields[target]] = [fields[target], fields[index]];
      return { ...prev, fields };
    });
  }

  const freeCustomKey = CHECKOUT_FORM_CUSTOM_KEYS.find((key) => !draft.fields.some((f) => f.key === key));

  function addCustom() {
    if (!freeCustomKey) return;
    setDraft((prev) => ({
      ...prev,
      fields: [
        ...prev.fields,
        {
          key: freeCustomKey,
          label: { ar: "", en: "" },
          helpText: { ar: "", en: "" },
          position: prev.fields.length + 1,
          enabled: true,
          required: false,
          custom: true,
          type: "text",
          options: [],
        },
      ],
    }));
    setOpen(freeCustomKey);
  }

  const nameOf = (f: CheckoutFormField) =>
    f.label[locale] || f.label.ar || f.label.en || (f.custom ? t.customField : t[f.key as keyof typeof t]);
  const unlabelledCustom = draft.fields.some((f) => f.custom && !f.label.ar && !f.label.en);

  return (
    <DataState loading={!editor.ready} error={null}>
      <div className="space-y-5">
        <ReadOnlyNotice editable={editable} />
        <Alert>{t.tip}</Alert>

        <Section title={t.fieldsTitle} description={t.fieldsDescription} searchAnchor="checkout-fields">
          <ul className="divide-y divide-line">
            {draft.fields.map((f, index) => {
              const fixed = CHECKOUT_FORM_LOCKED_KEYS.includes(f.key);
              const expanded = open === f.key;
              return (
                <li key={f.key} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={t.moveUp}
                        disabled={locked || index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={t.moveDown}
                        disabled={locked || index === draft.fields.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setOpen(expanded ? null : f.key)}
                      aria-expanded={expanded}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-start"
                    >
                      <span className={cn("truncate text-sm font-medium", f.enabled ? "text-ink" : "text-ink-soft")}>
                        {nameOf(f)}
                      </span>
                      {f.custom && <Badge variant="secondary">{t.customField}</Badge>}
                      <ChevronDown className={cn("size-4 shrink-0 text-ink-soft transition-transform", expanded && "rotate-180")} />
                      <span className="sr-only">{t.edit}</span>
                    </button>

                    {fixed ? (
                      <span className="flex items-center gap-1.5 text-xs text-ink-soft">
                        <Lock className="size-3.5" />
                        {t.always}
                      </span>
                    ) : (
                      <div className="flex items-center gap-4 text-sm text-ink">
                        <label className="flex cursor-pointer items-center gap-1.5">
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            checked={f.enabled}
                            disabled={locked}
                            onChange={(e) =>
                              patchField(f.key, { enabled: e.target.checked, required: e.target.checked && f.required })
                            }
                          />
                          {t.shown}
                        </label>
                        {f.key !== "note" && (
                          <label className="flex cursor-pointer items-center gap-1.5">
                            <input
                              type="checkbox"
                              className="size-4 accent-primary"
                              checked={f.required}
                              disabled={locked || !f.enabled}
                              onChange={(e) => patchField(f.key, { required: e.target.checked })}
                            />
                            {t.required}
                          </label>
                        )}
                        {f.custom && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t.remove}
                            disabled={locked}
                            onClick={() => setDraft((prev) => ({ ...prev, fields: prev.fields.filter((x) => x.key !== f.key) }))}
                          >
                            <Trash2 className="size-4 text-danger" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {expanded && (
                    <div className="mt-3 grid gap-3 rounded-[0.5rem] bg-paper p-3 sm:grid-cols-2">
                      <TextField
                        label={t.labelAr}
                        hint={f.custom ? undefined : t.labelHint}
                        dir="rtl"
                        maxLength={80}
                        value={f.label.ar}
                        disabled={locked}
                        onChange={(e) => patchField(f.key, { label: { ...f.label, ar: e.target.value } })}
                      />
                      <TextField
                        label={t.labelEn}
                        dir="ltr"
                        maxLength={80}
                        value={f.label.en}
                        disabled={locked}
                        onChange={(e) => patchField(f.key, { label: { ...f.label, en: e.target.value } })}
                      />
                      <TextField
                        label={t.helpAr}
                        dir="rtl"
                        maxLength={200}
                        value={f.helpText.ar}
                        disabled={locked}
                        onChange={(e) => patchField(f.key, { helpText: { ...f.helpText, ar: e.target.value } })}
                      />
                      <TextField
                        label={t.helpEn}
                        dir="ltr"
                        maxLength={200}
                        value={f.helpText.en}
                        disabled={locked}
                        onChange={(e) => patchField(f.key, { helpText: { ...f.helpText, en: e.target.value } })}
                      />
                      {f.custom && (
                        <>
                          <Field label={t.type}>
                            {({ id }) => (
                              <Select
                                id={id}
                                value={f.type ?? "text"}
                                disabled={locked}
                                onChange={(e) => patchField(f.key, { type: e.target.value === "choice" ? "choice" : "text" })}
                              >
                                <option value="text">{t.typeText}</option>
                                <option value="choice">{t.typeChoice}</option>
                              </Select>
                            )}
                          </Field>
                          {f.type === "choice" && (
                            <Field label={t.options} hint={t.optionsHint}>
                              {({ id }) => (
                                <Textarea
                                  id={id}
                                  rows={4}
                                  disabled={locked}
                                  value={(f.options ?? []).join("\n")}
                                  onChange={(e) =>
                                    patchField(f.key, { options: e.target.value.split("\n").slice(0, 20) })
                                  }
                                />
                              )}
                            </Field>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {editable && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button variant="outline" disabled={saving || !freeCustomKey} onClick={addCustom}>
                <Plus className="size-4" />
                {t.addCustom}
              </Button>
              {!freeCustomKey && <span className="text-xs text-ink-soft">{t.customLimit}</span>}
            </div>
          )}
        </Section>

        <Section title={t.optionsTitle}>
          <div className="space-y-4">
            <Field label={t.layout}>
              {({ id }) => (
                <Select
                  id={id}
                  value={draft.layout}
                  disabled={locked}
                  onChange={(e) => setDraft((prev) => ({ ...prev, layout: e.target.value as CheckoutFormLayout }))}
                >
                  {LAYOUTS.map((layout) => (
                    <option key={layout} value={layout}>
                      {t[layout]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <div className="divide-y divide-line">
              <ToggleRow
                label={t.allowCodes}
                hint={t.allowCodesHint}
                checked={draft.allow_discount_codes}
                disabled={locked}
                onChange={(v) => setDraft((prev) => ({ ...prev, allow_discount_codes: v }))}
              />
              <ToggleRow
                label={t.trust}
                hint={t.trustHint}
                checked={draft.show_trust_badges}
                disabled={locked}
                onChange={(v) => setDraft((prev) => ({ ...prev, show_trust_badges: v }))}
              />
              <ToggleRow
                label={t.autoRegion}
                hint={t.autoRegionHint}
                checked={draft.auto_select_region}
                disabled={locked}
                onChange={(v) => setDraft((prev) => ({ ...prev, auto_select_region: v }))}
              />
              <ToggleRow
                label={t.autoVariant}
                hint={t.autoVariantHint}
                checked={draft.auto_select_variant}
                disabled={locked}
                onChange={(v) => setDraft((prev) => ({ ...prev, auto_select_variant: v }))}
              />
            </div>

            <Field label={t.thankYouMessage} hint={t.thankYouMessageHint}>
              {({ id }) => (
                <Input
                  id={id}
                  maxLength={500}
                  disabled={locked}
                  value={draft.thank_you_message ?? ""}
                  onChange={(e) => setDraft((prev) => ({ ...prev, thank_you_message: e.target.value }))}
                />
              )}
            </Field>
          </div>
        </Section>

        <SettingsFormFooter
          editable={editable}
          dirty={editor.dirty && !unlabelledCustom}
          saving={saving}
          error={editor.error ?? (unlabelledCustom ? t.customNeedsLabel : null)}
          onSave={() => void editor.save()}
          onReset={editor.reset}
        />
      </div>
    </DataState>
  );
}
