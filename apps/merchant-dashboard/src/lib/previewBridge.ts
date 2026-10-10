/**
 * The dashboard half of the message bridge between the website editor and its
 * live storefront preview. The storefront half is
 * apps/storefront/src/components/preview/PreviewBridge.tsx; the two apps share
 * no code, so the shapes are spelled out on both sides.
 *
 * Frame → editor (only ever accepted from the storefront origin, and only
 * from a frame this editor owns):
 *   { type: "zimos:preview-ready", sectionIds }        after every (re)load
 *   { type: "zimos:select-section", sectionId }        a section was clicked
 *   { type: "zimos:select-element", sectionId, elementId, elementType }
 *                                                       an element of the selected section was clicked
 *   { type: "zimos:select-shell", part }                the header, footer or announcement bar was clicked
 *   { type: "zimos:insert-section", index }             "add a section here"
 *   { type: "zimos:move-section", sectionId, direction } the section grip's arrow keys
 *   { type: "zimos:section-action", sectionId, action }  the selected section's floating bar
 *   { type: "zimos:pick-image", sectionId, elementId, field } "replace this picture"
 *   { type: "zimos:section-rects", sections }            each section's box, while a drag is on
 *   { type: "zimos:canvas-drag", phase, … }               drag / resize on the page itself (lib/canvasDrag.ts)
 *   { type: "zimos:canvas-step", step }                   one arrow-key press on a canvas handle
 *   { type: "zimos:color-mode", mode }                    the page went light or dark (its own switch, or the OS)
 *   { type: "zimos:edit-text", elementId, text }          a double-click text edit was committed (item 95)
 *
 * `zimos:preview-ready` also carries `colorMode`, the mode the page opened in.
 *
 * Editor → frame (posted to the storefront origin, never "*"):
 *   { type: "zimos:editor-state", selectedId, selectedElementId, labels, strings,
 *     theme, selectedShell, shellLabels, shell, colorMode, can, elementLabels }
 *   { type: "zimos:scroll-to-section", sectionId }
 *   { type: "zimos:scroll-to-shell", part }
 *   { type: "zimos:drag-state", active, hoverIndex }     a library block is being dragged over the canvas
 *   { type: "zimos:canvas-feedback", feedback, done, committed }  what a canvas drag should draw
 *   { type: "zimos:patch", ops }                         small edits applied to the page's DOM at once
 *
 * `shell` is the unsaved header/footer (and announcement bar) in the exact
 * shape a save writes into themeSettings (`header` / `footer`); the frame
 * reads it with the same functions the live store uses.
 *
 * Drag-and-drop from the block library onto the canvas is native HTML5 DnD
 * started in the dashboard (same-origin) and dropped on a cross-origin frame,
 * so `dragover`/`drop` fire on a transparent overlay the dashboard positions
 * over the iframe (see StorefrontPreview) rather than inside the frame's own
 * document, which the dashboard can't read into. `zimos:section-rects` is how
 * the frame hands over what it can see — every section's box — so the
 * dashboard can turn a pointer position into "the gap between section N and
 * N+1" itself; `zimos:drag-state` sends that gap back down so the frame's own
 * "+" indicators and drop-line agree with what the dashboard is about to do.
 *
 * Patching (`zimos:patch`): a full render of the page is a server round trip,
 * so a change that only touches an element's text, picture, visibility or a
 * few simple style values is applied to the showing page straight away
 * (`diffTreePatch` below decides, StorefrontPreview sends) and the full
 * render follows once the merchant pauses. Anything else — a node added,
 * removed or moved, a section setting, a binding — renders as it always did.
 */

import type { PageElement, PageTree } from "@store-builder/api-client";
import { readCanvasDrag, readCanvasStep, type CanvasDragMessage, type CanvasStep } from "./canvasDrag";

/** An unsaved store look, as the storefront's `readPreviewTheme` accepts it. */
export interface PreviewTheme {
  /** A store theme key, or "original". */
  storeTheme?: string;
  primaryColor?: string;
  primaryColorDark?: string;
  secondaryColor?: string;
  fontFamily?: string;
  cornerRadius?: string;
  /** Undefined leaves the saved logo alone; null previews "no logo". */
  logoUrl?: string | null;
  /** g:Name / c:id, or "" for the look's own font. */
  bodyFont?: string;
  headingFont?: string;
}

/** Light or dark — the preview's own switch, independent of the dashboard's. */
export type ColorMode = "light" | "dark";

export function isColorMode(value: unknown): value is ColorMode {
  return value === "light" || value === "dark";
}

/** The device the preview frame is laid out as. */
export type PreviewDevice = "phone" | "tablet" | "desktop";

/** The frame's layout width for each device, in CSS pixels. */
export const PREVIEW_DEVICE_WIDTH: Record<PreviewDevice, number> = {
  phone: 390,
  tablet: 768,
  desktop: 1280,
};

/** What the floating bar on a selected section can ask for. */
export type SectionAction = "up" | "down" | "duplicate" | "hide" | "delete";
const SECTION_ACTIONS: readonly SectionAction[] = ["up", "down", "duplicate", "hide", "delete"];

export function isSectionAction(value: unknown): value is SectionAction {
  return typeof value === "string" && (SECTION_ACTIONS as readonly string[]).includes(value);
}

/** The store's fixed parts — drawn by the store layout on every page, not by the page tree. */
export type ShellPart = "header" | "footer" | "announcement";
const SHELL_PART_SET = new Set<string>(["header", "footer", "announcement"]);

export function isShellPart(value: unknown): value is ShellPart {
  return typeof value === "string" && SHELL_PART_SET.has(value);
}

/** Unsaved header/footer settings, exactly as a save would write them into themeSettings. */
export interface ShellPreview {
  header: Record<string, unknown>;
  footer: Record<string, unknown> | null;
}

/** One section's box, as the frame measures it (its own viewport, `getBoundingClientRect()`). */
export interface SectionRect {
  sectionId: string;
  /** Its position in the page — same number as `zimos:insert-section`'s index. */
  index: number;
  top: number;
  height: number;
}

export type FrameMessage =
  | { type: "zimos:preview-ready"; sectionIds: string[]; colorMode?: ColorMode }
  | { type: "zimos:color-mode"; mode: ColorMode }
  | { type: "zimos:select-section"; sectionId: string }
  | { type: "zimos:select-element"; sectionId: string; elementId: string; elementType: string }
  | { type: "zimos:select-shell"; part: ShellPart }
  | { type: "zimos:insert-section"; index: number }
  | { type: "zimos:move-section"; sectionId: string; direction: "up" | "down" }
  | { type: "zimos:section-action"; sectionId: string; action: SectionAction }
  | { type: "zimos:pick-image"; sectionId: string; elementId: string; field: string }
  | { type: "zimos:section-rects"; sections: SectionRect[] }
  | CanvasDragMessage
  | { type: "zimos:canvas-step"; step: CanvasStep }
  | { type: "zimos:edit-text"; elementId: string; text: string };

/**
 * The canvas's own words, in the editor's language: the section outline's
 * buttons, and the handles for dragging and resizing on the page. The frame
 * falls back to English for any it isn't sent.
 */
export interface CanvasStrings {
  addAbove: string;
  addBelow: string;
  moveUp: string;
  moveDown: string;
  dragSection?: string;
  dragElement?: string;
  resizeHeight?: string;
  resizeColumns?: string;
  resizeImage?: string;
  /** The size badge for "no minimum height". */
  auto?: string;
  /** The tooltip on text that a double-click edits. */
  editText?: string;
  /** The short words the "+" between sections grows on hover and focus. */
  addSection?: string;
  /** The floating bar on the selected section. */
  duplicate?: string;
  hide?: string;
  show?: string;
  remove?: string;
  /** The corner button on a selected picture. */
  replaceImage?: string;
  /** The chip on a section or element that shoppers don't see. */
  hidden?: string;
}

/** What the editor listens for, so the frame draws only the controls that do something. */
export interface CanvasAbilities {
  /** A click on an element of the selected section selects the element. */
  selectElement?: boolean;
  /** A selected picture can be replaced from the canvas. */
  pickImage?: boolean;
  /** The buttons on the selected section's floating bar. */
  sectionActions?: SectionAction[];
}

export interface EditorStateMessage {
  type: "zimos:editor-state";
  selectedId: string | null;
  /** The element picked inside the selected section, outlined on its own. */
  selectedElementId?: string | null;
  labels: Record<string, string>;
  strings: CanvasStrings;
  theme: PreviewTheme | null;
  selectedShell: ShellPart | null;
  shellLabels: Record<ShellPart, string> | null;
  /** Null shows the saved header and footer. */
  shell: ShellPreview | null;
  /** Null leaves the frame on its own (stored or system) mode. */
  colorMode: ColorMode | null;
  /** Outlines every section, row, column and element (item 95). */
  xray?: boolean;
  /** The elements whose text a double-click edits on the page. */
  inlineText?: string[];
  can?: CanvasAbilities;
  /** Element type → its name in the editor's language, for the selected element's chip. */
  elementLabels?: Record<string, string>;
}

export interface ScrollToSectionMessage {
  type: "zimos:scroll-to-section";
  sectionId: string;
}

export interface ScrollToShellMessage {
  type: "zimos:scroll-to-shell";
  part: ShellPart;
}

/**
 * Sent while a block from the library is being dragged over the canvas, so
 * the frame's between-section "+" indicators stay up continuously instead of
 * only on hover, and light up whichever gap the dashboard has decided the
 * pointer is nearest to. `hoverIndex` is null before the frame's first
 * `zimos:section-rects` reply lets the dashboard compute one.
 */
export interface DragStateMessage {
  type: "zimos:drag-state";
  active: boolean;
  hoverIndex: number | null;
}

/**
 * One small edit to an element that is already on the page. `text` replaces
 * the element's inline text (the node a double-click edits); `imageSrc` its
 * picture; `hidden` shows or ghosts it; `style` is CSS property → value, from
 * the short list in PATCH_STYLE_PROPERTIES.
 */
export interface PatchOp {
  elementId: string;
  text?: string;
  imageSrc?: string;
  hidden?: boolean;
  style?: Record<string, string>;
}

export interface PatchMessage {
  type: "zimos:patch";
  ops: PatchOp[];
}

/** `scheme://host[:port]` of a URL, or null when it isn't one. */
export function originOf(url: string): string | null {
  try {
    const { origin } = new URL(url);
    return origin === "null" ? null : origin;
  } catch {
    return null;
  }
}

/** Ids are free-form strings server-side; this only rules out junk. */
function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 200;
}

/** An element type as the tree names it: a short lowercase word. */
const ELEMENT_TYPE = /^[a-z][a-z0-9_]{0,59}$/;
/** A prop name. */
const PROP_KEY = /^[A-Za-z][A-Za-z0-9_]{0,59}$/;

/**
 * Reads a `message` event as a frame message, or null when it must be
 * ignored: from any origin but the storefront's, from a window that isn't one
 * of the editor's own preview frames (when `frames` is given), or not one of
 * the shapes above. Anything can post to the dashboard window, so every
 * field is checked rather than cast.
 */
export function readFrameMessage(
  event: Pick<MessageEvent, "origin" | "data"> & { source?: unknown },
  storefrontOrigin: string | null,
  frames?: ReadonlyArray<unknown>
): FrameMessage | null {
  if (!storefrontOrigin || event.origin !== storefrontOrigin) return null;
  if (frames && !frames.some((frame) => frame != null && frame === event.source)) return null;

  const data = event.data as Record<string, unknown> | null;
  if (!data || typeof data !== "object") return null;

  switch (data.type) {
    case "zimos:preview-ready":
      return {
        type: "zimos:preview-ready",
        sectionIds: Array.isArray(data.sectionIds) ? data.sectionIds.filter(isId) : [],
        ...(isColorMode(data.colorMode) ? { colorMode: data.colorMode } : {}),
      };
    case "zimos:color-mode":
      return isColorMode(data.mode) ? { type: "zimos:color-mode", mode: data.mode } : null;
    case "zimos:select-section":
      return isId(data.sectionId) ? { type: "zimos:select-section", sectionId: data.sectionId } : null;
    case "zimos:select-element":
      return isId(data.sectionId) &&
        isId(data.elementId) &&
        typeof data.elementType === "string" &&
        ELEMENT_TYPE.test(data.elementType)
        ? {
            type: "zimos:select-element",
            sectionId: data.sectionId,
            elementId: data.elementId,
            elementType: data.elementType,
          }
        : null;
    case "zimos:select-shell":
      return isShellPart(data.part) ? { type: "zimos:select-shell", part: data.part } : null;
    case "zimos:insert-section":
      return typeof data.index === "number" && Number.isInteger(data.index) && data.index >= 0
        ? { type: "zimos:insert-section", index: data.index }
        : null;
    case "zimos:move-section":
      return isId(data.sectionId) && (data.direction === "up" || data.direction === "down")
        ? { type: "zimos:move-section", sectionId: data.sectionId, direction: data.direction }
        : null;
    case "zimos:section-action":
      return isId(data.sectionId) && isSectionAction(data.action)
        ? { type: "zimos:section-action", sectionId: data.sectionId, action: data.action }
        : null;
    case "zimos:pick-image":
      return isId(data.sectionId) && isId(data.elementId) && typeof data.field === "string" && PROP_KEY.test(data.field)
        ? { type: "zimos:pick-image", sectionId: data.sectionId, elementId: data.elementId, field: data.field }
        : null;
    case "zimos:section-rects":
      return Array.isArray(data.sections)
        ? { type: "zimos:section-rects", sections: data.sections.filter(isSectionRect) }
        : null;
    case "zimos:canvas-drag":
      return readCanvasDrag(data);
    case "zimos:canvas-step": {
      const step = readCanvasStep(data.step);
      return step ? { type: "zimos:canvas-step", step } : null;
    }
    case "zimos:edit-text":
      return isId(data.elementId) && typeof data.text === "string" && data.text.length <= 4000
        ? { type: "zimos:edit-text", elementId: data.elementId, text: data.text }
        : null;
    default:
      return null;
  }
}

/** A well-formed section box — junk entries are dropped rather than the whole message. */
function isSectionRect(value: unknown): value is SectionRect {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    isId(r.sectionId) &&
    typeof r.index === "number" &&
    Number.isInteger(r.index) &&
    r.index >= 0 &&
    typeof r.top === "number" &&
    Number.isFinite(r.top) &&
    typeof r.height === "number" &&
    Number.isFinite(r.height) &&
    r.height >= 0
  );
}

/**
 * Which gap between sections a Y position is nearest to — "before the section
 * at this index", where `rects.length` means "at the very end", exactly the
 * index `insertSection()` expects. `y` and every rect's `top`/`height` must be
 * in the same coordinate space (the iframe's own viewport: both come from
 * `getBoundingClientRect()` inside it; the dashboard's drop overlay sits over
 * that same iframe, and StorefrontPreview divides a pointer position by the
 * frame's scale when the device frame is scaled down to fit).
 */
export function nearestGapIndex(rects: SectionRect[], y: number): number {
  const sorted = [...rects].sort((a, b) => a.index - b.index);
  for (const rect of sorted) {
    if (y < rect.top + rect.height / 2) return rect.index;
  }
  return sorted.length === 0 ? 0 : sorted[sorted.length - 1].index + 1;
}

// --- patching ---------------------------------------------------------------------------

/**
 * The CSS properties a patch may set. The frame keeps the same list and
 * drops anything else; a value is always one this file builds from a checked
 * number, keyword or hex colour, never text copied out of the tree.
 */
export const PATCH_STYLE_PROPERTIES = [
  "color",
  "background-color",
  "text-align",
  "font-size",
  "font-weight",
  "padding",
  "padding-top",
  "padding-bottom",
  "padding-inline",
  "padding-inline-start",
  "padding-inline-end",
  "padding-block",
  "margin",
  "margin-top",
  "margin-bottom",
  "margin-inline",
  "margin-inline-start",
  "margin-inline-end",
  "margin-block",
  "border-radius",
  "gap",
] as const;

/** More ops than this is not a small edit: render instead. */
const PATCH_MAX_OPS = 200;
const PATCH_TEXT_MAX = 20_000;
const PATCH_URL_MAX = 2000;

/**
 * The prop a text patch stands for, per element type — the five whose first
 * box is their text, the same ones the canvas edits in place
 * (editor/canvasTools.ts INLINE_TEXT_KEY, storefront useCanvasText.ts).
 */
const PATCH_TEXT_PROP: Record<string, string> = {
  heading: "text",
  text: "text",
  rich_text: "text",
  button: "label",
  text_link: "text",
};

/** The prop that holds the element's one picture (storefront PageRenderer's IMAGE_FIELD). */
const PATCH_IMAGE_PROP: Record<string, string> = {
  image: "src",
  image_banner: "image",
};

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Equal as JSON. Key order counts, which only ever errs towards "different" — a render instead of a patch. */
function same(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

function sameExcept(a: Json, b: Json, skip: readonly string[]): boolean {
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (skip.includes(key)) continue;
    if (!same(a[key], b[key])) return false;
  }
  return true;
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const WEIGHTS = new Set([300, 400, 500, 600, 700, 800, 900]);

function hex(property: string) {
  return (value: unknown) => (typeof value === "string" && HEX.test(value) ? { [property]: value.toLowerCase() } : null);
}

function px(property: string, min: number, max: number) {
  return (value: unknown) =>
    typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? { [property]: `${value}px` } : null;
}

/**
 * An element style key (settings.style.<device>.<key>) as the CSS the
 * storefront writes for it (page-renderer/elementStyle.ts `declarations`) —
 * the same clamps, so a patch never shows something the render would not.
 * A key that is not here is not patched: the page renders instead.
 */
const STYLE_TO_CSS: Record<string, (value: unknown) => Record<string, string> | null> = {
  color: hex("color"),
  background: hex("background-color"),
  fontSize: px("font-size", 8, 160),
  fontWeight: (value) => (typeof value === "number" && WEIGHTS.has(value) ? { "font-weight": String(value) } : null),
  align: (value) =>
    value === "center"
      ? { "text-align": "center", "margin-inline": "auto" }
      : value === "end"
        ? { "text-align": "end", "margin-inline": "auto 0" }
        : value === "start"
          ? { "text-align": "start", "margin-inline": "0 auto" }
          : null,
  paddingTop: px("padding-top", 0, 300),
  paddingBottom: px("padding-bottom", 0, 300),
  paddingStart: px("padding-inline-start", 0, 300),
  paddingEnd: px("padding-inline-end", 0, 300),
  marginTop: px("margin-top", 0, 300),
  marginBottom: px("margin-bottom", 0, 300),
  radius: px("border-radius", 0, 200),
};

const STYLE_DEVICES = ["base", "tablet", "mobile"] as const;
type StyleDevice = (typeof STYLE_DEVICES)[number];

/** The device blocks that apply at a frame width, strongest first (storefront breakpoints: 1023 and 639). */
function deviceChain(width: number): StyleDevice[] {
  if (width <= 639) return ["mobile", "tablet", "base"];
  if (width <= 1023) return ["tablet", "base"];
  return ["base"];
}

function effective(style: Json, key: string, chain: StyleDevice[]): unknown {
  for (const device of chain) {
    const block = style[device];
    if (isObject(block) && block[key] !== undefined) return block[key];
  }
  return undefined;
}

/** What a change to `settings.style` needs on the page at this width; null when only a render can show it. */
function stylePatch(before: unknown, after: unknown, width: number): Pick<PatchOp, "style" | "hidden"> | null {
  if ((before !== undefined && !isObject(before)) || (after !== undefined && !isObject(after))) return null;
  const a = (before ?? {}) as Json;
  const b = (after ?? {}) as Json;
  if (!sameExcept(a, b, STYLE_DEVICES)) return null;

  const changed = new Set<string>();
  for (const device of STYLE_DEVICES) {
    if ((a[device] !== undefined && !isObject(a[device])) || (b[device] !== undefined && !isObject(b[device]))) return null;
    const da = (a[device] ?? {}) as Json;
    const db = (b[device] ?? {}) as Json;
    for (const key of new Set([...Object.keys(da), ...Object.keys(db)])) {
      if (!same(da[key], db[key])) changed.add(key);
    }
  }

  const chain = deviceChain(width);
  const out: Pick<PatchOp, "style" | "hidden"> = {};
  for (const key of changed) {
    const was = effective(a, key, chain);
    const is = effective(b, key, chain);
    if (key === "hidden") {
      if ((was === true) !== (is === true)) out.hidden = is === true;
      continue;
    }
    const toCss = STYLE_TO_CSS[key];
    if (!toCss) return null;
    // Changed for another device only: nothing to show at this width.
    if (same(was, is)) continue;
    // Cleared: a patch can add a rule, only a render can take one away.
    if (is === undefined) return null;
    const css = toCss(is);
    if (!css) return null;
    out.style = { ...out.style, ...css };
  }
  return out;
}

function isPatchableUrl(value: string): boolean {
  const url = value.trim();
  return url.length <= PATCH_URL_MAX && (/^https?:\/\//i.test(url) || (url.startsWith("/") && !url.startsWith("//")));
}

function isBound(props: Json, key: string): boolean {
  const bindings = props.bindings;
  return isObject(bindings) && bindings[key] !== undefined && bindings[key] !== null && bindings[key] !== "";
}

/** One element's change as a patch; null when it is more than a patch can show. */
function elementPatch(before: PageElement, after: PageElement, width: number): PatchOp | null {
  const a = before as unknown as Json;
  const b = after as unknown as Json;
  // Its id, its type, and any key this file does not know.
  if (!sameExcept(a, b, ["props", "settings"])) return null;
  if (!isId(after.id)) return null;
  const op: PatchOp = { elementId: after.id };

  const pa = isObject(a.props) ? a.props : {};
  const pb = isObject(b.props) ? b.props : {};
  const textKey = PATCH_TEXT_PROP[after.type];
  const imageKey = PATCH_IMAGE_PROP[after.type];
  for (const key of new Set([...Object.keys(pa), ...Object.keys(pb)])) {
    const was = pa[key];
    const is = pb[key];
    if (same(was, is)) continue;
    // A text or picture that was empty has no node on the page yet, and one
    // emptied loses its node; bound props show live data, not the prop.
    if (typeof was !== "string" || typeof is !== "string" || !was.trim() || !is.trim()) return null;
    if (isBound(pa, key) || isBound(pb, key)) return null;
    if (key === textKey && is.length <= PATCH_TEXT_MAX) {
      // "Add to cart" / "Buy now" buttons are a client island that owns its label.
      if (after.type === "button" && (pb.action === "add_to_cart" || pb.action === "buy_now")) return null;
      op.text = is;
    } else if (key === imageKey && isPatchableUrl(is)) {
      op.imageSrc = is.trim();
    } else {
      return null;
    }
  }

  const sa = isObject(a.settings) ? a.settings : {};
  const sb = isObject(b.settings) ? b.settings : {};
  if (!sameExcept(sa, sb, ["style"])) return null;
  if (!same(sa.style, sb.style)) {
    const style = stylePatch(sa.style, sb.style, width);
    if (!style) return null;
    if (style.style) op.style = style.style;
    if (style.hidden !== undefined) op.hidden = style.hidden;
  }
  return op;
}

function hasWork(op: PatchOp): boolean {
  return op.text !== undefined || op.imageSrc !== undefined || op.hidden !== undefined || op.style !== undefined;
}

/**
 * The difference between two page trees as patches for the page that shows
 * `prev` — or null when the difference is more than patches can show and the
 * page has to render: a node added, removed, moved or retyped, a section, row
 * or column setting, a binding, a named style, any prop other than an
 * element's inline text or its one picture, any style key outside
 * STYLE_TO_CSS, a text or picture that was (or becomes) empty.
 *
 * An empty list means the trees differ only in ways that show nothing at this
 * width (a phone-only style, say): nothing to send, and the render can wait.
 *
 * `width` is the frame's layout width, which picks the device styles in force.
 */
export function diffTreePatch(prev: PageTree, next: PageTree, width = Number.POSITIVE_INFINITY): PatchOp[] | null {
  if (prev === next) return [];
  if (!isObject(prev) || !isObject(next)) return null;
  if (!sameExcept(prev as unknown as Json, next as unknown as Json, ["sections"])) return null;
  const sectionsA = prev.sections;
  const sectionsB = next.sections;
  if (!Array.isArray(sectionsA) || !Array.isArray(sectionsB) || sectionsA.length !== sectionsB.length) return null;

  const ops: PatchOp[] = [];
  for (let s = 0; s < sectionsB.length; s++) {
    const sa = sectionsA[s];
    const sb = sectionsB[s];
    if (sa === sb) continue;
    if (!isObject(sa) || !isObject(sb) || !sameExcept(sa, sb, ["rows"])) return null;
    const rowsA = sa.rows;
    const rowsB = sb.rows;
    if (!Array.isArray(rowsA) || !Array.isArray(rowsB) || rowsA.length !== rowsB.length) return null;
    for (let r = 0; r < rowsB.length; r++) {
      const ra = rowsA[r];
      const rb = rowsB[r];
      if (ra === rb) continue;
      if (!isObject(ra) || !isObject(rb) || !sameExcept(ra, rb, ["columns"])) return null;
      const columnsA = ra.columns;
      const columnsB = rb.columns;
      if (!Array.isArray(columnsA) || !Array.isArray(columnsB) || columnsA.length !== columnsB.length) return null;
      for (let c = 0; c < columnsB.length; c++) {
        const ca = columnsA[c];
        const cb = columnsB[c];
        if (ca === cb) continue;
        if (!isObject(ca) || !isObject(cb) || !sameExcept(ca, cb, ["elements"])) return null;
        const elementsA = ca.elements;
        const elementsB = cb.elements;
        if (!Array.isArray(elementsA) || !Array.isArray(elementsB) || elementsA.length !== elementsB.length) return null;
        for (let e = 0; e < elementsB.length; e++) {
          const ea = elementsA[e] as PageElement;
          const eb = elementsB[e] as PageElement;
          if (ea === eb || same(ea, eb)) continue;
          if (!isObject(ea) || !isObject(eb)) return null;
          const op = elementPatch(ea, eb, width);
          if (!op) return null;
          if (hasWork(op)) ops.push(op);
          if (ops.length > PATCH_MAX_OPS) return null;
        }
      }
    }
  }
  return ops;
}
