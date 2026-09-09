import type { ReactNode } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button, Input, Label } from "@store-builder/ui";
import type { PageElement, PageSection } from "@store-builder/api-client";
import { Field, TextField } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { Select } from "@/components/Select";
import {
  ELEMENT_SPECS,
  sectionElements,
  sectionLabel,
  setElementProp,
  type FieldSpec,
} from "./blocks";
import { ImageField, ImageListField } from "./ImageField";

/**
 * The right-hand panel. A section has no editable fields of its own — the tree
 * gives sections no props — so this walks the section's elements and renders a
 * fieldset per element from that element type's `FieldSpec[]`.
 */

// --- prop readers: props are `unknown`, so coerce defensively --------------

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
}

function asNumber(v: unknown): number | "" {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return "";
}

function asStringList(v: unknown): string[] {
  return Array.isArray(v) ? v.map(asString) : [];
}

interface QaItem {
  q: string;
  a: string;
}

function asQaList(v: unknown): QaItem[] {
  if (!Array.isArray(v)) return [];
  return v.map((item) => {
    const o = (item ?? {}) as Record<string, unknown>;
    return { q: asString(o.q), a: asString(o.a) };
  });
}

interface LinkItem {
  platform: string;
  url: string;
}

function asLinkList(v: unknown): LinkItem[] {
  if (!Array.isArray(v)) return [];
  return v.map((item) => {
    const o = (item ?? {}) as Record<string, unknown>;
    return { platform: asString(o.platform), url: asString(o.url) };
  });
}

// --- repeatable list editors ----------------------------------------------

function ListShell({
  label,
  hint,
  onAdd,
  addLabel,
  children,
}: {
  label: string;
  hint?: string;
  onAdd: () => void;
  addLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      <Button type="button" size="sm" variant="outline" onClick={onAdd}>
        <Plus className="size-4" aria-hidden />
        {addLabel}
      </Button>
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

function StringListEditor({
  label,
  hint,
  itemLabel,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  itemLabel: string;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <ListShell label={label} hint={hint} addLabel={`Add ${itemLabel.toLowerCase()}`} onAdd={() => onChange([...value, ""])}>
      <div className="space-y-2">
        {value.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={item}
              aria-label={`${itemLabel} ${i + 1}`}
              onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Remove ${itemLabel.toLowerCase()} ${i + 1}`}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>
        ))}
      </div>
    </ListShell>
  );
}

function QaListEditor({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: QaItem[];
  onChange: (next: QaItem[]) => void;
}) {
  function patch(i: number, key: keyof QaItem, v: string) {
    onChange(value.map((item, j) => (j === i ? { ...item, [key]: v } : item)));
  }
  return (
    <ListShell label={label} hint={hint} addLabel="Add question" onAdd={() => onChange([...value, { q: "", a: "" }])}>
      <div className="space-y-3">
        {value.map((item, i) => (
          <div key={i} className="space-y-2 rounded-[0.5rem] border border-line p-3">
            <div className="flex items-center gap-2">
              <Input
                value={item.q}
                placeholder="Question"
                aria-label={`Question ${i + 1}`}
                onChange={(e) => patch(i, "q", e.target.value)}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Remove question ${i + 1}`}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </div>
            <Textarea
              value={item.a}
              placeholder="Answer"
              aria-label={`Answer ${i + 1}`}
              rows={2}
              onChange={(e) => patch(i, "a", e.target.value)}
            />
          </div>
        ))}
      </div>
    </ListShell>
  );
}

function LinkListEditor({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: LinkItem[];
  onChange: (next: LinkItem[]) => void;
}) {
  function patch(i: number, key: keyof LinkItem, v: string) {
    onChange(value.map((item, j) => (j === i ? { ...item, [key]: v } : item)));
  }
  return (
    <ListShell
      label={label}
      hint={hint}
      addLabel="Add link"
      onAdd={() => onChange([...value, { platform: "", url: "" }])}
    >
      <div className="space-y-2">
        {value.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={item.platform}
              placeholder="instagram"
              aria-label={`Platform ${i + 1}`}
              className="w-1/3"
              onChange={(e) => patch(i, "platform", e.target.value)}
            />
            <Input
              value={item.url}
              placeholder="https://…"
              aria-label={`Link ${i + 1}`}
              onChange={(e) => patch(i, "url", e.target.value)}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Remove link ${i + 1}`}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>
        ))}
      </div>
    </ListShell>
  );
}

// --- one field ------------------------------------------------------------

function ElementField({
  spec,
  props,
  onChange,
}: {
  spec: FieldSpec;
  props: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const raw = props[spec.key];

  switch (spec.kind) {
    case "text":
      return (
        <TextField
          label={spec.label}
          hint={spec.hint}
          placeholder={spec.placeholder}
          value={asString(raw)}
          onChange={(e) => onChange(spec.key, e.target.value)}
        />
      );

    case "textarea":
      return (
        <Field label={spec.label} hint={spec.hint}>
          {({ id }) => (
            <Textarea
              id={id}
              rows={3}
              placeholder={spec.placeholder}
              value={asString(raw)}
              onChange={(e) => onChange(spec.key, e.target.value)}
            />
          )}
        </Field>
      );

    case "number":
      return (
        <Field label={spec.label} hint={spec.hint}>
          {({ id }) => (
            <Input
              id={id}
              type="number"
              min={spec.min}
              max={spec.max}
              value={asNumber(raw)}
              onChange={(e) => {
                const v = e.target.value;
                // Keep the prop numeric — the storefront renderer expects a
                // number — but let the field go empty while typing.
                onChange(spec.key, v === "" ? "" : Number(v));
              }}
            />
          )}
        </Field>
      );

    case "boolean":
      return (
        <label className="flex items-center gap-2 py-1 text-sm text-ink">
          <input
            type="checkbox"
            checked={raw === true}
            onChange={(e) => onChange(spec.key, e.target.checked)}
            className="size-4 rounded border-line text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
          />
          {spec.label}
        </label>
      );

    case "select":
      return (
        <Field label={spec.label} hint={spec.hint}>
          {({ id }) => (
            <Select
              id={id}
              value={asString(raw)}
              onChange={(e) => {
                const v = e.target.value;
                // "level" on a heading is an int in the seeded trees; keep it one.
                const numeric = spec.options.every((o) => /^\d+$/.test(o.value));
                onChange(spec.key, numeric ? Number(v) : v);
              }}
            >
              <option value="">—</option>
              {spec.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      );

    case "image":
      return (
        <ImageField
          label={spec.label}
          hint={spec.hint}
          value={asString(raw)}
          onChange={(url) => onChange(spec.key, url)}
        />
      );

    case "imageList":
      return (
        <ImageListField
          label={spec.label}
          hint={spec.hint}
          value={asStringList(raw)}
          onChange={(urls) => onChange(spec.key, urls)}
        />
      );

    case "stringList":
      return (
        <StringListEditor
          label={spec.label}
          hint={spec.hint}
          itemLabel={spec.itemLabel}
          value={asStringList(raw)}
          onChange={(next) => onChange(spec.key, next)}
        />
      );

    case "qaList":
      return (
        <QaListEditor
          label={spec.label}
          hint={spec.hint}
          value={asQaList(raw)}
          onChange={(next) => onChange(spec.key, next)}
        />
      );

    case "linkList":
      return (
        <LinkListEditor
          label={spec.label}
          hint={spec.hint}
          value={asLinkList(raw)}
          onChange={(next) => onChange(spec.key, next)}
        />
      );
  }
}

function ElementFieldset({
  element,
  onPropChange,
}: {
  element: PageElement;
  onPropChange: (element: PageElement, key: string, value: unknown) => void;
}) {
  const spec = ELEMENT_SPECS[element.type];
  const Icon = spec.icon;
  const props = element.props ?? {};

  return (
    <div className="space-y-3 border-b border-line px-4 py-4 last:border-b-0">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-soft">
        <Icon className="size-3.5" aria-hidden />
        {spec.label}
      </div>
      {spec.fields.map((field) => (
        <ElementField
          key={field.key}
          spec={field}
          props={props}
          onChange={(key, value) => onPropChange(element, key, value)}
        />
      ))}
    </div>
  );
}

export function SectionInspector({
  section,
  onChange,
  onDelete,
  onClose,
}: {
  section: PageSection;
  onChange: (next: PageSection) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const elements = sectionElements(section);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate font-display text-sm font-medium text-ink">
            {sectionLabel(section)}
          </h2>
          <p className="truncate text-xs text-ink-soft">
            {elements.length} {elements.length === 1 ? "element" : "elements"}
          </p>
        </div>
        <Button type="button" size="icon" variant="ghost" aria-label="Close panel" onClick={onClose}>
          <X className="size-4" aria-hidden />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {elements.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink-soft">
            This section has no elements to edit.
          </p>
        ) : (
          elements.map((element) => (
            <ElementFieldset
              key={element.id}
              element={element}
              onPropChange={(el, key, value) => onChange(setElementProp(section, el, key, value))}
            />
          ))
        )}
      </div>

      <div className="border-t border-line px-4 py-3">
        <Button type="button" size="sm" variant="outline" className="w-full" onClick={onDelete}>
          <Trash2 className="size-4" aria-hidden />
          Delete section
        </Button>
      </div>
    </div>
  );
}
