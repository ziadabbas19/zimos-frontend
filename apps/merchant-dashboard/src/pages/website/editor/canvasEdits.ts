import type { PageElement, PageSection } from "@store-builder/api-client";
import type { CanvasEdit, ScreenDevice } from "@/lib/canvasDrag";
import { withDeviceValue } from "@/lib/deviceValue";
import { moveElement, moveSection, replaceElement } from "./blocks";

/**
 * The tree edits that drag and resize on the preview make (lib/canvasDrag.ts
 * decides WHICH edit; this applies it). All immutable, and each returns the
 * very same array when nothing would change, so a drop in place records no
 * undo step and posts no preview.
 *
 * New keys, both optional and absent from every page written before them:
 *  - `section.settings.minHeight` — px; the storefront gives the section at
 *    least that height (page-renderer/layout.ts `sectionMinHeight`).
 *  - `image.props.width` — percent of its column (10–99); the storefront caps
 *    the picture at that width, centred (elements.tsx `ImageElement`). It
 *    replaces the named `size`, so the two are never set together.
 *
 * Neither is per breakpoint: the page tree has no per-breakpoint values, so a
 * size set in the tablet or phone preview applies at every width.
 */

export function sectionMinHeight(section: PageSection): number | null {
  const raw = (section.settings as Record<string, unknown> | undefined)?.minHeight;
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : null;
}

/** Sets or clears a section's minimum height, dropping `settings` when it empties. */
/** The element's settings with its own font (`settings.font`, see components/fonts) set, or dropped for null; everything else stays. */
export function withFont(element: PageElement, pair: { ar: string | null; en: string | null } | null): Record<string, unknown> | undefined {
  const current = element.settings && typeof element.settings === "object" && !Array.isArray(element.settings) ? element.settings : {};
  const next: Record<string, unknown> = { ...current };
  if (pair && (pair.ar || pair.en)) next.font = { ...(pair.ar ? { ar: pair.ar } : {}), ...(pair.en ? { en: pair.en } : {}) };
  else delete next.font;
  return Object.keys(next).length > 0 ? next : undefined;
}

/** The section with its own font (`settings.font`, see components/fonts) set, or dropped for null; its other settings stay. */
export function setSectionFont(section: PageSection, pair: { ar: string | null; en: string | null } | null): PageSection {
  const settings: Record<string, unknown> = { ...(section.settings ?? {}) };
  if (pair && (pair.ar || pair.en)) settings.font = { ...(pair.ar ? { ar: pair.ar } : {}), ...(pair.en ? { en: pair.en } : {}) };
  else delete settings.font;
  const next: PageSection = { ...section };
  if (Object.keys(settings).length === 0) delete next.settings;
  else next.settings = settings;
  return next;
}

export function setSectionMinHeight(section: PageSection, px: number | null): PageSection {
  if (sectionMinHeight(section) === px) return section;
  const settings: Record<string, unknown> = { ...(section.settings ?? {}) };
  if (px === null) delete settings.minHeight;
  else settings.minHeight = px;
  const next: PageSection = { ...section };
  if (Object.keys(settings).length === 0) delete next.settings;
  else next.settings = settings;
  return next;
}

/** Sets the spans of two neighbouring columns in one row. */
export function setColumnSpans(section: PageSection, rowId: string, index: number, spans: [number, number]): PageSection {
  let changed = false;
  const rows = (section.rows ?? []).map((row) => {
    if (row.id !== rowId) return row;
    const columns = row.columns ?? [];
    const a = columns[index];
    const b = columns[index + 1];
    if (!a || !b || (a.span === spans[0] && b.span === spans[1])) return row;
    changed = true;
    return {
      ...row,
      columns: columns.map((col, i) => (i === index ? { ...col, span: spans[0] } : i === index + 1 ? { ...col, span: spans[1] } : col)),
    };
  });
  return changed ? { ...section, rows } : section;
}

function findElement(section: PageSection, elementId: string): PageElement | null {
  for (const row of section.rows ?? []) {
    for (const col of row.columns ?? []) {
      const found = (col.elements ?? []).find((el) => el.id === elementId);
      if (found) return found;
    }
  }
  return null;
}

/** An image's width in percent of its column, or null for the full width (which also clears `size`). */
export function setImageWidth(section: PageSection, elementId: string, pct: number | null): PageSection {
  const element = findElement(section, elementId);
  if (!element || element.type !== "image") return section;
  const props = (element.props ?? {}) as Record<string, unknown>;
  const current = typeof props.width === "number" ? props.width : null;
  if (current === pct && props.size === undefined) return section;
  const nextProps = { ...props };
  delete nextProps.size;
  if (pct === null) delete nextProps.width;
  else nextProps.width = pct;
  return replaceElement(section, elementId, { ...element, props: nextProps });
}

type Blob = Record<string, unknown>;

function isBlob(value: unknown): value is Blob {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** `owner` with `key` set to `value`, or without it when the value is undefined. */
function withKey(owner: Blob, key: string, value: unknown): Blob {
  const next = { ...owner };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}

/** The same size on one screen, written to one place: `<field>W` / `<field>H` of `owner`. */
function sizedOwner(owner: Blob, field: string, device: ScreenDevice, width: number | null | undefined, height: number | null | undefined): Blob {
  let next = owner;
  if (width !== undefined) next = withKey(next, `${field}W`, withDeviceValue(next[`${field}W`], device, width));
  if (height !== undefined) next = withKey(next, `${field}H`, withDeviceValue(next[`${field}H`], device, height));
  return next;
}

/** A list of sizes kept by place beside a list of picture addresses (`imagesW` beside `images`). */
function sizedList(list: unknown, at: number, device: ScreenDevice, value: number | null): unknown[] | undefined {
  const next = Array.isArray(list) ? [...list] : [];
  while (next.length <= at) next.push(null);
  next[at] = withDeviceValue(next[at], device, value) ?? null;
  while (next.length > 0 && next[next.length - 1] === null) next.pop();
  return next.length > 0 ? next : undefined;
}

/**
 * A band's props after one of its pictures is given a size on one screen
 * (`edit.path`: "image", "items.2.image", "images.1"). With `scope: "band"`,
 * every picture of the same list takes it. The size goes beside the picture —
 * `imageW` / `imageH` in the item (or the band) that holds it, `imagesW[i]` /
 * `imagesH[i]` for a list of addresses — so it moves with its item when items
 * are reordered. The storefront reads it in components/xs/XsPicture.
 */
export function sizedPictureProps(props: Blob, edit: Extract<CanvasEdit, { kind: "picture-size" }>): Blob {
  const parts = edit.path.split(".");
  const { device, width, height } = edit;
  if (parts.length === 1) return sizedOwner(props, parts[0], device, width, height);
  const [list, place, field] = parts;
  const at = Number(place);
  const items = props[list];
  if (!Array.isArray(items) || !Number.isInteger(at) || at < 0 || at >= items.length) return props;
  const places = edit.scope === "band" ? items.map((_, i) => i) : [at];
  if (field) {
    const nextItems = items.map((item, i) => (places.includes(i) && isBlob(item) ? sizedOwner(item, field, device, width, height) : item));
    return { ...props, [list]: nextItems };
  }
  let next = props;
  for (const i of places) {
    if (width !== undefined) next = withKey(next, `${list}W`, sizedList(next[`${list}W`], i, device, width));
    if (height !== undefined) next = withKey(next, `${list}H`, sizedList(next[`${list}H`], i, device, height));
  }
  return next;
}

/**
 * The most items each of a band's lists may hold: a duplicate past it is not made.
 */
function listMax(type: string, list: string): number {
  if (list === "images") return type === "xs_gallery" ? 12 : 3;
  if (list === "slides") return 8;
  return ["xs_banners", "xs_story", "xs_posts"].includes(type) ? 6 : 8;
}

/**
 * One item of a band's list moved, duplicated or deleted on the canvas. A
 * gallery's or split's pictures carry their sizes in lists beside them
 * (imagesW, imagesH), which go along. The same section back when nothing changes.
 */
export function setBandItem(section: PageSection, edit: Extract<CanvasEdit, { kind: "band-item" }>): PageSection {
  const element = findElement(section, edit.elementId);
  if (!element || !element.type.startsWith("xs_")) return section;
  const props = (element.props ?? {}) as Blob;
  const items = props[edit.list];
  if (!Array.isArray(items) || edit.from >= items.length) return section;
  const beside = [edit.list, `${edit.list}W`, `${edit.list}H`].filter((key) => key === edit.list || Array.isArray(props[key]));
  const next: Blob = { ...props };
  for (const key of beside) {
    const list = [...(props[key] as unknown[])];
    if (edit.action === "move") {
      if (edit.to === undefined || edit.to >= items.length || edit.to === edit.from) return section;
      const [moved] = list.splice(edit.from, 1);
      list.splice(edit.to, 0, moved);
    } else if (edit.action === "duplicate") {
      if (items.length >= listMax(element.type, edit.list)) return section;
      list.splice(edit.from + 1, 0, structuredClone(list[edit.from]));
    } else {
      if (items.length <= 1) return section;
      list.splice(edit.from, 1);
    }
    next[key] = list;
  }
  return replaceElement(section, edit.elementId, { ...element, props: next });
}

/** A band's ground picture centred on a new point: "slides.0.image" → slides[0].imagePosition, "image" → imagePosition. */
export function setBackgroundPosition(section: PageSection, edit: Extract<CanvasEdit, { kind: "bg-position" }>): PageSection {
  const element = findElement(section, edit.elementId);
  if (!element || !element.type.startsWith("xs_")) return section;
  const props = (element.props ?? {}) as Blob;
  const value = `${edit.x}% ${edit.y}%`;
  const parts = edit.path.split(".");
  const key = `${parts[parts.length - 1]}Position`;
  let nextProps: Blob;
  if (parts.length === 1) {
    if (props[key] === value) return section;
    nextProps = { ...props, [key]: value };
  } else {
    const [list, at] = [parts[0], Number(parts[1])];
    const items = Array.isArray(props[list]) ? (props[list] as unknown[]) : null;
    const item = items?.[at];
    if (!items || !item || typeof item !== "object") return section;
    if ((item as Blob)[key] === value) return section;
    nextProps = { ...props, [list]: items.map((it, i) => (i === at ? { ...(it as Blob), [key]: value } : it)) };
  }
  return replaceElement(section, edit.elementId, { ...element, props: nextProps });
}

/** A picture of one band resized on the canvas; the same section back when nothing changes. */
export function setPictureSize(section: PageSection, edit: Extract<CanvasEdit, { kind: "picture-size" }>): PageSection {
  const element = findElement(section, edit.elementId);
  if (!element || !element.type.startsWith("xs_")) return section;
  const props = (element.props ?? {}) as Blob;
  const nextProps = sizedPictureProps(props, edit);
  if (JSON.stringify(nextProps) === JSON.stringify(props)) return section;
  return replaceElement(section, edit.elementId, { ...element, props: nextProps });
}

/**
 * Moves an element to `index` in the column `columnId`, anywhere on the page
 * — within its own column, to another column of its section, or into another
 * section. `index` counts the target column as it is before the move, the way
 * the frame measured it.
 */
export function moveElementTo(sections: PageSection[], elementId: string, columnId: string, index: number): PageSection[] {
  let moving: PageElement | null = null;
  let fromColumn: string | null = null;
  let fromIndex = -1;
  let hasTarget = false;
  for (const section of sections) {
    for (const row of section.rows ?? []) {
      for (const col of row.columns ?? []) {
        if (col.id === columnId) hasTarget = true;
        const i = (col.elements ?? []).findIndex((el) => el.id === elementId);
        if (i !== -1) {
          moving = col.elements[i];
          fromColumn = col.id;
          fromIndex = i;
        }
      }
    }
  }
  if (!moving || !hasTarget) return sections;
  // Dropping into its own slot, or the one just after it, changes nothing.
  if (fromColumn === columnId && (index === fromIndex || index === fromIndex + 1)) return sections;
  const target = fromColumn === columnId && fromIndex < index ? index - 1 : index;
  const element = moving;

  return sections.map((section) => {
    let touched = false;
    const rows = (section.rows ?? []).map((row) => {
      let rowTouched = false;
      const columns = (row.columns ?? []).map((col) => {
        const isSource = col.id === fromColumn;
        const isTarget = col.id === columnId;
        if (!isSource && !isTarget) return col;
        rowTouched = true;
        let elements = col.elements ?? [];
        if (isSource) elements = elements.filter((el) => el.id !== elementId);
        if (isTarget) {
          elements = elements.slice();
          elements.splice(Math.min(elements.length, Math.max(0, target)), 0, element);
        }
        return { ...col, elements };
      });
      if (!rowTouched) return row;
      touched = true;
      return { ...row, columns };
    });
    return touched ? { ...section, rows } : section;
  });
}

/** Applies one edit from the canvas; the same array back when it changes nothing. */
export function applyCanvasEdit(sections: PageSection[], edit: CanvasEdit): PageSection[] {
  const updateSection = (sectionId: string, update: (s: PageSection) => PageSection) => {
    let changed = false;
    const next = sections.map((s) => {
      if (s.id !== sectionId) return s;
      const updated = update(s);
      if (updated !== s) changed = true;
      return updated;
    });
    return changed ? next : sections;
  };

  switch (edit.kind) {
    case "move-section": {
      const from = sections.findIndex((s) => s.id === edit.sectionId);
      return from === -1 ? sections : moveSection(sections, from, edit.to);
    }
    case "move-element":
      return moveElementTo(sections, edit.elementId, edit.columnId, edit.index);
    case "section-height":
      return updateSection(edit.sectionId, (s) => setSectionMinHeight(s, edit.px));
    case "column-spans":
      return updateSection(edit.sectionId, (s) => setColumnSpans(s, edit.rowId, edit.index, edit.spans));
    case "image-width":
      return updateSection(edit.sectionId, (s) => setImageWidth(s, edit.elementId, edit.pct));
    case "picture-size":
      return updateSection(edit.sectionId, (s) => setPictureSize(s, edit));
    case "bg-position":
      return updateSection(edit.sectionId, (s) => setBackgroundPosition(s, edit));
    case "band-item":
      return updateSection(edit.sectionId, (s) => setBandItem(s, edit));
    case "logo-size":
    case "shell-move":
      // The store look's, not the page's: the editor applies it to the header or footer (WebsiteEditorPage).
      return sections;
  }
}

/** One arrow-key press on an element's grip: up or down a place within its own column. */
export function nudgeElement(sections: PageSection[], sectionId: string, elementId: string, delta: -1 | 1): PageSection[] {
  let changed = false;
  const next = sections.map((s) => {
    if (s.id !== sectionId) return s;
    const moved = moveElement(s, elementId, delta);
    if (JSON.stringify(moved.rows) !== JSON.stringify(s.rows)) changed = true;
    return moved;
  });
  return changed ? next : sections;
}
