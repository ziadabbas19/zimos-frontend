import { useId } from "react";
import { Check } from "lucide-react";
import { Input, Label, cn } from "@store-builder/ui";
import { BRAND_COLOR_PRESETS, normalizeHex } from "@/lib/brandColors";

/**
 * A colour swatch + native picker + hex text box + preset row, all bound to one
 * hex string. The text box accepts partial typing, so it stays uncontrolled-ish:
 * `onChange` only fires with a valid `#RRGGBB`, while the raw keystrokes live in
 * the parent's draft value.
 */
export function ColorField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const id = useId();
  const valid = normalizeHex(value);
  // Keep the native picker on the last valid colour — it cannot show a partial hex.
  const swatch = valid ?? "#000000";

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          aria-label={`${label} colour picker`}
          value={swatch}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="size-10 shrink-0 cursor-pointer rounded-[0.5rem] border border-line bg-paper-raised p-1"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => valid && onChange(valid)}
          spellCheck={false}
          aria-invalid={valid ? undefined : true}
          placeholder="#1F5D5B"
          className={cn("w-32 font-mono uppercase", !valid && "border-danger focus-visible:ring-danger/30")}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {BRAND_COLOR_PRESETS.map((preset) => {
          const active = valid === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              title={preset}
              aria-label={`Use ${preset}`}
              aria-pressed={active}
              className={cn(
                "flex size-7 items-center justify-center rounded-full border transition-transform hover:scale-110",
                active ? "border-ink" : "border-line"
              )}
              style={{ backgroundColor: preset }}
            >
              {active && <Check className="size-3.5 text-white drop-shadow" aria-hidden />}
            </button>
          );
        })}
      </div>

      {valid ? (
        hint && <p className="text-xs text-ink-soft">{hint}</p>
      ) : (
        <p className="text-xs font-medium text-danger">Enter a hex colour like #1F5D5B.</p>
      )}
    </div>
  );
}
