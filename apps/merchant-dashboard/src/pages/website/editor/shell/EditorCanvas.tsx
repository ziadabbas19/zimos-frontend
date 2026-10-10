import type { Ref } from "react";
import type { PageTree } from "@store-builder/api-client";
import { StorefrontPreview } from "@/components/StorefrontPreview";
import type { CanvasEdit, CanvasStep } from "@/lib/canvasDrag";
import { editorUi, useEditorLocale } from "../editorLocale";
import { lookToPreview, lookToShellPreview, type StoreLook } from "../storeLook";
import type { ShellPart } from "../storeShell";
import type { ColorMode } from "../storeThemes";
import type { SectionActionKind } from "./useSectionEdits";
import type { EditorDevice, PreviewControls } from "./useEditorLayout";

/**
 * The storefront on the stage: StorefrontPreview, wired as the editor's
 * canvas. It is the real store in a frame — a click selects (a section first,
 * then an element inside the selected one), a double-click types in place, an
 * image asks for the media library, and a selected section carries its own
 * small bar (up, down, duplicate, hide, delete).
 *
 * The preview's own bar is off (`chrome="none"`): the device switch is in the
 * toolbar and refresh, outlines and light / dark are in «…», through
 * `controlsRef`.
 *
 * The frame is always fitted to the stage (`fit`): a phone with its bezel, a
 * tablet, or the desktop layout scaled down. On a stage as narrow as a phone
 * the preview drops the bezel and simply fills it — the phone IS the device.
 */
export function EditorCanvas({
  workspaceId,
  tree,
  look,
  savedThemeSettings,
  shellDirty,
  device,
  onDeviceChange,
  controlsRef,
  colorMode,
  onColorModeChange,
  selectedSectionId,
  selectedElementId,
  selectedShell,
  labels,
  inlineText,
  scrollRequest,
  shellScrollRequest,
  onSelectSection,
  onSelectElement,
  onSelectShell,
  onInsert,
  onMoveSection,
  onSectionAction,
  onPickImage,
  onCanvasEdit,
  onCanvasStep,
  onTextEdit,
}: {
  workspaceId: string;
  tree: PageTree;
  look: StoreLook;
  /** The workspace's saved themeSettings, which an unsaved header / footer is laid over. */
  savedThemeSettings: Record<string, unknown> | undefined;
  /** The announcement bar, header or footer have unsaved changes to show. */
  shellDirty: boolean;
  device: EditorDevice;
  onDeviceChange: (device: EditorDevice) => void;
  controlsRef: Ref<PreviewControls>;
  colorMode: ColorMode | null;
  onColorModeChange: (mode: ColorMode) => void;
  selectedSectionId: string | null;
  selectedElementId: string | null;
  selectedShell: ShellPart | null;
  /** Section id → the name on its outline. */
  labels: Record<string, string>;
  /** The elements whose text a double-click edits on the page. */
  inlineText: string[];
  scrollRequest: { sectionId: string; nonce: number } | null;
  shellScrollRequest: { part: ShellPart; nonce: number } | null;
  onSelectSection: (sectionId: string) => void;
  onSelectElement: (target: { sectionId: string; elementId: string; elementType: string }) => void;
  onSelectShell: (part: ShellPart) => void;
  onInsert: (index: number) => void;
  onMoveSection: (sectionId: string, direction: "up" | "down") => void;
  onSectionAction: (sectionId: string, action: SectionActionKind) => void;
  onPickImage: (target: { sectionId: string; elementId: string; field: string }) => void;
  onCanvasEdit: (edit: CanvasEdit) => void;
  onCanvasStep: (step: CanvasStep) => void;
  onTextEdit: (elementId: string, text: string) => void;
}) {
  const ui = editorUi(useEditorLocale());
  return (
    <StorefrontPreview
      className="bg-transparent"
      workspaceId={workspaceId}
      tree={tree}
      labels={{
        title: ui.previewTitle,
        hint: ui.previewHint,
        refresh: ui.previewRefresh,
        desktop: ui.previewDesktop,
        tablet: ui.previewTablet,
        mobile: ui.previewMobile,
        close: ui.previewClose,
        frameTitle: ui.previewFrame,
        lightMode: ui.previewLightMode,
        darkMode: ui.previewDarkMode,
        xray: ui.previewXray,
      }}
      colorMode={colorMode}
      onColorModeChange={onColorModeChange}
      chrome="none"
      controlsRef={controlsRef}
      device={device}
      onDeviceChange={onDeviceChange}
      fit
      selectedElementId={selectedElementId}
      onSelectElement={onSelectElement}
      onSectionAction={onSectionAction}
      onPickImage={onPickImage}
      canvas={{
        selectedId: selectedSectionId,
        labels,
        strings: {
          addAbove: ui.addAbove,
          addBelow: ui.addBelow,
          moveUp: ui.moveSectionUp,
          moveDown: ui.moveSectionDown,
          dragSection: ui.canvasDragSection,
          dragElement: ui.canvasDragElement,
          resizeHeight: ui.canvasResizeHeight,
          resizeColumns: ui.canvasResizeColumns,
          resizeImage: ui.canvasResizeImage,
          auto: ui.canvasAuto,
          editText: ui.canvasEditText,
        },
        theme: lookToPreview(look),
        scrollRequest,
        selectedShell,
        shellLabels: {
          header: ui.shellHeader,
          footer: ui.shellFooter,
          announcement: ui.announcementBar,
        },
        // Only while there is something unsaved to show: otherwise
        // the frame draws the saved header and footer untouched.
        shell: shellDirty ? lookToShellPreview(savedThemeSettings, look) : null,
        shellScrollRequest,
        onSelectShell,
        onSelect: onSelectSection,
        onCanvasEdit,
        onCanvasStep,
        inlineText,
        onTextEdit,
        onInsert,
        onMoveSection,
      }}
    />
  );
}
