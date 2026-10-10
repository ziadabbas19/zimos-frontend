"use client";

import { useEffect } from "react";
import { EL_ATTR, TYPE_ATTR, inlineTextNode } from "./canvasGeometry";
import { BLUE } from "./canvasChrome";

/**
 * Item 95 on the canvas: X-ray outlines and double-click text
 * editing. The editor says which elements' text may be edited
 * (`inlineText` on zimos:editor-state — never text bound to live data) and
 * whether the outlines are on; this frame draws and edits, and posts the
 * committed text back as { type: "zimos:edit-text", elementId, text }. The
 * editor changes the tree, which re-renders the page as any edit does.
 *
 * Editing makes the element's own text node editable in place — plain text
 * only, Enter commits a one-line text (a heading, a button), Escape puts the
 * old text back, leaving the element commits.
 *
 * On a touch screen a double-tap does what a double-click does: not every
 * mobile browser sends `dblclick`, so two taps on the same text in quick
 * succession count as one. A single tap still only selects, and a drag of
 * the finger still scrolls the page — nothing here listens to touch moves.
 */

const XRAY_STYLE_ID = "zimos-xray";
const XRAY_CSS = `
[data-zimos-section]{outline:1px dashed rgba(22,93,255,.6)!important;outline-offset:-1px}
[data-zimos-row]{outline:1px dashed rgba(16,185,129,.75)!important;outline-offset:-2px}
[data-zimos-column]{outline:1px dashed rgba(245,158,11,.85)!important;outline-offset:-3px}
[data-zimos-el]>*,[data-zimos-el]>[data-zs]>*{outline:1px dotted rgba(219,39,119,.8)!important;outline-offset:1px}
`;
const EDITABLE_CSS_ID = "zimos-inline-text";
// `touch-action: manipulation` keeps a double-tap from zooming the page; one finger still scrolls it.
const EDITABLE_CSS = `[data-zimos-text]{cursor:text;touch-action:manipulation}[data-zimos-text][contenteditable]{outline:2px solid ${BLUE}!important;outline-offset:2px;box-shadow:0 0 0 5px rgb(255 255 255/.9);cursor:text;user-select:text;-webkit-user-select:text}`;
const MULTILINE = new Set(["text", "rich_text"]);
/** A contenteditable node hands back non-breaking spaces (character 160) for runs of spaces; the tree keeps plain ones. */
const NBSP = new RegExp(String.fromCharCode(160), "g");
/** Two taps on the same text this close together are a double-tap. */
const DOUBLE_TAP_MS = 400;
/** A click this soon after a touch ended came from that touch. */
const TOUCH_CLICK_MS = 800;

export function useCanvasText({
  editable,
  xray,
  inlineText,
  hint,
  post,
}: {
  editable: boolean;
  xray: boolean;
  inlineText: string[];
  hint: string;
  post: (message: Record<string, unknown>) => void;
}) {
  // X-ray: one style tag, on or off.
  useEffect(() => {
    if (!editable) return;
    let style = document.getElementById(XRAY_STYLE_ID);
    if (xray && !style) {
      style = document.createElement("style");
      style.id = XRAY_STYLE_ID;
      style.textContent = XRAY_CSS;
      document.head.appendChild(style);
    } else if (!xray && style) {
      style.remove();
    }
  }, [editable, xray]);

  // The editable texts get a text cursor and a tooltip.
  useEffect(() => {
    if (!editable) return;
    const ids = new Set(inlineText);
    const marked: HTMLElement[] = [];
    for (const wrapper of Array.from(document.querySelectorAll<HTMLElement>(`[${EL_ATTR}]`))) {
      if (!ids.has(wrapper.getAttribute(EL_ATTR) ?? "")) continue;
      const node = inlineTextNode(wrapper);
      if (!node) continue;
      node.setAttribute("data-zimos-text", "");
      if (hint) node.title = hint;
      marked.push(node);
    }
    let style = document.getElementById(EDITABLE_CSS_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = EDITABLE_CSS_ID;
      style.textContent = EDITABLE_CSS;
      document.head.appendChild(style);
    }
    return () => {
      for (const node of marked) {
        node.removeAttribute("data-zimos-text");
        if (node.title === hint) node.removeAttribute("title");
      }
    };
  }, [editable, inlineText, hint]);

  // Double-click (or double-tap): edit in place.
  useEffect(() => {
    if (!editable) return;
    const ids = new Set(inlineText);

    /** The element under an event when its text may be edited here. */
    const editableAt = (target: EventTarget | null): { wrapper: HTMLElement; elementId: string } | null => {
      const wrapper = (target as Element | null)?.closest?.<HTMLElement>(`[${EL_ATTR}]`);
      const elementId = wrapper?.getAttribute(EL_ATTR) ?? "";
      return wrapper && ids.has(elementId) ? { wrapper, elementId } : null;
    };

    function startEditing(wrapper: HTMLElement, elementId: string, event: Event) {
      const node = inlineTextNode(wrapper);
      if (!node || node.isContentEditable) return;
      event.preventDefault();
      event.stopPropagation();
      const multiline = MULTILINE.has(wrapper.getAttribute(TYPE_ATTR) ?? "");
      const before = node.innerText;
      let finished = false;

      const finish = (commit: boolean) => {
        if (finished) return;
        finished = true;
        node.removeEventListener("keydown", onKey);
        node.removeEventListener("blur", onBlur);
        node.removeAttribute("contenteditable");
        const text = node.innerText.replace(NBSP, " ");
        const value = multiline ? text.replace(/\n{3,}/g, "\n\n").trim() : text.replace(/\s+/g, " ").trim();
        if (!commit || !value || value === before.trim()) {
          node.innerText = before;
          return;
        }
        post({ type: "zimos:edit-text", elementId, text: value.slice(0, 4000) });
      };
      const onKey = (e: KeyboardEvent) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          finish(false);
          node.blur();
        } else if (e.key === "Enter" && (!multiline || e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          finish(true);
          node.blur();
        }
      };
      const onBlur = () => finish(true);

      node.setAttribute("contenteditable", "plaintext-only");
      // Browsers without plaintext-only fall back to plain contenteditable.
      if (node.contentEditable !== "plaintext-only") node.setAttribute("contenteditable", "true");
      node.addEventListener("keydown", onKey);
      node.addEventListener("blur", onBlur);
      node.focus();
      const range = document.createRange();
      range.selectNodeContents(node);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }

    function onDoubleClick(event: MouseEvent) {
      const hit = editableAt(event.target);
      if (hit) startEditing(hit.wrapper, hit.elementId, event);
    }

    // Touch: the second of two quick taps on the same text.
    let touchEndedAt = 0;
    let lastTap = { elementId: "", at: 0 };
    function onTouchEnd() {
      touchEndedAt = Date.now();
    }
    function onClick(event: MouseEvent) {
      const now = Date.now();
      const fromTouch = (event as PointerEvent).pointerType === "touch" || now - touchEndedAt < TOUCH_CLICK_MS;
      if (!fromTouch) return;
      const hit = editableAt(event.target);
      if (!hit) {
        lastTap = { elementId: "", at: 0 };
        return;
      }
      if (lastTap.elementId === hit.elementId && now - lastTap.at < DOUBLE_TAP_MS) {
        lastTap = { elementId: "", at: 0 };
        startEditing(hit.wrapper, hit.elementId, event);
      } else {
        lastTap = { elementId: hit.elementId, at: now };
      }
    }

    document.addEventListener("dblclick", onDoubleClick, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("touchend", onTouchEnd, { capture: true, passive: true });
    return () => {
      document.removeEventListener("dblclick", onDoubleClick, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("touchend", onTouchEnd, true);
    };
  }, [editable, inlineText, post]);
}
