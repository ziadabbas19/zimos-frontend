import { cn } from "@store-builder/ui";
import { useEditorLocale } from "../editorLocale";
import { FONT_OPTIONS, type StoreLook } from "../storeLook";
import { LookCheck, lookCardClass } from "./parts";
import { lookUi } from "./themeLocale";

/** What every card writes in its heading face. */
const FONT_SPECIMEN = "Aa أب";

/**
 * The original look's type as a list of pairings, each drawn in its own
 * face. A pairing is the look's `fontFamily`, the one setting the storefront
 * reads for it. On a theme the type comes with the theme, so the panel does
 * not draw this list there.
 */
export function FontPairList({
  look,
  onChange,
  variant = "panel",
}: {
  look: StoreLook;
  onChange: (next: StoreLook, historyKey?: string) => void;
  variant?: "panel" | "sheet";
}) {
  const ui = lookUi(useEditorLocale());
  return (
    <div
      role="radiogroup"
      aria-label={ui.font}
      className={cn("grid gap-2", variant === "sheet" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2")}
    >
      {FONT_OPTIONS.map((option) => {
        const active = look.fontFamily === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              if (!active) onChange({ ...look, fontFamily: option.value });
            }}
            className={cn(lookCardClass, "min-h-[4.25rem] px-3 py-2.5")}
          >
            <span className="block truncate text-xl leading-tight text-ink" style={{ fontFamily: option.heading, fontWeight: 600 }}>
              {FONT_SPECIMEN}
            </span>
            <span className="mt-1 block truncate pe-5 text-xs text-ink-soft" style={{ fontFamily: option.body }}>
              {ui.fontName(option.value)}
            </span>
            {active && <LookCheck className="absolute end-2 bottom-2" />}
          </button>
        );
      })}
    </div>
  );
}
