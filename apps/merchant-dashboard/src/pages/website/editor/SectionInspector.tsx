import { useState, type ReactNode } from "react";
import { ChevronDown, Columns3, Copy, Palette, Plus, Trash2, X } from "lucide-react";
import { Button, Input, Label, cn } from "@store-builder/ui";
import type { PageColumn, PageElement, PageElementType, PageRow, PageSection } from "@store-builder/api-client";
import { Field, TextField } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { Select } from "@/components/Select";
import {
  COLUMN_SETTING_SPECS,
  ELEMENT_SPECS,
  ROW_SETTING_SPECS,
  SECTION_SETTING_SPECS,
  columnSetting,
  columnTitle,
  elementPosition,
  moveElement,
  replaceElement,
  rowSetting,
  sectionColumnCount,
  sectionElements,
  sectionLabel,
  sectionSetting,
  setColumnSetting,
  setElementProp,
  setRowSetting,
  setSectionSetting,
  type FieldSpec,
  type SectionSettingSpec,
} from "./blocks";
import { MoveButtons } from "./MoveButtons";
import { duplicateElement } from "./canvasTools";
import { ElementStylePanel, ElementTabs, type NamedStyle } from "./ElementStylePanel";
import { SaveSectionPanel } from "./SavedSections";
import { BindingFields } from "./DataBinding";
import {
  editorUi,
  elementLabel,
  fieldHint,
  fieldLabel,
  optionLabel,
  sectionSettingLabel,
  sectionSettingOption,
  useEditorLocale,
  type EditorUi,
} from "./editorLocale";
import { ImageField, ImageListField } from "./ImageField";
import { ProductPickerField } from "./ProductPickerField";
import { ItemListField } from "./ItemListField";
import { MAX_SECTION_HEIGHT_PX } from "@/lib/canvasDrag";
import { sectionMinHeight, setSectionMinHeight } from "./canvasEdits";

/**
 * The right-hand panel. A section has no *props* of its own — the tree gives
 * sections none — so this walks the section's rows, columns and elements in
 * document order and renders a fieldset per element from that element type's
 * `FieldSpec[]`. Above them sits the one thing a section does carry, its
 * optional `settings`: background, vertical space and content width, every
 * one of them defaulting to the look the storefront already had. A section
 * with more than one column gets a small header per column (its surface and
 * alignment) and per multi-column row (the gap), so a laid-out section from
 * the library can still be reshaped here; a single-column section shows none
 * of that and reads exactly as it did.
 *
 * Content inputs are `dir="auto"`: merchants write Arabic and English copy,
 * and each field should follow the text typed into it, whatever direction the
 * editor chrome is in. URL-like fields stay left-to-right.
 */

/** Prop keys that hold URLs or ids, which always read left-to-right. */
const LTR_KEYS = new Set(["href", "url", "src", "productId", "name"]);

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
      <div className="space-y-2">
        {value.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={item}
              dir="auto"
              aria-label={ui.itemAria(itemLabel, i + 1)}
              onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={ui.removeItem(itemLabel, i + 1)}
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
      <div className="space-y-3">
        {value.map((item, i) => (
          <div key={i} className="space-y-2 rounded-[0.5rem] border border-line p-3">
            <div className="flex items-center gap-2">
              <Input
                value={item.q}
                dir="auto"
                placeholder={ui.question}
                aria-label={ui.questionAria(i + 1)}
                onChange={(e) => patch(i, "q", e.target.value)}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={ui.removeQuestion(i + 1)}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                <X className="size-4" aria-hidden />
              </Button>
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
      <div className="space-y-3">
        {value.map((item, i) => (
          <div key={i} className="space-y-2 rounded-[0.5rem] border border-line p-3">
            <div className="flex items-center gap-2">
              <Input
                value={item.title}
                dir="auto"
                placeholder={ui.stepTitle}
                aria-label={ui.stepTitleAria(i + 1)}
                onChange={(e) => patch(i, "title", e.target.value)}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={ui.removeStep(i + 1)}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                <X className="size-4" aria-hidden />
              </Button>
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
      <div className="space-y-3">
        {value.map((item, i) => (
          <div key={i} className="space-y-2 rounded-[0.5rem] border border-line p-3">
            <div className="flex items-center gap-2">
              <Input
                value={item.label}
                dir="auto"
                placeholder={ui.rowLabel}
                aria-label={ui.rowLabelAria(i + 1)}
                onChange={(e) => patch(i, "label", e.target.value)}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={ui.removeRow(i + 1)}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </div>
            <div className="flex items-center gap-2">
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
      <div className="space-y-2">
        {value.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={item.platform}
              dir="ltr"
              placeholder="instagram"
              aria-label={ui.platformAria(i + 1)}
              className="w-1/3"
              onChange={(e) => patch(i, "platform", e.target.value)}
            />
            <Input
              value={item.url}
              dir="ltr"
              placeholder="https://…"
              aria-label={ui.linkAria(i + 1)}
              onChange={(e) => patch(i, "url", e.target.value)}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={ui.removeLink(i + 1)}
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
  elementType,
  spec,
  props,
  onChange,
}: {
  elementType: PageElementType;
  spec: FieldSpec;
  props: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const locale = useEditorLocale();
  const ui = editorUi(locale);
  const raw = props[spec.key];
  const label = fieldLabel(elementType, spec.key, spec.label, locale);
  const hint = fieldHint(elementType, spec.key, spec.hint, locale);
  const dir = LTR_KEYS.has(spec.key) ? "ltr" : "auto";

  switch (spec.kind) {
    case "text":
      return (
        <TextField
          label={label}
          hint={hint}
          placeholder={spec.placeholder}
          dir={dir}
          value={asString(raw)}
          onChange={(e) => onChange(spec.key, e.target.value)}
        />
      );

    case "textarea":
      return (
        <Field label={label} hint={hint}>
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
      return (
        <Field label={label} hint={hint}>
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
      return (
        <label className="flex items-center gap-2 py-1 text-sm text-ink">
          <input
            type="checkbox"
            checked={raw === true}
            onChange={(e) => onChange(spec.key, e.target.checked)}
            className="size-4 rounded border-line text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
          />
          {label}
        </label>
      );

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
                onChange(spec.key, numeric ? Number(v) : v);
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
      return (
        <ProductPickerField
          kind={spec.kind}
          label={label}
          hint={hint}
          value={asString(raw)}
          onChange={(v) => onChange(spec.key, v)}
        />
      );

    case "image":
      return (
        <ImageField
          label={label}
          hint={hint}
          value={asString(raw)}
          onChange={(url) => onChange(spec.key, url)}
        />
      );

    case "imageList":
      return (
        <ImageListField
          label={label}
          hint={hint}
          value={asStringList(raw)}
          onChange={(urls) => onChange(spec.key, urls)}
        />
      );

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
      return (
        <QaListEditor
          label={label}
          hint={hint}
          value={asQaList(raw)}
          ui={ui}
          onChange={(next) => onChange(spec.key, next)}
        />
      );

    case "stepList":
      return (
        <StepListEditor
          label={label}
          hint={hint}
          value={asStepList(raw)}
          ui={ui}
          onChange={(next) => onChange(spec.key, next)}
        />
      );


    case "compareRows":
      return (
        <CompareRowsEditor
          label={label}
          hint={hint}
          value={asCompareRows(raw)}
          ui={ui}
          onChange={(next) => onChange(spec.key, next)}
        />
      );

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
      return (
        <LinkListEditor
          label={label}
          hint={hint}
          value={asLinkList(raw)}
          ui={ui}
          onChange={(next) => onChange(spec.key, next)}
        />
      );
  }
}

/**
 * Reorder controls for one element within its column. Renders nothing when the
 * element has no neighbour to swap with.
 */
export function ElementMoveButtons({
  section,
  elementId,
  label,
  ui,
  onChange,
}: {
  section: PageSection;
  elementId: string;
  label: string;
  ui: EditorUi;
  onChange: (next: PageSection) => void;
}) {
  const position = elementPosition(section, elementId);
  if (!position || position.count < 2) return null;
  return (
    <MoveButtons
      canMoveUp={position.index > 0}
      canMoveDown={position.index < position.count - 1}
      onMoveUp={() => onChange(moveElement(section, elementId, -1))}
      onMoveDown={() => onChange(moveElement(section, elementId, 1))}
      upLabel={ui.moveElementUp(label)}
      downLabel={ui.moveElementDown(label)}
    />
  );
}

/**
 * The fields of one element. Shared with the funnel builder's form view, which
 * lays several of these out inline instead of in a side panel; `actions` puts
 * extra controls (e.g. reordering) on the element's caption row.
 */
export function ElementFieldset({
  element,
  onPropChange,
  actions,
  onSettingsChange,
  namedStyles = [],
  onNamedStylesChange,
}: {
  element: PageElement;
  onPropChange: (element: PageElement, key: string, value: unknown) => void;
  actions?: ReactNode;
  /** With it the element gets Style and Layout tabs (ElementStylePanel). */
  onSettingsChange?: (element: PageElement, settings: Record<string, unknown> | undefined) => void;
  namedStyles?: NamedStyle[];
  onNamedStylesChange?: (next: NamedStyle[]) => void;
}) {
  const [tab, setTab] = useState<"content" | "style" | "layout">("content");
  const locale = useEditorLocale();
  const spec = ELEMENT_SPECS[element.type];
  const Icon = spec.icon;
  const props = element.props ?? {};

  return (
    <div className="space-y-3 border-b border-line px-4 py-4 last:border-b-0">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-soft">
        <Icon className="size-3.5" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{elementLabel(element.type, spec.label, locale)}</span>
        {actions}
      </div>
      {onSettingsChange && <ElementTabs value={tab} onChange={setTab} />}
      {(tab === "content" || !onSettingsChange) &&
        spec.fields.map((field) => (
          <ElementField
            key={field.key}
            elementType={element.type}
            spec={field}
            props={props}
            onChange={(key, value) => onPropChange(element, key, value)}
          />
        ))}
      {(tab === "content" || !onSettingsChange) && (
        <BindingFields element={element} onChange={(bindings) => onPropChange(element, "bindings", bindings)} />
      )}
      {onSettingsChange && tab !== "content" && (
        <ElementStylePanel
          element={element}
          tab={tab}
          named={namedStyles}
          onSettingsChange={(settings) => onSettingsChange(element, settings)}
          onNamedChange={onNamedStylesChange}
        />
      )}
    </div>
  );
}

/** One setting as a select, bilingual through the same maps whichever node it belongs to. */
function SettingSelect({
  spec,
  value,
  hint,
  onChange,
}: {
  spec: SectionSettingSpec;
  value: string;
  hint?: string;
  onChange: (value: string) => void;
}) {
  const locale = useEditorLocale();
  return (
    <Field label={sectionSettingLabel(spec.key, spec.label, locale)} hint={hint}>
      {({ id }) => (
        <Select id={id} value={value || spec.defaultValue} onChange={(e) => onChange(e.target.value)}>
          {spec.options.map((o) => (
            <option key={o.value} value={o.value}>
              {sectionSettingOption(spec.key, o.value, o.label, locale)}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

/**
 * The section's own look — the one thing on a section that isn't an element.
 * Rendered with the same `Field`/`Select` pair as an element's select field so
 * it reads as one more fieldset, not a new kind of panel. Every control
 * defaults to the storefront's existing look, and choosing that default clears
 * the key again (setSectionSetting).
 */
function SectionStyleFieldset({
  section,
  onChange,
}: {
  section: PageSection;
  onChange: (next: PageSection) => void;
}) {
  const locale = useEditorLocale();
  const ui = editorUi(locale);

  return (
    <div className="space-y-3 border-b border-line px-4 py-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-soft">
        <Palette className="size-3.5" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{ui.sectionStyle}</span>
      </div>
      {SECTION_SETTING_SPECS.map((spec, i) => (
        <SettingSelect
          key={spec.key}
          spec={spec}
          value={sectionSetting(section, spec.key)}
          hint={i === 0 ? ui.sectionStyleHint : undefined}
          onChange={(value) => onChange(setSectionSetting(section, spec.key, value))}
        />
      ))}
      <Field label={ui.minHeight} hint={ui.minHeightHint}>
        {({ id }) => (
          <Input
            id={id}
            type="number"
            min={0}
            max={MAX_SECTION_HEIGHT_PX}
            step={8}
            placeholder={ui.canvasAuto}
            value={sectionMinHeight(section) ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              const px = raw === "" ? null : Math.min(MAX_SECTION_HEIGHT_PX, Math.max(0, Math.round(Number(raw))));
              onChange(setSectionMinHeight(section, px && px > 0 ? px : null));
            }}
          />
        )}
      </Field>
    </div>
  );
}

/**
 * A column's header inside a multi-column section: its number and the little
 * bit of look a column carries (card surface, text alignment, where it sits
 * when its neighbour is taller). Only rendered when the section has more than
 * one column — the templates' single-column sections keep the plain list of
 * elements they always had.
 */
function ColumnStyleFieldset({
  section,
  column,
  index,
  heading = true,
  onChange,
}: {
  section: PageSection;
  column: PageColumn;
  index: number;
  /** Off inside a ColumnBlock, whose own row already names the column. */
  heading?: boolean;
  onChange: (next: PageSection) => void;
}) {
  const locale = useEditorLocale();
  const ui = editorUi(locale);

  return (
    <div className="space-y-3 border-b border-line bg-paper px-4 py-3">
      {heading && (
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-soft">
          <Columns3 className="size-3.5" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{ui.column(index + 1)}</span>
        </div>
      )}
      {COLUMN_SETTING_SPECS.map((spec, i) => (
        <SettingSelect
          key={spec.key}
          spec={spec}
          value={columnSetting(column, spec.key)}
          hint={i === 0 ? ui.columnHint : undefined}
          onChange={(value) => onChange(setColumnSetting(section, column.id, spec.key, value))}
        />
      ))}
    </div>
  );
}

/**
 * One column of a laid-out section, foldable.
 *
 * A section like the six department tiles is twelve elements deep. Laid out
 * flat — which is how this panel used to show it — the merchant scrolls past
 * every other tile's fields to reach the one they clicked. So each column
 * collapses to a single row that says what it holds (`columnTitle`: its own
 * first words, "تخفيضات", not "Column 3") and opens on click.
 *
 * A section of one or two columns opens flat, exactly as before: there was
 * never anything there to hunt through, and folding it would only add a click.
 */
function ColumnBlock({
  section,
  column,
  index,
  defaultOpen,
  onChange,
  renderElement,
}: {
  section: PageSection;
  column: PageColumn;
  index: number;
  defaultOpen: boolean;
  onChange: (next: PageSection) => void;
  renderElement: (element: PageElement) => ReactNode;
}) {
  const locale = useEditorLocale();
  const ui = editorUi(locale);
  const [open, setOpen] = useState(defaultOpen);
  const elements = column.elements ?? [];
  const title = columnTitle(column) ?? ui.column(index + 1);

  return (
    <div className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="cursor-pointer flex w-full items-center gap-2 bg-paper px-4 py-3 text-start hover:bg-paper-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
      >
        <ChevronDown
          className={cn("size-4 shrink-0 text-ink-soft transition-transform", !open && "-rotate-90 rtl:rotate-90")}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{title}</span>
          <span className="block text-xs text-ink-soft">{ui.elementCount(elements.length)}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-ink-soft" aria-hidden>
          {elements.slice(0, 4).map((element) => {
            const Icon = ELEMENT_SPECS[element.type].icon;
            return <Icon key={element.id} className="size-3.5" />;
          })}
        </span>
      </button>
      {open && (
        <div>
          <ColumnStyleFieldset section={section} column={column} index={index} heading={false} onChange={onChange} />
          {elements.map(renderElement)}
        </div>
      )}
    </div>
  );
}

/** A multi-column row's one setting — how far apart its columns sit. */
function RowStyleFieldset({
  section,
  row,
  index,
  onChange,
}: {
  section: PageSection;
  row: PageRow;
  index: number;
  onChange: (next: PageSection) => void;
}) {
  const locale = useEditorLocale();
  const ui = editorUi(locale);

  return (
    <div className="space-y-3 border-b border-line px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-ink-soft">{ui.rowGap(index + 1)}</div>
      {ROW_SETTING_SPECS.map((spec) => (
        <SettingSelect
          key={spec.key}
          spec={spec}
          value={rowSetting(row, spec.key)}
          onChange={(value) => onChange(setRowSetting(section, row.id, spec.key, value))}
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
  namedStyles,
  onNamedStylesChange,
  onDuplicate,
  funnelId,
}: {
  section: PageSection;
  onChange: (next: PageSection) => void;
  onDelete: () => void;
  onClose: () => void;
  /** Puts a copy of the section right after it (editor/canvasTools.ts). */
  onDuplicate?: () => void;
  /** The page's named styles (tree.globalStyles.named) and how to change them. */
  namedStyles?: NamedStyle[];
  onNamedStylesChange?: (next: NamedStyle[]) => void;
  /** In a funnel's editor: a saved section may be kept for that funnel only. */
  funnelId?: string;
}) {
  const locale = useEditorLocale();
  const ui = editorUi(locale);
  const elements = sectionElements(section);
  const columnCount = sectionColumnCount(section);
  const multiColumn = columnCount > 1;
  // Two columns side by side are readable open; a row of six tiles is not.
  const foldColumns = columnCount > 2;

  const fieldset = (element: PageElement) => (
    <ElementFieldset
      key={element.id}
      element={element}
      onPropChange={(el, key, value) => onChange(setElementProp(section, el, key, value))}
      onSettingsChange={(el, settings) => {
        const { settings: _old, ...bare } = el;
        void _old;
        onChange(replaceElement(section, el.id, settings ? { ...bare, settings } : bare));
      }}
      namedStyles={namedStyles}
      onNamedStylesChange={onNamedStylesChange}
      actions={
        <>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={ui.duplicateElement(elementLabel(element.type, ELEMENT_SPECS[element.type].label, locale))}
            title={ui.duplicateElement(elementLabel(element.type, ELEMENT_SPECS[element.type].label, locale))}
            onClick={() => onChange(duplicateElement(section, element.id))}
          >
            <Copy className="size-3.5" aria-hidden />
          </Button>
          <ElementMoveButtons
            section={section}
            elementId={element.id}
            label={elementLabel(element.type, ELEMENT_SPECS[element.type].label, locale)}
            ui={ui}
            onChange={onChange}
          />
        </>
      }
    />
  );

  // Column numbers count across the whole section, so "Column 3" in the
  // second row still names one column unambiguously.
  let columnIndex = 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate font-display text-sm font-medium text-ink">
            {sectionLabel(section, locale)}
          </h2>
          <p className="truncate text-xs text-ink-soft">{ui.elementCount(elements.length)}</p>
        </div>
        <Button type="button" size="icon" variant="ghost" aria-label={ui.closePanel} onClick={onClose}>
          <X className="size-4" aria-hidden />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <SectionStyleFieldset section={section} onChange={onChange} />
        {elements.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink-soft">{ui.noElements}</p>
        ) : !multiColumn ? (
          elements.map(fieldset)
        ) : (
          (section.rows ?? []).map((row, r) => {
            const columns = row.columns ?? [];
            return (
              <div key={row.id}>
                {columns.length > 1 && (
                  <RowStyleFieldset section={section} row={row} index={r} onChange={onChange} />
                )}
                {columns.map((column) => (
                  <ColumnBlock
                    key={column.id}
                    section={section}
                    column={column}
                    index={columnIndex++}
                    defaultOpen={foldColumns ? false : true}
                    onChange={onChange}
                    renderElement={fieldset}
                  />
                ))}
              </div>
            );
          })
        )}
      </div>

      <SaveSectionPanel section={section} onChange={onChange} funnelId={funnelId} />

      <div className="flex gap-2 border-t border-line px-4 py-3">
        {onDuplicate && (
          <Button type="button" size="sm" variant="outline" className="flex-1" onClick={onDuplicate}>
            <Copy className="size-4" aria-hidden />
            {ui.duplicateSection}
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" className="flex-1" onClick={onDelete}>
          <Trash2 className="size-4" aria-hidden />
          {ui.deleteSection}
        </Button>
      </div>
    </div>
  );
}
