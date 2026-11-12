"use client";

import { useEffect, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { elementTakesFont } from "@store-builder/ui/fonts";
import { DotsSixVerticalIcon, ImageIcon, TextAaIcon } from "./canvasIcons";
import {
  EL_ATTR,
  SECTION_ATTR,
  TYPE_ATTR,
  columnNode,
  elementNode,
  elementRect,
  imageFieldOf,
  imageNode,
  isRtl,
  logoBox,
  PIC_ATTR,
  PICTURE_HANDLES,
  pictureNode,
  sectionBody,
  sectionDividers,
  sectionNode,
  shellPartNode,
  shellZones,
  type PictureHandle,
  type Rect,
} from "./canvasGeometry";
import { BLUE, INK, LAYER, RING_OUTSIDE, useCoarsePointer } from "./canvasChrome";
import { useBadgePoint, type CanvasDrag, type CanvasTarget } from "./useCanvasDrag";

/**
 * The drag and resize handles on the selected section, and what a drag in
 * progress draws — all a fixed layer over the page, like the rest of the
 * editor's canvas (PreviewBridge), so the page's own markup is untouched.
 *
 *  - under the section: a bar that sets its minimum height;
 *  - between two columns sitting side by side: a bar that moves the boundary;
 *  - on the selected element: its outline, a tag with its name and the grip
 *    that moves it, and on a picture a "replace" button and a corner that
 *    resizes it;
 *  - on the element under the pointer (or the one last touched): a light
 *    outline and a grip, so a block can be dragged without picking it first;
 *  - on a picture of a selected template band (the one under the pointer, or
 *    last touched) and on a selected header's or footer's logo: handles on
 *    its edges and corners that resize it (PictureHandles, LogoHandles).
 *
 * Every handle is a real button: focus it and the arrow keys do one step
 * (Shift for a fine step where there is one). Esc cancels a drag. With a
 * finger the handles are 36px with a 44px hit area (canvasChrome.ts).
 */

const HANDLES = LAYER + 4;

export interface CanvasStrings {
  dragSection: string;
  dragElement: string;
  resizeHeight: string;
  resizeColumns: string;
  resizeImage: string;
  /** The button on a selected picture; without it the button is not drawn. */
  replaceImage?: string;
  /** The "Aa" on the selected element's tag. */
  font?: string;
  /** The handles on a template band's picture and on a template logo; without them they are not drawn. */
  resizePicture?: string;
  resizeLogo?: string;
  /** The toggle that resizes every picture of the band at once. */
  everyPicture?: string;
}

/** A hit area wider than the handle itself (canvasChrome's `[data-zc="handle"]::after`). */
function hit(inset: string): CSSProperties {
  return { "--zc-hit": inset } as CSSProperties;
}

function handleStyle(extra: CSSProperties): CSSProperties {
  return {
    position: "fixed",
    zIndex: HANDLES,
    background: BLUE,
    border: "2px solid #fff",
    boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
    touchAction: "none",
    padding: 0,
    ...extra,
  };
}

/** Pointer and keyboard wiring shared by every handle. */
function handleProps(drag: CanvasDrag, target: CanvasTarget, handle: string, label: string) {
  return {
    type: "button" as const,
    "aria-label": label,
    title: label,
    "data-zimos-handle": handle,
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => drag.begin(target, e),
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => {
      if (drag.step(target, e.key, e.shiftKey)) e.preventDefault();
    },
  };
}

/** The grip on a selected section's bar: drag it up or down the page. */
export function SectionGrip({ drag, sectionId, label }: { drag: CanvasDrag; sectionId: string; label: string }) {
  return (
    <button
      {...handleProps(drag, { kind: "section", sectionId }, `section:${sectionId}`, label)}
      data-zc="act"
      data-grip=""
      data-grabbing={drag.active?.kind === "section" ? "" : undefined}
    >
      <DotsSixVerticalIcon size={18} aria-hidden />
    </button>
  );
}

function rectOf(el: Element | null): Rect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width === 0 && r.height === 0 ? null : { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function CanvasHandles({
  sectionId,
  drag,
  strings,
  focusKey,
  selectedElementId = null,
  elementName,
  onPickImage,
  onPickFont,
  resizePictures = false,
}: {
  /** The selected section; nothing is drawn without one. */
  sectionId: string | null;
  drag: CanvasDrag;
  strings: CanvasStrings;
  /** Where a keyboard step left the name of the handle to refocus after the refresh. */
  focusKey: string;
  /** The element picked inside the section: outlined, named, and given its own controls. */
  selectedElementId?: string | null;
  /** An element type's name in the editor's language. */
  elementName?: (type: string) => string;
  /** "Replace this picture" — present when the editor listens for it. */
  onPickImage?: (elementId: string, field: string) => void;
  /** "Aa" on the tag of an element with words: its font, in the editor — present when the editor listens for it. */
  onPickFont?: (elementId: string) => void;
  /** A template band's pictures get resize handles (the editor listens for them). */
  resizePictures?: boolean;
}) {
  const [hoveredEl, setHoveredEl] = useState<string | null>(null);
  const [activeEl, setActiveEl] = useState<string | null>(null);
  const coarse = useCoarsePointer();
  const dragging = drag.active !== null;

  // Which element is under the pointer (or was last tapped) inside the
  // selected section. Frozen while a drag is on.
  useEffect(() => {
    if (!sectionId) return;
    const inSection = (target: EventTarget | null) => {
      const el = (target as Element | null)?.closest?.<HTMLElement>(`[${EL_ATTR}]`);
      if (!el) return null;
      return el.closest(`[${SECTION_ATTR}]`)?.getAttribute(SECTION_ATTR) === sectionId ? el.getAttribute(EL_ATTR) : null;
    };
    function onOver(event: MouseEvent) {
      if ((event.target as Element | null)?.closest?.("[data-zimos-overlay]")) return;
      setHoveredEl(inSection(event.target));
    }
    function onDown(event: globalThis.PointerEvent) {
      if ((event.target as Element | null)?.closest?.("[data-zimos-overlay]")) return;
      setActiveEl(inSection(event.target));
    }
    document.addEventListener("mouseover", onOver);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [sectionId]);

  // A different section: forget the last one's element.
  const [lastSection, setLastSection] = useState(sectionId);
  if (lastSection !== sectionId) {
    setLastSection(sectionId);
    setHoveredEl(null);
    setActiveEl(null);
  }

  // After a keyboard step the preview refreshes; give the handle the
  // merchant was using its focus back, so the next arrow press still works.
  useEffect(() => {
    if (!sectionId) return;
    let name: string | null = null;
    try {
      name = sessionStorage.getItem(focusKey);
      if (name) sessionStorage.removeItem(focusKey);
    } catch {
      return;
    }
    if (!name) return;
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-zimos-handle="${CSS.escape(name!)}"]`)?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [sectionId, focusKey]);

  const shownEl = dragging
    ? drag.active?.kind === "element" || drag.active?.kind === "image-width"
      ? drag.active.elementId
      : null
    : (hoveredEl ?? activeEl);

  return (
    <>
      {sectionId && <SectionHandles sectionId={sectionId} drag={drag} strings={strings} coarse={coarse} />}
      {sectionId && selectedElementId && (
        <SelectedElement
          sectionId={sectionId}
          elementId={selectedElementId}
          drag={drag}
          strings={strings}
          coarse={coarse}
          elementName={elementName}
          onPickImage={onPickImage}
          onPickFont={onPickFont}
        />
      )}
      {sectionId && shownEl && shownEl !== selectedElementId && (
        <ElementHandles sectionId={sectionId} elementId={shownEl} drag={drag} strings={strings} coarse={coarse} />
      )}
      {sectionId && selectedElementId && resizePictures && strings.resizePicture && (
        <PictureHandles sectionId={sectionId} elementId={selectedElementId} drag={drag} strings={strings} coarse={coarse} />
      )}
      <DragPicture drag={drag} />
    </>
  );
}

function SectionHandles({
  sectionId,
  drag,
  strings,
  coarse,
}: {
  sectionId: string;
  drag: CanvasDrag;
  strings: CanvasStrings;
  coarse: boolean;
}) {
  const body = rectOf(sectionBody(sectionId));
  const dividers = sectionDividers(sectionId);
  const resizingHeight = drag.active?.kind === "section-height";
  // A bar is thin by nature; with a finger it is longer and thicker, and its hit area is 44px across.
  const long = coarse ? 56 : 40;
  const thick = coarse ? 14 : 10;

  return (
    <>
      {body && (
        <button
          {...handleProps(drag, { kind: "section-height", sectionId }, `height:${sectionId}`, strings.resizeHeight)}
          data-zc="handle"
          style={{
            ...handleStyle({
              // Beside the section's own "+" (which sits on the middle of its
              // bottom edge), so the two never overlap.
              top: body.top + body.height - thick / 2,
              left: body.left + body.width / 2 + 26,
              width: long,
              height: thick,
              borderRadius: 999,
              cursor: "ns-resize",
              opacity: resizingHeight ? 1 : 0.9,
            }),
            ...hit(coarse ? "-15px 0" : "-6px"),
          }}
        />
      )}
      {dividers.map((d) => {
        const target: CanvasTarget = { kind: "column-width", sectionId, rowId: d.rowId, index: d.index };
        const active =
          drag.active?.kind === "column-width" && drag.active.rowId === d.rowId && drag.active.index === d.index;
        return (
          <div key={`${d.rowId}:${d.index}`}>
            <div
              aria-hidden
              style={{
                position: "fixed",
                top: d.top,
                left: d.x - 0.5,
                width: 1,
                height: d.height,
                borderInlineStart: `1px dashed ${active ? BLUE : "rgba(22, 93, 255, 0.55)"}`,
                pointerEvents: "none",
                zIndex: HANDLES,
              }}
            />
            <button
              {...handleProps(drag, target, `columns:${d.rowId}:${d.index}`, strings.resizeColumns)}
              data-zc="handle"
              style={{
                ...handleStyle({
                  top: d.top + Math.max(0, d.height / 2 - long / 2),
                  left: d.x - thick / 2,
                  width: thick,
                  height: Math.min(long, Math.max(20, d.height)),
                  borderRadius: 999,
                  cursor: "col-resize",
                }),
                ...hit(coarse ? "0 -15px" : "-6px"),
              }}
            />
          </div>
        );
      })}
    </>
  );
}

/** The corner of a picture that resizes it — bottom, at the inline end. */
function ImageCorner({
  sectionId,
  elementId,
  img,
  rtl,
  drag,
  label,
  coarse,
}: {
  sectionId: string;
  elementId: string;
  img: Rect;
  rtl: boolean;
  drag: CanvasDrag;
  label: string;
  coarse: boolean;
}) {
  const size = coarse ? 36 : 16;
  const overhang = coarse ? 12 : 7;
  return (
    <button
      {...handleProps(drag, { kind: "image-width", sectionId, elementId }, `image:${elementId}`, label)}
      data-zc="handle"
      style={{
        ...handleStyle({
          top: img.top + img.height - size + overhang,
          left: rtl ? img.left - overhang : img.left + img.width - size + overhang,
          width: size,
          height: size,
          borderRadius: coarse ? 999 : 4,
          cursor: rtl ? "nesw-resize" : "nwse-resize",
        }),
        ...hit(coarse ? "-4px" : "-8px"),
      }}
    />
  );
}

/**
 * The element picked in the editor: the fixed outline (2px blue, 1px white
 * halo), a tag above it with its name and the grip that moves it, and for a
 * picture the "replace" button and the resize corner.
 */
function SelectedElement({
  sectionId,
  elementId,
  drag,
  strings,
  coarse,
  elementName,
  onPickImage,
  onPickFont,
}: {
  sectionId: string;
  elementId: string;
  drag: CanvasDrag;
  strings: CanvasStrings;
  coarse: boolean;
  elementName?: (type: string) => string;
  onPickImage?: (elementId: string, field: string) => void;
  onPickFont?: (elementId: string) => void;
}) {
  const marker = elementNode(elementId);
  if (!marker || marker.closest(`[${SECTION_ATTR}]`)?.getAttribute(SECTION_ATTR) !== sectionId) return null;
  const rect = elementRect(marker);
  if (!rect) return null;

  const rtl = isRtl(marker.parentElement ?? marker);
  const type = marker.getAttribute(TYPE_ATTR) ?? "";
  const name = elementName ? elementName(type) : type;
  const moving = drag.active?.kind === "element" && drag.active.elementId === elementId;
  const img = rectOf(imageNode(elementId));
  const field = onPickImage && strings.replaceImage ? imageFieldOf(marker) : null;

  // The tag sits above the element; with no room there, just inside its top.
  const tagHeight = coarse ? 36 : 28;
  const above = rect.top - tagHeight - 7;
  const tagTop = above >= 4 ? above : rect.top + 6;
  const rowWidth = Math.min(Math.max(rect.width + 6, 200), Math.max(120, window.innerWidth - 8));
  const wanted = rtl ? rect.left + rect.width + 3 - rowWidth : rect.left - 3;
  const rowLeft = Math.min(Math.max(wanted, 4), Math.max(4, window.innerWidth - rowWidth - 4));

  return (
    <>
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: rect.top - 1,
          left: rect.left - 1,
          width: rect.width + 2,
          height: rect.height + 2,
          borderRadius: 4,
          boxShadow: RING_OUTSIDE,
          background: moving ? "rgba(22, 93, 255, 0.12)" : "transparent",
          pointerEvents: "none",
          zIndex: HANDLES - 1,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: tagTop,
          left: rowLeft,
          width: rowWidth,
          display: "flex",
          justifyContent: "flex-start",
          direction: rtl ? "rtl" : "ltr",
          pointerEvents: "none",
          zIndex: HANDLES + 1,
        }}
      >
        <span data-zc="tag">
          <button
            {...handleProps(drag, { kind: "element", sectionId, elementId }, `element:${elementId}`, strings.dragElement)}
            data-zc="act"
            data-grip=""
            data-grabbing={moving ? "" : undefined}
          >
            <DotsSixVerticalIcon size={16} aria-hidden />
          </button>
          {name ? <span>{name}</span> : null}
          {onPickFont && strings.font && elementTakesFont(type) ? (
            <button type="button" data-zc="act" data-zc-font="" aria-label={strings.font} title={strings.font} onClick={() => onPickFont(elementId)}>
              <TextAaIcon size={16} aria-hidden />
            </button>
          ) : null}
        </span>
      </div>
      {img && field && (
        <div
          style={{
            position: "fixed",
            // The picture's bottom corner at the inline start (the resize corner
            // has the other one) — kept in view while a tall picture runs below the fold.
            top: Math.max(img.top + 8, Math.min(img.top + img.height - 44, window.innerHeight - 52)),
            left: img.left,
            width: img.width,
            display: "flex",
            justifyContent: "flex-start",
            direction: rtl ? "rtl" : "ltr",
            paddingInline: 8,
            pointerEvents: "none",
            zIndex: HANDLES + 1,
          }}
        >
          <button
            type="button"
            data-zc="pill"
            data-compact={img.width < 190 ? "" : undefined}
            aria-label={strings.replaceImage}
            title={strings.replaceImage}
            onClick={() => onPickImage?.(elementId, field)}
          >
            <ImageIcon size={18} aria-hidden />
            {img.width < 190 ? null : <span>{strings.replaceImage}</span>}
          </button>
        </div>
      )}
      {img && type === "image" && (
        <ImageCorner
          sectionId={sectionId}
          elementId={elementId}
          img={img}
          rtl={rtl}
          drag={drag}
          label={strings.resizeImage}
          coarse={coarse}
        />
      )}
    </>
  );
}

/** The element under the pointer (not the selected one): a light outline and its grip. */
function ElementHandles({
  sectionId,
  elementId,
  drag,
  strings,
  coarse,
}: {
  sectionId: string;
  elementId: string;
  drag: CanvasDrag;
  strings: CanvasStrings;
  coarse: boolean;
}) {
  const marker = elementNode(elementId);
  const rect = marker ? elementRect(marker) : null;
  if (!marker || !rect) return null;
  const rtl = isRtl(marker.parentElement ?? marker);
  const isImage = marker.getAttribute(TYPE_ATTR) === "image";
  const img = isImage ? rectOf(imageNode(elementId)) : null;
  const moving = drag.active?.kind === "element" && drag.active.elementId === elementId;
  const grip = coarse ? 36 : 22;

  return (
    <>
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          outline: `1px dashed ${BLUE}`,
          outlineOffset: 2,
          background: moving ? "rgba(22, 93, 255, 0.12)" : "transparent",
          pointerEvents: "none",
          zIndex: HANDLES - 1,
        }}
      />
      <button
        {...handleProps(drag, { kind: "element", sectionId, elementId }, `element:${elementId}`, strings.dragElement)}
        data-zc="handle"
        style={{
          ...handleStyle({
            top: rect.top - 4,
            left: rtl ? rect.left + rect.width - grip + 4 : rect.left - 4,
            width: grip,
            height: grip,
            borderRadius: coarse ? 999 : 6,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: moving ? "grabbing" : "grab",
          }),
          ...hit(coarse ? "-4px" : "-6px"),
        }}
      >
        <DotsSixVerticalIcon size={coarse ? 18 : 14} aria-hidden />
      </button>
      {img && (
        <ImageCorner
          sectionId={sectionId}
          elementId={elementId}
          img={img}
          rtl={rtl}
          drag={drag}
          label={strings.resizeImage}
          coarse={coarse}
        />
      )}
    </>
  );
}

/**
 * What a drag in progress looks like: where a moved element would land (a
 * line in its new column), and for a resize, the size it would be — a small
 * badge by the pointer. A section's drop line is PreviewBridge's own
 * DragGaps, shared with the block library's drag.
 */
function DragPicture({ drag }: { drag: CanvasDrag }) {
  const point = useBadgePoint();
  const fb = drag.feedback;
  const faded = drag.pending ? 0.55 : 1;

  let line: Rect | null = null;
  if (fb?.kind === "element") {
    const column = columnNode(fb.columnId);
    const colRect = rectOf(column);
    if (column && colRect) {
      const rects = Array.from(column.querySelectorAll<HTMLElement>(`:scope > [${EL_ATTR}]`))
        .map((el) => elementRect(el))
        .filter((r): r is Rect => r !== null);
      const before = rects[fb.index - 1];
      const after = rects[fb.index];
      const y = before && after
        ? (before.top + before.height + after.top) / 2
        : after
          ? after.top - 4
          : before
            ? before.top + before.height + 4
            : colRect.top + 8;
      line = { top: y - 2, left: colRect.left, width: colRect.width, height: 4 };
    }
  }

  let ghost: Rect | null = null;
  if (drag.active?.kind === "section") ghost = rectOf(sectionNode(drag.active.sectionId));

  const label =
    fb && (fb.kind === "section-height" || fb.kind === "column-width" || fb.kind === "image-width" || fb.kind === "picture" || fb.kind === "logo")
      ? fb.label
      : "";

  return (
    <>
      {ghost && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            ...ghost,
            background: "rgba(22, 93, 255, 0.10)",
            outline: `2px dashed ${BLUE}`,
            outlineOffset: -2,
            pointerEvents: "none",
            zIndex: HANDLES - 1,
          }}
        />
      )}
      {line && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            ...line,
            borderRadius: 999,
            background: BLUE,
            opacity: faded,
            boxShadow: "0 0 0 2px #fff",
            pointerEvents: "none",
            zIndex: HANDLES + 1,
          }}
        />
      )}
      {label && point && !drag.pending && (
        <div
          role="status"
          style={{
            position: "fixed",
            top: point.y + 16,
            left: point.x + 16,
            padding: "4px 10px",
            borderRadius: 999,
            background: INK,
            color: "#fff",
            font: "600 11px/1.3 ui-sans-serif, system-ui, sans-serif",
            whiteSpace: "nowrap",
            boxShadow: "0 0 0 1px rgb(255 255 255 / 0.16)",
            pointerEvents: "none",
            zIndex: HANDLES + 3,
            direction: "ltr",
          }}
        >
          {label}
        </div>
      )}
    </>
  );
}

const RESIZE_CURSOR: Record<PictureHandle, string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
};

/** Where a handle sits on a box: a corner, or the middle of an edge. */
function handleSpot(rect: Rect, handle: PictureHandle): { x: number; y: number } {
  const x = handle.includes("w") ? rect.left : handle.includes("e") ? rect.left + rect.width : rect.left + rect.width / 2;
  const y = handle.includes("n") ? rect.top : handle.includes("s") ? rect.top + rect.height : rect.top + rect.height / 2;
  return { x, y };
}

/** Eight handles (or four corners) around a box: a square at each corner, a short bar on each edge. */
function ResizeFrame({
  rect,
  handles,
  target,
  drag,
  label,
  coarse,
  name,
}: {
  rect: Rect;
  handles: readonly PictureHandle[];
  target: (handle: PictureHandle) => CanvasTarget;
  drag: CanvasDrag;
  label: string;
  coarse: boolean;
  name: (handle: PictureHandle) => string;
}) {
  const corner = coarse ? 20 : 10;
  const long = coarse ? 28 : 18;
  const thin = coarse ? 10 : 6;
  return (
    <>
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          outline: `1px solid ${BLUE}`,
          pointerEvents: "none",
          zIndex: HANDLES - 1,
        }}
      />
      {handles.map((handle) => {
        const { x, y } = handleSpot(rect, handle);
        const isCorner = handle.length === 2;
        const across = handle === "n" || handle === "s";
        const w = isCorner ? corner : across ? long : thin;
        const h = isCorner ? corner : across ? thin : long;
        return (
          <button
            key={handle}
            {...handleProps(drag, target(handle), name(handle), label)}
            data-zc="handle"
            style={{
              ...handleStyle({
                top: y - h / 2,
                left: x - w / 2,
                width: w,
                height: h,
                borderRadius: isCorner ? 3 : 999,
                cursor: RESIZE_CURSOR[handle],
              }),
              ...hit(coarse ? "-6px" : "-5px"),
            }}
          />
        );
      })}
    </>
  );
}

/**
 * A selected template band's pictures: the one under the pointer (or last
 * touched) gets handles on its edges and corners. Shift keeps its shape, Alt
 * resizes from its centre, Ctrl/⌘ — or the "every picture" toggle — gives
 * every picture of the band (of the same list) the size; Esc cancels; on a
 * focused handle the arrows step its width or height (lib/canvasDrag.ts).
 */
export function PictureHandles({
  sectionId,
  elementId,
  drag,
  strings,
  coarse,
}: {
  sectionId: string;
  elementId: string;
  drag: CanvasDrag;
  strings: CanvasStrings;
  coarse: boolean;
}) {
  const [path, setPath] = useState<string | null>(null);
  const [band, setBand] = useState(false);

  // The picture under the pointer inside this band, or the one last touched; frozen while a drag is on.
  useEffect(() => {
    const pick = (target: EventTarget | null) => {
      const node = (target as Element | null)?.closest?.<HTMLElement>(`[${PIC_ATTR}]`);
      if (!node || node.closest(`[${EL_ATTR}]`)?.getAttribute(EL_ATTR) !== elementId) return null;
      return node.getAttribute(PIC_ATTR);
    };
    function onOver(event: MouseEvent) {
      if ((event.target as Element | null)?.closest?.("[data-zimos-overlay]")) return;
      const next = pick(event.target);
      if (next) setPath(next);
    }
    document.addEventListener("mouseover", onOver);
    document.addEventListener("pointerdown", onOver, true);
    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("pointerdown", onOver, true);
    };
  }, [elementId]);

  // Another band: forget the last one's picture.
  const [lastElement, setLastElement] = useState(elementId);
  if (lastElement !== elementId) {
    setLastElement(elementId);
    setPath(null);
  }

  const active = drag.active?.kind === "picture" && drag.active.elementId === elementId ? drag.active.path : null;
  const shown = active ?? path;
  const rect = shown ? rectOf(pictureNode(elementId, shown)) : null;
  if (!shown || !rect) return null;
  const rtl = isRtl(pictureNode(elementId, shown)?.parentElement ?? document.documentElement);

  return (
    <>
      <ResizeFrame
        rect={rect}
        handles={PICTURE_HANDLES}
        target={(handle) => ({ kind: "picture", sectionId, elementId, path: shown, handle, band })}
        drag={drag}
        label={strings.resizePicture ?? ""}
        coarse={coarse}
        name={(handle) => `pic:${elementId}:${shown}:${handle}`}
      />
      {strings.everyPicture && shown.includes(".") && (
        <div
          style={{
            position: "fixed",
            top: Math.max(4, rect.top + 8),
            left: rect.left,
            width: rect.width,
            display: "flex",
            justifyContent: "flex-end",
            direction: rtl ? "rtl" : "ltr",
            paddingInline: 8,
            pointerEvents: "none",
            zIndex: HANDLES + 1,
          }}
        >
          <button
            type="button"
            data-zc="pill"
            data-compact={rect.width < 190 ? "" : undefined}
            aria-pressed={band}
            title={strings.everyPicture}
            onClick={() => setBand((on) => !on)}
            style={band ? { background: BLUE, color: "#fff" } : undefined}
          >
            <span>{band ? "✓ " : ""}{strings.everyPicture}</span>
          </button>
        </div>
      )}
    </>
  );
}

/** A selected template header's or footer's logo: a handle on each corner (it keeps its shape). */
export function LogoHandles({ part, drag, strings }: { part: "header" | "footer"; drag: CanvasDrag; strings: CanvasStrings }) {
  const coarse = useCoarsePointer();
  const rect = rectOf(logoBox(part));
  if (!rect || !strings.resizeLogo) return null;
  return (
    <ResizeFrame
      rect={rect}
      handles={["nw", "ne", "se", "sw"]}
      target={(handle) => ({ kind: "logo", part, handle })}
      drag={drag}
      label={strings.resizeLogo}
      coarse={coarse}
      name={(handle) => `logo:${part}:${handle}`}
    />
  );
}

/**
 * The selected template header's parts: the one under the pointer (or last
 * touched) gets a grip to drag it along its zone or into another — a line
 * shows where it would land — and, focused, the arrow keys move it the same
 * way (lib/canvasDrag.ts "shell-part").
 */
export function ShellPartHandles({ drag, label }: { drag: CanvasDrag; label: string }) {
  const coarse = useCoarsePointer();
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    function onOver(event: Event) {
      const node = (event.target as Element | null)?.closest?.<HTMLElement>('[data-zimos-shell="header"] [data-xs-part]');
      if (node) setShown(node.getAttribute("data-xs-part"));
    }
    document.addEventListener("mouseover", onOver);
    document.addEventListener("pointerdown", onOver, true);
    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("pointerdown", onOver, true);
    };
  }, []);

  const active = drag.active?.kind === "shell-part" ? drag.active.id : null;
  const id = active ?? shown;
  const node = id ? shellPartNode(id) : null;
  const rect = node ? (rectOf(node) ?? elementRect(node)) : null;
  const size = coarse ? 28 : 18;
  // On the corner the header reads from.
  const startsRight = isRtl(document.querySelector('[data-zimos-shell="header"]') ?? document.documentElement);

  // Where the dragged part would land, drawn as a line in its zone.
  let line: Rect | null = null;
  const fb = drag.feedback;
  if (fb?.kind === "shell-part") {
    const zone = shellZones().find((z) => z.zone === fb.zone);
    if (zone) {
      const before = zone.parts[fb.index - 1];
      const after = zone.parts[fb.index];
      const rtl = startsRight;
      const edge = (p: { left: number; width: number }, end: boolean) => (end !== rtl ? p.left + p.width : p.left);
      const x = after ? edge(after, false) - 3 : before ? edge(before, true) + 3 : rtl ? zone.left + zone.width - 4 : zone.left + 4;
      line = { top: zone.top - window.scrollY, left: x - window.scrollX - 2, width: 4, height: Math.max(24, zone.height) };
    }
  }

  return (
    <>
      {rect && id && (
        <>
          <div
            aria-hidden
            style={{ position: "fixed", ...rect, outline: `1px dashed ${BLUE}`, outlineOffset: 2, pointerEvents: "none", zIndex: HANDLES - 1 }}
          />
          <button
            {...handleProps(drag, { kind: "shell-part", id }, `part:${id}`, label)}
            data-zc="handle"
            style={{
              ...handleStyle({
                top: rect.top - size / 2,
                left: (startsRight ? rect.left + rect.width : rect.left) - size / 2,
                width: size,
                height: size,
                borderRadius: 6,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: active ? "grabbing" : "grab",
              }),
              ...hit("-6px"),
            }}
          >
            <DotsSixVerticalIcon size={coarse ? 16 : 12} aria-hidden />
          </button>
        </>
      )}
      {line && (
        <div
          aria-hidden
          style={{ position: "fixed", ...line, borderRadius: 999, background: BLUE, boxShadow: "0 0 0 2px #fff", pointerEvents: "none", zIndex: HANDLES + 1 }}
        />
      )}
    </>
  );
}
