import { useRef, useState } from "react";
import { cn } from "@store-builder/ui";
import { IconCaretLeft, IconCaretRight, IconUndo } from "@/components/icons";
import { useThemeFonts } from "@/lib/themeFonts";
import { useEditorLocale } from "../editorLocale";
import { FONT_OPTIONS, type StoreLook } from "../storeLook";
import type { ColorMode } from "../storeThemes";
import { ThemeSketch } from "../ThemeSketch";
import { LookCheck, lookCardClass, lookIconButtonClass } from "./parts";
import { THEME_PRESETS, applyThemePreset, matchesThemePreset, type ThemePreset } from "./presets";
import { useThemeCatalog } from "./themeCatalog";
import { themeUi } from "./themeLocale";

/** The shelf's two arrows: small raised discs over its ends, drawn only for a mouse. */
const NUDGE =
  "zimos-look-nudge absolute top-[calc(50%-0.5rem)] hidden size-8 -translate-y-1/2 bg-paper-raised text-ink " +
  "shadow-[var(--shadow-raised)] ring-1 ring-line hover:bg-paper-raised pointer-fine:flex";

/**
 * The ready styles as a shelf: one line of cards that scrolls sideways and
 * snaps, each a small drawing of a store in that style's own theme, colours,
 * corners and type, with its name. Pressing one lays the whole style over the
 * look in ONE `onChange` — one undo step, one preview update — and a line
 * under the shelf offers to take it back.
 *
 * Self-contained (it takes a look and hands back the next one), so the
 * editor's theme panel and the first-run "brand it" step use the same shelf.
 * A style whose theme this store cannot use (a paid theme it does not own) is
 * left off the shelf.
 */
export function ThemePresetRow({
  look,
  onChange,
  onPick,
  storeName = "",
  previewMode = "light",
  variant = "panel",
  className,
}: {
  look: StoreLook;
  /** The look with the chosen style laid over it. No history key: a style is one step. */
  onChange: (next: StoreLook, historyKey?: string) => void;
  /** Told which style was pressed, after `onChange`. */
  onPick?: (preset: ThemePreset) => void;
  /** The specimen in each drawing; the style's own name when empty. */
  storeName?: string;
  /** The mode the drawings are in — the one the preview shows. */
  previewMode?: ColorMode;
  /** `sheet`: wider cards for a thumb, in a phone bottom sheet. */
  variant?: "panel" | "sheet";
  className?: string;
}) {
  const locale = useEditorLocale();
  const t = themeUi(locale);
  const catalog = useThemeCatalog();
  const rail = useRef<HTMLDivElement>(null);
  const [applied, setApplied] = useState<{ key: string; before: StoreLook } | null>(null);
  useThemeFonts();

  const presets = THEME_PRESETS.filter(
    (preset) => catalog.offered(preset.storeTheme, look.storeTheme) && !catalog.locked(preset.storeTheme)
  );
  // The offer to undo stands only while the look is still that style, untouched.
  const lastApplied = applied ? presets.find((preset) => preset.key === applied.key) : undefined;
  const undo = applied && lastApplied && matchesThemePreset(look, lastApplied) ? applied : null;

  function apply(preset: ThemePreset) {
    if (matchesThemePreset(look, preset)) return;
    setApplied({ key: preset.key, before: look });
    onChange(applyThemePreset(look, preset));
    onPick?.(preset);
  }

  /** The shelf's arrows, for a mouse: most of a screenful along the reading direction. */
  function page(direction: 1 | -1) {
    const node = rail.current;
    if (!node) return;
    const rtl = window.getComputedStyle(node).direction === "rtl";
    const still =
      typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollBy({
      left: direction * (rtl ? -1 : 1) * node.clientWidth * 0.8,
      behavior: still ? "auto" : "smooth",
    });
  }

  return (
    <div data-slot="theme-presets" data-variant={variant} className={cn("space-y-2", className)}>
      <div className="relative">
        <div
          ref={rail}
          role="group"
          aria-label={t.presets}
          className={cn(
            "flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain pt-1 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "-mx-[var(--look-bleed,0px)] scroll-px-[var(--look-bleed,0px)] px-[var(--look-bleed,0px)]"
          )}
        >
          {presets.map((preset) => {
            const active = matchesThemePreset(look, preset);
            const name = preset.name[locale];
            const font = preset.fontFamily
              ? FONT_OPTIONS.find((option) => option.value === preset.fontFamily)
              : undefined;
            return (
              <button
                key={preset.key}
                type="button"
                aria-pressed={active}
                aria-label={t.presetUse(name)}
                title={preset.note[locale]}
                onClick={() => apply(preset)}
                className={cn(lookCardClass, "shrink-0 snap-start", variant === "sheet" ? "w-[10.5rem]" : "w-32")}
              >
                <ThemeSketch
                  theme={preset.storeTheme}
                  mode={previewMode}
                  accent={previewMode === "light" ? preset.primaryColor : preset.primaryColorDark}
                  title={storeName || name}
                  corners={preset.cornerRadius}
                  secondary={preset.secondaryColor}
                  headingFont={font?.heading}
                />
                <span className="flex items-center gap-1.5 border-t border-line px-2.5 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] leading-tight font-semibold text-ink">{name}</span>
                    <span className="mt-0.5 block truncate text-[11px] leading-tight text-ink-soft">
                      {preset.note[locale]}
                    </span>
                  </span>
                  {active && <LookCheck />}
                </span>
              </button>
            );
          })}
        </div>

        {/* A mouse has no swipe: two quiet arrows over the shelf's ends. A finger swipes, so touch draws none. */}
        <button
          type="button"
          aria-label={t.presetsPrev}
          title={t.presetsPrev}
          onClick={() => page(-1)}
          className={cn(lookIconButtonClass, NUDGE, "-start-2")}
        >
          <IconCaretLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        </button>
        <button
          type="button"
          aria-label={t.presetsNext}
          title={t.presetsNext}
          onClick={() => page(1)}
          className={cn(lookIconButtonClass, NUDGE, "-end-2")}
        >
          <IconCaretRight className="size-4 rtl:-scale-x-100" aria-hidden />
        </button>
      </div>

      {undo && lastApplied && (
        <p aria-live="polite" className="flex min-h-8 items-center gap-2 text-xs text-ink-soft">
          <span className="min-w-0 flex-1 truncate">{t.presetApplied(lastApplied.name[locale])}</span>
          <button
            type="button"
            onClick={() => {
              onChange(undo.before);
              setApplied(null);
            }}
            className="inline-flex min-h-8 shrink-0 cursor-pointer items-center gap-1 rounded-full px-2.5 text-xs font-semibold text-primary transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] pointer-coarse:min-h-11 motion-reduce:transition-none"
          >
            <IconUndo className="size-3.5" aria-hidden />
            {t.presetUndo}
          </button>
        </p>
      )}
    </div>
  );
}
