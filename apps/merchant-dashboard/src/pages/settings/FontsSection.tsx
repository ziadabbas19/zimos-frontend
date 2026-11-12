import { useEffect, useMemo, useState } from "react";
import { Alert, Button } from "@store-builder/ui";
import { FontPicker, loadSampleFont, sampleStack } from "@store-builder/ui/font-picker";
import { readStoreFonts, storeFontsValue, type ResolvedFontPair, type StoreFonts } from "@store-builder/ui/fonts";
import { ApiError } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useFontCatalog } from "@/lib/fontCatalog";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { FontPairField } from "@/components/fonts/FontPairField";

/**
 * Store settings → Fonts: the store's Arabic and English faces, and the faces
 * of its header and its products, each from the store font catalog
 * (GET /fonts). Saved to `themeSettings.fonts` (@store-builder/ui/fonts);
 * "store default" everywhere means the store keeps the look it had.
 *
 * The sample under the pickers is drawn in the picked faces the way the
 * store draws them — English letters in the English pick, Arabic letters in
 * the Arabic pick — and only this sample: the dashboard's own type never
 * changes. Sections, elements and single products can have their own fonts
 * too (the website editor and the product page).
 */

const EDITOR_ROLES: ReadonlySet<string> = new Set(["owner", "workspace_manager", "editor"]);

const STRINGS = {
  en: {
    title: "Store fonts",
    description:
      "Pick one font for Arabic text and one for English text. Mixed lines use both: English words in the English font, Arabic words in the Arabic font.",
    primaryAr: "Arabic font",
    primaryEn: "English font",
    primaryHint: "Store default keeps your theme's own fonts.",
    sample: "How your store reads",
    sampleHeading: "New collection — تشكيلة جديدة",
    sampleAr: "اطلب الآن والدفع عند الاستلام. شحن سريع لكل المحافظات خلال ٢–٤ أيام.",
    sampleEn: "Order now and pay on delivery. Fast shipping to every city in 2–4 days.",
    sampleDefault: "Store default",
    header: "Header",
    headerHint: "The store name, the menu and the announcement bar. Store default uses the fonts above.",
    products: "Products",
    productsHint: "Product pages and product cards. A product can also have its own font, on its page settings.",
    template: "Your store wears an imported template: its own bands, header and footer keep the template's fonts (Website → Store look → Template look).",
    readOnly: "Only the store owner, a workspace manager or an editor can change the store fonts.",
    save: "Save fonts",
    saving: "Saving…",
    reset: "Discard changes",
    saved: "Store fonts saved.",
  },
  ar: {
    title: "خطوط المتجر",
    description: "اختر خطًا للنص العربي وخطًا للنص الإنجليزي. السطر المختلط يستخدم الاثنين: الكلمات الإنجليزية بالخط الإنجليزي والعربية بالخط العربي.",
    primaryAr: "الخط العربي",
    primaryEn: "الخط الإنجليزي",
    primaryHint: "الخط الافتراضي يُبقي خطوط الثيم كما هي.",
    sample: "شكل الكتابة في متجرك",
    sampleHeading: "تشكيلة جديدة — New collection",
    sampleAr: "اطلب الآن والدفع عند الاستلام. شحن سريع لكل المحافظات خلال ٢–٤ أيام.",
    sampleEn: "Order now and pay on delivery. Fast shipping to every city in 2–4 days.",
    sampleDefault: "خط المتجر الافتراضي",
    header: "رأس الصفحة",
    headerHint: "اسم المتجر والقائمة وشريط الإعلان. الافتراضي يستخدم الخطين بالأعلى.",
    products: "المنتجات",
    productsHint: "صفحات المنتجات وبطاقاتها. ويمكن لكل منتج أن يكون له خط خاص من إعدادات صفحته.",
    template: "متجرك يستخدم قالبًا مستوردًا: أقسام القالب ورأسه وتذييله تحتفظ بخطوط القالب (الموقع ← شكل المتجر ← شكل القالب).",
    readOnly: "يمكن لمالك المتجر أو مدير مساحة العمل أو المحرر فقط تغيير خطوط المتجر.",
    save: "حفظ الخطوط",
    saving: "جارٍ الحفظ…",
    reset: "تجاهل التغييرات",
    saved: "تم حفظ خطوط المتجر.",
  },
} satisfies Messages;

const same = (a: StoreFonts, b: StoreFonts) => JSON.stringify(storeFontsValue(a)) === JSON.stringify(storeFontsValue(b));

export function FontsSection() {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { currentWorkspace, applySavedWorkspace } = useWorkspace();
  const fonts = useFontCatalog();
  const byId = useMemo(() => new Map((fonts ?? []).map((f) => [f.id, f])), [fonts]);

  const stored = useMemo(() => readStoreFonts(currentWorkspace?.themeSettings), [currentWorkspace?.themeSettings]);
  const [saved, setSaved] = useState(stored);
  const [draft, setDraft] = useState(stored);
  const [forbidden, setForbidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editable = EDITOR_ROLES.has(currentWorkspace?.role ?? "") && !forbidden;
  const dirty = !same(draft, saved);
  const wearsTemplate = typeof currentWorkspace?.themeSettings?.xsLook === "string";

  // The sample's faces: only the picked ones, each for its own letters.
  useEffect(() => {
    for (const [role, id] of [
      ["ar", draft.primary.ar],
      ["en", draft.primary.en],
    ] as const) {
      const font = id ? byId.get(id) : undefined;
      if (font) void loadSampleFont(font, role);
    }
  }, [draft.primary.ar, draft.primary.en, byId]);

  const name = (id: string | null) => (id ? (byId.get(id)?.family ?? id) : null);
  const setPair = (key: "header" | "products", pair: ResolvedFontPair | null) => setDraft((d) => ({ ...d, [key]: pair ?? { ar: null, en: null } }));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const themeSettings: Record<string, unknown> = { ...(currentWorkspace?.themeSettings ?? {}) };
      const value = storeFontsValue(draft);
      if (value) themeSettings.fonts = value;
      else delete themeSettings.fonts;
      const workspace = await apiClient.updateWorkspace(workspaceId, { themeSettings });
      const next = readStoreFonts(workspace.themeSettings);
      setSaved(next);
      setDraft(next);
      applySavedWorkspace(workspace);
      toast.success(t.saved);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
        setDraft(saved);
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  const stack = sampleStack(draft.primary);
  const primaryName = { ar: name(draft.primary.ar) ?? undefined, en: name(draft.primary.en) ?? undefined };

  return (
    <section className="rounded-[var(--radius-card)] border border-line p-5" data-slot="store-fonts">
      <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t.description}</p>

      <div className="mt-4 space-y-6">
        {!editable && <Alert>{t.readOnly}</Alert>}
        {wearsTemplate && <Alert>{t.template}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <FontPicker
            fonts={fonts}
            role="ar"
            value={draft.primary.ar}
            onChange={(id) => setDraft((d) => ({ ...d, primary: { ...d.primary, ar: id } }))}
            locale={locale}
            label={t.primaryAr}
            hint={t.primaryHint}
            disabled={!editable || saving}
          />
          <FontPicker
            fonts={fonts}
            role="en"
            value={draft.primary.en}
            onChange={(id) => setDraft((d) => ({ ...d, primary: { ...d.primary, en: id } }))}
            locale={locale}
            label={t.primaryEn}
            hint={t.primaryHint}
            disabled={!editable || saving}
          />
        </div>

        <figure className="rounded-[0.75rem] bg-paper-sunken p-4" aria-label={t.sample}>
          <figcaption className="mb-2 text-xs font-medium text-ink-soft">
            {t.sample}
            {!draft.primary.ar && !draft.primary.en && ` · ${t.sampleDefault}`}
          </figcaption>
          <div style={{ fontFamily: stack }} data-slot="font-sample">
            <p className="text-xl font-bold text-ink" dir="auto">
              {t.sampleHeading}
            </p>
            <p className="mt-2 text-base leading-7 text-ink" dir="rtl" lang="ar">
              {t.sampleAr}
            </p>
            <p className="mt-1 text-base leading-7 text-ink" dir="ltr" lang="en">
              {t.sampleEn}
            </p>
          </div>
        </figure>

        <div className="grid gap-6 lg:grid-cols-2">
          <fieldset className="space-y-2" disabled={!editable || saving}>
            <legend className="text-sm font-semibold text-ink">{t.header}</legend>
            <FontPairField
              value={draft.header}
              onChange={(pair) => setPair("header", pair)}
              locale={locale}
              hint={t.headerHint}
              inheritedName={primaryName}
              disabled={!editable || saving}
            />
          </fieldset>
          <fieldset className="space-y-2" disabled={!editable || saving}>
            <legend className="text-sm font-semibold text-ink">{t.products}</legend>
            <FontPairField
              value={draft.products}
              onChange={(pair) => setPair("products", pair)}
              locale={locale}
              hint={t.productsHint}
              inheritedName={primaryName}
              disabled={!editable || saving}
            />
          </fieldset>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        {editable && (
          <div className="flex flex-wrap justify-end gap-2">
            {dirty && (
              <Button variant="outline" className="min-h-11" disabled={saving} onClick={() => setDraft(saved)}>
                {t.reset}
              </Button>
            )}
            <Button className="min-h-11" disabled={saving || !dirty} onClick={() => void save()}>
              {saving ? t.saving : t.save}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

