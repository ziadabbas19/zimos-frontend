import { Button } from "@store-builder/ui";
import { FontPicker } from "@store-builder/ui/font-picker";
import { readFontPair, type FontPair, type ResolvedFontPair } from "@store-builder/ui/fonts";
import { useFontCatalog } from "@/lib/fontCatalog";

/**
 * One part's own fonts — its Arabic face and its English face — each picked
 * from the store font catalog or left on "store default" (null), plus one
 * button that puts both back. Used by the website and funnel editors (an
 * element, a section, the header) and the product page; Store settings →
 * Fonts uses the same pickers for the store's own pair.
 *
 * `value` is what is saved (`{ ar, en }` ids); `onChange(null)` means the part
 * has no font of its own and the key should be dropped.
 */

const STRINGS = {
  en: {
    ar: "Arabic font",
    en: "English font",
    reset: "Use store default",
  },
  ar: {
    ar: "الخط العربي",
    en: "الخط الإنجليزي",
    reset: "استخدام خط المتجر الافتراضي",
  },
};

export function FontPairField({
  value,
  onChange,
  locale,
  hint,
  inheritedName,
  disabled = false,
}: {
  value: unknown;
  onChange: (next: ResolvedFontPair | null) => void;
  locale: "en" | "ar";
  hint?: string;
  /** What the part falls back to, per script ("the section's", a font name…); default: the store default. */
  inheritedName?: Partial<Record<"ar" | "en", string>>;
  disabled?: boolean;
}) {
  const t = STRINGS[locale];
  const fonts = useFontCatalog();
  const pair: ResolvedFontPair = readFontPair(value) ?? { ar: null, en: null };
  const set = (patch: FontPair) => {
    const next: ResolvedFontPair = { ar: patch.ar !== undefined ? (patch.ar ?? null) : pair.ar, en: patch.en !== undefined ? (patch.en ?? null) : pair.en };
    onChange(next.ar || next.en ? next : null);
  };

  return (
    <div className="space-y-3" data-slot="font-pair">
      {hint && <p className="text-xs leading-5 text-ink-soft">{hint}</p>}
      <FontPicker
        fonts={fonts}
        role="ar"
        value={pair.ar}
        onChange={(id) => set({ ar: id })}
        locale={locale}
        label={t.ar}
        defaultName={inheritedName?.ar ?? null}
        disabled={disabled}
      />
      <FontPicker
        fonts={fonts}
        role="en"
        value={pair.en}
        onChange={(id) => set({ en: id })}
        locale={locale}
        label={t.en}
        defaultName={inheritedName?.en ?? null}
        disabled={disabled}
      />
      {(pair.ar || pair.en) && !disabled && (
        <Button type="button" variant="outline" size="sm" className="min-h-11 w-full" onClick={() => onChange(null)}>
          {t.reset}
        </Button>
      )}
    </div>
  );
}
