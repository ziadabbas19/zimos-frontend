import { useEffect, useMemo, useRef, useState } from "react";
import { Button, cn } from "@store-builder/ui";
import { FontPicker } from "@store-builder/ui/font-picker";
import {
  FONT_ROLES,
  fontSources,
  readFontPair,
  type FontLevel,
  type FontLevelPair,
  type FontPair,
  type FontRole,
  type ResolvedFontPair,
} from "@store-builder/ui/fonts";
import { useFontCatalog } from "@/lib/fontCatalog";
import { onFontFocus, takeFontFocus } from "./fontFocus";

/**
 * One part's own fonts — its Arabic face and its English face — each picked
 * from the store font catalog or left on default (null), plus one button that
 * puts both back. Used by the website and funnel editors (an element, a
 * section, the page, the header, the footer), the product page, and Store
 * settings → Fonts.
 *
 * Under each picker a "source" line says where the face the part shows comes
 * from: set here, inherited from a level above (`inherits`, nearest first —
 * the section, the page, the store), or the store's theme (or template) face
 * when no level picks one. An element, a section and the page "inherit"; the
 * store's own parts (header, footer, products, a product) fall back to the
 * "store default".
 *
 * `value` is what is saved (`{ ar, en }` ids); `onChange(null)` means the part
 * has no font of its own and the key should be dropped.
 */

type Locale = "en" | "ar";

const LEVEL_NAMES: Record<Locale, Record<FontLevel, string>> = {
  en: {
    element: "This element",
    section: "Section",
    page: "Page",
    store: "Store fonts",
    header: "Header",
    footer: "Footer",
    products: "Product font",
    product: "This product",
  },
  ar: {
    element: "هذا العنصر",
    section: "القسم",
    page: "الصفحة",
    store: "خطوط المتجر",
    header: "رأس الصفحة",
    footer: "تذييل الصفحة",
    products: "خط المنتجات",
    product: "هذا المنتج",
  },
};

const STRINGS = {
  en: {
    ar: "Arabic font",
    en: "English font",
    resetStore: "Use store default",
    resetInherit: "Use default (inherit)",
    inherited: "Inherited: {name}",
    theme: "Theme font",
    template: "Template font",
    source: "Source",
    ownFont: "set here",
  },
  ar: {
    ar: "الخط العربي",
    en: "الخط الإنجليزي",
    resetStore: "استخدام خط المتجر الافتراضي",
    resetInherit: "استخدام الافتراضي (وراثة)",
    inherited: "موروث: {name}",
    theme: "خط الثيم",
    template: "خط القالب",
    source: "المصدر",
    ownFont: "مضبوط هنا",
  },
};

/** The levels whose "no font" means "whatever the part sits in" rather than the store's default. */
const INHERITING: ReadonlySet<FontLevel> = new Set(["element", "section", "page"]);

export function FontPairField({
  value,
  onChange,
  locale,
  hint,
  level = "store",
  inherits,
  template = false,
  focusTarget,
  disabled = false,
}: {
  value: unknown;
  onChange: (next: ResolvedFontPair | null) => void;
  locale: Locale;
  hint?: string;
  /** The part this field sets. */
  level?: FontLevel;
  /** The levels the part falls back to, nearest first. Left out: no source line. */
  inherits?: FontLevelPair[];
  /** The store wears an imported template: with nothing picked anywhere, the template's faces show. */
  template?: boolean;
  /** The canvas's "Aa" for this part (fontFocus.ts): the field scrolls into view and takes the keyboard. */
  focusTarget?: string;
  disabled?: boolean;
}) {
  const t = STRINGS[locale];
  const names = LEVEL_NAMES[locale];
  const fonts = useFontCatalog();
  const byId = useMemo(() => new Map((fonts ?? []).map((f) => [f.id, f.family])), [fonts]);
  const pair: ResolvedFontPair = readFontPair(value) ?? { ar: null, en: null };
  const inherit = INHERITING.has(level);
  const set = (patch: FontPair) => {
    const next: ResolvedFontPair = { ar: patch.ar !== undefined ? (patch.ar ?? null) : pair.ar, en: patch.en !== undefined ? (patch.en ?? null) : pair.en };
    onChange(next.ar || next.en ? next : null);
  };

  // Where each script's face comes from: this part, a level above, or the theme.
  const above = useMemo(() => fontSources(inherits ?? []), [inherits]);
  const familyOf = (id: string) => byId.get(id) ?? id;

  // --- the canvas's "Aa" ---------------------------------------------------------
  const rootRef = useRef<HTMLDivElement>(null);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (!focusTarget) return;
    const reveal = () => {
      const root = rootRef.current;
      if (!root) return;
      root.scrollIntoView({ block: "center", behavior: "smooth" });
      root.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')?.focus({ preventScroll: true });
      setFlash(true);
    };
    if (takeFontFocus(focusTarget)) reveal();
    return onFontFocus((target) => {
      if (target === focusTarget && takeFontFocus(target)) reveal();
    });
  }, [focusTarget]);
  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(false), 1600);
    return () => window.clearTimeout(timer);
  }, [flash]);

  function sourceLine(role: FontRole) {
    if (!inherits) return null;
    const own = pair[role];
    const from = own ? { level, id: own } : above[role];
    const label = from ? names[from.level] : template ? t.template : t.theme;
    return (
      <p data-slot="font-source" data-level={from ? from.level : "theme"} data-own={own ? "" : undefined} className="flex min-w-0 items-center gap-1.5 text-xs leading-5 text-ink-soft">
        <span>{t.source}:</span>
        <span
          className={cn(
            "inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[11px] font-semibold",
            own ? "bg-primary-soft text-primary-dark dark:text-primary" : "bg-paper-sunken text-ink"
          )}
        >
          {label}
        </span>
        {from && (
          <span className="min-w-0 truncate" dir="ltr">
            {familyOf(from.id)}
          </span>
        )}
        {own && <span className="sr-only">({t.ownFont})</span>}
      </p>
    );
  }

  /** What the picker says for "no font of its own" here. */
  function defaults(role: FontRole): { defaultLabel?: string; defaultName?: string | null } {
    const from = above[role];
    if (inherit) return { defaultLabel: from ? t.inherited.replace("{name}", `${names[from.level]} · ${familyOf(from.id)}`) : template ? t.template : t.theme };
    return { defaultName: from ? familyOf(from.id) : null };
  }

  const resetLabel = inherit ? t.resetInherit : t.resetStore;

  return (
    <div
      ref={rootRef}
      className={cn("space-y-3 rounded-[0.75rem] transition-shadow", flash && "ring-2 ring-primary ring-offset-4 ring-offset-paper-raised")}
      data-slot="font-pair"
      data-level={level}
    >
      {hint && <p className="text-xs leading-5 text-ink-soft">{hint}</p>}
      {FONT_ROLES.map((role) => (
        <div key={role} className="space-y-1">
          <FontPicker
            fonts={fonts}
            role={role}
            value={pair[role]}
            onChange={(id) => set({ [role]: id })}
            locale={locale}
            label={t[role]}
            resetLabel={resetLabel}
            {...defaults(role)}
            disabled={disabled}
          />
          {sourceLine(role)}
        </div>
      ))}
      {(pair.ar || pair.en) && !disabled && (
        <Button type="button" variant="outline" size="sm" className="min-h-11 w-full whitespace-normal" onClick={() => onChange(null)}>
          {resetLabel}
        </Button>
      )}
    </div>
  );
}
