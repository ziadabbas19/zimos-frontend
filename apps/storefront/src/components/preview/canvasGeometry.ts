/**
 * Reading the preview page's layout for drag and resize on the canvas — what
 * the editor needs to work out where a drag lands (see the editor's
 * lib/canvasDrag.ts). Only the website editor's preview renders the markers
 * these read (PageRenderer's editable mode); a shopper's page has none.
 *
 * Section and element boxes are in document coordinates (viewport + scroll),
 * so a drag stays right while the page scrolls under it.
 */

export const SECTION_ATTR = "data-zimos-section";
export const INDEX_ATTR = "data-zimos-index";
export const ROW_ATTR = "data-zimos-row";
export const COLUMN_ATTR = "data-zimos-column";
export const SPAN_ATTR = "data-zimos-span";
export const EL_ATTR = "data-zimos-el";
export const TYPE_ATTR = "data-zimos-type";

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function byAttr(attr: string, id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${attr}="${CSS.escape(id)}"]`);
}

export const sectionNode = (id: string) => byAttr(SECTION_ATTR, id);
export const rowNode = (id: string) => byAttr(ROW_ATTR, id);
export const columnNode = (id: string) => byAttr(COLUMN_ATTR, id);
export const elementNode = (id: string) => byAttr(EL_ATTR, id);

/** The `<section>` a section marker wraps — absent for a section with no rows. */
export function sectionBody(sectionId: string): HTMLElement | null {
  return sectionNode(sectionId)?.querySelector<HTMLElement>(":scope > section") ?? null;
}

/**
 * An element's box. Its marker is `display: contents` and has no box of its
 * own, so this is the union of what it renders — empty when it renders
 * nothing (an image with no picture yet).
 */
export function elementRect(el: HTMLElement): Rect | null {
  const range = document.createRange();
  range.selectNodeContents(el);
  const rect = range.getBoundingClientRect();
  range.detach?.();
  if (rect.width === 0 && rect.height === 0) return null;
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

/** The picture inside an image element — what its corner handle resizes. */
export function imageNode(elementId: string): HTMLImageElement | null {
  return elementNode(elementId)?.querySelector<HTMLImageElement>("img") ?? null;
}

/** The node an image's width is set on while it is being resized: the element's own top box. */
export function imageBox(elementId: string): HTMLElement | null {
  const marker = elementNode(elementId);
  return (marker?.firstElementChild as HTMLElement | null) ?? null;
}

export function isRtl(el: Element): boolean {
  return getComputedStyle(el).direction === "rtl";
}

/** Every section's box, in page order, document coordinates. */
export function sectionBoxes() {
  const y = window.scrollY;
  return Array.from(document.querySelectorAll<HTMLElement>(`[${SECTION_ATTR}]`)).map((el) => {
    const rect = el.getBoundingClientRect();
    return {
      sectionId: el.getAttribute(SECTION_ATTR) ?? "",
      index: Number(el.getAttribute(INDEX_ATTR) ?? 0),
      top: rect.top + y,
      height: rect.height,
    };
  });
}

/**
 * Every column on the page with its elements, in tree order, document
 * coordinates. An element that renders nothing still takes its place in the
 * order (at the bottom of the one before it, zero high), so a drop index
 * always counts the column the way the tree does.
 */
export function columnBoxes() {
  const x = window.scrollX;
  const y = window.scrollY;
  return Array.from(document.querySelectorAll<HTMLElement>(`[${COLUMN_ATTR}]`)).map((col) => {
    const rect = col.getBoundingClientRect();
    let cursor = rect.top + y;
    const elements = Array.from(col.querySelectorAll<HTMLElement>(`:scope > [${EL_ATTR}]`)).map((el) => {
      const box = elementRect(el);
      const top = box ? box.top + y : cursor;
      const height = box ? box.height : 0;
      cursor = top + height;
      return { elementId: el.getAttribute(EL_ATTR) ?? "", top, height };
    });
    return {
      columnId: col.getAttribute(COLUMN_ATTR) ?? "",
      sectionId: col.closest<HTMLElement>(`[${SECTION_ATTR}]`)?.getAttribute(SECTION_ATTR) ?? "",
      top: rect.top + y,
      left: rect.left + x,
      width: rect.width,
      height: rect.height,
      elements,
    };
  });
}

/** A row's columns, in tree order. */
export function rowColumns(row: HTMLElement): HTMLElement[] {
  return Array.from(row.querySelectorAll<HTMLElement>(`:scope > [${COLUMN_ATTR}]`));
}

/** One divider between two neighbouring columns that sit side by side. */
export interface Divider {
  rowId: string;
  /** The first column's index in the row. */
  index: number;
  /** Viewport x of the boundary, and the vertical extent of the pair. */
  x: number;
  top: number;
  height: number;
  spans: number[];
}

/**
 * The column boundaries in a section that can be dragged: neighbours on the
 * same line of the grid, side by side. Below the `md` breakpoint columns stack
 * and there is nothing to drag.
 */
export function sectionDividers(sectionId: string): Divider[] {
  const section = sectionNode(sectionId);
  if (!section) return [];
  const out: Divider[] = [];
  for (const row of Array.from(section.querySelectorAll<HTMLElement>(`[${ROW_ATTR}]`))) {
    const columns = rowColumns(row);
    if (columns.length < 2) continue;
    const spans = columns.map((c) => Number(c.getAttribute(SPAN_ATTR)) || 12);
    const rtl = isRtl(row);
    for (let i = 0; i < columns.length - 1; i++) {
      const a = columns[i].getBoundingClientRect();
      const b = columns[i + 1].getBoundingClientRect();
      const sameLine = Math.abs(a.top - b.top) < 4;
      const sideBySide = rtl ? b.right <= a.left + 1 : b.left >= a.right - 1;
      if (!sameLine || !sideBySide) continue;
      const x = rtl ? (a.left + b.right) / 2 : (a.right + b.left) / 2;
      const top = Math.min(a.top, b.top);
      out.push({
        rowId: row.getAttribute(ROW_ATTR) ?? "",
        index: i,
        x,
        top,
        height: Math.max(a.bottom, b.bottom) - top,
        spans,
      });
    }
  }
  return out;
}

/**
 * What the editor needs to turn a divider drag into spans: where the first
 * column of the pair starts from the row's inline-start edge, the width one
 * span adds (a twelfth of the row plus a gap), and the gap.
 */
export function dividerGeometry(rowId: string, index: number) {
  const row = rowNode(rowId);
  if (!row) return null;
  const columns = rowColumns(row);
  const first = columns[index];
  if (!first || !columns[index + 1]) return null;
  const rowRect = row.getBoundingClientRect();
  const rect = first.getBoundingClientRect();
  const rtl = isRtl(row);
  const style = getComputedStyle(row);
  const gap = parseFloat(style.columnGap) || 0;
  return {
    spans: columns.map((c) => Number(c.getAttribute(SPAN_ATTR)) || 12),
    pairStart: rtl ? rowRect.right - rect.right : rect.left - rowRect.left,
    unit: (rowRect.width + gap) / 12,
    gap,
    rtl,
  };
}

// --- what the canvas selects, patches and ghosts ---------------------------------------

/** On an element's marker: the prop that holds its one picture (PageRenderer, editable mode only). */
export const IMAGE_FIELD_ATTR = "data-zimos-image-field";
/**
 * On an element's marker: the widths at which shoppers don't see it
 * ("desktop tablet mobile", any of them) — or, after a patch, "" for "shown
 * again". On a section's marker: present when the section is hidden.
 */
export const HIDDEN_ATTR = "data-zimos-hidden";
/** The box an element's own style rules target (PageRenderer's StyledElement). */
export const STYLE_BOX_ATTR = "data-zs";

export function styleBox(marker: HTMLElement): HTMLElement | null {
  return marker.querySelector<HTMLElement>(`:scope > [${STYLE_BOX_ATTR}]`);
}

/** The node that shows an element's text: its first box, past its style wrapper. */
export function inlineTextNode(marker: HTMLElement): HTMLElement | null {
  let node = marker.firstElementChild as HTMLElement | null;
  if (node?.hasAttribute(STYLE_BOX_ATTR)) node = node.firstElementChild as HTMLElement | null;
  return node;
}

/** The prop a replaced picture goes into, when the renderer named one for this element. */
export function imageFieldOf(marker: HTMLElement): string | null {
  const field = marker.getAttribute(IMAGE_FIELD_ATTR);
  return field && /^[A-Za-z][A-Za-z0-9_]{0,59}$/.test(field) ? field : null;
}

/** The storefront's own breakpoints for per-device element styles (page-renderer/elementStyle.ts). */
export type ViewDevice = "desktop" | "tablet" | "mobile";

export function viewDevice(): ViewDevice {
  const width = window.innerWidth;
  return width <= 639 ? "mobile" : width <= 1023 ? "tablet" : "desktop";
}

/** Whether shoppers at this width don't see the node (an element's marker, or a section's). */
export function isHiddenNow(node: Element): boolean {
  const value = node.getAttribute(HIDDEN_ATTR);
  if (value === null) return false;
  if (node.hasAttribute(SECTION_ATTR)) return true;
  return value.split(" ").includes(viewDevice());
}

/** A section is hidden when it says so itself, or when every element in it is. */
export function sectionHidden(sectionId: string): boolean {
  const section = sectionNode(sectionId);
  if (!section) return false;
  if (section.hasAttribute(HIDDEN_ATTR)) return true;
  const elements = Array.from(section.querySelectorAll(`[${EL_ATTR}]`));
  return elements.length > 0 && elements.every(isHiddenNow);
}
