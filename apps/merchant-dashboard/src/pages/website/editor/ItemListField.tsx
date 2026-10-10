import { useId, useState, type ReactNode } from "react";
import { IconArrowDown, IconArrowUp, IconCaretDown, IconDelete, IconPlus } from "@/components/icons";
import { Button, Input, Label, cn } from "@store-builder/ui";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { ImageField } from "./ImageField";
import { useEditorLocale } from "./editorLocale";
import { ProductPickerField } from "./ProductPickerField";
import { ChoiceField, NumberField } from "./inspector/controls";
import { BilingualField, LinkTargetNote, isLinkKey, pairByLanguage, type LanguageSlot } from "./inspector/fields";
import { inspectorNumber, inspectorUi } from "./inspector/strings";

/**
 * The inspector's editor for a list of objects — a slider's slides, a row of
 * category tiles, a need picker's needs, a shelf of videos. Each entry is a
 * card that folds under its own title (and its picture, when it has one);
 * one is open at a time. An open card starts with its own actions — move up,
 * move down, remove — and then the fields its spec names.
 *
 * A sub-field with an English twin (`title` + `titleEn`) is drawn once, as a
 * two-language field (inspector/fields.tsx); both keys are stored exactly as
 * before.
 *
 * Sub-fields carry both wordings (`label` / `labelAr`) so this file needs no
 * entry in editorLocale's tables.
 */

export type ItemSubField =
  | { key: string; label: string; labelAr: string; kind: "text" | "textarea" | "image" | "lines"; ltr?: boolean }
  // Picked from the catalogue, stored as the product's id (ProductPickerField.tsx).
  | { key: string; label: string; labelAr: string; kind: "product" }
  | {
      key: string;
      label: string;
      labelAr: string;
      kind: "select";
      options: Array<{ value: string; label: string; labelAr: string }>;
    }
  // A whole number inside a range. Emptied, the key is dropped and the store's own value applies.
  | { key: string; label: string; labelAr: string; kind: "number"; min: number; max: number; step?: number; startAt?: number; hint?: string; hintAr?: string }
  // One of a few values. With `fallback` it is always one of them: the fallback shows (and is what the store draws)
  // while nothing is stored. With `unset` a first choice stores nothing at all — "same as…" — and picking it drops the key.
  | {
      key: string;
      label: string;
      labelAr: string;
      kind: "choice";
      options: Array<{ value: string; label: string; labelAr: string }>;
      fallback?: string;
      unset?: { label: string; labelAr: string };
      hint?: string;
      hintAr?: string;
    };

type Item = Record<string, unknown>;

/** The kinds a second language makes sense for. */
const PAIRABLE = ["text", "textarea", "lines", "image"] as const;

function asItems(raw: unknown): Item[] {
  return Array.isArray(raw)
    ? raw.filter((entry): entry is Item => !!entry && typeof entry === "object" && !Array.isArray(entry))
    : [];
}

const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const lines = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").join("\n") : "");
/** Whether a value holds anything a shopper would see. */
const filled = (v: unknown) => (Array.isArray(v) ? v.some((x) => typeof x === "string" && x.trim() !== "") : str(v).trim() !== "");

export function ItemListField({
  label,
  hint,
  value,
  itemLabel,
  itemLabelAr,
  titleKey,
  fields,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: unknown;
  itemLabel: string;
  itemLabelAr: string;
  /** The sub-field whose text names an entry in its folded header. */
  titleKey: string;
  fields: ItemSubField[];
  max: number;
  onChange: (next: Item[]) => void;
}) {
  const locale = useEditorLocale();
  const ar = locale === "ar";
  const t = inspectorUi(locale);
  const uid = useId();
  const items = asItems(value);
  const noun = ar ? itemLabelAr : itemLabel;
  const [open, setOpen] = useState<number | null>(() => (asItems(value).length === 1 ? 0 : null));

  const paired = pairByLanguage(fields, PAIRABLE);
  const pictureKey = fields.find((f) => f.kind === "image")?.key;

  // `undefined` takes the key out of the entry instead of storing an empty value.
  const patch = (i: number, key: string, v: unknown) =>
    onChange(
      items.map((item, j) => {
        if (j !== i) return item;
        if (v !== undefined) return { ...item, [key]: v };
        const rest = { ...item };
        delete rest[key];
        return rest;
      })
    );
  const move = (i: number, delta: -1 | 1) => {
    const j = i + delta;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    // The open card travels with its entry.
    setOpen(j);
  };

  /** One sub-field of one entry. `slot` is given for one language of a two-language field. */
  function control(i: number, item: Item, field: ItemSubField, slot?: LanguageSlot): ReactNode {
    const id = `${uid}-${i}-${field.key}`;
    const name = slot?.label ?? (ar ? field.labelAr : field.label);
    const hidden = slot?.labelHidden ?? false;

    if (field.kind === "product") {
      return <ProductPickerField key={field.key} kind="product" label={name} value={str(item[field.key])} onChange={(v) => patch(i, field.key, v)} />;
    }
    if (field.kind === "image") {
      return <ImageField key={field.key} label={name} labelHidden={hidden} value={str(item[field.key])} onChange={(url) => patch(i, field.key, url)} />;
    }
    if (field.kind === "number") {
      const stored = item[field.key];
      return (
        <NumberField
          key={field.key}
          label={name}
          hint={ar ? field.hintAr : field.hint}
          min={field.min}
          max={field.max}
          step={field.step}
          startAt={field.startAt}
          placeholder={field.startAt === undefined ? undefined : String(field.startAt)}
          // Only a whole number inside the range is ever stored: the server refuses anything else.
          strict
          integer
          value={typeof stored === "number" && Number.isFinite(stored) ? stored : ""}
          onChange={(v) => patch(i, field.key, v === "" ? undefined : v)}
        />
      );
    }
    if (field.kind === "choice") {
      const stored = str(item[field.key]);
      const known = field.options.some((option) => option.value === stored);
      const options = field.options.map((option) => ({ value: option.value, label: ar ? option.labelAr : option.label }));
      // "" is the choice that stores nothing; it is never written, the key is dropped instead.
      if (field.unset) options.unshift({ value: "", label: ar ? field.unset.labelAr : field.unset.label });
      return (
        <ChoiceField
          key={field.key}
          label={name}
          hint={ar ? field.hintAr : field.hint}
          value={known ? stored : field.unset ? "" : (field.fallback ?? field.options[0]?.value ?? "")}
          options={options}
          onChange={(v) => patch(i, field.key, v === "" ? undefined : v)}
        />
      );
    }
    if (field.kind === "select") {
      return (
        <div key={field.key} className="space-y-1.5">
          <Label htmlFor={id}>{name}</Label>
          <Select id={id} value={str(item[field.key])} onChange={(e) => patch(i, field.key, e.target.value)}>
            <option value="">—</option>
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {ar ? option.labelAr : option.label}
              </option>
            ))}
          </Select>
        </div>
      );
    }
    const dir = slot?.dir ?? (field.ltr ? "ltr" : "auto");
    if (field.kind === "textarea" || field.kind === "lines") {
      return (
        <div key={field.key} className="space-y-1.5">
          <Label htmlFor={id} className={hidden ? "sr-only" : undefined}>
            {name}
          </Label>
          <Textarea
            id={id}
            rows={3}
            dir={dir}
            value={field.kind === "lines" ? lines(item[field.key]) : str(item[field.key])}
            onChange={(e) =>
              patch(
                i,
                field.key,
                // One line per entry; blank lines are kept while typing and dropped by the storefront.
                field.kind === "lines" ? e.target.value.split("\n") : e.target.value
              )
            }
          />
        </div>
      );
    }
    const link = isLinkKey(field.key);
    return (
      <div key={field.key} className="space-y-1.5">
        <Label htmlFor={id} className={hidden ? "sr-only" : undefined}>
          {name}
        </Label>
        <Input id={id} dir={dir} value={str(item[field.key])} onChange={(e) => patch(i, field.key, e.target.value)} />
        {link && <LinkTargetNote href={str(item[field.key])} onPick={(href) => patch(i, field.key, href)} />}
      </div>
    );
  }

  return (
    <div data-slot="inspector-items" className="space-y-2">
      <Label>{label}</Label>
      {items.length === 0 ? (
        <p className="text-xs leading-5 text-ink-soft">{t.itemsEmpty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, i) => {
            const isOpen = open === i;
            const title = str(item[titleKey]).trim() || `${noun} ${inspectorNumber(i + 1, locale)}`;
            const picture = pictureKey ? str(item[pictureKey]) : "";
            const bodyId = `${uid}-${i}`;
            return (
              <li key={i} data-slot="inspector-item" data-open={isOpen ? "" : undefined} className="overflow-hidden rounded-[1rem] bg-paper-raised ring-1 ring-line">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={bodyId}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex min-h-12 w-full cursor-pointer items-center gap-2.5 px-3 py-1.5 text-start focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                >
                  {picture && (
                    <img
                      src={picture}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="size-8 shrink-0 rounded-[0.5rem] bg-paper-sunken object-cover"
                      onError={(e) => {
                        e.currentTarget.style.visibility = "hidden";
                      }}
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink" dir="auto">
                    {title}
                  </span>
                  <IconCaretDown
                    className={cn(
                      "size-4 shrink-0 text-ink-soft transition-transform duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
                      !isOpen && "-rotate-90 rtl:rotate-90"
                    )}
                    aria-hidden
                  />
                </button>
                {isOpen && (
                  <div id={bodyId} className="zimos-inspector-reveal space-y-3 border-t border-line p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button type="button" size="sm" variant="outline" aria-label={t.itemMoveUp(title)} disabled={i === 0} onClick={() => move(i, -1)}>
                        <IconArrowUp className="size-4" aria-hidden />
                        {t.itemUp}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-label={t.itemMoveDown(title)}
                        disabled={i === items.length - 1}
                        onClick={() => move(i, 1)}
                      >
                        <IconArrowDown className="size-4" aria-hidden />
                        {t.itemDown}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={t.itemRemove(title)}
                        className="ms-auto text-danger hover:bg-danger-soft hover:text-danger"
                        onClick={() => {
                          onChange(items.filter((_, j) => j !== i));
                          setOpen(null);
                        }}
                      >
                        <IconDelete className="size-4" aria-hidden />
                        {t.itemDelete}
                      </Button>
                    </div>
                    {paired.map(({ field, english }) =>
                      english ? (
                        <BilingualField
                          key={field.key}
                          label={ar ? field.labelAr : field.label}
                          images={field.kind === "image"}
                          filled={{ ar: filled(item[field.key]), en: filled(item[english.key]) }}
                        >
                          {(language, slot) => control(i, item, language === "ar" ? field : english, slot)}
                        </BilingualField>
                      ) : (
                        control(i, item, field)
                      )
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full"
        disabled={items.length >= max}
        onClick={() => {
          onChange([...items, {}]);
          setOpen(items.length);
        }}
      >
        <IconPlus className="size-4" aria-hidden />
        {t.itemAdd(noun)}
      </Button>
      {items.length >= max && <p className="text-xs leading-5 text-ink-soft">{t.itemsFull(inspectorNumber(max, locale))}</p>}
      {hint && <p className="text-xs leading-5 text-ink-soft">{hint}</p>}
    </div>
  );
}
