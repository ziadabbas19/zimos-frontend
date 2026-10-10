import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
  type Ref,
} from "react";
import { IconClose, IconDesktop, IconInspect, IconMoon, IconPhoneDevice, IconRefresh, IconSun, IconTablet } from "@/components/icons";
import { Button, Spinner, cn } from "@store-builder/ui";
import type { PageElementType, PageTree } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { useLocale, useT } from "@/i18n/LocaleContext";
import type { CanvasEdit, CanvasStep } from "@/lib/canvasDrag";
import { ELEMENT_SPECS } from "@/pages/website/editor/blocks";
import { elementLabel } from "@/pages/website/editor/editorLocale";
import { useCanvasDragSession } from "./useCanvasDragSession";
import {
  PREVIEW_DEVICE_WIDTH,
  diffTreePatch,
  nearestGapIndex,
  originOf,
  readFrameMessage,
  type CanvasStrings,
  type ColorMode,
  type DragStateMessage,
  type EditorStateMessage,
  type PatchMessage,
  type PatchOp,
  type PreviewDevice,
  type PreviewTheme,
  type ScrollToSectionMessage,
  type ScrollToShellMessage,
  type SectionAction,
  type SectionRect,
  type ShellPart,
  type ShellPreview,
} from "@/lib/previewBridge";

export type { PatchOp, PreviewDevice, SectionAction } from "@/lib/previewBridge";

export interface PreviewLabels {
  title: string;
  hint: string;
  refresh: string;
  desktop: string;
  mobile: string;
  close: string;
  frameTitle: string;
  /** Adds a tablet-width button to the device switch when given. */
  tablet?: string;
  /** The light/dark switch's two labels — each says what pressing it does. */
  lightMode?: string;
  darkMode?: string;
  /** With a canvas: the "outlines" (X-ray) switch's label; the switch shows when given. */
  xray?: string;
}

/**
 * What turns the preview into the website editor's canvas. Without it the
 * preview is exactly the read-only view it always was.
 *
 * With it, the storefront outlines every section, reports clicks and "add a
 * section here" presses back (see lib/previewBridge.ts for the messages), and
 * lays `theme` — the editor's unsaved store look — over the saved one.
 */
export interface PreviewCanvas {
  selectedId: string | null;
  /** Section id → the name shown on its outline. */
  labels: Record<string, string>;
  strings: CanvasStrings;
  theme?: PreviewTheme | null;
  /** Scrolls the frame to a section; a new `nonce` asks again for the same one. */
  scrollRequest?: { sectionId: string; nonce: number } | null;
  onSelect: (sectionId: string) => void;
  onInsert: (index: number) => void;
  /** The outline's own up/down buttons (PreviewBridge.tsx), reordering without the layer list. */
  onMoveSection?: (sectionId: string, direction: "up" | "down") => void;
  /**
   * A block from the library is being dragged over the editor — true from
   * `dragstart` on a BlockLibrary card to whichever of `dragend`/`onDrop`
   * fires first. While it is, a transparent overlay goes up over the iframe
   * (see below) so this drag — native HTML5 DnD, started same-origin in the
   * dashboard — can be tracked over a frame the dashboard can't see into.
   */
  dragActive?: boolean;
  /** Called with the computed insert index once a drag ends in a drop on the canvas. */
  onDrop?: (index: number) => void;
  /** The header, footer or announcement bar picked in the editor, outlined like a section. */
  selectedShell?: ShellPart | null;
  /** Their names on the outline, in the editor's language. */
  shellLabels?: Record<ShellPart, string>;
  /** Unsaved header/footer settings, applied in the frame without a reload. Null shows the saved ones. */
  shell?: ShellPreview | null;
  /** The header, footer or announcement bar was clicked in the frame. */
  onSelectShell?: (part: ShellPart) => void;
  /** Scrolls the frame to the header or footer; a new `nonce` asks again. */
  shellScrollRequest?: { part: ShellPart; nonce: number } | null;
  /**
   * A drag or resize on the page itself was released (lib/canvasDrag.ts) —
   * one tree edit. The frame showed it live while the pointer moved; nothing
   * was posted until now, and the refreshed preview goes out straight away.
   */
  onCanvasEdit?: (edit: CanvasEdit) => void;
  /** One arrow-key press on a canvas handle. */
  onCanvasStep?: (step: CanvasStep) => void;
  /** The elements whose text a double-click edits on the page (editor/canvasTools.ts). */
  inlineText?: string[];
  /** A double-click text edit was committed in the frame. */
  onTextEdit?: (elementId: string, text: string) => void;
}

/** What the preview's own bar does, for a shell that draws those controls itself (`chrome="none"`). */
export interface StorefrontPreviewControls {
  refresh(): void;
  setXray(on: boolean): void;
  setColorMode(mode: "light" | "dark"): void;
}

const STOREFRONT_ORIGIN = originOf(STOREFRONT_URL);

/** Without `fit`: the widths the preview always had — desktop simply fills the pane. */
const DEVICE_WIDTH: Record<PreviewDevice, string> = {
  desktop: "w-full",
  tablet: "w-[768px] max-w-full",
  phone: "w-[390px] max-w-full",
};

/** With `fit`: how tall a device may stand, and its bezel. Desktop fills the stage. */
const DEVICE_MAX_HEIGHT: Record<PreviewDevice, number | null> = { phone: 844, tablet: 1024, desktop: null };
const PHONE_RIM = 8;
const STAGE_PAD = 16;
/** A stage this narrow IS a phone: the frame fills it, unscaled and without a bezel. */
const NATIVE_PHONE_MAX = 480;

interface FrameFit {
  /** The frame's layout size, in its own CSS pixels. */
  width: number;
  height: number;
  /** How much it is scaled down to fit the stage (1 = not at all). */
  scale: number;
  rim: number;
  pad: number;
}

/** The device frame laid out at its true width and scaled down to fit the stage. */
function fitFrame(device: PreviewDevice, stage: { width: number; height: number } | null): FrameFit {
  const width = PREVIEW_DEVICE_WIDTH[device];
  if (!stage) return { width, height: 640, scale: 1, rim: device === "phone" ? PHONE_RIM : 0, pad: STAGE_PAD };
  if (device === "phone" && stage.width <= NATIVE_PHONE_MAX) {
    return { width: Math.max(280, stage.width), height: Math.max(240, stage.height), scale: 1, rim: 0, pad: 0 };
  }
  const rim = device === "phone" ? PHONE_RIM : 0;
  const availableWidth = Math.max(160, stage.width - STAGE_PAD * 2);
  const availableHeight = Math.max(200, stage.height - STAGE_PAD * 2);
  const scale = Math.min(1, Math.round((availableWidth / (width + rim * 2)) * 1000) / 1000);
  // Tall enough to fill the stage once scaled, but never taller than the device itself.
  const maxHeight = DEVICE_MAX_HEIGHT[device];
  const outer = Math.floor(availableHeight / scale);
  const height = Math.max(240, (maxHeight === null ? outer : Math.min(outer, maxHeight + rim * 2)) - rim * 2);
  return { width, height, scale, rim, pad: STAGE_PAD };
}

/** The canvas's words this component supplies itself when the editor passes none. */
const CANVAS_STRINGS = {
  en: {
    addSection: "Add a section",
    duplicate: "Duplicate section",
    hide: "Hide section",
    show: "Show section",
    remove: "Delete section",
    replaceImage: "Replace picture",
    hidden: "Hidden",
  },
  ar: {
    addSection: "إضافة قسم",
    duplicate: "تكرار القسم",
    hide: "إخفاء القسم",
    show: "إظهار القسم",
    remove: "حذف القسم",
    replaceImage: "تبديل الصورة",
    hidden: "مخفي",
  },
};

const ALL_SECTION_ACTIONS: SectionAction[] = ["up", "down", "duplicate", "hide", "delete"];

/** Element type → its name in the editor's language, for the types this page uses. */
function elementLabelsOf(tree: PageTree, locale: "en" | "ar"): Record<string, string> {
  const out: Record<string, string> = {};
  const specs = ELEMENT_SPECS as Record<string, { label: string } | undefined>;
  for (const section of tree.sections ?? []) {
    for (const row of section.rows ?? []) {
      for (const column of row.columns ?? []) {
        for (const element of column.elements ?? []) {
          const type = element.type as string;
          if (type in out) continue;
          out[type] = elementLabel(type as PageElementType, specs[type]?.label ?? type.replace(/_/g, " "), locale);
        }
      }
    }
  }
  return out;
}

/**
 * A page tree rendered by the storefront itself, unsaved edits included.
 *
 * The storefront's commerce blocks are server components that fetch the real
 * catalogue, so the preview can't be drawn here — the tree is posted (as a
 * form, targeted at the iframe) to the storefront's preview route, which
 * checks the merchant's session against the API, keeps the tree briefly and
 * redirects the frame to a page that renders it with the live components.
 *
 * Re-posts shortly after the tree stops changing. The token is minted here, so
 * every refresh reuses one preview slot instead of piling up new ones.
 *
 * Two frames take turns: each new render loads into the hidden one and is
 * swapped in once it has loaded, so an edit never blanks the page in between.
 *
 * A change patches the page; it does not reload it. With a canvas, a change
 * that only touches an element's text, picture, visibility or a few simple
 * style values (lib/previewBridge.ts `diffTreePatch`) is posted to the
 * showing frame at once as `zimos:patch`, and the render waits for 1.5s of
 * quiet instead of 0.7s. Anything else renders as it always did.
 *
 * The device frame: phone (390), tablet (768) or desktop (1280). With `fit`
 * the frame is laid out at that true width and scaled down to fit the stage,
 * so "desktop" really is the desktop layout however narrow the pane; the
 * phone gets a soft bezel. Without `fit` nothing changes from before.
 */
export function StorefrontPreview({
  workspaceId,
  tree,
  labels,
  onClose,
  className,
  canvas,
  colorMode: controlledMode,
  onColorModeChange,
  onSelectElement,
  selectedElementId: controlledElementId,
  onSectionAction,
  onPickImage,
  device: controlledDevice,
  onDeviceChange,
  defaultDevice = "desktop",
  fit = false,
  chrome = "own",
  controlsRef,
}: {
  workspaceId: string;
  tree: PageTree;
  labels: PreviewLabels;
  /** Shows a close button when given. */
  onClose?: () => void;
  className?: string;
  canvas?: PreviewCanvas;
  /**
   * The preview's own light/dark mode, separate from the dashboard's. Null
   * (or leaving it out) shows the page in whatever mode it opens in — the
   * shopper-side stored choice or the system setting — until the switch in
   * the toolbar picks one. Controlled when given with `onColorModeChange`.
   */
  colorMode?: ColorMode | null;
  onColorModeChange?: (mode: ColorMode) => void;
  /** With a canvas: an element of the selected section was clicked. Given, the frame selects elements. */
  onSelectElement?: (target: { sectionId: string; elementId: string; elementType: string }) => void;
  /** The element outlined inside the selected section. Left out, the preview follows the frame's own clicks. */
  selectedElementId?: string | null;
  /** The floating bar on the selected section. Left out, the bar keeps its two move buttons (`canvas.onMoveSection`). */
  onSectionAction?: (sectionId: string, action: SectionAction) => void;
  /** "Replace this picture" on a selected element; `field` is the prop that holds it. */
  onPickImage?: (target: { sectionId: string; elementId: string; field: string }) => void;
  /** "phone" | "tablet" | "desktop". Uncontrolled it starts at `defaultDevice` (desktop, as before). */
  device?: PreviewDevice;
  onDeviceChange?: (device: PreviewDevice) => void;
  defaultDevice?: PreviewDevice;
  /** Scale the device frame down to fit the stage instead of rendering desktop at whatever width is left. */
  fit?: boolean;
  /** "none" hides the preview's own bar (title, device buttons, mode, x-ray, refresh): the shell draws them. */
  chrome?: "own" | "none";
  /** Imperative handle for what the bar did: refresh, toggle x-ray, colour mode. */
  controlsRef?: Ref<StorefrontPreviewControls>;
}) {
  const baseName = `storefront-preview-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const frameNames = [`${baseName}-a`, `${baseName}-b`] as const;
  const formRef = useRef<HTMLFormElement>(null);
  const frameA = useRef<HTMLIFrameElement>(null);
  const frameB = useRef<HTMLIFrameElement>(null);
  const firstPost = useRef(true);
  /** The next tree change posts at once rather than after the typing pause — a canvas drop. */
  const urgentPost = useRef(false);
  /** A render that came due while a canvas drag was on, held until it ends so the frame isn't swapped mid-drag. */
  const deferredPost = useRef(false);
  const lastPosted = useRef<string | null>(null);
  const lastSessionCheck = useRef(0);
  const [token] = useState(() => crypto.randomUUID());
  const [ownDevice, setOwnDevice] = useState<PreviewDevice>(defaultDevice);
  const device = controlledDevice ?? ownDevice;
  const pickDevice = (next: PreviewDevice) => {
    if (controlledDevice === undefined) setOwnDevice(next);
    onDeviceChange?.(next);
  };
  // The canvas's X-ray: every section, row, column and element outlined (item 95).
  const [xray, setXray] = useState(false);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState<0 | 1>(0);
  const visibleRef = useRef<0 | 1>(0);
  /** The frame a render is loading into, until it has loaded. */
  const pendingRef = useRef<0 | 1 | null>(null);

  const serialized = JSON.stringify(tree);
  const serializedRef = useRef(serialized);
  const treeRef = useRef(tree);
  const editing = canvas !== undefined;
  const { locale } = useLocale();
  const ownStrings = useT(CANVAS_STRINGS);

  // Patching. `posted` is the tree each frame was last sent; `shown` is the
  // tree its page reflects right now — what it rendered plus every patch
  // since — and is null until that page's bridge has said it is ready.
  const posted = useRef<[string | null, string | null]>([null, null]);
  const shown = useRef<[{ json: string; tree: PageTree } | null, { json: string; tree: PageTree } | null]>([null, null]);
  /** A text edit the frame itself just committed: its page already shows it, so it needs no patch back. */
  const frameEdit = useRef<{ elementId: string; text: string } | null>(null);

  // Light or dark. `chosen` is an explicit pick (the toolbar switch, the page's
  // own moon, or the editor); `frameMode` is what the page reported it opened
  // in. Until either is known the system setting is the best guess.
  const [ownMode, setOwnMode] = useState<ColorMode | null>(null);
  const chosen = controlledMode !== undefined ? controlledMode : ownMode;
  const [frameMode, setFrameMode] = useState<ColorMode | null>(null);
  const shownMode: ColorMode =
    chosen ?? frameMode ?? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const chosenRef = useRef(chosen);
  const pickMode = useCallback(
    (mode: ColorMode) => {
      if (controlledMode === undefined) setOwnMode(mode);
      onColorModeChange?.(mode);
    },
    [controlledMode, onColorModeChange]
  );
  const pickModeRef = useRef(pickMode);
  const themeJson = JSON.stringify(canvas?.theme ?? null);
  const shellJson = JSON.stringify(canvas?.shell ?? null);

  // The element outlined in the frame: the editor's, or — when it passes none —
  // whatever was last clicked there.
  const [ownElementId, setOwnElementId] = useState<string | null>(null);
  const elementId = controlledElementId !== undefined ? controlledElementId : ownElementId;

  // The latest canvas and callbacks, for the message listener and the form
  // post, which must not re-subscribe or re-post on every render.
  const canvasRef = useRef(canvas);
  const themeRef = useRef(themeJson);
  const shellRef = useRef(shellJson);
  const handlersRef = useRef({ onSelectElement, onSectionAction, onPickImage });
  useEffect(() => {
    canvasRef.current = canvas;
    themeRef.current = themeJson;
    shellRef.current = shellJson;
    serializedRef.current = serialized;
    treeRef.current = tree;
    chosenRef.current = chosen;
    pickModeRef.current = pickMode;
    handlersRef.current = { onSelectElement, onSectionAction, onPickImage };
  });

  const frames = useCallback(
    () => [frameA.current?.contentWindow ?? null, frameB.current?.contentWindow ?? null],
    []
  );

  const post = useCallback(async (treeJson: string) => {
    const form = formRef.current;
    if (!form) return;
    // The storefront verifies the session with the access token; a cheap
    // authenticated call first lets the client refresh an expired one.
    if (Date.now() - lastSessionCheck.current > 60_000) {
      try {
        await apiClient.me();
        lastSessionCheck.current = Date.now();
      } catch {
        // The preview page explains a rejected session itself.
      }
    }
    // Into the hidden frame — or the one already loading, which a newer tree
    // simply redirects.
    const target = pendingRef.current ?? (visibleRef.current === 0 ? 1 : 0);
    pendingRef.current = target;
    form.target = `${baseName}-${target === 0 ? "a" : "b"}`;
    (form.elements.namedItem("tree") as HTMLInputElement).value = treeJson;
    (form.elements.namedItem("accessToken") as HTMLInputElement).value = apiClient.tokens.accessToken ?? "";
    lastPosted.current = treeJson;
    // That frame's page is on its way out: nothing can be patched into it until the new one is ready.
    posted.current[target] = treeJson;
    shown.current[target] = null;
    const theme = form.elements.namedItem("theme") as HTMLInputElement | null;
    if (theme) theme.value = themeRef.current;
    const shell = form.elements.namedItem("shell") as HTMLInputElement | null;
    if (shell) shell.value = shellRef.current;
    (form.elements.namedItem("colorMode") as HTMLInputElement).value = chosenRef.current ?? "";
    setLoading(true);
    form.submit();
  }, [baseName]);

  // A drag on the canvas (lib/canvasDrag.ts): held here in a ref, so the
  // pointer moving re-renders nothing. A release that changes the page is one
  // tree edit, posted straight away.
  const canvasDrag = useCanvasDragSession({
    origin: STOREFRONT_ORIGIN,
    labels: { auto: canvas?.strings.auto ?? "Auto" },
    onEdit: (edit) => {
      urgentPost.current = true;
      canvasRef.current?.onCanvasEdit?.(edit);
    },
    onSettled: () => {
      if (!deferredPost.current) return;
      deferredPost.current = false;
      // After React has applied the edit the drop may have just made.
      window.setTimeout(() => {
        if (serializedRef.current !== lastPosted.current) void post(serializedRef.current);
      }, 0);
    },
  });

  /**
   * Brings one frame's page up to the latest tree with patches, when patches
   * can: true when the page now reflects it (the render can wait), false when
   * only a render will do.
   */
  const patchFrame = useCallback(
    (index: 0 | 1): boolean => {
      const page = shown.current[index];
      const win = (index === 0 ? frameA : frameB).current?.contentWindow;
      if (!page || !win || !STOREFRONT_ORIGIN) return false;
      const json = serializedRef.current;
      if (page.json === json) return true;
      // The frame's own layout width picks the device styles in force (it is never the scaled size).
      const width = (index === 0 ? frameA : frameB).current?.clientWidth || Number.POSITIVE_INFINITY;
      let ops = diffTreePatch(page.tree, treeRef.current, width);
      if (!ops) return false;
      const echo = frameEdit.current;
      frameEdit.current = null;
      if (echo) {
        ops = ops
          .map((op) => {
            if (op.elementId !== echo.elementId || op.text !== echo.text) return op;
            const rest: PatchOp = { ...op };
            delete rest.text;
            return rest;
          })
          .filter((op) => op.text !== undefined || op.imageSrc !== undefined || op.hidden !== undefined || op.style !== undefined);
      }
      if (ops.length > 0) {
        const message: PatchMessage = { type: "zimos:patch", ops };
        win.postMessage(message, STOREFRONT_ORIGIN);
      }
      shown.current[index] = { json, tree: treeRef.current };
      return true;
    },
    []
  );

  useEffect(() => {
    let delay = firstPost.current || urgentPost.current ? 0 : 700;
    firstPost.current = false;
    urgentPost.current = false;
    // A small edit shows at once as a patch, and the render waits for a longer pause.
    if (delay !== 0 && editing && !canvasDrag.isActive() && patchFrame(visibleRef.current)) delay = 1500;
    const handle = window.setTimeout(() => {
      // Never swap the frame out from under a drag in progress.
      if (canvasDrag.isActive()) {
        deferredPost.current = true;
        return;
      }
      void post(serialized);
    }, delay);
    return () => window.clearTimeout(handle);
  }, [serialized, post, canvasDrag, editing, patchFrame]);

  // A plain preview has no bridge in the frame to switch it live, so a new
  // mode is a new render. (The editor's canvas switches in place: the mode
  // rides on zimos:editor-state below.)
  const lastPostedMode = useRef(chosen);
  useEffect(() => {
    if (editing || chosen === lastPostedMode.current) return;
    lastPostedMode.current = chosen;
    void post(serializedRef.current);
  }, [chosen, editing, post]);

  // What the preview's own bar does, for a shell that draws the controls itself.
  useImperativeHandle(
    controlsRef,
    () => ({
      refresh: () => void post(serializedRef.current),
      setXray: (on: boolean) => setXray(on),
      setColorMode: (mode: "light" | "dark") => pickModeRef.current(mode),
    }),
    [post]
  );

  function onFrameLoad(index: 0 | 1) {
    const frame = index === 0 ? frameA.current : frameB.current;
    try {
      // A frame's initial about:blank fires load too; a storefront page is
      // cross-origin, so reading its location throws instead.
      if (frame?.contentWindow?.location.href === "about:blank") return;
    } catch {
      // Cross-origin: the render arrived.
    }
    if (pendingRef.current !== index) return;
    pendingRef.current = null;
    // The frame a drag started in is going out of view.
    canvasDrag.abort();
    visibleRef.current = index;
    setVisible(index);
    setLoading(false);
  }

  // Editor → frame: the selection, section names and unsaved look, re-sent
  // whenever they change (and to each render as it reports ready, below).
  const canSelectElement = onSelectElement !== undefined;
  const canPickImage = onPickImage !== undefined;
  const hasSectionAction = onSectionAction !== undefined;
  const hasMoveSection = canvas?.onMoveSection !== undefined;
  const elementLabels = useMemo(
    () => (editing ? elementLabelsOf(JSON.parse(serialized) as PageTree, locale) : {}),
    [editing, serialized, locale]
  );
  const stateJson = canvas
    ? JSON.stringify({
        type: "zimos:editor-state",
        selectedId: canvas.selectedId,
        selectedElementId: canSelectElement ? (elementId ?? null) : null,
        labels: canvas.labels,
        strings: { ...ownStrings, ...canvas.strings },
        theme: canvas.theme ?? null,
        selectedShell: canvas.selectedShell ?? null,
        shellLabels: canvas.shellLabels ?? null,
        shell: canvas.shell ?? null,
        colorMode: chosen,
        xray,
        inlineText: canvas.inlineText ?? [],
        can: {
          selectElement: canSelectElement,
          pickImage: canPickImage,
          sectionActions: hasSectionAction ? ALL_SECTION_ACTIONS : hasMoveSection ? ["up", "down"] : [],
        },
        elementLabels,
      } satisfies EditorStateMessage)
    : "";
  const stateRef = useRef(stateJson);
  useEffect(() => {
    stateRef.current = stateJson;
    if (!stateJson || !STOREFRONT_ORIGIN) return;
    const message = JSON.parse(stateJson) as EditorStateMessage;
    for (const win of frames()) {
      win?.postMessage(message, STOREFRONT_ORIGIN);
    }
  }, [stateJson, frames]);

  // Editor → frame: "scroll to this section". A section that was only just
  // added isn't in the showing render yet, so the request waits for the first
  // render that reports it (see preview-ready below).
  const frameSections = useRef<[string[], string[]]>([[], []]);
  const pendingScroll = useRef<string | null>(null);

  // Frame → editor, while a drag is on: each frame's own section boxes, so a
  // pointer position over the drop overlay below can be turned into an insert
  // index. Keyed the same way frameSections is — by frame index, not by
  // "visible" — since a render that just swapped in may report its rects
  // before onFrameLoad flips `visible`.
  const sectionRectsRef = useRef<[SectionRect[], SectionRect[]]>([[], []]);

  // A block from the library is being dragged over the canvas, and which gap
  // between sections the pointer is nearest to right now — computed here from
  // the rects above, then handed back to the frame (zimos:drag-state) so its
  // own "+" indicators and drop-line agree with what a drop would actually do.
  const dragActive = canvas?.dragActive ?? false;
  const [hoverGapIndex, setHoverGapIndex] = useState<number | null>(null);
  // A drag that ends forgets its gap — adjusted during render rather than in
  // an effect, so no stale gap is ever posted when the next drag starts.
  const [wasDragActive, setWasDragActive] = useState(dragActive);
  if (wasDragActive !== dragActive) {
    setWasDragActive(dragActive);
    if (!dragActive) setHoverGapIndex(null);
  }
  useEffect(() => {
    if (!STOREFRONT_ORIGIN) return;
    const message: DragStateMessage = { type: "zimos:drag-state", active: dragActive, hoverIndex: hoverGapIndex };
    for (const win of frames()) win?.postMessage(message, STOREFRONT_ORIGIN);
  }, [dragActive, hoverGapIndex, frames]);

  // The device frame, fitted to the stage (`fit`): measured, never guessed.
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const el = stageRef.current;
    if (!fit || !el) return;
    const measure = () => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      setStage((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
    };
    if (typeof ResizeObserver === "undefined") {
      const frame = requestAnimationFrame(measure);
      window.addEventListener("resize", measure);
      return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener("resize", measure);
      };
    }
    // Reports once when it starts watching, then on every change.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [fit]);
  const frameFit = fitFrame(device, stage);
  /** Dashboard pixels per frame pixel: 1 unless the frame is scaled to fit. */
  const scaleRef = useRef(1);
  useEffect(() => {
    scaleRef.current = fit ? frameFit.scale : 1;
  });

  /**
   * Cross-origin drag tracking: the drag starts same-origin in the dashboard
   * (a BlockLibrary card), so the browser fires dragover/drop on this overlay
   * — a transparent div positioned exactly over the iframe, rendered only
   * while `dragActive` — rather than inside the frame's own (cross-origin,
   * unreadable) document. `clientY` minus the overlay's own top lands in the
   * iframe's viewport space, in the units the frame measured its rects in
   * with `getBoundingClientRect()`, once divided by the frame's scale (1
   * unless `fit` scaled the device frame down).
   */
  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    const y = (event.clientY - event.currentTarget.getBoundingClientRect().top) / scaleRef.current;
    setHoverGapIndex(nearestGapIndex(sectionRectsRef.current[visibleRef.current], y));
  }, [setHoverGapIndex]);

  const handleDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const y = (event.clientY - event.currentTarget.getBoundingClientRect().top) / scaleRef.current;
    const index = nearestGapIndex(sectionRectsRef.current[visibleRef.current], y);
    canvasRef.current?.onDrop?.(index);
    setHoverGapIndex(null);
  }, [setHoverGapIndex]);
  const scrollNonce = canvas?.scrollRequest?.nonce;
  useEffect(() => {
    const request = canvasRef.current?.scrollRequest;
    if (scrollNonce === undefined || !request || !STOREFRONT_ORIGIN) return;
    const shownFrame = visibleRef.current;
    if (frameSections.current[shownFrame].includes(request.sectionId)) {
      const message: ScrollToSectionMessage = { type: "zimos:scroll-to-section", sectionId: request.sectionId };
      (shownFrame === 0 ? frameA : frameB).current?.contentWindow?.postMessage(message, STOREFRONT_ORIGIN);
      pendingScroll.current = null;
    } else {
      pendingScroll.current = request.sectionId;
    }
  }, [scrollNonce]);

  // Editor → frame: "scroll to the header / footer". They are on every page,
  // so the showing render always has them.
  const shellScrollNonce = canvas?.shellScrollRequest?.nonce;
  useEffect(() => {
    const request = canvasRef.current?.shellScrollRequest;
    if (shellScrollNonce === undefined || !request || !STOREFRONT_ORIGIN) return;
    const message: ScrollToShellMessage = { type: "zimos:scroll-to-shell", part: request.part };
    (visibleRef.current === 0 ? frameA : frameB).current?.contentWindow?.postMessage(message, STOREFRONT_ORIGIN);
  }, [shellScrollNonce]);

  // Frame → editor. Only the storefront origin, and only our own two frames.
  useEffect(() => {
    if (!editing) return;
    function onMessage(event: MessageEvent) {
      const message = readFrameMessage(event, STOREFRONT_ORIGIN, frames());
      if (!message) return;
      const current = canvasRef.current;
      const handlers = handlersRef.current;
      switch (message.type) {
        case "zimos:preview-ready": {
          const source = event.source as Window | null;
          if (!source || !STOREFRONT_ORIGIN) break;
          if (message.colorMode) setFrameMode(message.colorMode);
          const index = source === frameA.current?.contentWindow ? 0 : 1;
          frameSections.current[index] = message.sectionIds;
          if (stateRef.current) source.postMessage(JSON.parse(stateRef.current), STOREFRONT_ORIGIN);
          // Its page shows the tree it was posted; anything typed while it was
          // loading is patched in now, so the new render never steps back.
          const json = posted.current[index];
          if (json) {
            try {
              shown.current[index] = { json, tree: JSON.parse(json) as PageTree };
              patchFrame(index);
            } catch {
              shown.current[index] = null;
            }
          }
          const waiting = pendingScroll.current;
          if (waiting && message.sectionIds.includes(waiting)) {
            const scroll: ScrollToSectionMessage = { type: "zimos:scroll-to-section", sectionId: waiting };
            source.postMessage(scroll, STOREFRONT_ORIGIN);
            pendingScroll.current = null;
          }
          break;
        }
        case "zimos:select-section":
          setOwnElementId(null);
          current?.onSelect(message.sectionId);
          break;
        case "zimos:select-element":
          setOwnElementId(message.elementId);
          handlers.onSelectElement?.({
            sectionId: message.sectionId,
            elementId: message.elementId,
            elementType: message.elementType,
          });
          break;
        case "zimos:select-shell":
          setOwnElementId(null);
          current?.onSelectShell?.(message.part);
          break;
        case "zimos:insert-section":
          current?.onInsert(message.index);
          break;
        case "zimos:move-section":
          // The section grip's arrow keys.
          if (current?.onMoveSection) current.onMoveSection(message.sectionId, message.direction);
          else handlers.onSectionAction?.(message.sectionId, message.direction);
          break;
        case "zimos:section-action":
          if (handlers.onSectionAction) handlers.onSectionAction(message.sectionId, message.action);
          else if (message.action === "up" || message.action === "down") {
            current?.onMoveSection?.(message.sectionId, message.action);
          }
          break;
        case "zimos:pick-image":
          handlers.onPickImage?.({ sectionId: message.sectionId, elementId: message.elementId, field: message.field });
          break;
        case "zimos:section-rects": {
          const source = event.source as Window | null;
          if (!source) break;
          sectionRectsRef.current[source === frameA.current?.contentWindow ? 0 : 1] = message.sections;
          break;
        }
        case "zimos:canvas-drag": {
          const source = event.source as Window | null;
          if (source) canvasDrag.handle(message, source);
          break;
        }
        case "zimos:canvas-step":
          current?.onCanvasStep?.(message.step);
          break;
        case "zimos:edit-text":
          // The frame's page already shows this text: no patch back.
          frameEdit.current = { elementId: message.elementId, text: message.text };
          current?.onTextEdit?.(message.elementId, message.text);
          break;
        case "zimos:color-mode":
          // The page's own moon (or the OS) switched it: follow, so the next
          // render opens in the same mode and the toolbar switch agrees.
          setFrameMode(message.mode);
          if (message.mode !== chosenRef.current) pickModeRef.current(message.mode);
          break;
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [editing, frames, canvasDrag, patchFrame]);

  const deviceButton = (value: PreviewDevice, label: string, Icon: typeof IconDesktop) => (
    <Button
      type="button"
      size="icon-sm"
      variant={device === value ? "secondary" : "ghost"}
      aria-label={label}
      title={label}
      aria-pressed={device === value}
      onClick={() => pickDevice(value)}
    >
      <Icon className="size-4" aria-hidden />
    </Button>
  );

  const phoneFrame = fit && device === "phone" && frameFit.rim > 0;
  const iframes: ReactNode = ([0, 1] as const).map((index) => (
    <iframe
      key={index}
      ref={index === 0 ? frameA : frameB}
      name={frameNames[index]}
      title={labels.frameTitle}
      aria-hidden={visible !== index}
      tabIndex={visible === index ? undefined : -1}
      onLoad={() => onFrameLoad(index)}
      className={cn(
        "absolute inset-0 block size-full bg-paper-raised",
        !fit && "rounded-[0.375rem] border border-line",
        visible !== index && "pointer-events-none invisible"
      )}
    />
  ));
  // Sits exactly over the iframe, only while a block is being dragged in:
  // native drag events reach it (and never the cross-origin frame
  // underneath), so it's what turns a pointer position into a drop.
  const dropOverlay =
    editing && dragActive ? (
      <div
        className="absolute inset-0 z-20 cursor-copy rounded-[0.5rem]"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragLeave={() => setHoverGapIndex(null)}
      />
    ) : null;

  const outerWidth = frameFit.width + frameFit.rim * 2;
  const outerHeight = frameFit.height + frameFit.rim * 2;

  return (
    <div data-slot="storefront-preview" className={cn("flex h-full min-h-0 flex-col bg-paper-raised", className)}>
      {/* One compact row: title and hint share a line (the hint is a plain
          sentence, so it reads fine run-on) rather than stacking two lines of
          text above the device switcher — chrome the canvas doesn't need. The
          hint truncates rather than pushing the switcher onto a second line. */}
      {chrome === "own" && (
        <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-1">
          <p className="min-w-0 flex-1 truncate text-xs text-ink-soft" title={labels.hint}>
            <span className="font-semibold text-ink">{labels.title}</span>
            <span className="mx-1.5 text-line" aria-hidden>
              ·
            </span>
            {labels.hint}
          </p>
          <div className="flex shrink-0 items-center gap-0.5">
            {deviceButton("desktop", labels.desktop, IconDesktop)}
            {labels.tablet && deviceButton("tablet", labels.tablet, IconTablet)}
            {deviceButton("phone", labels.mobile, IconPhoneDevice)}
            {(() => {
              const label =
                shownMode === "dark" ? (labels.lightMode ?? "Preview in light mode") : (labels.darkMode ?? "Preview in dark mode");
              return (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={label}
                  title={label}
                  aria-pressed={shownMode === "dark"}
                  onClick={() => pickMode(shownMode === "dark" ? "light" : "dark")}
                >
                  {shownMode === "dark" ? <IconSun className="size-4" aria-hidden /> : <IconMoon className="size-4" aria-hidden />}
                </Button>
              );
            })()}
            {canvas && labels.xray && (
              <Button
                type="button"
                size="icon-sm"
                variant={xray ? "secondary" : "ghost"}
                aria-label={labels.xray}
                title={labels.xray}
                aria-pressed={xray}
                onClick={() => setXray((on) => !on)}
              >
                <IconInspect className="size-4" aria-hidden />
              </Button>
            )}
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={labels.refresh}
              title={labels.refresh}
              onClick={() => void post(serialized)}
            >
              <IconRefresh className={cn("size-4", loading && "animate-spin motion-reduce:animate-none")} aria-hidden />
            </Button>
            {onClose && (
              <Button type="button" size="icon-sm" variant="ghost" aria-label={labels.close} onClick={onClose}>
                <IconClose className="size-4" aria-hidden />
              </Button>
            )}
          </div>
        </div>
      )}

      <div
        ref={stageRef}
        data-slot="preview-stage"
        className={cn(
          "relative min-h-0 flex-1",
          // The stage is a quiet, flat ground: nothing competes with the merchant's store.
          fit ? "overflow-hidden bg-paper-sunken" : "overflow-auto bg-paper p-1.5"
        )}
      >
        {loading && (
          <div className="pointer-events-none absolute inset-x-0 top-4 z-10 flex justify-center">
            <Spinner className="size-5 text-ink-soft" />
          </div>
        )}
        {fit ? (
          <div
            className={cn("absolute inset-0 flex items-center justify-center", stage === null && "opacity-0")}
            style={{ padding: frameFit.pad }}
          >
            {/* Holds the scaled size, so the frame takes exactly the room it shows in. */}
            <div
              className="relative shrink-0"
              style={{ width: outerWidth * frameFit.scale, height: outerHeight * frameFit.scale }}
            >
              {/* Laid out at the device's true width, then scaled from the top centre. */}
              <div
                data-slot="preview-device"
                data-device={device}
                className={cn(
                  "absolute start-1/2 top-0 origin-top",
                  phoneFrame
                    ? "rounded-[2.25rem] bg-[#14161a] shadow-[0_24px_60px_-20px_rgb(0_0_0/0.45)] ring-1 ring-black/15 dark:ring-white/15"
                    : frameFit.pad > 0 && "rounded-xl shadow-[var(--shadow-raised)] ring-1 ring-line"
                )}
                style={{
                  width: outerWidth,
                  height: outerHeight,
                  marginInlineStart: -outerWidth / 2,
                  padding: frameFit.rim,
                  transform: frameFit.scale === 1 ? undefined : `scale(${frameFit.scale})`,
                }}
              >
                <div
                  className={cn(
                    "relative size-full overflow-hidden",
                    phoneFrame ? "rounded-[calc(2.25rem-8px)]" : frameFit.pad > 0 && "rounded-xl"
                  )}
                >
                  {iframes}
                  {dropOverlay}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Exactly the height it's given: a taller floor would put a second
             scrollbar around the frame's own on a short laptop screen. The
             small floor only stops it collapsing on a phone held sideways. */
          <div className={cn("relative mx-auto h-full min-h-64 transition-[width]", DEVICE_WIDTH[device])}>
            {iframes}
            {dropOverlay}
          </div>
        )}
      </div>

      <form
        ref={formRef}
        method="post"
        action={`${STOREFRONT_URL}/store/${workspaceId}/preview`}
        target={frameNames[0]}
        className="hidden"
      >
        <input type="hidden" name="tree" />
        <input type="hidden" name="accessToken" />
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="colorMode" />
        {editing && (
          <>
            <input type="hidden" name="edit" value="1" />
            <input type="hidden" name="parentOrigin" value={window.location.origin} />
            <input type="hidden" name="theme" />
            <input type="hidden" name="shell" />
          </>
        )}
      </form>
    </div>
  );
}
