import { useRef, useState } from "react";
import { Image as ImageIcon, Trash2, Upload, X } from "lucide-react";
import { Alert, Button, Label, Spinner } from "@store-builder/ui";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { getErrorMessage } from "@/lib/errors";
import { ACCEPTED_IMAGE_ACCEPT, compressImageIfNeeded, validateImageFile } from "@/lib/media";

/**
 * Image picker for a page element's props. Uploads through the same R2 flow the
 * catalog uses (`apiClient.uploadMedia` → POST /workspaces/:id/media) and stores
 * the returned **absolute** `url` in the tree: unlike the dashboard's product
 * images, a page tree is rendered by the public storefront on a different host,
 * where a host-relative path would not resolve.
 */

function useUpload() {
  const workspaceId = useWorkspaceId();
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
      setError("Could not prepare the selected image.");
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
  const [broken, setBroken] = useState(false);
  return (
    <div className="group relative size-20 shrink-0 overflow-hidden rounded-[0.5rem] border border-line bg-paper">
      {broken ? (
        <div className="flex size-full items-center justify-center text-ink-soft">
          <ImageIcon className="size-5" aria-hidden />
        </div>
      ) : (
        <img src={src} alt="" className="size-full object-cover" onError={() => setBroken(true)} />
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove image"
        className="absolute right-1 top-1 rounded-full bg-ink/70 p-1 text-paper opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      >
        <X className="size-3" aria-hidden />
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
}: {
  label: string;
  value: string;
  hint?: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, busy, error } = useUpload();

  async function pick(list: FileList | null) {
    if (!list || list.length === 0) return;
    const [url] = await upload([list[0]]);
    if (url) onChange(url);
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        {value ? (
          <Thumb src={value} onRemove={() => onChange("")} />
        ) : (
          <div className="flex size-20 shrink-0 items-center justify-center rounded-[0.5rem] border border-dashed border-line text-ink-soft">
            <ImageIcon className="size-5" aria-hidden />
          </div>
        )}
        <div className="min-w-0 space-y-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? <Spinner className="size-4" /> : <Upload className="size-4" aria-hidden />}
            {value ? "Replace" : "Upload"}
          </Button>
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
}: {
  label: string;
  value: string[];
  hint?: string;
  onChange: (urls: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, busy, error } = useUpload();

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
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Spinner className="size-4" /> : <Upload className="size-4" aria-hidden />}
          Add images
        </Button>
        {value.length > 0 && (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange([])}>
            <Trash2 className="size-4" aria-hidden />
            Clear
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
