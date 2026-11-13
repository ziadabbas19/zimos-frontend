import { useEffect, useState } from "react";
import { SkeletonBar, cn } from "@store-builder/ui";
import {
  CART_SHEET_DEFAULTS,
  CART_SHEET_DURATION_MS,
  cartSheetSave,
  cartSheetSettingsOf,
  type CartSheetPresentation,
  type CartSheetSettings,
  type CartSheetSpeed,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { Section } from "@/components/Section";
import { Segmented } from "@/components/Segmented";
import { Button } from "@store-builder/ui";
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
 *
 * Saved whole in workspace.settings.cart_sheet through the store settings'
 * PATCH (website.edit); the save drops the store's cached pages. A store that
 * never saved it has the defaults, which is what the form starts from.
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
    side_drawerHint: "Slides in along the side (the right, the start side in Arabic)",
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
    side_drawerHint: "ينزلق من الجانب (اليمين، وهو جانب البداية في العربية)",
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
    saved: "تم حفظ سلوك السلة.",
  },
} satisfies Messages;

const PRESENTATIONS: readonly CartSheetPresentation[] = ["auto", "bottom_sheet", "side_drawer", "popup"];
const SPEEDS: readonly CartSheetSpeed[] = ["fast", "normal", "none"];

/** The settings as stored, read safely (the defaults for a store that never saved them). */
const readCartSheet = (settings: Record<string, unknown>) => cartSheetSettingsOf(settings.cart_sheet);

export function CartTab() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const editor = useSettingsEditor<CartSheetSettings>(readCartSheet, (draft) => cartSheetSave(apiClient, workspaceId, draft), t.saved);
  const { draft, setDraft, editable, saving } = editor;
  const locked = !editable || saving;
  const off = !draft.enabled;
  const setOpenOn = (key: keyof CartSheetSettings["openOn"], value: boolean) => setDraft((prev) => ({ ...prev, openOn: { ...prev.openOn, [key]: value } }));
  const neverChosen = JSON.stringify(editor.saved) === JSON.stringify(CART_SHEET_DEFAULTS);

  return (
    <DataState loading={!editor.ready} error={null} skeleton={<CartTabSkeleton />}>
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

        <CartSheetPreview settings={draft} />

        <SettingsFormFooter editable={editable} dirty={editor.dirty} saving={saving} error={editor.error} onSave={() => void editor.save()} onReset={editor.reset} />
      </div>
    </DataState>
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
 * again. In either language; the side drawer sits on the right either way.
 */
export function CartSheetPreview({ settings }: { settings: CartSheetSettings }) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const [lang, setLang] = useState<"ar" | "en">(locale === "ar" ? "ar" : "en");
  const [run, setRun] = useState(0);
  const text = SHOPPER_TEXT[lang];
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
          <MiniScreen key={`phone-${run}-${settings.presentation}-${settings.speed}`} wide={false} label={t.phone} settings={settings} text={text} />
          <MiniScreen key={`computer-${run}-${settings.presentation}-${settings.speed}`} wide label={t.computer} settings={settings} text={text} />
        </div>
      )}
    </Section>
  );
}

function MiniScreen({ wide, label, settings, text }: { wide: boolean; label: string; settings: CartSheetSettings; text: (typeof SHOPPER_TEXT)["en"] }) {
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
    side_drawer: cn("inset-y-0 right-0 w-[78%]", wide && "w-[38%]", open ? "translate-x-0" : "translate-x-full"),
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
        </div>
      </div>
      <figcaption className="mt-1 text-center text-xs text-ink-soft">{label}</figcaption>
    </figure>
  );
}
