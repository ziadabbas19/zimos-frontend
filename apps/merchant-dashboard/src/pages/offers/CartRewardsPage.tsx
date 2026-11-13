import { useMemo, useState } from "react";
import { Button, Input } from "@store-builder/ui";
import { CartRewardsBar, previewApplied, type RewardTier } from "@store-builder/ui/cart-rewards";
import {
  CART_REWARDS_MAX_TIERS,
  CART_REWARDS_MAX_TRUST_ITEMS,
  cartRewardsGet,
  cartRewardsSave,
  cartRewardsValidate,
  type CartRewardType,
  type CartRewardsError,
} from "@store-builder/api-client";
import { IconArrowDown, IconArrowUp, IconDelete, IconPlus } from "@/components/icons";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { usePlanFeatures } from "@/lib/usePlanFeatures";
import { formatMoney, majorToMinor } from "@/lib/format";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { Field } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { PlanFeatureNotice } from "@/components/PlanFeatureNotice";
import { RangeInput } from "@/components/RangeInput";
import { SaveBar } from "@/components/SaveBar";
import { Segmented } from "@/components/Segmented";
import { Select } from "@/components/Select";
import { SettingsGroup, SettingsSwitch } from "@/components/settings";
import { useToast } from "@/components/Toast";
import { FormProblem, OfferPage, OfferPreview } from "./OfferKit";
import { autoLabelOf, draftOf, emptyTier, newKey, payloadOf, type Draft, type TierDraft, type TrustDraft } from "./cartRewardsForm";
import { BarAppearanceSection, RewardIconPicker } from "./BarAppearanceSection";
import { appearanceProblems, lookValid } from "./barAppearanceLook";

/**
 * Cart rewards (/offers/cart-rewards, CART_REWARDS_ENABLED): spend thresholds
 * that unlock a discount or free shipping, shown to shoppers as a progress
 * bar in the cart. The merchant lists up to six rewards, each a threshold on
 * the cart's subtotal (after product and offer prices, before any coupon and
 * shipping), a kind (percent off, an amount off, free shipping) and an
 * optional name in Arabic and English; the lines under the checkout button
 * the store wants to promise (nothing is shown that the merchant did not
 * write); and whether a coupon adds to the reward.
 *
 * The checks the server makes are made here first (api-client
 * cartRewardsValidate): a positive threshold, thresholds rising within each
 * kind in the order listed, a whole percent 1–100, a positive amount. The
 * preview is the shoppers' own bar (@store-builder/ui/cart-rewards) on a cart
 * of the amount the slider sets, in either language.
 *
 * Without the plan's cart_rewards (while the server refuses it) the page says
 * so and shows nothing else.
 */

const STRINGS = {
  en: {
    title: "Cart rewards",
    description: "Rewards your shoppers unlock as their cart grows: a discount or free shipping, with a progress bar in the cart.",
    statusGroup: "Rewards bar",
    enabled: "Show the rewards bar and give the rewards",
    enabledHint: "The cart shows how much more unlocks the next reward. The checkout gives the reward the cart reached.",
    stacking: "Combine with coupon codes",
    stackingHint: "Off: the shopper gets whichever saves more, the reward or their code. On: both, the code on the amount after the reward.",
    tiersGroup: "Rewards",
    tiersHint: "Thresholds are on the cart's subtotal after product prices and offers, before any coupon and shipping.",
    tier: "Reward {n}",
    type: "Reward",
    type_percent: "Percent off",
    type_fixed: "Amount off",
    type_free_shipping: "Free shipping",
    threshold: "When the cart reaches",
    percent: "Percent off",
    amount: "Amount off",
    labelAr: "Name in Arabic",
    labelEn: "Name in English",
    labelHint: "Leave empty to use “{auto}”.",
    moveUp: "Move reward {n} up",
    moveDown: "Move reward {n} down",
    remove: "Remove reward {n}",
    add: "Add a reward",
    maxTiers: "Up to {max} rewards.",
    noTiers: "No rewards yet. Add the first one: free shipping from an amount is a good start.",
    trustGroup: "Lines under the checkout button",
    trustHint: "Short promises your store keeps, like how it takes payment. Only the lines you write and switch on are shown.",
    trustAr: "In Arabic",
    trustEn: "In English",
    trustOn: "Show line {n}",
    trustRemove: "Remove line {n}",
    trustAdd: "Add a line",
    trustPlaceholderAr: "مثال: الدفع عند الاستلام",
    trustPlaceholderEn: "e.g. Cash on delivery",
    previewTitle: "Preview",
    previewCart: "A cart of {amount}",
    previewLanguage: "Preview language",
    previewEmpty: "Add a reward to see the bar.",
    previewNote: "The real cart weighs free shipping against the shopper's delivery fee and their code; the preview shows the bar.",
    saved: "Cart rewards saved.",
    error_threshold: "Enter an amount above zero.",
    error_notRising: "Must be higher than the threshold before it for the same kind of reward.",
    error_percent: "A whole percent from 1 to 100.",
    error_amount: "Enter an amount above zero.",
    error_tooMany: "Up to 6 rewards.",
    error_noTiers: "Add at least one reward before turning the bar on.",
    error_trustText: "Write the line in Arabic or English, or remove it.",
    fix: "Some rewards need a fix before saving.",
    fixLook: "The bar's custom colors need a fix before saving (see Bar appearance).",
  },
  ar: {
    title: "مكافآت السلة",
    description: "مكافآت يحصل عليها العميل كلما كبرت سلته: خصم أو شحن مجاني، مع شريط تقدّم في السلة.",
    statusGroup: "شريط المكافآت",
    enabled: "إظهار شريط المكافآت ومنح المكافآت",
    enabledHint: "تعرض السلة المبلغ المتبقي للمكافأة التالية، ويمنح الدفع المكافأة التي وصلت إليها السلة.",
    stacking: "الجمع مع أكواد الخصم",
    stackingHint: "مغلق: يحصل العميل على الأوفر بين المكافأة والكود. مفعّل: الاثنان معًا، والكود على المبلغ بعد المكافأة.",
    tiersGroup: "المكافآت",
    tiersHint: "الحدود على إجمالي السلة بعد أسعار المنتجات والعروض، وقبل أي كوبون والشحن.",
    tier: "المكافأة {n}",
    type: "المكافأة",
    type_percent: "نسبة خصم",
    type_fixed: "مبلغ خصم",
    type_free_shipping: "شحن مجاني",
    threshold: "عندما تصل السلة إلى",
    percent: "نسبة الخصم",
    amount: "مبلغ الخصم",
    labelAr: "الاسم بالعربية",
    labelEn: "الاسم بالإنجليزية",
    labelHint: "اتركه فارغًا لاستخدام «{auto}».",
    moveUp: "تحريك المكافأة {n} لأعلى",
    moveDown: "تحريك المكافأة {n} لأسفل",
    remove: "حذف المكافأة {n}",
    add: "إضافة مكافأة",
    maxTiers: "حتى {max} مكافآت.",
    noTiers: "لا توجد مكافآت بعد. أضف الأولى: الشحن المجاني من مبلغ معيّن بداية جيدة.",
    trustGroup: "سطور تحت زر إتمام الطلب",
    trustHint: "وعود قصيرة يلتزم بها متجرك، مثل طريقة الدفع. لا يظهر إلا ما تكتبه وتفعّله.",
    trustAr: "بالعربية",
    trustEn: "بالإنجليزية",
    trustOn: "إظهار السطر {n}",
    trustRemove: "حذف السطر {n}",
    trustAdd: "إضافة سطر",
    trustPlaceholderAr: "مثال: الدفع عند الاستلام",
    trustPlaceholderEn: "e.g. Cash on delivery",
    previewTitle: "المعاينة",
    previewCart: "سلة بقيمة {amount}",
    previewLanguage: "لغة المعاينة",
    previewEmpty: "أضف مكافأة لترى الشريط.",
    previewNote: "السلة الحقيقية توازن الشحن المجاني مع رسوم توصيل العميل وكوده؛ المعاينة تعرض الشريط.",
    saved: "تم حفظ مكافآت السلة.",
    error_threshold: "اكتب مبلغًا أكبر من صفر.",
    error_notRising: "يجب أن يكون أعلى من الحد السابق لنفس نوع المكافأة.",
    error_percent: "نسبة صحيحة من 1 إلى 100.",
    error_amount: "اكتب مبلغًا أكبر من صفر.",
    error_tooMany: "حتى 6 مكافآت.",
    error_noTiers: "أضف مكافأة واحدة على الأقل قبل تفعيل الشريط.",
    error_trustText: "اكتب السطر بالعربية أو بالإنجليزية، أو احذفه.",
    fix: "بعض المكافآت تحتاج تصحيحًا قبل الحفظ.",
    fixLook: "ألوان الشريط المخصصة تحتاج إلى إصلاح قبل الحفظ (انظر شكل الشريط).",
  },
} satisfies Messages;

/** Each check's message. */
const ERROR_KEY: Record<CartRewardsError, `error_${CartRewardsError}`> = {
  threshold: "error_threshold",
  notRising: "error_notRising",
  percent: "error_percent",
  amount: "error_amount",
  tooMany: "error_tooMany",
  noTiers: "error_noTiers",
  trustText: "error_trustText",
};

// ---------------------------------------------------------------- the page --

export function CartRewardsPage() {
  const t = useT(STRINGS);
  const plan = usePlanFeatures();
  if (plan.gated("cart_rewards")) {
    return (
      <OfferPage title={t.title} description={t.description} width="form">
        <PlanFeatureNotice feature="cart_rewards" />
      </OfferPage>
    );
  }
  return <CartRewardsScreen />;
}

function CartRewardsScreen() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { currentWorkspace } = useWorkspace();
  const fallbackCurrency = currentWorkspace?.defaultCurrency ?? "EGP";

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState<Draft | null>(null);
  const [currency, setCurrency] = useState(fallbackCurrency);
  // The store's cart speed (Store settings → Cart behavior): the preview's fill glides at it.
  const [cartSpeed, setCartSpeed] = useState<"fast" | "normal" | "none">("fast");
  const [busy, setBusy] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loaded = useAsync(async () => {
    const settings = await cartRewardsGet(apiClient, workspaceId);
    const next = draftOf(settings);
    setDraft(next);
    setSaved(next);
    setCurrency(settings.currency || fallbackCurrency);
    setCartSpeed(settings.cartSpeed ?? "fast");
    return settings;
  }, [workspaceId]);

  const payload = draft ? payloadOf(draft) : null;
  const errors = payload ? cartRewardsValidate(payload) : {};
  const dirty = Boolean(draft && saved && JSON.stringify(payloadOf(draft)) !== JSON.stringify(payloadOf(saved)));
  useReportDirty(dirty);

  const update = (change: (d: Draft) => Draft) => {
    setError(null);
    setDraft((d) => (d ? change(d) : d));
  };
  const setTier = (key: string, change: Partial<TierDraft>) => update((d) => ({ ...d, tiers: d.tiers.map((tier) => (tier.key === key ? { ...tier, ...change } : tier)) }));
  const moveTier = (index: number, by: -1 | 1) =>
    update((d) => {
      const tiers = [...d.tiers];
      const [moved] = tiers.splice(index, 1);
      tiers.splice(index + by, 0, moved);
      return { ...d, tiers };
    });
  const setTrust = (key: string, change: Partial<TrustDraft>) => update((d) => ({ ...d, trust: d.trust.map((item) => (item.key === key ? { ...item, ...change } : item)) }));

  async function save() {
    if (!draft || !payload) return;
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      setError(t.fix);
      return;
    }
    // A custom look whose colours do not read apart (or are not colours) is not saved; the section says which pair.
    if (draft.appearance.mode === "custom" && draft.appearance.custom && (!lookValid(draft.appearance.custom) || appearanceProblems(draft.appearance).length > 0)) {
      setError(t.fixLook);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const settings = await cartRewardsSave(apiClient, workspaceId, payload);
      const next = draftOf(settings);
      setDraft(next);
      setSaved(next);
      setShowErrors(false);
      toast.success(t.saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const errorOf = (field: string) => (showErrors && errors[field] ? t[ERROR_KEY[errors[field]]] : undefined);

  return (
    <OfferPage title={t.title} description={t.description} width="form">
      <DataState loading={loaded.loading} error={loaded.error} onRetry={() => loaded.refresh()}>
        {draft && (
          <div className="space-y-4">
            <SettingsGroup title={t.statusGroup}>
              <SettingsSwitch checked={draft.enabled} onChange={(enabled) => update((d) => ({ ...d, enabled }))} label={t.enabled} hint={t.enabledHint} disabled={busy} />
              <SettingsSwitch
                checked={draft.allowCouponStacking}
                onChange={(allowCouponStacking) => update((d) => ({ ...d, allowCouponStacking }))}
                label={t.stacking}
                hint={t.stackingHint}
                disabled={busy}
              />
            </SettingsGroup>

            <SettingsGroup title={t.tiersGroup} description={t.tiersHint}>
              <div className="space-y-3 px-4 py-4">
                {draft.tiers.length === 0 && <p className="text-sm text-ink-soft">{t.noTiers}</p>}
                <ol className="space-y-3">
                  {draft.tiers.map((tier, index) => (
                    <TierEditor
                      key={tier.key}
                      tier={tier}
                      index={index}
                      count={draft.tiers.length}
                      currency={currency}
                      disabled={busy}
                      errorOf={errorOf}
                      onChange={(change) => setTier(tier.key, change)}
                      onMove={(by) => moveTier(index, by)}
                      onRemove={() => update((d) => ({ ...d, tiers: d.tiers.filter((x) => x.key !== tier.key) }))}
                    />
                  ))}
                </ol>
                {errorOf("tiers") && <p className="text-xs font-medium text-danger">{errorOf("tiers")}</p>}
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    disabled={busy || draft.tiers.length >= CART_REWARDS_MAX_TIERS}
                    onClick={() => update((d) => ({ ...d, tiers: [...d.tiers, emptyTier(d.tiers.length === 0 ? "free_shipping" : "percent")] }))}
                  >
                    <IconPlus className="size-4" aria-hidden />
                    {t.add}
                  </Button>
                  <span className="text-xs text-ink-soft">{fmt(t.maxTiers, { max: CART_REWARDS_MAX_TIERS })}</span>
                </div>
              </div>
            </SettingsGroup>

            <SettingsGroup title={t.trustGroup} description={t.trustHint}>
              <div className="space-y-3 px-4 py-4">
                <ol className="space-y-3">
                  {draft.trust.map((item, index) => (
                    <li key={item.key} className="space-y-2 rounded-xl p-3 ring-1 ring-line">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Field label={t.trustAr} error={errorOf(`trustItems.${index}.text`)}>
                          {(aria) => <Input {...aria} dir="rtl" lang="ar" value={item.ar} placeholder={t.trustPlaceholderAr} maxLength={80} disabled={busy} onChange={(e) => setTrust(item.key, { ar: e.target.value })} className="min-h-11" />}
                        </Field>
                        <Field label={t.trustEn}>
                          {(aria) => <Input {...aria} dir="ltr" lang="en" value={item.en} placeholder={t.trustPlaceholderEn} maxLength={80} disabled={busy} onChange={(e) => setTrust(item.key, { en: e.target.value })} className="min-h-11" />}
                        </Field>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <SettingsSwitch checked={item.enabled} onChange={(enabled) => setTrust(item.key, { enabled })} label={fmt(t.trustOn, { n: index + 1 })} disabled={busy} className="flex-1 px-0" />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-11 text-ink-soft hover:text-danger"
                          aria-label={fmt(t.trustRemove, { n: index + 1 })}
                          disabled={busy}
                          onClick={() => update((d) => ({ ...d, trust: d.trust.filter((x) => x.key !== item.key) }))}
                        >
                          <IconDelete className="size-4" aria-hidden />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ol>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={busy || draft.trust.length >= CART_REWARDS_MAX_TRUST_ITEMS}
                  onClick={() => update((d) => ({ ...d, trust: [...d.trust, { key: newKey(), ar: "", en: "", enabled: true }] }))}
                >
                  <IconPlus className="size-4" aria-hidden />
                  {t.trustAdd}
                </Button>
              </div>
            </SettingsGroup>

            <BarAppearanceSection appearance={draft.appearance} onChange={(appearance) => update((d) => ({ ...d, appearance }))} disabled={busy} />

            <CartRewardsPreview draft={draft} currency={currency} speed={cartSpeed} />

            <FormProblem>{error}</FormProblem>
            <SaveBar
              dirty={dirty}
              saving={busy}
              onSave={() => void save()}
              onDiscard={() => {
                setDraft(saved);
                setShowErrors(false);
                setError(null);
              }}
            />
          </div>
        )}
      </DataState>
    </OfferPage>
  );
}

function TierEditor({
  tier,
  index,
  count,
  currency,
  disabled,
  errorOf,
  onChange,
  onMove,
  onRemove,
}: {
  tier: TierDraft;
  index: number;
  count: number;
  currency: string;
  disabled: boolean;
  errorOf: (field: string) => string | undefined;
  onChange: (change: Partial<TierDraft>) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}) {
  const t = useT(STRINGS);
  const n = index + 1;
  const value = tier.type === "percent" ? Number(tier.value) || 0 : majorToMinor(tier.value) || 0;
  const auto = autoLabelOf(tier.type, value, currency);
  const iconButton = "size-11 text-ink-soft";
  return (
    <li className="space-y-3 rounded-xl p-3 ring-1 ring-line">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{fmt(t.tier, { n })}</p>
        <div className="flex items-center">
          <Button type="button" variant="ghost" size="icon" className={iconButton} aria-label={fmt(t.moveUp, { n })} disabled={disabled || index === 0} onClick={() => onMove(-1)}>
            <IconArrowUp className="size-4" aria-hidden />
          </Button>
          <Button type="button" variant="ghost" size="icon" className={iconButton} aria-label={fmt(t.moveDown, { n })} disabled={disabled || index === count - 1} onClick={() => onMove(1)}>
            <IconArrowDown className="size-4" aria-hidden />
          </Button>
          <Button type="button" variant="ghost" size="icon" className={`${iconButton} hover:text-danger`} aria-label={fmt(t.remove, { n })} disabled={disabled} onClick={onRemove}>
            <IconDelete className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.type}>
          {(aria) => (
            <Select {...aria} value={tier.type} disabled={disabled} onChange={(e) => onChange({ type: e.target.value as CartRewardType, value: "" })} className="min-h-11">
              <option value="free_shipping">{t.type_free_shipping}</option>
              <option value="percent">{t.type_percent}</option>
              <option value="fixed">{t.type_fixed}</option>
            </Select>
          )}
        </Field>
        <MoneyInput label={t.threshold} currency={currency} value={tier.threshold} disabled={disabled} error={errorOf(`tiers.${index}.thresholdAmount`)} onChange={(threshold) => onChange({ threshold })} className="[&_input]:min-h-11" />
        {tier.type === "percent" && (
          <Field label={t.percent} error={errorOf(`tiers.${index}.value`)}>
            {(aria) => (
              <div className="relative">
                <Input {...aria} inputMode="numeric" value={tier.value} disabled={disabled} onChange={(e) => onChange({ value: e.target.value })} className="min-h-11 pe-9" />
                <span className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3 text-sm text-ink-soft">%</span>
              </div>
            )}
          </Field>
        )}
        {tier.type === "fixed" && (
          <MoneyInput label={t.amount} currency={currency} value={tier.value} disabled={disabled} error={errorOf(`tiers.${index}.value`)} onChange={(v) => onChange({ value: v })} className="[&_input]:min-h-11" />
        )}
      </div>

      <RewardIconPicker type={tier.type} value={tier.icon} onChange={(icon) => onChange({ icon })} disabled={disabled} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.labelAr} hint={fmt(t.labelHint, { auto: auto.ar })}>
          {(aria) => <Input {...aria} dir="rtl" lang="ar" value={tier.labelAr} placeholder={auto.ar} maxLength={60} disabled={disabled} onChange={(e) => onChange({ labelAr: e.target.value })} className="min-h-11" />}
        </Field>
        <Field label={t.labelEn} hint={fmt(t.labelHint, { auto: auto.en })}>
          {(aria) => <Input {...aria} dir="ltr" lang="en" value={tier.labelEn} placeholder={auto.en} maxLength={60} disabled={disabled} onChange={(e) => onChange({ labelEn: e.target.value })} className="min-h-11" />}
        </Field>
      </div>
    </li>
  );
}

/** The shoppers' bar on a cart of the amount the slider sets, in either language: tiers that are filled in only. */
function CartRewardsPreview({ draft, currency, speed }: { draft: Draft; currency: string; speed: "fast" | "normal" | "none" }) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const [lang, setLang] = useState<"ar" | "en">(locale === "ar" ? "ar" : "en");

  const tiers: RewardTier[] = useMemo(
    () =>
      draft.tiers.flatMap((tier) => {
        const threshold = majorToMinor(tier.threshold);
        if (!Number.isFinite(threshold) || threshold < 1) return [];
        const value = tier.type === "percent" ? Number(tier.value) : tier.type === "fixed" ? majorToMinor(tier.value) : null;
        if (tier.type !== "free_shipping" && (!Number.isFinite(value) || (value ?? 0) < 1)) return [];
        const auto = autoLabelOf(tier.type, value ?? 0, currency);
        return [{ thresholdAmount: threshold, type: tier.type, value, label: { ar: tier.labelAr.trim() || auto.ar, en: tier.labelEn.trim() || auto.en }, icon: tier.icon }];
      }),
    [draft.tiers, currency]
  );
  const top = tiers.reduce((max, tier) => Math.max(max, tier.thresholdAmount), 0);
  const step = 100;
  const max = Math.max(step, Math.ceil((top * 1.2) / step) * step);
  const [subtotal, setSubtotal] = useState<number | null>(null);
  const amount = Math.min(max, subtotal ?? Math.round(max / 2 / step) * step);
  const money = (n: number) => formatMoney(n, currency, lang === "ar" ? "ar-EG" : "en-EG");
  // The look as the store will draw it: the custom one only while it is chosen and its colours read.
  const look = draft.appearance.mode === "custom" && draft.appearance.custom && lookValid(draft.appearance.custom) ? ({ mode: "custom", ...draft.appearance.custom } as const) : ({ mode: "inherit" } as const);
  const trust = draft.trust.filter((item) => item.enabled).map((item) => (lang === "ar" ? item.ar || item.en : item.en || item.ar).trim()).filter(Boolean);

  return (
    <SettingsGroup title={t.previewTitle}>
      <div className="space-y-3 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            value={lang}
            onChange={(next) => setLang(next)}
            label={t.previewLanguage}
            size="sm"
            options={[
              { value: "ar", label: "العربية" },
              { value: "en", label: "English" },
            ]}
          />
        </div>
        {tiers.length === 0 ? (
          <p className="text-sm text-ink-soft">{t.previewEmpty}</p>
        ) : (
          <>
            <RangeInput label={fmt(t.previewCart, { amount: money(amount) })} valueText={money(amount)} value={amount} min={0} max={max} step={step} onChange={setSubtotal} />
            <p className="text-xs text-ink-soft">{fmt(t.previewCart, { amount: money(amount) })}</p>
            <OfferPreview>
              <div dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} className="space-y-2">
                <CartRewardsBar tiers={tiers} subtotal={amount} applied={previewApplied(tiers, amount)} locale={lang} formatMoney={money} appearance={look} speed={speed} />
                {trust.length > 0 && <p className="text-center text-xs text-ink-soft">{trust.join(" · ")}</p>}
              </div>
            </OfferPreview>
            <p className="text-xs text-ink-soft">{t.previewNote}</p>
          </>
        )}
      </div>
    </SettingsGroup>
  );
}
