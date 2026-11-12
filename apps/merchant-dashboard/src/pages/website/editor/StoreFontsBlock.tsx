import { FontPicker } from "@store-builder/ui/font-picker";
import { readStoreFonts, storeFontsValue, type FontRole, type StoreFonts } from "@store-builder/ui/fonts";
import { Button } from "@store-builder/ui";
import { useFontCatalog } from "@/lib/fontCatalog";
import { useEditorFonts } from "@/lib/editorFonts";
import { useEditorLocale } from "./editorLocale";
import { LookBlock } from "./theme/parts";
import type { StoreLook } from "./storeLook";

const STRINGS = {
  en: {
    title: "Store fonts",
    hint: "One font for Arabic text and one for English text, across the whole store. Default keeps the theme's fonts. A page, a section or an element can have its own (Style → Font).",
    template: "One font for Arabic text and one for English text, across the whole store — the template's bands, header and footer too. Default keeps the template's fonts.",
    ar: "Arabic font",
    en: "English font",
    pageFont: "This page's font…",
  },
  ar: {
    title: "خطوط المتجر",
    hint: "خط للنص العربي وخط للنص الإنجليزي في المتجر كله. الافتراضي بيحتفظ بخطوط الثيم. الصفحة أو القسم أو العنصر ممكن يكون ليه خط خاص (التنسيق ← الخط).",
    template: "خط للنص العربي وخط للنص الإنجليزي في المتجر كله، وأقسام القالب ورأسه وتذييله كمان. الافتراضي بيحتفظ بخطوط القالب.",
    ar: "الخط العربي",
    en: "الخط الإنجليزي",
    pageFont: "خط هذه الصفحة…",
  },
} as const;

/** The look with the store's own face for one script (`themeSettings.fonts.primaryAr|En`) set, or dropped for null. */
function withPrimary(look: StoreLook, role: FontRole, id: string | null): StoreLook {
  const current: StoreFonts = readStoreFonts({ fonts: look.fonts });
  const next = storeFontsValue({ ...current, primary: { ...current.primary, [role]: id } });
  // Keys a newer dashboard may have written stay (storeFontsValue knows only its own).
  const kept = { ...(look.fonts ?? {}) };
  delete kept.primaryAr;
  delete kept.primaryEn;
  const fonts = { ...kept, ...(next ?? {}) };
  const { fonts: _old, ...rest } = look;
  void _old;
  return Object.keys(fonts).length > 0 ? { ...rest, fonts } : rest;
}

/**
 * Store look → Store fonts: the store's Arabic and English faces, right in the
 * editor, so the canvas shows a pick at once (the frame draws the unsaved
 * fonts, storefront LiveStoreFonts) and it saves with the rest of the look.
 * The same value Settings → Store fonts edits (`themeSettings.fonts`).
 */
export function StoreFontsBlock({
  look,
  onChange,
  onEditPageFont,
}: {
  look: StoreLook;
  onChange: (next: StoreLook, historyKey?: string) => void;
  /** Opens Page settings → Font (the open page's own font). Left out: no button. */
  onEditPageFont?: () => void;
}) {
  const locale = useEditorLocale();
  const t = STRINGS[locale];
  const fonts = useFontCatalog();
  const { template } = useEditorFonts();
  const primary = readStoreFonts({ fonts: look.fonts }).primary;
  return (
    <LookBlock title={t.title} hint={template ? t.template : t.hint}>
      <div className="space-y-3" data-slot="store-fonts-block">
        {(["ar", "en"] as const).map((role) => (
          <FontPicker
            key={role}
            fonts={fonts}
            role={role}
            value={primary[role]}
            onChange={(id) => onChange(withPrimary(look, role, id), `look:font:${role}`)}
            locale={locale}
            label={t[role]}
          />
        ))}
        {onEditPageFont && (
          <Button type="button" variant="outline" size="sm" className="min-h-11 w-full" onClick={onEditPageFont}>
            {t.pageFont}
          </Button>
        )}
      </div>
    </LookBlock>
  );
}
