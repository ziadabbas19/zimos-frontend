import { useEffect, useId, useState, type ReactNode } from "react";
import { Button, Label, cn } from "@store-builder/ui";
import { IconCaretDown, IconMinus, IconPlus, type IconComponent } from "@/components/icons";
import { ColorField } from "@/components/ColorField";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { Segmented } from "@/components/Segmented";
import { normalizeHex } from "@/lib/brandColors";
import { useEditorLocale } from "../editorLocale";
import { inspectorNumber, inspectorUi } from "./strings";

/**
 * The inspector's small building blocks: a titled group, a number with
 * steppers, a colour well, a switch row and a short choice. Structure only —
 * their glass is the `[inspector]` block of glass/editor.css.
 */

// --- group -------------------------------------------------------------------

/** Which foldable groups were left open, for as long as the editor stays open. */
const openGroups = new Map<string, boolean>();

/**
 * One titled block of the panel. Foldable ones remember whether they were
 * left open (by `id`), so the group a merchant works in stays open from one
 * element to the next.
 */
export function Group({
  id,
  title,
  hint,
  icon: Glyph,
  mark,
  collapsible = false,
  defaultOpen = true,
  action,
  nodeId,
  flash = false,
  className,
  children,
}: {
  id?: string;
  title: string;
  hint?: string;
  icon?: IconComponent;
  /** How many things in the group are set — a small figure beside the title. */
  mark?: number;
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** Sits at the end of the title row of a group that does not fold. */
  action?: ReactNode;
  /** Found by "select parent" (selectParent.tsx) and outlined for a moment. */
  nodeId?: string;
  flash?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const locale = useEditorLocale();
  const t = inspectorUi(locale);
  const bodyId = useId();
  const [open, setOpen] = useState<boolean>(() => {
    if (!collapsible) return true;
    const remembered = id ? openGroups.get(id) : undefined;
    return remembered ?? defaultOpen;
  });

  const heading = (
    <>
      {Glyph && <Glyph className="size-4 shrink-0 text-ink-soft" aria-hidden />}
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{title}</span>
      {mark !== undefined && mark > 0 && (
        <span
          data-slot="inspector-mark"
          className="inline-flex h-5 shrink-0 items-center rounded-full bg-primary-soft px-2 text-[11px] font-semibold text-primary-dark dark:text-primary"
        >
          {t.setCount(inspectorNumber(mark, locale))}
        </span>
      )}
    </>
  );

  return (
    <section
      data-slot="inspector-group"
      data-node-id={nodeId}
      tabIndex={nodeId ? -1 : undefined}
      className={cn(
        "scroll-mt-16 border-b border-line px-4 last:border-b-0 focus:outline-none",
        flash && "ring-2 ring-primary ring-inset",
        className
      )}
    >
      {collapsible ? (
        <h3>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => {
              const next = !open;
              setOpen(next);
              if (id) openGroups.set(id, next);
            }}
            className="flex min-h-12 w-full cursor-pointer items-center gap-2 rounded-[0.5rem] text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {heading}
            <IconCaretDown
              className={cn(
                "size-4 shrink-0 text-ink-soft transition-transform duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
                !open && "-rotate-90 rtl:rotate-90"
              )}
              aria-hidden
            />
          </button>
        </h3>
      ) : (
        <div className="flex min-h-12 items-center gap-2">
          <h3 className="flex min-w-0 flex-1 items-center gap-2">{heading}</h3>
          {action}
        </div>
      )}
      {open && (
        <div id={bodyId} className="zimos-inspector-reveal space-y-3 pb-4">
          {hint && <p className="text-xs leading-5 text-ink-soft">{hint}</p>}
          {children}
        </div>
      )}
    </section>
  );
}

// --- number with steppers ----------------------------------------------------

/**
 * A number between a minus and a plus. The box takes typing as it comes (a
 * half-typed "1" on the way to "12" is not forced to the minimum); the
 * steppers always land inside the range.
 *
 * `strict` clamps what is typed as well, when the field is left — the style
 * numbers, whose range the server enforces. Without it a typed value is kept
 * as typed, as an element's own number props always were.
 */
export function NumberField({
  label,
  hint,
  error,
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder,
  startAt,
  strict = false,
  integer = false,
  labelHidden,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  /** "" is "not set". */
  value: number | "";
  onChange: (value: number | "") => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  /** Where the steppers start from while the field is empty (the inherited value). */
  startAt?: number;
  strict?: boolean;
  integer?: boolean;
  labelHidden?: boolean;
  className?: string;
}) {
  const t = inspectorUi(useEditorLocale());
  const [draft, setDraft] = useState<string | null>(null);

  const clamp = (n: number) => Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, n));
  const tidy = (n: number) => (integer ? Math.round(n) : Math.round(n * 1000) / 1000);
  const inRange = (n: number) => (min === undefined || n >= min) && (max === undefined || n <= max);

  function bump(direction: 1 | -1) {
    const origin = value === "" ? (startAt ?? null) : value;
    const next = origin === null ? (min ?? 0) : origin + direction * step;
    setDraft(null);
    onChange(tidy(clamp(next)));
  }

  const shown = draft ?? (value === "" ? "" : String(value));
  const atMin = value !== "" && min !== undefined && value <= min;
  const atMax = value !== "" && max !== undefined && value >= max;
  const stepButton =
    "flex w-9 shrink-0 cursor-pointer items-center justify-center text-ink-soft transition-colors duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none pointer-coarse:w-11";

  return (
    <Field label={label} hint={hint} error={error} labelHidden={labelHidden} className={className}>
      {({ id, ...aria }) => (
        <div
          data-slot="inspector-stepper"
          className={cn(
            "flex h-10 items-stretch overflow-hidden rounded-[0.875rem] border border-line-strong bg-paper-raised focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/40 pointer-coarse:h-11",
            error && "border-danger"
          )}
        >
          <button type="button" aria-label={t.decrease(label)} disabled={atMin} onClick={() => bump(-1)} className={stepButton}>
            <IconMinus className="size-4" aria-hidden />
          </button>
          <input
            id={id}
            {...aria}
            type="number"
            // A phone's number pad has no minus key, so a field that can go below zero keeps the full keyboard.
            inputMode={min !== undefined && min >= 0 ? (integer ? "numeric" : "decimal") : undefined}
            dir="ltr"
            min={min}
            max={max}
            step={step}
            placeholder={placeholder}
            value={shown}
            onChange={(e) => {
              const text = e.target.value;
              setDraft(text);
              if (text === "") return onChange("");
              const n = Number(text);
              if (!Number.isFinite(n)) return;
              if (!strict) onChange(integer ? Math.round(n) : n);
              else if (inRange(n)) onChange(tidy(n));
            }}
            onBlur={() => {
              if (draft === null) return;
              const n = Number(draft);
              if (strict && draft !== "" && Number.isFinite(n) && !inRange(n)) onChange(tidy(clamp(n)));
              setDraft(null);
            }}
            className="w-full min-w-0 flex-1 [appearance:textfield] border-0 bg-transparent px-1 text-center text-sm text-ink tabular-nums outline-none placeholder:text-ink-soft/60 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <button type="button" aria-label={t.increase(label)} disabled={atMax} onClick={() => bump(1)} className={stepButton}>
            <IconPlus className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </Field>
  );
}

// --- colour ------------------------------------------------------------------

/**
 * A colour that may be left unset. Folded, it is one row: a well showing the
 * colour (or the one it inherits), its name and its code. Open, it is the
 * dashboard's ColorField — picker, code box and the ready colours — with a
 * way back to the default.
 *
 * Only a whole colour code is stored; an emptied box clears it.
 */
export function ColourControl({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  /** The stored colour, or undefined when this is left at the default. */
  value: string | undefined;
  /** What applies while it is unset (another device's or a shared style's colour). */
  fallback?: string;
  onChange: (hex: string | undefined) => void;
}) {
  const t = inspectorUi(useEditorLocale());
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);

  // A change from outside (undo, another device) drops what was half typed —
  // but not the empty box of someone who just cleared it to type a new code.
  useEffect(() => {
    setDraft((prev) => (prev !== null && prev.trim() === "" && value === undefined ? prev : null));
  }, [value]);

  const set = value ? normalizeHex(value) : null;
  const inherited = fallback ? normalizeHex(fallback) : null;
  const well = set ?? inherited;
  const shown = draft ?? set ?? inherited ?? "#000000";

  return (
    <div data-slot="inspector-colour" className="rounded-[0.875rem] ring-1 ring-line">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[0.875rem] px-2.5 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span
          aria-hidden
          className={cn(
            "size-7 shrink-0 rounded-full ring-1 ring-line-strong ring-inset",
            !well && "bg-[image:repeating-linear-gradient(135deg,var(--color-paper-sunken)_0_4px,var(--color-paper-raised)_4px_8px)]"
          )}
          style={well ? { backgroundColor: well } : undefined}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{label}</span>
        <bdi dir={set ? "ltr" : undefined} className={cn("shrink-0 text-xs text-ink-soft", set && "font-mono uppercase")}>
          {set ?? t.colourDefault}
        </bdi>
        <IconCaretDown
          className={cn(
            "size-4 shrink-0 text-ink-soft transition-transform duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
            !open && "-rotate-90 rtl:rotate-90"
          )}
          aria-hidden
        />
      </button>
      {open && (
        // The row above already names the colour: the field's own label stays for screen readers only.
        <div id={panelId} className="zimos-inspector-reveal space-y-2 border-t border-line px-2.5 py-3 [&>div>[data-slot=label]]:sr-only">
          <ColorField
            label={label}
            value={shown}
            onChange={(text) => {
              setDraft(text);
              const hex = normalizeHex(text);
              if (text.trim() === "") onChange(undefined);
              else if (hex) onChange(hex.toLowerCase());
            }}
          />
          {set ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(null);
                onChange(undefined);
              }}
            >
              {t.colourClear}
            </Button>
          ) : (
            <p className="text-xs leading-5 text-ink-soft">{t.colourInherits}</p>
          )}
        </div>
      )}
    </div>
  );
}

// --- switch row --------------------------------------------------------------

/** A yes / no as a row with a switch at its end: the whole row is the target. */
export function SwitchRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const hintId = useId();
  return (
    <div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={hint ? hintId : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[0.75rem] text-start text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="min-w-0 flex-1 leading-5">{label}</span>
        <span
          aria-hidden
          data-slot="inspector-switch"
          data-on={checked ? "" : undefined}
          className={cn(
            "relative h-6 w-10 shrink-0 rounded-full ring-1 transition-colors duration-[var(--dur-fade)] ease-[var(--ease-out)] ring-inset motion-reduce:transition-none",
            checked ? "bg-primary ring-primary" : "bg-paper-sunken ring-line-strong"
          )}
        >
          <span
            className={cn(
              "absolute start-0.5 top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform duration-[var(--dur-pop)] ease-[var(--ease-pop)] motion-reduce:transition-none",
              checked && "translate-x-4 rtl:-translate-x-4"
            )}
          />
        </span>
      </button>
      {hint && (
        <p id={hintId} className="text-xs leading-5 text-ink-soft">
          {hint}
        </p>
      )}
    </div>
  );
}

// --- a short choice ----------------------------------------------------------

interface ChoiceOption {
  value: string;
  label: string;
}

/** Up to three short words fit a sliding segmented control in a 20rem panel; anything longer is a list. */
function fitsSegments(options: ChoiceOption[]): boolean {
  return options.length >= 2 && options.length <= 3 && options.every((o) => o.label.length <= 9);
}

/**
 * One choice out of a few: a segmented control whose thumb slides when the
 * options are two or three short words, a native list otherwise.
 */
export function ChoiceField({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  options: ChoiceOption[];
  onChange: (value: string) => void;
}) {
  if (!fitsSegments(options)) {
    return (
      <Field label={label} hint={hint}>
        {({ id }) => (
          <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
    );
  }
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Segmented value={value} onChange={onChange} options={options} label={label} size="sm" className="w-full" />
      {hint && <p className="text-xs leading-5 text-ink-soft">{hint}</p>}
    </div>
  );
}
