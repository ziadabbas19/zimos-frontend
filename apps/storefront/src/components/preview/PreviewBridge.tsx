"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDownIcon, ArrowUpIcon, CopySimpleIcon, EyeIcon, EyeSlashIcon, PlusIcon, TrashIcon } from "./canvasIcons";
import {
  BRAND_VAR_NAMES,
  brandVars,
  previewStoreTheme,
  readColorMode,
  readPreviewTheme,
  type ColorMode,
  type PreviewTheme,
} from "@/lib/brandTheme";
import { setColorMode } from "@/components/ThemeToggle";
import { useSetShellOverride } from "@/lib/StoreShellContext";
import { useIsClient } from "@/lib/useIsClient";
import { readShellOverride, type ShellOverride } from "@/lib/storeShell";
import { CanvasHandles, SectionGrip } from "./CanvasHandles";
import { BLUE, LAYER, RING_INSIDE, useCanvasChrome } from "./canvasChrome";
import { EL_ATTR, TYPE_ATTR, elementNode, elementRect, imageFieldOf, isRtl, sectionHidden } from "./canvasGeometry";
import { applyPatch, readPatch } from "./canvasPatch";
import { useCanvasDrag } from "./useCanvasDrag";
import { useCanvasText } from "./useCanvasText";

/**
 * The storefront half of the website editor's canvas. Rendered only by the
 * preview page (app/store/[workspaceId]/preview/[token]) — never on a page a
 * shopper can reach — and only when the editor asked for it.
 *
 * It talks to exactly one window: the dashboard that framed it, at the origin
 * the dashboard posted with the tree. Its counterpart is
 * merchant-dashboard/src/lib/previewBridge.ts; the two sides share no code,
 * so the message shapes are spelled out in both.
 *
 * Frame → editor
 *   { type: "zimos:preview-ready", sectionIds }        after every (re)load
 *   { type: "zimos:select-section", sectionId }        a section was clicked
 *   { type: "zimos:select-element", sectionId, elementId, elementType }
 *                                                       an element of the selected section was clicked
 *   { type: "zimos:select-shell", part }                the header, footer or announcement bar was clicked
 *   { type: "zimos:insert-section", index }             "add a section here"
 *   { type: "zimos:move-section", sectionId, direction } the section grip's arrow keys
 *   { type: "zimos:section-action", sectionId, action }  the selected section's floating bar
 *   { type: "zimos:pick-image", sectionId, elementId, field } "replace this picture"
 *   { type: "zimos:section-rects", sections }            every section's box, while a drag is on
 *   { type: "zimos:canvas-drag", phase, … }               dragging / resizing on the page (useCanvasDrag.ts)
 *   { type: "zimos:canvas-step", step }                   one arrow-key press on a canvas handle
 *   { type: "zimos:color-mode", mode }                    the page went light or dark (the in-page switch, or the OS)
 *   { type: "zimos:edit-text", elementId, text }          a double-click text edit was committed (useCanvasText.ts)
 *
 * `zimos:preview-ready` also carries `colorMode`, the mode the page opened in.
 *
 * Editor → frame
 *   { type: "zimos:editor-state", selectedId, selectedElementId, labels, strings,
 *     theme, selectedShell, shellLabels, shell, colorMode, can, elementLabels }
 *   { type: "zimos:scroll-to-section", sectionId }
 *   { type: "zimos:scroll-to-shell", part }
 *   { type: "zimos:drag-state", active, hoverIndex }     a library block is being dragged over us
 *   { type: "zimos:canvas-feedback", feedback, done, committed }  what a canvas drag should draw
 *   { type: "zimos:patch", ops }                         small edits applied to this page's DOM (canvasPatch.ts)
 *
 * Edit where you look. A click on a section selects it; a click on an element
 * inside the section that is already selected selects the element (when the
 * editor listens for it — `can.selectElement`). The selected section carries
 * a floating bar (move up, move down, duplicate, hide / show, delete) and a
 * "+" on each edge; the selected element an outline and a tag with its name;
 * a selected picture a "replace" button, and a click on it does the same.
 *
 * Sections and elements also drag, and sections, column widths and pictures
 * resize, right on the page (CanvasHandles.tsx, useCanvasDrag.ts): this frame
 * owns the pointer and draws, the editor decides the edit.
 *
 * The store's header, footer and announcement bar are not part of the page
 * tree — the store layout draws them — but they carry `data-zimos-shell`, so
 * they outline and select the same way sections do (without the bar and the
 * insert buttons: they are fixed). `shell` is the editor's unsaved
 * header/footer settings, handed to the layout's StoreShellProvider so the
 * real header and footer re-render with them in place, no reload needed.
 *
 * Everything it draws is a fixed layer above the page in one fixed look
 * (canvasChrome.ts), so the page's own markup and layout are left untouched
 * and the handles read on any store colour.
 *
 * Touch: a tap is a click, so it selects; a double-tap edits text; nothing
 * here listens to touch moves, so one finger still scrolls the page.
 *
 * Dragging a block from the library onto the canvas is native HTML5 DnD that
 * starts in the (same-origin) dashboard window and is dropped on this
 * (cross-origin) frame from the outside — the dashboard can fire dragover/drop
 * on an overlay it draws over the iframe, but it can never read this
 * document's DOM. So this side's job during a drag is just to publish its own
 * geometry (`zimos:section-rects`) and to draw whatever gap the dashboard says
 * is nearest (`zimos:drag-state`) — the actual index math lives on the
 * dashboard side (previewBridge.ts's `nearestGapIndex`).
 */

const SECTION_ATTR = "data-zimos-section";
const SHELL_ATTR = "data-zimos-shell";
const SHELL_PARTS = ["header", "footer", "announcement"] as const;
type ShellPart = (typeof SHELL_PARTS)[number];

function isShellPart(value: unknown): value is ShellPart {
  return typeof value === "string" && (SHELL_PARTS as readonly string[]).includes(value);
}

function shellEl(part: ShellPart): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${SHELL_ATTR}="${part}"]`);
}
const INDEX_ATTR = "data-zimos-index";
const OVERLAY_ATTR = "data-zimos-overlay";
const SERVER_THEME_ID = "zimos-preview-theme";

/** What the bar on a selected section can ask the editor for. */
const SECTION_ACTIONS = ["up", "down", "duplicate", "hide", "delete"] as const;
type SectionAction = (typeof SECTION_ACTIONS)[number];

/**
 * What the editor listens for. An editor that doesn't say (`can` missing from
 * its state — the funnel builder, an older dashboard) gets exactly the canvas
 * it always had: sections select, and the bar holds the grip and the two move
 * buttons, which post `zimos:move-section`.
 */
interface Abilities {
  selectElement: boolean;
  pickImage: boolean;
  /** Null: the editor did not say — the two move buttons, the old message. */
  sectionActions: SectionAction[] | null;
}

const LEGACY_ABILITIES: Abilities = { selectElement: false, pickImage: false, sectionActions: null };

function readAbilities(raw: unknown): Abilities {
  if (!raw || typeof raw !== "object") return LEGACY_ABILITIES;
  const can = raw as Record<string, unknown>;
  return {
    selectElement: can.selectElement === true,
    pickImage: can.pickImage === true,
    sectionActions: Array.isArray(can.sectionActions)
      ? SECTION_ACTIONS.filter((action) => (can.sectionActions as unknown[]).includes(action))
      : [],
  };
}

function sameAbilities(a: Abilities, b: Abilities): boolean {
  return (
    a.selectElement === b.selectElement &&
    a.pickImage === b.pickImage &&
    (a.sectionActions === null ? b.sectionActions === null : b.sectionActions !== null && a.sectionActions.join() === b.sectionActions.join())
  );
}

interface Strings {
  addAbove: string;
  addBelow: string;
  moveUp: string;
  moveDown: string;
  dragSection: string;
  dragElement: string;
  resizeHeight: string;
  resizeColumns: string;
  resizeImage: string;
  editText: string;
  addSection: string;
  duplicate: string;
  hide: string;
  show: string;
  remove: string;
  replaceImage: string;
  hidden: string;
}

const DEFAULT_STRINGS: Strings = {
  addAbove: "Add a section here",
  addBelow: "Add a section here",
  moveUp: "Move up",
  moveDown: "Move down",
  dragSection: "Drag to move this section",
  dragElement: "Drag to move this block",
  resizeHeight: "Drag to change the section's height",
  resizeColumns: "Drag to change the column widths",
  resizeImage: "Drag to resize the picture",
  editText: "Double-click to edit the text",
  addSection: "Add a section",
  duplicate: "Duplicate",
  hide: "Hide",
  show: "Show",
  remove: "Delete",
  replaceImage: "Replace picture",
  hidden: "Hidden",
};

/** "product_card" → "Product card", for an element type the editor sent no name for. */
function typeName(type: string): string {
  const words = type.replace(/_/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "";
}

function sectionEl(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${SECTION_ATTR}="${CSS.escape(id)}"]`);
}

function sectionIds(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>(`[${SECTION_ATTR}]`)).map(
    (el) => el.getAttribute(SECTION_ATTR) ?? ""
  );
}

/**
 * Lays the unsaved look over the store wrapper. `!important` inline values win
 * over both the layout's saved inline style and the server-rendered <style>
 * the preview page starts with (removed here once the bridge takes over).
 */
function applyTheme(theme: PreviewTheme | null) {
  const wrapper = document.querySelector<HTMLElement>(".brand-theme");
  if (!wrapper || !theme) return;
  lastTheme = theme;
  document.getElementById(SERVER_THEME_ID)?.remove();
  // The store theme is a switch on the wrapper; every theme's styles and font
  // stacks are already on the page (store-themes.css, the preview page).
  const storeTheme = previewStoreTheme(theme);
  if (storeTheme) wrapper.setAttribute("data-store-theme", storeTheme);
  else if (storeTheme === null) wrapper.removeAttribute("data-store-theme");
  const vars = brandVars(theme as Record<string, unknown>, { complete: true });
  for (const name of BRAND_VAR_NAMES) {
    if (name in vars) wrapper.style.setProperty(name, vars[name], "important");
    else wrapper.style.removeProperty(name);
  }
  applyLogo(theme.logoUrl);
}

/** The mode the page is showing right now. */
function pageColorMode(): ColorMode {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** The look last laid over the page, so the logo can be re-applied after the header re-renders. */
let lastTheme: PreviewTheme | null = null;

/** The unsaved logo's classes at each header logo size — StoreHeader's own LOGO_IMG_CLASS. */
const PREVIEW_LOGO_CLASS: Record<string, string> = {
  sm: "h-8 w-8 shrink-0 rounded-xl object-contain",
  md: "h-10 w-10 shrink-0 rounded-xl object-contain",
  lg: "h-12 w-12 shrink-0 rounded-xl object-contain",
};

/**
 * Swaps the header logo for an unsaved one (see StoreHeader). The header link
 * starts with either the merchant's saved logo (an <img>) or the ZIMOS
 * fallback (<span class="zimos-logo">); that node is hidden rather than
 * removed, so the saved state comes back when the merchant undoes the change.
 * No logo shows the ZIMOS fallback, as the live header does — or, when the
 * saved logo is what's being removed, just the store name.
 */
function applyLogo(logoUrl: string | null | undefined) {
  const link = document.querySelector<HTMLElement>("[data-store-logo]");
  if (!link) return;
  const savedImg = link.querySelector<HTMLElement>(":scope > img:not([data-zimos-logo])");
  const fallback = link.querySelector<HTMLElement>(":scope > .zimos-logo");
  let preview = link.querySelector<HTMLImageElement>(":scope > img[data-zimos-logo]");
  const show = (el: HTMLElement | null, visible: boolean) => {
    if (!el) return;
    if (visible) el.style.removeProperty("display");
    else el.style.setProperty("display", "none");
  };

  if (logoUrl === undefined) {
    preview?.remove();
    show(savedImg, true);
    show(fallback, true);
    return;
  }
  if (!logoUrl) {
    preview?.remove();
    show(savedImg, false);
    show(fallback, true);
    return;
  }
  if (!preview) {
    preview = document.createElement("img");
    preview.setAttribute("data-zimos-logo", "");
    preview.alt = "";
    link.prepend(preview);
  }
  // Sized like the header's own logo, which the merchant may be resizing too.
  const size = link.getAttribute("data-logo-size") ?? "md";
  const px = size === "sm" ? 32 : size === "lg" ? 48 : 40;
  preview.width = px;
  preview.height = px;
  preview.className = PREVIEW_LOGO_CLASS[size] ?? PREVIEW_LOGO_CLASS.md;
  if (preview.src !== logoUrl) preview.src = logoUrl;
  show(savedImg, false);
  show(fallback, false);
}

interface Box {
  id: string;
  index: number;
  top: number;
  left: number;
  width: number;
  height: number;
}

function measure(id: string | null): Box | null {
  if (!id) return null;
  const el = sectionEl(id);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    id,
    index: Number(el.getAttribute(INDEX_ATTR) ?? 0),
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

/** A header/footer/announcement box, shaped like a section's so the same outline draws it. */
function measureShell(part: ShellPart | null): Box | null {
  if (!part) return null;
  const el = shellEl(part);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return { id: part, index: -1, top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

/** Every section's box, in document order — what a drag in progress needs to place a drop. */
function measureAll(): Box[] {
  return Array.from(document.querySelectorAll<HTMLElement>(`[${SECTION_ATTR}]`)).map((el) => {
    const rect = el.getBoundingClientRect();
    return {
      id: el.getAttribute(SECTION_ATTR) ?? "",
      index: Number(el.getAttribute(INDEX_ATTR) ?? 0),
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };
  });
}

/** Brings an element the editor just picked into view — only when it is not already there. */
function revealElement(elementId: string) {
  const marker = elementNode(elementId);
  const rect = marker ? elementRect(marker) : null;
  if (!rect) return;
  const header = document.querySelector("header")?.getBoundingClientRect().height ?? 0;
  if (rect.top >= header + 48 && rect.top + rect.height <= window.innerHeight - 16) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: rect.top + window.scrollY - header - 64, behavior: reduce ? "auto" : "smooth" });
}

export function PreviewBridge({
  parentOrigin,
  editable,
  token,
  initialTheme,
  initialShell = null,
}: {
  parentOrigin: string;
  editable: boolean;
  token: string;
  initialTheme: PreviewTheme | null;
  /** The editor's unsaved header/footer settings posted with the tree, for the first paint. */
  initialShell?: ShellOverride | null;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [hoveredShell, setHoveredShell] = useState<ShellPart | null>(null);
  const [selectedShell, setSelectedShell] = useState<ShellPart | null>(null);
  const [shellLabels, setShellLabels] = useState<Partial<Record<ShellPart, string>>>({});
  const [shell, setShell] = useState<ShellOverride | null>(initialShell);
  const setShellOverride = useSetShellOverride();
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [elementLabels, setElementLabels] = useState<Record<string, string>>({});
  const [strings, setStrings] = useState<Strings>(DEFAULT_STRINGS);
  const [abilities, setAbilities] = useState<Abilities>(LEGACY_ABILITIES);
  // A block from the library is being dragged over the canvas, and — once the
  // dashboard has measured our sections and done the math — which gap it's
  // nearest to right now. Both come from the editor (zimos:drag-state); this
  // frame never computes either one itself.
  const [dragActive, setDragActive] = useState(false);
  const [dragHoverIndex, setDragHoverIndex] = useState<number | null>(null);
  // X-ray outlines and the texts a double-click edits (useCanvasText.ts), from zimos:editor-state.
  const [xray, setXray] = useState(false);
  const [inlineText, setInlineText] = useState<string[]>([]);
  // Bumped on scroll/resize so the fixed outlines (and, mid-drag, the section
  // rects the dashboard needs) follow the page.
  const [tick, setTick] = useState(0);
  const frame = useRef(0);

  // What the click handler needs to know right now, without re-subscribing:
  // written where the selection changes (a click here, a message from the editor).
  const selectedRef = useRef<string | null>(null);
  const selectedElementRef = useRef<string | null>(null);
  const abilitiesRef = useRef<Abilities>(LEGACY_ABILITIES);

  const post = useCallback(
    (message: Record<string, unknown>) => {
      if (window.parent === window) return;
      window.parent.postMessage(message, parentOrigin);
    },
    [parentOrigin]
  );

  // The overlay's fixed look, and the ghost of whatever shoppers don't see (canvasChrome.ts).
  useCanvasChrome(editable, strings.hidden);

  // X-ray outlines and double-click text editing (useCanvasText.ts).
  useCanvasText({ editable, xray, inlineText, hint: strings.editText, post });

  // Dragging and resizing on the page itself (useCanvasDrag.ts).
  const drag = useCanvasDrag({ post, parentOrigin, focusKey: `zimos-preview-focus:${token}` });
  // The overlay measures the page as it renders, which only a browser can:
  // on the server (and while hydrating) it draws nothing.
  const isClient = useIsClient();

  // Theme, scroll restore and the ready handshake — once per load.
  useEffect(() => {
    applyTheme(initialTheme);

    // Every edit reloads the frame; keep the merchant where they were.
    const key = `zimos-preview-scroll:${token}`;
    try {
      const y = Number(sessionStorage.getItem(key));
      if (y > 0) window.scrollTo(0, y);
    } catch {
      // Storage blocked — the preview just starts at the top.
    }
    const remember = () => {
      try {
        sessionStorage.setItem(key, String(Math.round(window.scrollY)));
      } catch {
        // ignore
      }
    };

    const remeasure = () => {
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => setTick((n) => n + 1));
    };
    const onScroll = () => {
      remember();
      remeasure();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", remeasure);
    // Images and client blocks settle after hydration and move sections about.
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(remeasure) : null;
    observer?.observe(document.body);

    post({ type: "zimos:preview-ready", sectionIds: sectionIds(), colorMode: pageColorMode() });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", remeasure);
      observer?.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, [initialTheme, post, token]);

  // The unsaved header/footer settings go to the layout's StoreShellProvider,
  // which re-renders the real header and footer with them. The header's logo
  // node may be new afterwards, so the unsaved logo is laid over it again.
  useEffect(() => {
    setShellOverride(shell);
    const frameId = requestAnimationFrame(() => {
      if (lastTheme) applyLogo(lastTheme.logoUrl);
    });
    return () => cancelAnimationFrame(frameId);
  }, [shell, setShellOverride]);

  // The page's mode, as the editor's switch should show it: the in-page moon
  // (ThemeToggle), the OS setting or the editor itself all end up as the
  // `.dark` class on <html>.
  useEffect(() => {
    let last = pageColorMode();
    const observer = new MutationObserver(() => {
      const mode = pageColorMode();
      if (mode === last) return;
      last = mode;
      post({ type: "zimos:color-mode", mode });
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [post]);

  // Messages from the editor. Anything not from the framing dashboard is ignored.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== window.parent || event.origin !== parentOrigin) return;
      const data = event.data as Record<string, unknown> | null;
      if (!data || typeof data !== "object") return;

      if (data.type === "zimos:editor-state") {
        const nextSelected = typeof data.selectedId === "string" ? data.selectedId : null;
        selectedRef.current = nextSelected;
        setSelected(nextSelected);
        const nextAbilities = readAbilities(data.can);
        abilitiesRef.current = nextAbilities;
        setAbilities((prev) => (sameAbilities(prev, nextAbilities) ? prev : nextAbilities));
        // The element picked in the editor. One this frame picked itself is
        // already on screen; one picked from the editor's side is scrolled to.
        const nextElement =
          nextAbilities.selectElement && typeof data.selectedElementId === "string" && data.selectedElementId.length <= 200
            ? data.selectedElementId
            : null;
        if (nextElement !== selectedElementRef.current) {
          selectedElementRef.current = nextElement;
          setSelectedElement(nextElement);
          if (nextElement) revealElement(nextElement);
        }
        setSelectedShell(isShellPart(data.selectedShell) ? data.selectedShell : null);
        if (data.shellLabels && typeof data.shellLabels === "object") {
          const next: Partial<Record<ShellPart, string>> = {};
          for (const part of SHELL_PARTS) {
            const label = (data.shellLabels as Record<string, unknown>)[part];
            if (typeof label === "string") next[part] = label.slice(0, 80);
          }
          setShellLabels(next);
        }
        if ("shell" in data) setShell(data.shell === null ? null : readShellOverride(data.shell));
        if (data.labels && typeof data.labels === "object") {
          const next: Record<string, string> = {};
          for (const [id, label] of Object.entries(data.labels as Record<string, unknown>)) {
            if (typeof label === "string") next[id] = label.slice(0, 80);
          }
          setLabels(next);
        }
        if (data.elementLabels && typeof data.elementLabels === "object") {
          const next: Record<string, string> = {};
          for (const [type, label] of Object.entries(data.elementLabels as Record<string, unknown>).slice(0, 200)) {
            if (typeof label === "string" && /^[a-z][a-z0-9_]{0,59}$/.test(type)) next[type] = label.slice(0, 60);
          }
          setElementLabels(next);
        }
        if (data.strings && typeof data.strings === "object") {
          const s = data.strings as Record<string, unknown>;
          const next = { ...DEFAULT_STRINGS };
          for (const key of Object.keys(DEFAULT_STRINGS) as Array<keyof Strings>) {
            if (typeof s[key] === "string") next[key] = (s[key] as string).slice(0, 200);
          }
          setStrings(next);
        }
        setXray(data.xray === true);
        if (Array.isArray(data.inlineText)) {
          const ids = data.inlineText.filter((id): id is string => typeof id === "string" && id.length <= 200).slice(0, 2000);
          setInlineText((prev) => (prev.length === ids.length && prev.every((id, i) => id === ids[i]) ? prev : ids));
        }
        if ("theme" in data) applyTheme(readPreviewTheme(data.theme));
        const mode = readColorMode(data.colorMode);
        if (mode && mode !== pageColorMode()) setColorMode(mode);
      } else if (data.type === "zimos:patch") {
        // Small edits, applied to the page as it stands (canvasPatch.ts); the
        // outlines measure again, since a text or a padding moves things.
        if (applyPatch(readPatch(data.ops))) setTick((n) => n + 1);
      } else if (data.type === "zimos:scroll-to-section" && typeof data.sectionId === "string") {
        const el = sectionEl(data.sectionId);
        if (!el) return;
        const header = document.querySelector("header")?.getBoundingClientRect().height ?? 0;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({
          top: el.getBoundingClientRect().top + window.scrollY - header - 8,
          behavior: reduce ? "auto" : "smooth",
        });
      } else if (data.type === "zimos:scroll-to-shell" && isShellPart(data.part)) {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const behavior = reduce ? "auto" : "smooth";
        if (data.part === "footer") {
          shellEl("footer")?.scrollIntoView({ behavior, block: "end" });
        } else {
          window.scrollTo({ top: 0, behavior });
        }
      } else if (data.type === "zimos:drag-state") {
        setDragActive(data.active === true);
        setDragHoverIndex(typeof data.hoverIndex === "number" ? data.hoverIndex : null);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [parentOrigin]);

  // While a drag is on, hand the dashboard our geometry so it can work out
  // which gap the pointer (which it, not this frame, receives dragover/drop
  // events for — see the header comment) is nearest to. Re-sent on every
  // remeasure so a drag started before images/hydration settle still tracks.
  useEffect(() => {
    if (!dragActive) return;
    post({
      type: "zimos:section-rects",
      sections: measureAll().map(({ id, index, top, height }) => ({ sectionId: id, index, top, height })),
    });
    // `tick` is a real dependency here, not just satisfying the linter: it's
    // what makes this resend on every remeasure while the drag is on.
  }, [dragActive, tick, post]);

  // Clicks select; links and forms stay put so the frame never leaves the preview.
  useEffect(() => {
    if (!editable) return;

    function onClick(event: MouseEvent) {
      const target = event.target as Element | null;
      if (!target || target.closest(`[${OVERLAY_ATTR}]`)) return;
      // The page's own light/dark switch works as it does for a shopper,
      // without selecting the header it sits in.
      if (target.closest("[data-zimos-passthrough]")) return;
      // The empty page's own "add a section" button (see the preview page).
      const insert = target.closest<HTMLElement>("[data-zimos-insert]");
      if (insert) {
        post({ type: "zimos:insert-section", index: Number(insert.dataset.zimosInsert) || 0 });
        return;
      }
      if (target.closest("a[href]")) event.preventDefault();
      // A text being typed in place: the click only moves the caret.
      if (target.closest("[contenteditable]")) return;
      // The header, footer and announcement bar: the innermost one wins, so a
      // click on the announcement bar (inside the header) picks the bar.
      const part = target.closest<HTMLElement>(`[${SHELL_ATTR}]`)?.getAttribute(SHELL_ATTR);
      if (isShellPart(part)) {
        selectedRef.current = null;
        selectedElementRef.current = null;
        setSelectedShell(part);
        setSelected(null);
        setSelectedElement(null);
        post({ type: "zimos:select-shell", part });
        return;
      }
      const section = target.closest<HTMLElement>(`[${SECTION_ATTR}]`);
      if (!section) return;
      const id = section.getAttribute(SECTION_ATTR) ?? "";
      const can = abilitiesRef.current;

      // One click picks the element under the pointer, whichever section it is in (its section comes with it):
      // the merchant edits what they pressed, without first selecting the section around it.
      const marker = can.selectElement ? target.closest<HTMLElement>(`[${EL_ATTR}]`) : null;
      const elementId = marker?.getAttribute(EL_ATTR) ?? "";
      if (marker && elementId) {
        // The picture of the element that is already picked: replace it.
        if (can.pickImage && elementId === selectedElementRef.current && target.closest("img, picture")) {
          const field = imageFieldOf(marker);
          if (field) {
            post({ type: "zimos:pick-image", sectionId: id, elementId, field });
            return;
          }
        }
        selectedRef.current = id;
        setSelected(id);
        setSelectedShell(null);
        selectedElementRef.current = elementId;
        setSelectedElement(elementId);
        post({
          type: "zimos:select-element",
          sectionId: id,
          elementId,
          elementType: marker.getAttribute(TYPE_ATTR) ?? "",
        });
        return;
      }

      selectedRef.current = id;
      selectedElementRef.current = null;
      setSelected(id);
      setSelectedElement(null);
      setSelectedShell(null);
      post({ type: "zimos:select-section", sectionId: id });
    }
    function onSubmit(event: SubmitEvent) {
      event.preventDefault();
    }
    function onOver(event: MouseEvent) {
      const target = event.target as Element | null;
      if (target?.closest(`[${OVERLAY_ATTR}]`)) return;
      const part = target?.closest<HTMLElement>(`[${SHELL_ATTR}]`)?.getAttribute(SHELL_ATTR);
      setHoveredShell(isShellPart(part) ? part : null);
      const section = target?.closest<HTMLElement>(`[${SECTION_ATTR}]`);
      setHovered(section ? section.getAttribute(SECTION_ATTR) : null);
    }
    function onOut(event: MouseEvent) {
      if (!event.relatedTarget) {
        setHovered(null);
        setHoveredShell(null);
      }
    }

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
    };
  }, [editable, post]);

  if (!editable || !isClient) return null;

  const boxes: Array<{ box: Box; active: boolean }> = [];
  const selectedBox = measure(selected);
  const hoveredBox = hovered !== selected ? measure(hovered) : null;
  if (hoveredBox) boxes.push({ box: hoveredBox, active: false });
  if (selectedBox) boxes.push({ box: selectedBox, active: true });
  const total = sectionIds().length;
  const shellBoxes: Array<{ box: Box; active: boolean }> = [];
  const selectedShellBox = measureShell(selectedShell);
  const hoveredShellBox = hoveredShell !== selectedShell ? measureShell(hoveredShell) : null;
  if (hoveredShellBox) shellBoxes.push({ box: hoveredShellBox, active: false });
  if (selectedShellBox) shellBoxes.push({ box: selectedShellBox, active: true });
  // An element is only "selected" inside the selected section.
  const pickedElement = selected && abilities.selectElement ? selectedElement : null;

  // The bar's buttons: what the editor listens for, or — when it did not say —
  // the two move buttons it always had.
  const actions: readonly SectionAction[] = abilities.sectionActions ?? ["up", "down"];
  const act = (sectionId: string, action: SectionAction) => {
    if (abilities.sectionActions === null) {
      if (action === "up" || action === "down") post({ type: "zimos:move-section", sectionId, direction: action });
      return;
    }
    post({ type: "zimos:section-action", sectionId, action });
  };

  return (
    <div data-zimos-overlay="">
      {boxes.map(({ box, active }) => (
        <SectionOutline
          key={`${box.id}-${active ? "selected" : "hover"}`}
          box={box}
          active={active}
          quiet={active && pickedElement !== null}
          total={total}
          label={labels[box.id] ?? ""}
          strings={strings}
          actions={actions}
          hidden={active ? sectionHidden(box.id) : false}
          onInsert={(index) => post({ type: "zimos:insert-section", index })}
          onAction={(action) => act(box.id, action)}
          grip={active ? <SectionGrip drag={drag} sectionId={box.id} label={strings.dragSection} /> : null}
        />
      ))}
      <CanvasHandles
        sectionId={selected}
        drag={drag}
        strings={strings}
        focusKey={`zimos-preview-focus:${token}`}
        selectedElementId={pickedElement}
        elementName={(type) => elementLabels[type] ?? typeName(type)}
        onPickImage={
          abilities.pickImage && selected
            ? (elementId, field) => post({ type: "zimos:pick-image", sectionId: selected, elementId, field })
            : undefined
        }
      />
      {/* A section being dragged on the page: the same gap lines as a block
          dragged in from the library, the nearest one as the editor says. */}
      {drag.active?.kind === "section" && drag.feedback?.kind === "section" && (
        <DragGaps hoverIndex={drag.feedback.gapIndex} />
      )}
      {shellBoxes.map(({ box, active }) => (
        <ShellOutline
          key={`${box.id}-${active ? "selected" : "hover"}`}
          box={box}
          active={active}
          label={shellLabels[box.id as ShellPart] ?? ""}
        />
      ))}
      {/* While a block is being dragged in from the library, every gap is a
          live drop target — not just the one near the mouse — with the
          nearest one (as the dashboard has worked out) picked out. */}
      {dragActive && <DragGaps hoverIndex={dragHoverIndex} />}
    </div>
  );
}

/** The direction the page reads in, for rows that lay a chip at the start and a bar at the end. */
function pageDirection(id: string): "rtl" | "ltr" {
  const el = sectionEl(id) ?? document.body;
  return isRtl(el) ? "rtl" : "ltr";
}

function SectionOutline({
  box,
  active,
  quiet,
  total,
  label,
  strings,
  actions,
  hidden,
  onInsert,
  onAction,
  grip = null,
}: {
  box: Box;
  /** Selected (a solid outline, the name, the bar) rather than only under the pointer. */
  active: boolean;
  /** An element inside is selected: the section steps back to a lighter line and drops its name. */
  quiet: boolean;
  /** How many sections the page has, so the up/down buttons disable at either end. */
  total: number;
  label: string;
  strings: Strings;
  actions: readonly SectionAction[];
  /** Shoppers don't see this section: the eye button offers "show". */
  hidden: boolean;
  onInsert: (index: number) => void;
  onAction: (action: SectionAction) => void;
  /** The selected section's drag grip (CanvasHandles.tsx), first on its bar. */
  grip?: ReactNode;
}) {
  // The row rides just under the top edge (clear of the "+" on it), and stays
  // in view while a section taller than the screen scrolls past.
  const pinned = Math.min(Math.max(box.top + 20, 6), box.top + box.height - 50);
  const rowTop = box.height < 76 ? box.top + 20 : pinned;
  const has = (action: SectionAction) => actions.includes(action);

  return (
    <>
      <div
        style={{
          position: "fixed",
          top: box.top,
          left: box.left,
          width: box.width,
          height: box.height,
          ...(active
            ? { boxShadow: quiet ? "inset 0 0 0 1px rgba(22, 93, 255, 0.6)" : RING_INSIDE }
            : { outline: `1px dashed ${BLUE}`, outlineOffset: -1, background: "rgba(22, 93, 255, 0.04)" }),
          pointerEvents: "none",
          zIndex: LAYER,
        }}
      />
      {(active || label) && (
        <div
          style={{
            position: "fixed",
            top: active ? rowTop : Math.max(box.top + 20, 6),
            left: box.left,
            width: box.width,
            pointerEvents: "none",
            zIndex: LAYER + 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            paddingInline: 8,
            direction: pageDirection(box.id),
          }}
        >
          {label && !quiet ? <span data-zc="chip">{label}</span> : <span />}
          {/* While one element is picked the bar steps aside: it would sit on the very thing being edited. */}
          {active && !quiet && (grip || actions.length > 0) ? (
            <span data-zc="bar" role="toolbar" aria-label={label || undefined}>
              {grip}
              {grip && actions.length > 0 ? <span data-zc="rule" aria-hidden /> : null}
              {has("up") && (
                <BarButton label={strings.moveUp} disabled={box.index <= 0} onClick={() => onAction("up")}>
                  <ArrowUpIcon size={18} aria-hidden />
                </BarButton>
              )}
              {has("down") && (
                <BarButton label={strings.moveDown} disabled={box.index >= total - 1} onClick={() => onAction("down")}>
                  <ArrowDownIcon size={18} aria-hidden />
                </BarButton>
              )}
              {has("duplicate") && (
                <BarButton label={strings.duplicate} onClick={() => onAction("duplicate")}>
                  <CopySimpleIcon size={18} aria-hidden />
                </BarButton>
              )}
              {has("hide") && (
                <BarButton label={hidden ? strings.show : strings.hide} pressed={hidden} onClick={() => onAction("hide")}>
                  {hidden ? <EyeIcon size={18} aria-hidden /> : <EyeSlashIcon size={18} aria-hidden />}
                </BarButton>
              )}
              {has("delete") && (
                <BarButton label={strings.remove} tone="danger" onClick={() => onAction("delete")}>
                  <TrashIcon size={18} aria-hidden />
                </BarButton>
              )}
            </span>
          ) : null}
        </div>
      )}
      <InsertButton top={box.top} box={box} label={strings.addAbove} text={strings.addSection} onClick={() => onInsert(box.index)} />
      <InsertButton
        top={box.top + box.height}
        box={box}
        label={strings.addBelow}
        text={strings.addSection}
        onClick={() => onInsert(box.index + 1)}
      />
    </>
  );
}

/** One round button on the section's bar. Up/down glyphs don't mirror in RTL: a section moves up or down the page either way. */
function BarButton({
  label,
  onClick,
  disabled = false,
  pressed,
  tone,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  tone?: "danger";
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      data-zc="act"
      data-tone={tone}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/**
 * The header, footer or announcement bar's outline: the same frame and name
 * chip a section gets, but none of its buttons — these parts are fixed, on
 * every page, and can't be moved, inserted around or deleted.
 */
function ShellOutline({ box, active, label }: { box: Box; active: boolean; label: string }) {
  const chipTop = Math.min(Math.max(box.top + 6, 6), box.top + box.height - 30);
  return (
    <>
      <div
        style={{
          position: "fixed",
          top: box.top,
          left: box.left,
          width: box.width,
          height: box.height,
          ...(active
            ? { boxShadow: RING_INSIDE }
            : { outline: `1px dashed ${BLUE}`, outlineOffset: -1, background: "rgba(22, 93, 255, 0.04)" }),
          pointerEvents: "none",
          zIndex: LAYER,
        }}
      />
      {label && (
        // A full-width row, like a section's, so the name sits at the inline
        // start in either direction.
        <div
          style={{
            position: "fixed",
            top: box.height < 36 ? box.top + 2 : chipTop,
            left: box.left,
            width: box.width,
            display: "flex",
            paddingInline: 8,
            pointerEvents: "none",
            zIndex: LAYER + 1,
          }}
        >
          <span data-zc="chip">{label}</span>
        </div>
      )}
    </>
  );
}

/**
 * One fixed line per gap between sections (and one above the first, one below
 * the last — `sections.length + 1` of them), shown for as long as a block is
 * being dragged over the canvas. The one nearest the pointer — `hoverIndex`,
 * as the dashboard computed it from the `zimos:section-rects` this frame just
 * sent it — is drawn solid; the rest stay faint, so the merchant can see every
 * place the block could land, not just the one closest right now.
 */
function DragGaps({ hoverIndex }: { hoverIndex: number | null }) {
  const boxes = measureAll().sort((a, b) => a.index - b.index);
  if (boxes.length === 0) return null;

  const gaps: Array<{ index: number; top: number; left: number; width: number }> = [];
  for (let i = 0; i <= boxes.length; i++) {
    const top =
      i === 0
        ? boxes[0].top
        : i === boxes.length
          ? boxes[boxes.length - 1].top + boxes[boxes.length - 1].height
          : (boxes[i - 1].top + boxes[i - 1].height + boxes[i].top) / 2;
    const around = boxes[Math.min(i, boxes.length - 1)];
    gaps.push({ index: i, top, left: around.left, width: around.width });
  }

  return (
    <>
      {gaps.map((gap) => {
        const active = gap.index === hoverIndex;
        return (
          <div
            key={gap.index}
            style={{
              position: "fixed",
              top: gap.top - 2,
              left: gap.left,
              width: gap.width,
              height: 4,
              borderRadius: 999,
              background: BLUE,
              opacity: active ? 1 : 0.3,
              transform: active ? "none" : "scaleY(0.5)",
              boxShadow: active ? "0 0 0 1px #fff" : "none",
              pointerEvents: "none",
              zIndex: LAYER + 3,
              transition: "opacity 100ms, transform 100ms",
            }}
          />
        );
      })}
    </>
  );
}

/** The round "+" on a section's edge; its words show on hover and keyboard focus (canvasChrome.ts). */
function InsertButton({
  top,
  box,
  label,
  text,
  onClick,
}: {
  top: number;
  box: Box;
  label: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-zc="add"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{ top, left: box.left + box.width / 2, zIndex: LAYER + 2 }}
    >
      <PlusIcon size={16} aria-hidden />
      <span>{text}</span>
    </button>
  );
}
