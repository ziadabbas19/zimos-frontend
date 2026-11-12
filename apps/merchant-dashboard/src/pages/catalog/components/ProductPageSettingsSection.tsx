import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Alert, Button, Card, CardContent, Input, Label } from "@store-builder/ui";
import {
  catalogUpdateProduct,
  resolveProductPageSettings,
  type CatalogProduct,
  type ProductExternalRef,
  type ProductPageSettings,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { TextField } from "@/components/Field";
import { LandingPagePicker } from "./LandingPagePicker";
import { FontPairField } from "@/components/fonts/FontPairField";
import { useEditorFonts } from "@/lib/editorFonts";

/**
 * How the product's storefront page behaves (SPEC §7.3) plus the three small
 * product fields that go with it: display priority, the special-offer line
 * above the buy button, and the product's code on outside platforms.
 */

const STRINGS = {
  en: {
    title: "Product page",
    description: "How this product's page looks and sells in your store.",
    priority: "Display priority",
    priorityHint: "Higher numbers come first in listings. 0 is the default.",
    specialOffer: "Special offer line",
    specialOfferHint: "A short line shown above the buy button, e.g. “Free gift with every order”.",
    buyNowText: "Buy button text",
    buyNowTextHint: "Up to 40 characters. Leave blank for the store's default.",
    selling: "Buying",
    display: "Display",
    inline_checkout: "Order form inside the product page",
    inline_checkout_hint: "The shopper orders without leaving the page — the best setup for cash on delivery.",
    checkout_before_description: "Order form above the description",
    checkout_before_description_hint: "Off: the description is shown first, then the form.",
    skip_cart: "Buy now goes straight to checkout",
    skip_cart_hint: "Used when the order form is not inside the page: skips the cart.",
    sticky_buy_button: "Sticky buy button on mobile",
    sticky_buy_button_hint: "A fixed button at the bottom of the screen while the shopper scrolls.",
    hide_quantity_selector: "Hide the quantity selector",
    hide_quantity_selector_hint: "Every order is for one piece (or one bundle).",
    reviews_enabled: "Show reviews",
    reviews_enabled_hint: "Approved reviews and the review form on the product page.",
    hide_header: "Hide the store header",
    hide_header_hint: "A landing page with no menu, so the shopper stays on the product.",
    auto_select_variant: "Choose the first option for the shopper",
    auto_select_variant_hint: "Off: the shopper picks size, colour… before ordering.",
    hide_related_products: "Hide similar products",
    hide_related_products_hint: "Nothing else is suggested under this product.",
    hidden: "Hidden from the store",
    hidden_hint: "Not shown in listings or search; opens only through its link.",
    countdown: "Offer countdown",
    countdownHint:
      "A real deadline. When it passes, the timer disappears and the product sells at its compare-at price. Leave blank for no countdown.",
    countdownClear: "Remove countdown",
    countdownPast: "This deadline has passed: the product now sells at its compare-at price.",
    external: "External platforms",
    externalHint: "This product's code on a supplier or marketplace (Taager, Angazny…). For your own reference and integrations.",
    platform: "Platform",
    code: "Product code there",
    addRef: "Add platform",
    removeRef: "Remove",
    refIncomplete: "Fill in both the platform and the code, or remove the row.",
    save: "Save page settings",
    saving: "Saving…",
    saved: "Page settings saved.",
    discard: "Discard changes",
    font: "Font on this product's page",
    fontHint: "Its own Arabic and English fonts. Store default uses the product fonts from Store settings → Fonts.",
  },
  ar: {
    title: "صفحة المنتج",
    description: "شكل صفحة المنتج في متجرك وطريقة البيع منها.",
    priority: "أولوية الظهور",
    priorityHint: "الرقم الأعلى يظهر أولًا في القوائم. الافتراضي 0.",
    specialOffer: "سطر العرض الخاص",
    specialOfferHint: "سطر قصير يظهر فوق زر الشراء، مثل «هدية مجانية مع كل أوردر».",
    buyNowText: "نص زر الشراء",
    buyNowTextHint: "حتى 40 حرفًا. اتركه فارغًا لاستخدام النص الافتراضي.",
    selling: "الشراء",
    display: "العرض",
    inline_checkout: "فورم الطلب داخل صفحة المنتج",
    inline_checkout_hint: "العميل يطلب من غير ما يخرج من الصفحة — أفضل إعداد للدفع عند الاستلام.",
    checkout_before_description: "فورم الطلب فوق الوصف",
    checkout_before_description_hint: "عند الإيقاف: يظهر الوصف أولًا ثم الفورم.",
    skip_cart: "زر «اشترِ الآن» يذهب للدفع مباشرة",
    skip_cart_hint: "يُستخدم عندما لا يكون الفورم داخل الصفحة: يتخطى السلة.",
    sticky_buy_button: "زر شراء ثابت على الموبايل",
    sticky_buy_button_hint: "زر ثابت أسفل الشاشة أثناء التمرير.",
    hide_quantity_selector: "إخفاء اختيار الكمية",
    hide_quantity_selector_hint: "كل أوردر بقطعة واحدة (أو باقة واحدة).",
    reviews_enabled: "إظهار التقييمات",
    reviews_enabled_hint: "التقييمات المعتمدة وفورم إضافة تقييم في صفحة المنتج.",
    hide_header: "إخفاء هيدر المتجر",
    hide_header_hint: "صفحة هبوط بدون قائمة، ليبقى العميل مع المنتج.",
    auto_select_variant: "اختيار أول نوع تلقائيًا",
    auto_select_variant_hint: "عند الإيقاف: العميل يختار المقاس واللون… قبل الطلب.",
    hide_related_products: "إخفاء المنتجات المشابهة",
    hide_related_products_hint: "لا تُقترح منتجات أخرى أسفل هذا المنتج.",
    hidden: "مخفي من المتجر",
    hidden_hint: "لا يظهر في القوائم أو البحث؛ يفتح من رابطه فقط.",
    countdown: "عدّاد العرض",
    countdownHint:
      "موعد حقيقي. بعد انتهائه يختفي العدّاد ويُباع المنتج بالسعر قبل الخصم. اتركه فارغًا لعدم عرض عدّاد.",
    countdownClear: "حذف العدّاد",
    countdownPast: "انتهى هذا الموعد: المنتج يُباع الآن بالسعر قبل الخصم.",
    external: "المنصات الخارجية",
    externalHint: "كود المنتج عند المورّد أو المنصة (تاجر، أنجزني…). للمرجعية والتكاملات.",
    platform: "المنصة",
    code: "كود المنتج هناك",
    addRef: "إضافة منصة",
    removeRef: "حذف",
    refIncomplete: "اكتب المنصة والكود معًا، أو احذف السطر.",
    save: "حفظ إعدادات الصفحة",
    saving: "جارٍ الحفظ…",
    saved: "تم حفظ إعدادات الصفحة.",
    discard: "تجاهل التغييرات",
    font: "خط صفحة هذا المنتج",
    fontHint: "خط عربي وإنجليزي خاص بالمنتج. الافتراضي يستخدم خطوط المنتجات من الإعدادات ← خطوط المتجر.",
  },
} satisfies Messages;

type ToggleKey =
  | "auto_select_variant"
  | "inline_checkout"
  | "checkout_before_description"
  | "skip_cart"
  | "sticky_buy_button"
  | "hide_quantity_selector"
  | "reviews_enabled"
  | "hide_header"
  | "hide_related_products"
  | "hidden";

const SELLING: ToggleKey[] = [
  "auto_select_variant",
  "inline_checkout",
  "checkout_before_description",
  "skip_cart",
  "sticky_buy_button",
  "hide_quantity_selector",
];
const DISPLAY: ToggleKey[] = ["reviews_enabled", "hide_header", "hide_related_products", "hidden"];

interface Draft {
  priority: string;
  specialOfferText: string;
  settings: ProductPageSettings;
  /** datetime-local value in the browser's zone, "" for none. */
  countdown: string;
  refs: ProductExternalRef[];
}

function toLocalInput(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function draftOf(product: CatalogProduct): Draft {
  const settings = resolveProductPageSettings(product.pageSettings);
  return {
    priority: String(product.priority ?? 0),
    specialOfferText: product.specialOfferText ?? "",
    settings,
    countdown: toLocalInput(settings.countdown?.ends_at),
    refs: product.externalRefs ?? [],
  };
}

export function ProductPageSettingsSection({ product, onChanged }: { product: CatalogProduct; onChanged: () => void }) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  // The store's saved fonts: what this product's page shows with no font of its own.
  const storeFonts = useEditorFonts();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [saved, setSaved] = useState(() => draftOf(product));
  const [draft, setDraft] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const setSetting = <K extends keyof ProductPageSettings>(key: K, value: ProductPageSettings[K]) =>
    setDraft((d) => ({ ...d, settings: { ...d.settings, [key]: value } }));
  const countdownPast = draft.countdown !== "" && new Date(draft.countdown).getTime() <= Date.now();

  async function save() {
    const refs = draft.refs.map((r) => ({ platform: r.platform.trim(), code: r.code.trim() }));
    if (refs.some((r) => !r.platform || !r.code)) {
      setError(t.refIncomplete);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const priority = Number.parseInt(draft.priority, 10);
      const updated = await catalogUpdateProduct(apiClient, workspaceId, product.id, {
        priority: Number.isFinite(priority) ? priority : 0,
        specialOfferText: draft.specialOfferText.trim() || null,
        externalRefs: refs,
        pageSettings: {
          ...draft.settings,
          buy_now_text: draft.settings.buy_now_text?.trim() || null,
          countdown: draft.countdown ? { ends_at: new Date(draft.countdown).toISOString() } : null,
        },
      });
      const next = draftOf(updated);
      setSaved(next);
      setDraft(next);
      toast.success(t.saved);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const toggle = (key: ToggleKey) => (
    <label key={key} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[0.5rem] px-2 py-2 hover:bg-paper">
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 accent-primary"
        checked={draft.settings[key]}
        disabled={busy}
        onChange={(e) => setSetting(key, e.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{t[key]}</span>
        <span className="block text-xs text-ink-soft">{t[`${key}_hint`]}</span>
      </span>
    </label>
  );

  return (
    <Card>
      <CardContent className="space-y-5 py-5">
        <div>
          <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
          <p className="mt-1 text-sm text-ink-soft">{t.description}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t.specialOffer}
            hint={t.specialOfferHint}
            maxLength={200}
            value={draft.specialOfferText}
            disabled={busy}
            onChange={(e) => setDraft((d) => ({ ...d, specialOfferText: e.target.value }))}
          />
          <TextField
            label={t.buyNowText}
            hint={t.buyNowTextHint}
            maxLength={40}
            value={draft.settings.buy_now_text ?? ""}
            disabled={busy}
            onChange={(e) => setSetting("buy_now_text", e.target.value)}
          />
          <TextField
            label={t.priority}
            hint={t.priorityHint}
            type="number"
            inputMode="numeric"
            step={1}
            value={draft.priority}
            disabled={busy}
            onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value }))}
          />
          <div className="space-y-1.5">
            <Label htmlFor="product-countdown">{t.countdown}</Label>
            <div className="flex items-center gap-2">
              <Input
                id="product-countdown"
                type="datetime-local"
                dir="ltr"
                value={draft.countdown}
                disabled={busy}
                onChange={(e) => setDraft((d) => ({ ...d, countdown: e.target.value }))}
              />
              {draft.countdown && (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-10 shrink-0"
                  disabled={busy}
                  onClick={() => setDraft((d) => ({ ...d, countdown: "" }))}
                >
                  {t.countdownClear}
                </Button>
              )}
            </div>
            <p className={`text-xs ${countdownPast ? "font-medium text-accent-dark" : "text-ink-soft"}`}>
              {countdownPast ? t.countdownPast : t.countdownHint}
            </p>
          </div>
        </div>

        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <fieldset>
            <legend className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.selling}</legend>
            {SELLING.map(toggle)}
          </fieldset>
          <fieldset>
            <legend className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.display}</legend>
            {DISPLAY.map(toggle)}
          </fieldset>
        </div>

        <LandingPagePicker value={draft.settings.landing_page_id} disabled={busy} onChange={(pageId) => setSetting("landing_page_id", pageId)} />

        <div className="space-y-2 border-t border-line pt-4" data-slot="product-font">
          <div>
            <h3 className="text-sm font-semibold text-ink">{t.font}</h3>
            <p className="text-xs text-ink-soft">{t.fontHint}</p>
          </div>
          <div className="max-w-xl">
            <FontPairField
              value={draft.settings.font}
              onChange={(pair) => setSetting("font", pair)}
              locale={locale}
              level="product"
              inherits={[
                { level: "products", pair: storeFonts.store.products },
                { level: "store", pair: storeFonts.store.primary },
              ]}
              template={storeFonts.template}
              disabled={busy}
            />
          </div>
        </div>

        <div className="space-y-2 border-t border-line pt-4">
          <div>
            <h3 className="text-sm font-semibold text-ink">{t.external}</h3>
            <p className="text-xs text-ink-soft">{t.externalHint}</p>
          </div>
          {draft.refs.map((ref, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2">
              <Input
                aria-label={t.platform}
                placeholder={t.platform}
                maxLength={40}
                value={ref.platform}
                disabled={busy}
                className="min-w-0 flex-1"
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    refs: d.refs.map((r, i) => (i === index ? { ...r, platform: e.target.value } : r)),
                  }))
                }
              />
              <Input
                aria-label={t.code}
                placeholder={t.code}
                dir="ltr"
                maxLength={120}
                value={ref.code}
                disabled={busy}
                className="min-w-0 flex-1"
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    refs: d.refs.map((r, i) => (i === index ? { ...r, code: e.target.value } : r)),
                  }))
                }
              />
              <button
                type="button"
                aria-label={t.removeRef}
                disabled={busy}
                onClick={() => setDraft((d) => ({ ...d, refs: d.refs.filter((_, i) => i !== index) }))}
                className="inline-flex size-10 cursor-pointer items-center justify-center rounded-[0.5rem] text-ink-soft hover:bg-danger-soft hover:text-danger"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="min-h-10"
            disabled={busy || draft.refs.length >= 10}
            onClick={() => setDraft((d) => ({ ...d, refs: [...d.refs, { platform: "", code: "" }] }))}
          >
            <Plus className="size-4" aria-hidden />
            {t.addRef}
          </Button>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        {dirty && (
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => setDraft(saved)}>
              {t.discard}
            </Button>
            <Button type="button" className="min-h-11" disabled={busy} onClick={() => void save()}>
              {busy ? t.saving : t.save}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
