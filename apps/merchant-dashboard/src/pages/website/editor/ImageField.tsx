import { useRef, useState } from "react";
import { IconClose, IconDelete, IconImage, IconMedia, IconUpload } from "@/components/icons";
import { Alert, Button, Label, Spinner } from "@store-builder/ui";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { getErrorMessage } from "@/lib/errors";
import { ACCEPTED_IMAGE_ACCEPT, compressImageIfNeeded, validateImageFile } from "@/lib/media";
import { editorUi, useEditorLocale } from "./editorLocale";
import { useInspectorEnv, type RequestImage } from "./inspector/env";
import { inspectorUi } from "./inspector/strings";

/**
 * Image picker for a page element's props. Uploads through the same R2 flow the
 * catalog uses (`apiClient.uploadMedia` → POST /workspaces/:id/media) and stores
 * the returned **absolute** `url` in the tree: unlike the dashboard's product
 * images, a page tree is rendered by the public storefront on a different host,
 * where a host-relative path would not resolve.
 *
 * Inside the store editor the field also offers «اختار من المكتبة»: it asks
 * the editor for a picture already in the media library (`onRequestImage`,
 * or the inspector's own request when the prop is left out). Anywhere else
 * nothing provides it and the field is the upload-only one it always was.
 */

/**
 * How to open the media library for this field, or null when nobody offers
 * one. The answer is applied through the field's latest `onChange`, so a
 * picture chosen a while after the sheet opened never writes over what
 * changed in between.
 */
function useLibraryRequest(explicit: RequestImage | undefined, onUrl: (url: string) => void): (() => void) | null {
  const env = useInspectorEnv();
  const request = explicit ?? env.requestImage;
  const latest = useRef(onUrl);
  latest.current = onUrl;
  if (!request) return null;
  return () => request((url) => latest.current(url));
}

function LibraryButton({ onClick }: { onClick: () => void }) {
  const t = inspectorUi(useEditorLocale());
  return (
    <Button type="button" size="sm" variant="outline" onClick={onClick}>
      <IconMedia className="size-4" aria-hidden />
      {t.fromLibrary}
    </Button>
  );
}

function useUpload() {
  const workspaceId = useWorkspaceId();
  const ui = editorUi(useEditorLocale());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: File[]): Promise<string[]> {
    if (files.length === 0) return [];

    // Over-limit images are resized in the browser first, so validateImageFile
    // only rejects what could not be brought under the cap.
    setBusy(true);
    const prepared: File[] = [];
    try {
      for (const file of files) prepared.push(await compressImageIfNeeded(file));
    } catch {
      setBusy(false);
      setError(ui.prepareFailed);
      return [];
    }

    const rejected: string[] = [];
    const valid: File[] = [];
    for (const file of prepared) {
      const problem = validateImageFile(file);
      if (problem) rejected.push(problem);
      else valid.push(file);
    }
    setError(rejected.length > 0 ? rejected.join(" ") : null);
    if (valid.length === 0) {
      setBusy(false);
      return [];
    }

    const urls: string[] = [];
    try {
      for (const file of valid) {
        const media = await apiClient.uploadMedia(workspaceId, file);
        urls.push(media.url);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
    return urls;
  }

  return { upload, busy, error };
}

function Thumb({ src, onRemove }: { src: string; onRemove: () => void }) {
  const ui = editorUi(useEditorLocale());
  const [broken, setBroken] = useState(false);
  return (
    <div className="group relative size-20 shrink-0 overflow-hidden rounded-[0.5rem] border border-line bg-paper">
      {broken ? (
        <div className="flex size-full items-center justify-center text-ink-soft">
          <IconImage className="size-5" aria-hidden />
        </div>
      ) : (
        <img src={src} alt="" className="size-full object-cover" onError={() => setBroken(true)} />
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={ui.removeImage}
        // Nothing hovers on a touch screen: there the button stays on, at a thumb's size.
        className="cursor-pointer absolute inset-e-1 top-1 flex size-9 items-center justify-center rounded-full bg-ink/70 text-paper transition-opacity pointer-fine:size-auto pointer-fine:p-1 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100"
      >
        <IconClose className="size-4 pointer-fine:size-3" aria-hidden />
      </button>
    </div>
  );
}

/** Single image: one thumbnail plus an upload button. */
export function ImageField({
  label,
  value,
  hint,
  onChange,
  onRequestImage,
  labelHidden = false,
}: {
  label: string;
  value: string;
  hint?: string;
  onChange: (url: string) => void;
  /** Opens the media library and applies the chosen picture. Absent: upload only, as before. */
  onRequestImage?: RequestImage;
  /** Keeps the label for screen readers only — where a heading right above already names the picture. */
  labelHidden?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, busy, error } = useUpload();
  const ui = editorUi(useEditorLocale());
  const openLibrary = useLibraryRequest(onRequestImage, onChange);
  const uploadButton = (
    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
      {busy ? <Spinner className="size-4" /> : <IconUpload className="size-4" aria-hidden />}
      {value ? ui.replace : ui.upload}
    </Button>
  );

  async function pick(list: FileList | null) {
    if (!list || list.length === 0) return;
    const [url] = await upload([list[0]]);
    if (url) onChange(url);
  }

  return (
    <div className="space-y-1.5">
      <Label className={labelHidden ? "sr-only" : undefined}>{label}</Label>
      <div className="flex items-center gap-3">
        {value ? (
          <Thumb src={value} onRemove={() => onChange("")} />
        ) : (
          <div className="flex size-20 shrink-0 items-center justify-center rounded-[0.5rem] border border-dashed border-line text-ink-soft">
            <IconImage className="size-5" aria-hidden />
          </div>
        )}
        <div className="min-w-0 space-y-1">
          {openLibrary ? (
            <div className="flex flex-wrap gap-2">
              {uploadButton}
              <LibraryButton onClick={openLibrary} />
            </div>
          ) : (
            uploadButton
          )}
          {hint && <p className="text-xs text-ink-soft">{hint}</p>}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files);
          e.target.value = "";
        }}
      />
      {error && <Alert variant="danger">{error}</Alert>}
    </div>
  );
}

/** Multiple images (gallery): a strip of thumbnails plus multi-file upload. */
export function ImageListField({
  label,
  value,
  hint,
  onChange,
  onRequestImage,
}: {
  label: string;
  value: string[];
  hint?: string;
  onChange: (urls: string[]) => void;
  /** Opens the media library; the chosen picture is added to the end. Absent: upload only, as before. */
  onRequestImage?: RequestImage;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, busy, error } = useUpload();
  const ui = editorUi(useEditorLocale());
  const openLibrary = useLibraryRequest(onRequestImage, (url) => onChange([...value, url]));

  async function add(list: FileList | null) {
    if (!list || list.length === 0) return;
    const urls = await upload(Array.from(list));
    if (urls.length > 0) onChange([...value, ...urls]);
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((src, i) => (
            <Thumb
              key={`${src}-${i}`}
              src={src}
              onRemove={() => onChange(value.filter((_, j) => j !== i))}
            />
          ))}
        </div>
      )}
      <div className={openLibrary ? "flex flex-wrap items-center gap-2" : "flex items-center gap-2"}>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Spinner className="size-4" /> : <IconUpload className="size-4" aria-hidden />}
          {ui.addImages}
        </Button>
        {openLibrary && <LibraryButton onClick={openLibrary} />}
        {value.length > 0 && (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange([])}>
            <IconDelete className="size-4" aria-hidden />
            {ui.clear}
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          void add(e.target.files);
          e.target.value = "";
        }}
      />
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
      {error && <Alert variant="danger">{error}</Alert>}
    </div>
  );
}
