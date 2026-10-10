import type { PageElement, PageSection } from "@store-builder/api-client";

/**
 * Item 95, shared by the website and funnel page editors:
 * duplicating a section or an element, and the text a double-click on the
 * canvas edits in place (the storefront's PreviewBridge posts
 * `zimos:edit-text`).
 */

/** A fresh id for a copy: the original's, with an earlier copy's suffix swapped for a new one. */
function copyId(id: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 6)
      : Math.random().toString(36).slice(2, 8);
  const base = (id || "n").replace(/-c[0-9a-z]{6}$/, "");
  return `${base}-c${rand}`;
}

function cloneElement(element: PageElement): PageElement {
  const copy = JSON.parse(JSON.stringify(element)) as PageElement;
  return { ...copy, id: copyId(element.id) };
}

/** The section and everything in it, each node with a new id. Its look and any saved-section link come along. */
export function duplicateSection(section: PageSection): PageSection {
  const copy = JSON.parse(JSON.stringify(section)) as PageSection;
  return {
    ...copy,
    id: copyId(section.id),
    rows: (copy.rows ?? []).map((row) => ({
      ...row,
      id: copyId(row.id),
      columns: (row.columns ?? []).map((column) => ({
        ...column,
        id: copyId(column.id),
        elements: (column.elements ?? []).map(cloneElement),
      })),
    })),
  };
}

/**
 * A copy of one element, right after it in its column. An HTML block's copy
 * names the same code (customCode/htmlBlocks.js): editing either changes both.
 */
export function duplicateElement(section: PageSection, elementId: string): PageSection {
  let done = false;
  const rows = (section.rows ?? []).map((row) => ({
    ...row,
    columns: (row.columns ?? []).map((column) => {
      const elements = column.elements ?? [];
      const index = elements.findIndex((el) => el.id === elementId);
      if (index < 0 || done) return column;
      done = true;
      return { ...column, elements: [...elements.slice(0, index + 1), cloneElement(elements[index]), ...elements.slice(index + 1)] };
    }),
  }));
  return done ? { ...section, rows } : section;
}

/** The prop a double-click edits, per element type — plain text the renderer shows as it is. */
export const INLINE_TEXT_KEY: Record<string, string> = {
  heading: "text",
  text: "text",
  rich_text: "text",
  button: "label",
  text_link: "text",
};

function boundKeys(element: PageElement): Record<string, unknown> {
  const bindings = (element.props as Record<string, unknown> | undefined)?.bindings;
  return bindings && typeof bindings === "object" && !Array.isArray(bindings) ? (bindings as Record<string, unknown>) : {};
}

/** The elements whose text can be edited on the canvas: those types, unless the text is bound to live data. */
export function inlineTextIds(sections: PageSection[]): string[] {
  const ids: string[] = [];
  for (const section of sections) {
    for (const row of section.rows ?? []) {
      for (const column of row.columns ?? []) {
        for (const element of column.elements ?? []) {
          const key = INLINE_TEXT_KEY[element.type];
          if (key && !boundKeys(element)[key]) ids.push(element.id);
        }
      }
    }
  }
  return ids;
}

/** The element's text set from the canvas; the same array when nothing changes. */
export function setElementText(sections: PageSection[], elementId: string, text: string): PageSection[] {
  let changed = false;
  const next = sections.map((section) => {
    let touched = false;
    const rows = (section.rows ?? []).map((row) => ({
      ...row,
      columns: (row.columns ?? []).map((column) => ({
        ...column,
        elements: (column.elements ?? []).map((element) => {
          const key = INLINE_TEXT_KEY[element.type];
          if (element.id !== elementId || !key || boundKeys(element)[key]) return element;
          const props = (element.props ?? {}) as Record<string, unknown>;
          if (props[key] === text) return element;
          touched = true;
          return { ...element, props: { ...props, [key]: text } };
        }),
      })),
    }));
    if (!touched) return section;
    changed = true;
    return { ...section, rows };
  });
  return changed ? next : sections;
}

// --- hiding a whole section ---------------------------------------------------
//
// The page tree has no "hidden" flag on a section, and the storefront reads
// none. What it does read is each element's own `settings.style.<device>.hidden`
// (the Style tab's "Hide on this device", ElementStylePanel.tsx): on `base` it
// hides the element at every width unless a device turns it back on. So a
// section is hidden by hiding every element in it on `base`, and shown again
// by taking that off. Its band (background and spacing) stays where it was.

const isPlain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const STYLE_DEVICES = ["base", "tablet", "mobile"] as const;

function deviceStyles(element: PageElement): Record<string, unknown> {
  const settings = isPlain(element.settings) ? element.settings : null;
  return settings && isPlain(settings.style) ? settings.style : {};
}

function hiddenOnBase(element: PageElement): boolean {
  const base = deviceStyles(element).base;
  return isPlain(base) && base.hidden === true;
}

/** Hidden at every width: on the base, and no device turns it back on. */
function hiddenEverywhere(element: PageElement): boolean {
  if (!hiddenOnBase(element)) return false;
  const styles = deviceStyles(element);
  return !(["tablet", "mobile"] as const).some((device) => {
    const own = styles[device];
    return isPlain(own) && own.hidden === false;
  });
}

function setElementHidden(element: PageElement, hidden: boolean): PageElement {
  if (hidden ? hiddenEverywhere(element) : !hiddenOnBase(element)) return element;
  const styles = deviceStyles(element);
  const nextStyle: Record<string, unknown> = {};
  for (const device of STYLE_DEVICES) {
    const raw = styles[device];
    const own: Record<string, unknown> = isPlain(raw) ? { ...raw } : {};
    if (hidden) {
      if (device === "base") own.hidden = true;
      else if (own.hidden === false) delete own.hidden;
    } else if (device === "base") {
      delete own.hidden;
    }
    if (Object.keys(own).length > 0) nextStyle[device] = own;
  }
  const current: Record<string, unknown> = isPlain(element.settings) ? element.settings : {};
  const { style: _style, ...rest } = current;
  void _style;
  const settings: Record<string, unknown> = { ...rest };
  if (Object.keys(nextStyle).length > 0) settings.style = nextStyle;
  const { settings: _settings, ...bare } = element;
  void _settings;
  return Object.keys(settings).length > 0 ? { ...bare, settings } : bare;
}

function elementsOf(section: PageSection): PageElement[] {
  return (section.rows ?? []).flatMap((row) => (row.columns ?? []).flatMap((column) => column.elements ?? []));
}

/** Whether the section is hidden from the store: it has elements and every one of them is hidden at every width. */
export function sectionHidden(section: PageSection): boolean {
  const elements = elementsOf(section);
  return elements.length > 0 && elements.every(hiddenEverywhere);
}

/**
 * Hides the section from the store, or shows it again: every element in it
 * gets (or loses) "hidden" on the base device. Showing it leaves a per-device
 * "hide on phone / tablet" where it was. The same section back when nothing changes.
 */
export function setSectionHidden(section: PageSection, hidden: boolean): PageSection {
  let changed = false;
  const rows = (section.rows ?? []).map((row) => ({
    ...row,
    columns: (row.columns ?? []).map((column) => ({
      ...column,
      elements: (column.elements ?? []).map((element) => {
        const next = setElementHidden(element, hidden);
        if (next !== element) changed = true;
        return next;
      }),
    })),
  }));
  return changed ? { ...section, rows } : section;
}
