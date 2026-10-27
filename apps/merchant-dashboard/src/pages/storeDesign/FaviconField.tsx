import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { Alert, Button, ZLoader } from "@store-builder/ui";
import type { MediaAsset } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { getErrorMessage } from "@/lib/errors";
import { imageSrc } from "@/lib/media";
import { FAVICON_ACCEPT, FAVICON_MIN, FaviconError, makeSquareIcon } from "@/lib/faviconImage";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { TextField } from "@/components/Field";
import { Modal } from "@/components/Modal";

const LIBRARY_LIMIT = 60;

const STRINGS = {
  en: {
    favicon: "Icon link (favicon)",
    faviconHint: "A square PNG or ICO, at least 32×32. Upload one, pick one from your media library, or paste a link.",
    upload: "Upload icon",
    preparing: "Preparing…",
    uploading: "Uploading…",
    library: "Choose from library",
    remove: "Remove",
    preview: "Icon preview",
    libraryTitle: "Choose an icon",
    libraryDescription: "Pick one of the images you've uploaded to this store.",
    libraryEmpty: "No images in the library yet.",
    libraryError: "The library could not be loaded.",
    use: "Use this image",
    wrongType: "Choose a PNG, ICO, JPG or WebP image.",
    tooSmall: "This image is too small: an icon needs at least {min}×{min} pixels.",
    unreadable: "This image can't be read. Try another file.",
  },
  ar: {
    favicon: "رابط الأيقونة (favicon)",
    faviconHint: "صورة مربعة PNG أو ICO بحجم 32×32 على الأقل. ارفع صورة أو اخترها من مكتبة الصور أو الصق رابطًا.",
    upload: "رفع أيقونة",
    preparing: "جارٍ التجهيز…",
    uploading: "جارٍ الرفع…",
    library: "اختيار من المكتبة",
    remove: "إزالة",
    preview: "معاينة الأيقونة",
    libraryTitle: "اختر أيقونة",
    libraryDescription: "اختر إحدى الصور التي رفعتها لهذا المتجر.",
    libraryEmpty: "لا توجد صور في المكتبة بعد.",
    libraryError: "تعذّر تحميل المكتبة.",
    use: "استخدام هذه الصورة",
    wrongType: "اختر صورة PNG أو ICO أو JPG أو WebP.",
    tooSmall: "الصورة صغيرة جدًا: تحتاج الأيقونة إلى {min}×{min} بكسل على الأقل.",
    unreadable: "تعذّرت قراءة هذه الصورة. جرّب ملفًا آخر.",
  },
} satisfies Messages;

/**
 * The store favicon: a link field, plus an upload that crops the picked image
 * to a centred square of at most 512px (lib/faviconImage, not the general
 * upload resize), a picker over the media library, and a way to clear it.
 * Every way only fills the link; the settings form saves it.
 */
export function FaviconField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (url: string) => void;
  disabled: boolean;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"preparing" | "uploading" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [broken, setBroken] = useState(false);

  useEffect(() => setBroken(false), [value]);

  async function upload(file: File) {
    setError(null);
    setBusy("preparing");
    try {
      const icon = await makeSquareIcon(file);
      setBusy("uploading");
      const stored = await apiClient.uploadMedia(workspaceId, icon);
      onChange(stored.url);
    } catch (err) {
      if (err instanceof FaviconError) {
        setError(
          err.problem === "type" ? t.wrongType : err.problem === "small" ? fmt(t.tooSmall, { min: FAVICON_MIN }) : t.unreadable
        );
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setBusy(null);
    }
  }

  const locked = disabled || busy !== null;
  const showPreview = /^https?:\/\//i.test(value) && !broken;

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-end gap-3">
        <TextField
          label={t.favicon}
          hint={t.faviconHint}
          className="min-w-0 flex-1"
          type="url"
          dir="ltr"
          maxLength={1000}
          placeholder="https://"
          value={value}
          disabled={locked}
          onChange={(e) => onChange(e.target.value)}
        />
        {showPreview && (
          <img
            src={imageSrc(value) ?? value}
            alt={t.preview}
            className="mb-6 size-10 shrink-0 rounded-[0.5rem] border border-line object-contain"
            onError={() => setBroken(true)}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" disabled={locked} onClick={() => inputRef.current?.click()}>
          {busy ? <ZLoader size="sm" /> : <Upload aria-hidden />}
          {busy === "preparing" ? t.preparing : busy === "uploading" ? t.uploading : t.upload}
        </Button>
        <Button size="sm" variant="outline" disabled={locked} onClick={() => setLibraryOpen(true)}>
          <ImageIcon aria-hidden />
          {t.library}
        </Button>
        {value && (
          <Button size="sm" variant="ghost" disabled={locked} onClick={() => onChange("")}>
            <Trash2 aria-hidden />
            {t.remove}
          </Button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={FAVICON_ACCEPT}
        className="hidden"
        aria-label={t.upload}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />

      {error && (
        <Alert variant="danger">{error}</Alert>
      )}

      <LibraryPicker
        open={libraryOpen}
        workspaceId={workspaceId}
        t={t}
        onClose={() => setLibraryOpen(false)}
        onPick={(url) => {
          setError(null);
          onChange(url);
          setLibraryOpen(false);
        }}
      />
    </div>
  );
}

function LibraryPicker({
  open,
  workspaceId,
  t,
  onClose,
  onPick,
}: {
  open: boolean;
  workspaceId: string;
  t: (typeof STRINGS)["en"];
  onClose: () => void;
  onPick: (url: string) => void;
}) {
  const [images, setImages] = useState<MediaAsset[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setImages(null);
    setFailed(false);
    apiClient
      .listMedia(workspaceId, { limit: LIBRARY_LIMIT })
      .then((page) => live && setImages(page.media.filter((asset) => asset.mimeType.startsWith("image/"))))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [open, workspaceId]);

  return (
    <Modal open={open} onClose={onClose} title={t.libraryTitle} description={t.libraryDescription}>
      {failed ? (
        <Alert variant="danger">{t.libraryError}</Alert>
      ) : images === null ? (
        <div className="flex justify-center py-6">
          <ZLoader />
        </div>
      ) : images.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-soft">{t.libraryEmpty}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((asset) => (
            <li key={asset.id}>
              <button
                type="button"
                className="block aspect-square w-full overflow-hidden rounded-[0.5rem] border border-line bg-paper focus-visible:outline-2"
                aria-label={t.use}
                onClick={() => onPick(asset.url)}
              >
                <img src={imageSrc(asset.url) ?? asset.url} alt="" loading="lazy" className="size-full object-contain" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
