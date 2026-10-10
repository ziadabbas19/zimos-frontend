"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * The fixed look of everything the editor draws inside the preview frame.
 *
 * The page underneath is the merchant's store in the merchant's colours, so
 * none of this follows the store theme: outlines are the editor's blue with
 * a white halo, chips and bars are near-black pills with white text — legible
 * on any store colour, light or dark. Structure and position are inline (they
 * come from measured boxes); this stylesheet holds what inline styles can't:
 * hover, focus, pressed, the larger hit areas, and the ghost of a hidden
 * element. It is added by the preview bridge in editing mode only — a
 * shopper's page never has it.
 */

/** The editor's blue: selection outlines, the "+", drop lines. */
export const BLUE = "#165dff";
/** Chips and bars. */
export const INK = "#14161a";
/** Above anything a store theme stacks. */
export const LAYER = 2147483000;

/** A 2px blue line with a 1px white halo, drawn inside the box it outlines (sections run edge to edge). */
export const RING_INSIDE = `inset 0 0 0 2px ${BLUE}, inset 0 0 0 3px #fff`;
/** The same, drawn around a box (an element sits inside its section, so there is room). */
export const RING_OUTSIDE = `0 0 0 2px ${BLUE}, 0 0 0 3px #fff`;

const STYLE_ID = "zimos-canvas-chrome";

const CHIP_BASE =
  'content:var(--zimos-hidden-label,"Hidden");position:absolute;z-index:3;width:max-content;max-width:90%;padding:3px 10px;' +
  "border-radius:9999px;background:#14161a;color:#fff;font:600 11px/16px ui-sans-serif,system-ui,sans-serif;letter-spacing:0;" +
  "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;box-shadow:0 0 0 1px rgb(255 255 255/.4)";

/** An element shoppers don't see at this width: still there for the merchant, faded, with a chip. */
function ghost(device: string, media: string): string {
  const el = `[data-zimos-el][data-zimos-hidden~="${device}"]`;
  return (
    `@media ${media}{` +
    `${el}>[data-zs]{display:block!important;position:relative}` +
    `${el}>[data-zs]>*,${el}>:not([data-zs]){opacity:.35!important}` +
    `${el}>[data-zs]::after{${CHIP_BASE};top:6px;inset-inline-start:6px}` +
    "}"
  );
}

const EASE = "cubic-bezier(.2,.7,.2,1)";

export const CHROME_CSS = [
  // The overlay's own type and resets: nothing inherits from the store theme.
  '[data-zimos-overlay]{font:500 12px/1.2 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;color:#fff;letter-spacing:0;-webkit-font-smoothing:antialiased}',
  "[data-zimos-overlay] *,[data-zimos-overlay] *::before,[data-zimos-overlay] *::after{box-sizing:border-box}",
  "[data-zimos-overlay] button{appearance:none;-webkit-appearance:none;margin:0;font:inherit;letter-spacing:inherit;color:inherit;text-transform:none;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}",
  "[data-zimos-overlay] button:focus{outline:none}",
  `[data-zimos-overlay] button:focus-visible{outline:2px solid #fff;outline-offset:1px;box-shadow:0 0 0 5px ${BLUE}}`,
  "[data-zimos-overlay] svg{display:block;flex:none}",

  // The bar on the selected section: round buttons on a near-black pill.
  `[data-zc="bar"]{display:inline-flex;flex:none;align-items:center;gap:2px;padding:4px;border-radius:9999px;background:${INK};box-shadow:0 0 0 1px rgb(255 255 255/.16),0 8px 24px rgb(0 0 0/.3);pointer-events:auto}`,
  `[data-zc="act"]{position:relative;display:inline-flex;flex:none;align-items:center;justify-content:center;width:36px;height:36px;padding:0;border:0;border-radius:9999px;background:transparent;color:#fff;cursor:pointer;transition:background-color 160ms ${EASE},transform 160ms ${EASE},opacity 160ms ${EASE}}`,
  '[data-zc="act"]::after{content:"";position:absolute;inset:-4px;border-radius:9999px}',
  '[data-zc="act"]:hover{background:rgb(255 255 255/.16)}',
  '[data-zc="act"]:active{transform:scale(.94)}',
  '[data-zc="act"][data-tone="danger"]:hover{background:#e5484d}',
  '[data-zc="act"]:disabled{opacity:.35;cursor:default;background:transparent;transform:none}',
  '[data-zc="act"][data-grip]{cursor:grab;touch-action:none}',
  '[data-zc="act"][data-grip][data-grabbing]{cursor:grabbing}',
  '[data-zc="rule"]{flex:none;width:1px;height:18px;margin-inline:2px;background:rgb(255 255 255/.2)}',
  '@media (pointer:coarse){[data-zc="bar"]{gap:8px}}',

  // Name chips.
  `[data-zc="chip"]{display:block;min-width:0;max-width:100%;height:24px;padding:0 10px;border-radius:9999px;background:${INK};color:#fff;font-weight:600;font-size:11px;line-height:24px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 0 0 1px rgb(255 255 255/.16),0 2px 8px rgb(0 0 0/.2)}`,

  // The selected element's tag: its grip and its name.
  `[data-zc="tag"]{display:inline-flex;align-items:center;max-width:100%;height:28px;border-radius:9999px;background:${INK};color:#fff;box-shadow:0 0 0 1px rgb(255 255 255/.16),0 2px 8px rgb(0 0 0/.24);pointer-events:auto}`,
  '[data-zc="tag"]>span{min-width:0;padding-inline:2px 12px;font-weight:600;font-size:11px;line-height:28px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
  '[data-zc="tag"]>span:only-child{padding-inline:12px}',
  '[data-zc="tag"]>[data-zc="act"]{width:28px;height:28px}',
  '[data-zc="tag"]>[data-zc="act"]::after{inset:-8px}',
  '@media (pointer:coarse){[data-zc="tag"]{height:36px}[data-zc="tag"]>span{line-height:36px}[data-zc="tag"]>[data-zc="act"]{width:36px;height:36px}[data-zc="tag"]>[data-zc="act"]::after{inset:-4px}}',

  // "+" on a section's edge: a round button that shows its words on hover and focus.
  `[data-zc="add"]{position:fixed;display:inline-flex;align-items:center;justify-content:center;height:32px;min-width:32px;padding:0;border:2px solid #fff;border-radius:9999px;background:${BLUE};color:#fff;cursor:pointer;pointer-events:auto;transform:translate(-50%,-50%);box-shadow:0 2px 8px rgb(0 0 0/.3);transition:background-color 160ms ${EASE}}`,
  '[data-zc="add"]::after{content:"";position:absolute;inset:-8px;border-radius:9999px}',
  '[data-zc="add"]>svg{margin-inline:6px}',
  '[data-zc="add"]>span{display:none;padding-inline-end:10px;font-weight:600;font-size:12px;line-height:1;white-space:nowrap}',
  `[data-zc="add"]:focus-visible>span{display:block;animation:zimos-canvas-in 160ms ${EASE} both}`,
  `@media (hover:hover){[data-zc="add"]:hover{background:#0f4fe0}[data-zc="add"]:hover>span{display:block;animation:zimos-canvas-in 160ms ${EASE} both}}`,
  '[data-zc="add"]:active{transform:translate(-50%,-50%) scale(.95)}',

  // A labelled pill button (replace the picture).
  `[data-zc="pill"]{position:relative;display:inline-flex;flex:none;align-items:center;gap:6px;height:36px;padding-block:0;padding-inline:12px 14px;border:0;border-radius:9999px;background:${INK};color:#fff;font-weight:600;font-size:12px;white-space:nowrap;cursor:pointer;pointer-events:auto;box-shadow:0 0 0 1px rgb(255 255 255/.16),0 6px 18px rgb(0 0 0/.3);transition:background-color 160ms ${EASE},transform 160ms ${EASE}}`,
  '[data-zc="pill"]::after{content:"";position:absolute;inset:-4px;border-radius:9999px}',
  '[data-zc="pill"]:hover{background:#262a31}',
  '[data-zc="pill"]:active{transform:scale(.97)}',
  '[data-zc="pill"][data-compact]{width:36px;padding:0;justify-content:center}',

  // Drag and resize handles are positioned inline; this only widens what a finger can hit.
  '[data-zc="handle"]::after{content:"";position:absolute;inset:var(--zc-hit,-6px)}',

  "@keyframes zimos-canvas-in{from{opacity:0}to{opacity:1}}",
  "@media (prefers-reduced-motion:reduce){[data-zimos-overlay] *{transition:none!important;animation:none!important}}",

  // Hidden for shoppers, a ghost for the merchant.
  ghost("desktop", "(min-width:1024px)"),
  ghost("tablet", "(min-width:640px) and (max-width:1023px)"),
  ghost("mobile", "(max-width:639px)"),
  // Patched back to "shown" before the render that takes its display:none away.
  '[data-zimos-el][data-zimos-hidden=""]>[data-zs]{display:block!important}',
  "[data-zimos-section][data-zimos-hidden]{position:relative}",
  "[data-zimos-section][data-zimos-hidden]>*{opacity:.35!important}",
  `[data-zimos-section][data-zimos-hidden]::after{${CHIP_BASE};top:10px;inset-inline:0;margin-inline:auto}`,
].join("\n");

/** Puts the stylesheet above on the page while the canvas is on, and names the "hidden" chip. */
export function useCanvasChrome(editable: boolean, hiddenLabel: string) {
  useEffect(() => {
    if (!editable) return;
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = CHROME_CSS;
      document.head.appendChild(style);
    }
    return () => {
      document.getElementById(STYLE_ID)?.remove();
    };
  }, [editable]);

  useEffect(() => {
    if (!editable) return;
    // A CSS string: JSON's quoting is CSS's too.
    document.documentElement.style.setProperty("--zimos-hidden-label", JSON.stringify(hiddenLabel.slice(0, 40)));
    return () => {
      document.documentElement.style.removeProperty("--zimos-hidden-label");
    };
  }, [editable, hiddenLabel]);
}

const COARSE = "(pointer: coarse)";

function subscribeCoarse(onChange: () => void) {
  const query = window.matchMedia(COARSE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Whether the merchant is working with a finger: handles grow to 36px with 44px hit areas. */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(
    subscribeCoarse,
    () => window.matchMedia(COARSE).matches,
    () => false
  );
}
