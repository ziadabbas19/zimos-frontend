import { storeLevel, type ResolvedFontPair } from "@store-builder/ui/fonts";
import { FontPairField } from "@/components/fonts/FontPairField";
import { fontTarget } from "@/components/fonts/fontFocus";
import { useEditorFonts } from "@/lib/editorFonts";
import { useEditorLocale } from "./editorLocale";

const STRINGS = {
  en: {
    hint: "Arabic and English fonts for this whole page: every section and element on it that has no font of its own. Left on default, the page uses the store's fonts.",
  },
  ar: {
    hint: "الخط العربي والإنجليزي للصفحة كلها: كل قسم وعنصر فيها مالوش خط خاص بيه. على الافتراضي، الصفحة بتستخدم خطوط المتجر.",
  },
} as const;

/**
 * The whole page's own font (`tree.font`, under its sections' and elements'):
 * Page settings → Font in the website and funnel editors. The storefront draws
 * it on the page's sections (page-renderer/fonts.ts); the change shows on the
 * canvas at once, with the page's next render.
 */
export function PageFontField({ value, onChange }: { value: unknown; onChange: (pair: ResolvedFontPair | null) => void }) {
  const locale = useEditorLocale();
  const fonts = useEditorFonts();
  return (
    <FontPairField
      value={value}
      onChange={onChange}
      locale={locale}
      hint={STRINGS[locale].hint}
      level="page"
      inherits={[storeLevel(fonts.store)]}
      template={fonts.template}
      focusTarget={fontTarget.page}
    />
  );
}
