import { useEffect, useState } from "react";
import { Button, Input, SkeletonBar, cn } from "@store-builder/ui";
import {
  CART_SHEET_DEFAULTS,
  CART_SHEET_DURATION_MS,
  CART_SHEET_MAX_TRUST_ITEMS,
  CART_SHEET_TRUST_TEXT_MAX,
  cartSheetGet,
  cartSheetSave,
  cartSheetSettingsOf,
  cartSheetTrustErrors,
  type CartSheetPresentation,
  type CartSheetSettings,
  type CartSheetSpeed,
  type CartSheetStaffView,
  type CartSheetTrustItem,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { IconDelete, IconPlus } from "@/components/icons";
import { DataState } from "@/components/DataState";
import { Field } from "@/components/Field";
import { Section } from "@/components/Section";
import { Segmented } from "@/components/Segmented";
import { ReadOnlyNotice, SettingsFormFooter, ToggleRow } from "./SettingsFormFooter";
import { useSettingsEditor } from "./useSettingsEditor";

/**
 * Store settings → Buying → Cart behavior (/store-settings/cart): how the
 * store's cart sheet opens and moves. Every store has the sheet, whatever its
 * plan; no switch of the platform's is involved. Cart rewards only add their
 * bar to it (Offers → Cart rewards, which also sets the bar's look).
 *
 *   When it opens   after "Add to cart" (off), from the cart icon (on), from
 *                   a product page's "Order now" with the quick order form (off);
 *                   or "off for all", and the cart is a page of its own
 *   How it appears  automatic (a bottom sheet on a phone, a side drawer on a
 *                   wider screen), bottom sheet, side drawer, popup
 *   Speed           fast (about 260 ms), normal, none
 *   Trust lines     up to four short lines under the checkout button
 *
 * Read from GET /workspaces/:id/cart-sheet, which also brings the trust lines
 * a store wrote on the cart rewards page before they moved here; saved whole
 * in workspace.settings.cart_sheet through the store settings' PATCH
 * (website.edit), the lines with it, and the save drops the store's cached
 * pages. A store that never saved it has the defaults, which is what the
 * form starts from.
 */

const STRINGS = {
  en: {
    title: "Cart behavior",
    description: "How your store's cart opens and moves, for every shopper.",
    defaults: "Your store uses the default cart: the cart icon opens it, a bottom sheet on phones and a side drawer on wide screens.",
    whenTitle: "When the cart opens",
    whenHint: "The cart opens over the page the shopper is on, so they never lose their place.",
    addToCart: "After “Add to cart”",
    addToCartHint: "Opens by itself once a product is added. Off: the button says “added” and the cart count moves.",
    cartIcon: "When the shopper taps the cart icon",
    cartIconHint: "Off: the icon goes to the cart page.",
    quickOrder: "From the “Order now” button",
    quickOrderHint: "Opens on that product with its totals and the cash-on-delivery order form, so the shopper orders right there.",
    offForAll: "Off for all",
    offForAllHint: "No sheet anywhere: the cart is its own page. Your choices above are kept for when you turn it back on.",
    howTitle: "How it appears",
    auto: "Automatic",
    autoHint: "Bottom sheet on phones, side drawer on wide screens",
    bottom_sheet: "Bottom sheet",
    bottom_sheetHint: "Rises from the bottom of the screen",
    side_drawer: "Side drawer",
    side_drawerHint: "Slides in from the side, mirrored with the language: from the left in Arabic, from the right in English",
    popup: "Centered popup",
    popupHint: "A window in the middle of the screen",
    speedTitle: "Animation speed",
    speedHint: "Shoppers who ask their device for less motion always get none.",
    fast: "Fast",
    normal: "Normal",
    none: "None",
    preview: "Preview",
    previewHint: "How the cart opens, at the speed you chose.",
    previewLanguage: "Preview language",
    replay: "Play again",
    phone: "Phone",
    computer: "Computer",
    offPreview: "The cart sheet is off: the cart icon and the buttons go to the cart page.",
    trustTitle: "Lines under the checkout button",
    trustHint: "Short promises your store keeps, like how it takes payment. Shown in the cart for every shopper; only the lines you write and switch on.",
    trustMoved: "These lines were written on the Cart rewards page. They live here now: saving keeps them here.",
    trustAr: "In Arabic",
    trustEn: "In English",
    trustOn: "Show line {n}",
    trustRemove: "Remove line {n}",
    trustAdd: "Add a line",
    trustMax: "Up to {max} lines.",
    trustPlaceholderAr: "مثال: الدفع عند الاستلام",
    trustPlaceholderEn: "e.g. Cash on delivery",
    error_trustText: "Write the line in Arabic or English, or remove it.",
    error_tooLong: "Up to {max} characters.",
    fix: "Some lines need a fix before saving.",
    saved: "Cart behavior saved.",
  },
  ar: {
    title: "سلوك السلة",
    description: "طريقة فتح سلة متجرك وحركتها، لكل العملاء.",
    defaults: "متجرك يستخدم السلة الافتراضية: تفتح من أيقونة السلة، كلوحة من الأسفل على الهاتف وكدرج جانبي على الشاشات العريضة.",
    whenTitle: "متى تفتح السلة",
    whenHint: "تفتح السلة فوق الصفحة التي يتصفحها العميل، فلا يفقد مكانه.",
    addToCart: "بعد «أضف للسلة»",
    addToCartHint: "تفتح تلقائيًا بعد إضافة منتج. عند الإيقاف يعرض الزر «تمت الإضافة» ويتغير عدد السلة.",
    cartIcon: "عند الضغط على أيقونة السلة",
    cartIconHint: "عند الإيقاف تنتقل الأيقونة إلى صفحة السلة.",
    quickOrder: "من زر «اطلب الآن»",
    quickOrderHint: "تفتح على هذا المنتج مع الإجمالي ونموذج الطلب بالدفع عند الاستلام، فيطلب العميل منها مباشرة.",
    offForAll: "إيقاف للجميع",
    offForAllHint: "لا لوحة في أي مكان: السلة صفحة مستقلة. تبقى اختياراتك أعلاه محفوظة لحين إعادة التشغيل.",
    howTitle: "طريقة الظهور",
    auto: "تلقائي",
    autoHint: "لوحة من الأسفل على الهاتف، ودرج جانبي على الشاشات العريضة",
    bottom_sheet: "لوحة من الأسفل",
    bottom_sheetHint: "تصعد من أسفل الشاشة",
    side_drawer: "درج جانبي",
    side_drawerHint: "ينزلق من الجانب حسب اتجاه اللغة: من اليسار في العربية ومن اليمين في الإنجليزية",
    popup: "نافذة في المنتصف",
    popupHint: "نافذة في وسط الشاشة",
    speedTitle: "سرعة الحركة",
    speedHint: "العميل الذي يطلب من جهازه تقليل الحركة لا يرى أي حركة.",
    fast: "سريعة",
    normal: "عادية",
    none: "بدون حركة",
    preview: "معاينة",
    previewHint: "طريقة فتح السلة بالسرعة التي اخترتها.",
    previewLanguage: "لغة المعاينة",
    replay: "إعادة التشغيل",
    phone: "الهاتف",
    computer: "الكمبيوتر",
    offPreview: "لوحة السلة متوقفة: أيقونة السلة والأزرار تنتقل إلى صفحة السلة.",
    trustTitle: "سطور تحت زر إتمام الطلب",
    trustHint: "وعود قصيرة يلتزم بها متجرك، مثل طريقة الدفع. تظهر في السلة لكل العملاء، ولا يظهر إلا ما تكتبه وتفعّله.",
    trustMoved: "هذه السطور كُتبت في صفحة مكافآت السلة، ومكانها الآن هنا: الحفظ يُبقيها هنا.",
    trustAr: "بالعربية",
    trustEn: "بالإنجليزية",
    trustOn: "إظهار السطر {n}",
    trustRemove: "حذف السطر {n}",
    trustAdd: "إضافة سطر",
    trustMax: "حتى {max} سطور.",
    trustPlaceholderAr: "مثال: الدفع عند الاستلام",
    trustPlaceholderEn: "e.g. Cash on delivery",
    error_trustText: "اكتب السطر بالعربية أو الإنجليزية، أو احذفه.",
    error_tooLong: "حتى {max} حرفًا.",
    fix: "بعض السطور تحتاج إلى إصلاح قبل الحفظ.",
    saved: "تم حفظ سلوك السلة.",
  },
} satisfies Messages;

const PRESENTATIONS: readonly CartSheetPresentation[] = ["auto", "bottom_sheet", "side_drawer", "popup"];
const SPEEDS: readonly CartSheetSpeed[] = ["fast", "normal", "none"];

interface TrustDraft {
  key: string;
  ar: string;
  en: string;
  enabled: boolean;
}

/** The form: the settings, and the trust lines with a key each (their order can change while editing). */
interface CartForm extends Omit<CartSheetSettings, "trustItems"> {
  trust: TrustDraft[];
}

let keySeq = 0;
const trustDraftsOf = (items: readonly CartSheetTrustItem[]): TrustDraft[] => items.map((item) => ({ key: `t${++keySeq}`, ar: item.text.ar, en: item.text.en, enabled: item.enabled }));
const trustItemsOf = (trust: readonly TrustDraft[]): CartSheetTrustItem[] => trust.map((item) => ({ text: { ar: item.ar.trim(), en: item.en.trim() }, enabled: item.enabled }));

/**
 * The settings as stored, read safely (the defaults for a store that never
 * saved them); trust lines not saved here yet are the ones the server found
 * where they were before (`loaded`).
 */
function formOf(raw: unknown, loaded: CartSheetStaffView): CartForm {
  const { trustItems, ...settings } = cartSheetSettingsOf(raw);
  return { ...settings, trust: trustDraftsOf(trustItems ?? loaded.trustItems) };
}

export function CartTab() {
  const workspaceId = useWorkspaceId();
  const loaded = useAsync(() => cartSheetGet(apiClient, workspaceId), [workspaceId]);
  return (
    <DataState loading={loaded.loading} error={loaded.error} onRetry={() => void loaded.refresh()} skeleton={<CartTabSkeleton />}>
      {loaded.data && <CartTabForm loaded={loaded.data} />}
    </DataState>
  );
}

function CartTabForm({ loaded }: { loaded: CartSheetStaffView }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const editor = useSettingsEditor<CartForm>(
    (settings) => formOf(settings.cart_sheet, loaded),
    ({ trust, ...settings }) => cartSheetSave(apiClient, workspaceId, { ...settings, trustItems: trustItemsOf(trust) }),
    t.saved
  );
  const { draft, setDraft, editable, saving } = editor;
  const [showErrors, setShowErrors] = useState(false);
  const locked = !editable || saving;
  const off = !draft.enabled;
  const setOpenOn = (key: keyof CartSheetSettings["openOn"], value: boolean) => setDraft((prev) => ({ ...prev, openOn: { ...prev.openOn, [key]: value } }));
  const setTrust = (key: string, change: Partial<TrustDraft>) => setDraft((prev) => ({ ...prev, trust: prev.trust.map((item) => (item.key === key ? { ...item, ...change } : item)) }));
  const { trust: savedTrust, ...savedSettings } = editor.saved;
  const neverChosen = JSON.stringify(savedSettings) === JSON.stringify(CART_SHEET_DEFAULTS) && savedTrust.length === 0;
  const errors = cartSheetTrustErrors(trustItemsOf(draft.trust));
  const errorOf = (index: number) => {
    const error = showErrors ? errors[`trustItems.${index}.text`] : undefined;
    return error === "tooLong" ? fmt(t.error_tooLong, { max: CART_SHEET_TRUST_TEXT_MAX }) : error ? t.error_trustText : undefined;
  };
  // The lines came from the rewards page and the store has not saved any here yet.
  const { currentWorkspace } = useWorkspace();
  const savedHere = cartSheetSettingsOf((currentWorkspace?.settings as Record<string, unknown> | undefined)?.cart_sheet).trustItems !== undefined;
  const fromRewards = loaded.trustItemsFrom === "cart_rewards" && loaded.trustItems.length > 0 && !savedHere;

  function save() {
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    void editor.save();
  }

  return (
    <div className="space-y-5">
      <ReadOnlyNotice editable={editable} />
      {neverChosen && <p className="rounded-[0.5rem] bg-paper px-4 py-3 text-sm text-ink-soft">{t.defaults}</p>}

      <Section title={t.whenTitle} description={t.whenHint}>
        <div className="divide-y divide-line">
          <ToggleRow label={t.addToCart} hint={t.addToCartHint} checked={draft.openOn.addToCart} disabled={locked || off} onChange={(v) => setOpenOn("addToCart", v)} />
          <ToggleRow label={t.cartIcon} hint={t.cartIconHint} checked={draft.openOn.cartIcon} disabled={locked || off} onChange={(v) => setOpenOn("cartIcon", v)} />
          <ToggleRow label={t.quickOrder} hint={t.quickOrderHint} checked={draft.openOn.quickOrder} disabled={locked || off} onChange={(v) => setOpenOn("quickOrder", v)} />
          <ToggleRow label={t.offForAll} hint={t.offForAllHint} checked={off} disabled={locked} onChange={(v) => setDraft((prev) => ({ ...prev, enabled: !v }))} />
        </div>
      </Section>

      <Section title={t.howTitle}>
        <fieldset disabled={locked || off} className="grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">{t.howTitle}</legend>
          {PRESENTATIONS.map((p) => (
            <label
              key={p}
              className={cn(
                "flex min-h-11 cursor-pointer items-start gap-3 rounded-[0.5rem] border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40",
                draft.presentation === p ? "border-primary bg-primary/5" : "border-line hover:bg-paper",
                (locked || off) && "cursor-default opacity-60"
              )}
            >
              <input
                type="radio"
                name="cart-presentation"
                value={p}
                checked={draft.presentation === p}
                onChange={() => setDraft((prev) => ({ ...prev, presentation: p }))}
                className="mt-1 size-4 shrink-0 accent-primary"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{t[p]}</span>
                <span className="block text-xs text-ink-soft">{t[`${p}Hint`]}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </Section>

      <Section title={t.speedTitle} description={t.speedHint}>
        <Segmented
          value={draft.speed}
          onChange={(speed) => !locked && !off && setDraft((prev) => ({ ...prev, speed }))}
          label={t.speedTitle}
          options={SPEEDS.map((s) => ({ value: s, label: t[s] }))}
        />
      </Section>

      <Section title={t.trustTitle} description={t.trustHint}>
        <div className="space-y-3">
          {fromRewards && <p className="rounded-[0.5rem] bg-paper px-3 py-2 text-xs text-ink-soft">{t.trustMoved}</p>}
          <ol className="space-y-3">
            {draft.trust.map((item, index) => (
              <li key={item.key} className="space-y-2 rounded-xl p-3 ring-1 ring-line">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label={t.trustAr} error={errorOf(index)}>
                    {(aria) => <Input {...aria} dir="rtl" lang="ar" value={item.ar} placeholder={t.trustPlaceholderAr} maxLength={CART_SHEET_TRUST_TEXT_MAX} disabled={locked} onChange={(e) => setTrust(item.key, { ar: e.target.value })} className="min-h-11" />}
                  </Field>
                  <Field label={t.trustEn}>
                    {(aria) => <Input {...aria} dir="ltr" lang="en" value={item.en} placeholder={t.trustPlaceholderEn} maxLength={CART_SHEET_TRUST_TEXT_MAX} disabled={locked} onChange={(e) => setTrust(item.key, { en: e.target.value })} className="min-h-11" />}
                  </Field>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <ToggleRow label={fmt(t.trustOn, { n: index + 1 })} checked={item.enabled} disabled={locked} onChange={(enabled) => setTrust(item.key, { enabled })} />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11 text-ink-soft hover:text-danger"
                    aria-label={fmt(t.trustRemove, { n: index + 1 })}
                    disabled={locked}
                    onClick={() => setDraft((prev) => ({ ...prev, trust: prev.trust.filter((x) => x.key !== item.key) }))}
                  >
                    <IconDelete className="size-4" aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={locked || draft.trust.length >= CART_SHEET_MAX_TRUST_ITEMS}
              onClick={() => setDraft((prev) => ({ ...prev, trust: [...prev.trust, ...trustDraftsOf([{ text: { ar: "", en: "" }, enabled: true }])] }))}
            >
              <IconPlus className="size-4" aria-hidden />
              {t.trustAdd}
            </Button>
            <span className="text-xs text-ink-soft">{fmt(t.trustMax, { max: CART_SHEET_MAX_TRUST_ITEMS })}</span>
          </div>
        </div>
      </Section>

      <CartSheetPreview settings={draft} trust={draft.trust} />

      <SettingsFormFooter editable={editable} dirty={editor.dirty} saving={saving} error={editor.error ?? (showErrors && Object.keys(errors).length > 0 ? t.fix : null)} onSave={save} onReset={editor.reset} />
    </div>
  );
}

function CartTabSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-3 rounded-[var(--radius-card)] border border-line p-4">
          <SkeletonBar className="h-4 w-40" />
          <SkeletonBar className="h-10 w-full" />
          <SkeletonBar className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

const SHOPPER_TEXT = {
  ar: { title: "سلة المشتريات", item: "قميص كتان", complete: "كمّل الطلب" },
  en: { title: "Shopping cart", item: "Linen shirt", complete: "Complete order" },
};

/**
 * The cart sheet in miniature, on a phone and on a computer, opening the way
 * the merchant chose and at their speed (none: at once). "Play again" opens it
 * again. In either language; the side drawer mirrors with it, as in the store.
 */
export function CartSheetPreview({ settings, trust = [] }: { settings: Omit<CartSheetSettings, "trustItems">; trust?: readonly TrustDraft[] }) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const [lang, setLang] = useState<"ar" | "en">(locale === "ar" ? "ar" : "en");
  const [run, setRun] = useState(0);
  const text = SHOPPER_TEXT[lang];
  const other = lang === "ar" ? "en" : "ar";
  const firstLine = trust.filter((item) => item.enabled).map((item) => (item[lang] || item[other]).trim()).find(Boolean) ?? null;
  return (
    <Section
      title={t.preview}
      description={t.previewHint}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Segmented value={lang} onChange={setLang} label={t.previewLanguage} size="sm" options={[{ value: "ar", label: "العربية" }, { value: "en", label: "English" }]} />
          <Button variant="outline" size="sm" className="min-h-11" disabled={!settings.enabled} onClick={() => setRun((n) => n + 1)}>
            {t.replay}
          </Button>
        </div>
      }
    >
      {!settings.enabled ? (
        <p className="text-sm text-ink-soft">{t.offPreview}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]" dir={lang === "ar" ? "rtl" : "ltr"} lang={lang}>
          {/* Drawn again (closed, then opening) whenever the choice or "Play again" changes. */}
          <MiniScreen key={`phone-${run}-${settings.presentation}-${settings.speed}`} wide={false} label={t.phone} settings={settings} text={text} trustLine={firstLine} />
          <MiniScreen key={`computer-${run}-${settings.presentation}-${settings.speed}`} wide label={t.computer} settings={settings} text={text} trustLine={firstLine} />
        </div>
      )}
    </Section>
  );
}

function MiniScreen({ wide, label, settings, text, trustLine }: { wide: boolean; label: string; settings: Omit<CartSheetSettings, "trustItems">; text: (typeof SHOPPER_TEXT)["en"]; trustLine: string | null }) {
  const variant = settings.presentation === "auto" ? (wide ? "side_drawer" : "bottom_sheet") : settings.presentation;
  const ms = CART_SHEET_DURATION_MS[settings.speed];
  // Mounted closed, opened a moment later so the slide shows (at once for "none").
  const [open, setOpen] = useState(ms === 0);
  useEffect(() => {
    if (ms === 0) return;
    const timer = window.setTimeout(() => setOpen(true), 120);
    return () => window.clearTimeout(timer);
  }, [ms]);
  const panel: Record<CartSheetPresentation, string> = {
    auto: "",
    bottom_sheet: cn("inset-x-0 bottom-0 h-[62%] rounded-t-xl", wide && "inset-x-[22%]", open ? "translate-y-0" : "translate-y-full"),
    // The inline end, mirrored with the language, as in the store.
    side_drawer: cn("inset-y-0 end-0 w-[78%]", wide && "w-[38%]", open ? "translate-x-0" : "translate-x-full rtl:-translate-x-full"),
    popup: cn("inset-x-[12%] top-1/2 h-[56%] -translate-y-1/2 rounded-lg", wide && "inset-x-[30%]", open ? "scale-100 opacity-100" : "scale-95 opacity-0"),
  };
  return (
    <figure className="min-w-0">
      <div
        data-preview-screen={wide ? "computer" : "phone"}
        data-preview-variant={variant}
        className={cn("relative overflow-hidden rounded-xl border border-line bg-paper", wide ? "aspect-[16/10]" : "mx-auto aspect-[9/16] w-36")}
      >
        {/* The page under it. */}
        <div className="space-y-2 p-3" aria-hidden="true">
          <div className="h-2.5 w-1/2 rounded bg-line" />
          <div className="h-16 rounded bg-line/70" />
          <div className="h-2 w-3/4 rounded bg-line" />
        </div>
        <div className={cn("absolute inset-0 bg-black/30 transition-opacity motion-reduce:transition-none", open ? "opacity-100" : "opacity-0")} style={{ transitionDuration: `${ms}ms` }} aria-hidden="true" />
        <div
          data-preview-panel=""
          className={cn("absolute flex flex-col gap-1.5 bg-paper-raised p-2 shadow-lg transition-[transform,opacity] ease-out motion-reduce:transition-none", panel[variant])}
          style={{ transitionDuration: `${ms}ms` }}
        >
          <span className="text-[10px] font-semibold text-ink">{text.title}</span>
          <span className="flex items-center gap-1.5">
            <span className="size-5 shrink-0 rounded bg-line" />
            <span className="truncate text-[9px] text-ink-soft">{text.item}</span>
          </span>
          <span className="mt-auto rounded bg-primary px-1 py-0.5 text-center text-[9px] font-semibold text-primary-foreground">{text.complete}</span>
          {trustLine && <span className="truncate text-center text-[8px] text-ink-soft">✓ {trustLine}</span>}
        </div>
      </div>
      <figcaption className="mt-1 text-center text-xs text-ink-soft">{label}</figcaption>
    </figure>
  );
}
