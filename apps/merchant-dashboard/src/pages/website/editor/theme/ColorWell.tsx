import { useId, useState, type ReactNode } from "react";
import { Input, cn } from "@store-builder/ui";
import { IconCheck, IconTheme } from "@/components/icons";
import { normalizeHex } from "@/lib/brandColors";
import { labelOn } from "@/lib/contrast";
import { useEditorLocale } from "../editorLocale";
import { lookIconButtonClass } from "./parts";
import { themeUi } from "./themeLocale";

/**
 * One colour on one line: its name, the code to type, and a round well that
 * opens the device's colour picker. A row of ready colours unfolds under it
 * from the palette button, so a panel of several colours stays short.
 *
 * Only a complete colour reaches `onChange` (and the live preview): the
 * half-typed code is kept here until it is one. `value` null means "not set" —
 * the well then shows `fallback`, the colour the store paints with meanwhile.
 */
export function ColorWell({
  label,
  icon,
  hint,
  value,
  fallback,
  onChange,
  swatches,
  swatchesOpen = false,
  children,
}: {
  label: string;
  /** Before the label: a sun or a moon for a per-mode colour. */
  icon?: ReactNode;
  hint?: string;
  value: string | null;
  fallback: string;
  onChange: (hex: string) => void;
  /** Ready colours, offered from the palette button at the end of the row. */
  swatches?: readonly string[];
  /** Start with the ready colours showing. */
  swatchesOpen?: boolean;
  /** Under the hint: a link to reset, a contrast note. */
  children?: ReactNode;
}) {
  const t = themeUi(useEditorLocale());
  const id = useId();
  const swatchesId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [open, setOpen] = useState(swatchesOpen);

  const shown = draft ?? value ?? fallback;
  const valid = normalizeHex(shown);
  // The native picker cannot show a half-typed code: it stays on the last whole colour.
  const well = valid ?? normalizeHex(value ?? fallback) ?? "#000000";

  function type(raw: string) {
    const hex = normalizeHex(raw);
    if (hex && raw.replace(/^#/, "").trim().length === 6) {
      setDraft(null);
      onChange(hex);
    } else {
      setDraft(raw);
    }
  }

  function pick(hex: string) {
    setDraft(null);
    onChange(hex);
  }

  return (
    <div data-slot="color-well" className="space-y-1.5">
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-medium text-ink">
          {icon}
          <span className="min-w-0 truncate">{label}</span>
        </label>
        <Input
          value={shown}
          onChange={(e) => type(e.target.value)}
          onBlur={() => {
            // Leaving the box settles it: a whole colour (a short "#abc" too) is taken, anything else is dropped.
            if (draft === null) return;
            const hex = normalizeHex(draft);
            setDraft(null);
            if (hex) onChange(hex);
          }}
          spellCheck={false}
          dir="ltr"
          aria-label={t.colorCode(label)}
          aria-invalid={valid ? undefined : true}
          className="h-9 w-[6.25rem] shrink-0 px-2 font-mono text-sm uppercase"
        />
        <span
          className="zimos-look-well relative block size-9 shrink-0 overflow-hidden rounded-full ring-1 ring-line-strong has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary pointer-coarse:size-11"
          style={{ backgroundColor: well }}
        >
          <input
            id={id}
            type="color"
            aria-label={t.colorPicker(label)}
            value={well}
            onChange={(e) => pick(e.target.value.toUpperCase())}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </span>
        {swatches && swatches.length > 0 && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={swatchesId}
            aria-label={t.colorSwatches(label)}
            title={t.colorSwatches(label)}
            onClick={() => setOpen((v) => !v)}
            className={cn(lookIconButtonClass, open && "bg-ink/6 text-ink")}
          >
            <IconTheme className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {swatches && swatches.length > 0 && open && (
        <SwatchRow id={swatchesId} colors={swatches} value={valid} label={t.colorSwatches(label)} onPick={pick} />
      )}

      {valid ? (
        hint && <p className="text-xs text-ink-soft">{hint}</p>
      ) : (
        <p className="text-xs font-medium text-danger">
          {t.colorInvalid}{" "}
          <bdi dir="ltr" className="font-mono">
            #1F5D5B
          </bdi>
        </p>
      )}
      {children}
    </div>
  );
}

/** Ready colours as round dots on one line (it scrolls sideways when the panel is narrow). */
export function SwatchRow({
  id,
  colors,
  value,
  label,
  onPick,
  className,
}: {
  id?: string;
  colors: readonly string[];
  /** The colour in use, to mark its dot. */
  value: string | null;
  label: string;
  onPick: (hex: string) => void;
  className?: string;
}) {
  const t = themeUi(useEditorLocale());
  return (
    <div
      id={id}
      role="group"
      aria-label={label}
      className={cn(
        "-mx-1 flex gap-1.5 overflow-x-auto px-1 py-1 [scrollbar-width:none] pointer-coarse:gap-2 [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {colors.map((color) => {
        const active = value === color;
        return (
          <button
            key={color}
            type="button"
            title={color}
            aria-label={t.useColor(color)}
            aria-pressed={active}
            onClick={() => onPick(color)}
            className={cn(
              "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full ring-1 ring-black/10 ring-inset",
              "transition-[scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:scale-110 active:scale-[0.97]",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              "pointer-coarse:size-11 dark:ring-white/20 motion-reduce:transition-none"
            )}
            style={{ backgroundColor: color, color: labelOn(color) }}
          >
            {active && <IconCheck className="size-3.5" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}
