import { useState, type ReactNode } from "react";
import { Button, Input, cn } from "@store-builder/ui";
import type { PageElement } from "@store-builder/api-client";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { Segmented } from "@/components/Segmented";
import { useEditorLocale } from "./editorLocale";
import { ColourControl, Group, NumberField, SwitchRow } from "./inspector/controls";
import { inspectorUi, type InspectorUi } from "./inspector/strings";

/**
 * The look of one element.
 *
 *   element.settings.style    = { base, tablet, mobile }
 *   element.settings.styleRef = id of a named style
 *
 * Design happens on desktop (`base`). While tablet or mobile is selected, a
 * change is stored for that device only, and a field with nothing of its own
 * shows the value it inherits as a placeholder. Named styles live in the page
 * tree's `globalStyles.named`; an element that points at one takes its look
 * and may still override it.
 *
 * `tab="all"` is the inspector's Style page: one screen switch, then the
 * fields in foldable groups (Text, Background, Border, Shadow, Size,
 * Spacing, Advanced, Entrance, Shared style). `tab="style"` and
 * `tab="layout"` keep the two halves the old element tabs showed.
 *
 * The contract (keys, ranges) is the backend's modules/pages/elementStyle.js,
 * and the storefront turns it into CSS in page-renderer/elementStyle.ts.
 */

export type StyleDevice = "base" | "tablet" | "mobile";
type Style = Record<string, unknown>;
type DeviceStyles = Partial<Record<StyleDevice, Style>>;
export interface NamedStyle {
  id: string;
  name: string;
  style: DeviceStyles;
}

const STRINGS = {
  en: {
    content: "Content",
    style: "Style",
    layout: "Layout",
    color: "Text colour",
    background: "Background colour",
    fontSize: "Text size (px)",
    fontWeight: "Text weight",
    lineHeight: "Line height (%)",
    borderWidth: "Border width (px)",
    borderStyle: "Border type",
    borderColor: "Border colour",
    radius: "Corner radius (px)",
    shadow: "Shadow",
    opacity: "Opacity (%)",
    width: "Width (% of column)",
    maxWidth: "Widest (px)",
    hidden: "Hide on this device",
    align: "Alignment",
    paddingTop: "Inside: top",
    paddingBottom: "Inside: bottom",
    paddingStart: "Inside: start",
    paddingEnd: "Inside: end",
    marginTop: "Outside: above",
    marginBottom: "Outside: below",
    unset: "Default",
    start: "Start",
    center: "Centre",
    end: "End",
    solid: "Solid",
    dashed: "Dashed",
    dotted: "Dotted",
    none: "None",
    sm: "Small",
    md: "Medium",
    lg: "Large",
    reset: "Clear this screen's changes",
    named: "Shared style",
    namedNone: "None",
    namedHint: "A shared style is used by several elements: changing it restyles every one of them.",
    saveAs: "Save this look as a shared style",
    newName: "Style name, e.g. Primary button",
    create: "Save",
    update: "Update the shared style with this look",
  },
  ar: {
    content: "المحتوى",
    style: "الشكل",
    layout: "التخطيط",
    color: "لون النص",
    background: "لون الخلفية",
    fontSize: "حجم النص (px)",
    fontWeight: "سُمك النص",
    lineHeight: "ارتفاع السطر (%)",
    borderWidth: "سُمك الإطار (px)",
    borderStyle: "نوع الإطار",
    borderColor: "لون الإطار",
    radius: "استدارة الزوايا (px)",
    shadow: "الظل",
    opacity: "الشفافية (%)",
    width: "العرض (% من العمود)",
    maxWidth: "أقصى عرض (px)",
    hidden: "إخفاء على هذا الجهاز",
    align: "المحاذاة",
    paddingTop: "الداخلية: أعلى",
    paddingBottom: "الداخلية: أسفل",
    paddingStart: "الداخلية: البداية",
    paddingEnd: "الداخلية: النهاية",
    marginTop: "الخارجية: أعلى",
    marginBottom: "الخارجية: أسفل",
    unset: "الافتراضي",
    start: "البداية",
    center: "الوسط",
    end: "النهاية",
    solid: "متصل",
    dashed: "متقطع",
    dotted: "منقط",
    none: "بدون",
    sm: "صغير",
    md: "متوسط",
    lg: "كبير",
    reset: "مسح تغييرات هذه الشاشة",
    named: "ستايل مسمّى",
    namedNone: "بدون",
    namedHint: "النمط المشترك تستخدمه عدة عناصر: تغييره يغيّر مظهرها كلها.",
    saveAs: "حفظ هذا المظهر نمطًا مشتركًا",
    newName: "اسم الستايل، مثال: الزرار الأساسي",
    create: "حفظ",
    update: "تحديث النمط المشترك بهذا المظهر",
  },
} as const;
type T = (typeof STRINGS)["en"];
type Key = keyof T;

/** Which of the two old tabs a field belonged to. */
type Half = "style" | "layout";

type Spec = { key: Key; half: Half } & (
  | { kind: "number"; min: number; max: number; step?: number; narrow?: boolean }
  | { kind: "colour" }
  | { kind: "select"; options: Array<{ value: string; label: Key }>; numeric?: boolean }
);

type GroupId = "text" | "background" | "border" | "shadow" | "size" | "spacing" | "advanced";

interface GroupSpec {
  id: GroupId;
  title: keyof InspectorUi & `group${string}`;
  fields: Spec[];
}

const GROUPS: GroupSpec[] = [
  {
    id: "text",
    title: "groupText",
    fields: [
      { key: "color", kind: "colour", half: "style" },
      { key: "fontSize", kind: "number", min: 8, max: 160, half: "style" },
      {
        key: "fontWeight",
        kind: "select",
        numeric: true,
        half: "style",
        options: [300, 400, 500, 600, 700, 800, 900].map((w) => ({ value: String(w), label: String(w) as Key })),
      },
      { key: "lineHeight", kind: "number", min: 80, max: 300, step: 10, half: "style" },
      {
        key: "align",
        kind: "select",
        half: "layout",
        options: [
          { value: "start", label: "start" },
          { value: "center", label: "center" },
          { value: "end", label: "end" },
        ],
      },
    ],
  },
  {
    id: "background",
    title: "groupBackground",
    fields: [{ key: "background", kind: "colour", half: "style" }],
  },
  {
    id: "border",
    title: "groupBorder",
    fields: [
      { key: "borderWidth", kind: "number", min: 0, max: 20, half: "style" },
      {
        key: "borderStyle",
        kind: "select",
        half: "style",
        options: [
          { value: "solid", label: "solid" },
          { value: "dashed", label: "dashed" },
          { value: "dotted", label: "dotted" },
          { value: "none", label: "none" },
        ],
      },
      { key: "borderColor", kind: "colour", half: "style" },
      { key: "radius", kind: "number", min: 0, max: 200, step: 2, half: "style" },
    ],
  },
  {
    id: "shadow",
    title: "groupShadow",
    fields: [
      {
        key: "shadow",
        kind: "select",
        half: "style",
        options: [
          { value: "none", label: "none" },
          { value: "sm", label: "sm" },
          { value: "md", label: "md" },
          { value: "lg", label: "lg" },
        ],
      },
      { key: "opacity", kind: "number", min: 0, max: 100, step: 5, half: "style" },
    ],
  },
  {
    id: "size",
    title: "groupSize",
    fields: [
      { key: "width", kind: "number", min: 5, max: 100, step: 5, half: "layout" },
      { key: "maxWidth", kind: "number", min: 50, max: 2000, step: 50, half: "layout" },
    ],
  },
  {
    id: "spacing",
    title: "groupSpacing",
    fields: [
      { key: "paddingTop", kind: "number", min: 0, max: 300, step: 4, narrow: true, half: "layout" },
      { key: "paddingBottom", kind: "number", min: 0, max: 300, step: 4, narrow: true, half: "layout" },
      { key: "paddingStart", kind: "number", min: 0, max: 300, step: 4, narrow: true, half: "layout" },
      { key: "paddingEnd", kind: "number", min: 0, max: 300, step: 4, narrow: true, half: "layout" },
      { key: "marginTop", kind: "number", min: 0, max: 300, step: 4, narrow: true, half: "layout" },
      { key: "marginBottom", kind: "number", min: 0, max: 300, step: 4, narrow: true, half: "layout" },
    ],
  },
];

const DEVICES: readonly StyleDevice[] = ["base", "tablet", "mobile"];

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

export function elementStyles(element: PageElement): DeviceStyles {
  const raw = isObject(element.settings) ? element.settings.style : null;
  if (!isObject(raw)) return {};
  const out: DeviceStyles = {};
  for (const device of DEVICES) {
    if (isObject(raw[device])) out[device] = raw[device] as Style;
  }
  return out;
}

/** The id of the named style an element points at, or "". */
export function styleRefOf(element: PageElement): string {
  return isObject(element.settings) && typeof element.settings.styleRef === "string" ? element.settings.styleRef : "";
}

/** Named styles of a page tree's `globalStyles`, ignoring anything malformed. */
export function namedStylesOf(globalStyles: unknown): NamedStyle[] {
  const named = isObject(globalStyles) ? globalStyles.named : null;
  if (!Array.isArray(named)) return [];
  return named.filter(
    (n): n is NamedStyle => isObject(n) && typeof n.id === "string" && typeof n.name === "string" && isObject(n.style)
  );
}

/** Drops empty devices and an empty style, so an untouched element stays untouched. */
function compact(styles: DeviceStyles): DeviceStyles | undefined {
  const out: DeviceStyles = {};
  for (const device of DEVICES) {
    const style = styles[device];
    if (style && Object.keys(style).length > 0) out[device] = style;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function withStyles(element: PageElement, styles: DeviceStyles, styleRef: string | undefined): Record<string, unknown> | undefined {
  const { style: _style, styleRef: _ref, ...rest } = (isObject(element.settings) ? element.settings : {}) as Record<string, unknown>;
  void _style;
  void _ref;
  const next: Record<string, unknown> = { ...rest };
  const compacted = compact(styles);
  if (compacted) next.style = compacted;
  if (styleRef) next.styleRef = styleRef;
  return Object.keys(next).length > 0 ? next : undefined;
}

/**
 * The element's settings with some style values written per device — a value
 * of `undefined` removes its key. Everything else in the settings, and the
 * named style the element points at, stay as they are.
 */
export function patchElementStyles(element: PageElement, patch: Partial<Record<StyleDevice, Style>>): Record<string, unknown> | undefined {
  const styles = elementStyles(element);
  const next: DeviceStyles = { ...styles };
  for (const device of DEVICES) {
    const changes = patch[device];
    if (!changes) continue;
    const style: Style = { ...(styles[device] ?? {}) };
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) delete style[key];
      else style[key] = value;
    }
    next[device] = style;
  }
  return withStyles(element, next, styleRefOf(element) || undefined);
}

export function ElementStylePanel({
  element,
  tab,
  named,
  onSettingsChange,
  onNamedChange,
  showHide = true,
}: {
  element: PageElement;
  /** "all" is the whole look on one page; "style" and "layout" are the two old halves of it. */
  tab: "style" | "layout" | "all";
  named: NamedStyle[];
  onSettingsChange: (settings: Record<string, unknown> | undefined) => void;
  /** Absent where named styles cannot be saved (the funnel step editor). */
  onNamedChange?: (next: NamedStyle[]) => void;
  /** The per-device "hide" switch. Off where the Visibility page holds it (inspector/HideOnDevices.tsx). */
  showHide?: boolean;
}) {
  const locale = useEditorLocale();
  const t: T = STRINGS[locale] as unknown as T;
  const ti = inspectorUi(locale);
  const [device, setDevice] = useState<StyleDevice>("base");
  const [newName, setNewName] = useState("");

  const styles = elementStyles(element);
  const styleRef = styleRefOf(element);
  const refStyle = named.find((n) => n.id === styleRef)?.style ?? {};
  const own = styles[device] ?? {};
  // What a field shows when this device has nothing of its own for it.
  const inherited = (key: string): unknown =>
    device === "base"
      ? refStyle.base?.[key]
      : (styles.base?.[key] ?? refStyle[device]?.[key] ?? refStyle.base?.[key]);

  function setValue(key: string, value: unknown) {
    const nextDevice: Style = { ...own };
    if (value === undefined || value === "") delete nextDevice[key];
    else nextDevice[key] = value;
    onSettingsChange(withStyles(element, { ...styles, [device]: nextDevice }, styleRef || undefined));
  }

  const shows = (half: Half) => tab === "all" || tab === half;
  const screenName: Record<StyleDevice, string> = { base: ti.screenDesktop, tablet: ti.screenTablet, mobile: ti.screenMobile };

  function field(spec: Spec): ReactNode {
    const value = own[spec.key];
    const fallback = inherited(spec.key);
    const reactKey = `${device}:${spec.key}`;
    if (spec.kind === "number") {
      return (
        <NumberField
          key={reactKey}
          label={t[spec.key]}
          strict
          integer
          min={spec.min}
          max={spec.max}
          step={spec.step}
          placeholder={typeof fallback === "number" ? String(fallback) : undefined}
          startAt={typeof fallback === "number" ? fallback : undefined}
          value={typeof value === "number" ? value : ""}
          onChange={(next) => setValue(spec.key, next === "" ? undefined : next)}
        />
      );
    }
    if (spec.kind === "colour") {
      return (
        <ColourControl
          key={reactKey}
          label={t[spec.key]}
          value={typeof value === "string" ? value : undefined}
          fallback={typeof fallback === "string" ? fallback : undefined}
          onChange={(hex) => setValue(spec.key, hex)}
        />
      );
    }
    return (
      <Field key={reactKey} label={t[spec.key]}>
        {({ id }) => (
          <Select
            id={id}
            value={value === undefined || value === null ? "" : String(value)}
            onChange={(e) =>
              setValue(spec.key, e.target.value === "" ? undefined : spec.numeric ? Number(e.target.value) : e.target.value)
            }
          >
            <option value="">
              {t.unset}
              {fallback !== undefined && fallback !== null ? ` (${String(fallback)})` : ""}
            </option>
            {spec.options.map((o) => (
              <option key={o.value} value={o.value}>
                {(t as Record<string, string>)[o.label] ?? o.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
    );
  }

  /** The fields of a group, the narrow numbers two to a line. */
  function fieldsOf(specs: Spec[]): ReactNode[] {
    const out: ReactNode[] = [];
    let pair: Spec[] = [];
    const flush = () => {
      if (pair.length === 0) return;
      out.push(
        <div key={`grid:${pair[0].key}`} className="grid grid-cols-2 items-end gap-x-2 gap-y-3">
          {pair.map(field)}
        </div>
      );
      pair = [];
    };
    for (const spec of specs) {
      if (spec.kind === "number" && spec.narrow) {
        pair.push(spec);
        continue;
      }
      flush();
      out.push(field(spec));
    }
    flush();
    return out;
  }

  const hasOwn = Object.keys(own).length > 0;
  const changed = (["tablet", "mobile"] as const).filter((d) => Object.keys(styles[d] ?? {}).length > 0);

  const groups = GROUPS.map((group) => {
    const specs = group.fields.filter((spec) => shows(spec.half));
    if (specs.length === 0) return null;
    const keys = specs.map((spec) => spec.key as string);
    const setHere = keys.filter((key) => own[key] !== undefined).length;
    return (
      <Group
        key={group.id}
        id={`style:${group.id}`}
        title={ti[group.title]}
        hint={group.id === "spacing" ? ti.groupSpacingHint : undefined}
        mark={setHere}
        collapsible
        defaultOpen={group.id === "text" || setHere > 0}
      >
        {fieldsOf(specs)}
      </Group>
    );
  });

  return (
    <div data-slot="inspector-style">
      <div className="space-y-2 border-b border-line px-4 py-3">
        <Segmented
          value={device}
          onChange={setDevice}
          label={ti.screensLabel}
          size="sm"
          className="w-full"
          options={DEVICES.map((d) => ({ value: d, label: screenName[d] }))}
        />
        {device !== "base" && <p className="text-xs leading-5 text-ink-soft">{ti.onlyThisScreen(screenName[device])}</p>}
        {changed.length > 0 && (
          <p className="text-xs leading-5 text-ink-soft">{ti.ownChanges(changed.map((d) => screenName[d]).join(ti.joiner))}</p>
        )}
      </div>

      {groups}

      {shows("style") && showHide && (
        <div className="border-b border-line px-4 py-2">
          <SwitchRow
            label={t.hidden}
            checked={own.hidden === true}
            onChange={(checked) => setValue("hidden", checked ? true : device === "base" ? undefined : false)}
          />
        </div>
      )}


      {shows("style") && (
        <Group id="style:named" title={ti.groupNamed} mark={styleRef ? 1 : 0} collapsible defaultOpen={Boolean(styleRef)}>
          <Field label={t.named} hint={t.namedHint}>
            {({ id }) => (
              <Select id={id} value={styleRef} onChange={(e) => onSettingsChange(withStyles(element, styles, e.target.value || undefined))}>
                <option value="">{t.namedNone}</option>
                {named.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {onNamedChange && styleRef && compact(styles) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-auto min-h-8 py-1.5 whitespace-normal"
              onClick={() => {
                // The element's own look moves into the shared style; the element keeps only the reference.
                onNamedChange(
                  named.map((n) =>
                    n.id === styleRef
                      ? {
                          ...n,
                          style: {
                            base: { ...n.style.base, ...styles.base },
                            tablet: { ...n.style.tablet, ...styles.tablet },
                            mobile: { ...n.style.mobile, ...styles.mobile },
                          },
                        }
                      : n
                  )
                );
                onSettingsChange(withStyles(element, {}, styleRef));
              }}
            >
              {t.update}
            </Button>
          )}
          {onNamedChange && compact(styles) && named.length < 40 && (
            <div className="flex items-center gap-2">
              <Input aria-label={t.saveAs} placeholder={t.newName} maxLength={80} value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Button
                type="button"
                size="sm"
                disabled={!newName.trim()}
                title={t.saveAs}
                onClick={() => {
                  const id = `s-${Math.random().toString(36).slice(2, 10)}`;
                  onNamedChange([...named, { id, name: newName.trim(), style: compact(styles) ?? {} }]);
                  onSettingsChange(withStyles(element, {}, id));
                  setNewName("");
                }}
              >
                {t.create}
              </Button>
            </div>
          )}
        </Group>
      )}

      {hasOwn && (
        <div className="px-4 py-3">
          <Button type="button" variant="outline" size="sm" onClick={() => onSettingsChange(withStyles(element, { ...styles, [device]: {} }, styleRef || undefined))}>
            {t.reset}
          </Button>
        </div>
      )}
    </div>
  );
}

export type ElementTab = "content" | "style" | "layout";

/**
 * The Content / Style / Layout switch above an element's fields.
 */
export function ElementTabs({
  value,
  onChange,
}: {
  value: ElementTab;
  onChange: (tab: ElementTab) => void;
}) {
  const locale = useEditorLocale();
  const t = STRINGS[locale];
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {(["content", "style", "layout"] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={value === tab}
          onClick={() => onChange(tab)}
          className={cn(
            "-mb-px inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1 border-b-2 px-3 py-1.5 text-xs font-medium whitespace-nowrap pointer-coarse:min-h-11",
            value === tab ? "border-primary text-primary" : "border-transparent text-ink-soft hover:text-ink"
          )}
        >
          {t[tab]}
        </button>
      ))}
    </div>
  );
}
