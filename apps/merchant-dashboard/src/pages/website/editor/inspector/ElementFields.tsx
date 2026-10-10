import type { ReactNode } from "react";
import { IconClose, IconPlus } from "@/components/icons";
import { Button, Input, Label } from "@store-builder/ui";
import type { PageElement, PageElementType } from "@store-builder/api-client";
import { Field, TextField } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { Select } from "@/components/Select";
import { ELEMENT_SPECS, type FieldSpec } from "../blocks";
import { editorUi, fieldHint, fieldLabel, optionLabel, useEditorLocale, type EditorUi } from "../editorLocale";
import { ImageField, ImageListField } from "../ImageField";
import { ItemListField } from "../ItemListField";
import { ProductPickerField } from "../ProductPickerField";
import { NumberField, SwitchRow } from "./controls";
import { BilingualField, LinkTargetNote, isLinkKey, pairByLanguage, type LanguageSlot } from "./fields";

/**
 * An element's own fields, drawn from its `FieldSpec[]` (blocks.ts): the
 * Content tab of the inspector, and the funnel builder's inline form.
 *
 * Content inputs are `dir="auto"`: merchants write Arabic and English copy,
 * and each field should follow the text typed into it, whatever direction the
 * editor chrome is in. URL-like fields stay left-to-right.
 */

/** Prop keys that hold URLs or ids, which always read left-to-right. */
const LTR_KEYS = new Set(["href", "url", "src", "productId", "name"]);

/** The kinds of top-level field a second language makes sense for (`title` + `titleEn`). */
const PAIRABLE = ["text", "textarea", "image"] as const;

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

interface StoryStepItem {
  title: string;
  body: string;
  image: string;
}

function asStepList(v: unknown): StoryStepItem[] {
  if (!Array.isArray(v)) return [];
  return v.map((item) => {
    const o = (item ?? {}) as Record<string, unknown>;
    return { title: asString(o.title), body: asString(o.body), image: asString(o.image) };
  });
}

interface CompareRowItem {
  label: string;
  us: string;
  them: string;
}

function asCompareRows(v: unknown): CompareRowItem[] {
  if (!Array.isArray(v)) return [];
  return v.map((item) => {
    const o = (item ?? {}) as Record<string, unknown>;
    return { label: asString(o.label), us: asString(o.us), them: asString(o.them) };
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

const CARD = "space-y-2 rounded-[1rem] bg-paper-raised p-3 ring-1 ring-line";

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
    <div data-slot="inspector-items" className="space-y-2">
      <Label>{label}</Label>
      {children}
      <Button type="button" size="sm" variant="outline" className="w-full" onClick={onAdd}>
        <IconPlus className="size-4" aria-hidden />
        {addLabel}
      </Button>
      {hint && <p className="text-xs leading-5 text-ink-soft">{hint}</p>}
    </div>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" size="icon" variant="ghost" className="shrink-0" aria-label={label} title={label} onClick={onClick}>
      <IconClose className="size-4" aria-hidden />
    </Button>
  );
}

function StringListEditor({
  label,
  hint,
  itemLabel,
  value,
  ui,
  onChange,
}: {
  label: string;
  hint?: string;
  itemLabel: string;
  value: string[];
  ui: EditorUi;
  onChange: (next: string[]) => void;
}) {
  return (
    <ListShell label={label} hint={hint} addLabel={ui.addItem(itemLabel)} onAdd={() => onChange([...value, ""])}>
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((item, i) => (
            <div key={i} className="flex items-center gap-1">
              <Input
                value={item}
                dir="auto"
                aria-label={ui.itemAria(itemLabel, i + 1)}
                onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))}
              />
              <RemoveButton label={ui.removeItem(itemLabel, i + 1)} onClick={() => onChange(value.filter((_, j) => j !== i))} />
            </div>
          ))}
        </div>
      )}
    </ListShell>
  );
}

function QaListEditor({
  label,
  hint,
  value,
  ui,
  onChange,
}: {
  label: string;
  hint?: string;
  value: QaItem[];
  ui: EditorUi;
  onChange: (next: QaItem[]) => void;
}) {
  function patch(i: number, key: keyof QaItem, v: string) {
    onChange(value.map((item, j) => (j === i ? { ...item, [key]: v } : item)));
  }
  return (
    <ListShell label={label} hint={hint} addLabel={ui.addQuestion} onAdd={() => onChange([...value, { q: "", a: "" }])}>
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((item, i) => (
            <div key={i} data-slot="inspector-item" className={CARD}>
              <div className="flex items-center gap-1">
                <Input
                  value={item.q}
                  dir="auto"
                  placeholder={ui.question}
                  aria-label={ui.questionAria(i + 1)}
                  onChange={(e) => patch(i, "q", e.target.value)}
                />
                <RemoveButton label={ui.removeQuestion(i + 1)} onClick={() => onChange(value.filter((_, j) => j !== i))} />
              </div>
              <Textarea
                value={item.a}
                dir="auto"
                placeholder={ui.answer}
                aria-label={ui.answerAria(i + 1)}
                rows={2}
                onChange={(e) => patch(i, "a", e.target.value)}
              />
            </div>
          ))}
        </div>
      )}
    </ListShell>
  );
}

/**
 * `scroll_story` steps — a title, a line of text and a picture per step. The
 * picture reuses the same uploader as every other image field, so a step image
 * lands in the store's media library like all the rest.
 */
function StepListEditor({
  label,
  hint,
  value,
  ui,
  onChange,
}: {
  label: string;
  hint?: string;
  value: StoryStepItem[];
  ui: EditorUi;
  onChange: (next: StoryStepItem[]) => void;
}) {
  function patch(i: number, key: keyof StoryStepItem, v: string) {
    onChange(value.map((item, j) => (j === i ? { ...item, [key]: v } : item)));
  }
  return (
    <ListShell
      label={label}
      hint={hint}
      addLabel={ui.addStep}
      onAdd={() => onChange([...value, { title: "", body: "", image: "" }])}
    >
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((item, i) => (
            <div key={i} data-slot="inspector-item" className={CARD}>
              <div className="flex items-center gap-1">
                <Input
                  value={item.title}
                  dir="auto"
                  placeholder={ui.stepTitle}
                  aria-label={ui.stepTitleAria(i + 1)}
                  onChange={(e) => patch(i, "title", e.target.value)}
                />
                <RemoveButton label={ui.removeStep(i + 1)} onClick={() => onChange(value.filter((_, j) => j !== i))} />
              </div>
              <Textarea
                value={item.body}
                dir="auto"
                placeholder={ui.stepBody}
                aria-label={ui.stepBodyAria(i + 1)}
                rows={2}
                onChange={(e) => patch(i, "body", e.target.value)}
              />
              <ImageField label={ui.stepImageAria(i + 1)} value={item.image} onChange={(url) => patch(i, "image", url)} />
            </div>
          ))}
        </div>
      )}
    </ListShell>
  );
}

/**
 * `comparison` rows — what is being compared, then the two columns' cells. The
 * two cells sit side by side because that is how they read on the storefront,
 * and both are `dir="auto"`: a merchant may answer in Arabic, or type the bare
 * "yes"/"no" that the storefront turns into a tick or a cross.
 */
function CompareRowsEditor({
  label,
  hint,
  value,
  ui,
  onChange,
}: {
  label: string;
  hint?: string;
  value: CompareRowItem[];
  ui: EditorUi;
  onChange: (next: CompareRowItem[]) => void;
}) {
  function patch(i: number, key: keyof CompareRowItem, v: string) {
    onChange(value.map((item, j) => (j === i ? { ...item, [key]: v } : item)));
  }
  return (
    <ListShell
      label={label}
      hint={hint}
      addLabel={ui.addRow}
      onAdd={() => onChange([...value, { label: "", us: "", them: "" }])}
    >
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((item, i) => (
            <div key={i} data-slot="inspector-item" className={CARD}>
              <div className="flex items-center gap-1">
                <Input
                  value={item.label}
                  dir="auto"
                  placeholder={ui.rowLabel}
                  aria-label={ui.rowLabelAria(i + 1)}
                  onChange={(e) => patch(i, "label", e.target.value)}
                />
                <RemoveButton label={ui.removeRow(i + 1)} onClick={() => onChange(value.filter((_, j) => j !== i))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={item.us}
                  dir="auto"
                  placeholder={ui.rowUs}
                  aria-label={ui.rowUsAria(i + 1)}
                  onChange={(e) => patch(i, "us", e.target.value)}
                />
                <Input
                  value={item.them}
                  dir="auto"
                  placeholder={ui.rowThem}
                  aria-label={ui.rowThemAria(i + 1)}
                  onChange={(e) => patch(i, "them", e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </ListShell>
  );
}

function LinkListEditor({
  label,
  hint,
  value,
  ui,
  onChange,
}: {
  label: string;
  hint?: string;
  value: LinkItem[];
  ui: EditorUi;
  onChange: (next: LinkItem[]) => void;
}) {
  function patch(i: number, key: keyof LinkItem, v: string) {
    onChange(value.map((item, j) => (j === i ? { ...item, [key]: v } : item)));
  }
  return (
    <ListShell
      label={label}
      hint={hint}
      addLabel={ui.addLink}
      onAdd={() => onChange([...value, { platform: "", url: "" }])}
    >
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((item, i) => (
            <div key={i} data-slot="inspector-item" className={CARD}>
              <div className="flex items-center gap-1">
                <Input
                  value={item.platform}
                  dir="ltr"
                  placeholder="instagram"
                  aria-label={ui.platformAria(i + 1)}
                  onChange={(e) => patch(i, "platform", e.target.value)}
                />
                <RemoveButton label={ui.removeLink(i + 1)} onClick={() => onChange(value.filter((_, j) => j !== i))} />
              </div>
              <Input
                value={item.url}
                dir="ltr"
                placeholder="https://…"
                aria-label={ui.linkAria(i + 1)}
                onChange={(e) => patch(i, "url", e.target.value)}
              />
              <LinkTargetNote href={item.url} />
            </div>
          ))}
        </div>
      )}
    </ListShell>
  );
}

// --- one field ------------------------------------------------------------

/**
 * One field of an element. `slot` is given when the field is one language of
 * a two-language pair (BilingualField): it names the input after its language
 * and sets its direction, and the pair shows the hint once.
 */
export function ElementField({
  elementType,
  spec,
  props,
  onChange,
  slot,
}: {
  elementType: PageElementType;
  spec: FieldSpec;
  props: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  slot?: LanguageSlot;
}) {
  const locale = useEditorLocale();
  const ui = editorUi(locale);
  const raw = props[spec.key];
  const label = slot?.label ?? fieldLabel(elementType, spec.key, spec.label, locale);
  const hint = slot ? undefined : fieldHint(elementType, spec.key, spec.hint, locale);
  const labelHidden = slot?.labelHidden ?? false;
  const link = isLinkKey(spec.key);
  const dir = slot?.dir ?? (LTR_KEYS.has(spec.key) || link ? "ltr" : "auto");

  switch (spec.kind) {
    case "text":
      if (link) {
        // The address, then where it goes in words, then the hint.
        return (
          <div className="space-y-1.5">
            <TextField
              label={label}
              labelHidden={labelHidden}
              placeholder={spec.placeholder}
              dir={dir}
              value={asString(raw)}
              onChange={(e) => onChange(spec.key, e.target.value)}
            />
            <LinkTargetNote href={asString(raw)} onPick={(href) => onChange(spec.key, href)} />
            {hint && <p className="text-xs leading-5 text-ink-soft">{hint}</p>}
          </div>
        );
      }
      return (
        <TextField
          label={label}
          hint={hint}
          labelHidden={labelHidden}
          placeholder={spec.placeholder}
          dir={dir}
          value={asString(raw)}
          onChange={(e) => onChange(spec.key, e.target.value)}
        />
      );

    case "textarea":
      return (
        <Field label={label} hint={hint} labelHidden={labelHidden}>
          {({ id }) => (
            <Textarea
              id={id}
              rows={3}
              dir={dir}
              placeholder={spec.placeholder}
              value={asString(raw)}
              onChange={(e) => onChange(spec.key, e.target.value)}
            />
          )}
        </Field>
      );

    case "number":
      // The prop stays numeric — the storefront renderer expects a number —
      // and goes back to "" when the field is emptied, as it always did.
      return <NumberField label={label} hint={hint} min={spec.min} max={spec.max} value={asNumber(raw)} onChange={(v) => onChange(spec.key, v)} />;

    case "datetime": {
      // datetime-local speaks the editor's own clock; the prop is an ISO date.
      const parsed = typeof raw === "string" && raw ? new Date(raw) : null;
      const local =
        parsed && !Number.isNaN(parsed.getTime())
          ? new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
          : "";
      return (
        <Field label={label} hint={hint}>
          {({ id }) => (
            <Input
              id={id}
              type="datetime-local"
              dir="ltr"
              value={local}
              onChange={(e) => {
                const v = e.target.value;
                const at = v ? new Date(v) : null;
                onChange(spec.key, at && !Number.isNaN(at.getTime()) ? at.toISOString() : "");
              }}
            />
          )}
        </Field>
      );
    }

    case "boolean":
      return <SwitchRow label={label} hint={hint} checked={raw === true} onChange={(checked) => onChange(spec.key, checked)} />;

    case "select":
      return (
        <Field label={label} hint={hint}>
          {({ id }) => (
            <Select
              id={id}
              value={asString(raw)}
              onChange={(e) => {
                const v = e.target.value;
                // "level" on a heading is an int in the seeded trees; keep it one.
                const numeric = spec.options.every((o) => /^\d+$/.test(o.value));
                // "—" on a list of words is "not set": the prop is taken out (setElementProp), never stored
                // as "" — the server refuses "" where it checks the value against a list.
                onChange(spec.key, numeric ? Number(v) : v === "" ? undefined : v);
              }}
            >
              <option value="">—</option>
              {spec.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {optionLabel(spec.key, o.value, o.label, locale)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      );

    case "product":
    case "collection":
      return <ProductPickerField kind={spec.kind} label={label} hint={hint} value={asString(raw)} onChange={(v) => onChange(spec.key, v)} />;

    case "image":
      return <ImageField label={label} labelHidden={labelHidden} hint={hint} value={asString(raw)} onChange={(url) => onChange(spec.key, url)} />;

    case "imageList":
      return <ImageListField label={label} hint={hint} value={asStringList(raw)} onChange={(urls) => onChange(spec.key, urls)} />;

    case "stringList":
      return (
        <StringListEditor
          label={label}
          hint={hint}
          itemLabel={locale === "ar" ? ui.listItem : spec.itemLabel}
          value={asStringList(raw)}
          ui={ui}
          onChange={(next) => onChange(spec.key, next)}
        />
      );

    case "qaList":
      return <QaListEditor label={label} hint={hint} value={asQaList(raw)} ui={ui} onChange={(next) => onChange(spec.key, next)} />;

    case "stepList":
      return <StepListEditor label={label} hint={hint} value={asStepList(raw)} ui={ui} onChange={(next) => onChange(spec.key, next)} />;


    case "compareRows":
      return <CompareRowsEditor label={label} hint={hint} value={asCompareRows(raw)} ui={ui} onChange={(next) => onChange(spec.key, next)} />;

    case "itemList":
      return (
        <ItemListField
          label={label}
          hint={hint}
          value={raw}
          itemLabel={spec.itemLabel}
          itemLabelAr={spec.itemLabelAr}
          titleKey={spec.titleKey}
          fields={spec.fields}
          max={spec.max}
          onChange={(next) => onChange(spec.key, next)}
        />
      );

    case "linkList":
      return <LinkListEditor label={label} hint={hint} value={asLinkList(raw)} ui={ui} onChange={(next) => onChange(spec.key, next)} />;
  }
}

/** Whether a prop holds anything a shopper would see. */
function filled(v: unknown): boolean {
  return asString(v).trim() !== "";
}

/**
 * Every field of an element, in the order its spec lists them. A field with
 * an English twin (`title` + `titleEn`) is drawn once, as a two-language field.
 */
export function ElementFields({
  element,
  onPropChange,
}: {
  element: PageElement;
  onPropChange: (key: string, value: unknown) => void;
}) {
  const locale = useEditorLocale();
  const spec = ELEMENT_SPECS[element.type];
  const props = (element.props ?? {}) as Record<string, unknown>;

  return (
    <>
      {pairByLanguage(spec.fields, PAIRABLE).map(({ field, english }) =>
        english ? (
          <BilingualField
            key={field.key}
            label={fieldLabel(element.type, field.key, field.label, locale)}
            hint={fieldHint(element.type, field.key, field.hint, locale)}
            images={field.kind === "image"}
            filled={{ ar: filled(props[field.key]), en: filled(props[english.key]) }}
          >
            {(language, slot) => (
              <ElementField elementType={element.type} spec={language === "ar" ? field : english} props={props} onChange={onPropChange} slot={slot} />
            )}
          </BilingualField>
        ) : (
          <ElementField key={field.key} elementType={element.type} spec={field} props={props} onChange={onPropChange} />
        )
      )}
    </>
  );
}
