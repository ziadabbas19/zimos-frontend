import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { Button, Input, ZLoader } from "@store-builder/ui";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { getErrorMessage } from "@/lib/errors";
import { ACCEPTED_IMAGE_ACCEPT, compressImageIfNeeded, validateImageFile } from "@/lib/media";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { upload: "Upload", remove: "Remove image", placeholder: "Image link, or upload one" },
  ar: { upload: "رفع", remove: "حذف الصورة", placeholder: "رابط الصورة، أو ارفع صورة" },
} satisfies Messages;

/**
 * One picture as an absolute URL: paste a link or upload through the media
 * library. The storefront renders it from another host, so the stored value
 * is always the absolute `url` the upload returns.
 */
export function ImageUrlInput({
  id,
  value,
  onChange,
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const prepared = await compressImageIfNeeded(file);
      const problem = validateImageFile(prepared);
      if (problem) {
        setError(problem);
        return;
      }
      const media = await apiClient.uploadMedia(workspaceId, prepared);
      onChange(media.url);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {value ? (
          <img src={value} alt="" className="size-10 shrink-0 rounded-[0.5rem] border border-line object-cover" />
        ) : null}
        <Input
          id={id}
          dir="ltr"
          value={value}
          disabled={disabled || busy}
          placeholder={t.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1"
        />
        <input
          ref={input}
          type="file"
          accept={ACCEPTED_IMAGE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="min-h-10 shrink-0"
          disabled={disabled || busy}
          onClick={() => input.current?.click()}
        >
          {busy ? <ZLoader size="sm" /> : <Upload className="size-4" aria-hidden />}
          {t.upload}
        </Button>
        {value && (
          <button
            type="button"
            aria-label={t.remove}
            disabled={disabled || busy}
            onClick={() => onChange("")}
            className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-[0.5rem] text-ink-soft hover:bg-danger-soft hover:text-danger"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}
